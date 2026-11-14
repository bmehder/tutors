CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE booking_reservations (
  id uuid PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz
);

CREATE TABLE booking_sessions (
  reservation_id uuid NOT NULL REFERENCES booking_reservations ON DELETE CASCADE,
  tutor_id text NOT NULL,
  slot tstzrange NOT NULL,
  EXCLUDE USING gist (tutor_id WITH =, slot WITH &&)
);
