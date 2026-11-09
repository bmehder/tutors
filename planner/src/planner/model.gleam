import gleam/option.{type Option}

// Planner state and booking flow

pub type Model {
  Model(
    step: BookingStep,
    package_hours: Hours,
    student_count: StudentCount,
    students: List(Student),
    weekly_routines: List(WeeklyRoutine),
    time_zone: TimeZone,
    time_zone_query: Option(TimeZoneQuery),
    preferred_tutor_id: Option(TutorId),
    error: Option(ErrorMessage),
    notice: Option(NoticeMessage),
    contact: Option(ContactInfo),
  )
}

pub type BookingStep {
  ChoosePackage
  ChooseStudentCount
  AllocateHours
  BuildWeeklyRoutine(Student, SubjectAllocation, RoutineDraft)
  ReviewFamilyPlan
  EnterContactInfo
  PayForOrder(Order, PaymentState)
  OrderComplete(Order)
}

// Messages

pub type Msg {
  UserSelectedPackage(Hours)
  UserChangedStudentCount(StudentCount)
  UserClickedNext
  UserClickedStep(BookingStep)
  UserEnteredStudentName(StudentId, Name)
  UserChangedStudentHours(StudentId, Hours)
  UserSelectedSubject(StudentId, AllocationId, Subject)
  UserChangedSubjectHours(StudentId, AllocationId, Hours)
  UserClickedAddSubject(StudentId)
  UserClickedRemoveSubject(StudentId, AllocationId)
  UserSelectedTutor(TutorId)
  UserChangedFirstDate(Date)
  UserComparedDate(Date)
  UserSelectedWeeklyTime(List(Session))
  UserClickedSaveSchedule
  UserClickedSkipWeekInDraft(Session)
  UserClickedSkipWeekInReview(WeeklyRoutine, Session)
  UserClickedEditSchedule(WeeklyRoutine)
  UserClickedChangeTimeZone
  UserSearchedTimeZones(TimeZoneQuery)
  UserSelectedTimeZone(TimeZone)
  UserClickedTutorAvailability(TutorId)
  UserSubmittedContact(ContactInfo)
  UserToggledDemoDiscount
  UserSubmittedPayment(DemoPaymentDetails)
  DemoPaymentFinished(Order)
  UserClickedPrint
}

// Students, tutors, and hour allocations

pub type Student {
  Student(
    id: StudentId,
    name: Name,
    allocated_hours: Hours,
    subject_allocations: List(SubjectAllocation),
  )
}

pub type SubjectAllocation {
  SubjectAllocation(id: AllocationId, subject: Subject, hours: Hours)
}

pub type Tutor {
  Tutor(
    id: TutorId,
    name: Name,
    subjects: List(Subject),
    availability: TutorAvailability,
  )
}

// Weekly routines and time choices

pub type TutorAvailability {
  // Weekdays and start minutes are expressed in the tutor’s Eastern calendar.
  TutorAvailability(weekdays: List(Int), start_minutes: List(Int))
}

pub type WeeklyRoutine {
  WeeklyRoutine(
    student: Student,
    subject_allocation: SubjectAllocation,
    tutor: Tutor,
    sessions: List(Session),
    first_planned_session: Session,
  )
}

pub type RoutineDraft {
  RoutineDraft(
    tutor: Option(Tutor),
    date: Date,
    anchor: Date,
    sessions: List(Session),
    first_planned_session: Option(Session),
  )
}

pub type TimeChoice {
  TimeChoice(label: Label, availability: Availability, sessions: List(Session))
}

pub type Availability {
  Available
  Unavailable(reason: String)
}

pub type Session {
  Session(
    id: String,
    student_id: StudentId,
    tutor_id: TutorId,
    subject: Subject,
    date: Date,
    start: Int,
    duration: Int,
  )
}

// Checkout

pub type ContactInfo {
  ContactInfo(name: Name, email: Email)
}

pub type DemoPaymentDetails {
  DemoPaymentDetails(
    card_number: String,
    expiry: String,
    security_code: String,
    billing_name: Name,
    postal_code: String,
  )
}

pub type PaymentState {
  NotProcessing
  Processing
}

pub type ConfirmedSession {
  ConfirmedSession(session: Session, start_instant: Int, end_instant: Int)
}

pub type Discount {
  Discount(amount: Int)
}

pub type Order {
  Order(
    package_hours: Hours,
    contact: ContactInfo,
    students: List(Student),
    sessions: List(ConfirmedSession),
    tutors: List(Tutor),
    discount: Option(Discount),
  )
}

// Type aliases

pub type StudentId =
  String

pub type AllocationId =
  String

pub type TutorId =
  String

pub type Subject =
  String

pub type Hours =
  Int

pub type Name =
  String

pub type Email =
  String

pub type Date =
  String

pub type TimeZone =
  String

pub type Label =
  String

pub type StudentCount =
  Int

pub type TimeZoneQuery =
  String

pub type ErrorMessage =
  String

pub type NoticeMessage =
  String
