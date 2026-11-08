port module Scenarios exposing (main)

import Domain exposing (..)
import Json.Encode as E
import Platform


port report : E.Value -> Cmd msg



-- All fixture dates are in January/February 2027; no clock transition occurs.
-- Day zero is Monday. These identifiers and times are test data, not allocation APIs.


expectJust value =
    case value of
        Just fixture ->
            fixture

        Nothing ->
            Debug.todo "Invalid test fixture"


emma =
    studentId 1 |> expectJust


jack =
    studentId 2 |> expectJust


sarah =
    tutorId 1 |> expectJust


daniel =
    tutorId 2 |> expectJust


math =
    subjectId 1 |> expectJust


science =
    subjectId 2 |> expectJust


time day hour minute =
    fixtureTime day hour minute |> expectJust


first =
    { student = emma, tutor = sarah, subject = math, start = time 7 15 0, duration = OneHour }


brother =
    { first | student = jack, tutor = daniel }


windows =
    List.range 1 80 |> List.map (\day -> { start = time day 8 0, end = time day 22 0 })


context =
    { catalog =
        { students = [ emma, jack, sid 3, sid 4, sid 5, sid 6 ]
        , subjects = [ math, science ]
        , tutors = [ { id = sarah, subjects = [ math ], availability = windows }, { id = daniel, subjects = [ math, science ], availability = windows } ]
        }
    , reserved = []
    , now = time 0 0 0
    , noticeMinutes = 1440
    }


sid n =
    studentId n |> expectJust


routine count lesson =
    weekly lesson count


family =
    Result.map2 (\a b -> [ a, b ]) (routine 6 first) (routine 4 brother) |> Result.andThen (schedule context TenHours)


check name passed =
    ( name, passed )


isErr expected result =
    case result of
        Err actual ->
            expected == actual

        Ok _ ->
            False


checks =
    [ check "Emma six + Jack four = 600 minutes, no remaining credit" (family |> Result.map (\s -> usedMinutes s == 600 && remainingMinutes s == 0) |> Result.withDefault False)
    , check "third occurrence moves without shifting any other defaults" (family |> Result.andThen (customize context 0 2 { first | start = time 22 15 0 }) |> Result.map (\s -> List.head (plans s) |> Maybe.map (\p -> List.map .start (lessons p) == [ time 7 15 0, time 14 15 0, time 22 15 0, time 28 15 0, time 35 15 0, time 42 15 0 ]) |> Maybe.withDefault False) |> Result.withDefault False)
    , check "changing first occurrence leaves later Mondays unchanged" (family |> Result.andThen (customize context 0 0 { first | start = time 8 15 0 }) |> Result.map (\s -> List.head (plans s) |> Maybe.map (\p -> List.map .start (lessons p) |> List.drop 1 |> (==) [ time 14 15 0, time 21 15 0, time 28 15 0, time 35 15 0, time 42 15 0 ]) |> Maybe.withDefault False) |> Result.withDefault False)
    , check "restoring a default removes the customization state" (family |> Result.andThen (customize context 0 0 { first | start = time 8 15 0 }) |> Result.andThen (customize context 0 0 first) |> Result.map (\s -> List.head (plans s) |> Maybe.map (sessions >> List.all ((==) DefaultSession)) |> Maybe.withDefault False) |> Result.withDefault False)
    , check "six 45-minute sessions cost 270 minutes" (routine 6 { first | duration = FortyFiveMinutes } |> Result.andThen (\p -> schedule context FiveHours [ p ]) |> Result.map (usedMinutes >> (==) 270) |> Result.withDefault False)
    , check "eight scheduled hours may leave two unused" (routine 8 first |> Result.andThen (\p -> schedule context TenHours [ p ]) |> Result.map (remainingMinutes >> (==) 120) |> Result.withDefault False)
    , check "90-minute replacement rejects a full package; original remains valid" (family |> Result.map (\s -> isErr OverBudget (customize context 0 0 { first | duration = NinetyMinutes } s) && usedMinutes s == 600) |> Result.withDefault False)
    , check "ten-hour package rejects a fourth distinct student" (schedule context TenHours (List.range 1 4 |> List.map (\n -> oneLesson { first | student = sid n, start = time (n + 1) 15 0 })) |> isErr TooManyStudents)
    , check "five-hour package rejects sharing" (schedule context FiveHours [ oneLesson first, oneLesson brother ] |> isErr TooManyStudents)
    , check "twenty-hour package permits five students" (schedule context TwentyHours (List.range 1 5 |> List.map (\n -> oneLesson { first | student = sid n, start = time (n + 1) 15 0 })) |> Result.map (always True) |> Result.withDefault False)
    , check "twenty-hour package rejects six students" (schedule context TwentyHours (List.range 1 6 |> List.map (\n -> oneLesson { first | student = sid n, start = time (n + 1) 15 0 })) |> isErr TooManyStudents)
    , check "different students and tutors may meet simultaneously" (schedule context TenHours [ oneLesson first, oneLesson brother ] |> Result.map (always True) |> Result.withDefault False)
    , check "student partial overlap is rejected" (schedule context TenHours [ oneLesson first, oneLesson { first | tutor = daniel, start = time 7 15 30 } ] |> isErr StudentOverlap)
    , check "tutor partial overlap is rejected" (schedule context TenHours [ oneLesson first, oneLesson { brother | tutor = sarah, start = time 7 15 30 } ] |> isErr TutorOverlap)
    , check "back-to-back lessons do not overlap" (schedule context TenHours [ oneLesson first, oneLesson { first | start = time 7 16 0 } ] |> Result.map (always True) |> Result.withDefault False)
    , check "entire duration must fit availability" (schedule { context | catalog = { students = [ emma ], subjects = [ math ], tutors = [ { id = sarah, subjects = [ math ], availability = [ { start = time 7 13 0, end = time 7 16 0 } ] } ] } } FiveHours [ oneLesson { first | duration = NinetyMinutes } ] |> isErr OutsideAvailability)
    , check "notice at the exact deadline is allowed" (schedule { context | now = time 6 15 0 } FiveHours [ oneLesson first ] |> Result.map (always True) |> Result.withDefault False)
    , check "notice after the deadline is rejected" (schedule { context | now = time 6 15 15 } FiveHours [ oneLesson first ] |> isErr TooSoon)
    , check "external tutor reservations are checked" (schedule { context | reserved = [ { brother | tutor = sarah } ] } FiveHours [ oneLesson first ] |> isErr TutorOverlap)
    , check "unsupported subject is rejected" (schedule context FiveHours [ oneLesson { first | subject = science } ] |> isErr UnsupportedSubject)
    , check "unknown student is rejected" (schedule context FiveHours [ oneLesson { first | student = sid 77 } ] |> isErr UnknownStudent)
    , check "empty schedule is a valid planning state" (schedule context TenHours [] |> Result.map (remainingMinutes >> (==) 600) |> Result.withDefault False)
    , check "zero-session routine is rejected" (weekly first 0 |> isErr InvalidValue)
    , check "invalid occurrence is rejected, not appended" (family |> Result.map (\s -> isErr SessionOutOfRange (customize context 0 6 first s)) |> Result.withDefault False)
    , check "invalid quarter-hour input is rejected" (fixtureTime 0 9 7 == Nothing)
    , check "new lesson can be added without expiring an already accepted lesson" (schedule context TenHours [ oneLesson first ] |> Result.andThen (addPlan { context | now = time 7 14 0 } (oneLesson { brother | start = time 14 15 0 })) |> Result.map (always True) |> Result.withDefault False)
    , check "re-saving an unchanged accepted occurrence does not reapply booking notice" (family |> Result.andThen (customize { context | now = time 7 14 0 } 0 0 first) |> Result.map (always True) |> Result.withDefault False)
    , check "rescheduling an accepted occurrence must satisfy booking notice" (family |> Result.andThen (customize { context | now = time 7 14 0 } 0 0 { first | start = time 7 17 0 }) |> isErr TooSoon)
    , check "conflicting edit is rejected without changing the original" (family |> Result.map (\s -> isErr TutorOverlap (customize context 1 0 { brother | tutor = sarah } s) && (List.concatMap lessons (plans s) |> List.length) == 10) |> Result.withDefault False)
    ]


main =
    Platform.worker
        { init = \() -> ( (), report (E.list (\( name, passed ) -> E.object [ ( "name", E.string name ), ( "passed", E.bool passed ) ]) checks) )
        , update = \_ model -> ( model, Cmd.none )
        , subscriptions = \_ -> Sub.none
        }
