# Production-build browser walkthrough

Completed locally November 21, 2026. No production data was changed, no real payment was made, and no email delivery was attempted.

Run `npm run test:browser` with the development database and migrations 014/015 available in `.env.local`. The test uses installed Google Chrome on macOS. Set `CHROME_EXECUTABLE` for another compatible installation; on other platforms install Playwright Chromium if no path is supplied.

The test temporarily replaces the dev server on port 5200, builds the actual Astro/Vercel server and Lustre assets, and uses a disposable database schema. It creates its checkout route and Stripe substitution only in a generated test configuration. At the end it drops the schema, rebuilds the normal application, and restores the normal dev server on the same port. Screenshots and a sample printed order PDF remain under `node_modules/.cache/browser-walkthrough/`, outside Git.

## Verified scenarios

- Desktop, 1440 × 1000: choose a 5-hour package, allocate Biology to one student, select Heather, skip the first week, and add its replacement at the end.
- Required contact details and real-time domestic phone formatting; an explicit international phone number is preserved in the mobile scenario.
- A temporary checkout failure preserves the retry button and request ID. A simulated declined payment leaves checkout retryable, and subsequent payment confirms the original order.
- The actual confirmation page shows all 5 sessions and the $300 package total. Customer/admin email previews and queued drafts contain meeting instructions. Refreshing the page does not duplicate messages.
- Print button invokes printing, print-only visibility rules apply, and the browser exports a sample A4 PDF. Contact support points back to the contact section.
- Phone, 390 × 844 with touch input: mobile menu opens and closes, 10 hours are split between two students and three subject allocations, and all subjects can be removed and added again.
- Changing the selected time zone to Amsterdam updates selection, review and confirmation. A time reserved by the desktop family is unavailable to the phone family, including conflicts in later weeks of the repeating routine.
- The phone order records 10 sessions, the $550 total and the chosen time zone. Neither the planner nor confirmation spills horizontally at the tested phone width.
- Private admin sign-in works against the production build. Both orders appear with their family contacts, order numbers, dates, paid totals and session counts.
- The admin tutor selector excludes tutors without the subject. Selecting an eligible tutor at midnight produces a visible error beside the form, preserves the order and leaves its original session unchanged. Selecting a valid time saves the tutor change.
- Reports load; desktop admin and tested customer screens have no horizontal overflow. No browser JavaScript errors occurred.

## Fix made during testing

After skipping the first week, the review summary still displayed the original planned date. It now derives its displayed first session from the remaining booked-session list. The browser test checks this regression before checkout.

## Limits of this check

Payment transport and hosted checkout are simulated. The fixture's signed event exercises the application's webhook route and order-confirmation path; it does not verify Stripe's real hosted interface, live API or production webhook signing configuration. Email sending is disabled and the test asserts that delivery was never attempted.

This is an emulated phone viewport in Chrome, not a physical iPhone/Safari check. The Vercel server build runs locally, so deployment infrastructure and DNS still need the separately listed deployed sandbox/launch checks. Noindex, disabled tutor email and cleared public availability remain unchanged.
