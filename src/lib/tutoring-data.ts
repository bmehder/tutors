// Names and teaching subjects: https://myfunscience.com/schedule/
// All tutoring availability is fictional demo data, not the school timetable.
export const tutors=[
  {
    "id": "melissa-lopez",
    "name": "Melissa Lopez",
    "initials": "ML",
    "subjects": [
      "Algebra 1",
      "Algebra 2",
      "Geometry",
      "Biology"
    ],
    "degree": "Algebra 1 · Algebra 2 · Geometry · Biology",
    "color": "#e5d8ca",
    "days": [
      0,
      1,
      3
    ],
    "times": [
      "3:00 PM",
      "3:15 PM",
      "3:30 PM",
      "3:45 PM",
      "4:00 PM",
      "4:15 PM",
      "4:30 PM",
      "4:45 PM",
      "5:00 PM"
    ]
  },
  {
    "id": "heather-barrieau",
    "name": "Heather Barrieau",
    "initials": "HB",
    "subjects": [
      "Biology",
      "Chemistry"
    ],
    "degree": "Biology · Chemistry",
    "color": "#d4e1dc",
    "days": [
      1,
      2,
      4
    ],
    "times": [
      "4:00 PM",
      "5:00 PM",
      "6:00 PM"
    ]
  },
  {
    "id": "gayle-foley",
    "name": "Gayle Foley",
    "initials": "GF",
    "subjects": [
      "American Literature",
      "Intermediate Composition"
    ],
    "degree": "American Literature · Intermediate Composition",
    "color": "#f2d9d2",
    "days": [
      0,
      2,
      3
    ],
    "times": [
      "2:00 PM",
      "3:00 PM",
      "4:00 PM"
    ]
  },
  {
    "id": "becky-coffey",
    "name": "Becky Coffey",
    "initials": "BC",
    "subjects": [
      "United States History",
      "World History"
    ],
    "degree": "United States History · World History",
    "color": "#e4e2ca",
    "days": [
      1,
      3,
      4
    ],
    "times": [
      "3:00 PM",
      "5:00 PM",
      "6:00 PM"
    ]
  },
  {
    "id": "chris-leingang",
    "name": "Chris Leingang",
    "initials": "CL",
    "subjects": [
      "Physics",
      "Chemistry"
    ],
    "days": [
      0,
      2,
      5
    ],
    "times": [
      "10:00 AM",
      "11:00 AM",
      "1:00 PM"
    ],
    "degree": "Physics · Chemistry",
    "color": "#dfe6f1"
  },
  {
    "id": "lisa-rainey",
    "name": "Lisa Rainey",
    "initials": "LR",
    "subjects": [
      "Pre-Algebra",
      "Middle School Math"
    ],
    "days": [
      1,
      4,
      5
    ],
    "times": [
      "9:00 AM",
      "10:00 AM",
      "2:00 PM"
    ],
    "degree": "Pre-Algebra · Middle School Math",
    "color": "#ebe2ee"
  },
  {
    "id": "marji-mcilvaine",
    "name": "Marji McIlvaine",
    "initials": "MM",
    "subjects": [
      "Spanish 1",
      "Spanish 2"
    ],
    "days": [
      2,
      5,
      6
    ],
    "times": [
      "1:00 PM",
      "2:00 PM",
      "3:00 PM"
    ],
    "degree": "Spanish 1 · Spanish 2",
    "color": "#dce9df"
  },
  {
    "id": "anna-pollard",
    "name": "Anna Pollard",
    "initials": "AP",
    "subjects": [
      "Computer Science and Intro to Programming"
    ],
    "days": [
      3,
      5,
      6
    ],
    "times": [
      "10:00 AM",
      "11:00 AM",
      "4:00 PM"
    ],
    "degree": "Computer Science and Intro to Programming",
    "color": "#ece7cf"
  },
  {"id": "angie-baer", "name": "Angie Baer", "initials": "AB", "subjects": ["Science Lab Explorations", "Old Testament Survey"], "days": [] as number[], "times": [] as string[]},
  {"id": "jana-bontrager", "name": "Jana Bontrager", "initials": "JB", "subjects": ["Introduction to Literary Analysis", "English I: Discovery"], "days": [] as number[], "times": [] as string[]},
  {"id": "faith-cruz", "name": "Faith Cruz", "initials": "FC", "subjects": ["German 1", "German 2"], "days": [] as number[], "times": [] as string[]},
  {"id": "christine-filipek", "name": "Christine Filipek", "initials": "CF", "subjects": ["Anatomy & Physiology", "High School Astronomy"], "days": [] as number[], "times": [] as string[]},
  {"id": "claire-hamilton", "name": "Claire Hamilton", "initials": "CH", "subjects": ["Informal Logic"], "days": [] as number[], "times": [] as string[]},
  {"id": "beth-swinderman", "name": "Beth Swinderman", "initials": "BS", "subjects": ["Upper Elementary Language Arts", "Upper Elementary US & World Geography"], "days": [] as number[], "times": [] as string[]},
  {"id": "sarah-westcott", "name": "Sarah Westcott", "initials": "SW", "subjects": ["Consumer Math", "Economics"], "days": [] as number[], "times": [] as string[]}
];
export const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:2}).format(n);

export const SUBJECTS = [
	'Biology',
	'Chemistry',
	'Algebra 1',
	'Geometry',
	'American Literature',
	'Intermediate Composition',
	'United States History',
	'World History',
	'Physics',
	'Pre-Algebra',
	'Algebra 2',
	'Middle School Math',
	'Computer Science and Intro to Programming',
	'Spanish 1',
	'Spanish 2',
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
	'Economics',
]
