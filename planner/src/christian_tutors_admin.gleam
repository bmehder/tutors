import admin/browser
import admin/model.{
  type Model, type Msg, Block, Model, Ready, Saving, Schedule, Tutors,
}
import admin/view
import gleam/int
import gleam/list
import gleam/result
import lustre
import lustre/effect

// Application entry point

pub fn main() {
  let assert Ok(_) =
    lustre.application(init, update, view.render)
    |> lustre.start("#tutoring-admin", Nil)
}

fn init(_) {
  #(
    Model(
      data: browser.initial_data(),
      form_drafts: [],
      screen: Tutors,
      request: Ready,
      message: "",
      subject_filter: "",
      report_from: "",
      report_to: "",
    ),
    effect.none(),
  )
}

// User and server events

pub fn update(model: Model, msg: Msg) {
  case msg {
    model.ServerSaved(data) -> {
      let screen = case model.screen {
        Schedule(tutor, _, _) -> {
          let saved =
            list.find(data.tutors, fn(item) { item.id == tutor.id })
            |> result.unwrap(tutor)
          Schedule(saved, saved.blocks, [])
        }
        model.AddTutor -> Tutors
        screen -> screen
      }
      let drafts = case model.request {
        Saving(form_id) ->
          list.filter(model.form_drafts, fn(draft) { draft.0 != form_id })
        _ -> model.form_drafts
      }
      #(
        Model(
          ..model,
          data:,
          screen:,
          form_drafts: drafts,
          request: Ready,
          message: "Saved.",
          subject_filter: case model.screen {
            model.AddTutor -> ""
            _ -> model.subject_filter
          },
        ),
        effect.none(),
      )
    }

    model.ServerRejected(message) -> #(
      Model(..model, request: Ready, message:),
      effect.none(),
    )

    model.UserClickedCancelConfirmation ->
      case model.request {
        model.ConfirmingRemoval(_) | model.ConfirmingNavigation(_) -> #(
          Model(..model, request: Ready),
          effect.none(),
        )
        _ -> #(model, effect.none())
      }

    model.UserClickedDiscardChanges ->
      case model.request {
        model.ConfirmingNavigation(screen) -> #(
          Model(..model, screen:, request: Ready, message: ""),
          effect.from(fn(_) { browser.focus_screen() }),
        )
        _ -> #(model, effect.none())
      }

    model.UserClickedConfirmRemoval ->
      case model.request {
        model.ConfirmingRemoval(block) -> #(
          Model(..model, request: model.Removing(block)),
          effect.from(fn(dispatch) {
            browser.animate_removal(
              block,
              dispatch,
              model.RemovalAnimationFinished,
            )
          }),
        )
        _ -> #(model, effect.none())
      }

    model.RemovalAnimationFinished(block) ->
      case model.screen, model.request {
        Schedule(tutor, blocks, removed), model.Removing(pending)
          if pending.id == block.id
        -> #(
          Model(
            ..model,
            screen: Schedule(
              tutor,
              list.filter(blocks, fn(item) { item.id != block.id }),
              [block, ..removed],
            ),
            request: Ready,
          ),
          effect.none(),
        )
        _, _ -> #(model, effect.none())
      }

    _ if model.request != Ready -> #(model, effect.none())

    model.UserClickedScreen(screen) -> navigate(model, screen)

    model.UserClickedSchedule(tutor) ->
      navigate(model, Schedule(tutor, tutor.blocks, []))

    model.UserSelectedScheduleTutor(tutor_id) -> {
      case list.find(model.data.tutors, fn(tutor) { tutor.id == tutor_id }) {
        Ok(tutor) -> navigate(model, Schedule(tutor, tutor.blocks, []))
        Error(_) -> #(model, effect.none())
      }
    }

    model.UserSelectedSubjectFilter(value) -> #(
      Model(..model, subject_filter: value),
      effect.none(),
    )

    model.UserChangedReportFrom(value) -> #(
      Model(..model, report_from: value),
      effect.none(),
    )

    model.UserChangedReportTo(value) -> #(
      Model(..model, report_to: value),
      effect.none(),
    )

    model.UserEditedForm(form_id, fields) -> #(
      Model(
        ..model,
        form_drafts: list.key_set(model.form_drafts, form_id, fields),
      ),
      effect.none(),
    )

    model.UserSubmittedForm(form_id, tutor_id, fields) -> #(
      Model(
        ..model,
        request: Saving(form_id),
        message: "",
        form_drafts: list.key_set(model.form_drafts, form_id, fields),
      ),
      effect.from(fn(dispatch) {
        browser.submit(
          fields,
          tutor_id,
          dispatch,
          model.ServerSaved,
          model.ServerRejected,
        )
      }),
    )

    model.UserClickedRemoveBlock(block) -> #(
      Model(..model, request: model.ConfirmingRemoval(block)),
      effect.from(fn(_) { browser.show_confirmation() }),
    )

    msg -> {
      case model.screen {
        Schedule(tutor, blocks, removed) -> {
          let #(blocks, removed) = case msg {
            model.UserClickedAddBlock(day) -> {
              let id =
                list.fold(list.append(blocks, removed), 0, fn(maximum, block) {
                  int.max(maximum, block.id + 1)
                })
              #(
                list.append(blocks, [
                  Block(id: id, day: day, start: 900, end: 960),
                ]),
                removed,
              )
            }
            model.UserChangedBlockStart(id, value) -> #(
              list.map(blocks, fn(block) {
                case block.id == id {
                  True -> Block(..block, start: value)
                  False -> block
                }
              }),
              removed,
            )
            model.UserChangedBlockEnd(id, value) -> #(
              list.map(blocks, fn(block) {
                case block.id == id {
                  True -> Block(..block, end: value)
                  False -> block
                }
              }),
              removed,
            )
            model.UserClickedUndo ->
              case removed {
                [block, ..rest] -> #(list.append(blocks, [block]), rest)
                [] -> #(blocks, removed)
              }
            _ -> #(blocks, removed)
          }
          #(
            Model(
              ..model,
              screen: Schedule(tutor, blocks, removed),
              message: "",
            ),
            effect.none(),
          )
        }
        _ -> #(model, effect.none())
      }
    }
  }
}

// Navigation guard for unsaved schedule changes

fn navigate(model: Model, screen: model.Screen) {
  case model.screen {
    Schedule(tutor, blocks, _) if blocks != tutor.blocks -> #(
      Model(..model, request: model.ConfirmingNavigation(screen)),
      effect.from(fn(_) { browser.show_confirmation() }),
    )
    _ -> #(
      Model(..model, screen:, message: ""),
      effect.from(fn(_) { browser.focus_screen() }),
    )
  }
}
