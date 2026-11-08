module Domain exposing
    ( Catalog
    , Context
    , Duration(..)
    , Error(..)
    , FixtureTime
    , Lesson
    , Package(..)
    , Plan
    , Schedule
    , Session(..)
    , StudentId
    , SubjectId
    , Tutor
    , TutorId
    , Window
    , addPlan
    , customize
    , durationMinutes
    , fixtureTime
    , lessons
    , oneLesson
    , plans
    , remainingMinutes
    , schedule
    , sessions
    , studentId
    , subjectId
    , tutorId
    , usedMinutes
    , weekly
    )

-- This laboratory tests the domain, not the application's calendar adapter.
-- FixtureTime is an Eastern wall-clock minute offset from a fixture Monday.
-- It must not be used as a production instant or across daylight-saving changes.


type Package
    = FiveHours
    | TenHours
    | TwentyHours


type Duration
    = ThirtyMinutes
    | FortyFiveMinutes
    | OneHour
    | NinetyMinutes


type StudentId
    = StudentId Int


type TutorId
    = TutorId Int


type SubjectId
    = SubjectId Int


type FixtureTime
    = FixtureTime Int


type alias Lesson =
    { student : StudentId
    , tutor : TutorId
    , subject : SubjectId
    , start : FixtureTime
    , duration : Duration
    }


type alias Tutor =
    { id : TutorId, subjects : List SubjectId, availability : List Window }


type alias Window =
    { start : FixtureTime, end : FixtureTime }


type alias Catalog =
    { students : List StudentId, tutors : List Tutor, subjects : List SubjectId }


type alias Context =
    { catalog : Catalog, reserved : List Lesson, now : FixtureTime, noticeMinutes : Int }


type Session
    = DefaultSession
    | CustomizedSession Lesson


type Sessions
    = Sessions Session (List Session)


type Plan
    = OneLesson Lesson
    | WeeklyLessons { first : Lesson, sessions : Sessions }


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
    | SessionOutOfRange
    | UnknownPlan


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


durationMinutes duration =
    case duration of
        ThirtyMinutes ->
            30

        FortyFiveMinutes ->
            45

        OneHour ->
            60

        NinetyMinutes ->
            90


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


oneLesson =
    OneLesson


weekly first count =
    if count < 1 then
        Err InvalidValue

    else
        Ok (WeeklyLessons { first = first, sessions = Sessions DefaultSession (List.repeat (count - 1) DefaultSession) })


sessionList (Sessions first rest) =
    first :: rest


sessions plan =
    case plan of
        OneLesson _ ->
            []

        WeeklyLessons routine ->
            sessionList routine.sessions


defaultOccurrence first index =
    { first | start = FixtureTime (minutes first.start + index * 7 * 1440) }


lessons plan =
    case plan of
        OneLesson lesson ->
            [ lesson ]

        WeeklyLessons routine ->
            sessionList routine.sessions
                |> List.indexedMap
                    (\index session ->
                        case session of
                            DefaultSession ->
                                defaultOccurrence routine.first index

                            CustomizedSession replacement ->
                                replacement
                    )


plans (Schedule _ values) =
    values


usedMinutes (Schedule _ values) =
    values |> List.concatMap lessons |> List.map (.duration >> durationMinutes) |> List.sum


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
        + durationMinutes b.duration
        && minutes b.start
        < minutes a.start
        + durationMinutes a.duration


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

                else if not (List.any (\window -> minutes window.start <= minutes lesson.start && minutes lesson.start + durationMinutes lesson.duration <= minutes window.end) tutor.availability) then
                    Err OutsideAvailability

                else
                    conflicts lesson existing


validateExisting context ((Schedule package values) as value) =
    let
        actual =
            List.concatMap lessons values
    in
    if usedMinutes value > capacity package then
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
    validateExisting context value |> Result.andThen (\valid -> checkNotice context (List.concatMap lessons values) |> Result.map (\_ -> valid))


addPlan context plan ((Schedule package values) as original) =
    validateExisting context (Schedule package (values ++ [ plan ]))
        |> Result.andThen (\valid -> checkNotice context (lessons plan) |> Result.map (\_ -> valid))



-- Indexes are original occurrence positions, never chronological display order.
-- Revalidate changed starts for notice, without expiring accepted unchanged lessons.


customize context planIndex occurrence replacement (Schedule package values) =
    if planIndex < 0 || occurrence < 0 then
        Err SessionOutOfRange

    else
        case List.drop planIndex values |> List.head of
            Nothing ->
                Err UnknownPlan

            Just plan ->
                let
                    finish updated =
                        validateExisting context
                            (Schedule package
                                (List.indexedMap
                                    (\i previous ->
                                        if i == planIndex then
                                            updated

                                        else
                                            previous
                                    )
                                    values
                                )
                            )
                            |> Result.andThen
                                (\valid ->
                                    (case List.drop occurrence (lessons plan) |> List.head of
                                        Just previous ->
                                            if previous.start == replacement.start && previous.tutor == replacement.tutor then
                                                Ok ()

                                            else
                                                checkNotice context [ replacement ]

                                        Nothing ->
                                            Err SessionOutOfRange
                                    )
                                        |> Result.map (\_ -> valid)
                                )
                in
                case plan of
                    OneLesson _ ->
                        if occurrence /= 0 then
                            Err SessionOutOfRange

                        else
                            finish (OneLesson replacement)

                    WeeklyLessons routine ->
                        let
                            originalSessions =
                                sessionList routine.sessions
                        in
                        if occurrence >= List.length originalSessions then
                            Err SessionOutOfRange

                        else
                            let
                                state =
                                    if replacement == defaultOccurrence routine.first occurrence then
                                        DefaultSession

                                    else
                                        CustomizedSession replacement

                                updated =
                                    List.indexedMap
                                        (\i previous ->
                                            if i == occurrence then
                                                state

                                            else
                                                previous
                                        )
                                        originalSessions
                            in
                            case updated of
                                first :: rest ->
                                    finish (WeeklyLessons { routine | sessions = Sessions first rest })

                                [] ->
                                    Err InvalidValue
