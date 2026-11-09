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
import planner/allocation.{allocation_issue, student_limit}
import planner/browser.{
  booking_calendar, choices, format_money, instant_label, matching_zones, now,
  session_label, subjects, tomorrow, tutors, week_dates,
}
import planner/checkout.{
  discount_amount, hourly_rate, order_total, package_total,
}
import planner/model.{
  type Discount, type Hours, type Model, type Msg, type Order, type PaymentState,
  type RoutineDraft, type Session, type Student, type SubjectAllocation,
  type TimeZone, AllocateHours, Available, BuildWeeklyRoutine, ChoosePackage,
  ChooseStudentCount, ContactInfo, DemoPaymentDetails, EnterContactInfo,
  NotProcessing, OrderComplete, PayForOrder, Processing, ReviewFamilyPlan,
  Unavailable, UserChangedFirstDate, UserChangedStudentCount,
  UserChangedStudentHours, UserChangedSubjectHours, UserClickedAddSubject,
  UserClickedChangeTimeZone, UserClickedEditSchedule, UserClickedNext,
  UserClickedPrint, UserClickedRemoveSubject, UserClickedSaveSchedule,
  UserClickedSkipWeekInDraft, UserClickedSkipWeekInReview, UserClickedStep,
  UserComparedDate, UserEnteredStudentName, UserSearchedTimeZones,
  UserSelectedPackage, UserSelectedSubject, UserSelectedTimeZone,
  UserSelectedTutor, UserSelectedWeeklyTime, UserSubmittedContact,
  UserSubmittedPayment, UserToggledDemoDiscount,
}
import planner/scheduling

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
    Some(message) ->
      h.p(
        [
          a.class("rounded-lg bg-[#edf3ed] p-4 text-sm text-[#35573d]"),
          a.attribute("role", "status"),
        ],
        [h.text(message)],
      )
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
      text(allocated_hours(model.students))
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

fn allocated_hours(students: List(Student)) -> Hours {
  list.fold(students, 0, fn(sum, student) { sum + student.allocated_hours })
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
    AllocateHours ->
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
                model.error != None,
                allocated_hours(model.students) > model.package_hours,
              )
            }),
            [
              case allocation_issue(model.students, model.package_hours) {
                None ->
                  h.p(
                    [
                      a.class(
                        "rounded-lg bg-[#edf3ed] p-4 font-semibold text-[#35573d]",
                      ),
                      a.attribute("role", "status"),
                    ],
                    [h.text("All student and subject hours are ready.")],
                  )
                _ -> element.none()
              },
              button("Next: choose schedules", UserClickedNext, "btn w-full"),
            ],
          ),
        ),
      )
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
      let #(name, email) = case model.contact {
        Some(contact) -> #(contact.name, contact.email)
        None -> #("", "")
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
          h.button([a.class("btn w-full")], [h.text("Next: payment")]),
        ]),
      ])
    }
    PayForOrder(order, state) -> payment_view(order, state)
    OrderComplete(order) ->
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
        confirmed_schedule(order, model.time_zone, False),
        h.section([a.id("print-order"), a.class("hidden")], [
          h.h1([], [h.text("Christian Tutors · Family plan")]),
          paragraph(order.contact.name <> " · " <> order.contact.email),
          paragraph("Demo order · " <> text(order.package_hours) <> " hours"),
          price_breakdown(order.package_hours, order.discount),
          confirmed_schedule(order, model.time_zone, True),
        ]),
      ])
  }
}

fn student_view(
  student: Student,
  index: Int,
  capacity: Hours,
  show_errors: Bool,
  over_capacity: Bool,
) -> Element(Msg) {
  let remaining =
    student.allocated_hours
    - list.fold(student.subject_allocations, 0, fn(sum, allocation) {
      sum + allocation.hours
    })
  h.fieldset(
    [a.class("border border-ink/15 rounded-lg p-4 space-y-4")],
    list.append(
      [
        h.legend([a.class("text-sm font-semibold px-2")], [
          h.text("Student " <> text(index + 1)),
        ]),
        h.div([a.class("grid gap-4 sm:grid-cols-2")], [
          h.label([a.class("planner-label block")], [
            h.text("Name"),
            h.input([
              a.class("field mt-2"),
              a.value(student.name),
              a.attribute(
                "aria-invalid",
                bool_text(show_errors && string.trim(student.name) == ""),
              ),
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
      ],
      list.append(
        list.map(student.subject_allocations, fn(allocation) {
          let available =
            subjects()
            |> list.filter(fn(subject) {
              subject == allocation.subject
              || !list.any(student.subject_allocations, fn(other) {
                other.subject == subject
              })
            })
            |> list.map(fn(subject) { #(subject, subject) })
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
                [#("", "Choose a subject"), ..available],
                e.on_change(UserSelectedSubject(student.id, allocation.id, _)),
                [
                  a.attribute(
                    "aria-invalid",
                    bool_text(show_errors && allocation.subject == ""),
                  ),
                ],
              ),
              h.div([a.class("flex items-end justify-between gap-4")], [
                select(
                  "Subject hours",
                  text(allocation.hours),
                  numbers(int.max(
                    1,
                    student.allocated_hours
                      - list.length(student.subject_allocations)
                      + 1,
                  )),
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
        }),
        [
          case remaining > 0 {
            True ->
              h.p([a.class("planner-action")], [
                h.text(
                  text(remaining) <> " remaining hours — add a subject below.",
                ),
              ])
            False -> element.none()
          },
          h.button(
            [
              a.type_("button"),
              a.class("planner-outline disabled:opacity-40"),
              a.disabled(
                list.length(student.subject_allocations)
                >= int.min(student.allocated_hours, list.length(subjects())),
              ),
              e.on_click(UserClickedAddSubject(student.id)),
            ],
            [
              h.text(case student.subject_allocations {
                [] -> "Add a subject"
                _ -> "Add another subject"
              }),
            ],
          ),
        ],
      ),
    ),
  )
}

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
  let selected = case input.tutor {
    Some(tutor) -> tutor.id
    None -> ""
  }
  let options =
    tutors()
    |> list.filter(fn(tutor) {
      list.contains(tutor.subjects, allocation.subject)
    })
    |> list.map(fn(tutor) { #(tutor.id, tutor.name) })
  let others =
    list.filter(model.weekly_routines, fn(schedule) {
      schedule.subject_allocation.id != allocation.id
    })
  let times = case input.tutor {
    None -> paragraph("Choose a tutor to see available times.")
    Some(tutor) -> {
      let times =
        choices(tutor, student, allocation, input.date, model.time_zone, others)
      h.div([a.class("space-y-3")], [
        h.p([a.class("planner-label")], [h.text("Choose a time for this date")]),
        h.div(
          [a.class("flex flex-wrap gap-2")],
          list.map(times, fn(choice) {
            let chosen = case input.first_planned_session, choice.sessions {
              Some(first), [session, ..] -> first == session
              _, _ -> False
            }
            let class = case chosen {
              True -> "bg-ink text-white"
              False -> "bg-white"
            }
            let reason = case choice.availability {
              Available -> []
              Unavailable(reason) -> [a.title(reason)]
            }
            h.button(
              [
                a.type_("button"),
                a.class(
                  "min-h-11 rounded-lg border border-ink/20 px-4 py-3 text-left text-xs disabled:opacity-40 "
                  <> class,
                ),
                a.disabled(choice.availability != Available),
                a.attribute("aria-pressed", bool_text(chosen)),
                e.on_click(UserSelectedWeeklyTime(choice.sessions)),
                ..reason
              ],
              [
                h.text(choice.label),
                case choice.availability {
                  Available -> element.none()
                  Unavailable(_) ->
                    h.span([a.class("block text-xs")], [h.text("Unavailable")])
                },
              ],
            )
          }),
        ),
        case list.any(times, fn(choice) { choice.availability == Available }) {
          True -> element.none()
          False ->
            h.p([a.class("planner-action"), a.attribute("role", "status")], [
              h.text(
                "No complete weekly routine starts on this date. Choose another date or tutor.",
              ),
            ])
        },
      ])
    }
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
      paragraph(
        "Choose the weekly routine. The same tutor, day, and time repeat for "
        <> text(allocation.hours)
        <> " one-hour "
        <> case allocation.hours {
          1 -> "session."
          _ -> "sessions."
        },
      ),
    ]),
    select(
      "Tutor",
      selected,
      [#("", "Choose your tutor"), ..options],
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
        a.attribute("min", tomorrow(model.time_zone)),
        e.on_change(UserChangedFirstDate),
      ]),
    ]),
    case input.tutor {
      None -> element.none()
      Some(tutor) ->
        h.div(
          [a.class("grid grid-cols-2 sm:grid-cols-4 gap-2")],
          list.map(week_dates(input.anchor), fn(day) {
            let count =
              choices(
                tutor,
                student,
                allocation,
                day.0,
                model.time_zone,
                others,
              )
              |> list.filter(fn(choice) { choice.availability == Available })
              |> list.length
            let available = case count {
              0 -> "No weekly times"
              1 -> "1 available time"
              _ -> text(count) <> " available times"
            }
            h.button(
              [
                a.type_("button"),
                a.class("border border-ink/20 rounded-lg p-3 text-left"),
                a.classes([#("bg-[#edf3ed]", day.0 == input.date)]),
                a.attribute("aria-pressed", bool_text(day.0 == input.date)),
                e.on_click(UserComparedDate(day.0)),
              ],
              [
                h.strong([a.class("block text-sm")], [h.text(day.1)]),
                h.span([a.class("block text-xs mt-1")], [h.text(available)]),
              ],
            )
          }),
        )
    },
    times,
    case input.sessions {
      [] ->
        h.p([a.class("planner-action")], [
          h.text("Next: choose a tutor, date, and available time."),
        ])
      sessions -> {
        let issue =
          scheduling.schedule_issue(
            sessions,
            others,
            model.students,
            tutors(),
            model.package_hours,
            now(),
            booking_calendar(),
          )
        h.div([a.class("space-y-3")], [
          case issue {
            "" ->
              h.p(
                [
                  a.class("text-sm font-semibold text-[#35573d]"),
                  a.attribute("role", "status"),
                ],
                [h.text("Your weekly routine is ready to save.")],
              )
            _ ->
              h.p([a.class("planner-action"), a.attribute("role", "status")], [
                h.text(issue),
              ])
          },
          h.div(
            [a.class("space-y-3 rounded-lg border border-ink/15 bg-cream p-4")],
            [
              h.h4([a.class("text-base font-semibold")], [
                h.text("Weekly session dates"),
              ]),
              paragraph(
                "Skip a week to add a replacement at the end. Contact support for other adjustments.",
              ),
              session_rows(
                sessions,
                model.time_zone,
                Some(UserClickedSkipWeekInDraft),
              ),
            ],
          ),
          h.button(
            [
              a.type_("button"),
              a.class("btn w-full disabled:opacity-40"),
              a.disabled(issue != ""),
              e.on_click(UserClickedSaveSchedule),
            ],
            [h.text("Save schedule & continue")],
          ),
        ])
      }
    },
  ])
}

fn session_rows(
  sessions: List(Session),
  zone: String,
  skip: Option(fn(Session) -> Msg),
) -> Element(Msg) {
  h.ul(
    [a.class("space-y-2")],
    list.map(sessions, fn(session) {
      h.li(
        [
          a.class(
            "border-t border-ink/10 py-2 flex flex-wrap justify-between items-center gap-2 text-sm",
          ),
        ],
        [
          h.text(session_label(session, zone)),
          case skip {
            Some(action) ->
              button(
                "Skip this week",
                action(session),
                "planner-small underline",
              )
            None -> element.none()
          },
        ],
      )
    }),
  )
}

fn schedule_summary(model: Model, editable: Bool) -> Element(Msg) {
  h.div(
    [a.class("space-y-4")],
    list.append(
      [
        plan_totals(model.package_hours, scheduled_hours(model), None),
        h.p([a.class("text-xs leading-6 text-ink/65")], [
          h.text("Need a different day or time without skipping a week? "),
          h.a([a.href("#contact"), a.class("underline underline-offset-4")], [
            h.text("Contact support"),
          ]),
          h.text(" and we’ll help."),
        ]),
        case model.students {
          [] ->
            paragraph(
              "Your family’s students, weekly routines, and session dates will appear here as you plan.",
            )
          _ -> element.none()
        },
      ],
      list.map(model.students, fn(student) {
        h.div([a.class("space-y-3 border border-ink/15 rounded-lg p-4")], [
          h.h4([a.class("text-sm font-semibold text-ink/65")], [
            h.text(case string.trim(student.name) {
              "" -> "Student"
              name -> name
            }),
          ]),
          h.div(
            [a.class("space-y-3")],
            list.map(student.subject_allocations, fn(allocation) {
              case
                list.find(model.weekly_routines, fn(schedule) {
                  schedule.subject_allocation.id == allocation.id
                })
              {
                Error(_) ->
                  paragraph(allocation.subject <> " · Schedule not chosen")
                Ok(schedule) ->
                  h.div([a.class("space-y-2 border-t border-ink/10 pt-3")], [
                    h.h5([a.class("text-xl font-bold leading-snug")], [
                      h.text(allocation.subject),
                    ]),
                    paragraph(
                      schedule.tutor.name
                      <> " · "
                      <> text(allocation.hours)
                      <> case allocation.hours {
                        1 -> " session"
                        _ -> " sessions"
                      },
                    ),
                    paragraph(
                      "Weekly routine · "
                      <> session_label(
                        schedule.first_planned_session,
                        model.time_zone,
                      ),
                    ),
                    h.details([], [
                      h.summary([a.class("text-sm !py-2")], [
                        h.text("View session dates"),
                      ]),
                      session_rows(
                        schedule.sessions,
                        model.time_zone,
                        case editable {
                          True -> Some(UserClickedSkipWeekInReview(schedule, _))
                          False -> None
                        },
                      ),
                    ]),
                    case editable {
                      True ->
                        button(
                          "Edit weekly schedule",
                          UserClickedEditSchedule(schedule),
                          "planner-small",
                        )
                      False -> element.none()
                    },
                  ])
              }
            }),
          ),
        ])
      }),
    ),
  )
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

fn confirmed_schedule(
  order: Order,
  zone: TimeZone,
  print: Bool,
) -> Element(Msg) {
  h.div(
    [a.class("space-y-4")],
    list.map(order.students, fn(student) {
      h.div([a.class("space-y-3 border border-ink/15 rounded-lg p-4")], [
        h.h4([a.class("text-sm font-semibold text-ink/65")], [
          h.text(string.trim(student.name)),
        ]),
        h.div(
          [a.class("space-y-3")],
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
            let dates =
              h.ul(
                [a.class("space-y-2")],
                list.map(sessions, fn(session) {
                  h.li([a.class("border-t border-ink/10 py-2 text-sm")], [
                    h.text(instant_label(session.start_instant, zone)),
                  ])
                }),
              )
            h.div([a.class("space-y-2 border-t border-ink/10 pt-3")], [
              h.h5([a.class("text-xl font-bold leading-snug")], [
                h.text(allocation.subject),
              ]),
              paragraph(
                tutor_name
                <> " · "
                <> text(list.length(sessions))
                <> case sessions {
                  [_] -> " session"
                  _ -> " sessions"
                },
              ),
              case print {
                True -> dates
                False ->
                  h.details([], [
                    h.summary([a.class("text-sm !py-2")], [
                      h.text("View session dates"),
                    ]),
                    dates,
                  ])
              },
            ])
          }),
        ),
      ])
    }),
  )
}

fn contact_submission(fields: List(#(String, String))) -> Msg {
  UserSubmittedContact(ContactInfo(
    name: field(fields, "name"),
    email: field(fields, "email"),
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
