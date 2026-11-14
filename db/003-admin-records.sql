CREATE TABLE tutor_profiles (
  tutor_id text PRIMARY KEY,
  name text NOT NULL,
  subjects text[] NOT NULL,
  archived boolean NOT NULL DEFAULT false
);

ALTER TABLE booking_reservations
  ADD COLUMN label text,
  ADD COLUMN subtotal_cents integer CHECK (subtotal_cents >= 0),
  ADD COLUMN discount_cents integer CHECK (discount_cents BETWEEN 0 AND subtotal_cents);

ALTER TABLE booking_sessions
  ADD COLUMN subject text,
  ADD COLUMN id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY;
