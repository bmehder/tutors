ALTER TABLE booking_reservations
  ADD COLUMN package_hours integer CHECK (package_hours IN (5, 10, 20));
