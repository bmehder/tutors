ALTER TABLE booking_reservations
  ADD COLUMN contact_email text,
  ADD COLUMN contact_phone text,
  ADD COLUMN requires_contact boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT booking_contact_complete CHECK (
    (NOT requires_contact AND contact_email IS NULL AND contact_phone IS NULL)
    OR (
      label IS NOT NULL AND length(trim(label)) > 0
      AND contact_email IS NOT NULL AND length(trim(contact_email)) > 0
      AND contact_phone IS NOT NULL AND length(trim(contact_phone)) > 0
    )
  );
