ALTER TABLE booking_reservations
  ADD COLUMN checkout_request_id uuid UNIQUE,
  ADD COLUMN checkout_request_hash text,
  ADD COLUMN checkout_origin text,
  ADD COLUMN checkout_creation_at timestamptz,
  ADD COLUMN checkout_released_at timestamptz,
  ADD COLUMN checkout_reconcile_after timestamptz,
  ADD CONSTRAINT released_checkout_is_unconfirmed CHECK (checkout_released_at IS NULL OR confirmed_at IS NULL),
  ADD CONSTRAINT checkout_request_complete CHECK (
    (checkout_request_id IS NULL AND checkout_request_hash IS NULL)
    OR (checkout_request_id IS NOT NULL AND checkout_request_hash IS NOT NULL)
  );

CREATE INDEX checkout_expired_holds ON booking_reservations(expires_at)
  WHERE confirmed_at IS NULL AND checkout_released_at IS NULL;
