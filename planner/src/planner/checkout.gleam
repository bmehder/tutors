import gleam/int
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/result
import gleam/string
import planner/allocation.{allocation_issue, student_limit}
import planner/model.{
  type ContactInfo, type Date, type DemoPaymentDetails, type Discount,
  type Hours, type Order, type Session, type Student, type Tutor,
  type WeeklyRoutine, ConfirmedSession, ContactInfo, Discount, Order, Session,
}
import planner/scheduling.{
  type Calendar, Resolved, plan_issue, skipped_dates, weekly_dates,
}

pub fn confirm(
  hours: Hours,
  students: List(Student),
  routines: List(WeeklyRoutine),
  contact: ContactInfo,
  tutors: List(Tutor),
  now: Int,
  calendar: Calendar,
  add_days: fn(Date, Int) -> Date,
  valid_date: fn(Date) -> Bool,
) -> Result(Order, String) {
  let contact =
    ContactInfo(string.trim(contact.name), string.trim(contact.email))
  use _ <- result.try(check_draft(hours, students, routines, contact, tutors))
  let allocations =
    list.flat_map(students, fn(student) {
      list.map(student.subject_allocations, fn(allocation) {
        #(student.id, allocation)
      })
    })
  use sessions <- result.try(
    list.try_map(routines, fn(routine) {
      let matching =
        list.any(allocations, fn(entry) {
          let #(student_id, allocation) = entry
          student_id == routine.student.id
          && allocation == routine.subject_allocation
        })
      case matching {
        False ->
          Error(
            "The weekly routine must match its student and subject allocation.",
          )
        True -> routine_sessions(routine, add_days, valid_date)
      }
    })
    |> result.map(list.flatten),
  )
  use resolved <- result.try(
    list.try_map(sessions, fn(session) {
      case calendar.resolve(session) {
        Resolved(start, end) -> Ok(ConfirmedSession(session, start, end))
        _ -> Error("Choose a time outside a clock-change gap or repeated hour.")
      }
    }),
  )
  case plan_issue(sessions, students, tutors, hours, now, calendar) {
    "" -> {
      let booked_tutors =
        list.filter(tutors, fn(tutor) {
          list.any(sessions, fn(session) { session.tutor_id == tutor.id })
        })
      Ok(Order(hours, contact, students, resolved, booked_tutors, None))
    }
    issue -> Error(issue)
  }
}

fn check_draft(
  hours: Hours,
  students: List(Student),
  routines: List(WeeklyRoutine),
  contact: ContactInfo,
  tutors: List(Tutor),
) -> Result(Nil, String) {
  use _ <- result.try(require(
    student_limit(hours) > 0,
    "Choose a supported package.",
  ))
  use _ <- result.try(require(
    unique(list.map(tutors, fn(tutor) { tutor.id })),
    "Tutor identifiers must be unique.",
  ))
  use _ <- result.try(case allocation_issue(students, hours) {
    None -> Ok(Nil)
    Some(issue) -> Error(issue)
  })
  use _ <- result.try(require(!list.is_empty(students), "Add a student."))
  use _ <- result.try(require(
    contact.name != "" && valid_email(contact.email),
    "Enter a contact name and valid email.",
  ))
  use _ <- result.try(require(
    unique(list.map(students, fn(student) { student.id })),
    "Student identifiers must be unique.",
  ))
  let allocation_ids =
    list.flat_map(students, fn(student) {
      list.map(student.subject_allocations, fn(allocation) { allocation.id })
    })
  use _ <- result.try(require(
    unique(allocation_ids),
    "Subject allocation identifiers must be unique.",
  ))
  require(
    list.length(routines) == list.length(allocation_ids)
      && unique(
      list.map(routines, fn(routine) { routine.subject_allocation.id }),
    ),
    "Choose one weekly routine for each subject.",
  )
}

fn require(condition: Bool, message: String) -> Result(Nil, String) {
  case condition {
    True -> Ok(Nil)
    False -> Error(message)
  }
}

fn unique(values: List(a)) -> Bool {
  list.length(values) == list.length(list.unique(values))
}

fn valid_email(email: String) -> Bool {
  let no_whitespace =
    string.to_graphemes(email)
    |> list.all(fn(char) { string.trim(char) != "" })
  case no_whitespace, string.split_once(string.drop_start(email, 1), "@") {
    True, Ok(#(_, domain)) ->
      case string.split_once(string.drop_start(domain, 1), ".") {
        Ok(#(_, suffix)) -> suffix != ""
        Error(_) -> False
      }
    _, _ -> False
  }
}

fn routine_sessions(
  routine: WeeklyRoutine,
  add_days: fn(Date, Int) -> Date,
  valid_date: fn(Date) -> Bool,
) -> Result(List(Session), String) {
  let first = routine.first_planned_session
  let allocation = routine.subject_allocation
  use _ <- result.try(require(
    routine.tutor.id != ""
      && allocation.hours > 0
      && first.start >= 0
      && first.start < 1440
      && first.start % 15 == 0,
    "Choose a tutor, quarter-hour time, and positive session count.",
  ))
  use _ <- result.try(require(
    valid_date(first.date),
    "Choose a valid first date.",
  ))
  let skipped =
    skipped_dates(
      first.date,
      list.map(routine.sessions, fn(session) { session.date }),
      add_days(_, 7),
    )
  use dates <- result.try(
    weekly_dates(allocation.hours, skipped, fn(week) {
      add_days(first.date, week * 7)
    })
    |> result.replace_error("Check the skipped weeks in this routine."),
  )
  Ok(
    list.index_map(dates, fn(date, index) {
      Session(
        allocation.id <> "-" <> int.to_string(index),
        routine.student.id,
        routine.tutor.id,
        allocation.subject,
        date,
        first.start,
        60,
      )
    }),
  )
}

pub fn revalidate(
  order: Order,
  tutors: List(Tutor),
  now: Int,
  calendar: Calendar,
) -> String {
  plan_issue(
    list.map(order.sessions, fn(confirmed) { confirmed.session }),
    order.students,
    tutors,
    order.package_hours,
    now,
    calendar,
  )
}

pub fn hourly_rate(hours: Hours) -> Int {
  case hours {
    5 -> 80
    10 -> 75
    20 -> 70
    _ -> 0
  }
}

pub fn package_total(hours: Hours) -> Int {
  hours * hourly_rate(hours)
}

pub fn demo_discount(hours: Hours) -> Discount {
  Discount(package_total(hours) * 20 / 100)
}

pub fn discount_amount(hours: Hours, discount: Option(Discount)) -> Int {
  case discount {
    None -> 0
    Some(discount) ->
      int.clamp(discount.amount, min: 0, max: package_total(hours))
  }
}

pub fn order_total(order: Order) -> Int {
  package_total(order.package_hours)
  - discount_amount(order.package_hours, order.discount)
}

pub fn payment_issue(
  details: DemoPaymentDetails,
  year: Int,
  month: Int,
) -> String {
  case string.slice(digits(details.card_number), 0, 16) == "4242424242424242" {
    False -> "For this demo, use card number 4242 4242 4242 4242."
    True -> {
      let expiry = string.slice(digits(details.expiry), 0, 4)
      let expiry_month = int.parse(string.slice(expiry, 0, 2))
      let expiry_year = int.parse(string.slice(expiry, 2, 2))
      case expiry_month, expiry_year {
        Ok(m), Ok(y)
          if m >= 1 && m <= 12 && { 2000 + y } * 12 + m >= year * 12 + month
        ->
          case string.length(expiry) == 4 {
            True -> billing_issue(details)
            False -> "Enter a future expiry date as MM / YY."
          }
        _, _ -> "Enter a future expiry date as MM / YY."
      }
    }
  }
}

fn billing_issue(details: DemoPaymentDetails) -> String {
  case
    string.length(details.security_code) == 3
    && digits(details.security_code) == details.security_code
    && string.trim(details.billing_name) != ""
    && string.trim(details.postal_code) != ""
  {
    True -> ""
    False -> "Add the name, a three-digit security code, and a postal code."
  }
}

fn digits(value: String) -> String {
  string.to_graphemes(value)
  |> list.filter(fn(char) {
    list.contains(string.to_graphemes("0123456789"), char)
  })
  |> string.concat
}
