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
    { student = emma, tutor = sarah, subject = math, start = time 7 15 0 }


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


ok result =
    Result.map (always True) result |> Result.withDefault False


member id name hours routines =
    { id = id, name = name, hours = hours, routines = routines }


checks =
    [ check "six plus four weekly hours fit ten" (family |> Result.map (\s -> usedMinutes s == 600 && remainingMinutes s == 0) |> Result.withDefault False)
    , check "weekly dates derive from one first session" (weekly first 3 |> Result.map (sessions >> List.map .start >> (==) [time 7 15 0,time 14 15 0,time 21 15 0]) |> Result.withDefault False)
    , check "zero count rejected" (weekly first 0 |> isErr InvalidValue)
    , check "negative count rejected" (weekly first -1 |> isErr InvalidValue)
    , check "quarter hour starts enforced" (fixtureTime 0 9 7 == Nothing)
    , check "package downgrade clears all allocation" (bookingDraft TenHours |> setAllocations [member emma "Emma" 10 []] |> Result.map (changePackage FiveHours >> allocations >> List.isEmpty) |> Result.withDefault False)
    , check "package upgrade clears allocation" (bookingDraft FiveHours |> setAllocations [member emma "Emma" 5 []] |> Result.map (changePackage TwentyHours >> allocations >> List.isEmpty) |> Result.withDefault False)
    , check "unchanged package preserves draft" (bookingDraft TenHours |> setAllocations [member emma "Emma" 6 []] |> Result.map (changePackage TenHours >> allocations >> List.length >> (==) 1) |> Result.withDefault False)
    , check "draft can contain empty name and missing routine" (ok (bookingDraft FiveHours |> setAllocations [member emma "" 5 []]))
    , check "incomplete draft cannot complete" (bookingDraft FiveHours |> complete context |> isErr IncompleteDraft)
    , check "allocation over capacity rejected" (bookingDraft FiveHours |> setAllocations [member emma "Emma" 10 []] |> isErr OverBudget)
    , check "five hours cannot serve two students" (bookingDraft FiveHours |> setAllocations [member emma "Emma" 2 [],member jack "Jack" 3 []] |> isErr TooManyStudents)
    , check "duplicate student IDs rejected" (bookingDraft TenHours |> setAllocations [member emma "Emma" 2 [],member emma "Emma" 2 []] |> isErr InvalidValue)
    , check "unused purchased hours allowed" (weekly first 3 |> Result.andThen (\p -> bookingDraft FiveHours |> setAllocations [member emma "Emma" 3 [p]]) |> Result.andThen (complete context) |> Result.map (remainingMinutes >> (==) 120) |> Result.withDefault False)
    , check "unplanned allocated hours block completion" (weekly first 2 |> Result.andThen (\p -> bookingDraft FiveHours |> setAllocations [member emma "Emma" 3 [p]]) |> Result.andThen (complete context) |> isErr AllocationMismatch)
    , check "blank student name blocks completion" (weekly first 2 |> Result.andThen (\p -> bookingDraft FiveHours |> setAllocations [member emma " " 2 [p]]) |> Result.andThen (complete context) |> isErr IncompleteDraft)
    , check "routine cannot belong to another student" (weekly brother 2 |> Result.andThen (\p -> bookingDraft FiveHours |> setAllocations [member emma "Emma" 2 [p]]) |> isErr AllocationMismatch)
    , check "student overlap rejected" (Result.map2 (\a b -> [a,b]) (weekly first 2) (weekly { first | tutor = daniel, subject = science, start = time 7 15 30 } 2) |> Result.andThen (schedule context TenHours) |> isErr StudentOverlap)
    , check "tutor overlap rejected" (Result.map2 (\a b -> [a,b]) (weekly first 2) (weekly {brother | tutor = sarah} 2) |> Result.andThen (schedule context TenHours) |> isErr TutorOverlap)
    , check "notice deadline enforced" (weekly first 1 |> Result.andThen (\p -> schedule {context | now = time 6 15 15} FiveHours [p]) |> isErr TooSoon)
    , check "unsupported subject rejected" (weekly {first | subject = science} 1 |> Result.andThen (\p -> schedule context FiveHours [p]) |> isErr UnsupportedSubject)
    , check "duplicate subject routines rejected" (weekly first 1 |> Result.andThen (\p -> bookingDraft FiveHours |> setAllocations [member emma "Emma" 2 [p,p]]) |> isErr DuplicateSubject)
    , check "direct schedule cannot bypass duplicate subject rule" (weekly first 1 |> Result.andThen (\p -> schedule context FiveHours [p,p]) |> isErr DuplicateSubject)
    , check "addPlan cannot bypass duplicate subject rule" (weekly first 1 |> Result.andThen (\p -> schedule context FiveHours [p] |> Result.andThen (addPlan context p)) |> isErr DuplicateSubject)
    , check "empty confirmed plan rejected" (schedule context TenHours [] |> isErr IncompleteDraft)
    ]


main =
    Platform.worker
        { init = \() -> ( (), report (E.list (\( name, passed ) -> E.object [ ( "name", E.string name ), ( "passed", E.bool passed ) ]) checks) )
        , update = \_ model -> ( model, Cmd.none )
        , subscriptions = \_ -> Sub.none
        }
