// Editorial landing pages, not categories or restrictions in the booking model.
export const tutoringTopics = [
  {
    slug: 'algebra',
    name: 'Algebra',
    title: 'Online Algebra Tutoring for Homeschool Students',
    description: 'Christian online tutoring for Pre-Algebra, Algebra 1, and Algebra 2. Find a tutor and plan weekly support around your homeschool family.',
    introduction: 'Algebra asks students to connect numbers, symbols, and reasoning. One-on-one tutoring gives your student time to ask questions and work through the steps with a Christian tutor.',
    catalogNames: ['Pre-Algebra', 'Algebra 1', 'Algebra 2'],
    focus: [
      'Revisit the ideas behind a difficult homework problem',
      'Practice equations, expressions, and the reasoning between steps',
      'Review earlier skills that are getting in the way of current work',
      'Prepare questions and practice problems before a quiz or test',
    ],
    bring: ['The class or curriculum your student is using', 'A recent assignment or a few problems that felt difficult', 'Any instructions, methods, or deadlines from the class teacher'],
    questions: [
      ['Does my student need to be in a particular grade?', 'Start with the algebra class or material your student is studying. Homeschool students can work at different levels in different subjects, so the subject matters more than a grade label.'],
      ['Can the same package cover math and another subject?', 'Yes. A student’s hours can be split across subjects. The 10-hour package can also be shared by up to 3 students, and the 20-hour package by up to 5. The 5-hour package is for 1 student.'],
      ['How do we choose an algebra tutor?', 'Read the profiles below and look for the class your student is taking. You can ask a question before booking, then choose a tutor and an available weekly time in the planner.'],
    ],
  },
  {
    slug: 'biology',
    name: 'Biology',
    title: 'Online Biology Tutoring for Homeschool Students',
    description: 'Find Christian online Biology tutors for your homeschool student. Ask questions, review class material, and plan one-on-one weekly sessions.',
    introduction: 'Biology brings together new vocabulary, processes, and connections between living systems. A one-on-one session gives your student room to slow down, ask questions, and explain what they understand.',
    catalogNames: ['Biology'],
    focus: [
      'Break down an unfamiliar concept or process from class',
      'Connect vocabulary with diagrams and examples',
      'Review an assignment and identify where understanding became unclear',
      'Organize questions and review material before an assessment',
    ],
    bring: ['The Biology course or curriculum being used', 'Relevant textbook pages, diagrams, or class notes', 'A short list of questions or topics your student wants to revisit'],
    questions: [
      ['Is tutoring a replacement for a Biology course?', 'Tutoring provides focused support for your student’s learning. Bring the material they are working on so the session can concentrate on the concepts or assignments that need attention. MyFunScience offers separate live online classes.'],
      ['Can we talk to a tutor before choosing a package?', 'Yes. Use the contact form on the tutor’s profile to ask about your student’s material and goals. A conversation is welcome, but it is not required before you plan tutoring.'],
      ['Will our Biology sessions repeat each week?', 'Choose a tutor, a first session, and an available weekly time. The planner builds the weekly routine and lets you review every date before checkout. You can skip a week while planning, with a replacement added at the end.'],
    ],
  },
  {
    slug: 'writing',
    name: 'Writing & English',
    title: 'Online Writing and English Tutoring for Homeschool Students',
    description: 'Christian online Writing and English tutoring for homeschool families. Find support for assignments, composition, and reading, with one-on-one weekly sessions.',
    introduction: 'Writing can feel more manageable when a student can talk through an idea and the next step. Tutoring offers focused time to ask questions about an assignment, practice skills, and work toward clearer expression.',
    catalogNames: ['Intermediate Composition', 'Introduction to Literary Analysis', 'English I: Discovery', 'Upper Elementary Language Arts', 'American Literature'],
    focus: [
      'Understand an assignment’s question, instructions, or rubric',
      'Talk through ideas and organize a piece of writing',
      'Review a draft and practice making revisions',
      'Discuss a reading and connect observations with evidence from the text',
    ],
    bring: ['The assignment and any teacher instructions or rubric', 'A draft, reading passage, or example of recent work', 'Your student’s questions and the assignment deadline'],
    questions: [
      ['Which subject should we choose for writing help?', 'Look at the subjects listed on each tutor’s profile and choose the one closest to your student’s class or material. If you are unsure, contact us and describe what your student is working on.'],
      ['Can one child study writing while a sibling studies science?', 'Yes. The 10- and 20-hour packages can be shared across students and subjects. Each student chooses their own tutor and weekly routine, and the planner checks for scheduling conflicts.'],
      ['What if our assignment does not fit a subject listed here?', 'Contact us with the course name, assignment, and the kind of help you are looking for. We reply to emails within 24 hours and can help you work out the next step.'],
    ],
  },
] as const
