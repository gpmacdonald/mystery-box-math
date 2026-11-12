// Story problem generator.
// Every story has three moments: start, change, end. One of them is the mystery.

export const THEMES = [
  { id: 'cats', emoji: '🐱', many: 'cats',
    start: 'were napping in the sunny garden', join: 'padded in', leave: 'wandered off' },
  { id: 'birds', emoji: '🐦', many: 'birds',
    start: 'were singing in the old oak tree', join: 'flew in', leave: 'flew away' },
  { id: 'rabbits', emoji: '🐰', many: 'rabbits',
    start: 'were nibbling clover in the meadow', join: 'hopped over', leave: 'hopped away' },
  { id: 'dragons', emoji: '🐉', many: 'dragons',
    start: 'were dozing in the mountain cave', join: 'swooped in', leave: 'soared away' },
  { id: 'owls', emoji: '🦉', many: 'owls',
    start: 'were perched on the castle tower', join: 'glided in', leave: 'flew off into the night' },
];

const ROLES = ['start', 'change', 'end'];
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = arr => arr[rand(0, arr.length - 1)];

export function makeProblem({ max = 20, kinds = ROLES, avoidTheme = null } = {}) {
  const unknown = pick(kinds);
  const op = Math.random() < 0.5 ? 'add' : 'sub';
  const theme = pick(THEMES.filter(t => t.id !== avoidTheme));

  // whole = part + other, every number at least 2 so the story reads naturally.
  let values;
  for (let i = 0; i < 200; i++) {
    const whole = rand(max <= 10 ? 5 : 8, max);
    const part = rand(2, whole - 2);
    const other = whole - part;
    values = op === 'add'
      ? { start: part, change: other, end: whole }
      : { start: whole, change: part, end: other };
    // The two numbers given in the story must differ, so each tile means one thing.
    const known = ROLES.filter(r => r !== unknown).map(r => values[r]);
    if (known[0] !== known[1]) break;
  }

  const { start: S, change: D, end: E } = values;
  const m = theme.many;
  const add = op === 'add';

  const sStart = unknown === 'start' ? `Some ${m} ${theme.start}.` : `${S} ${m} ${theme.start}.`;
  const sChange = add
    ? (unknown === 'change' ? `Then some more ${m} ${theme.join}.` : `Then ${D} more ${m} ${theme.join}.`)
    : (unknown === 'change' ? `Then some of the ${m} ${theme.leave}.` : `Then ${D} ${m} ${theme.leave}.`);
  const sEnd = unknown === 'end'
    ? (add ? `How many ${m} are there now?` : `How many ${m} are left?`)
    : (add ? `Now there are ${E} ${m}.` : `Now there are ${E} ${m} left.`);

  let question = null;
  if (unknown === 'start') question = `How many ${m} were there at the start?`;
  if (unknown === 'change') question = add ? `How many more ${m} ${theme.join}?` : `How many ${m} ${theme.leave}?`;

  return {
    theme, op, unknown, values,
    answer: values[unknown],
    sentences: [
      { role: 'start', text: sStart },
      { role: 'change', text: sChange },
      { role: 'end', text: sEnd, isQuestion: unknown === 'end' },
    ],
    question,
  };
}

// ---------- big numbers: two-digit adding and taking away ----------

const BIG_THEMES = [
  { id: 'gems', emoji: '💎',
    add: (a, b) => [`A dragon had ${a} gems in its cave.`, `It found ${b} more gems by the river.`],
    addQ: 'How many gems does the dragon have now?',
    sub: (a, b) => [`A dragon had ${a} gems in its cave.`, `It gave ${b} gems to a friend.`],
    subQ: 'How many gems does the dragon have left?',
    three: (a, b, c) => [`A dragon keeps ${a} red gems, ${b} blue gems and ${c} green gems.`],
    threeQ: 'How many gems is that altogether?' },
  { id: 'carrots', emoji: '🥕',
    add: (a, b) => [`The rabbits picked ${a} carrots in the morning.`, `They picked ${b} more in the afternoon.`],
    addQ: 'How many carrots did the rabbits pick?',
    sub: (a, b) => [`The rabbits had ${a} carrots.`, `They ate ${b} of them.`],
    subQ: 'How many carrots are left?',
    three: (a, b, c) => [`The rabbits picked ${a} carrots on Monday, ${b} on Tuesday and ${c} on Wednesday.`],
    threeQ: 'How many carrots did they pick altogether?' },
  { id: 'books', emoji: '📚',
    add: (a, b) => [`The castle library had ${a} spell books.`, `Then ${b} more spell books arrived by owl.`],
    addQ: 'How many spell books are there now?',
    sub: (a, b) => [`The castle library had ${a} spell books.`, `Young wizards borrowed ${b} of them.`],
    subQ: 'How many spell books are still on the shelves?',
    three: (a, b, c) => [`There are ${a} spell books on the top shelf, ${b} on the middle shelf and ${c} on the bottom shelf.`],
    threeQ: 'How many spell books is that altogether?' },
  { id: 'seeds', emoji: '🌻',
    add: (a, b) => [`The birds found ${a} seeds under the oak tree.`, `They found ${b} more seeds by the pond.`],
    addQ: 'How many seeds did the birds find?',
    sub: (a, b) => [`The birds had ${a} seeds saved for winter.`, `They ate ${b} seeds on a snowy day.`],
    subQ: 'How many seeds are left?',
    three: (a, b, c) => [`The birds found ${a} seeds on Friday, ${b} on Saturday and ${c} on Sunday.`],
    threeQ: 'How many seeds did they find altogether?' },
  { id: 'crayons', emoji: '🖍️',
    add: (a, b) => [`The art room had ${a} crayons.`, `The teacher brought ${b} new crayons.`],
    addQ: 'How many crayons are in the art room now?',
    sub: (a, b) => [`The art room had ${a} crayons.`, `The cats knocked ${b} of them under the cupboard.`],
    subQ: 'How many crayons can the artists still reach?',
    three: (a, b, c) => [`The art room has ${a} crayons in the red box, ${b} in the blue box and ${c} in the green box.`],
    threeQ: 'How many crayons is that altogether?' },
];

// kinds: 'add' (two numbers), 'sub' (take away), 'three' (three numbers).
// Most problems need a trade between ones and tens, because that is the tricky part.
export function makeBigProblem({ kinds = ['add', 'sub', 'three'], easy = false, avoidTheme = null } = {}) {
  const kind = pick(kinds);
  const theme = pick(BIG_THEMES.filter(t => t.id !== avoidTheme));
  let terms = kind === 'add' ? [35, 35] : kind === 'sub' ? [52, 27] : [35, 35, 38];

  for (let i = 0; i < 500; i++) {
    if (kind === 'add') {
      const a = rand(12, 78);
      const b = !easy && Math.random() < 0.2 ? a : rand(12, 78);
      const carry = a % 10 + b % 10 >= 10;
      if (a + b > 99 || a % 10 === 0 || b % 10 === 0) continue;
      if (easy ? carry : (!carry && Math.random() < 0.75)) continue;
      terms = [a, b];
    } else if (kind === 'sub') {
      const s = rand(31, 99);
      const d = rand(12, s - 6);
      const borrow = s % 10 < d % 10;
      if (d % 10 === 0 || (!borrow && Math.random() < 0.6)) continue;
      terms = [s, d];
    } else {
      const t = [rand(12, 48), rand(12, 48), rand(12, 48)];
      if (t.some(n => n % 10 === 0) || t.reduce((sum, n) => sum + n % 10, 0) < 10) continue;
      terms = t;
    }
    break;
  }

  const op = kind === 'sub' ? 'sub' : 'add';
  const answer = op === 'add' ? terms.reduce((a, b) => a + b, 0) : terms[0] - terms[1];
  const carries = op === 'add' ? Math.floor(terms.reduce((sum, n) => sum + n % 10, 0) / 10) : 0;
  const regroup = op === 'add' ? carries > 0 : terms[0] % 10 < terms[1] % 10;

  return {
    big: true, kind, theme, op, terms, answer, carries, regroup,
    sentences: [
      ...theme[kind](...terms).map(text => ({ text })),
      { text: theme[`${kind}Q`], isQuestion: true },
    ],
    question: null,
  };
}

// Pip's favourite big-number mistake: forgetting the trade between ones and tens.
export function pipBigGuess(p) {
  if (Math.random() < 0.25) return p.answer;
  const slip = p.op === 'add' ? p.answer - 10 * p.carries : p.answer + 10;
  const options = [p.answer + 10, p.answer - 10, p.answer + 1, p.answer - 1];
  if (p.regroup) options.push(slip, slip, slip, slip);
  return pick(options.filter(n => n > 0 && n !== p.answer));
}

// Put a guess into the mystery spot and play the story.
export function evaluate(p, guess) {
  const v = { ...p.values, [p.unknown]: guess };
  if (p.op === 'sub' && v.change > v.start) return { v, made: null, impossible: true, correct: false };
  const made = p.op === 'add' ? v.start + v.change : v.start - v.change;
  return { v, made, impossible: false, correct: made === v.end };
}

// Pip the dragon's answer: right about a quarter of the time, otherwise a
// mistake a real second-grader might make (off by a little, or reusing a story number).
export function pipGuess(p, max) {
  if (Math.random() < 0.25) return p.answer;
  const known = ROLES.filter(r => r !== p.unknown).map(r => p.values[r]);
  const options = [
    p.answer + 1, p.answer - 1, p.answer + 2, p.answer - 2,
    ...known, known[0] + known[1], Math.abs(known[0] - known[1]),
  ].filter(n => n >= 0 && n <= max && n !== p.answer);
  return pick(options);
}
