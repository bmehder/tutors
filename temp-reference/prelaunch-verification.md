# Remaining technical checks — November 21, 2026

## Scheduling decision

Brad approved keeping GitHub retries for the low-volume soft launch, accepting possible delays when an initial email attempt fails. Initial sends still happen immediately; the scheduled job is recovery for messages not successfully handed to Resend. Keep the current retry job and Operations monitoring, and check Bookings/Operations daily during the soft launch. This is no longer a soft-launch blocker. Revisit scheduling before paid promotion, or sooner if delayed retries cause problems. Vercel is on Hobby; do not upgrade the plan or create an Upstash account without a further decision. GitHub scheduling remains best-effort, not a reliability guarantee.

## Deployed Stripe sandbox check: passed

- Published release: `a5bad17` (Google verification file), with the existing hosted checkout backend.
- Test order: `680a007f-f13b-4fe0-a3a0-31f35e2259c5`; label **Prelaunch Checkout Check**. This is a test payment, not real revenue.
- Real Stripe sandbox checkout completed with a test card for **$300 USD**, five sessions. Stripe event: `evt_1UeHpe2ccqfNWXKkKkSUjzbJ`.
- The browser's customer-return URL was blocked until the database showed confirmation. This verifies that the real signed webhook confirmed the order independently of the return-page fallback.
- At verification time, the private production admin listed the paid order, correct total and five sessions. The test order was subsequently removed in the approved cleanup below.
- Hosted confirmation lists the sessions and price; customer/admin email previews, print button and PDF output worked.
- Resend accepted two messages, both deliberately addressed to `admin@mychristiantutors.com` for the customer/admin check. The sending-only key cannot inspect final mailbox-delivery status; Anna can inspect those receipts in Resend. No tutor email was sent. The third tutor message remains blocked.
- Existing orders were not changed during the checkout test. Brad subsequently approved removing all eight test orders without an archive; that cleanup is complete below.

Public availability stayed cleared throughout. To test hosted payment without opening public bookings, a private accepted test hold was prepared directly in the database for five dates in May/June 2030. The actual production reservation retry route created its Stripe checkout. This did **not** exercise initial public availability selection against production; the separate production-build browser walkthrough exercises that full planner journey with isolated availability and simulated providers.

## Test-order cleanup: complete

Brad confirmed that all eight orders, including the manual Luigi Hamiltoni order, were disposable records from earlier development/testing. He explicitly declined retaining a database archive.

Removed from the hosted application database on November 21, 2026:

- **8 test orders** (five Demo families, one manual test and two verified Stripe sandbox orders).
- **65 reserved sessions**, releasing all test booking blocks.
- **4 test email records**: three associated order messages and the separately identified earlier contact-delivery test. No emails were sent during cleanup.

Only the reviewed order IDs and specifically identified test email were removed. The deletion was rehearsed in an isolated temporary branch; that branch was deleted. No permanent archive was created. Existing tutor profiles, subjects and weekly availability settings were retained.

Production verification passed: **0 orders, 0 reserved sessions, 0 app email records and $0 recorded revenue**. Tutor delivery remains disabled and public availability remains cleared. Stripe and Resend retain their own provider-side test history; those external histories were not modified. No cleanup/rehearsal database branches remain. The existing application, development and original project branches were not removed.

## Admin scenarios: tested locally

The actual server rules and Astro/Lustre screens were tested against disposable database schemas with email disabled and simulated payment transport:

- Manual booking requires contact name, email, phone, amounts, a subject and an active tutor teaching it. Conflicting bookings roll back completely.
- Invalid subject/tutor/time/clock-change edits preserve the existing session and show an error. Valid tutor changes save. Keeping the current tutor permits a mutually agreed exception outside advertised weekly hours.
- Pending invoices do not count as paid revenue; recording an externally received payment updates the record.
- Cancellation releases reserved times while preserving the order, original session details, amounts and recorded refunds. Repeated cancellation does not erase history. Unsent order emails are blocked when cancelling.
- An externally issued refund can be recorded with an amount/reference. This never moves money or calls Stripe. Cumulative totals prevent double-counting a repeated submission; totals cannot exceed payment or decrease a previously recorded refund. Reports subtract recorded refunds from receipts using the original order-confirmation date, not the refund date.
- Replayed Stripe confirmation cannot restore cancelled sessions or queue new confirmation emails. Cancelled orders are read-only in tutor schedules and remain visible in booking history.

Migration **017** is applied to development and production. It first passed on an isolated copy of production containing all 8 orders; that temporary branch was deleted. Applying it to production retained all 8 orders and their confirmation state. The matching server and admin assets were published in `8e4f7a5`. Hosted verification passed: private sign-in, all eight retained orders, new cancellation/refund controls, required manual-subject control and Operations refresh. All 22 public pages passed the hosted audit; private/public noindex, Google verification and disabled tutor email were retained. No existing order was cancelled or refunded by that verification. No business refund policy was changed; the existing non-refundable policy and exceptional externally handled refunds remain distinct.

## Search indexing and analytics

Brad confirmed Search Console ownership is verified. Keep `public/google85cdbb6f3a1ec50e.html` published. Do not submit the sitemap or request indexing until launch approval.

`node scripts/search-indexing.mjs --enable` previews the coordinated launch change without writing anything. After launch approval, `--enable --write` changes the public HTML directive, Vercel response headers and robots.txt sitemap advertisement together. Admin, APIs, checkout and email previews retain noindex. `--disable --write` restores the site-wide prelaunch protection. Run tests/build and publish all three generated settings together; a local command does not itself deploy anything.

The public setting remains **false**. No crawler-training policy has been changed. Bing/AI crawler choices remain separate launch decisions.

Brad chose Plausible plus Search Console. The supplied Plausible script is installed through the shared public layout and loads only on mychristiantutors.com/www.mychristiantutors.com in production builds. Admin, checkout confirmations, email previews, localhost and alternate Vercel URLs do not load it. The privacy notice includes the analytics use. Google Analytics is not installed. Before paid advertising, agree the required Google Ads conversion tracking with the campaign manager; GA is not required for direct Google Ads conversion tracking.

References: [Plausible Search Console integration](https://plausible.io/docs/google-search-console-integration), [Plausible conversion goals](https://plausible.io/docs/goal-conversions), [Vercel cron limits](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing).
