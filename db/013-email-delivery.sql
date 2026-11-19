ALTER TABLE tutor_profiles ADD COLUMN contact_email text
  CHECK (contact_email IS NULL OR length(contact_email) BETWEEN 3 AND 254);

CREATE TABLE outgoing_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_key text NOT NULL UNIQUE,
  reservation_id uuid REFERENCES booking_reservations ON DELETE SET NULL,
  recipient text NOT NULL,
  reply_to text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  delivery_allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  attempted_at timestamptz,
  first_attempt_at timestamptz,
  sent_at timestamptz,
  resend_id text,
  last_error text,
  attempts integer NOT NULL DEFAULT 0
);
