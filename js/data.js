// Static plan content, ported from Winter_Arc_2026_Tracker.xlsx.
// Numbers that depend on the user (calories, weights, dates) live in settings instead.

export const DEFAULT_SETTINGS = {
  displayName: '',
  arcStart: '2026-10-01',
  arcEnd: '2026-12-31',
  wakeTarget: '06:45',
  lightsOutTarget: '22:45',
  minSleepHours: 7,
  skillTargetWeekday: 30,
  skillTargetSunday: 120,
  goodDayThreshold: 0.8,
  startWeight: 80,
  targetWeight: 60,
  lossPerWeekHigh: 0.7,
  lossPerWeekLow: 0.5,
  rateChangePoint: 70,
  calorieTarget: 2200,
  proteinTarget: 135,
  phases: [
    { name: '1 · Reset', start: '2026-10-01', end: '2026-10-18',
      focus: 'Fix sleep. Lock in the non-negotiables: college, gym, internship.',
      targets: 'Wake at 6:45 every day (Sunday max 8:00). Bedtime moves 30 min earlier every 2–3 days until 10:45. Skill study can be 15–20 min. Attend every class.' },
    { name: '2 · Build', start: '2026-10-19', end: '2026-11-15',
      focus: 'Full daily routine running. Assignment system live.',
      targets: 'Skill study 30 min Mon–Sat + 2 h Sunday. Zero assignments submitted late. Gym 5+ days/week. Diet on plan 6/7 days.' },
    { name: '3 · Push', start: '2026-11-16', end: '2026-12-13',
      focus: 'Hold the routine under pressure (likely exam/submission season).',
      targets: 'Average daily score 80%+. If exams hit: skill study drops to 15 min, gym can drop to 4 days. Sleep is never cut.' },
    { name: '4 · Finish Strong', start: '2026-12-14', end: '2026-12-31',
      focus: 'Close out loose ends, review, set up 2027.',
      targets: 'All assignments submitted. One finished skill project to show. Final weigh-in and full arc review on Dec 31.' },
  ],
  automationsDone: [],
};

// The seven daily goals. `key` is the field on a log row (derived ones are computed).
export const GOALS = [
  { key: 'college', label: '1 · Regular to college', short: 'College', extra: 'Off' },
  { key: 'internship', label: '2 · Internship consistency', short: 'Internship' },
  { key: 'gym', label: '3 · Gym consistency', short: 'Gym', extra: 'Rest' },
  { key: 'diet', label: '4 · Diet maintained', short: 'Diet' },
  { key: 'skillOk', label: '5 · Extra studies (target met)', short: 'Skill', derived: true },
  { key: 'sleepOk', label: '6 · Sleep on target', short: 'Sleep', derived: true },
  { key: 'assignments', label: '7 · Assignment work done', short: 'Assignments' },
];

export const ASSIGNMENT_STATUSES = ['Not started', 'In progress', 'Submitted'];

export const SCHEDULE = {
  weekday: [
    ['6:45 AM', 'Wake. Water. No phone for 15 min', '6 Sleep'],
    ['7:00 AM', 'Breakfast + supplements (Omega-3, Calcium + D3, Multivitamin)', '4 Diet'],
    ['7:20 AM', 'Skill study: one topic, phone in another room', '5 Extra studies'],
    ['7:50 AM', 'Get ready + commute', '1 College'],
    ['9:00 AM', 'College (use free periods for assignments)', '1 College / 7 Assignments'],
    ['1:00 PM', 'Lunch (packed from Sunday prep)', '4 Diet'],
    ['4:00 PM', 'Commute + pre-gym snack', '4 Diet'],
    ['4:30 PM', 'Gym: follow your split, out by 5:40', '3 Gym'],
    ['5:40 PM', 'Whey post-workout + shower', '3 Gym / 4 Diet'],
    ['6:00 PM', 'Internship', '2 Internship'],
    ['9:00 PM', 'Dinner', '4 Diet'],
    ['9:30 PM', 'Assignments / revision (45 min)', '7 Assignments'],
    ['10:15 PM', 'Wind-down: 2-min log, pack bag, plan tomorrow. No screens after', '6 Sleep'],
    ['10:45 PM', 'Lights out', '6 Sleep'],
  ],
  sunday: [
    ['8:00 AM', 'Wake (max 75 min later than weekdays)', '6 Sleep'],
    ['8:30 AM', 'Breakfast + supplements', '4 Diet'],
    ['9:30 AM', 'Skill deep block (2 h): build, not just watch', '5 Extra studies'],
    ['11:30 AM', "Assignment catch-up + check the week's due dates", '7 Assignments'],
    ['1:00 PM', 'Lunch, then free time / rest', '—'],
    ['5:00 PM', 'Meal prep for Mon–Wed + refill pill box', '4 Diet'],
    ['6:00 PM', 'Internship (only if it runs on Sundays)', '2 Internship'],
    ['9:00 PM', "Weekly Review (15 min) + set week's focus", 'All'],
    ['10:15 PM', 'Wind-down', '6 Sleep'],
    ['10:45 PM', 'Lights out', '6 Sleep'],
  ],
  note: 'Night outs: Saturday night only during the arc (Sunday is your only free morning now). A second one must end by 10:30 PM.',
};

const WALK = 'Finish: 10 min incline walk (incline 8–12, 5–5.5 km/h)';
export const GYM = {
  intro: '70 min: 5 min warm-up → lifting → 10 min incline walk. Sunday = rest + 30–45 min walk.',
  days: [
    { day: 'Mon', focus: 'Legs A (quad, heaviest day)', finish: WALK, ex: [
      ['Back squat', 4, '6–8', '2–3 min', 'Depth to parallel, brace hard'],
      ['Leg press', 3, '10–12', '90 s', "Full range, don't lock knees"],
      ['Walking lunges', 3, '10 / leg', '90 s', 'Long stride, upright torso'],
      ['Leg extension', 3, '12–15', '60 s', 'Pause 1 s at top'],
      ['Standing calf raise', 4, '12–15', '60 s', 'Full stretch at bottom'],
      ['Plank', 3, '40 s', '45 s', 'Ribs down, glutes squeezed'],
    ]},
    { day: 'Tue', focus: 'Push A (chest)', finish: WALK, ex: [
      ['Barbell bench press', 4, '6–8', '2–3 min', 'Shoulder blades pinned'],
      ['Incline dumbbell press', 3, '8–10', '90 s', '30° bench'],
      ['Seated dumbbell shoulder press', 3, '8–10', '90 s', "Don't arch lower back"],
      ['Cable lateral raise', 3, '12–15', '60 s', 'Lead with elbows'],
      ['Triceps rope pushdown', 3, '10–12', '60 s', 'Elbows fixed at sides'],
    ]},
    { day: 'Wed', focus: 'Pull A (back width)', finish: WALK, ex: [
      ['Lat pulldown / pull-ups', 4, '8–10', '2 min', 'Pull elbows to ribs'],
      ['Seated cable row', 3, '8–10', '90 s', 'Chest up, squeeze 1 s'],
      ['Single-arm dumbbell row', 3, '10 / arm', '60 s', 'No torso twist'],
      ['Face pull', 3, '15', '60 s', 'Pull to forehead, thumbs back'],
      ['Barbell curl', 3, '8–10', '60 s', 'No swinging'],
    ]},
    { day: 'Thu', focus: 'Legs B (hamstrings, glutes)', finish: WALK, ex: [
      ['Romanian deadlift', 4, '6–8', '2–3 min', 'Hips back, bar close, flat back'],
      ['Bulgarian split squat', 3, '8 / leg', '90 s', 'Front foot far enough forward'],
      ['Lying leg curl', 3, '10–12', '60 s', 'Slow lowering'],
      ['Hip thrust', 3, '10', '90 s', 'Chin tucked, full lockout'],
      ['Seated calf raise', 4, '15', '45 s', 'Pause at bottom'],
      ['Hanging knee raise', 3, '12', '45 s', 'No swinging'],
    ]},
    { day: 'Fri', focus: 'Push B (shoulders)', finish: WALK, ex: [
      ['Standing overhead press', 4, '6–8', '2–3 min', 'Glutes tight, bar over mid-foot'],
      ['Machine / incline chest press', 3, '8–10', '90 s', 'Controlled tempo'],
      ['Dips or push-ups', 3, 'Max (stop 1–2 short)', '90 s', 'Assisted dips are fine'],
      ['Dumbbell lateral raise', 4, '12–15', '60 s', 'Light weight, strict form'],
      ['Overhead triceps extension', 3, '10–12', '60 s', 'Full stretch'],
    ]},
    { day: 'Sat', focus: 'Pull B (back thickness)', finish: WALK, ex: [
      ['Barbell row', 4, '6–8', '2 min', 'Torso ~45°, pull to lower chest'],
      ['Chin-ups (assisted if needed)', 3, 'Max (stop 1–2 short)', '2 min', 'Full hang to chin over bar'],
      ['Chest-supported row', 3, '10', '90 s', 'Squeeze shoulder blades'],
      ['Rear delt fly', 3, '15', '60 s', 'Light, slow'],
      ['Hammer curl', 3, '10', '60 s', 'Neutral grip'],
    ]},
    { day: 'Sun', focus: 'Rest', finish: '', ex: [
      ['Walk 30–45 min', 1, '—', '—', 'Easy pace. Recovery, not training'],
    ]},
  ],
  progression: [
    'Use a weight where the last rep of each set is hard but clean (1–2 reps left in the tank).',
    'When you hit the TOP of the rep range on every set, add 2.5 kg (upper body) or 5 kg (lower body) next session.',
    'In a calorie deficit, holding your strength is a win. If lifts stall 2 weeks in a row, check sleep and protein before cutting more calories.',
    'If a day collapses: do the first 2 exercises only (about 30 min). Zero is the only fail.',
  ],
  cycle: [
    ['Oct 1–4', 'Intro', 'Learn the split; use about 70% of usual weights'],
    ['Oct 5 / 12 / 19', 'Build', 'Progress weights every session you hit the top reps'],
    ['Oct 26', 'Deload', 'Same exercises, half the sets, about 80% weight. Diet unchanged'],
    ['Nov 2 / 9 / 16', 'Build', 'Progress'],
    ['Nov 23', 'Deload', 'Half sets, about 80% weight'],
    ['Nov 30 / Dec 7 / 14', 'Build', 'Progress (exam weeks: 4 days minimum, keep first 2 lifts)'],
    ['Dec 21', 'Deload', 'Half sets, about 80% weight'],
    ['Dec 28–31', 'Build', 'Start the next cycle'],
  ],
};

export const DIET = {
  intro: 'Indian meals, fit to your college/gym/internship day. Numbers are approximate; the weekly weight average is the real judge.',
  fixed: [
    ['Cooking oil', '3–4 tsp', 'total for the whole day, measured, not poured'],
    ['Water', '3–3.5 L', 'more on gym days'],
    ['Steps', '8,000+', 'college walking + 10-min incline walk counts'],
  ],
  meals: [
    ['7:00 AM', 'Breakfast + supplements', '2 moong dal chillas (80 g dal) + 150 g low-fat curd', 'Same, or 3 idli + sambar + 1 whole egg + 2 egg whites', 420, 24],
    ['1:00 PM', 'Lunch (packed)', '3 phulkas (no ghee) + 1 bowl dal + soya chunk curry (30 g dry) + sabzi + salad + 1 fruit', '2 phulkas + 1 bowl dal + 150 g skinless chicken curry + sabzi + salad + 1 fruit', 780, 36],
    ['4:00 PM', 'Pre-gym', '1 banana + 30 g roasted chana', 'Same', 215, 7],
    ['5:40 PM', 'Post-workout', '1 scoop whey in water', 'Same', 120, 24],
    ['9:00 PM', 'Dinner', '2 phulkas or 1 cup rice + 150 g low-fat paneer bhurji + sabzi', '2 phulkas or 1 cup rice + 150 g fish (grilled/curry) + sabzi', 570, 36],
    ['9:30 PM', 'Before assignments', '200 ml toned milk (no sugar)', 'Same', 120, 6],
  ],
  mealNote: 'Non-veg days land around the same calories with ~20 g more protein. Supplements (Omega-3, Calcium + D3, Multivitamin) stay with breakfast.',
  swaps: [
    'Oats (60 g) cooked in 250 ml toned milk + 1 banana + 1 tsp chia + 1 scoop whey moved here on rest days',
    '2 ragi dosas + chutney + 150 g curd (ragi + curd = your best calcium breakfast)',
    'Vegetable poha (60 g) + 150 g curd + 15 g peanuts',
    '3 idli + sambar + 1 whole egg + 2 egg whites (non-veg days)',
  ],
  weekend: [
    'Sunday (no gym): skip the pre-gym snack, take whey with breakfast. Same lunch and dinner. Meal prep at 5 PM.',
    'Saturday night out: light lunch, eat protein first. One plate of biryani OR grilled/tandoori, not both. No sugary drinks.',
    "After a night out, Sunday is a normal day. Don't starve to 'make up for it'. That's how the binge-restrict cycle starts.",
  ],
  eatOften: ['Fish 2×/week (omega-3)', 'Oats, dal, rajma, chana (soluble fiber lowers LDL)', 'Ragi, curd, toned milk, sesame (calcium)', 'Skinless chicken, egg whites, soya, low-fat paneer', 'Vegetables + 2 fruits daily'],
  limit: ['Ghee, butter, cream, malai', 'Fried snacks (samosa, bajji, puri)', 'Mutton/red meat: max 1×/week', 'Whole eggs: about 1 yolk/day', 'Sugar in chai, bakery items, sweets, cold drinks'],
  stepDowns: [
    ['80 – 76 kg', 2200, 135],
    ['75 – 71 kg', 2100, 130],
    ['70 – 66 kg', 2000, 125],
    ['65 – 60 kg', 1950, 120],
  ],
  adjustRule: 'If your 2-week average drops less than 0.4 kg/week, cut 150 kcal (remove the milk or 1 phulka). If it drops more than 1.2 kg/week, or you feel drained in the gym, add 150 kcal. Never go below ~1,800 kcal while training 6 days.',
  bloodTest: 'Get a lipid profile and calcium/vitamin D blood test in early January and review it with a doctor, so you can see whether this is working on the inside too.',
};

export const WEIGHT_MILESTONES = [
  ['2026-10-01', 'Start'],
  ['2026-10-31', 'Month 1'],
  ['2026-11-30', 'Month 2'],
  ['2026-12-31', 'End of Winter Arc'],
  ['2027-01-31', ''],
  ['2027-02-28', 'Near 65 kg: re-judge the target by waist and mirror'],
  ['2027-03-31', ''],
  ['2027-04-30', ''],
  ['2027-05-31', 'Around target: switch to maintenance'],
  ['2027-06-30', 'Maintenance'],
];

export const AUTOMATIONS = [
  ['Three recurring alarms', 'Phone clock: 6:45 AM wake, 10:15 PM wind-down, 10:45 PM lights out. Repeat daily, labelled.', '6 Sleep'],
  ['Bedtime / Sleep mode', 'Android Digital Wellbeing → Bedtime mode (or iPhone Sleep Focus) 10:15 PM–6:45 AM: grayscale + blocks notifications.', '6 Sleep'],
  ['App timers', 'Digital Wellbeing / Screen Time: limit Instagram, YouTube etc. to a daily cap, and lock them after 10:15 PM.', '6 Sleep / 5 Studies'],
  ['Laptop auto-shutdown', 'Windows Task Scheduler: daily task at 10:30 PM running  shutdown /s /t 300  (5-min warning). Mac: Battery → Schedule.', '6 Sleep'],
  ['Calendar blocks', 'Google Calendar: add every block from the Daily Schedule as a recurring event with a 5-min reminder.', 'All'],
  ['Weekly pill box', 'Buy a 7-day organiser. Fill it Sunday at 5 PM. Keep it next to where you eat breakfast.', '4 Diet'],
  ['Sunday meal prep', 'Cook lunches for Mon–Wed on Sunday; a quick Wednesday-night top-up for Thu–Sat.', '4 Diet'],
  ['Pre-loaded shaker', 'Put the whey scoop in a dry shaker the night before. Add water after gym.', '3 Gym'],
  ['Gym bag by the door', 'Packed at 10:15 PM as part of wind-down, every night. Goes to college with you.', '3 Gym'],
  ['Assignment capture rule', 'The moment an assignment is announced, add it to Assignments. Flags handle the rest.', '7 Assignments'],
  ['Morning study setup', "Leave the laptop open on tomorrow's skill topic before bed so 7:20 AM starts with zero setup.", '5 Studies'],
  ['2-minute log', 'Daily Log at 10:15 PM. Dashboard, streak and weekly stats calculate themselves.', 'All'],
];
