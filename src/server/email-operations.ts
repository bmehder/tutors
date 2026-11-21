import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { emailDeliveryEnabled, tutorEmailDeliveryEnabled, emailQueueStatus, tutorRecipientAllowedSql, adminEmail } from './email-delivery'

type Executor = pg.Pool | pg.PoolClient
const dateLabel = (date: Date | null) => date ? new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short',
}).format(date) + ' Eastern' : ''

export async function startEmailWorkerCheck(db: Executor) {
  if (!(await db.query("SELECT to_regclass('email_worker_status') AS table_name")).rows[0].table_name) return null
  const id = randomUUID()
  await db.query(`INSERT INTO email_worker_status(worker,run_id,started_at)
    VALUES('email-delivery',$1,now()) ON CONFLICT(worker) DO UPDATE SET run_id=excluded.run_id,
    started_at=excluded.started_at,finished_at=NULL,last_error=NULL,sent_count=0`, [id])
  return id
}

export async function finishEmailWorkerCheck(db: Executor, id: string | null, sent: number, succeeded: boolean) {
  if (!id) return
  await db.query(`UPDATE email_worker_status SET finished_at=now(),sent_count=$2,
    last_success_at=CASE WHEN $3 THEN now() ELSE last_success_at END,
    last_error=CASE WHEN $3 THEN NULL ELSE 'The email worker could not complete its check.' END
    WHERE worker='email-delivery' AND run_id=$1`, [id, sent, succeeded])
}

async function workerStatus(db: Executor) {
  if (!(await db.query("SELECT to_regclass('email_worker_status') AS table_name")).rows[0].table_name)
    return { state: 'unavailable', checkedAt: '' }
  const row = (await db.query<{
    started_at: Date; finished_at: Date | null; last_error: string | null;
    running_recently: boolean; checked_recently: boolean;
  }>(`SELECT started_at,finished_at,last_error,started_at>now()-interval '2 minutes' AS running_recently,
    finished_at>now()-interval '15 minutes' AS checked_recently
    FROM email_worker_status WHERE worker='email-delivery'`)).rows[0]
  if (!row) return { state: 'never', checkedAt: '' }
  const state = !row.finished_at ? row.running_recently ? 'running' : 'stalled'
    : row.last_error ? 'failed' : row.checked_recently ? 'healthy' : 'overdue'
  return { state, checkedAt: dateLabel(row.finished_at ?? row.started_at) }
}

export async function emailOperations(db: pg.Pool) {
  const [summary, issues, worker] = await Promise.all([
    emailQueueStatus(db),
    db.query<{ recipient: string; subject: string; attempts: number; state: string; created_at: Date; resend_id: string | null }>(`
      SELECT recipient,subject,attempts,created_at,resend_id,
        CASE WHEN first_attempt_at<=now()-interval '23 hours' THEN 'review' ELSE 'retrying' END AS state
      FROM outgoing_emails e WHERE sent_at IS NULL AND delivery_allowed AND (${tutorRecipientAllowedSql})
        AND (last_error IS NOT NULL OR first_attempt_at<=now()-interval '23 hours')
      ORDER BY first_attempt_at ASC NULLS LAST,created_at LIMIT 20`, [tutorEmailDeliveryEnabled(), adminEmail]),
    workerStatus(db),
  ])
  return {
    state: 'available', deliveryEnabled: emailDeliveryEnabled, tutorDeliveryEnabled: tutorEmailDeliveryEnabled(),
    accepted: summary.delivered, waiting: summary.pending - summary.needsReview - summary.retrying,
    retrying: summary.retrying, needsReview: summary.needsReview, held: summary.held, drafts: summary.drafts,
    oldestWaiting: dateLabel(summary.oldestWaiting), worker,
    issues: issues.rows.map(row => ({ recipient: row.recipient, subject: row.subject, attempts: row.attempts,
      state: row.state, createdAt: dateLabel(row.created_at), providerId: row.resend_id ?? '' })),
  }
}
