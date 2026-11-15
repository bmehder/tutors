CREATE TABLE tutoring_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  catalog_name text UNIQUE,
  CONSTRAINT subject_name_length CHECK (length(trim(name)) BETWEEN 1 AND 120)
);

CREATE UNIQUE INDEX tutoring_subjects_name_ci ON tutoring_subjects (lower(name));

INSERT INTO tutoring_subjects (name, catalog_name)
SELECT name, name FROM unnest(ARRAY[
  'Biology', 'Chemistry', 'Algebra 1', 'Geometry', 'American Literature',
  'Intermediate Composition', 'United States History', 'World History',
  'Physics', 'Pre-Algebra', 'Algebra 2', 'Middle School Math',
  'Computer Science and Intro to Programming', 'Spanish 1', 'Spanish 2'
]) AS subjects(name);
