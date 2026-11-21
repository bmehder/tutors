# Request protection and test discounts

Prepared November 21, 2026. Migration 014 and the production activation setting are in place for this release; the application deploys from the `astro-lustre` branch.

## Server-controlled test discounts

`SANDBOX_DISCOUNTS_ENABLED=1` explicitly enables the 20% test discount for Stripe sandbox checkout. The default is off. The payment screen reads the same server setting, and the reservation endpoint rejects a requested test discount when it is unavailable. Live and mock payment modes never honor this test flag. The real promotion policy can be designed separately; no coupon system has been introduced.

## Shared request limits

| Endpoint | Limit per network address | Window |
|---|---:|---:|
| Admin sign-in | 10 attempts | 15 minutes |
| Contact forms, including tutor inquiries | 20 submissions | 10 minutes |
| New reservation attempts | 10 attempts | 15 minutes |

The existing per-email contact limit also remains: 5 messages per hour. Limits use atomic PostgreSQL upserts, so concurrent Vercel instances share the count. Admin and reservation responses include a `Retry-After` header when blocked; forms display a wait message. Contact actions return a corresponding rate-limit error.

Identity comes from Astro's adapter-provided client address, not a caller-supplied forwarding header. Addresses are HMAC-hashed with a private signing key before storage. `REQUEST_LIMIT_SIGNING_KEY` is optional; the existing `BOOKING_ADMIN_SIGNING_KEY` is used as a fallback. Old counter windows are removed on subsequent requests after 24 hours. No raw IP addresses or contact messages are stored in this table.

These are fixed-window limits, not comprehensive bot protection. Shared networks share a bucket, and distributed callers can use different addresses. Keep reviewing actual traffic and reservation-hold behavior. They do not replace idempotent checkout, conflict constraints, or the final end-to-end tests.

## Deployment order

1. Apply `db/014-request-limits.sql` to the intended database using a direct connection. It adds only the request-counter table and its expiry index; it does not modify bookings or tutor availability.
2. Deploy the code. `REQUEST_LIMITS_ENABLED` defaults off so a deployment before the migration does not break existing login, forms, or checkout.
3. Ensure a private signing key is configured, set `REQUEST_LIMITS_ENABLED=1`, and redeploy that environment.
4. Keep `SANDBOX_DISCOUNTS_ENABLED=0` unless deliberately testing a discount. Never use it as a real customer promotion.
5. Recheck valid sign-in, normal contact requests, checkout errors, and rate-limit responses.

Migration 014 was tested in isolated schemas and applied to the development database. On November 21, it was also validated against a disposable copy of the hosted schema and applied to production without changing existing booking or tutor records. `REQUEST_LIMITS_ENABLED=1` is configured for the production release; the signing key uses the existing private admin signing key. The temporary protected maintenance deployment was removed after applying the migration.

## Checks

- `npm run test:limits`: concurrent counters, separate identities/scopes, expiry, private hashes, trusted address selection, and safe behavior before activation. Uses an isolated schema and removes it afterward.
- `npm run test:email`: request-limited contact actions and existing email behavior, with all email transport simulated.
- `npm test` and `npm run test:parity`: discount rules and existing booking/admin behavior.
- `npm run test:site`: read-only checks against the running local site for sitemap URLs, metadata, headings, structured data, canonicals, internal links, anchors, key assets, prices in the initial HTML, noindex and missing-page responses. Mobile visual review remains a separate step.
