# Booking backend proposal

Keep the Astro site and Lustre planner. Add same-origin Astro API routes on Vercel and use managed PostgreSQL for reservations. Start with Neon and mock payment, then integrate Stripe Checkout. The marketing page can stay static while the API routes run on demand. [Astro on-demand rendering](https://v6.docs.astro.build/en/guides/on-demand-rendering/)

Keep booking rules in Gleam and compile them to JavaScript for the server to call. Use thin TypeScript handlers for HTTP, PostgreSQL, and Stripe. Families can check out as guests.

## Tutor catalog and published hours

Use an Astro content collection with one Markdown file per tutor. Give each tutor a stable ID and store their name and subjects in frontmatter. Put the public bio in the Markdown body. PostgreSQL stores holds and confirmed sessions keyed by tutor ID.

Start with regular weekly hours in frontmatter and dated exceptions for time off or extra hours. For example, a tutor can offer Tuesdays from 3 to 6 p.m. Eastern, block a specific Tuesday, or add a Saturday. The API can generate a rolling three-month window of possible start dates from those rules, so admins only need to edit the files when a tutor's hours change.

Treat the window for starting a routine and the period the tutor can commit to as separate limits. A 20-session weekly routine can extend beyond three months. Only offer a start date if every session, including any replacement for a skipped week, fits within the tutor's published commitment.

If tutors typically provide specific dates that vary week to week, use a separate JSON schedule per tutor keyed by the same stable ID. In that setup, an admin extends the dated schedules as tutors provide new hours, potentially on a weekly cadence.

## Availability and reservations

1. While a family builds a plan, show each tutor’s recurring availability minus confirmed sessions and active holds. Refresh options when a family opens or changes a schedule. A booking takes specific dates off the calendar while preserving the tutor’s weekly availability.
2. When the family clicks **Continue to payment**, rebuild and validate the schedule and price on the server. Include every weekly session and any skipped weeks and replacements. Hold the entire plan in one database transaction. PostgreSQL enforces that active reservations for the same tutor cannot overlap, even when their start times differ. If another family takes a slot first, return the conflicting sessions and keep the rest of the plan so the family can choose another routine. [PostgreSQL range constraints](https://www.postgresql.org/docs/18/rangetypes.html)
3. Confirm the booking after a verified Stripe webhook reports successful payment. Release the hold when checkout expires unpaid. Tie release to Stripe’s checkout lifecycle so a delayed webhook cannot put a paid slot back on sale. Handle repeated webhook deliveries safely. [Stripe Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment)

## Frontend connection

The Lustre planner calls same-origin JSON endpoints through HTTP effects. Responses become messages handled in `update`. The browser can give immediate feedback, and the server and database make the final reservation decision.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/availability` | Return current options for the selected tutor and dates. |
| `POST /api/checkout` | Validate and hold the family plan. Return a checkout URL or the conflicting sessions. |
| `GET /api/booking-status` | Let the confirmation screen check whether the order is confirmed. |
| `POST /api/stripe/webhook` | Receive verified Stripe events and confirm or release reservations. |

## First milestone

Keep mock payment and test reservations with two independent browser sessions. Have both families choose the same tutor time and verify that only one can proceed to payment. Let that family’s hold expire, then verify that the other family can reserve the time.
