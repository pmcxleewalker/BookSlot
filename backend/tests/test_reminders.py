"""Unit tests for reminder scheduling (no server or database needed)."""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from reminders import is_reminder_due, parse_start, render, run_reminder_pass  # noqa: E402

NOW = datetime(2026, 10, 27, 9, 0, tzinfo=timezone.utc)


# --- minimal in-memory stand-in for the Motor collections used -------------
class _Cursor:
    def __init__(self, docs):
        self.docs = docs

    async def to_list(self, _n):
        return [dict(d) for d in self.docs]


class _Result:
    def __init__(self, n):
        self.modified_count = n


def _match(doc, query):
    for k, cond in query.items():
        v = doc.get(k)
        if isinstance(cond, dict):
            for op, arg in cond.items():
                if op == "$ne" and v == arg:
                    return False
                if op == "$in" and v not in arg:
                    return False
                if op == "$nin" and v in arg:
                    return False
                if op == "$exists" and (k in doc) != arg:
                    return False
                if op == "$gte" and not (v is not None and v >= arg):
                    return False
                if op == "$lte" and not (v is not None and v <= arg):
                    return False
        elif v != cond:
            return False
    return True


class _Coll:
    def __init__(self, docs=None):
        self.docs = docs or []

    def find(self, query, _proj=None):
        return _Cursor([d for d in self.docs if _match(d, query)])

    async def find_one(self, query, _proj=None):
        for d in self.docs:
            if _match(d, query):
                return dict(d)
        return None

    async def update_one(self, query, update):
        for d in self.docs:
            if _match(d, query):
                d.update(update["$set"])
                return _Result(1)
        return _Result(0)


class _DB:
    def __init__(self, tenants, appointments, services=None, templates=None):
        self.tenants = _Coll(tenants)
        self.appointments = _Coll(appointments)
        self.services = _Coll(services or [])
        self.message_templates = _Coll(templates or [])


def _appt(appt_id, start, **kw):
    d = {
        "appointment_id": appt_id,
        "tenant_id": "t1",
        "service_id": "s1",
        "client_name": "Aoife",
        "client_email": "aoife@example.com",
        "status": "confirmed",
        "start_time": start,
    }
    d.update(kw)
    return d


TENANT = {"tenant_id": "t1", "name": "Sharon F Hair", "timezone": "Europe/Dublin",
          "reminder_hours_before": 24, "address": "Main St"}


def _run(db):
    sent = []

    async def send(tenant_id, to, subject, body, kind):
        sent.append((to, subject, body, kind))

    n = asyncio.run(run_reminder_pass(db, send, now=NOW))
    return n, sent


# --- tests ----------------------------------------------------------------
def test_due_window():
    assert is_reminder_due(NOW + timedelta(hours=5), 24, NOW)
    assert is_reminder_due(NOW + timedelta(hours=24), 24, NOW)
    assert not is_reminder_due(NOW + timedelta(hours=25), 24, NOW)
    assert not is_reminder_due(NOW - timedelta(minutes=1), 24, NOW)
    assert not is_reminder_due(None, 24, NOW)


def test_naive_start_uses_tenant_timezone():
    dt = parse_start("2026-07-01T10:00:00", "Europe/Dublin")  # IST = UTC+1
    assert dt.astimezone(timezone.utc).hour == 9


def test_render_keeps_unknown_placeholders():
    assert render("Hi {client_name} {oops}", {"client_name": "Niamh"}) == "Hi Niamh {oops}"


def test_sends_due_reminder_once():
    db = _DB([TENANT], [_appt("a1", "2026-10-28T08:30:00+00:00")],
             services=[{"service_id": "s1", "name": "Cut & blow-dry"}])
    n, sent = _run(db)
    assert n == 1
    to, subject, body, kind = sent[0]
    assert to == "aoife@example.com" and kind == "reminder"
    assert "Sharon F Hair" in subject
    assert "Cut & blow-dry" in body and "08:30" in body  # Dublin is UTC+0 in late Oct
    # second pass must not resend
    n2, _ = _run(db)
    assert n2 == 0


def test_skips_far_future_cancelled_no_email_and_disabled_tenant():
    appts = [
        _appt("far", "2026-10-30T10:00:00+00:00"),
        _appt("cxl", "2026-10-27T15:00:00+00:00", status="cancelled"),
        _appt("noemail", "2026-10-27T15:00:00+00:00", client_email=""),
    ]
    n, _ = _run(_DB([TENANT], appts))
    assert n == 0
    off = dict(TENANT, email_reminders_enabled=False)
    n, _ = _run(_DB([off], [_appt("a1", "2026-10-27T15:00:00+00:00")]))
    assert n == 0


def test_uses_tenant_template_and_custom_hours():
    tenant = dict(TENANT, reminder_hours_before=48)
    tmpl = {"tenant_id": "t1", "trigger": "reminder", "type": "email", "is_active": True,
            "subject": "See you soon", "content": "Hi {client_name}, at {time}."}
    db = _DB([tenant], [_appt("a1", "2026-10-29T07:00:00+00:00")], templates=[tmpl])
    n, sent = _run(db)
    assert n == 1
    assert sent[0][1] == "See you soon" and sent[0][2] == "Hi Aoife, at 07:00."


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("PASS", name)
