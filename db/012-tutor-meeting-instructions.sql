ALTER TABLE tutor_profiles
  ADD COLUMN meeting_instructions text NOT NULL DEFAULT ''
  CHECK (length(meeting_instructions) <= 4000);
