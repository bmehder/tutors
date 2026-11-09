# Booking app UX review

Reviewed 8 November 2026. Scope: package selection, student/subject allocation, weekly scheduling, review, mock payment, and confirmation. Marketing-page recommendations are excluded. This is an expert walkthrough, not a usability study with parents or a physical-phone test. Primary viewport: 390 × 844. No app code changed during the review.

## Overall assessment

The family-centered structure is sound. One focused column, explicit subject headings, one forward action, and optional access to the family summary are worth keeping. The main remaining problem is attention: rules, repeated explanations, nested panels, and generated session details compete with the decision being made. Simplify what is presented at each moment without removing the family-level decisions.

## Priority 1 — predictable scheduling and a clear outcome

### Comparing days silently moves the search window

Observed: Tuesday selected November 10; Thursday selected November 12; selecting Tuesday again changed the date to November 17. Its available-time count also changed. This recreates the memory burden the day grid was intended to solve.

Recommendation: separate a stable “Start on or after” date from the selected weekday. Compare all weekday options against that same anchor. Selecting a day must not mutate the anchor. Present the resulting first date as a derived answer. Acceptance: Tuesday → Thursday → Tuesday restores the same Tuesday and availability unless the parent changes the start anchor.

### Local time is only partially implemented in the interaction

Observed: the app detected Europe/London and displayed GMT session times, but asked for an Eastern weekday and Eastern first date. The routine summary used ET while occurrence rows used GMT. This is especially risky when a local date differs from the Eastern date.

Recommendation: present selectable local dates, weekdays, and times consistently, backed by exact Eastern occurrences. Keep the Eastern recurrence rule in secondary explanatory text. Highlight only actual local-time shifts in the proposed schedule before checkout. Do not promise an identical local time across differing DST transitions.

### Successful payment is buried below the schedule

Observed: the demo payment completed, but the viewport returned to the review header and all session cards. “Payment Complete” and the next steps were far below them.

Recommendation: payment success becomes a distinct completion view. Put Payment Complete, the receipt total, and email next steps first; make the purchased plan available beneath them. Retain the demo disclosure. Remove editable planning navigation from the completed-order view or make “start another plan” explicit.

## Priority 2 — reduce the work required to read and choose

### Give subjects enough horizontal space

Observed: the three-column subject/hours/trash row truncated even “Choose a subject” on a 390px screen. Longer selected subjects cannot be scanned reliably. Nested form padding makes this worse.

Recommendation: full-width subject selection on mobile, followed by compact hours and Remove controls. Keep the subject and its hours visually grouped. Avoid another surrounding card per row. In allocation and review, group subjects under one student heading.

### Show routines first and dated occurrences on demand

Observed: review showed two family headings, several repetitions of hour totals, separate Emma cards for each subject, and all ten dated sessions. Checkout then displayed the entire schedule again before contact details. Subject, tutor, and time were repeated for every occurrence.

Recommendation: one family total, one heading per student, and one concise routine per subject: subject, tutor, local weekly time, first/last date, and session count. Provide “View 3 dates” for exact occurrences; automatically surface any DST variation or conflict. Review once, then proceed to contact/payment with a compact expandable order summary. Keep all siblings in the same review.

### Validation should distinguish incomplete input from an error

Observed: empty required fields were rust-outlined immediately; all five payment fields appeared in an error-like state before typing. The subject-allocation footer reported a general problem rather than naming the specific student/field. The time-selection area could request a time while no tutor was selected.

Recommendation: neutral required fields initially, consistent rust treatment for invalid input or attempted progression, and a compact action cue for the next missing choice. Put “Choose a subject for Emma” by that field. Keep the useful remaining-hours message beside Add a subject. Make a blocked Next action reveal/focus the first unmet requirement rather than leaving the parent to search. Green is reserved for completed sections.

### Reduce navigation overhead and clarify progress

Observed: the five boxed steps wrapped to two rows, followed by the sticky family bar and another back link. The allocation task began well below these controls. “Family: 0/10 hours” stayed at zero even after all ten hours were allocated because it measured scheduled hours, not allocation.

Recommendation: on mobile show “Step 3 of 5 · Students & subjects” with Back and an optional step menu. Keep the family summary available. Label status accurately: “10 hours allocated” in allocation, then “1 of 3 subject schedules ready” during scheduling. Show “Emma · Composition — schedule 2 of 3” when advancing through subjects.

## Priority 3 — choice and recovery

### Tutor selection needs enough information to support the decision

Observed: the scheduling dropdown contained tutor names only, followed by an optional contact recommendation that links away to the general contact form.

Recommendation: after choosing a tutor, show a concise relevant profile and a low-emphasis “Ask about this tutor” action carrying the tutor context. A small availability summary in the options would help parents compare. Keep a named tutor required; do not restore “any tutor.”

### The time-zone search promises more than it supports

Observed: searching Boston returned no matches. The control searches IANA identifier strings, not a city directory. Its initial results include arbitrary alphabetically early zones.

Recommendation: detected zone first, friendly zone names and UTC offsets, and a curated worldwide city/region alias index. Searches such as Boston should find Eastern/New York. Keep full worldwide coverage. Avoid requiring the parent to know the canonical IANA city.

### Protect work when going back

Code inspection: changing student count rebuilds the roster; changing package clears dependent selections. Those transitions maintain valid data but can surprise a parent who has entered names and subjects.

Recommendation: preserve compatible names and subject intentions where possible. If a change will discard scheduled selections, explain its effect before applying it and offer a way back. Preserve domain invariants through an explicit transition, not by allowing inconsistent combinations.

## Suggested implementation order

1. Stable availability-search anchor and consistent local date/time choices.
2. Dedicated payment-success state.
3. Full-width subject controls and compact routine-based review/checkout.
4. Contextual validation and concise mobile progress.
5. Tutor context, time-zone aliases, and recovery behavior.

Retest the same scenario after each group: ten hours, Emma six (three Biology and three Composition), Jack four Biology; compare weekdays; change a subject; review all students; complete the mock payment. Also test a family in a zone whose calendar date differs from Eastern and a routine crossing a DST transition.
