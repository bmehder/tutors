# Order email delivery

The checkout now stores the family email and phone on the Stripe reservation using the existing booking contact fields. The customer and admin email templates and the Resend adapter are in `src/server/order-email.ts`. Neither payment confirmation path calls Resend yet.

When enabling delivery, verify the sender domain in Resend and configure the API key, sender, monitored reply-to, and admin address as server secrets. Use the paid Stripe webhook to confirm the order and enqueue one customer message and one admin message in the same database transaction. Use a unique database key per order and recipient role so a Stripe retry or concurrent confirmation cannot enqueue duplicates. The return page can read confirmed orders independently of delivery. Mock orders and holds should never enqueue mail.

Have a background job send pending messages, record each Resend message ID, and retry transient failures independently. Keep a durable delivery record because Resend's idempotency keys expire after 24 hours. Test with an isolated database and Resend test recipients before enabling real delivery.
