import admin/view as admin_view
import christian_tutors_admin as admin
import christian_tutors_planner as planner
import lustre
import planner/view as planner_view
import timetravel

pub fn start_admin() {
  let app = timetravel.application(admin.init, admin.update, admin_view.render)
  let assert Ok(_) = lustre.start(app, "#tutoring-admin", Nil)
  Nil
}

pub fn start_planner() {
  let app =
    timetravel.application(planner.init, planner.update, planner_view.render)
  let assert Ok(runtime) = lustre.start(app, "#family-planner", Nil)
  planner.connect_browser(fn(message) {
    lustre.send(runtime, lustre.dispatch(timetravel.App(message)))
  })
}
