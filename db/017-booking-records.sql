-- Cancellation releases time while preserving the order and original sessions.
-- Refunds record money already returned outside this admin app; they never move money.
ALTER TABLE booking_reservations
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancelled_sessions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN refund_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN refund_reference text,
  ADD CONSTRAINT refund_within_payment CHECK (
    refund_cents >= 0 AND
    (refund_cents = 0 OR (
      NOT payment_pending AND subtotal_cents IS NOT NULL AND discount_cents IS NOT NULL
      AND refund_cents <= subtotal_cents - discount_cents
      AND refund_reference IS NOT NULL AND length(trim(refund_reference)) > 0
    ))
  );
