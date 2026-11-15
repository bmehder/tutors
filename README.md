# MyChristianTutors

Astro site styled with Tailwind CSS. The family booking flow and admin dashboard run as separate Gleam/Lustre islands. Server routes handle authentication and database operations.

## Run locally

Use Node 22.12 or later and Gleam 1.18.1.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:4321 in your browser. After editing Gleam, run `npm run build:planner` to refresh the compiled island while Astro is running.

## Build

```sh
npm run build
npm run preview
```

The build uses the Vercel adapter: public pages are static, while authenticated administration and reservation routes run on the server.

## Family planner demo

Choose a package, allocate hours by student and subject, then pick a tutor and a recurring weekly time for each subject. Families can skip a week before checkout and move that session to the next available week at the end. Tutor and student overlaps are blocked.

The 5-hour package covers one student, the 10-hour package covers up to three, and the 20-hour package covers up to five. Teacher names and subjects come from MyFunScience. Prices and availability are illustrative, and all demo state resets on refresh. No payments are collected or emails sent.

Run the TypeScript tests with `npm test` and the Gleam parity tests with `npm run test:parity`.

## Project structure

- `src/pages/` contains Astro routes. `src/layouts/SiteLayout.astro` holds the document shell and `src/components/` holds the page components.
- `planner/src/christian_tutors_planner.gleam` owns the Lustre application and state transitions. `planner/src/planner/` contains the model, views, and browser bindings.
- `planner/src/planner/scheduling.gleam` and `checkout.gleam` own scheduling, order validation, and pricing.
- `planner/src/planner_ffi.mjs` connects browser APIs, demo data, and calendar and time-zone conversion.
- `npm run build` compiles the island before Astro generates `dist/`. On Linux x64 or ARM64 without Gleam on PATH, the build downloads and verifies the pinned compiler release.

## Reference material

[The reference folder](temp-reference/) contains the design notes, the Elm domain lab, and the earlier TypeScript booking rules. The TypeScript rules still run in the test suite and serve as a parity reference for Gleam.

Run the Elm scenarios with `node temp-reference/domain-lab/run.mjs`.

## Admin application

`/admin` uses the existing server-side sign-in and database. Navigation, schedule drafts, removal/undo, and report calculations now live in Lustre; switching screens and saving do not refresh the page.

Start reading here:

- `planner/src/admin/model.gleam`: loaded records, screen states, and messages.
- `planner/src/christian_tutors_admin.gleam`: application initialization and update.
- `planner/src/admin/view.gleam`: Tailwind UI and derived display values.
- `planner/src/admin/reports.gleam`: inclusive date filters and payment totals. Unknown payments are distinct from zero.
- `planner/src/admin/browser.gleam` and `planner/src/admin_ffi.mjs`: HTTP, JSON conversion, and browser confirmations/animation.
- `src/pages/admin.astro`: authenticated HTML shell and JSON/form endpoint; `src/server/admin-bookings.ts` retains authoritative booking checks and writes.

The local admin still uses the existing `BOOKING_DEV_ADMIN_EMAIL` and `BOOKING_DEV_ADMIN_PASSWORD`. Public demo mode remains explicitly enabled by its existing environment settings. The migration adds no credentials or database schema changes.

Admin model tests run with `npm run test:parity`, alongside the family planner parity tests.
