import gleam/int
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/order.{Lt}
import gleam/result
import gleam/string
import planner/model.{
  type Date, type Hours, type Session, type Student, type StudentId, type Tutor,
  type TutorAvailability, type TutorId, type WeeklyRoutine, Session,
}

pub fn tutor_hours_issue(
  availability: TutorAvailability,
  weekday: Int,
  start_minute: Int,
  session_end: Int,
  resolve_end: fn(Int) -> Option(Int),
) -> String {
  case
    list.contains(availability.weekdays, weekday)
    && list.contains(availability.start_minutes, start_minute)
  {
    False -> "This tutor is not available at this time."
    True -> {
      let last_start =
        list.fold(availability.start_minutes, start_minute, int.max)
      // The final listed start reserves an hour. Resolve its end on the
      // Eastern calendar before comparing it to the elapsed session end.
      case resolve_end(last_start + 60) {
        Some(available_end) if session_end <= available_end -> ""
        Some(_) | None ->
          "The full session does not fit this tutor’s availability."
      }
    }
  }
}

pub type BookingInterval {
  BookingInterval(
    session_id: String,
    student_id: StudentId,
    tutor_id: TutorId,
    start: Int,
    end: Int,
  )
}

pub fn booking_notice_satisfied(start: Int, now: Int, notice_ms: Int) -> Bool {
  notice_ms >= 0 && start >= now + notice_ms
}

pub fn conflict_issue(
  requested: BookingInterval,
  booked: List(BookingInterval),
  ignore_id: Option(String),
) -> String {
  let overlapping =
    list.filter(booked, fn(session) {
      Some(session.session_id) != ignore_id
      && requested.start < session.end
      && session.start < requested.end
    })
  case
    list.any(overlapping, fn(session) {
      session.student_id == requested.student_id
    })
  {
    True -> "This child already has a session at this time."
    False ->
      case
        list.any(overlapping, fn(session) {
          session.tutor_id == requested.tutor_id
        })
      {
        True -> "This tutor is already booked at this time."
        False -> ""
      }
  }
}

pub fn weekly_series(
  count: Int,
  session_in_week: fn(Int) -> session,
) -> List(session) {
  list.index_map(list.repeat(Nil, count), fn(_, week) { session_in_week(week) })
}

pub fn routine_series(
  first: Session,
  count: Int,
  add_days: fn(Date, Int) -> Date,
) -> List(Session) {
  weekly_series(count, fn(week) {
    Session(
      ..first,
      id: first.id <> "-" <> int.to_string(week),
      date: add_days(first.date, week * 7),
    )
  })
}

pub fn skip_session(
  sessions: List(Session),
  session: Session,
  tutor: Tutor,
  booked: List(Session),
  now: Int,
  calendar: Calendar,
  add_days: fn(Date, Int) -> Date,
) -> Result(List(Session), String) {
  replace_week(
    sessions,
    session.id,
    fn(item) { item.id },
    fn(item) { item.date },
    fn(target, last_date, week) {
      Session(..target, date: add_days(last_date, week * 7))
    },
    fn(candidate, kept) {
      session_issue(
        candidate,
        Some(tutor),
        True,
        list.append(booked, kept),
        now,
        calendar,
      )
      == ""
    },
  )
}

pub fn weekly_dates(
  count: Int,
  skipped: List(Date),
  date_in_week: fn(Int) -> Date,
) -> Result(List(Date), Nil) {
  case
    count >= 1
    && count <= 20
    && list.length(skipped) <= 52
    && list.length(list.unique(skipped)) == list.length(skipped)
  {
    False -> Error(Nil)
    True -> {
      let window = weekly_series(count + list.length(skipped), date_in_week)
      let dates =
        window
        |> list.filter(fn(date) { !list.contains(skipped, date) })
        |> list.take(count)
      case list.last(dates), list.length(dates) == count {
        Ok(last), True ->
          case
            list.all(skipped, fn(date) {
              string.compare(date, last) == Lt && list.contains(window, date)
            })
          {
            True -> Ok(dates)
            False -> Error(Nil)
          }
        _, _ -> Error(Nil)
      }
    }
  }
}

pub fn skipped_dates(
  first: Date,
  dates: List(Date),
  next_week: fn(Date) -> Date,
) -> List(Date) {
  case list.last(list.sort(dates, string.compare)) {
    Error(_) -> []
    Ok(last) -> collect_skipped_dates(first, last, dates, next_week, [])
  }
}

fn collect_skipped_dates(
  date: Date,
  last: Date,
  dates: List(Date),
  next_week: fn(Date) -> Date,
  skipped: List(Date),
) -> List(Date) {
  case string.compare(date, last) {
    Lt -> {
      let skipped = case list.contains(dates, date) {
        True -> skipped
        False -> [date, ..skipped]
      }
      collect_skipped_dates(next_week(date), last, dates, next_week, skipped)
    }
    _ -> list.reverse(skipped)
  }
}

pub fn replace_week(
  sessions: List(Session),
  session_id: String,
  id: fn(Session) -> String,
  date: fn(Session) -> Date,
  reschedule: fn(Session, Date, Int) -> Session,
  available: fn(Session, List(Session)) -> Bool,
) -> Result(List(Session), String) {
  let sorted =
    list.sort(sessions, fn(a, b) { string.compare(date(a), date(b)) })
  case
    list.find(sessions, fn(session) { id(session) == session_id }),
    list.last(sorted)
  {
    Ok(target), Ok(last) -> {
      let kept = list.filter(sorted, fn(session) { id(session) != session_id })
      find_replacement(target, date(last), kept, reschedule, available, 1)
    }
    _, _ -> Error("Choose a session to skip.")
  }
}

fn find_replacement(
  target: Session,
  last_date: Date,
  kept: List(Session),
  reschedule: fn(Session, Date, Int) -> Session,
  available: fn(Session, List(Session)) -> Bool,
  week: Int,
) -> Result(List(Session), String) {
  case week > 52 {
    True ->
      Error(
        "No matching week is available after this routine within the next 52 weeks. Contact support for help.",
      )
    False -> {
      let replacement = reschedule(target, last_date, week)
      case available(replacement, kept) {
        True -> Ok(list.append(kept, [replacement]))
        False ->
          find_replacement(
            target,
            last_date,
            kept,
            reschedule,
            available,
            week + 1,
          )
      }
    }
  }
}

pub type SessionTime {
  Resolved(start: Int, end: Int)
  NonexistentTime
  AmbiguousTime
  InvalidTime
}

pub type Calendar {
  Calendar(
    resolve: fn(Session) -> SessionTime,
    weekday: fn(Date) -> Int,
    end_instant: fn(Date, Int) -> Option(Int),
    label: fn(Session) -> String,
  )
}

pub fn session_issue(
  session: Session,
  tutor: Option(Tutor),
  student_exists: Bool,
  booked: List(Session),
  now: Int,
  calendar: Calendar,
) -> String {
  case student_exists, tutor {
    False, _ -> "Choose a child first."
    True, None -> "Choose a tutor and time."
    True, Some(tutor) ->
      case calendar.resolve(session) {
        NonexistentTime ->
          "This local time does not exist because the clocks change. Choose another time."
        AmbiguousTime ->
          "This local time occurs twice because the clocks change. Choose another time."
        InvalidTime -> "Choose a valid date and quarter-hour time."
        Resolved(start, end) ->
          resolved_session_issue(
            session,
            tutor,
            booked,
            now,
            calendar,
            start,
            end,
          )
      }
  }
}

fn resolved_session_issue(
  session: Session,
  tutor: Tutor,
  booked: List(Session),
  now: Int,
  calendar: Calendar,
  start: Int,
  end: Int,
) -> String {
  let notice_ms = 24 * 60 * 60 * 1000
  case
    booking_notice_satisfied(start, now, notice_ms),
    list.contains(tutor.subjects, session.subject)
  {
    False, _ ->
      "Choose a future date and time outside the 24-hour booking notice."
    True, False -> "This tutor does not teach this subject for this subject."
    True, True -> {
      let hours_issue =
        tutor_hours_issue(
          tutor.availability,
          calendar.weekday(session.date),
          session.start,
          end,
          calendar.end_instant(session.date, _),
        )
      case hours_issue {
        "" -> {
          let intervals =
            list.filter_map(booked, fn(other) {
              case calendar.resolve(other) {
                Resolved(start, end) -> Ok(booking_interval(other, start, end))
                _ -> Error(Nil)
              }
            })
          case
            conflict_issue(
              booking_interval(session, start, end),
              intervals,
              None,
            )
          {
            "" ->
              case sold_out(session) {
                True -> "This time is sold out."
                False -> ""
              }
            issue -> issue
          }
        }
        issue -> issue
      }
    }
  }
}

fn booking_interval(session: Session, start: Int, end: Int) -> BookingInterval {
  BookingInterval(session.id, session.student_id, session.tutor_id, start, end)
}

fn sold_out(session: Session) -> Bool {
  let key =
    session.tutor_id
    <> ":"
    <> session.date
    <> ":"
    <> int.to_string(session.start)
  let hash =
    string.to_utf_codepoints(key)
    |> list.fold(0, fn(hash, char) {
      // Match the demo catalog's unsigned 32-bit hash.
      let codepoint = string.utf_codepoint_to_int(char)
      let code_unit = case codepoint > 65_535 {
        True -> 55_296 + { codepoint - 65_536 } / 1024
        False -> codepoint
      }
      { hash * 31 + code_unit } % 4_294_967_296
    })
  hash % 7 == 0
}

pub fn series_issue(
  sessions: List(Session),
  tutor: Tutor,
  booked: List(Session),
  now: Int,
  calendar: Calendar,
) -> String {
  list.find_map(sessions, fn(session) {
    case session_issue(session, Some(tutor), True, booked, now, calendar) {
      "" -> Error(Nil)
      issue -> Ok(issue)
    }
  })
  |> result.unwrap("")
}

pub fn plan_issue(
  sessions: List(Session),
  students: List(Student),
  tutors: List(Tutor),
  package_hours: Hours,
  now: Int,
  calendar: Calendar,
) -> String {
  let minutes =
    list.fold(sessions, 0, fn(total, session) { total + session.duration })
  case sessions, minutes > package_hours * 60 {
    [], _ -> "Add at least one session to your family plan."
    _, True -> "Your plan has more sessions than your package can cover."
    _, False ->
      case
        list.try_fold(sessions, [], fn(booked, session) {
          case
            list.contains([30, 45, 60, 90], session.duration)
            && session.id != ""
            && session.student_id != ""
          {
            False -> Error("Check the session details.")
            True -> {
              let tutor =
                list.find(tutors, fn(tutor) { tutor.id == session.tutor_id })
                |> option.from_result
              let student_exists =
                list.any(students, fn(student) {
                  student.id == session.student_id
                })
              case
                session_issue(
                  session,
                  tutor,
                  student_exists,
                  booked,
                  now,
                  calendar,
                )
              {
                "" -> Ok([session, ..booked])
                issue -> Error(calendar.label(session) <> ": " <> issue)
              }
            }
          }
        })
      {
        Ok(_) -> ""
        Error(issue) -> issue
      }
  }
}

pub fn scheduled_sessions(routines: List(WeeklyRoutine)) -> List(Session) {
  list.flat_map(routines, fn(routine) { routine.sessions })
}

pub fn schedule_issue(
  sessions: List(Session),
  routines: List(WeeklyRoutine),
  students: List(Student),
  tutors: List(Tutor),
  hours: Hours,
  now: Int,
  calendar: Calendar,
) -> String {
  plan_issue(
    list.append(scheduled_sessions(routines), sessions),
    students,
    tutors,
    hours,
    now,
    calendar,
  )
}
