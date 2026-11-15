import admin/model.{type Block, type Data, type Msg}
import gleam/dynamic.{type Dynamic}

@external(javascript, "../admin_ffi.mjs", "initialData")
pub fn initial_data() -> Data

@external(javascript, "../admin_ffi.mjs", "submit")
pub fn submit(
  fields: List(#(String, String)),
  tutor_id: String,
  dispatch: fn(Msg) -> Nil,
  success: fn(Data) -> Msg,
  failure: fn(String) -> Msg,
) -> Nil

@external(javascript, "../admin_ffi.mjs", "animateRemoval")
pub fn animate_removal(
  block: Block,
  dispatch: fn(Msg) -> Nil,
  confirmed: fn(Block) -> Msg,
) -> Nil

@external(javascript, "../admin_ffi.mjs", "money")
pub fn money(cents: Int) -> String

@external(javascript, "../admin_ffi.mjs", "showConfirmation")
pub fn show_confirmation() -> Nil

@external(javascript, "../admin_ffi.mjs", "focusScreen")
pub fn focus_screen() -> Nil

@external(javascript, "../admin_ffi.mjs", "formFields")
pub fn form_fields(event: Dynamic) -> List(#(String, String))

@external(javascript, "../admin_ffi.mjs", "revealFormError")
pub fn reveal_form_error(form_id: String) -> Nil
