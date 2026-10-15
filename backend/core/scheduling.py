"""Pure scheduling helpers (no database access) so they are easy to test.

Time convention used across BookSlot:
  Appointment times are stored as naive local wall-clock strings in the business's own
  timezone, formatted "YYYY-MM-DDTHH:MM:SS". e.g. a 10:00 appointment in Dublin is
  stored as "2026-10-16T10:00:00" whatever the server's timezone is. This keeps
  string comparisons in MongoDB correct and means the calendar shows exactly what the
  business sees on the wall clock.
"""
from datetime import date as date_cls, datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

DEFAULT_WORKING_HOURS: Dict[str, Dict[str, Any]] = {
    "monday": {"enabled": True, "start": "09:00", "end": "17:00", "breaks": []},
    "tuesday": {"enabled": True, "start": "09:00", "end": "17:00", "breaks": []},
    "wednesday": {"enabled": True, "start": "09:00", "end": "17:00", "breaks": []},
    "thursday": {"enabled": True, "start": "09:00", "end": "17:00", "breaks": []},
    "friday": {"enabled": True, "start": "09:00", "end": "17:00", "breaks": []},
    "saturday": {"enabled": False, "start": "10:00", "end": "16:00", "breaks": []},
    "sunday": {"enabled": False, "start": "10:00", "end": "16:00", "breaks": []},
}

FMT = "%Y-%m-%dT%H:%M:%S"
Interval = Tuple[datetime, datetime]


def get_zone(tz_name: Optional[str]) -> ZoneInfo:
    try:
        return ZoneInfo(tz_name or "Europe/Dublin")
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("Europe/Dublin")


def local_now(tz_name: Optional[str]) -> datetime:
    """Current wall-clock time in the business timezone (naive)."""
    return datetime.now(timezone.utc).astimezone(get_zone(tz_name)).replace(tzinfo=None, microsecond=0)


def to_local_naive(value: Any, tz_name: Optional[str]) -> datetime:
    """Parse an ISO string/datetime into naive local business time.

    Timezone-aware values (e.g. "...Z" or "+01:00") are converted into the business
    timezone; naive values are assumed to already be local.
    """
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, str):
        s = value.strip()
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
    else:
        raise ValueError("Invalid datetime value")
    if dt.tzinfo is not None:
        dt = dt.astimezone(get_zone(tz_name)).replace(tzinfo=None)
    return dt.replace(microsecond=0)


def fmt(dt: datetime) -> str:
    return dt.strftime(FMT)


def parse_date(value: str) -> date_cls:
    return datetime.strptime(value, "%Y-%m-%d").date()


def _at(day: date_cls, hhmm: str) -> datetime:
    h, m = (int(x) for x in (hhmm or "00:00").split(":")[:2])
    if h == 24:
        return datetime(day.year, day.month, day.day) + timedelta(days=1)
    return datetime(day.year, day.month, day.day, h, m)


def overlaps(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    return a_start < b_end and a_end > b_start


def day_schedule(working_hours: Optional[Dict[str, Any]], day: date_cls) -> Dict[str, Any]:
    name = DAYS[day.weekday()]
    wh = working_hours or DEFAULT_WORKING_HOURS
    return wh.get(name) or DEFAULT_WORKING_HOURS[name]


def block_applies(block: Dict[str, Any], day: date_cls) -> bool:
    ds = day.isoformat()
    start = block.get("start_date") or ""
    end = block.get("end_date") or ""
    if block.get("recurring"):
        return start <= ds and (not end or ds <= end)
    if not end:
        end = start
    return start <= ds <= end


def open_window(working_hours: Optional[Dict[str, Any]], time_blocks: Iterable[Dict[str, Any]], day: date_cls
                ) -> Optional[Tuple[datetime, datetime, List[Interval], Optional[str]]]:
    """Return (open, close, blocked_intervals, None) or None if closed all day.

    blocked_intervals contains breaks and partial-day time blocks.
    """
    sched = day_schedule(working_hours, day)
    if not sched.get("enabled", False):
        return None
    try:
        open_t = _at(day, sched.get("start", "09:00"))
        close_t = _at(day, sched.get("end", "17:00"))
    except ValueError:
        return None
    if close_t <= open_t:
        return None
    blocked: List[Interval] = []
    for brk in sched.get("breaks", []) or []:
        try:
            blocked.append((_at(day, brk.get("start", "12:00")), _at(day, brk.get("end", "13:00"))))
        except ValueError:
            continue
    for block in time_blocks or []:
        if not block_applies(block, day):
            continue
        if block.get("all_day") or not block.get("start_time") or not block.get("end_time"):
            return None  # whole day off
        try:
            blocked.append((_at(day, block["start_time"]), _at(day, block["end_time"])))
        except ValueError:
            continue
    return open_t, close_t, blocked, None


def compute_slots(
    day: date_cls,
    duration: int,
    buffer: int,
    working_hours: Optional[Dict[str, Any]],
    time_blocks: Iterable[Dict[str, Any]],
    busy: Iterable[Interval],
    earliest: Optional[datetime] = None,
    interval: int = 30,
) -> List[Interval]:
    """Available (start, end) slots for one staff member on one day.

    A slot needs `duration` minutes inside working hours, and `duration + buffer`
    minutes free of breaks, time off and other appointments.
    """
    window = open_window(working_hours, time_blocks, day)
    if window is None:
        return []
    open_t, close_t, blocked, _ = window
    duration = max(5, int(duration or 30))
    buffer = max(0, int(buffer or 0))
    interval = max(5, int(interval or 30))
    busy = list(busy)
    slots: List[Interval] = []
    t = open_t
    while t + timedelta(minutes=duration) <= close_t:
        end = t + timedelta(minutes=duration)
        occupied_end = end + timedelta(minutes=buffer)
        ok = earliest is None or t >= earliest
        if ok:
            for b_start, b_end in blocked:
                if overlaps(t, end, b_start, b_end):
                    ok = False
                    break
        if ok:
            for b_start, b_end in busy:
                if overlaps(t, occupied_end, b_start, b_end):
                    ok = False
                    break
        if ok:
            slots.append((t, end))
        t += timedelta(minutes=interval)
    return slots


def busy_intervals(appointments: Iterable[Dict[str, Any]]) -> List[Interval]:
    out: List[Interval] = []
    for a in appointments:
        try:
            s = datetime.fromisoformat(a["start_time"][:19])
            e = datetime.fromisoformat((a.get("blocked_until") or a["end_time"])[:19])
            out.append((s, e))
        except (KeyError, ValueError, TypeError):
            continue
    return out
