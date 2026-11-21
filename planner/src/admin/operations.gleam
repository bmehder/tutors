import gleam/int
import gleam/list
import gleam/option.{type Option, None, Some}
import lustre/attribute as a
import lustre/element.{type Element}
import lustre/element/html as h

// Operational snapshots are read-only. They never release, reset or resend mail.
pub type DeliverySetting {
  Enabled
  Paused
}

pub type WorkerStatus {
  StatusUnavailable
  NotRun
  Running
  Healthy(checked_at: String)
  Overdue(checked_at: String)
  Stalled(started_at: String)
  Failed(checked_at: String)
}

pub type IssueStatus {
  RetryPending
  NeedsReview
}

pub type EmailIssue {
  EmailIssue(
    recipient: String,
    subject: String,
    attempts: Int,
    status: IssueStatus,
    created_at: String,
    provider_reference: Option(String),
  )
}

pub type EmailCounts {
  EmailCounts(
    accepted: Int,
    waiting: Int,
    retrying: Int,
    needs_review: Int,
    held: Int,
    drafts: Int,
  )
}

pub type Status {
  Unavailable
  Available(
    delivery: DeliverySetting,
    tutor_delivery: DeliverySetting,
    counts: EmailCounts,
    oldest_waiting: String,
    worker: WorkerStatus,
    issues: List(EmailIssue),
  )
}

// Presentation stays separate from refresh events and server-side queue rules.
pub fn view(status: Status) -> Element(msg) {
  case status {
    Unavailable ->
      warning(
        "Email status could not be loaded. Refresh status or ask Brad and Shawn to check the server logs.",
      )
    Available(delivery, tutor_delivery, counts, oldest_waiting, worker, issues) ->
      h.div([a.class("space-y-5")], [
        h.div(
          [a.class("rounded-xl border border-slate-200 bg-white p-4 space-y-2")],
          [
            h.h3([a.class("font-semibold")], [h.text("Email delivery")]),
            h.p([], [
              h.text(case delivery {
                Enabled -> "Customer and admin email: enabled"
                Paused -> "Customer and admin email: paused"
              }),
            ]),
            h.p([], [
              h.text(case tutor_delivery {
                Enabled -> "Tutor email: enabled"
                Paused -> "Tutor email: paused — tutor inquiries go to admin"
              }),
            ]),
            h.p([a.class("text-xs text-slate-600")], [
              h.text(
                "Status checks do not send email. Sandbox tutor messages and older blocked drafts stay blocked.",
              ),
            ]),
          ],
        ),
        h.div([a.class("grid grid-cols-2 gap-3 xl:grid-cols-3")], [
          metric("Sent to Resend", counts.accepted),
          metric("Waiting", counts.waiting),
          metric("Retrying", counts.retrying),
          metric("Needs review", counts.needs_review),
          metric("Tutor messages held", counts.held),
          metric("Drafts / sending blocked", counts.drafts),
        ]),
        h.p([a.class("text-xs text-slate-600")], [
          h.text(
            "Sent means accepted by Resend, not confirmed delivery to the inbox. Check Resend for bounces, complaints and final delivery.",
          ),
        ]),
        case oldest_waiting {
          "" -> element.none()
          date -> h.p([], [h.text("Oldest waiting message: " <> date)])
        },
        worker_view(worker),
        case counts.needs_review > 0 {
          True ->
            warning(
              "Some messages have an uncertain delivery result outside the automatic retry window. Check Resend before attempting another send; resetting a message could send it twice.",
            )
          False -> element.none()
        },
        h.section([a.class("space-y-3")], [
          h.h3([a.class("font-semibold")], [
            h.text("Unsent messages needing attention"),
          ]),
          case issues {
            [] ->
              h.p([a.class("text-slate-600")], [
                h.text("No failed or uncertain messages in the sendable queue."),
              ])
            _ -> h.ul([a.class("space-y-3")], list.map(issues, issue_view))
          },
          h.p([a.class("text-xs text-slate-600")], [
            h.text(
              "Showing up to 20 messages. Drafts and paused tutor messages are counted separately above.",
            ),
          ]),
        ]),
        h.section(
          [a.class("rounded-xl border border-slate-200 bg-white p-4 space-y-3")],
          [
            h.h3([a.class("font-semibold")], [h.text("Who handles what")]),
            h.p([], [
              h.text(
                "Anna monitors admin@mychristiantutors.com for inquiries and scheduling and has access to delivery details in Resend. Brad and Shawn monitor technical issues, failed emails, Stripe alerts and hosting errors.",
              ),
            ]),
            h.div([a.class("flex flex-wrap gap-4")], [
              external_link("https://resend.com/emails", "Resend email logs"),
              external_link(
                "https://github.com/bmehder/tutors/actions/workflows/retry-emails.yml",
                "Scheduled email checks",
              ),
              external_link("https://dashboard.stripe.com/", "Stripe dashboard"),
              external_link(
                "https://vercel.com/brad-mehders-projects/tutors-admin-demo/logs",
                "Hosting logs",
              ),
            ]),
          ],
        ),
      ])
  }
}

fn worker_view(worker: WorkerStatus) -> Element(msg) {
  let message = case worker {
    StatusUnavailable ->
      "Worker heartbeat is not configured yet. Apply the email-worker status migration before relying on these checks."
    NotRun ->
      "No email worker check has been recorded yet. Check the GitHub Actions schedule."
    Running -> "The email worker is checking the queue."
    Healthy(date) -> "Last completed worker check: " <> date
    Overdue(date) ->
      "The worker has not completed a check in over 15 minutes. Last check: "
      <> date
      <> ". Check the scheduler."
    Stalled(date) ->
      "The worker started but did not record completion. Started: "
      <> date
      <> ". Inspect the hosting logs before retrying uncertain messages."
    Failed(date) ->
      "The worker reported a failure: "
      <> date
      <> ". Check hosting and database access."
  }
  case worker {
    Healthy(_) | Running ->
      h.p(
        [
          a.class(
            "rounded-lg border border-teal-200 bg-teal-50 p-4 text-teal-950",
          ),
        ],
        [h.text(message)],
      )
    _ -> warning(message)
  }
}

fn issue_view(issue: EmailIssue) -> Element(msg) {
  h.li(
    [
      a.class(
        "min-w-0 break-words rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-1",
      ),
    ],
    [
      h.p([a.class("font-semibold")], [h.text(issue.subject)]),
      h.p([], [h.text(issue.recipient)]),
      h.p([a.class("text-xs text-slate-700")], [
        h.text(
          case issue.status {
            NeedsReview -> "Manual review needed"
            RetryPending -> "Automatic retry pending"
          }
          <> " · "
          <> int.to_string(issue.attempts)
          <> " attempts · "
          <> issue.created_at,
        ),
      ]),
      case issue.provider_reference {
        None -> element.none()
        Some(reference) ->
          h.p([a.class("text-xs")], [h.text("Resend reference: " <> reference)])
      },
    ],
  )
}

fn metric(label: String, count: Int) -> Element(msg) {
  h.div([a.class("rounded-xl border border-slate-200 bg-white p-4")], [
    h.p([a.class("text-xs text-slate-600")], [h.text(label)]),
    h.p([a.class("mt-1 text-2xl font-semibold tabular-nums")], [
      h.text(int.to_string(count)),
    ]),
  ])
}

fn warning(message: String) -> Element(msg) {
  h.p(
    [
      a.attribute("role", "status"),
      a.class(
        "rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950",
      ),
    ],
    [h.text(message)],
  )
}

fn external_link(url: String, label: String) -> Element(msg) {
  h.a(
    [
      a.href(url),
      a.attribute("target", "_blank"),
      a.attribute("rel", "noopener noreferrer"),
      a.class("font-semibold text-teal-800 underline underline-offset-4"),
    ],
    [h.text(label)],
  )
}
