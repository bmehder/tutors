ALTER TABLE booking_reservations
  ADD COLUMN payment_pending boolean NOT NULL DEFAULT false;
