CREATE TABLE email_worker_status (
  worker text PRIMARY KEY CHECK (worker = 'email-delivery'),
  run_id uuid NOT NULL,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  sent_count integer NOT NULL DEFAULT 0 CHECK (sent_count >= 0)
);
