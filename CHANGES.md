# What changed in this version (v2.0)

## Removed Emergent dependencies
- Google login now uses Google's own Sign-In (`GOOGLE_CLIENT_ID`) instead of `auth.emergentagent.com`.
- AI receptionist calls OpenAI or Anthropic directly (`OPENAI_API_KEY` / `ANTHROPIC_API_KEY`) instead of `emergentintegrations`.
- Logo uploads are stored on local disk or any S3-compatible storage instead of Emergent's object store.
- Removed the Emergent script, "Made with Emergent" badge and Emergent's PostHog tracking from `index.html`,
  the Emergent visual-edits build plugin, the Emergent-hosted default logo and Emergent test/config files.

## Security fixes
- AI receptionist / external API endpoints never checked the API key (`api_key=admin` worked for anyone).
  Now each business generates its own key (stored hashed) and the API is limited to Pro plans.
- Staff accounts could change business settings, plans, prices, other staff, webhooks and reports. Added
  real roles (owner / admin / staff) and per-person permissions, enforced on the server.
- Any business could upgrade itself to Pro, turn on paid add-ons or rewrite protected fields
  (`PUT /tenants/me` and other update endpoints accepted any field). All updates are now whitelisted.
- Default `JWT_SECRET` / admin secret fallbacks removed: the server refuses to start in production without a real secret.
- CORS was open to every site; now limited to your frontend URL.
- No way to create a super admin existed; it's now created from `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`.
- Webhook signatures couldn't be verified (signed a Python string, not the sent body) and the secret was sent in a header.
- Stored XSS in the printable report (client names were written into HTML unescaped).
- Rate limiting on login, signup, password reset, public booking and chat; regex-injection-safe search;
  uploads checked by file content; webhook URLs can't target internal addresses; password change/reset signs out other sessions.

## Booking bugs fixed
- Online bookings saved the end time in UTC while the start was local, so a 10:00 booking in Irish summer time
  "ended" at 09:30, which broke clash detection, the calendar and reports. Times are now consistently the business's
  local time and old records are repaired automatically on start-up.
- The server didn't check working hours, breaks, time off, the past or minimum notice when a booking was made;
  any time could be booked by calling the API. Every booking channel now uses one engine that checks all of these.
- Dragging an appointment on the calendar could double-book someone. Moves are now clash-checked.
- Two people booking the same slot at the same moment could both succeed. Now only one does.
- The clash check missed bookings that fully contain another one.
- Online booking showed staff who don't offer the chosen service, ignored the "require email" setting and
  hard-coded Sundays as closed.
- The AI receptionist booked whatever time the model said, with the first staff member, without checking
  availability. It now checks real availability first and can only book free slots.
- Client visit counts, spend and last visit were never updated (always 0). They're now calculated live.
- Deleting a client failed (no endpoint).

## Features that existed in the UI but didn't work, now working
- Appointment reminders are actually sent (background job), with email/SMS templates you can edit.
- Approval workflow for long appointments: setting, "needs approval" status, approve/decline, client emails.
- Booking settings switches (online booking on/off, require email/phone, client cancellation, notice period,
  how far ahead, slot spacing) are saved and enforced.
- The chat bubble on the website gave random canned answers; it's now the real AI receptionist on each business's booking page.
- Forms page was a placeholder; you can now build intake forms that clients fill in when booking (Pro).
- Time off / holidays for staff, staff logins and permissions, password reset by email, change password.
- Theme/branding choice wasn't saved; the logo upload wasn't saved until you pressed a different button.
- Currency setting is used everywhere (was hard-coded to €).

## Honesty fixes on the marketing site
- Removed the "Trusted by 2,000+ businesses" claim and made-up company names.
- Features not built yet (Google Calendar sync, waitlist, packages, online deposit payments, multi-location,
  resource booking) are marked "coming soon".

## Not included (still to build if you want them)
- Card payments / subscriptions billing (plans are set manually in /admin).
- Google Calendar sync, waitlist, packages, multi-location.

## Text messages & WhatsApp (branch `ai-messaging`)
- Clients can text or WhatsApp the salon's Twilio number and the AI receptionist answers, checks real availability
  and books. By text it uses the sender's number, so no email is needed, and clients can see, move or cancel their own
  bookings from the same number (other numbers can't).
- Replies are sent separately from Twilio's webhook, so slow AI answers no longer time out; Twilio retries are ignored.
- Text reminders are sent from the salon's own number (so clients can reply to it), and local numbers like 087 123 4567
  are converted to +353 87 123 4567 (previously these reminders would have failed).
- /admin → business → Edit: set the SMS number, WhatsApp number and switch the SMS add-on on.
