# Christian Tutors

Standalone React + Vite proof of concept styled with Tailwind CSS.

## Run locally

```sh
npm install
npm run dev
```

Open http://localhost:5173 in your browser. No ChatGPT hosting or login is needed.

## Build

```sh
npm run build
npm run preview
```

The production website is generated in `dist/` and can be hosted on any static web host.

Tutor profiles, prices, and availability are illustrative. All demo state is temporary and resets on page refresh. No payments are collected or emails sent.
# tutors

## Family planner demo

Choose a package, add one student and assign their hours, then select their subject, tutor, weekday, and time. The assigned number of weekly lessons is generated automatically. Complete the family plan or add another student from the remaining balance.

Package limits: 5 hours = one student, 10 hours = up to three students, 20 hours = up to five students. All students use hours from the same package. Dates can be adjusted individually; unavailable weeks can be skipped without losing assigned hours. Full and partial overlaps involving the same student or tutor are blocked. Siblings may meet different tutors simultaneously.

All data stays in memory and resets on refresh. Checkout, availability, and pricing are illustrative. Nothing is sent or saved. Scheduling unused purchased hours after checkout is outside the prototype.

Run scheduling and package-rule checks with `npm test`.
