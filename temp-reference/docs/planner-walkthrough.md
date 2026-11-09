# Booking planner working notes

Use this as a reading guide while we settle the vocabulary. Start with the booking story and the model. The later sections explain `update` and where to look when a rule takes you out of Gleam.

## What the family is booking

A parent chooses a package for the family, divides its hours among students and subjects, then picks a tutor and weekly time for each subject. They review the dates before entering contact details and making a demo payment. After completion, they can view and print the plan.

For example, a family chooses **10 hours**. Emma gets **6 hours**, split into **3 Biology** and **3 Composition**. Jack gets **4 hours of Biology**. That creates **two students, three subject allocations, and three weekly schedules**. Those schedules together contain ten one-hour sessions. Emma and Jack can both choose Biology. Each has a separate schedule and can have a different tutor.

| Word | Meaning in this app |
| --- | --- |
| Package | The hours the family can use and the number of students they can include. |
| Student allocation | The hours assigned to one student. |
| Subject allocation (`SubjectAllocation`) | The portion of one student’s hours assigned to one subject. Emma’s Biology allocation is three hours. |
| Weekly routine (`WeeklyRoutine`) | The selected tutor and dates for one subject allocation. |
| Session | One dated, one-hour appointment in a schedule. |
| Order | The validated package, contact details, named students, and dated sessions used at checkout. `PayForOrder` holds an order being checked out. `OrderComplete` records that the demo payment finished. |

## How the types fit together

Read [model.gleam](../../planner/src/planner/model.gleam) alongside this section.

- `Model` is the state of one running planner. It contains the current step, the family’s draft, and the controls and feedback the page needs.
- `Student` has a name, `allocated_hours`, and a list of `subject_allocations`. A `SubjectAllocation` has its own ID, subject, and hours. The same allocation ID identifies its saved `WeeklyRoutine`, so changing a student’s name doesn’t require creating a new schedule.
- `BuildWeeklyRoutine(student, allocation, input)` holds the subject currently being scheduled. `RoutineDraft` contains the tutor if selected, the date being viewed, and any chosen session dates. Its `anchor` keeps the comparison week steady when the parent looks at different days. `TimeChoice` is a selectable weekly option with its candidate sessions and any availability issue.
- `WeeklyRoutine` is the saved result for that allocation. `first_planned_session` is the original recurrence anchor, and `sessions` are the actual dates. If the parent skips the first week, those two can differ. Both are needed to reconstruct the skips when checking out.
- `Session` and `Order` are declared in Gleam and represented by values from the browser adapter. The planner passes them to helpers to get labels, check dates, or validate the order. Their fields are defined in the TypeScript booking code.

### Reading `Model`

| Fields | What to look for |
| --- | --- |
| `step` | Where the family is in the flow. `BuildWeeklyRoutine` carries the active work. `PayForOrder` carries the order and whether payment is awaiting input or processing. `OrderComplete` carries the finished order. |
| `package_hours`, `student_count` | Selected package hours and student count. The count is a choice before the roster is created. |
| `students`, `weekly_routines` | The allocations and the saved weekly schedules. A student can have allocated hours while some schedules are still missing. |
| `time_zone`, `time_zone_query`, `preferred_tutor_id` | The viewing time zone, the time-zone search if open, and an optional tutor from a tutor card. The browser tracks whether the family plan disclosure is open. |
| `error`, `notice` | Optional feedback such as an unbalanced allocation or a successful skip. |
| `contact` | Optional contact details, kept after validation so the parent can return from payment to a prefilled form. |

The aliases `StudentId`, `AllocationId`, `TutorId`, `Date`, and `TimeZone` tell you what a string means at a call site. The variants in `BookingStep` and `PaymentState` describe different states the compiler can distinguish.

## How to read `update`

Open [christian_tutors_planner.gleam](../../planner/src/christian_tutors_planner.gleam) and read `init`, then `update`. Treat the message names as a list of things that can happen. `update` matches the message. A branch checks the current step when the event depends on where the family is. `update` also protects completed orders, where the only accepted action is printing.

Trace three messages before reading the rest of the file.

1. **`UserClickedNext`** calls `advance`. From the student-count step, `prepare_allocation` creates or reuses the roster. From allocation, `begin_scheduling` checks the hours, keeps saved schedules that still match their students and subjects, and opens the next unfinished subject.
2. **`UserClickedSaveSchedule`** checks the selected dates against the rest of the family’s schedules, saves the result for that allocation, and opens the next subject or review. **`UserClickedSkipWeekInDraft`** moves one appointment to the next available matching week after the end. The other appointments and the hour total stay in place.
3. **`UserSubmittedContact`** builds and validates the order for payment. **`UserSubmittedPayment`** validates the demo fields and starts a short timer. **`DemoPaymentFinished`** rechecks the booking before moving to `OrderComplete`.

Each handler returns a model and an effect. `stay` returns the supplied model with no effect. `move` changes the step, clears transient feedback, and requests a scroll. `failure` records an error. Other effects include the mock payment timer and printing.

## The business rules to keep in mind

- The **5-, 10-, and 20-hour** packages support up to **1, 3, and 5 students**, respectively. The family can leave package hours unused. The subject hours for each student must add up to that student’s allocation, and every allocated subject needs a saved schedule before checkout.
- A student can have multiple distinct subjects. Tutor choices are filtered by subject. Sessions for the same student or tutor cannot overlap, while siblings can meet different tutors at the same time.
- A schedule repeats at the same Eastern weekday and time. The family chooses and sees dates in their viewing zone. Local times can shift when clock changes differ between zones. The booking rules check each dated session, including the demo’s 24-hour notice requirement.
- Skipping a week preserves the tutor, recurring time, and number of sessions. If a suitable replacement cannot be found, the schedule stays as it was. A completed plan is read-only.

## Where to look when a handler calls a helper

| File | Responsibility |
| --- | --- |
| [allocation.gleam](../../planner/src/planner/allocation.gleam) | Native Gleam rules for creating a roster, validating allocations, and redistributing subject hours. |
| [browser.gleam](../../planner/src/planner/browser.gleam) | Typed declarations for calls that cross into JavaScript. Start here to see a helper’s inputs and result. |
| [scheduling.gleam](../../planner/src/planner/scheduling.gleam) | Tutor availability, booking notice, conflicts, weekly recurrence, replacement weeks, and plan validation. |
| [checkout.gleam](../../planner/src/planner/checkout.gleam) | Package prices, order confirmation and revalidation, and demo payment checks. |
| [planner_ffi.mjs](../../planner/src/planner_ffi.mjs) | Supplies the catalog, clock, calendar conversion, formatting, and browser effects to the Gleam planner. |
| [session-time.ts](../../src/session-time.ts) | Eastern time and viewing-zone conversion, including clock changes. The original TypeScript booking rules are kept as test references. |
| [view.gleam](../../planner/src/planner/view.gleam) | Projects the model into the page and connects controls to messages. Useful when tracing where a message comes from. |

As we organize the code, use this reading order as the guide. The model should introduce the vocabulary, `update` should show the events and transitions, and named helpers should explain the individual rules. Keep a rule near the type or transition it describes until there’s a clear reason to move it.
