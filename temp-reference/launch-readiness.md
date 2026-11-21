# Prelaunch checklist

Updated November 21, 2026. Work from top to bottom. Stripe is the last integration; only the live-payment check and opening the site follow it.

Keep search indexing blocked, Stripe in sandbox mode, and tutor emails disabled during preparation. Keep the newsletter hidden for now. Keep public availability cleared until the final launch steps.

## 1. Content and SEO — Brad + Codex

Implementation is complete for this prelaunch pass. The remaining content tasks are the genuine testimonials and Shawn’s policy review.

- [x] Prepare titles, descriptions, structured data, and the initial public sitemap. Initial implementation committed as `33026f5`; included in the prelaunch release.
- [x] Prepare Algebra, Biology, and Writing & English pages, linked from a subject directory and navigation. Reviewed by Brad; included in the prelaunch release.
- [x] Brad reviews the new subject-page copy and tutor information.
- [ ] Replace the 2 temporary testimonials with genuine customer statements; retain the existing real testimonial.
- [x] Check the approved package prices ($60/$55/$50 per hour), student limits, and 72-hour booking notice across current copy and implementation. Corrected an outdated sample email total to $300 for 5 hours.
- [x] Prepare booking/cancellation/refund and privacy pages using Brad’s approved starting rules: non-refundable packages except where required by law, mutually agreed rescheduling recorded by admin, missed sessions counted unless a replacement is agreed, and a replacement when the tutor cancels. Link them from the footer, relevant forms, checkout, confirmation, FAQ and customer email. Pages are included in the prelaunch release; Shawn’s review remains listed below.
- [ ] Shawn reviews the [booking, cancellation and refund policy](../src/pages/booking-policy.astro) and [privacy policy](../src/pages/privacy.astro), and provides any adjustments before launch.
- [x] Hide the newsletter signup for now, retaining its component for later restoration.
- [x] Automate technical SEO checks across all 22 public pages: canonicals, structured data, headings, sitemap, links/anchors, missing-page responses, key assets, initial package information and noindex. Desktop and emulated-phone review is recorded in step 4.
- [x] Review and prepare the tested content and SEO release for commit/push and automatic deployment, retaining noindex.
- [x] Confirm deployed release `ceda5ca`: all 22 public pages passed hosted checks; policies, noindex, hidden newsletter, private admin login and cleared availability were verified.

## 2. Booking and admin readiness — Codex + Anna

Implementation is complete for this prelaunch pass. Anna’s operational checks and the final availability decision remain open.

- [x] Enforce package student limits and required/consistent student names on the server as well as in the planner. Included in the prelaunch release.
- [x] Gate test discounts using an explicit server setting, disabled by default. Live checkout cannot honor the test flag; the real promotion policy remains separate. Implementation and tests complete; included in the prelaunch release.
- [x] Add shared database-backed limits for admin sign-in, contact submissions and reservation attempts. Concurrent requests and private identity hashes are tested; valid local sign-in still works.
- [x] Apply migration 014 and configure request limits for the production release. See [request protection](request-protection.md) for deployment order and limits.
- [x] Test checkout retries, competing families, active-hold limits, lost Stripe responses and safe expiry locally with simulated payments and emails. Temporary failures preserve the accepted checkout for retry. See [checkout reliability](checkout-reliability.md).
- [x] Validate and apply migration 015 to production before the code push; preserve booking/tutor data and include the expired-checkout webhook event. Temporary protected maintenance deployment removed afterward.
- [ ] Anna confirms each tutor's subjects, private email address, and meeting instructions.
- [ ] Anna prepares and reviews real availability; publish it only at the final launch gate.
- [ ] Review sandbox/seed orders so test records do not affect real availability or reports. Agree on cleanup or separation before changing existing records; no blanket deletion.
- [ ] Confirm the admin workflow for rescheduling, tutor changes, pending invoices, cancellations, and payment/refund records.

## 3. Email and operations — Codex + Brad/Anna

- [x] Verify the Resend DNS records and perform a controlled email test to admin.
- [x] Enable and test production customer/admin delivery and the authenticated retry job.
- [x] Add clearly labeled, optional sandbox receipts. Old drafts stay blocked; sandbox tutor notifications never send.
- [ ] Decide and approve the launch tutor-notification workflow. Tutor email remains disabled until Brad explicitly approves enabling it.
- [x] Confirm owners: Anna monitors admin@mychristiantutors.com and has Resend access; Brad and Shawn together monitor failed email retries, Stripe issues and Vercel errors.
- [x] Verify the actual hosted database branch and 6-hour history window; complete a point-in-time recovery drill in a temporary branch without resetting production. Correct the ignored local CLI context to the actual development branch. See [operations](operations.md).
- [x] Document private admin-access recovery; current production sign-in was verified without rotating working credentials.
- [x] Brad accepted the six-hour restore window and confirmed platform-account recovery access is covered for Brad/Shawn (November 21, 2026). Longer retention/independent backups are not a launch requirement.
- [x] Prepare a private, read-only Operations screen and worker heartbeat, with explicit unsent/retry/held/manual-review states and links to Resend. Development tests complete; deployment follows below.
- [ ] Deploy migration 016 and Operations/worker changes; update the workflow on default branch main and verify a recorded hosted heartbeat.
- [ ] Resolve the email scheduler’s multi-hour gaps before launch; GitHub cron is best-effort, not a guaranteed five-minute service.
- [x] Verify production source gates the time-travel inspector/debug links to development; retain local diagnostics.
- [ ] At live-payment cutover, remove/restrict test card instructions and sandbox email previews; retain private Operations monitoring.
- [x] Recheck the live domain, HTTPS and alternate URL on November 21: HTTP/apex redirect permanently to www over HTTPS; the Vercel URL serves the same site, canonicals point to www and noindex remains active. Recheck at launch.

## 4. Finish testing and discovery setup before Stripe

- [x] Exercise the complete customer journey in a production-build browser walkthrough using isolated data and simulated payment/email transport: desktop and phone allocation, subjects, time zones, skips, conflicts, retry/decline, confirmation, printing, admin records and email previews. See [browser walkthrough](browser-walkthrough.md).
- [ ] Repeat a controlled deployed Stripe sandbox order, real webhook delivery and approved customer/admin receipt delivery. The isolated browser test does not exercise Stripe’s hosted interface or production infrastructure.
- [x] Verify abandoned/expired hold release and duplicate checkout/message protection in isolated integration tests. Repeat the deployed customer journey as part of the complete sandbox flow above.
- [x] Check the primary journey at a touch-enabled phone viewport (390 × 844) and admin at desktop size (1440 × 1000); inspect screenshots and check for horizontal overflow. Physical phone/Safari testing remains a useful final check.
- [ ] Fix failures, run the relevant tests/build, and deploy the tested version.
- [ ] Brad creates the Google Search Console **Domain** property for `mychristiantutors.com`. If DNS verification needs Shawn, send him Google's supplied record with the Stripe setup request. No indexing change is needed for ownership verification.
- [ ] Prepare the launch indexing change and sitemap submission. Keep admin, checkout, previews, and private endpoints excluded. See [the SEO plan](seo-plan.md).
- [ ] Make the Bing/AI-search crawler decisions. No special AI markup or invented reviews are required.

## 5. Stripe — last integration, involving Shawn

Do not block the preceding work on the account setup. Prepare one handoff for Shawn once the rest is ready.

- [ ] Shawn completes the business's live Stripe account setup and confirms it is ready for payments.
- [ ] Codex implements and tests the live checkout path. Current code intentionally accepts test keys and test sessions only; replacing a key alone will not enable real checkout.
- [ ] Configure the live key and signed live webhook privately in Vercel. Keep secrets out of Git and chat.
- [ ] Separate sandbox and live payment behavior, including discount rules, payment verification, receipts, and replay/idempotency checks.
- [ ] Brad/Shawn complete an agreed live-payment/refund check. Verify the webhook, correct amount, order details, admin record, and receipts before opening bookings.

## Final launch gate — after the live-payment check

- [ ] Brad gives the go-ahead to open bookings and search indexing.
- [ ] Publish the approved tutor availability and approved notification settings.
- [ ] Apply the newsletter decision and confirm the real testimonials/policies are in place.
- [ ] Remove both public-page noindex controls together; retain private-page restrictions.
- [ ] Submit `https://www.mychristiantutors.com/sitemap.xml` in Search Console, add its URL to robots.txt, and request indexing of the key pages.
- [ ] Verify the deployed version and monitor the first real orders, emails, and search reports.

## Current verification

The local production build, 70 unit tests and 26 Gleam parity/integration checks passed. Checkout, request-limit and email integration checks passed in isolated schemas with simulated providers; no payments or emails were sent by these tests. Migrations 014 and 015 are applied to development and production; existing reservations and tutor records were retained. Request-limit activation is configured for the production release. The sandbox webhook includes checkout expiry. Code publication is through the automatic `astro-lustre` deployment; verify the hosted release after pushing. The read-only site audit checks all 22 public URLs, including the booking and privacy policies. Email delivery and its retry job were tested on production through commit `7f11b97`. The production-build browser walkthrough passed on desktop and an emulated phone, including screenshot review, print output, email previews and admin rescheduling feedback. It also fixed the skipped-first-week review date. Real deployed Stripe/receipt delivery, physical-phone testing and the final live-payment check remain separate checkpoints.
