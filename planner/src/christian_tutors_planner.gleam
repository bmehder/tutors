import gleam/int
import gleam/list
import gleam/option.{None, Some}
import gleam/result
import lustre
import lustre/effect
import planner/allocation.{
  allocation_issue, initialize_allocations, remove_subject_allocation,
  set_subject_hours,
}
import planner/browser.{
  add_days, after_payment, billing_month, booking_calendar, browser_time_zone,
  id, install_payment_masks, listen_for_tutor_card_clicks, now, print_page,
  scroll, session_date, session_label, tomorrow, tutors, valid_date,
}
import planner/checkout
import planner/model.{
  type BookingStep, type ContactInfo, type DemoPaymentDetails, type ErrorMessage,
  type Model, type Msg, type NoticeMessage, type Order, type Session,
  type Student, type SubjectAllocation, type TutorId, type WeeklyRoutine,
  AllocateHours, BuildWeeklyRoutine, ChoosePackage, ChooseStudentCount,
  EnterContactInfo, Model, NotProcessing, Order, OrderComplete, PayForOrder,
  Processing, ReviewFamilyPlan, RoutineDraft, Student, SubjectAllocation,
  WeeklyRoutine,
}
import planner/scheduling
import planner/view

// Application setup

pub fn main() {
  let app = lustre.application(init, update, view.render)
  let assert Ok(runtime) = lustre.start(app, "#family-planner", Nil)
  listen_for_tutor_card_clicks(
    fn(message) { lustre.send(runtime, lustre.dispatch(message)) },
    model.UserClickedTutorAvailability,
  )
  install_payment_masks()
}

fn init(_) {
  #(
    Model(
      step: ChoosePackage,
      package_hours: 10,
      student_count: 1,
      students: [],
      weekly_routines: [],
      time_zone: browser_time_zone() |> option.unwrap("UTC"),
      time_zone_query: None,
      preferred_tutor_id: None,
      error: None,
      notice: None,
      contact: None,
    ),
    effect.none(),
  )
}

// Message handling

fn update(model: Model, msg: Msg) -> #(Model, effect.Effect(Msg)) {
  let order_complete = case model.step {
    OrderComplete(_) -> True
    _ -> False
  }
  case msg {
    model.UserClickedPrint if order_complete -> #(
      model,
      effect.from(fn(_) { print_page() }),
    )

    _ if order_complete -> #(model, effect.none())

    model.UserSelectedPackage(hours) if hours != model.package_hours -> #(
      Model(
        ..model,
        package_hours: hours,
        student_count: 1,
        students: [],
        weekly_routines: [],
      ),
      effect.none(),
    )

    model.UserChangedStudentCount(student_count) -> #(
      Model(..model, student_count:),
      effect.none(),
    )

    model.UserClickedNext ->
      case model.step {
        ChoosePackage -> move(model, ChooseStudentCount)
        ChooseStudentCount -> prepare_allocation(model)
        AllocateHours -> begin_scheduling(model)
        _ -> #(model, effect.none())
      }

    model.UserEnteredStudentName(id, name) -> #(
      update_student(model, id, fn(student) { Student(..student, name:) }),
      effect.none(),
    )

    model.UserChangedStudentHours(id, hours) -> #(
      update_student(model, id, fn(student) {
        let subjects = case student.subject_allocations {
          [allocation] -> [SubjectAllocation(..allocation, hours:)]
          _ -> student.subject_allocations
        }
        Student(
          ..student,
          allocated_hours: hours,
          subject_allocations: subjects,
        )
      }),
      effect.none(),
    )

    model.UserSelectedSubject(id, allocation_id, subject) -> #(
      update_student(model, id, fn(student) {
        Student(
          ..student,
          subject_allocations: list.map(
            student.subject_allocations,
            fn(allocation) {
              case allocation.id == allocation_id {
                True -> SubjectAllocation(..allocation, subject:)
                False -> allocation
              }
            },
          ),
        )
      }),
      effect.none(),
    )

    model.UserChangedSubjectHours(id, allocation, hours) -> #(
      update_student(model, id, fn(student) {
        set_subject_hours(student, allocation, hours)
      }),
      effect.none(),
    )

    model.UserClickedAddSubject(student_id) -> #(
      update_student(model, student_id, fn(student) {
        let remaining =
          student.allocated_hours
          - list.fold(student.subject_allocations, 0, fn(sum, allocation) {
            sum + allocation.hours
          })
        let allocation_id = id()
        let allocation =
          SubjectAllocation(allocation_id, "", int.max(1, remaining))
        let student =
          Student(
            ..student,
            subject_allocations: list.append(student.subject_allocations, [
              allocation,
            ]),
          )
        case remaining > 0 {
          True -> student
          False -> set_subject_hours(student, allocation_id, 1)
        }
      }),
      effect.none(),
    )

    model.UserClickedRemoveSubject(id, allocation) -> #(
      update_student(model, id, fn(student) {
        remove_subject_allocation(student, allocation)
      }),
      effect.none(),
    )

    model.UserSelectedTutor(id) ->
      case model.step {
        BuildWeeklyRoutine(student, allocation, input) -> {
          let tutor =
            list.find(tutors(), fn(tutor) { tutor.id == id })
            |> option.from_result
          #(
            Model(
              ..model,
              step: BuildWeeklyRoutine(
                student,
                allocation,
                RoutineDraft(
                  ..input,
                  tutor:,
                  sessions: [],
                  first_planned_session: None,
                ),
              ),
              notice: None,
            ),
            effect.none(),
          )
        }
        _ -> #(model, effect.none())
      }

    model.UserChangedFirstDate(date) ->
      case model.step {
        BuildWeeklyRoutine(student, allocation, input) if date != "" -> #(
          Model(
            ..model,
            step: BuildWeeklyRoutine(
              student,
              allocation,
              RoutineDraft(
                ..input,
                date:,
                anchor: date,
                sessions: [],
                first_planned_session: None,
              ),
            ),
            notice: None,
          ),
          effect.none(),
        )
        _ -> #(model, effect.none())
      }

    model.UserComparedDate(date) ->
      case model.step {
        BuildWeeklyRoutine(student, allocation, input) -> #(
          Model(
            ..model,
            step: BuildWeeklyRoutine(
              student,
              allocation,
              RoutineDraft(
                ..input,
                date:,
                sessions: [],
                first_planned_session: None,
              ),
            ),
            notice: None,
          ),
          effect.none(),
        )
        _ -> #(model, effect.none())
      }

    model.UserSelectedWeeklyTime([first, ..] as sessions) ->
      case model.step {
        BuildWeeklyRoutine(student, allocation, input) -> #(
          Model(
            ..model,
            step: BuildWeeklyRoutine(
              student,
              allocation,
              RoutineDraft(
                ..input,
                sessions:,
                first_planned_session: Some(first),
              ),
            ),
            notice: None,
            error: None,
          ),
          effect.none(),
        )
        _ -> #(model, effect.none())
      }

    model.UserClickedSaveSchedule -> save_schedule(model)

    model.UserClickedSkipWeekInDraft(session) -> skip_draft_week(model, session)

    model.UserClickedSkipWeekInReview(schedule, session) ->
      skip_saved_week(model, schedule, session)

    model.UserClickedEditSchedule(schedule) -> {
      let date = session_date(schedule.first_planned_session, model.time_zone)
      move(
        model,
        BuildWeeklyRoutine(
          schedule.student,
          schedule.subject_allocation,
          RoutineDraft(
            Some(schedule.tutor),
            date,
            date,
            schedule.sessions,
            Some(schedule.first_planned_session),
          ),
        ),
      )
    }

    model.UserSelectedTimeZone(time_zone) ->
      case model.step {
        BuildWeeklyRoutine(student, allocation, input) -> {
          let date = case input.first_planned_session {
            Some(first) -> session_date(first, time_zone)
            None -> input.date
          }
          #(
            Model(
              ..model,
              time_zone:,
              time_zone_query: None,
              step: BuildWeeklyRoutine(
                student,
                allocation,
                RoutineDraft(..input, date:, anchor: date),
              ),
              notice: None,
            ),
            effect.none(),
          )
        }
        _ -> #(
          Model(..model, time_zone:, time_zone_query: None, notice: None),
          effect.none(),
        )
      }

    model.UserClickedChangeTimeZone -> #(
      Model(..model, time_zone_query: case model.time_zone_query {
        Some(_) -> None
        None -> Some("")
      }),
      effect.none(),
    )

    model.UserSearchedTimeZones(query) -> #(
      Model(..model, time_zone_query: Some(query)),
      effect.none(),
    )

    model.UserClickedTutorAvailability(id) -> prefer_tutor(model, id)

    model.UserSubmittedContact(contact) -> submit_contact(model, contact)

    model.UserToggledDemoDiscount ->
      case model.step {
        PayForOrder(order, NotProcessing) -> {
          let discount = case order.discount {
            None -> Some(checkout.demo_discount(order.package_hours))
            Some(_) -> None
          }
          #(
            Model(
              ..model,
              step: PayForOrder(Order(..order, discount:), NotProcessing),
            ),
            effect.none(),
          )
        }
        _ -> #(model, effect.none())
      }

    model.UserSubmittedPayment(details) -> submit_payment(model, details)

    model.DemoPaymentFinished(order) -> finish_payment(model, order)

    model.UserClickedStep(booking_step) ->
      case model.step {
        PayForOrder(_, Processing) -> #(model, effect.none())
        _ -> move(model, booking_step)
      }

    model.UserSelectedPackage(_)
    | model.UserSelectedWeeklyTime([])
    | model.UserClickedPrint -> #(model, effect.none())
  }
}

// Booking progression

fn prepare_allocation(model: Model) {
  {
    let students = case list.length(model.students) == model.student_count {
      True -> model.students
      False ->
        initialize_allocations(model.package_hours, model.student_count, id)
        |> list.index_map(fn(student, index) {
          case list.drop(model.students, index) {
            [old, ..] -> Student(..student, name: old.name)
            _ -> student
          }
        })
    }
    move(Model(..model, students:), AllocateHours)
  }
}

fn begin_scheduling(model: Model) {
  case allocation_issue(model.students, model.package_hours) {
    None -> {
      let schedules =
        list.filter_map(model.weekly_routines, fn(schedule) {
          use student <- result.try(
            list.find(model.students, fn(student) {
              student.id == schedule.student.id
            }),
          )
          use allocation <- result.try(
            list.find(student.subject_allocations, fn(allocation) {
              allocation == schedule.subject_allocation
            }),
          )
          Ok(
            WeeklyRoutine(..schedule, student:, subject_allocation: allocation),
          )
        })
      next_schedule(Model(..model, weekly_routines: schedules))
    }
    Some(issue) -> failure(model, issue)
  }
}

fn next_schedule(model: Model) {
  let next_unscheduled =
    model.students
    |> list.flat_map(allocations_with_student)
    |> list.find(fn(entry) {
      let #(_, allocation) = entry
      !list.any(model.weekly_routines, fn(routine) {
        routine.subject_allocation.id == allocation.id
      })
    })
  case next_unscheduled {
    Error(_) -> move(model, ReviewFamilyPlan)
    Ok(#(student, allocation)) -> {
      let preferred =
        tutors()
        |> list.find(fn(tutor) {
          Some(tutor.id) == model.preferred_tutor_id
          && list.contains(tutor.subjects, allocation.subject)
        })
        |> option.from_result
      move(
        model,
        BuildWeeklyRoutine(
          student,
          allocation,
          RoutineDraft(
            preferred,
            tomorrow(model.time_zone),
            tomorrow(model.time_zone),
            [],
            None,
          ),
        ),
      )
    }
  }
}

fn allocations_with_student(
  student: Student,
) -> List(#(Student, SubjectAllocation)) {
  list.map(student.subject_allocations, fn(allocation) {
    #(student, allocation)
  })
}

// Weekly routines

fn save_schedule(model: Model) {
  case model.step {
    BuildWeeklyRoutine(
      student,
      allocation,
      RoutineDraft(Some(tutor), _, _, sessions, Some(first)),
    ) -> {
      let schedules =
        list.filter(model.weekly_routines, fn(schedule) {
          schedule.subject_allocation.id != allocation.id
        })
      case
        scheduling.schedule_issue(
          sessions,
          schedules,
          model.students,
          tutors(),
          model.package_hours,
          now(),
          booking_calendar(),
        )
      {
        "" ->
          next_schedule(
            Model(
              ..model,
              weekly_routines: list.append(schedules, [
                WeeklyRoutine(student, allocation, tutor, sessions, first),
              ]),
            ),
          )
        issue -> failure(model, issue)
      }
    }
    _ -> #(model, effect.none())
  }
}

fn skip_draft_week(model: Model, session: Session) {
  case model.step {
    BuildWeeklyRoutine(
      student,
      allocation,
      RoutineDraft(Some(tutor), _, _, sessions, _) as input,
    ) -> {
      let others =
        list.filter(model.weekly_routines, fn(schedule) {
          schedule.subject_allocation.id != allocation.id
        })
      case
        scheduling.skip_session(
          sessions,
          session,
          tutor,
          scheduling.scheduled_sessions(others),
          now(),
          booking_calendar(),
          add_days,
        )
      {
        Error(issue) -> failure(model, issue)
        Ok(updated) -> #(
          Model(
            ..model,
            step: BuildWeeklyRoutine(
              student,
              allocation,
              RoutineDraft(..input, sessions: updated),
            ),
            notice: Some(skip_notice(model, session, updated)),
            error: None,
          ),
          effect.none(),
        )
      }
    }
    _ -> #(model, effect.none())
  }
}

fn skip_saved_week(model: Model, schedule: WeeklyRoutine, session: Session) {
  case model.step {
    ReviewFamilyPlan -> {
      let others =
        list.filter(model.weekly_routines, fn(other) {
          other.subject_allocation.id != schedule.subject_allocation.id
        })
      case
        scheduling.skip_session(
          schedule.sessions,
          session,
          schedule.tutor,
          scheduling.scheduled_sessions(others),
          now(),
          booking_calendar(),
          add_days,
        )
      {
        Error(issue) -> failure(model, issue)
        Ok(updated) -> {
          let schedules =
            list.map(model.weekly_routines, fn(item) {
              case
                item.subject_allocation.id == schedule.subject_allocation.id
              {
                True -> WeeklyRoutine(..item, sessions: updated)
                False -> item
              }
            })
          #(
            Model(
              ..model,
              weekly_routines: schedules,
              notice: Some(skip_notice(model, session, updated)),
              error: None,
            ),
            effect.none(),
          )
        }
      }
    }
    _ -> #(model, effect.none())
  }
}

fn prefer_tutor(model: Model, id: TutorId) {
  case model.step {
    BuildWeeklyRoutine(student, allocation, input) -> {
      case
        list.find(tutors(), fn(tutor) {
          tutor.id == id && list.contains(tutor.subjects, allocation.subject)
        })
      {
        Ok(tutor) -> #(
          Model(
            ..model,
            preferred_tutor_id: Some(id),
            step: BuildWeeklyRoutine(
              student,
              allocation,
              RoutineDraft(
                ..input,
                tutor: Some(tutor),
                sessions: [],
                first_planned_session: None,
              ),
            ),
          ),
          effect.none(),
        )
        Error(_) -> #(
          Model(..model, preferred_tutor_id: Some(id)),
          effect.none(),
        )
      }
    }
    _ -> #(Model(..model, preferred_tutor_id: Some(id)), effect.none())
  }
}

// Checkout

fn submit_contact(model: Model, contact: ContactInfo) {
  case model.step {
    EnterContactInfo -> {
      case
        checkout.confirm(
          model.package_hours,
          model.students,
          model.weekly_routines,
          contact,
          tutors(),
          now(),
          booking_calendar(),
          add_days,
          valid_date,
        )
      {
        Error(issue) -> failure(model, issue)
        Ok(order) ->
          move(
            Model(..model, contact: Some(contact)),
            PayForOrder(order, NotProcessing),
          )
      }
    }
    _ -> #(model, effect.none())
  }
}

fn submit_payment(model: Model, details: DemoPaymentDetails) {
  case model.step {
    PayForOrder(order, NotProcessing) -> {
      let #(year, month) = billing_month()
      case checkout.payment_issue(details, year, month) {
        "" -> #(
          Model(..model, step: PayForOrder(order, Processing), error: None),
          effect.from(fn(dispatch) {
            after_payment(dispatch, model.DemoPaymentFinished(order))
          }),
        )
        issue -> failure(model, issue)
      }
    }
    _ -> #(model, effect.none())
  }
}

fn finish_payment(model: Model, order: Order) {
  case model.step {
    PayForOrder(_, Processing) -> {
      case checkout.revalidate(order, tutors(), now(), booking_calendar()) {
        "" -> move(model, OrderComplete(order))
        issue -> #(
          Model(..model, step: ReviewFamilyPlan, error: Some(issue)),
          effect.from(fn(_) { scroll() }),
        )
      }
    }
    _ -> #(model, effect.none())
  }
}

// Shared helpers

fn move(model: Model, booking_step: BookingStep) {
  #(
    Model(..model, step: booking_step, error: None, notice: None),
    effect.from(fn(_) { scroll() }),
  )
}

fn failure(model: Model, message: ErrorMessage) {
  #(Model(..model, error: Some(message)), effect.none())
}

fn update_student(
  model: Model,
  id: String,
  change: fn(Student) -> Student,
) -> Model {
  let students =
    list.map(model.students, fn(student) {
      case student.id == id {
        True -> change(student)
        False -> student
      }
    })
  Model(..model, students:, error: None)
}

fn skip_notice(
  model: Model,
  original: Session,
  sessions: List(Session),
) -> NoticeMessage {
  let replacement = list.last(sessions) |> result.unwrap(original)
  "Skipped "
  <> session_label(original, model.time_zone)
  <> ". Replacement added at the end: "
  <> session_label(replacement, model.time_zone)
  <> ". Your total hours are unchanged."
}
