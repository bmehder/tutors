# MyChristianTutors domain model

This document records the exploratory domain design. The Astro prototype now runs its booking rules in Gleam, with calendar conversion in TypeScript. The earlier TypeScript booking rules and the Elm domain lab are kept here for reference and testing.

## Scope and boundaries

The normal order is individual tutoring, purchased for a customer who has contact details. Most customers are families. Avoid customer-category hierarchies: co-ops, groups, shared sessions, custom packages, and exceptions go to the company for an admin to arrange. Parents may observe sessions without becoming additional students.

Choose a package, student count, student names and hour allocations, then a weekly routine for each subject allocation. A student may have several subjects, each with its own tutor and weekly time. Each subject appears only once per student; different students may choose the same subject. Duplicate subject routines are rejected at the draft boundary. Families choose a named tutor. Recommend contacting the tutor before buying; do not require contact or approval.

For this phase every session is one hour, repeating at the same Eastern day and time each week. Before checkout, families can skip a week and move that session to the next available week at the end. Individual-session editing and variable durations are deferred. Support handles exceptions outside this self-service model. Future support tooling needs its own deliberate model; do not encode exceptions in this one prematurely.

## Draft and confirmed plan

```elm
-- Constructors stay private to the domain module.
type BookingDraft
    = BookingDraft PackageSize (List StudentDraft)

-- Editable input, not a validated student or completed plan.
type alias StudentDraft =
    { id : StudentId
    , name : String
    , hours : Int
    , routines : List WeeklyRoutine
    }

-- Validated at the domain boundary, not an alias with public mutation.
type FamilyPlan
    = FamilyPlan PackageSize (List WeeklyRoutine)

-- Customer/contact and the named student roster accompany this plan
-- in the order. Their final fields are still to be designed.

type PackageSize
    = FiveHours
    | TenHours
    | TwentyHours

-- Private constructor; positive count, created through weekly.
type WeeklyRoutine
    = WeeklyRoutine Session SessionCount

type SessionCount
    = SessionCount Int

-- Duration is implicitly one hour. Do not store a second duration value.
type alias Session =
    { student : StudentId
    , tutor : TutorId
    , subject : SubjectId
    , time : SessionTime
    }

type alias SessionTime =
    { date : CalendarDate
    , start : StartTime
    }
```

A draft may be empty. Names may be blank and routines may be missing. The form can hold uncommitted input for a routine (including no tutor or time selected); a validated WeeklyRoutine is constructed only when its required choices exist. Do not fill missing choices with a fictional tutor or arbitrary time.

`setAllocations` rejects negative/zero allocations, duplicate student IDs, excess student counts, over-budget allocations, and routines assigned to the wrong student. A draft may have fewer planned sessions than allocated hours while it is being built. A confirmed plan cannot.

`changePackage newPackage draft` keeps the draft when the package is unchanged. A different package produces a fresh draft with no allocations or routines. A package cannot be mutated independently of its dependent selections. UI step navigation must use this transition, rather than independent package/roster setters.

`complete context draft` requires at least one student, a nonblank name for every student, and routines consuming exactly each student's allocated hours. It then validates every generated session against the catalog, availability, advance notice, family conflicts, external reservations, package capacity, and student limit. Failure returns an error without replacing the existing value.

The current executable lab calls FamilyPlan `Schedule` and WeeklyRoutine `Plan`. They are opaque. Its Catalog supplies valid student IDs, while BookingDraft carries the draft names. A production order must retain the validated names and customer contact alongside the plan; a Schedule alone is not a complete order record.

ADTs encode alternatives and hide constructors. They do not prove arithmetic, identity references, availability, or temporal relationships. Those are checked once at construction and preserved by domain operations. UI drafts are intentionally incomplete; confirmed values are not.

## Weekly sessions and accounting

Generate sessions from the routine's first session and positive count. Later dates are one calendar week apart at the same Eastern clock time. Derive the weekday from the date; do not store another editable weekday. Do not store an independently editable generated-session list, default/customized flags, or a redundant last date.

| Package | Hours | Maximum distinct students |
| --- | ---: | ---: |
| FiveHours | 5 | 1 |
| TenHours | 10 | 3 |
| TwentyHours | 20 | 5 |

Package hours are shared across individual sessions, including different subjects for one student. Count distinct students, not subject routines. Emma can have three Math sessions and three English sessions; Jack can have four Biology sessions in a ten-hour package.

Unused purchased credit is allowed. Buying ten hours and allocating eight is valid. Allocating ten but scheduling only eight is an incomplete draft. No empty session, zero-student session, or explicit unused-time entry is needed. Remaining credit is derived from the package and generated sessions.

Changing one subject's allocation should redistribute the student's other subject allocations while preserving that student's total. Each chosen subject needs at least one hour. This is an allocation operation, not independent edits to unrelated numbers.

## People, subjects, and catalog

```elm
type StudentId = StudentId Int
type TutorId = TutorId Int
type SubjectId = SubjectId Int

type alias Customer =
    { contact : Contact }

type alias Student =
    { id : StudentId, name : String }

type alias Tutor =
    { id : TutorId
    , contact : Contact
    , subjects : List SubjectId
    , availability : List AvailabilityWindow
    }

type alias Subject =
    { id : SubjectId, name : String }

-- Contact fields are intentionally undecided; reuse for customers and tutors.
type Contact = Contact ContactDetails
```

IDs are stable local domain identities, not login accounts. Two students can share a display name. Renaming a subject must not change its identity. Enforce unique catalog IDs and valid references at construction. Removing referenced catalog entries requires a future explicit archival rule.

Examples: Biology, Chemistry, Algebra 1, Geometry, American Literature, Intermediate Composition, United States History, World History. Do not require a subject-area hierarchy: courses can cross categories. Grade is not a booking restriction and is unnecessary in this model. Optional analytics can be designed separately.

## Dates, availability, and booking notice

CalendarDate must be a validated date, not an arbitrary string. StartTime uses every hour of the day and quarter-hour minutes:

```elm
type QuarterHour = OnTheHour | QuarterPast | HalfPast | QuarterTo

type alias StartTime =
    { hour : Hour, minute : QuarterHour }

-- Hour has 24 alternatives, Midnight through ElevenPM.
-- Everything is Eastern time in this phase.

type AvailabilityWindow
    = AvailabilityWindow SessionTime SessionTime

type alias BookingPolicy =
    { minimumNotice : MinimumNotice }

type MinimumNotice = MinimumNotice Int
```

Windows have a start strictly before their end. The entire one-hour session must fit inside a window. The notice interval is nonnegative and configurable; the business value has not been chosen. The playground's 24 hours is a demonstration setting. Availability alone does not guarantee a slot can still be purchased: booking must occur before its notice deadline. The exact deadline is allowed.

One tutor cannot conduct overlapping sessions. One student cannot attend overlapping sessions, even across subjects or tutors. Different students can meet simultaneously with different tutors. Back-to-back sessions are allowed. Check full intervals, not matching start times only. External reservations participate in tutor-conflict validation.

A calendar adapter must derive weekly Eastern dates across daylight-saving changes. The lab's FixtureTime is only a minute offset from a fixture Monday and cannot establish production timezone correctness.

An admin initially enters tutor availability. Tutor-managed availability, a shared availability calendar, and database-backed reservations belong to later application work. Production availability and bookings will require persistence and atomic conflict checking; the playground's fake availability cannot guarantee those properties.

## Pricing and checkout

The package determines base pricing and the volume discount. Prototype rates are $80/hour for five hours, $75/hour for ten, and $70/hour for twenty; not final pricing. There is no additional student-count discount.

Coupons, fixed/percentage promotions, expiration, the proposed mailing-list offer, payment, and identity checks belong to checkout, not the scheduling model. The current checkout is a mock. No real payment, email, or persisted order is produced.

## Deferred complexity

Keep these outside current self-service ADTs: group/co-op instruction, multiple students in a session, custom packages, individual-session replacements, skipped weeks, variable session lengths, tutor accounts, customer authentication, coupon redemption, and admin exception workflows. Add them only when the relevant workflow is deliberately designed.

## Future family time-zone selection

Allow families to select their viewing time zone before choosing a weekly time. Retain the tutor’s Eastern calendar routine as the source of truth; convert dated occurrences for display, including date and weekday changes. Use named IANA zones rather than fixed UTC offsets. Daylight-saving transitions can change the family’s displayed local time relative to Eastern. Do not promise a fixed local weekly time without deliberately choosing that recurrence policy. The family’s viewing preference belongs to presentation, not a duplicate editable session time. This feature is planned, not implemented; current times remain explicitly Eastern.

## Implemented confirmation boundary

The Elm lab now checks duplicate student/subject routine pairs in shared schedule validation, including direct schedule construction and addPlan. It rejects duplicate catalog identifiers and invalid availability-window bounds. An opaque ConfirmedOrder retains contact, named roster, and Schedule together; a Schedule alone still represents scheduling validation, not checkout.

The earlier TypeScript prototype used [booking-domain.ts](../typescript/booking-domain.ts) for final confirmation. Package and result types are discriminated unions. ConfirmedOrder has a private unique-symbol brand and can only be obtained normally through confirmOrder. Its copied data is frozen, including nested session records and contact, so subsequent form edits cannot alter it. This boundary checks allocation correspondence, unique identities and subjects, positive counts, valid dates, quarter-hour starts, named tutors, fixed one-hour weekly generation, contact fields, and existing schedule validation before success. Lustre keeps editable planner state separate from the validated confirmed order.

TypeScript assertions, `any`, and unvalidated external JSON can bypass compile-time types. Parse incoming data at the boundary; never cast it to ConfirmedOrder. Production atomic reservations and Eastern calendar/DST conversion remain separate requirements, not guarantees of this prototype.

## Reservation and time-zone rules laboratory

[reservation-domain.ts](../typescript/reservation-domain.ts) is a pure reference implementation, not a database service or part of the current checkout. Its immutable Ledger represents a serialized history. Every family request reserves all its dated sessions or none. Intervals are exact epoch-millisecond instants, start-inclusive and end-exclusive: back-to-back reservations are allowed. One-hour elapsed duration remains fixed. Tutor collisions are global; student collisions use customer ID plus student ID, because locally allocated student IDs are not globally unique.

```elm
type ReservationResult
    = Reserved Booking
    | Rejected ReservationError

type ReservationError
    = InvalidRequest
    | BookingTooSoon SessionId
    | NoLongerAvailable SessionId
    | ResourceConflict SessionId Resource
    | RetryDetailsChanged

type Resource = TutorResource TutorId | StudentResource CustomerId StudentId

type TimeResolution
    = Resolved Instant
    | InvalidDate
    | NonexistentLocalTime
    | AmbiguousLocalTime
```

Request keys are scoped to a customer and must be stable across retries. A successful retry returns the original booking even if its advance-notice deadline has since passed. Changing the payload under that key is an error. The current reference compares serialized payloads exactly, including session order; a transport adapter must define canonical serialization or preserve the original request payload. Customer identity here is a server-issued booking scope, not proof of identity or a requirement for user authentication. A production adapter must prevent clients from claiming another customer's scope.

Before reservation, the trusted service must validate the complete order, expand weekly occurrences to instants, and load authoritative tutor/subject availability. The reservation reference checks the full interval fits availability, subjects are supported, booking notice is satisfied using exact elapsed time, and all tutor/student conflicts, including within the request. Availability displayed in the browser is advisory until this transaction succeeds.

Production MUST atomically serialize conflicting requests in shared storage (for example transactional range exclusion constraints and idempotency uniqueness). Two workers must not read the same empty snapshot, independently accept it, and then both write. Tests against the pure ledger demonstrate the required serialized outcome; they do not test an actual concurrent database. Atomic persistence of the order and all sessions, email outbox delivery, cancellation, payment coordination, temporary holds/expiry, and authorization remain future adapter work. Do not announce successful production reservations or email delivery until the respective services have accepted them. No hold state is included before a hold workflow is needed.

[session-time.ts](../../src/session-time.ts) tests dated Eastern wall-time resolution, weekly recurrence, and family viewing zones using platform IANA data. Eastern is the recurrence anchor. Each week is advanced in the calendar before conversion; adding 168 UTC hours is incorrect across DST. A family viewing zone changes labels, dates, and sometimes weekdays; it never changes a booked instant. Nonexistent spring times and ambiguous fall times are rejected rather than silently shifted or assigned an offset. A different first time must be selected; offset selection can be designed later if needed. The resolver now uses @js-temporal/polyfill with explicit rejection of ambiguous/nonexistent times. Calendar dates, weekdays, and weekly arithmetic use Temporal.PlainDate. All dated occurrences are resolved through the named IANA zone; no offset is hard-coded. Time-zone rules come from the host IANA data and must be maintained by production runtimes.

The playground now uses the same Temporal-based conversion and exact interval helpers for availability, conflicts, weekly schedules, display, booking notice, and confirmation. Its sold-out fixture and 24-hour notice remain demo policy. Reservation persistence is still a separate future adapter.

## Time correctness integration

Sessions last 60 elapsed minutes, including when clocks jump. Weekly recurrence retains the Eastern wall-clock start and adds calendar weeks, not 168 elapsed hours. Ambiguous or nonexistent starts are rejected for every occurrence, not merely the first one. Availability end boundaries must resolve uniquely; otherwise they fail closed. Full-session fit and overlaps compare exact, start-inclusive/end-exclusive intervals, including across midnight. Booking notice is exact elapsed time with equality accepted at the cutoff. Runtime time is explicit and refreshed in the UI; tests inject fixed instants. Legacy date-only fixture inputs are interpreted as Eastern midnight with the same notice policy and never trigger a bypass based on whether the date happens to equal today.

Confirmed orders retain exact startInstant/endInstant values along with Eastern date/time intent. Checkout revalidates against a fresh clock after the mock payment delay before displaying success. The production service must use its trusted clock and authoritative availability, and commit reservations atomically; browser validation is not a reservation. Future timezone-rule changes require an explicit reconciliation policy for already booked future instants and recurrence intent.
