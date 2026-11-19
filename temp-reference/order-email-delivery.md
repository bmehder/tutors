# Email delivery

All sender addresses, default reply-to addresses, and admin notifications use admin@mychristiantutors.com. The private tutor email field controls tutor inquiries and booking notifications. It is never returned in the public tutor API.

Apply db/013-email-delivery.sql before deploying this implementation. Contact email submission is enabled only when both RESEND_API_KEY and EMAIL_DELIVERY_ENABLED=1 are set on the server. Until then, the local contact forms retain their review behavior and hosted forms remain hidden.

Paid Stripe confirmations enqueue immutable customer, admin, and available tutor messages in the same transaction that confirms the reservation. Sandbox payments create drafts with delivery_allowed=false. They never send to customers or tutors. Live payments need a live Stripe integration before the live delivery path is used.

Queue entries have unique message keys. Each worker claims a row in a transaction. Parallel workers skip locked rows and claimed messages have a five-minute lease. The first-attempt timestamp is committed before calling Resend so crashes cannot reset the provider deduplication window. The adapter supplies Resend's idempotency key. Successful messages keep their provider ID and timestamp. Failure records remain available for retries. After 23 hours from the first attempt, a message that was attempted but has no recorded success is excluded from automatic retries. Inspect Resend delivery logs before resolving it, because provider idempotency keys expire after 24 hours.

Contact requests submit a browser-generated request ID. Reply-to is the visitor's email. Tutor inquiries require a configured tutor address. Each sender is limited to five queued inquiries an hour. This provides a basic limit; add challenge-based abuse protection before substantial public traffic.

The protected POST /api/deliver-emails worker accepts Authorization: Bearer EMAIL_WORKER_SECRET. It handles up to three messages per call. The GitHub workflow calls it every five minutes once its repository variable is enabled. Initial contact submissions and payment confirmations also invoke the worker. Pending messages require this scheduled worker for reliable retries when no further requests arrive.

Before activation, verify the sender domain in Resend, save RESEND_API_KEY, set EMAIL_WORKER_SECRET, enable the scheduler, and then set EMAIL_DELIVERY_ENABLED=1. No email is sent by development tests. Use an explicitly selected test inbox for a delivery smoke test before opening the contact forms.

## Production preparation

The Resend API key and worker secret are saved in Vercel Production. EMAIL_DELIVERY_ENABLED remains 0. A five-minute GitHub Actions workflow lives on the repository default branch, main, because GitHub only schedules workflows from that branch. It does not check out or deploy the application. Its EMAIL_RETRIES_ENABLED repository variable remains false. To activate after verification and a controlled send, enable delivery in Vercel and enable the repository variable. GitHub schedules can be delayed, so they provide best-effort retries.

The active tutor roster has 14 names. Tutor email addresses are stored privately in the database, with Elisabeth Rainey and Marjorie McIlvaine retaining the stable IDs of their earlier names. Tutors outside the supplied roster are archived to preserve historical bookings. Haley Hill is assigned Biology until her subjects are confirmed.

Run npm run test:email for the repeatable email integration checks. They use a temporary database schema, remove it afterward, replace the Resend transport, and verify routing, draft creation, concurrent workers, and failure recovery without sending email.
