# Email delivery

All sender addresses, default reply-to addresses, and admin notifications use admin@mychristiantutors.com. The private tutor email field controls tutor inquiries and booking notifications. It is never returned in the public tutor API.

Apply db/013-email-delivery.sql before deploying this implementation. Contact email submission is enabled only when both RESEND_API_KEY and EMAIL_DELIVERY_ENABLED=1 are set on the server. Until then, contact forms show a message preview in both local and hosted environments.

Tutor email delivery is separately controlled by TUTOR_EMAIL_DELIVERY_ENABLED=1 and is off by default. While off, tutor inquiries route to admin. The delivery worker holds messages addressed to stored tutor email addresses and all tutor booking notification keys, including previously queued messages. Customer and admin messages can still send. Keep this switch off during testing; enabling it later also releases eligible held messages.

Paid Stripe confirmations enqueue immutable customer, admin, and available tutor messages in the same transaction that confirms the reservation. Sandbox payments create non-deliverable drafts by default. Setting SANDBOX_ORDER_EMAIL_DELIVERY_ENABLED=1 allows new sandbox customer/admin receipts when EMAIL_DELIVERY_ENABLED=1. Their subjects and bodies identify them as test bookings and explicitly say no money was charged. Sandbox tutor notifications are always non-deliverable, even if tutor delivery is later enabled. Older sandbox drafts are not released by turning on the switch. Live payments still need a live Stripe integration.

Queue entries have unique message keys. Each worker claims a row in a transaction. Parallel workers skip locked rows and claimed messages have a five-minute lease. The first-attempt timestamp is committed before calling Resend so crashes cannot reset the provider deduplication window. The adapter supplies Resend's idempotency key. Successful messages keep their provider ID and timestamp. Failure records remain available for retries. After 23 hours from the first attempt, a message that was attempted but has no recorded success is excluded from automatic retries. Inspect Resend delivery logs before resolving it, because provider idempotency keys expire after 24 hours.

Contact requests submit a browser-generated request ID. Reply-to is the visitor's email. Tutor inquiries require a configured tutor address only when direct tutor delivery is enabled. While paused, they route to admin with the tutor's name in the subject. Each sender is limited to five queued inquiries an hour. This provides a basic limit; add challenge-based abuse protection before substantial public traffic.

The protected POST /api/deliver-emails worker accepts Authorization: Bearer EMAIL_WORKER_SECRET. It handles up to three messages per call. The GitHub workflow calls it every five minutes once its repository variable is enabled. Initial contact submissions and payment confirmations also invoke the worker. Pending messages require this scheduled worker for reliable retries when no further requests arrive.

Before activation, verify the sender domain in Resend, save RESEND_API_KEY, set EMAIL_WORKER_SECRET, enable the scheduler, and then set EMAIL_DELIVERY_ENABLED=1. No email is sent by development tests. Use an explicitly selected test inbox for a delivery smoke test before opening the contact forms.

## Production preparation

The Resend API key and worker secret are saved in Vercel Production. All three DNS records were verified on November 20, 2026, and Resend accepted a controlled message to admin@mychristiantutors.com. This confirms provider acceptance; check the mailbox or Resend logs for final delivery.

Production activation is still pending: deploy the tutor guard and sandbox receipt controls first, set TUTOR_EMAIL_DELIVERY_ENABLED=0, SANDBOX_ORDER_EMAIL_DELIVERY_ENABLED=1 for checkout tests, and EMAIL_DELIVERY_ENABLED=1. A five-minute GitHub Actions workflow lives on the repository default branch, main, because GitHub only schedules workflows from that branch. It does not check out or deploy the application. Its EMAIL_RETRIES_ENABLED repository variable remains false until activation. Enable that variable for automatic retries. GitHub schedules can be delayed, so they provide best-effort retries.

Keep the newsletter signup as a preview; it does not save subscribers or send an offer. Before accepting real payments, configure live Stripe and its webhook, confirm business policies, and explicitly decide when tutor delivery should begin. A sending-only Resend key cannot read domain status or delivery logs; use the Resend dashboard for delivery, bounce, and complaint monitoring. No additional key permissions are required for sending.

The active tutor roster has 14 names. Tutor email addresses are stored privately in the database, with Elisabeth Rainey and Marjorie McIlvaine retaining the stable IDs of their earlier names. Tutors outside the supplied roster are archived to preserve historical bookings. Haley Hill is assigned Biology until her subjects are confirmed.

Run npm run test:email for the repeatable email integration checks. They use a temporary database schema, remove it afterward, replace the Resend transport, and verify routing, draft creation, concurrent workers, and failure recovery without sending email.
