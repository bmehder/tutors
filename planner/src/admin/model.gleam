import gleam/option.{type Option}

// Identifiers and units shared by the admin screens.
// Calendar dates and clock times are Eastern, formatted at the server boundary.
pub type TutorId =
  String

pub type BookingId =
  String

pub type SessionId =
  String

pub type Name =
  String

pub type Subject =
  String

pub type CalendarDate =
  String

pub type ClockTime =
  String

pub type MinutesAfterMidnight =
  Int

pub type FormFields =
  List(#(String, String))

pub type Money {
  Unrecorded
  Recorded(cents: Int)
}

// Loaded server records. Unrecorded payment amounts are not zero-dollar payments.
pub type Tutor {
  Tutor(
    id: TutorId,
    name: Name,
    subjects: List(Subject),
    archived: Bool,
    blocks: List(Block),
    meeting_instructions: String,
  )
}

pub type Block {
  Block(
    id: Int,
    day: Int,
    start: MinutesAfterMidnight,
    end: MinutesAfterMidnight,
  )
}

pub type Session {
  Session(
    id: SessionId,
    tutor: TutorId,
    subject: Subject,
    date: CalendarDate,
    time: ClockTime,
    label: String,
  )
}

pub type PaymentStatus {
  PendingPayment
  PaymentComplete
}

pub type ContactDetails {
  ContactNotRecorded
  ContactRecorded(email: String, phone: String)
}

pub type Booking {
  Booking(
    id: BookingId,
    name: Name,
    date: CalendarDate,
    hours: Int,
    subtotal: Money,
    discount: Money,
    sessions: List(Session),
    payment_status: PaymentStatus,
    contact_details: ContactDetails,
  )
}

pub type Data {
  Data(tutors: List(Tutor), bookings: List(Booking), subjects: List(String))
}

// Navigation and editing state. A schedule carries its draft and undo stack.
pub type Screen {
  Tutors
  AddTutor
  Subjects
  Schedule(tutor: Tutor, blocks: List(Block), removed: List(Block))
  Bookings
  Reports
}

pub type RequestState {
  Ready
  Saving(form_id: String)
  ConfirmingRemoval(Block)
  Removing(Block)
  ConfirmingNavigation(Screen)
}

pub type Model {
  Model(
    data: Data,
    form_drafts: List(#(String, FormFields)),
    screen: Screen,
    request: RequestState,
    message: String,
    subject_filter: String,
    report_from: String,
    report_to: String,
    failed_form: Option(String),
  )
}

// User events describe what happened; server events carry the refreshed records.
pub type Msg {
  UserClickedScreen(Screen)
  UserSelectedSubjectFilter(String)
  UserChangedReportFrom(String)
  UserChangedReportTo(String)
  UserClickedSchedule(Tutor)
  UserSelectedScheduleTutor(String)
  UserClickedAddBlock(Int)
  UserChangedBlockStart(Int, MinutesAfterMidnight)
  UserChangedBlockEnd(Int, MinutesAfterMidnight)
  UserClickedRemoveBlock(Block)
  UserClickedConfirmRemoval
  UserClickedCancelConfirmation
  UserClickedDiscardChanges
  RemovalAnimationFinished(Block)
  UserClickedUndo
  UserEditedForm(String, FormFields)
  UserSubmittedForm(String, TutorId, FormFields)
  ServerSaved(Data)
  ServerRejected(String)
}
