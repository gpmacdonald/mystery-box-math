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
