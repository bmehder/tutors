# Christian Tutors

Static Astro site styled with Tailwind CSS. The booking flow runs as a Gleam/Lustre island.

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

The production website is generated in `dist/` and can be hosted on any static web host.

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
