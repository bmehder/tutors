module Domain exposing
    ( ConfirmedOrder, Contact, confirmOrder, orderSchedule, orderContact, orderStudents, BookingDraft, StudentDraft, Catalog, Context, Error(..), FixtureTime, Session
    , Package(..), Plan, Schedule, StudentId, SubjectId, Tutor, TutorId, Window
    , addPlan, fixtureTime, sessions, plans, remainingMinutes, schedule
    , studentId, subjectId, tutorId, usedMinutes, weekly
    , bookingDraft, changePackage, draftPackage, allocations, setAllocations, complete
    )

-- This laboratory tests the domain, not the application's calendar adapter.
-- FixtureTime is an Eastern wall-clock minute offset from a fixture Monday.
-- It must not be used as a production instant or across daylight-saving changes.


type Package
    = FiveHours
    | TenHours
    | TwentyHours


type StudentId
    = StudentId Int


type TutorId
    = TutorId Int


type SubjectId
    = SubjectId Int


type FixtureTime
    = FixtureTime Int


type alias Session =
    { student : StudentId
    , tutor : TutorId
    , subject : SubjectId
    , start : FixtureTime
    }


type alias Tutor =
    { id : TutorId, subjects : List SubjectId, availability : List Window }


type alias Window =
    { start : FixtureTime, end : FixtureTime }


type alias Catalog =
    { students : List StudentId, tutors : List Tutor, subjects : List SubjectId }


type alias Context =
    { catalog : Catalog, reserved : List Session, now : FixtureTime, noticeMinutes : Int }


-- Opaque: only weekly can construct a positive, fixed-hour routine.
type Plan
    = WeeklyRoutine Session Int


type BookingDraft
    = BookingDraft Package (List StudentDraft)


type alias StudentDraft =
    { id : StudentId, name : String, hours : Int, routines : List Plan }


type Schedule
    = Schedule Package (List Plan)


type Error
    = InvalidValue
    | OverBudget
    | TooManyStudents
    | UnknownStudent
    | UnknownTutor
    | UnknownSubject
    | UnsupportedSubject
    | OutsideAvailability
    | TooSoon
    | StudentOverlap
    | TutorOverlap
    | IncompleteDraft
    | AllocationMismatch
    | DuplicateSubject


studentId n =
    if n > 0 then
        Just (StudentId n)

    else
        Nothing


tutorId n =
    if n > 0 then
        Just (TutorId n)

    else
        Nothing


subjectId n =
    if n > 0 then
        Just (SubjectId n)

    else
        Nothing


fixtureTime day hour minute =
    if day >= 0 && hour >= 0 && hour < 24 && List.member minute [ 0, 15, 30, 45 ] then
        Just (FixtureTime (day * 1440 + hour * 60 + minute))

    else
        Nothing


minutes (FixtureTime n) =
    n


capacity package =
    case package of
        FiveHours ->
            300

        TenHours ->
            600

        TwentyHours ->
            1200


studentLimit package =
    case package of
        FiveHours ->
            1

        TenHours ->
            3

        TwentyHours ->
            5


weekly first count =
    if count < 1 then
        Err InvalidValue
    else
        Ok (WeeklyRoutine first count)


sessions (WeeklyRoutine first count) =
    List.range 0 (count - 1)
        |> List.map (\index -> { first | start = FixtureTime (minutes first.start + index * 7 * 1440) })


plans (Schedule _ values) =
    values


usedMinutes (Schedule _ values) =
    values |> List.concatMap sessions |> List.map (always 60) |> List.sum


remainingMinutes ((Schedule package _) as value) =
    capacity package - usedMinutes value


unique values =
    List.foldl
        (\value acc ->
            if List.member value acc then
                acc

            else
                value :: acc
        )
        []
        values


overlap a b =
    minutes a.start
        < minutes b.start
        + 60
        && minutes b.start
        < minutes a.start
        + 60


conflicts lesson existing =
    let
        overlapping =
            List.filter (overlap lesson) existing
    in
    if List.any (\other -> other.student == lesson.student) overlapping then
        Err StudentOverlap

    else if List.any (\other -> other.tutor == lesson.tutor) overlapping then
        Err TutorOverlap

    else
        Ok ()


validateLesson context existing lesson =
    if not (List.member lesson.student context.catalog.students) then
        Err UnknownStudent

    else if not (List.member lesson.subject context.catalog.subjects) then
        Err UnknownSubject

    else
        case List.filter (\tutor -> tutor.id == lesson.tutor) context.catalog.tutors |> List.head of
            Nothing ->
                Err UnknownTutor

            Just tutor ->
                if not (List.member lesson.subject tutor.subjects) then
                    Err UnsupportedSubject

                else if not (List.any (\window -> minutes window.start <= minutes lesson.start && minutes lesson.start + 60 <= minutes window.end) tutor.availability) then
                    Err OutsideAvailability

                else
                    conflicts lesson existing


validateExisting context ((Schedule package values) as value) =
    let
        actual =
            List.concatMap sessions values
    in
    if List.length (unique (List.map .id context.catalog.tutors)) /= List.length context.catalog.tutors || List.length (unique context.catalog.students) /= List.length context.catalog.students || List.length (unique context.catalog.subjects) /= List.length context.catalog.subjects || List.any (\t -> List.any (\w -> minutes w.start >= minutes w.end) t.availability) context.catalog.tutors then
        Err InvalidValue
    else if List.length (unique (List.map (\(WeeklyRoutine first _) -> (first.student, first.subject)) values)) /= List.length values then
        Err DuplicateSubject
    else if usedMinutes value > capacity package then
        Err OverBudget

    else if List.length (unique (List.map .student actual)) > studentLimit package then
        Err TooManyStudents

    else
        List.foldl (\lesson result -> result |> Result.andThen (\accepted -> validateLesson context (context.reserved ++ accepted) lesson |> Result.map (\_ -> lesson :: accepted))) (Ok []) actual |> Result.map (\_ -> value)


checkNotice context actual =
    if context.noticeMinutes < 0 then
        Err InvalidValue

    else if List.any (\lesson -> minutes lesson.start < minutes context.now + context.noticeMinutes) actual then
        Err TooSoon

    else
        Ok ()


schedule context package values =
    let
        value =
            Schedule package values
    in
    (if List.isEmpty values then Err IncompleteDraft else validateExisting context value) |> Result.andThen (\valid -> checkNotice context (List.concatMap sessions values) |> Result.map (\_ -> valid))


addPlan context plan ((Schedule package values) as original) =
    validateExisting context (Schedule package (values ++ [ plan ]))
        |> Result.andThen (\valid -> checkNotice context (sessions plan) |> Result.map (\_ -> valid))



bookingDraft package =
    BookingDraft package []


changePackage package ((BookingDraft previous _) as original) =
    if package == previous then original else bookingDraft package


draftPackage (BookingDraft package _) =
    package


allocations (BookingDraft _ students) =
    students


setAllocations students (BookingDraft package _) =
    if List.length students > studentLimit package then
        Err TooManyStudents
    else if List.any (\s -> s.hours < 1) students || List.length (unique (List.map .id students)) /= List.length students then
        Err InvalidValue
    else if List.sum (List.map .hours students) * 60 > capacity package then
        Err OverBudget
    else if List.any (\s -> List.length (unique (List.map (\(WeeklyRoutine first _) -> first.subject) s.routines)) /= List.length s.routines) students then
        Err DuplicateSubject
    else if List.any (\s -> List.any (\p -> List.any (\session -> session.student /= s.id) (sessions p)) s.routines || List.length (List.concatMap sessions s.routines) > s.hours) students then
        Err AllocationMismatch
    else
        Ok (BookingDraft package students)


complete context (BookingDraft package students) =
    if List.isEmpty students || List.any (\s -> String.isEmpty (String.trim s.name) || List.isEmpty s.routines) students then
        Err IncompleteDraft
    else if List.any (\s -> List.length (List.concatMap sessions s.routines) /= s.hours) students then
        Err AllocationMismatch
    else
        schedule context package (List.concatMap .routines students)


-- A schedule is not an order: retain the named roster and contact at checkout.
type ConfirmedOrder
    = ConfirmedOrder Contact (List { id : StudentId, name : String }) Schedule


type alias Contact =
    { name : String, email : String }


confirmOrder context contact ((BookingDraft _ students) as draft) =
    if String.isEmpty (String.trim contact.name) || not (String.contains "@" contact.email) || String.contains " " contact.email then
        Err InvalidValue
    else
        complete context draft |> Result.map (ConfirmedOrder contact (List.map (\s -> { id = s.id, name = String.trim s.name }) students))


orderSchedule (ConfirmedOrder _ _ value) =
    value


orderContact (ConfirmedOrder contact _ _) =
    contact


orderStudents (ConfirmedOrder _ students _) =
    students
