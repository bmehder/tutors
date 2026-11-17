INSERT INTO tutoring_subjects (name, catalog_name)
SELECT name, name FROM unnest(ARRAY[
  'Science Lab Explorations',
  'Old Testament Survey',
  'Introduction to Literary Analysis',
  'English I: Discovery',
  'German 1',
  'German 2',
  'Anatomy & Physiology',
  'High School Astronomy',
  'Informal Logic',
  'Upper Elementary Language Arts',
  'Upper Elementary US & World Geography',
  'Consumer Math',
  'Economics'
]) AS subjects(name)
ON CONFLICT DO NOTHING;
