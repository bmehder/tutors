import assert from 'node:assert/strict'
import test from 'node:test'
import * as model from '../../planner/build/dev/javascript/christian_tutors_planner/admin/model.mjs'
import { update } from '../../planner/build/dev/javascript/christian_tutors_planner/christian_tutors_admin.mjs'
import { amount_paid, in_period, revenue, discounts } from '../../planner/build/dev/javascript/christian_tutors_planner/admin/reports.mjs'
import { decodeData } from '../../planner/build/dev/javascript/christian_tutors_planner/admin_ffi.mjs'
import { toList, toArray } from '../../planner/build/dev/javascript/christian_tutors_planner/gleam_lists.mjs'

const empty = toList([])
const block = model.Block$Block(0, 0, 900, 1080)
const tutor = model.Tutor$Tutor('tutor-1', 'Test tutor', toList(['Biology']), false, toList([block]))
const data = model.Data$Data(toList([tutor]), empty, toList(['Biology']))
const state = () => model.Model$Model(data, empty, model.Screen$Schedule(tutor, tutor.blocks, empty), model.RequestState$Ready(), '', '', '', '')
const next = (state, message) => update(state, message)[0]

test('removal is confirmed, undo restores the original block, and new IDs remain unique', () => {
  const original = state()
  const requested = next(original, model.Msg$UserClickedRemoveBlock(block))
  assert.deepEqual(requested.screen.blocks, original.screen.blocks)
  const removed = next(next(requested, model.Msg$UserClickedConfirmRemoval()), model.Msg$RemovalAnimationFinished(block))
  assert.equal(toArray(removed.screen.blocks).length, 0)
  const added = next(removed, model.Msg$UserClickedAddBlock(6))
  assert.notEqual(toArray(added.screen.blocks)[0].id, block.id)
  const restored = next(added, model.Msg$UserClickedUndo())
  assert.equal(toArray(restored.screen.blocks).length, 2)
  assert.deepEqual(toArray(restored.screen.blocks).find(item => item.id === block.id), block)
  assert.equal(toArray(restored.screen.removed).length, 0)
})

test('changing a time only edits its block and keeps the saved tutor unchanged', () => {
  const added = next(state(), model.Msg$UserClickedAddBlock(2))
  const changed = next(added, model.Msg$UserChangedBlockStart(0, 915))
  assert.equal(toArray(changed.screen.blocks)[0].start, 915)
  assert.equal(toArray(changed.screen.blocks)[1].start, 900)
  assert.equal(toArray(changed.screen.tutor.blocks)[0].start, 900)
})

test('saving blocks duplicate submissions; failure preserves the draft; success clears undo', () => {
  const changed = next(next(next(state(), model.Msg$UserClickedRemoveBlock(block)), model.Msg$UserClickedConfirmRemoval()), model.Msg$RemovalAnimationFinished(block))
  const saving = next(changed, model.Msg$UserSubmittedForm('weekly-hours', tutor.id, empty))
  assert.ok(model.RequestState$isSaving(saving.request))
  assert.equal(next(saving, model.Msg$UserClickedAddBlock(2)), saving)
  assert.equal(next(saving, model.Msg$UserClickedScreen(model.Screen$Bookings())), saving)
  const failed = next(saving, model.Msg$ServerRejected('Try another time.'))
  assert.deepEqual(failed.screen, changed.screen)
  assert.equal(failed.message, 'Try another time.')
  const saved = next(saving, model.Msg$ServerSaved(data))
  assert.deepEqual(saved.screen.blocks, tutor.blocks)
  assert.equal(toArray(saved.screen.removed).length, 0)
})

test('schedule selection loads the chosen tutor, unknown selections do nothing', () => {
  const original = state()
  assert.equal(next(original, model.Msg$UserSelectedScheduleTutor('missing')), original)
  const opened = next(original, model.Msg$UserSelectedScheduleTutor(tutor.id))
  assert.deepEqual(opened.screen.blocks, tutor.blocks)
})

const booking = (id, date, subtotal, discount) => model.Booking$Booking(id, 'Test family', date, 5, subtotal, discount, empty)
const recorded = model.Money$Recorded
const unknown = model.Money$Unrecorded
const bookings = toList([
  booking('a', '2026-11-01', recorded(50000), recorded(5000)),
  booking('b', '2026-11-30', recorded(0), recorded(0)),
  booking('c', '2026-12-01', recorded(25000), unknown()),
  booking('d', '2026-12-02', unknown(), recorded(1000)),
])

test('reports include both date boundaries and exclude dates outside or in reversed ranges', () => {
  assert.deepEqual(toArray(in_period(bookings, '2026-11-01', '2026-11-30')).map(b => b.id), ['a', 'b'])
  assert.equal(toArray(in_period(bookings, '2026-12-01', '2026-11-01')).length, 0)
  assert.equal(toArray(in_period(bookings, '', '')).length, 4)
})

test('reports distinguish unknown from zero and do not invent missing payments', () => {
  assert.equal(revenue(bookings), 45000)
  assert.equal(discounts(bookings), 6000)
  assert.ok(model.Money$isRecorded(amount_paid(toArray(bookings)[1])))
  assert.ok(model.Money$isUnrecorded(amount_paid(toArray(bookings)[2])))
})

test('JSON boundary preserves zero, unknown amounts, tutor blocks and empty lists', () => {
  const decoded = decodeData({ tutors: [{id:'t',name:'Tutor',subjects:['Biology'],blocks:[{day:6,start:900,end:960}]}], subjects: ['Biology'], bookings: [
    { id:'b',name:'Family',date:'2026-11-14',hours:0,subtotal:0,discount:null,sessions:[] },
  ] })
  assert.ok(model.Money$isRecorded(toArray(decoded.bookings)[0].subtotal))
  assert.ok(model.Money$isUnrecorded(toArray(decoded.bookings)[0].discount))
  assert.equal(toArray(toArray(decoded.tutors)[0].blocks)[0].day, 6)
})


test('unsaved navigation asks first, cancel preserves draft, discard changes screen', () => {
  const draft = next(state(), model.Msg$UserChangedBlockStart(0, 915))
  const asked = next(draft, model.Msg$UserClickedScreen(model.Screen$Reports()))
  assert.ok(model.RequestState$isConfirmingNavigation(asked.request))
  assert.deepEqual(asked.screen, draft.screen)
  const cancelled = next(asked, model.Msg$UserClickedCancelConfirmation())
  assert.ok(model.RequestState$isReady(cancelled.request))
  assert.deepEqual(cancelled.screen, draft.screen)
  const discarded = next(asked, model.Msg$UserClickedDiscardChanges())
  assert.ok(model.Screen$isReports(discarded.screen))
})


test('failed saves retain form drafts; successful saves clear only the submitted form', () => {
  let draft = next(state(), model.Msg$UserEditedForm('tutor-a', toList([['name', 'Anna']])) )
  draft = next(draft, model.Msg$UserEditedForm('tutor-b', toList([['name', 'Becky']])))
  const saving = next(draft, model.Msg$UserSubmittedForm('tutor-a', '', toList([['name', 'Anna']])))
  const failed = next(saving, model.Msg$ServerRejected('Choose subjects.'))
  assert.deepEqual(failed.form_drafts, saving.form_drafts)
  const saved = next(saving, model.Msg$ServerSaved(data))
  assert.deepEqual(toArray(saved.form_drafts).map(([id]) => id), ['tutor-b'])
})
