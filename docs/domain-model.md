# Christian Tutors — Domain Model

Phase 1: domain modeling in Elm for an eventual Lustre app. Phase 0 was exploratory. We are not building the app in this phase.

Keep the smallest model that expresses the real business rules. Add distinctions only when they change behavior, derive information instead of storing competing copies, and keep unresolved decisions explicit.

## Scope

The online planner handles individual tutoring: exactly one student and one tutor per lesson. A customer can use a shared package for several students, each in their own lessons. Any group or other non-individual instruction requires contacting the company and is arranged outside this model.

Customer is category-neutral: a family, co-op, individual student, or another arranging entity can have contact details. That does not change the one-student rule for online-booked lessons. A parent sitting in on a lesson is not an additional tutored student and needs no attendance record.

Availability will be persisted in a database. An admin enters it initially; a separate future tutor-facing app may maintain it. Storage, editor workflows, and database details do not belong in these domain types. Customer accounts are not assumed.

## Scope boundary: normal or admin-assisted

Use two camps to decide what the booking model needs to express. This is a scope classification, not a requirement to add Normal/Admin constructors to every domain type.

**Normal:** customers can select, review, and complete the arrangement using supported options and the established rules.

**Admin-assisted:** the customer contacts the company, which works out the exceptional arrangement separately. Do not add self-service variants, overrides, approval states, or pricing rules merely to represent something the admin can arrange outside this model. A validated self-service schedule must not become invalid just to accommodate an exception.

| Concern | Normal / self-service | Admin-assisted or outside the booking model |
| --- | --- | --- |
| Customer | Any arranging entity with contact details; no parent or customer-category requirement | No special legal/customer taxonomy needed merely to describe unusual customers |
| Participation | One identified student and one tutor per lesson; a parent may sit in | Group instruction, co-op sessions, or other non-individual tutoring: contact the company — agreed rule |
| Package | 5, 10, or 20 hours; existing student limits; sharing across individual lessons where permitted | Requests exceeding package student limits or custom packages: proposed contact-company boundary, not an agreed exception policy |
| Credit use | Count actual tutor minutes; purchased time may remain unused | Expiry, refunds, credit transfers, and special adjustments are unresolved; keep out of this model until policy is needed |
| Plans | One-off lessons or default weekly routines | Unusual instructional arrangements requiring bespoke terms; exact boundary remains open |
| Changes | Customize an individual session using available alternatives; keep the default unchanged | An unavailable requested slot is not an admin override. Customers can choose alternatives; asking the company for a special arrangement does not make that slot bookable |
| Subjects | Choose a catalog subject that the tutor teaches; no grade gate | A subject or service not offered in the catalog may require contact; proposed scope boundary |
| Time | Eastern time, quarter-hour starts, supported durations, dated available windows | Device-local conversion is deferred product functionality, not an admin task. Other durations or schedules require a policy decision rather than automatic support |
| Validation | Enforce identities, tutor capability, availability, non-overlap, package limits, and valid credit usage | Admin assistance does not remove the need to prevent conflicting tutor reservations in whatever system records the final arrangement |
| Pricing | Package-based base pricing | Coupons/promotions belong to checkout/payment, not scheduling; bespoke quotes belong outside this model |
| Availability maintenance | Booking customers choose from supplied availability | Admin enters availability initially; a separate future tutor app may maintain it. This is administration rather than a booking variant |

The two camps classify customer arrangements and product responsibilities. Internal implementation obligations such as valid dates, stable identifiers, database integrity, and correct time arithmetic still have to be handled; they are not exceptional customer options to delegate to an admin.

### Stop-modeling test

Before introducing another domain distinction, ask:

1. Does a customer need this to complete a normal supported booking?
2. Does it change an agreed business rule, or is it only a different label for the same behavior?
3. Could the company handle this as an exceptional arrangement without weakening the normal booking guarantees?

Keep what normal bookings require. Route agreed exceptional arrangements to company contact. Leave unresolved policies explicit rather than inventing rules or an admin workflow. The clock-time representation remains a simplification candidate; this classification does not change it yet.

## Current Elm model

Constructor privacy and validation mentioned below are design requirements, not implemented guarantees. Empty records are unfinished placeholders, not usable validated domain values. This document is illustrative, not a compiled Elm module.

```elm
type alias Schedule =
    { customer : Customer
    , students : List Student
    , packageSize : PackageSize
    , plans : List TutoringPlan
    }


type PackageSize
    = FiveHours
    | TenHours
    | TwentyHours


packageHours : PackageSize -> Hours
packageHours packageSize =
    case packageSize of
        FiveHours ->
            Hours 5

        TenHours ->
            Hours 10

        TwentyHours ->
            Hours 20


studentLimit : PackageSize -> Int
studentLimit packageSize =
    case packageSize of
        FiveHours ->
            1

        TenHours ->
            3

        TwentyHours ->
            5


-- Intended to be opaque, with validated construction.
-- The wrapper alone does not prevent negative values.
type Hours
    = Hours Int


type TutoringPlan
    = OneLesson Lesson
    | WeeklyLessons WeeklyRoutine


type alias WeeklyRoutine =
    { defaultFirstLesson : Lesson
    , sessions : Sessions
    }


type Session
    = DefaultSession
    | CustomizedSession Lesson


-- Opaque, nonempty, and kept in original weekly occurrence order.
type Sessions
    = Sessions Session (List Session)


-- Opaque; a positive count used when creating the session collection.
-- The routine's count is then derived, not stored separately.
type SessionCount
    = SessionCount Int


type alias Lesson =
    { student : StudentId
    , tutor : TutorId
    , subject : SubjectId
    , time : LessonTime
    , duration : Duration
    }


-- Local domain identity, not an account or database key.
-- Constructor and ID allocation belong behind the domain boundary.
type StudentId
    = StudentId Int


type Duration
    = ThirtyMinutes
    | FortyFiveMinutes
    | OneHour
    | NinetyMinutes


durationMinutes : Duration -> Int
durationMinutes duration =
    case duration of
        ThirtyMinutes ->
            30

        FortyFiveMinutes ->
            45

        OneHour ->
            60

        NinetyMinutes ->
            90


type QuarterHour
    = MinuteZero
    | MinuteFifteen
    | MinuteThirty
    | MinuteFortyFive


type alias StartTime =
    { hour : Hour
    , quarter : QuarterHour
    }


-- Opaque; validated as a real calendar date, including leap years.
-- Constructor arguments are year, month, and day.
type CalendarDate
    = CalendarDate Int Int Int


-- Date and clock time are interpreted in Eastern time throughout.
type alias LessonTime =
    { date : CalendarDate
    , start : StartTime
    }


type alias Customer =
    { contact : Contact
    }


type alias Student =
    { id : StudentId
    , name : String
    }


type TutorId
    = TutorId Int


type alias Tutor =
    { id : TutorId
    , name : String
    , contact : Contact
    , subjects : List SubjectId
    , availability : Availability
    }


type alias BookingPolicy =
    { minimumNotice : MinimumNotice
    }


-- Opaque; a validated nonnegative number of minutes.
-- Separate from Duration: notice may be many hours or days.
type MinimumNotice
    = MinimumNotice Int


type alias Availability =
    List AvailabilityWindow


-- Opaque; constructed only when the end is after the start.
type AvailabilityWindow
    = AvailabilityWindow
        { startsAt : LessonTime
        , endsAt : LessonTime
        }


type WindowError
    = EndNotAfterStart


-- Placeholder: contact fields have not been decided yet.
type alias Contact =
    {}


-- Stable catalog identity; independent of the display name.
type SubjectId
    = SubjectId Int


type alias Subject =
    { id : SubjectId
    , name : String
    }


type Hour
    = Midnight
    | OneAM
    | TwoAM
    | ThreeAM
    | FourAM
    | FiveAM
    | SixAM
    | SevenAM
    | EightAM
    | NineAM
    | TenAM
    | ElevenAM
    | Noon
    | OnePM
    | TwoPM
    | ThreePM
    | FourPM
    | FivePM
    | SixPM
    | SevenPM
    | EightPM
    | NinePM
    | TenPM
    | ElevenPM


type Day
    = Monday
    | Tuesday
    | Wednesday
    | Thursday
    | Friday
    | Saturday
    | Sunday
```

## Identity and ownership

StudentId, TutorId, and SubjectId are stable identities, not names or display-list positions. Correcting a name must not change existing references. Int is an illustrative representation; ID allocation is still undecided. Persisted catalog IDs must survive reloads and edits.

- Schedule owns its Student records. A Lesson refers to exactly one StudentId from that roster.
- Tutor and Subject records belong to supplied catalogs. Lessons refer to their IDs rather than copying their details.
- Tutor.subjects lists the subjects that tutor teaches.
- Renaming a subject changes its display name, not its SubjectId.

Validated roster/catalog construction must prevent duplicate IDs. Schedule operations must preserve valid references and reject unknown students, tutors, or subjects. Removing referenced records needs a deliberate rule; we have not chosen deletion or archival behavior. Already-validated domain operations should not repeat defensive checks everywhere.

Names are labels, not identities. Two students may have the same name without being the same student. No additional name-uniqueness rule has been adopted.

## Subjects, not grades or categories

Homeschool students can work at different levels in different subjects. The customer chooses the specific subject or class-level topic. Student has no grade field, and grade does not restrict tutor matching. Possible future analytics does not justify collecting grade now.

SubjectArea was removed. Subjects need not fit one exclusive category. These example names come from the [MyFunScience course catalog](https://myfunscience.com/courses/), not an exhaustive tutoring catalog:

- Biology
- Chemistry
- Algebra 1
- Geometry
- American Literature
- Intermediate Composition
- United States History
- World History

A tutor must teach the selected SubjectId. We do not infer capabilities from a broad category.

## Packages, sharing, and credit

| Package | Maximum distinct students using it |
| --- | --- |
| FiveHours | 1 |
| TenHours | 3 |
| TwentyHours | 5 |

These are package-wide limits, not per-lesson limits. Every lesson still has exactly one student. Count distinct StudentIds across the actual lessons; repeated lessons for the same student count once. Merely listing a student in the roster does not consume credit or a package place.

Purchased minutes are packageHours multiplied by 60. Used minutes are the sum of actual lesson durations. Remaining minutes are the difference. Do not store separate editable purchased, allocated, used, or remaining totals.

A customer can buy ten hours and schedule eight, leaving two unused. Unused credit does not require a date, student, or empty lesson and does not prevent finishing a plan. A schedule gap is simply the absence of a lesson. ScheduleEntry, UnusedTime, and HourBalance have been removed.

A 45-minute lesson consumes 45 minutes. Two simultaneous one-hour lessons with different students and different tutors consume two tutor-hours. A parent sitting in consumes no additional credit. Group arrangements are outside this online model; do not apply a speculative group-accounting policy here.

## Package pricing and the checkout boundary

PackageSize determines the selected package and its base price. Larger packages have lower effective hourly rates; this is package pricing, not a promotional Discount applied to a schedule. There is no extra multi-student discount. Phase 0 used illustrative rates of $80/hour for five hours, $75/hour for ten, and $70/hour for twenty; these are not final prices.

Promotional discounts, coupons, and the proposed 20% first-package offer belong to a later checkout/payment model. They do not alter tutoring plans, purchased minutes, availability, or package student limits. The schedule can supply its chosen PackageSize to checkout without knowing how a promotion is applied.

Discount, Percentage, and the unused Money placeholder have been removed from this scheduling model. Money representation and final quoting/payment operations can be designed at the pricing/checkout boundary when needed. No payment-process types are introduced here.

## Time and duration

All times are Eastern by application-wide convention. No per-customer or per-lesson time-zone selection is needed. Device-local conversion is a possible future display feature.

Hour covers all 24 clock hours. QuarterHour restricts starts to :00, :15, :30, or :45. LessonTime combines a validated CalendarDate and StartTime. Duration independently supports 30, 45, 60, and 90 minutes. Whether every tutor offers every duration remains open.

CalendarDate must reject impossible dates such as February 30. End times and weekdays are derived rather than stored. Duration measures elapsed tutor time; midnight advances the date. Eastern includes its regional clock changes rather than a permanently fixed EST offset. Implementation of clock-change edge cases and interval calculations remains open; the record alone does not resolve ambiguous or nonexistent local times.

## Tutor availability and conflicts

Availability is a list of dated windows; an empty list means no availability is supplied. Each AvailabilityWindow has an Eastern start and end. Its private constructor must require the end to follow the start. Dated endpoints support crossing midnight without a special 24:00 value.

A lesson must fit entirely inside a window. A lesson may start at the window’s beginning and finish exactly at its end, but cannot extend past it. For example, a 90-minute lesson starting at 3:00 PM does not fit a 1:00–4:00 PM window.

Availability is not a reservation. The actual lesson must also avoid existing reservations for its TutorId and StudentId. Partial overlaps count; back-to-back lessons do not overlap. Different students can meet different tutors simultaneously. Overlapping availability windows do not create extra tutor capacity.

Initially the admin supplies dated windows. Recurring availability rules, exclusions, subject-specific windows, and adjacent-window normalization are not modeled yet. Who enters a window does not change its business meaning. Availability and competing bookings will need an authoritative recheck when a reservation is made; that mechanism is deferred.

## Minimum booking notice

A tutor being available does not mean a customer may book that time until the last moment. BookingPolicy includes a MinimumNotice, expressed as a validated nonnegative number of minutes. It is separate from lesson Duration because notice may be many hours or days.

The notice period has not been chosen. Whether one application-wide policy is sufficient or tutors need individual policies also remains open; do not add an override hierarchy yet. BookingPolicy is a supplied business rule, not another editable property copied into every lesson.

For each proposed lesson, derive its booking deadline as lesson start minus minimum notice. A new reservation must be made no later than that deadline. For example, with a hypothetical 24-hour notice period, a Tuesday 7:00 PM lesson must be booked by Monday 7:00 PM. At Tuesday 6:59 PM it is unavailable for new booking even if nobody has reserved it.

Apply this to each candidate lesson start, not by expiring an entire availability window at once. A window may still contain later bookable starts after earlier ones become too soon. Do not store an expired Boolean or duplicate deadline that can become stale as time passes.

Offer generation uses the current time, tutor availability, existing reservations, and this policy. Recheck the notice deadline authoritatively when creating a reservation, since a customer might leave a page open until after the cutoff. The deadline applies to new bookings and rescheduled starts; it must not invalidate an already accepted lesson merely because its date is approaching. Cancellation notice, if needed, is a separate policy and is not modeled now.

Eastern-time arithmetic and the exact comparison boundary belong in the eventual validated booking operation. The current type expresses the rule’s input; it does not enforce a moving time-based condition by itself. This is a normal booking constraint, not an admin-only exception or a new kind of AvailabilityWindow.

## Default weekly routines and customizations

TutoringPlan is either OneLesson or WeeklyLessons. Schedule stores plans, not a second independently editable list of generated lessons. Actual lessons are derived from those plans and used for package accounting and validation across the whole schedule.

WeeklyRoutine has a defaultFirstLesson template and nonempty Sessions. Each position identifies an original weekly occurrence: first date, then one calendar week later, and so on, at the same Eastern clock time. Do not store a separate weekday that could disagree with the date.

- DefaultSession derives its lesson from the template and position.
- CustomizedSession replaces that occurrence with a specific Lesson.
- A replacement is not an extra lesson or extra session.
- Moving one occurrence does not shift later occurrences or redefine the default.
- Customizing the first occurrence leaves defaultFirstLesson unchanged.
- Changing a session back to its exact default should normalize to DefaultSession.

Sessions stays in original occurrence order even when a customized date moves. A chronological display must not reorder that canonical collection. Six 45-minute sessions consume 270 minutes, not six hours. If a customization changes duration, recalculate usage and validate the package bound.

SessionCount is a positive validated creation input. Once Sessions exists, its count is derived; there is no second editable count. A routine cannot be empty, but Schedule.plans may be empty while planning. Insert/delete/renumber operations, independent session identity, and full validated editing APIs remain to be designed if needed.

## Decisions still open

- Contact fields. Money, promotions, and payment details belong to the later pricing/checkout boundary.
- ID allocation, safe reference updates, and deletion or archival of referenced records.
- Concrete validation APIs and domain error types.
- Eastern-time calendar/interval calculations and clock-change handling.
- Availability recurrence, exceptions, and any subject/duration-specific restrictions.
- The minimum-notice period, whether it varies by tutor, and authoritative deadline/concurrency checks when reserving or rescheduling.
- Expiry, refunds, and later scheduling of unused credit.

## Simplifications to preserve

- Customer replaces parent/household/co-op categories; contact details are what matter here.
- Individual online lessons use one StudentId. Participants, participant-list wrappers, group sizes, and group-specific booking rules are unnecessary here.
- Group requests go to the company; do not invent group lesson variants, approvals, or request workflows before that separate process is designed.
- Subjects are catalog records, not exclusive categories or grade restrictions.
- Package pricing stays tied to PackageSize; promotional discounts and coupon machinery stay outside this scheduling model.
- No empty schedule entries and no duplicated credit totals.
- Tutoring plans are the source of truth; concrete lessons are derived.
- Keep persistence and application screens separate from domain meaning.

## Validation sequence before the Lustre app

1. Exercise this model with concrete scenarios and a small domain-only executable test where useful. No interface, database schema, or production app is needed for this step.
2. If the concepts hold up, translate them into the existing playground as a lightweight interaction prototype. Judge whether the family planning flow makes sense; do not turn this into production hardening or a second final implementation.
3. Use the domain decisions and prototype findings as the basis for the later Lustre app. Keep the domain independent of either interface.

No playground changes are authorized by this modeling step alone. A paper walkthrough is not an executable test result, and neither proves production reservation safety.

### Initial scenario set

| Scenario | Expected domain behavior | What it exercises |
| --- | --- | --- |
| Ten-hour package: Emma has six one-hour sessions; Jack has four | Ten tutor-hours used; two distinct students; package limits satisfied, assuming all individual lessons are valid | Plan expansion, duration accounting, distinct-student counting |
| Move Emma’s third session to an available Tuesday | Replace that occurrence only; default Monday routine and the other sessions remain unchanged; still ten total hours | Customization and occurrence identity |
| Move Emma’s first session | The default template still describes her original weekly routine | No accidental redefinition of the default |
| Change that session back to its default | Normalize to DefaultSession; no customization highlight remains | Canonical representation |
| Buy ten hours, select only eight valid one-hour lessons | Valid plan with two hours unused; no empty entries or extra students required | Unused credit is permitted |
| Six 45-minute sessions | 270 minutes used; no per-lesson rounding to whole hours | Fractional package usage |
| A fully used ten-hour package gains a 30-minute extension through customization | Reject that edit unless other selections first release sufficient credit; preserve the original schedule on failure | Package capacity across all plans |
| Add a fourth distinct student to a ten-hour package | Reject; additional sessions for an existing student do not consume a new student place | Package participation limits |
| Different students meet different tutors simultaneously | Allowed if each lesson otherwise fits availability | Legitimate parallel family schedules |
| Same tutor, or same student, appears in partially overlapping lessons | Reject; back-to-back lessons are allowed | Interval-based conflicts |
| A 90-minute lesson starts at 3 PM in a window ending at 4 PM | Do not offer or accept it | Full-duration availability containment |
| A previously offered start passes its booking deadline before submission | Reject the new reservation and offer current alternatives; do not invalidate existing accepted lessons | Current-time-dependent minimum notice |
| A tutor or subject is renamed | Existing ID references continue to identify the same record | Stable identity versus display labels |
| A customer requests multiple students in one lesson | Contact the company; do not force the request into an individual online lesson | Admin-assisted scope boundary |

These are expected outcomes, not claims of implemented or passing tests. Exact dates, tutor windows, and the chosen minimum-notice policy should become explicit inputs when making a scenario executable. Reuse the existing conflict and availability ideas only after verifying they match this model; the playground’s earlier rules are not authoritative where later domain decisions differ.

### First executable domain pass — November 8, 2026

The isolated `domain-lab/` now contains a compiled Elm domain slice and scenario runner. Run `node domain-lab/run.mjs` from the repository root. The playground, database, and booking UI were not changed by this step.

**Result: 29/29 executable scenarios passed.** These cover Emma/Jack package accounting, changing first and later occurrences without shifting defaults, normalization back to a default, fractional usage, unused credit, package student limits, legitimate parallel lessons, partial overlaps, back-to-back lessons, availability containment, external reservations, subject eligibility, invalid occurrence indexes, immutable failure, and minimum-notice boundaries.

The run also distinguishes notice for new/rescheduled reservations from unchanged accepted lessons. Adding a later plan does not automatically expire a previously accepted lesson just because its start is approaching. The test notice is 24 hours, solely as fixture input.

There is enough evidence to carry these concepts into a lightweight playground prototype, without treating this as production validation. The default/customization representation did not need a new type or duplicated totals to support these cases.

**Not proved by these tests:** real calendar validation, Eastern daylight-saving arithmetic, database concurrency, authoritative reservation acceptance, production catalog construction, discovery/ranking of alternatives, payment, or admin workflows. The lab uses an explicitly named FixtureTime on a local minute timeline, with lesson dates before a clock change. It does not pretend that this is the final date/time model.

Tutor and subject renaming remain a paper-level check: references use stable IDs and display labels are outside this executable slice. Group requests remain outside the online lesson type; the contact-company route has not been implemented. These are not counted as executable scenario passes.

See `domain-lab/README.md` for the exact test boundary and `domain-lab/tests/Scenarios.elm` for the assertions. The next stage, when proceeding to the playground, should preserve this domain boundary and use the normal-versus-admin scope test rather than adding production machinery.

### Playground translation — November 8, 2026

The existing React/Vite playground now translates the settled concepts for interaction testing. This is a TypeScript prototype, not the final Lustre app or a runtime embedding of the compiled Elm lab.

Implemented in the playground: specific subjects without grade eligibility; individual lessons; 30/45/60/90-minute durations; quarter-hour example starts; one-off or weekly plans; default/customized session alternatives; derived minute usage; package student limits; unused credit allowed at mock checkout; visible family overview; available alternatives for individual edits; group requests linked to company contact. Scheduling shows package pricing without applying the promotional offer.

Browser example checked: ten 45-minute Biology sessions use 450 of 600 purchased minutes, leaving 150 minutes unused, with checkout enabled. The Elm lab still passes 29 scenarios; the playground's updated suite passes 26 checks. The production build succeeds.

Prototype limits remain explicit: tutors, subject names, availability and prices are illustrative; starts/windows are mock data rather than an admin-entered catalog; no database or actual reservation/payment is connected. The prototype uses its own availability helpers and plan representation to try the flow; not every final Elm identity/calendar boundary has been implemented in TypeScript. Subject labels still serve as mock catalog values, so renaming/persisted-catalog integrity is not proved here. A displayed 24-hour booking notice is a test setting, not a settled policy. Its wall-clock calculation does not establish production daylight-saving correctness. Refresh clears the test state. No account flow or persistence is added.

### Playground experiment: allocation before scheduling

The latest prototype flow is package → student count → names and hour allocation together → each student's default schedule → family review. Package student limits constrain the count. Allocations cannot exceed purchased hours; unused credit remains permitted. After saving one student's schedule, the prototype opens the next allocated student's schedule and keeps the family overview visible.

For this interaction experiment only, lessons are fixed to 60 minutes. Allocating Emma six hours therefore creates six weekly sessions; Jack's four hours create four sessions. Duration choices remain in the broader domain model and Elm tests; they are not revoked as a business decision. The prototype no longer exposes duration changes, including in single-lesson customization.

An allocation is setup input for generating plans, not a second authoritative measure of consumed credit. Saved plan usage is still derived from actual lessons. Checkout cannot silently omit an allocated student whose schedule has not been chosen. The browser walkthrough verified the 10-hour / two-student / Emma six + Jack four allocation and automatic transition from Emma's saved schedule to Jack's four-session routine.

### Playground experiment: subject allocation and page editors

Student allocations can now be split into named subject shares before scheduling. The concrete walkthrough uses a ten-hour package: Emma has six hours split between three Algebra 1 sessions and three Intermediate Composition sessions; Jack has four Biology sessions. Each subject share generates a separate routine, while all Emma routines reference the same student identity. Cross-subject student conflicts are checked, and package limits count students rather than the number of routines.

The lesson editor and mock checkout are ordinary page sections rather than modal dialogs. Available-option lists, family lesson lists, and draft lesson lists no longer use inner scroll boxes. Generated routine dates are visible rather than hidden in a closed accordion. Page scrolling remains necessary for long lists; nothing is clipped to a modal viewport.

This changes the prototype's planning interaction, not the core lesson/session ADTs or the current one-hour prototype constraint. Each student's subject shares must total their assigned hours, and all shares must stay within package capacity. Allocating unused credit remains permitted. The relevant pure allocation and same-student cross-subject checks are in the playground tests; no actual booking or persistence is connected.
