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
    "min": 4,
    "max": 10,
    "degree": "Algebra 1 · Algebra 2 · Geometry · Biology",
    "bio": "MyFunScience teacher · Tutoring availability shown is fictional.",
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
    "min": 8,
    "max": 12,
    "degree": "Biology · Chemistry",
    "bio": "MyFunScience teacher · Tutoring availability shown is fictional.",
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
    "min": 4,
    "max": 12,
    "degree": "American Literature · Intermediate Composition",
    "bio": "MyFunScience teacher · Tutoring availability shown is fictional.",
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
    "min": 6,
    "max": 12,
    "degree": "United States History · World History",
    "bio": "MyFunScience teacher · Tutoring availability shown is fictional.",
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
    "min": 4,
    "max": 12,
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
    "bio": "MyFunScience teacher · Tutoring availability shown is fictional.",
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
    "min": 4,
    "max": 12,
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
    "bio": "MyFunScience teacher · Tutoring availability shown is fictional.",
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
    "min": 4,
    "max": 12,
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
    "bio": "MyFunScience teacher · Tutoring availability shown is fictional.",
    "color": "#dce9df"
  },
  {
    "id": "anna-pollard",
    "name": "Anna Pollard",
    "initials": "AP",
    "subjects": [
      "Computer Science and Intro to Programming"
    ],
    "min": 4,
    "max": 12,
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
    "bio": "MyFunScience teacher · Tutoring availability shown is fictional.",
    "color": "#ece7cf"
  }
];
export const packages=[{hours:5,rate:80,name:'A little direction',desc:'Work through a tricky topic or prepare for a test.'},{hours:10,rate:75,name:'Room to grow',desc:'Build momentum with steady, personal support.'},{hours:20,rate:70,name:'A strong foundation',desc:'Invest in lasting understanding and confidence.'}];
export const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:2}).format(n);
