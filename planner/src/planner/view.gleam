import gleam/dynamic/decode
import gleam/int
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/result
import gleam/string
import lustre/attribute as a
import lustre/element.{type Element}
import lustre/element/html as h
import lustre/element/keyed
import lustre/event as e
import planner/allocation.{
  allocation_issue, remaining_subject_hours, student_limit, subject_hour_limit,
  total_allocated_hours,
}
import planner/browser.{
  all_tutors, booking_calendar, choices, format_money, instant_label,
  matching_zones, now, session_label, subjects, tomorrow, week_dates,
}
import planner/checkout.{
  discount_amount, hourly_rate, order_total, package_total,
}
import planner/model.{
  type Discount, type Hours, type Model, type Msg, type Order, type PaymentState,
  type RoutineDraft, type Session, type Student, type SubjectAllocation,
  type TimeZone, type Tutor, type WeeklyRoutine, AllocateHours, Available,
  BuildWeeklyRoutine, ChoosePackage, ChooseStudentCount, ContactInfo,
  DemoPaymentDetails, EnterContactInfo, NotProcessing, OrderComplete,
  PayForOrder, Processing, ReviewFamilyPlan, Unavailable, UserChangedFirstDate,
  UserChangedStudentCount, UserChangedStudentHours, UserChangedSubjectHours,
  UserClickedAddSubject, UserClickedChangeTimeZone, UserClickedEditSchedule,
  UserClickedNext, UserClickedPrint, UserClickedRemoveSubject,
  UserClickedSaveSchedule, UserClickedSkipWeekInDraft,
  UserClickedSkipWeekInReview, UserClickedStep, UserComparedDate,
  UserEnteredStudentName, UserSearchedTimeZones, UserSelectedPackage,
  UserSelectedSubject, UserSelectedTimeZone, UserSelectedTutor,
  UserSelectedWeeklyTime, UserSubmittedContact, UserSubmittedPayment,
  UserToggledDemoDiscount,
}
import planner/scheduling

// Derived display data

type DayCard {
  DayCard(
    date: model.Date,
    label: String,
    availability_label: String,
    selected: Bool,
  )
}

type TimeCard {
  TimeCard(
    label: String,
    sessions: List(Session),
    selected: Bool,
    unavailable_reason: Option(String),
  )
}

type RoutinePreview {
  NoTimeSelected
  PreviewSessions(rows: List(SessionRow), issue: Option(model.ErrorMessage))
}

type SessionRow {
  SessionRow(label: String, skip: Option(Msg))
}

type StudentScheduleGroup {
  StudentScheduleGroup(student_name: String, subjects: List(SubjectSchedule))
}

type SubjectSchedule {
  ScheduleNotChosen(subject: model.Subject)
  ScheduledSubject(
    subject: model.Subject,
    session_summary: String,
    routine_label: Option(String),
    rows: List(SessionRow),
    edit: Option(Msg),
  )
}

type ScheduleDisplay {
  ScreenSchedule
  PrintSchedule
}

// Planner and booking steps

pub fn render(model: Model) -> Element(Msg) {
  let progress = case model.step {
    ChoosePackage -> "Step 1 of 5 · Package"
    ChooseStudentCount -> "Step 2 of 5 · Students"
    AllocateHours -> "Step 3 of 5 · Allocation"
    BuildWeeklyRoutine(_, _, _) -> "Step 4 of 5 · Weekly schedules"
    ReviewFamilyPlan -> "Step 5 of 5 · Review plan"
    EnterContactInfo -> "Checkout · Contact details"
    PayForOrder(_, _) -> "Checkout · Demo payment"
    OrderComplete(_) -> "Order complete"
  }
  let error = case model.error {
    None -> element.none()
    Some(issue) ->
      h.p([a.class("planner-action"), a.attribute("role", "alert")], [
        h.text(issue),
      ])
  }
  let notice = case model.notice {
    None -> element.none()
    Some(model.WeekSkipped(original, replacement)) -> {
      let message =
        "Skipped "
        <> session_label(original, model.time_zone)
        <> ". Replacement added at the end: "
        <> session_label(replacement, model.time_zone)
        <> ". Your total hours are unchanged."
      h.p(
        [
          a.class("rounded-lg bg-[#edf3ed] p-4 text-sm text-[#35573d]"),
          a.attribute("role", "status"),
        ],
        [h.text(message)],
      )
    }
  }
  h.div([a.class("space-y-4")], [
    case model.step {
      OrderComplete(_) -> element.none()
      _ -> booking_progress(model, progress)
    },
    h.div(
      [
        a.id("family-planning-form"),
        a.class("bg-white border border-ink/15 rounded-xl p-5 sm:p-8 space-y-5"),
      ],
      [error, notice, step_view(model)],
    ),
  ])
}

fn booking_progress(model: Model, progress: String) -> Element(Msg) {
  let active = case model.step {
    ChoosePackage -> 1
    ChooseStudentCount -> 2
    AllocateHours -> 3
    BuildWeeklyRoutine(_, _, _) -> 4
    ReviewFamilyPlan -> 5
    _ -> 0
  }
  let status = case model.step {
    AllocateHours ->
      text(total_allocated_hours(model.students))
      <> " of "
      <> text(model.package_hours)
      <> " hours allocated"
    BuildWeeklyRoutine(_, allocation, _) -> {
      let total =
        list.fold(model.students, 0, fn(sum, student) {
          sum + list.length(student.subject_allocations)
        })
      let saved =
        list.count(model.weekly_routines, fn(routine) {
          routine.subject_allocation.id != allocation.id
        })
      text(saved) <> " of " <> text(total) <> " schedules ready"
    }
    _ ->
      text(scheduled_hours(model))
      <> " of "
      <> text(model.package_hours)
      <> " hours scheduled"
  }
  h.div([a.class("contents")], [
    case active {
      0 -> h.p([a.class("text-sm font-semibold")], [h.text(progress)])
      _ -> {
        let steps = [
          #("Package", Some(ChoosePackage)),
          #("Students", Some(ChooseStudentCount)),
          #("Allocation", Some(AllocateHours)),
          #("Schedules", None),
          #("Review plan", None),
        ]
        h.div([], [
          h.p([a.class("sm:hidden text-sm font-semibold mb-3")], [
            h.text(progress),
          ]),
          h.ol(
            [
              a.attribute("aria-label", "Booking steps"),
              a.class("hidden sm:flex flex-wrap gap-2"),
            ],
            list.index_map(steps, fn(step, index) {
              let #(label, destination) = step
              let current = index + 1 == active
              let attrs = case current {
                True -> [a.attribute("aria-current", "step")]
                False -> []
              }
              h.li(
                [
                  a.class(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                  ),
                  a.classes([
                    #("bg-white border-ink/25 font-bold", current),
                    #("border-ink/10 text-ink/65", !current),
                  ]),
                  ..attrs
                ],
                [
                  h.span(
                    [
                      a.class("planner-step"),
                      a.classes([#("!bg-ink !text-white", current)]),
                    ],
                    [h.text(text(index + 1))],
                  ),
                  case destination {
                    Some(step) if index + 1 < active ->
                      button(
                        label,
                        UserClickedStep(step),
                        "underline underline-offset-4 min-h-8",
                      )
                    _ -> h.text(label)
                  },
                ],
              )
            }),
          ),
        ])
      }
    },
    h.div(
      [
        a.class(
          "sticky top-0 z-20 my-3 rounded-lg border border-ink/15 bg-[#edf3ed]/95 px-3 backdrop-blur-sm",
        ),
      ],
      [
        h.div([a.class("relative py-3")], [
          h.p([a.class("pr-24 text-xs font-semibold")], [h.text(status)]),
          case model.step {
            ReviewFamilyPlan | EnterContactInfo | PayForOrder(_, _) ->
              element.none()
            _ -> {
              let key = case model.step {
                BuildWeeklyRoutine(_, allocation, _) -> allocation.id
                _ -> progress
              }
              keyed.div([], [
                #(
                  key,
                  h.details([], [
                    h.summary(
                      [
                        a.class(
                          "absolute right-0 top-0 !py-3 text-xs underline underline-offset-4",
                        ),
                      ],
                      [h.text("Family plan")],
                    ),
                    h.div(
                      [
                        a.class(
                          "mt-3 max-h-[50vh] overflow-y-auto rounded-lg bg-white p-4",
                        ),
                      ],
                      [schedule_summary(model, False)],
                    ),
                  ]),
                ),
              ])
            }
          },
        ]),
      ],
    ),
  ])
}

fn scheduled_hours(model: Model) -> Hours {
  list.fold(model.weekly_routines, 0, fn(sum, routine) {
    sum + list.length(routine.sessions)
  })
}

fn student_count_guidance(hours: Hours) -> Element(Msg) {
  h.div([a.class("rounded-lg bg-[#edf3ed] p-4 text-sm leading-6")], [
    case hours {
      5 ->
        h.text(
          "Need tutoring for 2 or 3 students? Choose the 10-hour package. For 4 or 5 students, choose the 20-hour package.",
        )
      10 ->
        h.text("Need tutoring for 4 or 5 students? Choose the 20-hour package.")
      _ ->
        h.p([], [
          h.text("This package supports up to 5 students. For more students, "),
          h.a([a.href("#contact"), a.class("underline underline-offset-4")], [
            h.text("contact support"),
          ]),
          h.text("."),
        ])
    },
    case hours < 20 {
      True ->
        h.div([], [
          button(
            "Go back and change your package",
            UserClickedStep(ChoosePackage),
            "underline underline-offset-4 font-semibold min-h-11",
          ),
        ])
      False -> element.none()
    },
  ])
}

fn step_view(model: Model) -> Element(Msg) {
  case model.step {
    ChoosePackage ->
      h.div([a.class("space-y-5")], [
        heading("Start with your package."),
        paragraph(
          "More hours, a lower hourly rate. You’ll divide the time next.",
        ),
        h.div(
          [a.class("space-y-3")],
          list.map([5, 10, 20], fn(hours) {
            let selected = model.package_hours == hours
            let class = case selected {
              True -> "border-ink bg-[#edf3ed] ring-1 ring-ink"
              False -> "border-ink/15"
            }
            h.button(
              [
                a.type_("button"),
                a.class(
                  "block w-full rounded-lg border p-4 text-left " <> class,
                ),
                a.attribute("aria-pressed", case selected {
                  True -> "true"
                  False -> "false"
                }),
                e.on_click(UserSelectedPackage(hours)),
              ],
              [
                h.strong([a.class("text-lg")], [h.text(text(hours) <> " hours")]),
                paragraph(case hours {
                  5 -> "For one student · not shared"
                  _ ->
                    "Share with up to "
                    <> text(student_limit(hours))
                    <> " students"
                }),
                paragraph(
                  format_money(hourly_rate(hours))
                  <> "/hour · "
                  <> total(hours)
                  <> " total",
                ),
              ],
            )
          }),
        ),
        button("Next: choose students", UserClickedNext, "btn w-full"),
      ])
    ChooseStudentCount ->
      h.div([a.class("space-y-5")], [
        button(
          "Back to package",
          UserClickedStep(ChoosePackage),
          "planner-small",
        ),
        heading("How many students?"),
        select(
          "Students",
          text(model.student_count),
          numbers(student_limit(model.package_hours)),
          on_integer_change(model.student_count, UserChangedStudentCount),
        ),
        paragraph(
          "Your package supports up to "
          <> text(student_limit(model.package_hours))
          <> case student_limit(model.package_hours) {
            1 -> " student."
            _ -> " students."
          },
        ),
        student_count_guidance(model.package_hours),
        button("Next: allocate hours", UserClickedNext, "btn w-full"),
      ])
    AllocateHours -> {
      let over_capacity =
        total_allocated_hours(model.students) > model.package_hours
      let show_errors = model.error != None
      let ready = allocation_issue(model.students, model.package_hours) == None
      h.div(
        [a.class("space-y-5")],
        list.append(
          [
            button(
              "Back to students",
              UserClickedStep(ChooseStudentCount),
              "planner-small",
            ),
            heading("Divide the hours."),
            paragraph(
              "Choose subjects and divide your package across your family.",
            ),
          ],
          list.append(
            list.index_map(model.students, fn(student, index) {
              student_view(
                student,
                index,
                model.package_hours,
                show_errors,
                over_capacity,
              )
            }),
            [
              case ready {
                True ->
                  h.p(
                    [
                      a.class(
                        "rounded-lg bg-[#edf3ed] p-4 font-semibold text-[#35573d]",
                      ),
                      a.attribute("role", "status"),
                    ],
                    [h.text("All student and subject hours are ready.")],
                  )
                False -> element.none()
              },
              button("Next: choose schedules", UserClickedNext, "btn w-full"),
            ],
          ),
        ),
      )
    }
    BuildWeeklyRoutine(student, allocation, input) ->
      schedule_view(model, student, allocation, input)
    ReviewFamilyPlan ->
      h.div([a.class("space-y-5")], [
        heading("One family. All planned together."),
        schedule_summary(model, True),
        button(
          "Change students & allocation",
          UserClickedStep(AllocateHours),
          "planner-outline",
        ),
        button(
          "Next: contact details",
          UserClickedStep(EnterContactInfo),
          "btn w-full",
        ),
      ])
    EnterContactInfo -> {
      let #(name, email, phone) = case model.contact {
        Some(contact) -> #(contact.name, contact.email, contact.phone)
        None -> #("", "", "")
      }
      h.div([a.class("space-y-5")], [
        button(
          "Back to review",
          UserClickedStep(ReviewFamilyPlan),
          "planner-small",
        ),
        heading("Contact details"),
        paragraph("Use fictional details. Nothing is saved or sent."),
        h.form([a.class("space-y-5"), e.on_submit(contact_submission)], [
          form_field("Contact name", "name", "text", name, ""),
          form_field("Email", "email", "email", email, ""),
          form_field("Phone number", "phone", "tel", phone, ""),
          h.button([a.class("btn w-full")], [h.text("Next: payment")]),
        ]),
      ])
    }
    PayForOrder(order, state) -> payment_view(order, state)
    OrderComplete(order) -> {
      let confirmed_groups = confirmed_schedule_groups(order, model.time_zone)
      h.div([a.class("space-y-5")], [
        h.div([a.class("rounded-lg bg-[#edf3ed] p-5 space-y-3")], [
          heading("Payment Complete"),
          paragraph("Thank you! Here’s what happens next."),
          paragraph(
            "In the live service, your tutors would be notified and next steps would arrive by email shortly.",
          ),
          h.p([a.class("text-sm leading-6")], [
            h.text(
              "If no email arrives within an hour, check your spam or junk folder, then ",
            ),
            h.a([a.href("#contact"), a.class("underline")], [
              h.text("contact us"),
            ]),
            h.text("."),
          ]),
          button("Print details", UserClickedPrint, "planner-outline"),
        ]),
        paragraph("Demo only. No payment was taken and no email was sent."),
        heading("Your family plan is ready."),
        plan_totals(
          order.package_hours,
          list.length(order.sessions),
          order.discount,
        ),
        confirmed_schedule(confirmed_groups, ScreenSchedule),
        h.section([a.id("print-order"), a.class("hidden")], [
          h.h1([], [h.text("Christian Tutors · Family plan")]),
          paragraph(
            order.contact.name
            <> " · "
            <> order.contact.email
            <> " · "
            <> order.contact.phone,
          ),
          paragraph("Demo order · " <> text(order.package_hours) <> " hours"),
          price_breakdown(order.package_hours, order.discount),
          confirmed_schedule(confirmed_groups, PrintSchedule),
        ]),
      ])
    }
  }
}

// Student allocation

fn student_view(
  student: Student,
  index: Int,
  capacity: Hours,
  show_errors: Bool,
  over_capacity: Bool,
) -> Element(Msg) {
  let remaining_hours = remaining_subject_hours(student)
  let name_invalid = show_errors && string.trim(student.name) == ""
  let subject_catalog = subjects()
  let subject_count = list.length(student.subject_allocations)
  let can_add_subject =
    subject_count
    < int.min(student.allocated_hours, list.length(subject_catalog))
  let add_subject_label = case subject_count {
    0 -> "Add a subject"
    _ -> "Add another subject"
  }
  let hour_options = numbers(int.max(1, subject_hour_limit(student)))
  let subject_rows =
    list.map(student.subject_allocations, fn(allocation) {
      let options = subject_options(subject_catalog, student, allocation)
      let invalid = show_errors && allocation.subject == ""
      subject_allocation_row(
        student,
        allocation,
        options,
        hour_options,
        invalid,
      )
    })
  let remaining_notice = case remaining_hours > 0 {
    True ->
      h.p([a.class("planner-action")], [
        h.text(
          text(remaining_hours) <> " remaining hours — add a subject below.",
        ),
      ])
    False -> element.none()
  }

  h.fieldset([a.class("border border-ink/15 rounded-lg p-4 space-y-4")], [
    h.legend([a.class("text-sm font-semibold px-2")], [
      h.text("Student " <> text(index + 1)),
    ]),
    h.div([a.class("grid gap-4 sm:grid-cols-2")], [
      h.label([a.class("planner-label block")], [
        h.text("Name"),
        h.input([
          a.class("field mt-2"),
          a.value(student.name),
          a.attribute("aria-invalid", bool_text(name_invalid)),
          e.on_input(UserEnteredStudentName(student.id, _)),
        ]),
      ]),
      select_field(
        "Student’s total hours",
        text(student.allocated_hours),
        numbers(capacity),
        on_integer_change(student.allocated_hours, UserChangedStudentHours(
          student.id,
          _,
        )),
        [a.attribute("aria-invalid", bool_text(over_capacity))],
      ),
    ]),
    ..list.append(subject_rows, [
      remaining_notice,
      h.button(
        [
          a.type_("button"),
          a.class("planner-outline disabled:opacity-40"),
          a.disabled(!can_add_subject),
          e.on_click(UserClickedAddSubject(student.id)),
        ],
        [h.text(add_subject_label)],
      ),
    ])
  ])
}

fn subject_options(
  subject_catalog: List(String),
  student: Student,
  allocation: SubjectAllocation,
) -> List(#(String, String)) {
  let available =
    subject_catalog
    |> list.filter(fn(subject) {
      subject == allocation.subject
      || !list.any(student.subject_allocations, fn(other) {
        other.subject == subject
      })
    })
    |> list.map(fn(subject) { #(subject, subject) })
  [#("", "Choose a subject"), ..available]
}

fn subject_allocation_row(
  student: Student,
  allocation: SubjectAllocation,
  subject_options: List(#(String, String)),
  hour_options: List(#(String, String)),
  invalid: Bool,
) -> Element(Msg) {
  h.div(
    [
      a.class(
        "grid gap-3 border-t border-ink/10 pt-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end",
      ),
    ],
    [
      select_field(
        "Subject",
        allocation.subject,
        subject_options,
        e.on_change(UserSelectedSubject(student.id, allocation.id, _)),
        [a.attribute("aria-invalid", bool_text(invalid))],
      ),
      h.div([a.class("flex items-end justify-between gap-4")], [
        select(
          "Subject hours",
          text(allocation.hours),
          hour_options,
          on_integer_change(allocation.hours, UserChangedSubjectHours(
            student.id,
            allocation.id,
            _,
          )),
        ),
        button(
          "Remove subject",
          UserClickedRemoveSubject(student.id, allocation.id),
          "planner-small",
        ),
      ]),
    ],
  )
}

// Weekly scheduling

fn zone_view(model: Model) -> Element(Msg) {
  h.div([a.class("space-y-2")], [
    h.div([a.class("flex flex-wrap items-center gap-2")], [
      paragraph("Times shown in " <> string.replace(model.time_zone, "_", " ")),
      button(
        "Change time zone",
        UserClickedChangeTimeZone,
        "planner-small underline",
      ),
    ]),
    case model.time_zone_query {
      None -> element.none()
      Some(query) ->
        h.div([a.class("space-y-2")], [
          h.label([a.class("planner-label block")], [
            h.text("Search a city or time zone"),
            h.input([
              a.class("field mt-2"),
              a.value(query),
              e.on_input(UserSearchedTimeZones),
            ]),
          ]),
          h.div(
            [
              a.class(
                "max-h-52 overflow-y-auto border border-ink/15 rounded-lg",
              ),
            ],
            list.map(matching_zones(query, model.time_zone), fn(zone) {
              button(
                string.replace(zone, "_", " "),
                UserSelectedTimeZone(zone),
                "block text-sm text-left w-full p-3 hover:bg-cream",
              )
            }),
          ),
        ])
    },
  ])
}

fn schedule_view(
  model: Model,
  student: Student,
  allocation: SubjectAllocation,
  input: RoutineDraft,
) -> Element(Msg) {
  let selected_tutor_id = case input.tutor {
    Some(tutor) -> tutor.id
    None -> ""
  }
  let tutor_catalog = all_tutors()
  let tutor_options = tutor_options(tutor_catalog, allocation.subject)
  let other_routines =
    list.filter(model.weekly_routines, fn(routine) {
      routine.subject_allocation.id != allocation.id
    })
  let #(day_cards, time_cards) = case input.tutor {
    None -> #([], None)
    Some(tutor) -> {
      let choices_for_date = fn(date) {
        choices(
          tutor,
          student,
          allocation,
          date,
          model.time_zone,
          other_routines,
        )
      }
      let selected_choices = choices_for_date(input.date)
      let days =
        week_dates(input.anchor)
        |> list.map(fn(day) {
          let #(date, label) = day
          let selected = date == input.date
          let times = case selected {
            True -> selected_choices
            False -> choices_for_date(date)
          }
          let available_count =
            list.count(times, fn(choice) { choice.availability == Available })
          DayCard(
            date:,
            label:,
            availability_label: available_times_label(available_count),
            selected:,
          )
        })
      let times =
        list.map(selected_choices, fn(choice) {
          let selected = case input.first_planned_session, choice.sessions {
            Some(first), [session, ..] -> first == session
            _, _ -> False
          }
          let unavailable_reason = case choice.availability {
            Available -> None
            Unavailable(reason) -> Some(reason)
          }
          TimeCard(choice.label, choice.sessions, selected, unavailable_reason)
        })
      #(days, Some(times))
    }
  }
  let preview =
    routine_preview(model, input.sessions, other_routines, tutor_catalog)
  let earliest_date = tomorrow(model.time_zone)
  let routine_description =
    "Choose the weekly routine. The same tutor, day, and time repeat for "
    <> text(allocation.hours)
    <> " one-hour "
    <> case allocation.hours {
      1 -> "session."
      _ -> "sessions."
    }

  h.div([a.class("space-y-5")], [
    button(
      "Back to allocation",
      UserClickedStep(AllocateHours),
      "planner-small",
    ),
    h.div([a.class("space-y-2")], [
      h.p([a.class("text-sm font-semibold text-ink/65")], [
        h.text("Planning for " <> student.name),
      ]),
      h.h3([a.class("text-3xl font-bold leading-snug")], [
        h.text(allocation.subject),
      ]),
      paragraph(routine_description),
    ]),
    select(
      "Tutor",
      selected_tutor_id,
      tutor_options,
      e.on_change(UserSelectedTutor),
    ),
    h.p([a.class("text-xs leading-6 text-ink/65")], [
      h.text("You can speak with your tutor before buying. "),
      h.a([a.href("#contact"), a.class("underline underline-offset-4")], [
        h.text("Ask about your tutor"),
      ]),
      h.text("."),
    ]),
    zone_view(model),
    paragraph(
      "Choose the exact first date in your time zone. Local times can shift when clocks change.",
    ),
    h.label([a.class("planner-label block")], [
      h.text("First weekly session"),
      h.input([
        a.type_("date"),
        a.class("field mt-2"),
        a.value(input.date),
        a.attribute("min", earliest_date),
        e.on_change(UserChangedFirstDate),
      ]),
    ]),
    day_cards_view(day_cards),
    time_cards_view(time_cards),
    routine_preview_view(preview),
  ])
}

fn tutor_options(
  tutors: List(Tutor),
  subject: model.Subject,
) -> List(#(String, String)) {
  let options =
    tutors
    |> list.filter(fn(tutor) { list.contains(tutor.subjects, subject) })
    |> list.map(fn(tutor) { #(tutor.id, tutor.name) })
  [#("", "Choose your tutor"), ..options]
}

fn available_times_label(count: Int) -> String {
  case count {
    0 -> "No weekly times"
    1 -> "1 available time"
    _ -> text(count) <> " available times"
  }
}

fn day_cards_view(cards: List(DayCard)) -> Element(Msg) {
  case cards {
    [] -> element.none()
    _ ->
      h.div(
        [a.class("grid grid-cols-2 sm:grid-cols-4 gap-2")],
        list.map(cards, day_card_view),
      )
  }
}

fn day_card_view(card: DayCard) -> Element(Msg) {
  h.button(
    [
      a.type_("button"),
      a.class("border border-ink/20 rounded-lg p-3 text-left"),
      a.classes([#("bg-[#edf3ed]", card.selected)]),
      a.attribute("aria-pressed", bool_text(card.selected)),
      e.on_click(UserComparedDate(card.date)),
    ],
    [
      h.strong([a.class("block text-sm")], [h.text(card.label)]),
      h.span([a.class("block text-xs mt-1")], [h.text(card.availability_label)]),
    ],
  )
}

fn time_cards_view(cards: Option(List(TimeCard))) -> Element(Msg) {
  case cards {
    None -> paragraph("Choose a tutor to see available times.")
    Some(cards) -> {
      let empty_notice = case
        list.any(cards, fn(card) { card.unavailable_reason == None })
      {
        True -> element.none()
        False ->
          h.p([a.class("planner-action"), a.attribute("role", "status")], [
            h.text(
              "No complete weekly routine starts on this date. Choose another date or tutor.",
            ),
          ])
      }
      h.div([a.class("space-y-3")], [
        h.p([a.class("planner-label")], [h.text("Choose a time for this date")]),
        h.div(
          [a.class("flex flex-wrap gap-2")],
          list.map(cards, time_card_view),
        ),
        empty_notice,
      ])
    }
  }
}

fn time_card_view(card: TimeCard) -> Element(Msg) {
  let background = case card.selected {
    True -> "bg-ink text-white"
    False -> "bg-white"
  }
  let #(reason, availability_label) = case card.unavailable_reason {
    None -> #([], element.none())
    Some(reason) -> #(
      [a.title(reason)],
      h.span([a.class("block text-xs")], [h.text("Unavailable")]),
    )
  }
  h.button(
    [
      a.type_("button"),
      a.class(
        "min-h-11 rounded-lg border border-ink/20 px-4 py-3 text-left text-xs disabled:opacity-40 "
        <> background,
      ),
      a.disabled(card.unavailable_reason != None),
      a.attribute("aria-pressed", bool_text(card.selected)),
      e.on_click(UserSelectedWeeklyTime(card.sessions)),
      ..reason
    ],
    [h.text(card.label), availability_label],
  )
}

fn routine_preview(
  model: Model,
  sessions: List(Session),
  other_routines: List(WeeklyRoutine),
  tutors: List(Tutor),
) -> RoutinePreview {
  case sessions {
    [] -> NoTimeSelected
    _ -> {
      let issue =
        scheduling.schedule_issue(
          sessions,
          other_routines,
          model.students,
          tutors,
          model.package_hours,
          now(),
          booking_calendar(),
        )
      let issue = case issue {
        "" -> None
        message -> Some(message)
      }
      let rows =
        draft_session_rows(
          sessions,
          model.time_zone,
          Some(UserClickedSkipWeekInDraft),
        )
      PreviewSessions(rows, issue)
    }
  }
}

fn routine_preview_view(preview: RoutinePreview) -> Element(Msg) {
  case preview {
    NoTimeSelected ->
      h.p([a.class("planner-action")], [
        h.text("Next: choose a tutor, date, and available time."),
      ])
    PreviewSessions(rows, issue) -> {
      let #(status, status_class) = case issue {
        None -> #(
          "Your weekly routine is ready to save.",
          "text-sm font-semibold text-[#35573d]",
        )
        Some(issue) -> #(issue, "planner-action")
      }
      h.div([a.class("space-y-3")], [
        h.p([a.class(status_class), a.attribute("role", "status")], [
          h.text(status),
        ]),
        h.div(
          [a.class("space-y-3 rounded-lg border border-ink/15 bg-cream p-4")],
          [
            h.h4([a.class("text-base font-semibold")], [
              h.text("Weekly session dates"),
            ]),
            paragraph(
              "Skip a week to add a replacement at the end. Contact support for other adjustments.",
            ),
            session_rows(rows),
          ],
        ),
        h.button(
          [
            a.type_("button"),
            a.class("btn w-full disabled:opacity-40"),
            a.disabled(issue != None),
            e.on_click(UserClickedSaveSchedule),
          ],
          [h.text("Save schedule & continue")],
        ),
      ])
    }
  }
}

// Draft review and confirmed schedules

fn draft_session_rows(
  sessions: List(Session),
  zone: TimeZone,
  skip: Option(fn(Session) -> Msg),
) -> List(SessionRow) {
  list.map(sessions, fn(session) {
    SessionRow(
      session_label(session, zone),
      option.map(skip, fn(action) { action(session) }),
    )
  })
}

fn session_rows(rows: List(SessionRow)) -> Element(Msg) {
  h.ul([a.class("space-y-2")], list.map(rows, session_row))
}

fn session_row(row: SessionRow) -> Element(Msg) {
  let skip_button = case row.skip {
    Some(message) ->
      button("Skip this week", message, "planner-small underline")
    None -> element.none()
  }
  h.li(
    [
      a.class(
        "border-t border-ink/10 py-2 flex flex-wrap justify-between items-center gap-2 text-sm",
      ),
    ],
    [h.text(row.label), skip_button],
  )
}

fn schedule_summary(model: Model, editable: Bool) -> Element(Msg) {
  let groups = draft_schedule_groups(model, editable)
  let empty_message = case groups {
    [] ->
      paragraph(
        "Your family’s students, weekly routines, and session dates will appear here as you plan.",
      )
    _ -> element.none()
  }
  let student_cards = list.map(groups, student_schedule_view(_, ScreenSchedule))

  h.div([a.class("space-y-4")], [
    plan_totals(model.package_hours, scheduled_hours(model), None),
    h.p([a.class("text-xs leading-6 text-ink/65")], [
      h.text("Need a different day or time without skipping a week? "),
      h.a([a.href("#contact"), a.class("underline underline-offset-4")], [
        h.text("Contact support"),
      ]),
      h.text(" and we’ll help."),
    ]),
    empty_message,
    ..student_cards
  ])
}

fn draft_schedule_groups(
  model: Model,
  editable: Bool,
) -> List(StudentScheduleGroup) {
  list.map(model.students, fn(student) {
    let student_name = case string.trim(student.name) {
      "" -> "Student"
      name -> name
    }
    let subjects =
      list.map(student.subject_allocations, fn(allocation) {
        let routine =
          list.find(model.weekly_routines, fn(routine) {
            routine.subject_allocation.id == allocation.id
          })
        case routine {
          Error(_) -> ScheduleNotChosen(allocation.subject)
          Ok(routine) ->
            draft_subject_schedule(
              routine,
              allocation,
              model.time_zone,
              editable,
            )
        }
      })
    StudentScheduleGroup(student_name, subjects)
  })
}

fn draft_subject_schedule(
  routine: WeeklyRoutine,
  allocation: SubjectAllocation,
  zone: TimeZone,
  editable: Bool,
) -> SubjectSchedule {
  let #(skip, edit) = case editable {
    True -> #(
      Some(UserClickedSkipWeekInReview(routine, _)),
      Some(UserClickedEditSchedule(routine)),
    )
    False -> #(None, None)
  }
  ScheduledSubject(
    subject: allocation.subject,
    session_summary: session_summary(routine.tutor.name, allocation.hours),
    routine_label: Some(
      "Weekly routine · " <> session_label(routine.first_planned_session, zone),
    ),
    rows: draft_session_rows(routine.sessions, zone, skip),
    edit:,
  )
}

fn session_summary(tutor_name: String, count: Int) -> String {
  tutor_name
  <> " · "
  <> text(count)
  <> case count {
    1 -> " session"
    _ -> " sessions"
  }
}

fn student_schedule_view(
  group: StudentScheduleGroup,
  display: ScheduleDisplay,
) -> Element(Msg) {
  h.div([a.class("space-y-3 border border-ink/15 rounded-lg p-4")], [
    h.h4([a.class("text-sm font-semibold text-ink/65")], [
      h.text(group.student_name),
    ]),
    h.div(
      [a.class("space-y-3")],
      list.map(group.subjects, subject_schedule_view(_, display)),
    ),
  ])
}

fn subject_schedule_view(
  schedule: SubjectSchedule,
  display: ScheduleDisplay,
) -> Element(Msg) {
  case schedule {
    ScheduleNotChosen(subject) -> paragraph(subject <> " · Schedule not chosen")
    ScheduledSubject(subject, summary, routine_label, rows, edit) -> {
      let routine = case routine_label {
        Some(label) -> paragraph(label)
        None -> element.none()
      }
      let edit_button = case edit {
        Some(message) ->
          button("Edit weekly schedule", message, "planner-small")
        None -> element.none()
      }
      let dates = session_rows(rows)
      h.div([a.class("space-y-2 border-t border-ink/10 pt-3")], [
        h.h5([a.class("text-xl font-bold leading-snug")], [h.text(subject)]),
        paragraph(summary),
        routine,
        case display {
          PrintSchedule -> dates
          ScreenSchedule ->
            h.details([], [
              h.summary([a.class("text-sm !py-2")], [
                h.text("View session dates"),
              ]),
              dates,
            ])
        },
        edit_button,
      ])
    }
  }
}

fn plan_totals(
  package_hours: Hours,
  scheduled: Hours,
  discount: Option(Discount),
) -> Element(Msg) {
  let unused = package_hours - scheduled
  h.div([a.class("rounded-lg bg-cream p-4 space-y-2")], [
    h.p([a.class("eyebrow text-ink/55")], [h.text("Everyone. Together.")]),
    h.p([a.class("font-semibold")], [
      h.text(
        text(scheduled) <> " of " <> text(package_hours) <> " hours scheduled",
      ),
    ]),
    paragraph(case unused {
      0 -> "All package hours are scheduled."
      1 -> "1 hour remains in your package."
      _ -> text(unused) <> " hours remain in your package."
    }),
    price_breakdown(package_hours, discount),
  ])
}

fn price_breakdown(hours: Hours, discount: Option(Discount)) -> Element(Msg) {
  let savings = discount_amount(hours, discount)
  h.div([a.class("space-y-2 border-t border-ink/15 pt-2 text-sm")], [
    case savings > 0 {
      True ->
        h.div([a.class("space-y-2")], [
          price_row("Package subtotal", format_money(package_total(hours))),
          price_row("Discount", "−" <> format_money(savings)),
        ])
      False -> element.none()
    },
    h.div([a.class("font-semibold")], [
      price_row("Package total", format_money(package_total(hours) - savings)),
    ]),
  ])
}

fn price_row(label: String, amount: String) -> Element(Msg) {
  h.div([a.class("flex justify-between gap-3")], [h.text(label), h.text(amount)])
}

fn confirmed_schedule_groups(
  order: Order,
  zone: TimeZone,
) -> List(StudentScheduleGroup) {
  list.map(order.students, fn(student) {
    let subjects =
      list.map(student.subject_allocations, fn(allocation) {
        let sessions =
          list.filter(order.sessions, fn(confirmed) {
            confirmed.session.student_id == student.id
            && confirmed.session.subject == allocation.subject
          })
        let tutor_name = case sessions {
          [first, ..] ->
            list.find(order.tutors, fn(tutor) {
              tutor.id == first.session.tutor_id
            })
            |> result.map(fn(tutor) { tutor.name })
            |> result.unwrap("")
          [] -> ""
        }
        let rows =
          list.map(sessions, fn(session) {
            SessionRow(instant_label(session.start_instant, zone), None)
          })
        ScheduledSubject(
          subject: allocation.subject,
          session_summary: session_summary(tutor_name, list.length(sessions)),
          routine_label: None,
          rows:,
          edit: None,
        )
      })
    StudentScheduleGroup(string.trim(student.name), subjects)
  })
}

fn confirmed_schedule(
  groups: List(StudentScheduleGroup),
  display: ScheduleDisplay,
) -> Element(Msg) {
  h.div(
    [a.class("space-y-4")],
    list.map(groups, student_schedule_view(_, display)),
  )
}

// Checkout forms

fn contact_submission(fields: List(#(String, String))) -> Msg {
  UserSubmittedContact(ContactInfo(
    name: field(fields, "name"),
    email: field(fields, "email"),
    phone: field(fields, "phone"),
  ))
}

fn payment_submission(fields: List(#(String, String))) -> Msg {
  UserSubmittedPayment(DemoPaymentDetails(
    card_number: field(fields, "card"),
    expiry: field(fields, "expiry"),
    security_code: field(fields, "cvc"),
    billing_name: field(fields, "billing"),
    postal_code: field(fields, "postal"),
  ))
}

fn field(fields: List(#(String, String)), key: String) -> String {
  list.key_find(fields, key) |> result.unwrap("")
}

fn form_field(
  label: String,
  name: String,
  kind: String,
  value: String,
  placeholder: String,
) -> Element(Msg) {
  let format = case name {
    "card" -> [a.inputmode("numeric"), a.maxlength(19)]
    "expiry" -> [a.inputmode("numeric"), a.maxlength(7)]
    "cvc" -> [a.inputmode("numeric"), a.maxlength(3)]
    _ -> []
  }
  h.label([a.class("planner-label block")], [
    h.text(label),
    h.input([
      a.class("field mt-2"),
      a.name(name),
      a.type_(kind),
      a.value(value),
      a.placeholder(placeholder),
      a.required(True),
      a.autocomplete("off"),
      ..format
    ]),
  ])
}

fn payment_view(order: Order, state: PaymentState) -> Element(Msg) {
  h.div([a.class("space-y-5")], [
    h.div([a.class("space-y-2")], [
      h.p([a.class("eyebrow text-ink/55")], [h.text("Demo checkout · Payment")]),
      heading("Pay for your family’s package."),
      paragraph("Local preview only. No payment is charged or sent."),
    ]),
    h.p([a.class("rounded-lg bg-[#edf3ed] p-4 text-sm leading-6")], [
      h.text("Use sample card "),
      h.strong([], [h.text("4242 4242 4242 4242")]),
      h.text(
        ", a future expiry, and any three-digit security code. Use fictional billing details.",
      ),
    ]),
    h.div([a.class("space-y-3")], [
      price_breakdown(order.package_hours, order.discount),
      h.button(
        [
          a.type_("button"),
          a.class("planner-outline"),
          a.disabled(state == Processing),
          e.on_click(UserToggledDemoDiscount),
        ],
        [
          h.text(case order.discount {
            None -> "Apply demo 20% discount"
            Some(_) -> "Remove demo discount"
          }),
        ],
      ),
    ]),
    h.form(
      [
        a.class("space-y-4"),
        a.attribute("data-payment", ""),
        a.attribute("aria-busy", bool_text(state == Processing)),
        e.on_submit(payment_submission),
      ],
      [
        h.fieldset([a.class("space-y-4"), a.disabled(state == Processing)], [
          h.legend([a.class("mb-4 text-sm font-semibold")], [
            h.text("Card details"),
          ]),
          form_field("Card number", "card", "text", "", "4242 4242 4242 4242"),
          h.div([a.class("grid grid-cols-2 gap-4")], [
            form_field("Expiry date", "expiry", "text", "", "MM / YY"),
            form_field("Security code", "cvc", "text", "", "123"),
          ]),
          form_field("Name on card", "billing", "text", "", "Sample Parent"),
          form_field("Billing ZIP / postal code", "postal", "text", "", "12345"),
        ]),
        h.button([a.class("btn w-full"), a.disabled(state == Processing)], [
          h.text(case state {
            Processing -> "Processing demo payment…"
            NotProcessing -> "Pay " <> format_money(order_total(order))
          }),
        ]),
      ],
    ),
    h.button(
      [
        a.type_("button"),
        a.class("planner-small underline"),
        a.disabled(state == Processing),
        e.on_click(UserClickedStep(EnterContactInfo)),
      ],
      [h.text("Back to contact details")],
    ),
  ])
}

// Shared controls and formatting

fn total(hours: Hours) -> String {
  format_money(package_total(hours))
}

fn text(value: Int) -> String {
  int.to_string(value)
}

fn bool_text(value: Bool) -> String {
  case value {
    True -> "true"
    False -> "false"
  }
}

fn button(label: String, msg: Msg, class: String) -> Element(Msg) {
  h.button([a.type_("button"), a.class(class), e.on_click(msg)], [h.text(label)])
}

fn heading(label: String) -> Element(Msg) {
  h.h3([a.class("text-2xl font-semibold")], [h.text(label)])
}

fn paragraph(label: String) -> Element(Msg) {
  h.p([a.class("text-sm leading-6 text-ink/65")], [h.text(label)])
}

fn select(
  label: String,
  value: String,
  options: List(#(String, String)),
  on_change: a.Attribute(Msg),
) -> Element(Msg) {
  select_field(label, value, options, on_change, [])
}

fn select_field(
  label: String,
  value: String,
  options: List(#(String, String)),
  on_change: a.Attribute(Msg),
  attributes: List(a.Attribute(Msg)),
) -> Element(Msg) {
  h.label([a.class("planner-label block")], [
    h.text(label),
    h.select(
      [a.class("field mt-2"), on_change, ..attributes],
      list.map(options, fn(option) {
        h.option([a.value(option.0), a.selected(option.0 == value)], option.1)
      }),
    ),
  ])
}

fn on_integer_change(
  current: Int,
  message: fn(Int) -> Msg,
) -> a.Attribute(Msg) {
  e.on("change", {
    use value <- decode.subfield(["target", "value"], decode.string)
    case int.parse(value) {
      Ok(number) -> decode.success(message(number))
      Error(_) -> decode.failure(message(current), "integer")
    }
  })
}

fn numbers(max: Int) -> List(#(String, String)) {
  int.range(1, max + 1, [], fn(values, n) { [#(text(n), text(n)), ..values] })
  |> list.reverse
}
