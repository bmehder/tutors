import admin/browser
import admin/model.{
  type Booking, type Model, type Msg, type Session, type Tutor, AddTutor,
  Bookings, Reports, Saving, Schedule, Tutors,
}
import admin/reports as report
import gleam/dynamic/decode
import gleam/int
import gleam/list
import gleam/order
import gleam/result
import gleam/string
import lustre/attribute as a
import lustre/element.{type Element}
import lustre/element/html as h
import lustre/element/keyed
import lustre/event as e

const field = "block min-w-0 w-full max-w-xs rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"

const panel = "min-w-0 rounded-xl border border-zinc-800 bg-zinc-900 p-4"

const button = "w-fit rounded-md bg-stone-300 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-stone-200"

pub fn render(model: Model) -> Element(Msg) {
  h.div(
    [
      a.class(
        "max-w-[104rem] mx-auto min-h-screen bg-zinc-950 text-zinc-200 font-sans text-sm p-4 lg:p-8",
      ),
    ],
    [
      confirmation(model.request),
      h.header([a.class("mb-6")], [
        h.a([a.href("/"), a.class("text-stone-300")], [
          h.text("MyChristianTutors"),
        ]),
        h.h1([a.class("text-2xl font-semibold mt-1")], [
          h.text("Tutoring administration"),
        ]),
      ]),
      h.div([a.class("grid gap-4 lg:grid-cols-[11rem_minmax(0,1fr)]")], [
        h.nav(
          [
            a.attribute("aria-label", "Admin navigation"),
            a.class("flex flex-wrap gap-2 lg:flex-col items-start"),
          ],
          list.map(
            [
              #("Tutors", Tutors),
              #("Bookings", Bookings),
              #("Reports", Reports),
            ],
            fn(item) {
              h.button(
                [
                  a.type_("button"),
                  a.disabled(model.request != model.Ready),
                  a.attribute(
                    "aria-current",
                    case active_screen(model.screen) == item.1 {
                      True -> "page"
                      False -> "false"
                    },
                  ),
                  a.class(
                    "rounded-md px-3 py-2 hover:bg-zinc-800 aria-[current=page]:bg-stone-300 aria-[current=page]:text-zinc-950",
                  ),
                  e.on_click(model.UserClickedScreen(item.1)),
                ],
                [h.text(item.0)],
              )
            },
          )
            |> list.append([
              h.form([a.method("post"), a.action("/admin")], [
                hidden("action", "sign-out"),
                h.button([a.class("px-3 py-2 text-zinc-400")], [
                  h.text("Sign out"),
                ]),
              ]),
            ]),
        ),
        h.main([a.class("min-w-0 space-y-4")], [
          h.p(
            [
              a.attribute("role", "status"),
              a.attribute("aria-live", "polite"),
              a.class("empty:hidden text-amber-200"),
            ],
            [
              h.text(case model.request {
                Saving(_) -> "Saving…"
                _ -> model.message
              }),
            ],
          ),
          h.fieldset(
            [a.disabled(model.request != model.Ready), a.class("min-w-0")],
            [
              keyed.div([], [
                #(screen_key(model.screen), case model.screen {
                  Tutors -> tutor_list(model)
                  AddTutor ->
                    h.div([a.class(panel <> " space-y-4")], [
                      heading("Add tutor"),
                      tutor_form(model, model.Tutor("", "", [], False, [])),
                    ])
                  Schedule(tutor, blocks, removed) ->
                    schedule(model, tutor, blocks, removed)
                  Bookings ->
                    h.div([a.class("space-y-3")], [
                      heading("Bookings"),
                      h.p([a.class("text-zinc-400")], [
                        h.text(
                          "Demo amounts in USD. Editing amounts does not charge or refund a payment.",
                        ),
                      ]),
                      keyed.div(
                        [a.class("space-y-3")],
                        list.map(model.data.bookings, fn(booking) {
                          #(booking.id, booking_view(model, booking))
                        }),
                      ),
                      empty_state(
                        model.data.bookings == [],
                        "No confirmed bookings yet.",
                      ),
                      manual_booking(model),
                    ])
                  Reports -> reports(model)
                }),
              ]),
            ],
          ),
        ]),
      ]),
    ],
  )
}

fn heading(text: String) {
  h.h2([a.attribute("tabindex", "-1"), a.class("text-xl font-semibold mb-3")], [
    h.text(text),
  ])
}

fn hidden(name: String, value: String) {
  h.input([a.type_("hidden"), a.name(name), a.value(value)])
}

fn input(
  fields: model.FormFields,
  label: String,
  name: String,
  value: String,
  kind: String,
) {
  h.label([a.class("block")], [
    h.text(label),
    h.input([
      a.class(field),
      a.name(name),
      a.type_(kind),
      a.value(field_value(fields, name, value)),
      a.required(True),
      a.attribute("step", case kind {
        "time" -> "900"
        _ -> "1"
      }),
      a.attribute("min", case kind {
        "number" -> "0"
        _ -> ""
      }),
    ]),
  ])
}

fn submit(label: String) {
  h.button([a.type_("submit"), a.class(button)], [h.text(label)])
}

fn form(
  id: String,
  action: String,
  tutor: String,
  children: List(Element(Msg)),
) {
  h.form(
    [
      a.id(id),
      a.class("grid gap-3"),
      e.on_submit(model.UserSubmittedForm(id, tutor, _)),
      case action {
        "save" | "reset" -> a.attribute("data-schedule-form", "true")
        _ ->
          e.on(
            "input",
            decode.map(decode.dynamic, fn(event) {
              model.UserEditedForm(id, browser.form_fields(event))
            }),
          )
      },
    ],
    [hidden("action", action), element.fragment(children)],
  )
}

fn select(
  fields: model.FormFields,
  label: String,
  name: String,
  options: List(#(String, String)),
  selected: String,
) {
  h.label([a.class("block")], [
    h.text(label),
    h.select(
      [a.name(name), a.class(field)],
      list.map(options, fn(item) {
        h.option(
          [
            a.value(item.0),
            a.selected(item.0 == field_value(fields, name, selected)),
          ],
          item.1,
        )
      }),
    ),
  ])
}

fn tutor_list(model: Model) {
  let matches =
    list.filter(model.data.tutors, fn(tutor) {
      model.subject_filter == ""
      || list.contains(tutor.subjects, model.subject_filter)
    })
  h.div([a.class("space-y-3")], [
    heading("Tutors"),
    h.div([], [
      h.button(
        [a.class(button), e.on_click(model.UserClickedScreen(AddTutor))],
        [h.text("Add tutor")],
      ),
    ]),
    h.label([a.class("block")], [
      h.text("Filter by subject"),
      h.select([a.class(field), e.on_input(model.UserSelectedSubjectFilter)], [
        h.option([a.value("")], "All subjects"),
        element.fragment(
          list.map(model.data.subjects, fn(subject) {
            h.option([a.selected(subject == model.subject_filter)], subject)
          }),
        ),
      ]),
    ]),
    empty_state(matches == [], "No tutors match this subject."),
    keyed.div(
      [a.class("space-y-3")],
      model.data.tutors
        |> list.filter(fn(tutor) {
          model.subject_filter == ""
          || list.contains(tutor.subjects, model.subject_filter)
        })
        |> list.map(fn(tutor) {
          #(
            tutor.id,
            h.details([a.class(panel)], [
              h.summary([a.class("cursor-pointer font-semibold")], [
                h.text(
                  tutor.name
                  <> case tutor.archived {
                    True -> " (archived)"
                    False -> ""
                  },
                ),
                h.span(
                  [a.class("block text-xs text-zinc-400 font-normal mt-1")],
                  [
                    h.text(
                      int.to_string(list.length(tutor.subjects))
                      <> case list.length(tutor.subjects) {
                        1 -> " subject · "
                        _ -> " subjects · "
                      }
                      <> string.join(tutor.subjects, ", "),
                    ),
                  ],
                ),
              ]),
              h.div([a.class("space-y-4 mt-3")], [
                h.button(
                  [
                    a.class(button),
                    e.on_click(model.UserClickedSchedule(tutor)),
                  ],
                  [h.text("Edit weekly schedule")],
                ),
                tutor_form(model, tutor),
                form(
                  "archive-" <> tutor.id,
                  case tutor.archived {
                    True -> "restore-tutor"
                    False -> "archive-tutor"
                  },
                  "",
                  [
                    hidden("tutor-id", tutor.id),
                    submit(case tutor.archived {
                      True -> "Restore tutor"
                      False -> "Archive tutor"
                    }),
                  ],
                ),
                heading("Bookings"),
                ..list.flat_map(model.data.bookings, fn(booking) {
                  booking.sessions
                  |> list.filter(fn(session) { session.tutor == tutor.id })
                  |> list.map(fn(session) {
                    session_view(model, booking.name, session)
                  })
                })
              ]),
            ]),
          )
        }),
    ),
  ])
}

fn tutor_form(model: Model, tutor: Tutor) {
  let fields = form_fields(model, "tutor-" <> tutor.id)

  let selected_subjects = case
    list.key_find(model.form_drafts, "tutor-" <> tutor.id)
  {
    Ok(fields) ->
      fields
      |> list.filter(fn(field) { field.0 == "subjects" })
      |> list.map(fn(field) { field.1 })
    Error(_) -> tutor.subjects
  }
  form("tutor-" <> tutor.id, "save-tutor", "", [
    hidden("tutor-id", tutor.id),
    input(fields, "Name", "name", tutor.name, "text"),
    h.details([a.open(tutor.id == "")], [
      h.summary([a.class("cursor-pointer")], [
        h.text(
          "Subjects ("
          <> int.to_string(list.length(selected_subjects))
          <> ") · "
          <> string.join(selected_subjects, ", "),
        ),
      ]),
      h.div(
        [a.class("grid gap-2 sm:grid-cols-2 mt-3")],
        list.map(model.data.subjects, fn(subject) {
          h.label([a.class("block")], [
            h.input([
              a.type_("checkbox"),
              a.name("subjects"),
              a.value(subject),
              a.checked(list.contains(selected_subjects, subject)),
            ]),
            h.text(" " <> subject),
          ])
        }),
      ),
    ]),
    submit(case tutor.id {
      "" -> "Create tutor"
      _ -> "Save tutor"
    }),
  ])
}

fn time_label(minute: Int) {
  let hour = minute / 60
  let minutes = minute % 60
  case minute {
    1440 -> "Midnight"
    _ ->
      int.to_string(case hour % 12 {
        0 -> 12
        n -> n
      })
      <> ":"
      <> case minutes {
        0 -> "00"
        n -> int.to_string(n)
      }
      <> case hour >= 12 {
        True -> " PM"
        False -> " AM"
      }
  }
}

fn time_select(
  label: String,
  name: String,
  value: Int,
  change: fn(Int) -> Msg,
) {
  h.label([a.class("block")], [
    h.text(label),
    h.select(
      [
        a.class(field),
        a.name(name),
        e.on_input(fn(value) { change(int.parse(value) |> result.unwrap(0)) }),
      ],
      list.index_map(list.repeat(Nil, 97), fn(_, index) {
        h.option(
          [a.value(int.to_string(index * 15)), a.selected(index * 15 == value)],
          time_label(index * 15),
        )
      }),
    ),
  ])
}

fn schedule(
  model: Model,
  tutor: Tutor,
  blocks: List(model.Block),
  removed: List(model.Block),
) {
  h.div([a.class("space-y-4")], [
    heading(tutor.name <> " · Weekly schedule"),
    h.p([], [
      h.text("All times Eastern. Each block must allow at least one hour."),
    ]),
    form("weekly-hours", "save", tutor.id, [
      h.div([a.class("flex flex-wrap items-end justify-between gap-3")], [
        h.label([a.class("block")], [
          h.text("Tutor"),
          h.select(
            [a.class(field), e.on_input(model.UserSelectedScheduleTutor)],
            list.map(model.data.tutors, fn(item) {
              h.option(
                [a.value(item.id), a.selected(item.id == tutor.id)],
                item.name,
              )
            }),
          ),
        ]),
        h.div([a.class("flex items-center gap-3")], [
          h.button(
            [
              a.type_("button"),
              a.disabled(removed == []),
              e.on_click(model.UserClickedUndo),
            ],
            [h.text("Undo removal")],
          ),
          submit("Save weekly hours"),
        ]),
      ]),
      h.div(
        [a.class("grid gap-2 md:grid-cols-2 min-[90rem]:grid-cols-7")],
        list.index_map(
          [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
          ],
          fn(day, index) {
            h.fieldset([a.class(panel)], [
              h.legend([], [h.text(day)]),
              keyed.div(
                [],
                blocks
                  |> list.filter(fn(block) { block.day == index })
                  |> list.map(fn(block) {
                    #(
                      int.to_string(block.id),
                      h.div(
                        [
                          a.id("block-" <> int.to_string(block.id)),
                          a.class(
                            "border border-zinc-700 rounded-md p-2 mb-2 grid gap-2",
                          ),
                        ],
                        [
                          time_select(
                            "From",
                            "start-" <> int.to_string(index),
                            block.start,
                            model.UserChangedBlockStart(block.id, _),
                          ),
                          time_select(
                            "To",
                            "end-" <> int.to_string(index),
                            block.end,
                            model.UserChangedBlockEnd(block.id, _),
                          ),
                          h.button(
                            [
                              a.type_("button"),
                              a.attribute(
                                "aria-label",
                                "Remove " <> day <> " time block",
                              ),
                              e.on_click(model.UserClickedRemoveBlock(block)),
                              a.class("justify-self-end p-2"),
                            ],
                            [h.text("× Remove")],
                          ),
                        ],
                      ),
                    )
                  }),
              ),
              h.button(
                [
                  a.type_("button"),
                  a.attribute("aria-label", "Add hours for " <> day),
                  a.class("border border-dashed border-zinc-600 rounded p-2"),
                  e.on_click(model.UserClickedAddBlock(index)),
                ],
                [h.text("+")],
              ),
            ])
          },
        ),
      ),
    ]),
    form("reset-hours", "reset", tutor.id, [submit("Restore demo hours")]),
  ])
}

fn session_view(model: Model, name: String, session: Session) {
  let fields = form_fields(model, "session-" <> session.id)

  h.details([a.class(panel)], [
    h.summary([a.class("cursor-pointer")], [
      h.text(name <> " · " <> session.label),
      h.span([a.class("block mt-1 text-zinc-400 text-xs")], [
        h.text(
          tutor_name(model, session.tutor)
          <> " · "
          <> case session.subject {
            "" -> "Subject not saved"
            subject -> subject
          },
        ),
      ]),
    ]),
    form("session-" <> session.id, "move-session", "", [
      hidden("session", session.id),
      select(
        fields,
        "Tutor",
        "replacement-tutor",
        [
          #("", "Keep current tutor"),
          ..model.data.tutors
          |> list.filter(fn(tutor) {
            !tutor.archived && list.contains(tutor.subjects, session.subject)
          })
          |> list.map(fn(tutor) { #(tutor.id, tutor.name) })
        ],
        "",
      ),
      input(fields, "Date (Eastern)", "date", session.date, "date"),
      input(fields, "Time (Eastern)", "time", session.time, "time"),
      submit("Save session"),
    ]),
    form("subject-" <> session.id, "save-session-subject", "", [
      hidden("session", session.id),
      select(
        form_fields(model, "subject-" <> session.id),
        "Subject",
        "session-subject",
        list.map(model.data.subjects, fn(s) { #(s, s) }),
        session.subject,
      ),
      submit("Save subject"),
    ]),
  ])
}

fn booking_view(model: Model, booking: Booking) {
  let fields = form_fields(model, "booking-" <> booking.id)

  h.details([a.class(panel)], [
    h.summary([a.class("cursor-pointer font-semibold")], [
      h.text(
        booking.name
        <> " · Order #"
        <> { string.slice(booking.id, 0, 8) |> string.uppercase }
        <> " · "
        <> booking.date
        <> " · "
        <> int.to_string(list.length(booking.sessions))
        <> " sessions",
      ),
    ]),
    h.div([a.class("space-y-3 mt-3")], [
      h.p([], [
        h.text(
          "Paid "
          <> format_money(report.amount_paid(booking))
          <> " · Discount "
          <> format_money(booking.discount),
        ),
      ]),
      keyed.div(
        [a.class("space-y-2")],
        list.map(booking.sessions, fn(session) {
          #(session.id, session_view(model, booking.name, session))
        }),
      ),
      form("booking-" <> booking.id, "edit-booking", "", [
        hidden("booking", booking.id),
        input(fields, "Family contact", "label", booking.name, "text"),
        input(
          fields,
          "Subtotal in cents",
          "subtotal",
          money_input(booking.subtotal),
          "number",
        ),
        input(
          fields,
          "Discount in cents",
          "discount",
          money_input(booking.discount),
          "number",
        ),
        submit("Save booking"),
      ]),
      h.details([], [
        h.summary([], [h.text("Delete booking")]),
        form("delete-" <> booking.id, "delete-booking", "", [
          hidden("booking", booking.id),
          h.p([], [h.text("This releases every session in this booking.")]),
          submit("Confirm deletion"),
        ]),
      ]),
    ]),
  ])
}

fn manual_booking(model: Model) {
  let fields = form_fields(model, "manual")

  h.details([a.class(panel)], [
    h.summary([], [h.text("Add manual booking")]),
    form("manual", "create-booking", "", [
      input(fields, "Family contact", "label", "", "text"),
      select(
        fields,
        "Tutor",
        "booking-tutor",
        model.data.tutors
          |> list.filter(fn(t) { !t.archived })
          |> list.map(fn(t) { #(t.id, t.name) }),
        "",
      ),
      input(fields, "Date (Eastern)", "date", "", "date"),
      input(fields, "Start (Eastern)", "time", "", "time"),
      input(fields, "Subtotal in cents", "subtotal", "", "number"),
      input(fields, "Discount in cents", "discount", "0", "number"),
      submit("Create one-hour booking"),
    ]),
  ])
}

fn reports(model: Model) {
  let bookings =
    report.in_period(model.data.bookings, model.report_from, model.report_to)
  let recorded =
    list.filter(bookings, fn(booking) {
      report.amount_paid(booking) != model.Unrecorded
    })
  h.div([a.class(panel <> " space-y-4")], [
    heading("Reports"),
    h.p([a.class("text-amber-200")], [
      h.text(
        case
          model.report_from != ""
          && model.report_to != ""
          && string.compare(model.report_from, model.report_to) == order.Gt
        {
          True -> "Choose an end date on or after the start date."
          False -> ""
        },
      ),
    ]),
    h.p([], [h.text("Demo payments by confirmation date, Eastern time.")]),
    h.div([a.class("flex flex-wrap gap-3")], [
      h.label([a.class("block")], [
        h.text("From"),
        h.input([
          a.type_("date"),
          a.class(field),
          a.value(model.report_from),
          e.on_input(model.UserChangedReportFrom),
        ]),
      ]),
      h.label([a.class("block")], [
        h.text("Through"),
        h.input([
          a.type_("date"),
          a.class(field),
          a.value(model.report_to),
          e.on_input(model.UserChangedReportTo),
        ]),
      ]),
    ]),
    h.div([a.class("grid gap-3 sm:grid-cols-3")], [
      metric("Recorded revenue", browser.money(report.revenue(bookings))),
      metric("Discounts", browser.money(report.discounts(bookings))),
      metric("Bookings", int.to_string(list.length(bookings))),
    ]),
    h.p([], [
      h.text(
        int.to_string(list.length(bookings))
        <> " bookings · "
        <> int.to_string(list.length(bookings) - list.length(recorded))
        <> " missing payment details",
      ),
    ]),
    element.fragment(
      list.map([5, 10, 20, 0], fn(hours) {
        h.p([], [
          h.text(
            case hours {
              0 -> "Package unrecorded"
              _ -> int.to_string(hours) <> "-hour packages"
            }
            <> " · "
            <> int.to_string(
              list.length(list.filter(bookings, fn(b) { b.hours == hours })),
            ),
          ),
        ])
      }),
    ),
    heading("Booking contacts"),
    element.fragment(
      list.map(list.unique(list.map(bookings, fn(b) { b.name })), fn(name) {
        h.p([], [
          h.text(
            name
            <> " · "
            <> int.to_string(
              list.length(list.filter(bookings, fn(b) { b.name == name })),
            ),
          ),
        ])
      }),
    ),
  ])
}

// Presentation helpers derived from the current screen and loaded catalog.
fn active_screen(screen: model.Screen) {
  case screen {
    AddTutor | Schedule(_, _, _) -> Tutors
    _ -> screen
  }
}

fn screen_key(screen: model.Screen) {
  case screen {
    Tutors -> "tutors"
    AddTutor -> "add-tutor"
    Schedule(tutor, _, _) -> "schedule-" <> tutor.id
    Bookings -> "bookings"
    Reports -> "reports"
  }
}

fn tutor_name(model: Model, tutor_id: String) {
  model.data.tutors
  |> list.find(fn(tutor) { tutor.id == tutor_id })
  |> result.map(fn(tutor) { tutor.name })
  |> result.unwrap("Tutor unrecorded")
}

fn format_money(amount: model.Money) {
  case amount {
    model.Unrecorded -> "Unrecorded"
    model.Recorded(cents) -> browser.money(cents)
  }
}

fn money_input(amount: model.Money) {
  case amount {
    model.Unrecorded -> ""
    model.Recorded(cents) -> int.to_string(cents)
  }
}

fn metric(label: String, value: String) {
  h.div([a.class("rounded-lg border border-zinc-700 bg-zinc-950 p-4")], [
    h.p([a.class("text-xs text-zinc-400")], [h.text(label)]),
    h.p([a.class("text-2xl font-semibold mt-1")], [h.text(value)]),
  ])
}

fn empty_state(empty: Bool, message: String) {
  case empty {
    True -> h.p([a.class("text-zinc-400 py-2")], [h.text(message)])
    False -> element.none()
  }
}

// Confirmations are visible application state rather than blocking browser dialogs.
fn confirmation(request: model.RequestState) {
  case request {
    model.ConfirmingRemoval(_) ->
      confirmation_panel(
        "Remove this time block?",
        "You can undo the removal before saving your weekly hours.",
        "Remove block",
        model.UserClickedConfirmRemoval,
      )
    model.ConfirmingNavigation(_) ->
      confirmation_panel(
        "Leave without saving?",
        "Your changes to this weekly schedule have not been saved.",
        "Discard changes",
        model.UserClickedDiscardChanges,
      )
    _ -> element.none()
  }
}

fn confirmation_panel(
  title: String,
  description: String,
  action: String,
  confirm: Msg,
) {
  h.dialog(
    [
      a.id("admin-confirmation"),
      a.attribute("role", "alertdialog"),
      a.attribute("aria-labelledby", "confirmation-title"),
      a.attribute("aria-describedby", "confirmation-description"),
      a.class(
        panel
        <> " m-auto max-w-sm text-zinc-200 shadow-xl space-y-4 backdrop:bg-black/70",
      ),
      e.on("cancel", decode.success(model.UserClickedCancelConfirmation))
        |> e.prevent_default,
    ],
    [
      h.h2([a.id("confirmation-title"), a.class("font-semibold text-lg")], [
        h.text(title),
      ]),
      h.p([a.id("confirmation-description"), a.class("text-zinc-400")], [
        h.text(description),
      ]),
      h.div([a.class("flex gap-3")], [
        h.button(
          [
            a.type_("button"),
            a.class("rounded border border-zinc-600 px-3 py-2"),
            e.on_click(model.UserClickedCancelConfirmation),
          ],
          [h.text("Cancel")],
        ),
        h.button([a.type_("button"), a.class(button), e.on_click(confirm)], [
          h.text(action),
        ]),
      ]),
    ],
  )
}

// Draft fields survive validation errors and redraws; hidden fields remain server commands.
fn form_fields(model: Model, form_id: String) -> model.FormFields {
  list.key_find(model.form_drafts, form_id) |> result.unwrap([])
}

fn field_value(fields: model.FormFields, name: String, fallback: String) {
  list.key_find(fields, name) |> result.unwrap(fallback)
}
