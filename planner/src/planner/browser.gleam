import gleam/option.{type Option}
import planner/model.{
  type Date, type Msg, type Session, type Student, type SubjectAllocation,
  type TimeChoice, type TimeZone, type TimeZoneQuery, type Tutor,
  type WeeklyRoutine,
}
import planner/scheduling.{type Calendar}

@external(javascript, "../planner_ffi.mjs", "zone")
pub fn browser_time_zone() -> Option(TimeZone)

@external(javascript, "../planner_ffi.mjs", "zones")
pub fn matching_zones(query: TimeZoneQuery, current: TimeZone) -> List(TimeZone)

@external(javascript, "../planner_ffi.mjs", "tomorrow")
pub fn tomorrow(time_zone: TimeZone) -> String

@external(javascript, "../planner_ffi.mjs", "randomUuid")
pub fn random_uuid() -> String

@external(javascript, "../planner_ffi.mjs", "subjects")
pub fn subjects() -> List(String)

@external(javascript, "../planner_ffi.mjs", "allTutors")
pub fn all_tutors() -> List(Tutor)

@external(javascript, "../planner_ffi.mjs", "choices")
pub fn choices(
  tutor: Tutor,
  student: Student,
  allocation: SubjectAllocation,
  date: String,
  time_zone: TimeZone,
  schedules: List(WeeklyRoutine),
) -> List(TimeChoice)

@external(javascript, "../planner_ffi.mjs", "sessionLabel")
pub fn session_label(session: Session, time_zone: TimeZone) -> String

@external(javascript, "../planner_ffi.mjs", "sessionDate")
pub fn session_date(session: Session, time_zone: TimeZone) -> String

@external(javascript, "../planner_ffi.mjs", "afterPayment")
pub fn after_payment(dispatch: fn(Msg) -> Nil, message: Msg) -> Nil

@external(javascript, "../planner_ffi.mjs", "scroll")
pub fn scroll() -> Nil

@external(javascript, "../planner_ffi.mjs", "print")
pub fn print_page() -> Nil

@external(javascript, "../planner_ffi.mjs", "listenForTutorCardClicks")
pub fn listen_for_tutor_card_clicks(
  dispatch: fn(Msg) -> Nil,
  message: fn(String) -> Msg,
) -> Nil

@external(javascript, "../planner_ffi.mjs", "installPaymentMasks")
pub fn install_payment_masks() -> Nil

@external(javascript, "../planner_ffi.mjs", "weekDates")
pub fn week_dates(first: String) -> List(#(String, String))

@external(javascript, "../planner_ffi.mjs", "bookingCalendar")
pub fn booking_calendar() -> Calendar

@external(javascript, "../planner_ffi.mjs", "now")
pub fn now() -> Int

@external(javascript, "../planner_ffi.mjs", "billingMonth")
pub fn billing_month() -> #(Int, Int)

@external(javascript, "../planner_ffi.mjs", "addDays")
pub fn add_days(date: Date, days: Int) -> Date

@external(javascript, "../planner_ffi.mjs", "validDate")
pub fn valid_date(date: Date) -> Bool

@external(javascript, "../planner_ffi.mjs", "formatMoney")
pub fn format_money(amount: Int) -> String

@external(javascript, "../planner_ffi.mjs", "instantLabel")
pub fn instant_label(instant: Int, time_zone: TimeZone) -> String
