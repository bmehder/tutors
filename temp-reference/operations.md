# Email and operations

Updated November 21, 2026. Migration 016 is applied to development and the hosted database. The Operations screen is published in app release `9f0ba03`; the default-branch workflow is updated in `0251cd9`. A hosted worker check succeeded November 21 at 11:48 AM Eastern (GitHub run `44926539139`): no pending or failed messages, no emails sent. Private production sign-in, Operations refresh, phone layout and all 22 public pages passed verification. Tutor email remains disabled.

## People and accounts

- **Anna:** admin@mychristiantutors.com inquiries, customer scheduling and checking delivery details in Resend. Brad confirmed Anna has Resend access and supplied a screenshot showing the controlled test messages as Delivered.
- **Brad and Shawn together:** failed email retries, Stripe issues, hosting errors and recovery. This ownership was confirmed by Brad.
- Brad confirmed platform-account recovery access is covered. Keep credentials and recovery codes for Vercel, Neon, GitHub, Stripe, Resend and Google Workspace in private storage, outside Git.

## What to check

The private admin **Operations** screen is read-only. Refreshing its status makes a GET request; it does not call the sending worker or release messages.

| App status | Meaning / response |
|---|---|
| Waiting | Ready for the worker; check the oldest waiting timestamp if the backlog persists. |
| Retrying | An attempted send failed within the automatic retry window. Check the worker and Resend. |
| Needs review | An attempted message has an uncertain result after 23 hours. Inspect Resend before doing anything that could send it again. |
| Tutor messages held | Deliberately held by the tutor-delivery switch. Do not release during testing. |
| Drafts / sending blocked | Non-deliverable drafts, including sandbox tutor messages. A switch change must not release older blocked drafts. |
| Sent to Resend | The provider accepted the request. Resend remains the source for actual delivery, bounces and complaints. |

The screen shows up to 20 unsent problem messages without their message bodies, and links to Resend, GitHub Actions, Stripe and Vercel logs. It complements Resend; it does not reproduce its email history.

Worker health records start/completion in one database row, without recipient details. It distinguishes never run, running, healthy, failed, stalled and overdue. Overdue means no completed check for more than 15 minutes; a run that starts but does not finish within 2 minutes is shown as stalled. Overlapping workers cannot overwrite the current run with an older completion. A completed check can still leave failed messages; queue warnings remain separate.

Migration 016 adds the heartbeat table. Missing heartbeat storage does not stop delivery or break the rest of admin; it is explicitly shown as unconfigured. It is applied to development and production. It passed on an isolated copy of the hosted database before being applied; no booking records changed.

## Scheduled retries: accepted for soft launch

The GitHub workflow is active and enabled, but its last two scheduled successes were November 21 at 01:31 and 08:41 UTC. These gaps are much longer than its nominal five-minute schedule. A successful historical run is not evidence of a timely background service.

The deployed workflow moves runs away from minute zero, uses the real www domain and fails the job when messages need review or have send errors, rather than reporting success merely because the HTTP request returned 200. Only counts are printed. It is updated on the repository's default `main` branch in `0251cd9`; changing only `astro-lustre` would not update the running schedule. The controlled manual run succeeded; it does not resolve the separate scheduler-timing concern.

GitHub explicitly allows scheduled jobs to be delayed or dropped under load. Brad approved retaining it for the low-volume soft launch, accepting potential retry delays after an initial send failure. Keep Operations monitoring and daily Bookings/Operations checks during that period. Revisit scheduling before paid promotion, or sooner if delays cause problems. An odd-minute cron alone is not a delivery guarantee; no paid upgrade or additional scheduler account has been authorized.

Reference: [GitHub scheduled workflow behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

## Tutor notification workflow: prepared, not enabled

1. Confirmed payment records the order and queues customer/admin messages and the assigned tutors' messages in the same transaction.
2. Each tutor receives only their assigned sessions plus family contact information. Replies go to admin. The notification tells the tutor to report agreed schedule changes so admin can update the booking.
3. While tutor delivery is paused, inquiries for a tutor go to admin and tutor-addressed messages are held.
4. Sandbox tutor notifications are permanently non-deliverable. Live notification activation still depends on live Stripe and Brad's explicit approval.
5. Before enabling tutor mail, inspect held live messages so old orders are not unexpectedly announced. Keep the tutor roster's email and meeting instructions review with Anna.

No new messages were sent to tutors during this work. All email transport in development/integration/browser tests is simulated or disabled.

## Database recovery: verified branch and actual window

Project: `proud-field-43096690`. The configured restore history is **21,600 seconds (6 hours)**, verified through the authenticated Neon API on November 21.

**Use the actual application branch, not its misleading historical labels:**

| Purpose | Neon branch | Branch ID |
|---|---|---|
| Hosted public website/admin | `public-admin-demo` | `br-odd-resonance-bb4o8lf0` |
| Local development | `booking-api-dev` | `br-steep-bird-bb4t1pfy` |
| Historical empty primary branch | `production` | `br-rapid-cherry-bbjd9c97` |

The local ignored `.neon` context was corrected to `booking-api-dev` to match `.env.local`; application connection strings were not changed. The hosted branch's tables and deployed checkout migration were verified before the recovery drill. No branches were renamed.

A separate branch was restored from the hosted application's state two minutes earlier. Booking, session, tutor and outgoing-email tables were queried successfully there. The temporary recovery branch was deleted afterward. The live database was not reset or modified by this drill.

Brad accepted the six-hour restore window on November 21, 2026. Longer retention/independent backups are not a launch requirement. Email receipts can help reconstruct orders manually, although they are not a complete database backup. No paid plan was enabled and no customer-data dump was written to disk as part of this test.

Recovery procedure:

1. Stop writes if an incident could be damaging records; involve Brad/Shawn before changing live data.
2. Select a timestamp inside the verified history window and create a recovery branch from the hosted application branch. Check its tables and the required bookings before switching anything.
3. Preserve valid bookings/payments received after the recovery point. Reconcile Stripe and email state; restoring the database does not reverse payments or recall email.
4. Repoint the application's private database setting and redeploy only after deciding how those newer records will be retained. Verify login, availability and affected orders. Keep the original branch until recovery is confirmed.

References: [Neon restore history](https://neon.com/docs/introduction/history-window), [Neon branching recovery](https://neon.com/docs/manage/branches).

## Admin access recovery

Existing production sign-in was verified on November 21; no password was changed during this work. The local private production credential record is `~/.config/mychristiantutors/production-admin.txt`; do not copy its contents into this document or Git.

If access is lost, use the authorized Vercel account to set a new private `BOOKING_ADMIN_PASSWORD`. Rotate `BOOKING_ADMIN_SIGNING_KEY` if existing login sessions must be invalidated, and redeploy. Confirm the email setting and new sign-in, then update the private credential record/password manager. Local sign-in uses separate `BOOKING_DEV_ADMIN_EMAIL` and `BOOKING_DEV_ADMIN_PASSWORD`; changing those does not reset production access.

A password/session-key rotation has not been performed as a live recovery test because it would invalidate Anna's working access. Brad confirmed on November 21, 2026 that platform-account recovery access is covered for Brad and Shawn.

## Public testing controls and domain

Production source restricts the time-travel inspector and debug links to development. Keep the local tools available. Test card guidance and order-email previews are still intentionally part of the sandbox checkout; remove or restrict those as part of the final live-payment switch, rather than hiding them before the agreed testing is finished.

Verified November 21: HTTP/apex use 308 redirects to the HTTPS www domain; the alternate Vercel URL serves the same public site, canonical metadata points to www, and noindex is active. Recheck at launch. Public availability remains cleared and tutor delivery stays off until separately approved.
