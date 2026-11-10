import gleam/int
import gleam/list
import gleam/option.{type Option, Some}
import gleam/string
import planner/model.{
  type AllocationId, type ErrorMessage, type Hours, type Student,
  type StudentCount, Student, SubjectAllocation,
}

pub fn student_limit(package_hours: Hours) -> StudentCount {
  case package_hours {
    5 -> 1
    10 -> 3
    20 -> 5
    _ -> 0
  }
}

pub fn initialize_allocations(
  package_hours: Hours,
  student_count: StudentCount,
  make_id: fn() -> String,
) -> List(Student) {
  list.repeat(Nil, student_count)
  |> list.index_map(fn(_, index) {
    let extra = case index < package_hours % student_count {
      True -> 1
      False -> 0
    }
    let hours = package_hours / student_count + extra
    Student(make_id(), "", hours, [
      SubjectAllocation(id: make_id(), subject: "", hours:),
    ])
  })
}

pub fn total_allocated_hours(students: List(Student)) -> Hours {
  list.fold(students, 0, fn(sum, student) { sum + student.allocated_hours })
}

pub fn remaining_subject_hours(student: Student) -> Hours {
  student.allocated_hours
  - list.fold(student.subject_allocations, 0, fn(sum, allocation) {
    sum + allocation.hours
  })
}

pub fn subject_hour_limit(student: Student) -> Hours {
  let other_subjects = int.max(0, list.length(student.subject_allocations) - 1)
  student.allocated_hours - other_subjects
}

pub fn allocation_issue(
  students: List(Student),
  capacity: Hours,
) -> Option(ErrorMessage) {
  let maximum = student_limit(capacity)
  case list.length(students) > maximum {
    True ->
      Some(
        "This package allows up to " <> int.to_string(maximum) <> " students.",
      )
    False -> check_student_allocations(students, capacity)
  }
}

fn check_student_allocations(
  students: List(Student),
  capacity: Hours,
) -> Option(ErrorMessage) {
  let duplicate =
    list.any(students, fn(student) {
      let subjects =
        student.subject_allocations
        |> list.map(fn(allocation) { allocation.subject })
        |> list.filter(fn(subject) { subject != "" })
      list.length(list.unique(subjects)) != list.length(subjects)
    })
  let unnamed =
    list.any(students, fn(student) { string.trim(student.name) == "" })
  let incomplete =
    list.any(students, fn(student) {
      student.allocated_hours < 1
      || list.is_empty(student.subject_allocations)
      || list.any(student.subject_allocations, fn(allocation) {
        allocation.subject == "" || allocation.hours < 1
      })
    })
  let unbalanced =
    list.any(students, fn(student) { remaining_subject_hours(student) != 0 })
  let checks = [
    #(duplicate, "Choose each subject only once per student."),
    #(unnamed, "Give each student a name."),
    #(
      incomplete,
      "Choose whole-hour amounts and a subject for every allocation.",
    ),
    #(
      unbalanced,
      "Each student’s subject hours must add up to their allocated hours.",
    ),
    #(
      total_allocated_hours(students) > capacity,
      "The allocations exceed your package hours.",
    ),
  ]

  checks
  |> list.find_map(fn(check) {
    let #(failed, message) = check
    case failed {
      True -> Ok(message)
      False -> Error(Nil)
    }
  })
  |> option.from_result
}

pub fn set_subject_hours(
  student: Student,
  allocation_id: AllocationId,
  hours: Hours,
) -> Student {
  let other_count = list.length(student.subject_allocations) - 1
  // A single subject can leave hours unassigned. With multiple subjects,
  // reserve at least one hour for each of the other subjects.
  let selected = case other_count {
    0 -> hours
    _ -> int.min(hours, subject_hour_limit(student))
  }
  let #(_, subjects) =
    list.map_fold(
      student.subject_allocations,
      #(student.allocated_hours - selected, other_count),
      fn(state, allocation) {
        let #(remaining, count) = state
        case allocation.id == allocation_id {
          True -> #(state, SubjectAllocation(..allocation, hours: selected))
          False -> {
            let hours = case count {
              1 -> remaining
              _ -> int.min(allocation.hours, remaining - count + 1)
            }
            #(
              #(remaining - hours, count - 1),
              SubjectAllocation(..allocation, hours:),
            )
          }
        }
      },
    )
  Student(..student, subject_allocations: subjects)
}

pub fn remove_subject_allocation(
  student: Student,
  allocation_id: AllocationId,
) -> Student {
  case
    list.find(student.subject_allocations, fn(allocation) {
      allocation.id == allocation_id
    })
  {
    Error(_) -> student
    Ok(removed) -> {
      let subjects =
        list.filter(student.subject_allocations, fn(allocation) {
          allocation.id != allocation_id
        })
      let subjects = case subjects {
        [] -> []
        [first, ..rest] -> [
          SubjectAllocation(..first, hours: first.hours + removed.hours),
          ..rest
        ]
      }
      Student(..student, subject_allocations: subjects)
    }
  }
}
