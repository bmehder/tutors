// Browser boundary: JSON decoding, HTTP, native confirmations and animation.
// Navigation, schedule drafts, undo, and report calculations live in Gleam.
import * as model from './admin/model.mjs'
import * as operations from './admin/operations.mjs'
import { Option$None, Option$Some } from '../gleam_stdlib/gleam/option.mjs'
import { toList, toArray } from './gleam_lists.mjs'

const decodeMoney = cents =>
	cents === null ? model.Money$Unrecorded() : model.Money$Recorded(cents)

export function decodeData(data) {
	return model.Data$Data(
		toList(
			data.tutors.map(tutor =>
				model.Tutor$Tutor(
					tutor.id,
					tutor.name,
					toList(tutor.subjects),
					tutor.archived ?? false,
					toList(
						tutor.blocks.map((block, id) =>
							model.Block$Block(id, block.day, block.start, block.end),
						),
					),
					tutor.meetingInstructions ?? '',
					tutor.contactEmail ?? '',
				),
			),
		),
		toList(
			data.bookings.map(booking =>
				model.Booking$Booking(
					booking.id,
					booking.name,
					booking.date,
					booking.hours,
					decodeMoney(booking.subtotal),
					decodeMoney(booking.discount),
					toList(
						booking.sessions.map(session =>
							model.Session$Session(
								session.id,
								session.tutor,
								session.subject,
								session.date,
								session.time,
								session.label,
							),
						),
					),
					booking.paymentPending
						? model.PaymentStatus$PendingPayment()
						: model.PaymentStatus$PaymentComplete(),
					booking.contactEmail && booking.contactPhone
						? model.ContactDetails$ContactRecorded(booking.contactEmail, booking.contactPhone)
						: model.ContactDetails$ContactNotRecorded(),
				),
			),
		),
		toList(data.subjects),
		decodeOperations(data.operations),
	)
}

export function decodeOperations(status) {
  if (status?.state !== 'available') return operations.Status$Unavailable()
  const worker = status.worker
  const workerStates = {
    unavailable: () => operations.WorkerStatus$StatusUnavailable(),
    never: () => operations.WorkerStatus$NotRun(),
    running: () => operations.WorkerStatus$Running(),
    healthy: () => operations.WorkerStatus$Healthy(worker.checkedAt),
    overdue: () => operations.WorkerStatus$Overdue(worker.checkedAt),
    stalled: () => operations.WorkerStatus$Stalled(worker.checkedAt),
    failed: () => operations.WorkerStatus$Failed(worker.checkedAt),
  }
  return operations.Status$Available(
    status.deliveryEnabled ? operations.DeliverySetting$Enabled() : operations.DeliverySetting$Paused(),
    status.tutorDeliveryEnabled ? operations.DeliverySetting$Enabled() : operations.DeliverySetting$Paused(),
    operations.EmailCounts$EmailCounts(status.accepted, status.waiting, status.retrying, status.needsReview, status.held, status.drafts),
    status.oldestWaiting,
    (workerStates[worker?.state] ?? workerStates.unavailable)(),
    toList(status.issues.map(issue => operations.EmailIssue$EmailIssue(
      issue.recipient, issue.subject, issue.attempts,
      issue.state === 'review' ? operations.IssueStatus$NeedsReview() : operations.IssueStatus$RetryPending(),
      issue.createdAt, issue.providerId ? Option$Some(issue.providerId) : Option$None(),
    ))),
  )
}

export function refresh(dispatch, success, failure) {
  fetch('/admin', { headers: { Accept: 'application/json' } })
    .then(async response => {
      if (!response.ok) throw new Error(response.status === 401 ? 'Your session expired. Reload and sign in again.' : 'Status could not be refreshed. Please try again.')
      return response.json()
    })
    .then(data => dispatch(success(decodeData(data))))
    .catch(error => dispatch(failure(error.message)))
}

export function initialData() {
	return decodeData(JSON.parse(document.getElementById('admin-data').textContent))
}

export function submit(fields, tutorId, dispatch, success, failure) {
	const body = new FormData()
	toArray(fields).forEach(([name, value]) => body.append(name, value))
	const headers = { Accept: 'application/json' }
	fetch('/admin?tutor=' + encodeURIComponent(tutorId), {
		method: 'POST',
		headers,
		body,
	})
		.then(async response => {
			if (!response.ok) {
				const content = await response.text()
				let message = 'The change could not be saved. Please try again.'
				try {
					message = JSON.parse(content).error ?? message
				} catch {
					if (response.status === 403)
						message = 'Your session expired. Reload and sign in again.'
				}
				throw new Error(message)
			}
			const refreshed = await fetch('/admin', { headers })
			if (!refreshed.ok)
				throw new Error(
					'Saved, but the updated data could not be loaded. Please reload.',
				)
			return refreshed.json()
		})
		.then(data => dispatch(success(decodeData(data))))
		.catch(error => dispatch(failure(error.message)))
}

export function animateRemoval(block, dispatch, confirmed) {
	const element = document.getElementById('block-' + model.Block$Block$id(block))
	const finish = () => dispatch(confirmed(block))
	if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
		return finish()
	element
		.animate(
			[
				{ opacity: 1, maxHeight: element.offsetHeight + 'px' },
				{ opacity: 0, maxHeight: '0px', padding: 0, marginBottom: 0 },
			],
			{ duration: 220, easing: 'ease-out' },
		)
		.finished.then(finish, finish)
}

export function money(cents) {
	return cents < 0
		? 'Unrecorded'
		: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
				cents / 100,
			)
}

// HTML dialogs supply focus trapping, Escape handling and an inert backdrop.
export function showConfirmation() {
	requestAnimationFrame(() =>
		document.getElementById('admin-confirmation')?.showModal(),
	)
}

export function focusScreen() {
	requestAnimationFrame(() => {
		document.querySelector('#tutoring-admin main h2')?.focus({ preventScroll: true })
		window.scrollTo({ top: 0, behavior: 'instant' })
	})
}

export function revealFormError(formId) {
	requestAnimationFrame(() => {
		const error = document.getElementById(formId + '-error')
		if (!error) return
		for (let details = error.closest('details'); details; details = details.parentElement?.closest('details')) {
			details.open = true
		}
		error.focus()
	})
}
