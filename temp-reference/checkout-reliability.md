# Checkout retries and expiring holds

Prepared November 21, 2026. Migration 015 is applied to development and production. The production migration was validated against a disposable copy of the hosted schema before being applied; existing booking and tutor records were preserved. The sandbox webhook now includes `checkout.session.expired`. The application deploys from `astro-lustre`.

## Rules

- A checkout attempt has a random request ID. Retrying an unchanged plan reuses the original reservation, accepted price and Stripe checkout. Changed plans need a new ID. The browser retains only the ID and a SHA-256 plan fingerprint in session storage so returning from Stripe can reuse the attempt; it does not store contact details there.
- Temporary checkout/network failures keep the accepted order on the payment step with retry enabled. The browser does not refresh availability against its own hold on this path. Genuine validation or booking conflicts return to review and refresh availability.
- New requests must pass the current tutor availability, subject eligibility, 72-hour notice, student limits, contact validation and server discount rules. An accepted retry does not invalidate its existing hold when the notice deadline or advertised hours subsequently change.
- Stripe holds last 45 minutes locally; development mock holds last 10 minutes. One email address can have at most 3 unfinished, unreleased holds. IP request limits are an additional protection.
- The database reserves all sessions in a transaction. Its tutor/time exclusion constraint prevents double booking, including simultaneous requests from different families. A conflict rolls back the whole plan.
- A Stripe creation attempt is recorded before contacting Stripe. Stable creation parameters and the reservation's Stripe idempotency key recover a lost response without making another checkout. A temporary error does not delete the reservation.
- An expired hold is checked before its sessions can be offered again. A paid checkout is confirmed, even if its webhook arrived late. An open checkout must be expired at Stripe before releasing its sessions. If payment wins that race, the booking is confirmed instead.
- When an unpaid hold is released, its sessions and abandoned contact details are removed. Its request identity remains as a tombstone so a delayed retry cannot recreate it. The database also prohibits a reservation being both released and confirmed.
- Repeated confirmations use the existing unique email keys. They do not make duplicate order emails. Tutor emails remain disabled under the separate delivery rules.

## Cleanup and unresolved payments

Availability requests that include reservations, new booking attempts, and admin creates/moves reconcile bounded batches of up to 10 expired holds. Concurrent requests claim different batches. Failed provider checks retry after at least 1 minute; no unknown payment is interpreted as unpaid. The signed `checkout.session.expired` webhook can release the matching hold immediately.

Stripe defaults a new checkout to its own 24-hour expiry. The application explicitly closes it when reconciling its shorter local hold. Until that check succeeds, the time remains blocked even after the local deadline; the frontend receives an indefinite reservation block instead of silently dropping it. Cleanup is request-driven, so a quiet site may retain an expired hold until someone next checks availability or starts booking.

An unknown creation response more than 23 hours old requires investigation. Do not call Stripe creation again: its idempotency keys can be pruned after 24 hours. Check Stripe by reservation reference, record any paid order, or verify that its payment page can no longer accept payment before releasing it. A warning logs the reservation ID without family contact details. An admin interface for investigating unresolved holds remains follow-up work; do not force-delete them.

References: [Stripe idempotency](https://docs.stripe.com/api/idempotent_requests), [expiring Checkout sessions](https://docs.stripe.com/api/checkout/sessions/expire).

## Deployment order

1. Run the integration tests against the development connection. They create and remove isolated schemas; Stripe and email transport are simulated.
2. Apply `db/014-request-limits.sql` if not already applied, and `db/015-checkout-reliability.sql`, with a direct database connection. Test on a database branch before production. Migration 015 must precede this application's deployment because availability, admin booking changes, confirmation and reservations use its columns.
3. Deploy the matching server and planner assets together. Apply migrations before pushing if the branch auto-deploys. Existing open browser tabs with older planner code will be asked to refresh before starting checkout.
4. Enable the tested request protection settings following `request-protection.md`. Keep sandbox payments, noindex, cleared public availability and disabled tutor emails.
5. Include `checkout.session.expired` as well as `checkout.session.completed` in Stripe's signed webhook endpoint subscriptions. Lazy reconciliation remains a fallback if the expired event is absent or delayed.
6. Test a controlled deployed checkout and inspect its order, confirmation and queued messages. Keep the existing sandbox payment and disabled tutor-email settings. Migration 015 and the expired-event subscription were prepared before this release was pushed.

## Verification

`npm run test:checkout` exercises the actual reservation and availability routes, reservation service, Stripe adapter and hold reconciliation against an isolated database schema. It covers parallel retries, changed payloads, changed advertised hours, lost Stripe responses, competing families, safe expiry, provider outages, late payment, payment/expiry races, unrecoverable old attempts, active-hold limits, transaction rollback, duplicate confirmations and expired events. Tests turn off email delivery and replace Stripe transport; no payments or emails are sent.

`npm test` covers browser retry identity and session-storage recovery without persisting contact details. `npm run test:email` separately tests duplicate confirmation messages with simulated Resend delivery.
