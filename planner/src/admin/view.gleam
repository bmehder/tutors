import admin/browser
import admin/model.{
  type Booking, type Model, type Msg, type Session, type Tutor, AddTutor,
  Bookings, Reports, Saving, Schedule, Subjects, Tutors,
}
import admin/reports as report
import gleam/dynamic/decode
import gleam/int
import gleam/list
import gleam/option.{Some}
import gleam/order
import gleam/result
import gleam/string
import lustre/attribute as a
import lustre/element.{type Element}
import lustre/element/html as h
import lustre/element/keyed
import lustre/event as e

const field = "block min-w-0 w-full max-w-xs rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"

const panel = "min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-xs"

const button = "w-fit min-h-10 rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900"

pub fn render(model: Model) -> Element(Msg) {
  h.div(
    [
      a.class("min-h-screen bg-slate-50 text-slate-900 font-sans text-sm"),
    ],
    [
      confirmation(model.request),
      h.header([a.class("border-b border-slate-200 bg-white")], [
        h.div(
          [
            a.class(
              "mx-auto flex max-w-[104rem] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8",
            ),
          ],
          [
            h.div([], [
              h.a(
                [
                  a.href("/"),
                  a.class("text-xs font-bold text-teal-800 hover:underline"),
                ],
                [h.text("MyChristianTutors")],
              ),
              h.h1([a.class("text-lg font-bold")], [
                h.text("Tutoring administration"),
              ]),
            ]),
            h.form([a.method("post"), a.action("/admin")], [
              hidden("action", "sign-out"),
              h.button(
                [
                  a.class(
                    "min-h-10 rounded-lg border border-slate-200 px-3 font-semibold text-slate-700 hover:bg-slate-50",
                  ),
                ],
                [h.text("Sign out")],
              ),
            ]),
          ],
        ),
      ]),
      h.div(
        [
          a.class(
            "mx-auto grid max-w-[104rem] gap-5 px-4 py-5 sm:px-8 lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-8 lg:py-8",
          ),
        ],
        [
          h.nav(
            [
              a.attribute("aria-label", "Admin navigation"),
              a.class(
                "flex self-start gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xs lg:sticky lg:top-6 lg:flex-col",
              ),
            ],
            list.map(
              [
                #("Bookings", Bookings),
                #("Tutors", Tutors),
                #("Subjects", Subjects),
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
                      "min-h-10 flex-1 rounded-lg px-2 py-2 font-semibold text-slate-600 hover:bg-slate-50 sm:px-3 lg:text-left aria-[current=page]:bg-teal-50 aria-[current=page]:text-teal-900",
                    ),
                    e.on_click(model.UserClickedScreen(item.1)),
                  ],
                  [h.text(item.0)],
                )
              },
            ),
          ),
          h.main([a.class("min-w-0 space-y-4")], [
            h.p(
              [
                a.attribute("role", "status"),
                a.attribute("aria-live", "polite"),
                a.class(
                  "empty:hidden rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 font-medium text-teal-950",
                ),
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
                        tutor_form(
                          model,
                          model.Tutor("", "", [], False, [], "", ""),
                        ),
                      ])
                    Schedule(tutor, blocks, removed) ->
                      schedule(model, tutor, blocks, removed)
                    Bookings ->
                      h.div([a.class("space-y-3")], [
                        heading("Bookings"),
                        h.p([a.class("text-slate-600")], [
                          h.text(
                            "Amounts in USD. Editing amounts does not charge or refund a payment.",
                          ),
                        ]),
                        manual_booking(model),
                        h.p([a.class("font-medium text-slate-700")], [
                          h.text(
                            int.to_string(
                              list.length(
                                list.filter(model.data.bookings, fn(booking) {
                                  booking.payment_status == model.PendingPayment
                                }),
                              ),
                            )
                            <> " awaiting payment",
                          ),
                        ]),
                        keyed.div(
                          [a.class("space-y-3")],
                          list.sort(model.data.bookings, fn(left, right) {
                            case left.payment_status, right.payment_status {
                              model.PendingPayment, model.PaymentComplete ->
                                order.Lt
                              model.PaymentComplete, model.PendingPayment ->
                                order.Gt
                              _, _ -> order.Eq
                            }
                          })
                            |> list.map(fn(booking) {
                              #(booking.id, booking_view(model, booking))
                            }),
                        ),
                        empty_state(
                          model.data.bookings == [],
                          "No confirmed bookings yet.",
                        ),
                      ])
                    Reports -> reports(model)
                    Subjects -> subject_catalog(model)
                  }),
                ]),
              ],
            ),
          ]),
        ],
      ),
    ],
  )
}

fn heading(text: String) {
  h.h2([a.attribute("tabindex", "-1"), a.class("text-2xl font-bold mb-2")], [
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
  form_input(fields, label, name, value, kind, True)
}

fn form_input(
  fields: model.FormFields,
  label: String,
  name: String,
  value: String,
  kind: String,
  required: Bool,
) {
  h.label([a.class("block")], [
    h.text(label),
    h.input([
      a.class(field),
      a.name(name),
      a.type_(kind),
      a.value(field_value(fields, name, value)),
      a.required(required),
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
    h.div([a.class("flex flex-wrap items-center justify-between gap-3")], [
      heading("Tutors"),
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
      matches
        |> list.map(fn(tutor) {
          #(
            tutor.id,
            h.details([a.class(panel)], [
              h.summary(
                [
                  a.class(
                    "cursor-pointer font-semibold text-slate-900 marker:text-teal-700",
                  ),
                ],
                [
                  h.text(
                    tutor.name
                    <> case tutor.archived {
                      True -> " (archived)"
                      False -> ""
                    },
                  ),
                  h.span(
                    [a.class("block text-xs text-slate-600 font-normal mt-1")],
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
                ],
              ),
              h.div([a.class("space-y-4 mt-4 border-t border-slate-200 pt-4")], [
                h.button(
                  [
                    a.class(button),
                    e.on_click(model.UserClickedSchedule(tutor)),
                  ],
                  [h.text("Edit weekly schedule")],
                ),
                tutor_bookings(model, tutor),
                tutor_profile(model, tutor),
              ]),
            ]),
          )
        }),
    ),
  ])
}

fn subject_catalog(model: Model) {
  let create_id = "create-subject"
  h.div([a.class("space-y-4")], [
    heading("Subjects"),
    h.div([a.class(panel)], [
      form(create_id, "create-subject", "", [
        input(
          form_fields(model, create_id),
          "New subject",
          "subject-name",
          "",
          "text",
        ),
        submit("Add subject"),
        form_error(model, create_id),
      ]),
    ]),
    empty_state(model.data.subjects == [], "No subjects yet."),
    keyed.div(
      [a.class("space-y-2")],
      list.map(model.data.subjects, fn(subject) {
        #(subject, subject_editor(model, subject))
      }),
    ),
  ])
}

fn subject_editor(model: Model, subject: String) {
  let rename_id = "rename-subject-" <> subject
  h.details([a.class(panel)], [
    h.summary([a.class("font-semibold marker:text-teal-700")], [h.text(subject)]),
    form(rename_id, "rename-subject", "", [
      hidden("original-subject", subject),
      input(
        form_fields(model, rename_id),
        "Subject name",
        "subject-name",
        subject,
        "text",
      ),
      submit("Save name"),
      form_error(model, rename_id),
    ]),
    h.details([a.class("mt-3")], [
      h.summary([a.class("text-rose-800")], [h.text("Delete subject")]),
      form("delete-subject-" <> subject, "delete-subject", "", [
        hidden("original-subject", subject),
        h.p([], [
          h.text("Subjects assigned to tutors or sessions can’t be deleted."),
        ]),
        submit("Confirm deletion"),
        form_error(model, "delete-subject-" <> subject),
      ]),
    ]),
  ])
}

fn tutor_bookings(model: Model, tutor: Tutor) {
  let sessions =
    list.flat_map(model.data.bookings, fn(booking) {
      booking.sessions
      |> list.filter(fn(session) { session.tutor == tutor.id })
      |> list.map(fn(session) {
        #(session.id, session_view(model, booking.name, session))
      })
    })
  h.section([a.class("space-y-2")], [
    h.h3([a.class("font-semibold")], [h.text("Bookings")]),
    case sessions {
      [] -> empty_state(True, "No bookings for this tutor.")
      _ -> keyed.div([a.class("space-y-2")], sessions)
    },
  ])
}

fn tutor_profile(model: Model, tutor: Tutor) {
  h.details([a.class("rounded-lg border border-slate-200 p-3")], [
    h.summary([a.class("font-semibold text-teal-800 marker:text-teal-700")], [
      h.text("Edit tutor profile"),
    ]),
    h.div([a.class("mt-3 space-y-3")], [
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
          h.button(
            [
              a.type_("submit"),
              a.class(
                "w-fit rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50",
              ),
            ],
            [
              h.text(case tutor.archived {
                True -> "Restore tutor"
                False -> "Archive tutor"
              }),
            ],
          ),
        ],
      ),
    ]),
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
    form_input(fields, "Tutor email", "contact-email", tutor.email, "email", False),
    h.label([a.class("block")], [
      h.text("Meeting instructions"),
      h.textarea(
        [
          a.class(field),
          a.name("meeting-instructions"),
          a.attribute("rows", "4"),
          a.attribute("maxlength", "4000"),
        ],
        field_value(fields, "meeting-instructions", tutor.meeting_instructions),
      ),
      h.p([a.class("mt-1 text-sm text-slate-600")], [
        h.text(
          "Include the meeting link and any steps families need to join. Shared in booking emails.",
        ),
      ]),
    ]),
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

const eastern_zone = "America/New_York"

fn booking_zone_select(fields: model.FormFields) {
  let current = field_value(fields, "time-zone", eastern_zone)
  h.label([a.class("block")], [
    h.text("Time zone"),
    h.select(
      [
        a.class(field),
        a.name("time-zone"),
        a.attribute("data-previous-zone", current),
      ],
      zone_options(current),
    ),
  ])
}

fn zone_options(current: String) {
  list.map(browser.time_zones(), fn(zone) {
    h.option([a.value(zone.0), a.selected(zone.0 == current)], zone.1)
  })
}

fn session_time_select(
  fields: model.FormFields,
  label: String,
  fallback: String,
) {
  let selected = field_value(fields, "time", fallback)
  let times =
    list.index_map(list.repeat(Nil, 96), fn(_, index) {
      let minute = index * 15
      let value =
        string.pad_start(int.to_string(minute / 60), 2, "0")
        <> ":"
        <> string.pad_start(int.to_string(minute % 60), 2, "0")
      h.option(
        [a.value(value), a.selected(value == selected)],
        time_label(minute),
      )
    })
  h.label([a.class("block")], [
    h.text(label),
    h.select([a.class(field), a.name("time"), a.required(True)], [
      h.option([a.value(""), a.selected(selected == "")], "Choose a time"),
      ..times
    ]),
  ])
}

fn time_select(
  label: String,
  name: String,
  value: Int,
  change: fn(Int) -> Msg,
  label_time: fn(Int) -> String,
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
          label_time(index * 15),
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
  let zone =
    field_value(form_fields(model, "weekly-time-zone"), "zone", eastern_zone)
  h.div([a.class("space-y-4")], [
    heading(tutor.name <> " · Weekly schedule"),
    h.p([], [
      h.text(
        "Weekly hours repeat on the Eastern calendar. Each block must allow at least one hour.",
      ),
    ]),
    h.label([a.class("block")], [
      h.text("Display and edit times in"),
      h.select(
        [
          a.class(field),
          e.on_input(fn(value) {
            model.UserEditedForm("weekly-time-zone", [#("zone", value)])
          }),
        ],
        zone_options(zone),
      ),
    ]),
    case zone == eastern_zone {
      True -> element.none()
      False ->
        h.p([a.class("text-sm text-slate-600")], [
          h.text(
            "Showing local times for the Eastern week of "
            <> browser.reference_week()
            <> ". The local day or time can shift when clocks change.",
          ),
        ])
    },
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
              h.legend([], [
                h.text(case zone == eastern_zone {
                  True -> day
                  False -> day <> " (Eastern)"
                }),
              ]),
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
                            "border border-slate-200 bg-slate-50 rounded-lg p-2 mb-2 grid gap-2",
                          ),
                        ],
                        [
                          time_select(
                            "From",
                            "start-" <> int.to_string(index),
                            block.start,
                            model.UserChangedBlockStart(block.id, _),
                            case zone == eastern_zone {
                              True -> time_label
                              False -> browser.weekly_time_label(zone, index, _)
                            },
                          ),
                          time_select(
                            "To",
                            "end-" <> int.to_string(index),
                            block.end,
                            model.UserChangedBlockEnd(block.id, _),
                            case zone == eastern_zone {
                              True -> time_label
                              False -> browser.weekly_time_label(zone, index, _)
                            },
                          ),
                          h.button(
                            [
                              a.type_("button"),
                              a.attribute(
                                "aria-label",
                                "Remove " <> day <> " time block",
                              ),
                              e.on_click(model.UserClickedRemoveBlock(block)),
                              a.class(
                                "justify-self-end rounded px-2 py-1 text-rose-700 hover:bg-rose-50",
                              ),
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
                  a.class(
                    "min-h-10 min-w-10 rounded-lg border border-dashed border-teal-300 bg-teal-50 font-bold text-teal-800 hover:bg-teal-100",
                  ),
                  e.on_click(model.UserClickedAddBlock(index)),
                ],
                [h.text("+")],
              ),
            ])
          },
        ),
      ),
    ]),
    form("reset-hours", "reset", tutor.id, [submit("Restore default hours")]),
  ])
}

fn session_view(model: Model, name: String, session: Session) {
  let fields = form_fields(model, "session-" <> session.id)

  h.details([a.class(panel)], [
    h.summary([a.class("cursor-pointer")], [
      h.text(name <> " · " <> session.label),
      h.span([a.class("block mt-1 text-slate-600 text-xs")], [
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
      booking_zone_select(fields),
      input(fields, "Date", "date", session.date, "date"),
      session_time_select(fields, "Time", session.time),
      submit("Save session"),
      form_error(model, "session-" <> session.id),
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
      form_error(model, "subject-" <> session.id),
    ]),
  ])
}

fn form_error(model: Model, form_id: String) {
  case model.failed_form == Some(form_id) && model.message != "" {
    True ->
      h.p(
        [
          a.id(form_id <> "-error"),
          a.attribute("role", "alert"),
          a.attribute("tabindex", "-1"),
          a.class(
            "rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-900",
          ),
        ],
        [h.text(model.message)],
      )
    False -> element.none()
  }
}

fn booking_view(model: Model, booking: Booking) {
  let fields = form_fields(model, "booking-" <> booking.id)
  let #(email, phone) = case booking.contact_details {
    model.ContactRecorded(email, phone) -> #(email, phone)
    model.ContactNotRecorded -> #("", "")
  }

  h.details([a.class(panel)], [
    h.summary(
      [
        a.class(
          "cursor-pointer font-semibold text-slate-900 marker:text-teal-700",
        ),
      ],
      [
        h.text(booking.name),
        h.span([a.class("mt-1 block text-xs font-normal text-slate-600")], [
          h.text(
            "Order #"
            <> string.uppercase(string.slice(booking.id, 0, 8))
            <> " · "
            <> booking.date
            <> " · "
            <> int.to_string(list.length(booking.sessions))
            <> case list.length(booking.sessions) {
              1 -> " session"
              _ -> " sessions"
            },
          ),
        ]),
        h.span(
          [
            a.class(
              "mt-2 inline-block rounded-md bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-900",
            ),
          ],
          [
            h.text(
              case booking.payment_status {
                model.PendingPayment ->
                  "Awaiting payment · Due "
                  <> format_money(report.order_total(booking))
                model.PaymentComplete ->
                  "Paid " <> format_money(report.amount_paid(booking))
              }
              <> " · Discount "
              <> format_money(booking.discount),
            ),
          ],
        ),
      ],
    ),
    h.div([a.class("mt-4 space-y-3 border-t border-slate-200 pt-4")], [
      case booking.contact_details {
        model.ContactNotRecorded ->
          h.p([a.class("text-sm text-slate-600")], [
            h.text("Email and phone not recorded."),
          ])
        model.ContactRecorded(email, phone) ->
          h.p([a.class("break-words text-sm text-slate-700")], [
            h.text(email <> " · " <> phone),
          ])
      },
      case booking.payment_status {
        model.PendingPayment ->
          h.details(
            [a.class("rounded-lg border border-amber-200 bg-amber-50 p-3")],
            [
              h.summary([a.class("font-semibold")], [h.text("Mark as paid")]),
              form("payment-" <> booking.id, "mark-booking-paid", "", [
                hidden("booking", booking.id),
                h.p([], [
                  h.text(
                    "Confirm that you received the payment outside this site.",
                  ),
                ]),
                submit("Confirm payment received"),
                form_error(model, "payment-" <> booking.id),
              ]),
            ],
          )
        model.PaymentComplete -> element.none()
      },
      h.h3([a.class("font-semibold")], [h.text("Sessions")]),
      keyed.div(
        [a.class("space-y-2")],
        list.map(booking.sessions, fn(session) {
          #(session.id, session_view(model, booking.name, session))
        }),
      ),
      h.details([a.class("rounded-lg border border-slate-200 p-3")], [
        h.summary([], [h.text("Edit order details")]),
        form("booking-" <> booking.id, "edit-booking", "", [
          hidden("booking", booking.id),
          input(fields, "Family contact name", "label", booking.name, "text"),
          form_input(
            fields,
            "Email",
            "contact-email",
            email,
            "email",
            email != "",
          ),
          form_input(
            fields,
            "Phone",
            "contact-phone",
            phone,
            "tel",
            phone != "",
          ),
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
          form_error(model, "booking-" <> booking.id),
        ]),
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
      h.p([], [
        h.text(
          "This reserves the tutor’s time and creates an order awaiting payment. Send the invoice separately.",
        ),
      ]),
      input(fields, "Family contact name", "label", "", "text"),
      input(fields, "Email", "contact-email", "", "email"),
      input(fields, "Phone", "contact-phone", "", "tel"),
      select(
        fields,
        "Tutor",
        "booking-tutor",
        model.data.tutors
          |> list.filter(fn(t) { !t.archived })
          |> list.map(fn(t) { #(t.id, t.name) }),
        "",
      ),
      booking_zone_select(fields),
      input(fields, "Date", "date", "", "date"),
      session_time_select(fields, "Start time", ""),
      input(fields, "Subtotal in cents", "subtotal", "", "number"),
      input(fields, "Discount in cents", "discount", "0", "number"),
      submit("Create pending booking"),
      form_error(model, "manual"),
    ]),
  ])
}

fn reports(model: Model) {
  let bookings =
    report.in_period(model.data.bookings, model.report_from, model.report_to)
  let completed =
    list.filter(bookings, fn(booking) {
      booking.payment_status == model.PaymentComplete
    })
  let recorded =
    list.filter(completed, fn(booking) {
      report.amount_paid(booking) != model.Unrecorded
    })
  h.div([a.class(panel <> " space-y-4")], [
    heading("Reports"),
    h.p([a.class("text-amber-900")], [
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
    h.p([], [h.text("Payments by confirmation date, Eastern time.")]),
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
    empty_state(
      list.length(completed) != list.length(recorded),
      int.to_string(list.length(completed) - list.length(recorded))
        <> " without payment details",
    ),
    h.div([a.class("grid items-start gap-4 md:grid-cols-2")], [
      report_group(
        "Packages",
        list.map([5, 10, 20, 0], fn(hours) {
          let label = case hours {
            0 -> "Package unrecorded"
            _ -> int.to_string(hours) <> "-hour package"
          }
          report_row(
            label,
            list.length(
              list.filter(bookings, fn(booking) { booking.hours == hours }),
            ),
          )
        }),
      ),
      report_group("Booking contacts", case bookings {
        [] -> [h.li([], [empty_state(True, "No contacts in this date range.")])]
        _ ->
          list.map(
            list.unique(list.map(bookings, fn(booking) { booking.name })),
            fn(name) {
              report_row(
                name,
                list.length(
                  list.filter(bookings, fn(booking) { booking.name == name }),
                ),
              )
            },
          )
      }),
    ]),
  ])
}

fn report_group(title: String, rows: List(Element(Msg))) {
  h.section([a.class("rounded-xl border border-slate-200 bg-white px-4")], [
    h.h3([a.class("py-3 font-semibold")], [h.text(title)]),
    h.ul([a.class("divide-y divide-slate-100 border-t border-slate-100")], rows),
  ])
}

fn report_row(label: String, count: Int) {
  h.li([a.class("flex justify-between gap-4 py-2 text-slate-700")], [
    h.span([], [h.text(label)]),
    h.span([a.class("font-semibold tabular-nums")], [
      h.text(int.to_string(count)),
    ]),
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
    Subjects -> "subjects"
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
  h.div([a.class("rounded-xl border border-teal-100 bg-teal-50 p-4")], [
    h.p([a.class("text-xs text-slate-600")], [h.text(label)]),
    h.p([a.class("text-2xl font-semibold mt-1")], [h.text(value)]),
  ])
}

fn empty_state(empty: Bool, message: String) {
  case empty {
    True -> h.p([a.class("text-slate-600 py-2")], [h.text(message)])
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
        <> " m-auto max-w-sm text-slate-900 shadow-xl space-y-4 backdrop:bg-slate-950/30",
      ),
      e.on("cancel", decode.success(model.UserClickedCancelConfirmation))
        |> e.prevent_default,
    ],
    [
      h.h2([a.id("confirmation-title"), a.class("font-semibold text-lg")], [
        h.text(title),
      ]),
      h.p([a.id("confirmation-description"), a.class("text-slate-600")], [
        h.text(description),
      ]),
      h.div([a.class("flex gap-3")], [
        h.button(
          [
            a.type_("button"),
            a.class("rounded border border-slate-300 px-3 py-2"),
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
