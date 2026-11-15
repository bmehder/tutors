CREATE TABLE tutor_profile_slugs (
  tutor_id text PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

-- Reserve the URLs of the built-in tutors before assigning slugs to admin records.
INSERT INTO tutor_profile_slugs (tutor_id, slug)
SELECT id, id FROM unnest(ARRAY[
  'melissa-lopez', 'heather-barrieau', 'gayle-foley', 'becky-coffey',
  'chris-leingang', 'lisa-rainey', 'marji-mcilvaine', 'anna-pollard'
]) AS tutors(id);

CREATE FUNCTION assign_tutor_profile_slug(tutor_id_arg text, tutor_name text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  base text;
  candidate text;
  suffix integer := 1;
BEGIN
  PERFORM pg_advisory_xact_lock(845016);
  IF EXISTS (SELECT 1 FROM tutor_profile_slugs WHERE tutor_id = tutor_id_arg) THEN
    RETURN;
  END IF;

  base := trim(BOTH '-' FROM regexp_replace(
    lower(regexp_replace(normalize(tutor_name, NFKD), U&'[\0300-\036F]', '', 'g')),
    '[^a-z0-9]+', '-', 'g'
  ));
  base := COALESCE(NULLIF(base, ''), 'tutor');
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM tutor_profile_slugs WHERE slug = candidate) LOOP
    suffix := suffix + 1;
    candidate := base || '-' || suffix;
  END LOOP;

  INSERT INTO tutor_profile_slugs (tutor_id, slug) VALUES (tutor_id_arg, candidate);
END;
$$;

SELECT assign_tutor_profile_slug(tutor_id, name)
FROM tutor_profiles
ORDER BY tutor_id;

CREATE FUNCTION assign_new_tutor_profile_slug()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM assign_tutor_profile_slug(NEW.tutor_id, NEW.name);
  RETURN NEW;
END;
$$;

CREATE TRIGGER tutor_profiles_assign_slug
AFTER INSERT ON tutor_profiles
FOR EACH ROW EXECUTE FUNCTION assign_new_tutor_profile_slug();
