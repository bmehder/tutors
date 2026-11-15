ALTER TABLE booking_reservations
  ADD COLUMN stripe_checkout_required boolean NOT NULL DEFAULT false,
  ADD COLUMN stripe_checkout_id text UNIQUE,
  ADD CONSTRAINT stripe_checkout_link CHECK (
    stripe_checkout_id IS NULL OR stripe_checkout_required
  );
