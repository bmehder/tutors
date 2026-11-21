# MyChristianTutors

Astro and Tailwind website with separate Gleam/Lustre islands for the family booking planner and private administration. Astro server routes handle authentication, reservations, Stripe Checkout and Resend email delivery. Neon PostgreSQL stores tutor information, availability, orders and queued emails.

## Run locally

Use Node 22 and Gleam 1.18.1.

```sh
npm install
npm run dev
```

The development server uses http://127.0.0.1:5200. After changing Gleam, run `npm run build:planner` to refresh its compiled JavaScript while Astro is running.

Private settings belong in the ignored `.env.local`; see `.env.example` for the variable names. Local administration uses `BOOKING_DEV_ADMIN_EMAIL` and `BOOKING_DEV_ADMIN_PASSWORD`. The local and hosted apps use separate Neon branches; do not substitute one database connection for the other. Keep credentials out of Git.

## Build and verify

```sh
npm run build
npm test
npm run test:parity
```

The build compiles Gleam, checks TypeScript and produces Vercel output. On Linux x64 or ARM64 without Gleam installed, it downloads and verifies the pinned compiler release.

Additional checks:

| Command | What it checks |
|---|---|
| `npm run test:checkout` | Checkout retries, competing reservations, expiry and payment confirmation. |
| `npm run test:admin` | Manual bookings, tutor changes, payment/refund records and retained cancellation history. |
| `npm run test:email` | Contact routing, order receipts and duplicate/retry protection. |
| `npm run test:operations` | Email queue status and worker monitoring. |
| `npm run test:limits` | Shared request limits. |
| `npm run test:browser` | Astro/Lustre customer and admin journeys at desktop and phone sizes. Temporarily uses port 5200 and restores the normal dev server afterward. |
| `npm run test:site` | Read-only public-page audit against the running local site. Accepts a site URL as an argument. |

Database integration tests use disposable schemas and simulated payment/email providers. Browser tests regenerate their screenshots and build files under `node_modules/.cache/`; those are not source files or backups.

## Application code

| Location | Responsibility |
|---|---|
| `src/pages/`, `src/layouts/`, `src/components/` | Astro routes, shared page layouts and website components. |
| `planner/src/christian_tutors_planner.gleam` | Family planner initialization and update. |
| `planner/src/planner/` | Planner model, allocation, scheduling, checkout, view and browser boundary. |
| `planner/src/christian_tutors_admin.gleam` | Admin initialization and update. |
| `planner/src/admin/` | Admin model, screens, reports and Operations view. |
| `planner/src/*ffi.mjs`, `src/lib/session-time.ts` | Browser/network adapters and calendar/time-zone conversion. |
| `src/server/`, `src/actions/`, `src/pages/api/` | Authoritative server validation, database writes, payments, contact forms and email delivery. |
| `db/` | Ordered database migrations. Keep earlier migrations: they are needed to build a database from scratch. |
| `tests/` | Unit, integration, browser and Gleam parity tests. |

Families share 5-, 10- or 20-hour packages across the supported number of students, assign subjects and select weekly one-hour sessions. Before checkout they can skip a week and add a replacement at the end. The server temporarily reserves dated tutor times and confirms the order after Stripe verifies payment. Bookings persist in the database; they do not disappear when the page refreshes.

The private `/admin` app manages tutors, subjects, schedules, bookings and reports. Cancelling a booking releases its times while retaining order history. Recording a refund documents a refund already issued elsewhere; it does not move money.

## Deployment and current launch controls

Pushing `astro-lustre` deploys the site to Vercel. Apply required database migrations before publishing code that depends on them. The public domain is https://www.mychristiantutors.com.

The site currently uses Stripe sandbox payments. Public availability and search indexing remain disabled; tutor email remains paused. Customer/admin email delivery is connected to Resend. The private Operations screen monitors app-side email retries; Resend provides final delivery details. GitHub retries are accepted for the low-volume soft launch, with scheduling to be reviewed before paid promotion.

Plausible runs on public pages of the main domain, excluding admin, checkout confirmations, email previews, localhost and alternate Vercel URLs. Google Analytics is not installed. Keep the Google Search Console verification file in `public/`.

Use the [launch checklist](temp-reference/launch-readiness.md) for launch approval and outstanding work, and the [operations notes](temp-reference/operations.md) for delivery and recovery procedures. The indexing-preparation script previews changes by default; do not enable indexing merely to verify Search Console ownership.

## Reference material

`temp-reference/` holds planning documents and historical experiments. It is not application runtime code.

- `temp-reference/typescript/` contains earlier booking rules **still used by unit and parity tests**. Keep these until those comparisons are deliberately replaced.
- `temp-reference/domain-lab/` is an older, standalone Elm experiment. The website and normal test suite do not depend on it.
- `temp-reference/docs/` contains early architecture and vocabulary notes; treat the current source and launch/operations documents as authoritative.
