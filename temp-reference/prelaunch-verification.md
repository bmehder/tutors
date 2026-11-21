# Remaining technical checks — November 21, 2026

## Scheduling decision

Brad chose to leave the email scheduler replacement for later. The existing GitHub retry job and private Operations health checks remain active. Vercel is on Hobby; its native scheduled jobs cannot provide a five-minute interval. Do not upgrade the plan or create an Upstash account without a further decision. The scheduler remains a prelaunch item, not a completed reliability guarantee.

## Deployed Stripe sandbox check: passed

- Published release: `a5bad17` (Google verification file), with the existing hosted checkout backend.
- Test order: `680a007f-f13b-4fe0-a3a0-31f35e2259c5`; label **Prelaunch Checkout Check**. This is a test payment, not real revenue.
- Real Stripe sandbox checkout completed with a test card for **$300 USD**, five sessions. Stripe event: `evt_1UeHpe2ccqfNWXKkKkSUjzbJ`.
- The browser's customer-return URL was blocked until the database showed confirmation. This verifies that the real signed webhook confirmed the order independently of the return-page fallback.
- The private production admin lists the paid order, correct total and five sessions.
- Hosted confirmation lists the sessions and price; customer/admin email previews, print button and PDF output worked.
- Resend accepted two messages, both deliberately addressed to `admin@mychristiantutors.com` for the customer/admin check. The sending-only key cannot inspect final mailbox-delivery status; Anna can inspect those receipts in Resend. No tutor email was sent. The third tutor message remains blocked.
- Existing orders were not deleted or edited. The new test order is retained for inspection and must be included in the approved prelaunch cleanup.

Public availability stayed cleared throughout. To test hosted payment without opening public bookings, a private accepted test hold was prepared directly in the database for five dates in May/June 2030. The actual production reservation retry route created its Stripe checkout. This did **not** exercise initial public availability selection against production; the separate production-build browser walkthrough exercises that full planner journey with isolated availability and simulated providers.

## Existing-order audit and cleanup proposal

Before this check, production held **7 confirmed test-era orders**, **60 sessions**, including **41 future sessions**, and **$4,025 in recorded order totals**:

| Category | Orders | Recorded totals | Confidence |
|---|---:|---:|---|
| Labels suggesting seeded/manual tests | 5 | $3,305 | Candidate test records; labels alone are not proof. |
| Other manual order | 1 | $320 | Needs Brad's classification before cleanup. |
| Stripe sandbox order | 1 | $400 | Definitely sandbox; preserve its historical price rather than rewriting it. |

The new controlled test adds 1 sandbox order, 5 future sessions and $300. All 8 orders currently appear in the admin's order/revenue totals; those are not established live-sales figures. Test reservations will continue to block matching tutor times when real availability is published unless they are released.

Proposed cleanup, **not performed**:

1. Brad identifies the unclassified manual order and confirms exactly which seeded/manual orders are disposable tests.
2. Preserve a reference copy of approved test records, for example in a dedicated Neon branch, before removing them from the live booking database. Keep private contact data out of Git.
3. Remove only explicitly approved test-order IDs and their session blocks. Do not blanket-delete orders, rewrite historical prices, or release unresolved Stripe holds.
4. Recheck counts, tutor availability, retained customer/payment records and reports before enabling live bookings. Stripe's sandbox history and Resend history remain separate from database cleanup.

## Admin scenarios: tested locally

The actual server rules and Astro/Lustre screens were tested against disposable database schemas with email disabled and simulated payment transport:

- Manual booking requires contact name, email, phone, amounts, a subject and an active tutor teaching it. Conflicting bookings roll back completely.
- Invalid subject/tutor/time/clock-change edits preserve the existing session and show an error. Valid tutor changes save. Keeping the current tutor permits a mutually agreed exception outside advertised weekly hours.
- Pending invoices do not count as paid revenue; recording an externally received payment updates the record.
- Cancellation releases reserved times while preserving the order, original session details, amounts and recorded refunds. Repeated cancellation does not erase history. Unsent order emails are blocked when cancelling.
- An externally issued refund can be recorded with an amount/reference. This never moves money or calls Stripe. Cumulative totals prevent double-counting a repeated submission; totals cannot exceed payment or decrease a previously recorded refund. Reports subtract recorded refunds from receipts using the original order-confirmation date, not the refund date.
- Replayed Stripe confirmation cannot restore cancelled sessions or queue new confirmation emails. Cancelled orders are read-only in tutor schedules and remain visible in booking history.

Migration **017** is applied to development and production. It first passed on an isolated copy of production containing all 8 orders; that temporary branch was deleted. Applying it to production retained all 8 orders and their confirmation state. The matching server and admin assets are being published; verify the hosted release before treating deployment as complete. No business refund policy was changed; the existing non-refundable policy and exceptional externally handled refunds remain distinct.

## Search indexing and analytics

Brad confirmed Search Console ownership is verified. Keep `public/google85cdbb6f3a1ec50e.html` published. Do not submit the sitemap or request indexing until launch approval.

`node scripts/search-indexing.mjs --enable` previews the coordinated launch change without writing anything. After launch approval, `--enable --write` changes the public HTML directive, Vercel response headers and robots.txt sitemap advertisement together. Admin, APIs, checkout and email previews retain noindex. `--disable --write` restores the site-wide prelaunch protection. Run tests/build and publish all three generated settings together; a local command does not itself deploy anything.

The public setting remains **false**. No crawler-training policy has been changed. Bing/AI crawler choices remain separate launch decisions.

Recommendation: use Brad's Plausible account plus Search Console; Google Analytics is not needed for the current measurement needs. Plausible supports conversion goals and a Search Console integration. No Google Analytics or Plausible tracking script was added during this work; this repository currently has no Plausible installation, and its site-specific snippet is still needed to configure it.

References: [Plausible Search Console integration](https://plausible.io/docs/google-search-console-integration), [Plausible conversion goals](https://plausible.io/docs/goal-conversions), [Vercel cron limits](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing).
