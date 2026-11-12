import { makeProblem, evaluate, pipGuess } from './problems.js';
import { createPad } from './draw.js';

const app = document.getElementById('app');
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- saved state ----------

const STORE_KEY = 'mysterybox.v1';
const ART_KEY = 'mysterybox.art.v1';
const STICKERS = ['🐱', '⭐', '🌸', '🐦', '🐰', '🐉', '🦉', '🌈', '🏰', '🦋', '🌙', '🍄',
  '🪄', '🔮', '🐣', '🌻', '🦄', '🐸', '🍓', '☁️', '🌳', '👑', '💎', '🐲'];
const STARTERS = STICKERS.slice(0, 3);

function loadStore() {
  const fresh = { max: 20, kinds: { end: true, change: true, start: true }, stickers: [...STARTERS], solved: 0 };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    return { ...fresh, ...saved, kinds: { ...fresh.kinds, ...(saved.kinds || {}) } };
  } catch {
    return fresh;
  }
}
let store = loadStore();
const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* private mode */ } };

// ---------- shared ----------

const STEPS = ['start', 'op', 'change', 'end'];
const SIGN = { add: '+', sub: '−' };
const KIND_LABEL = {
  end: ['At the end', '5 + 6 = ?'],
  change: ['In the middle', '7 + ? = 13'],
  start: ['At the start', '? + 6 = 13'],
};

let game = null;
let lastTheme = null;
let lastKind = null;
let played = 0;
let thinkPad = null;
let studioPad = null;
let confirmTimer = null;

const enabledKinds = () => {
  const on = Object.keys(store.kinds).filter(k => store.kinds[k]);
  return on.length ? on : ['end'];
};
const slotVal = (p, role) => (p.unknown === role ? '?' : p.values[role]);

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function burst(emoji) {
  if (calm) return;
  const layer = document.createElement('div');
  layer.className = 'burst';
  const bits = [emoji, '⭐', '✨', emoji, '🎉', '✨'];
  layer.innerHTML = Array.from({ length: 18 }, (_, i) =>
    `<span style="left:${4 + Math.random() * 92}%;animation-delay:${(Math.random() * 0.5).toFixed(2)}s">${bits[i % bits.length]}</span>`).join('');
  document.body.append(layer);
  setTimeout(() => layer.remove(), 2600);
}

// Two-tap confirm for buttons that erase things.
function confirmTap(btn, label, action) {
  if (btn.dataset.armed) {
    clearTimeout(confirmTimer);
    action();
    return;
  }
  const original = btn.textContent;
  btn.dataset.armed = '1';
  btn.textContent = label;
  confirmTimer = setTimeout(() => {
    if (!btn.isConnected) return;
    delete btn.dataset.armed;
    btn.textContent = original;
  }, 3000);
}

// ---------- home ----------

function renderHome() {
  game = null;
  app.innerHTML = `
    <div class="home">
      <div class="hero">
        <div class="hero-box">🎁</div>
        <h1>Mystery Box Math</h1>
        <p>Every story hides a mystery number.<br>Guess it, test it, find it!</p>
      </div>
      <div class="modes">
        <button class="mode" data-act="play" data-mode="story">
          <span class="mode-emoji">📖</span>
          <span class="mode-name">Mystery Stories</span>
          <span class="mode-sub">Turn a story into a number sentence</span>
        </button>
        <button class="mode" data-act="play" data-mode="pip">
          <span class="mode-emoji">🐲</span>
          <span class="mode-name">Check Pip’s Work</span>
          <span class="mode-sub">Pip the dragon needs a math helper</span>
        </button>
        <button class="mode" data-act="studio">
          <span class="mode-emoji">🎨</span>
          <span class="mode-name">Art Studio</span>
          <span class="mode-sub">${store.stickers.length} of ${STICKERS.length} stickers found</span>
        </button>
      </div>
      <button class="link" data-act="grownups">For grown-ups</button>
    </div>`;
}

// ---------- play: setup ----------

function startGame(mode) {
  let kinds = enabledKinds();
  let max = store.max;
  if (mode === 'pip') {
    const hidden = kinds.filter(k => k !== 'end');
    if (hidden.length) kinds = hidden;
  } else if (played === 0 && kinds.includes('end')) {
    kinds = ['end']; // warm up with a friendly one: small numbers, mystery at the end
    max = 10;
  } else if (kinds.length > 1 && lastKind) {
    kinds = kinds.filter(k => k !== lastKind);
  }
  const p = makeProblem({ max, kinds, avoidTheme: lastTheme });
  lastTheme = p.theme.id;
  lastKind = p.unknown;
  played++;

  game = { mode, p, phase: 'build', step: 0, filled: {}, guesses: [], pick: null, shown: null, note: '', msg: '', reward: null, rewardChoices: [] };
  if (mode === 'pip') {
    game.phase = 'pip';
    game.filled = { start: slotVal(p, 'start'), op: SIGN[p.op], change: slotVal(p, 'change'), end: slotVal(p, 'end') };
    game.pip = pipGuess(p, store.max);
  }

  app.innerHTML = `
    <div class="play">
      <header class="bar">
        <button class="icon-btn" data-act="home" aria-label="Home">🏠</button>
        <div class="bar-title">${mode === 'pip' ? '🐲 Check Pip’s Work' : '📖 Mystery Stories'}</div>
        <button class="chip-btn" data-act="pad" id="padBtn">✏️ Think pad</button>
      </header>
      <section class="card story" id="story"></section>
      <section class="equation" id="equation" aria-label="Number sentence"></section>
      <section class="card pad" id="pad" hidden>
        <div class="pad-tools">
          <span class="pad-title">Draw your thinking</span>
          <button class="dot on" data-act="pad-color" data-c="#2d2440" style="--c:#2d2440" aria-label="Dark pen"></button>
          <button class="dot" data-act="pad-color" data-c="#e5484d" style="--c:#e5484d" aria-label="Red pen"></button>
          <button class="dot" data-act="pad-color" data-c="#2f8fe0" style="--c:#2f8fe0" aria-label="Blue pen"></button>
          <button class="chip-btn small" data-act="pad-erase">Eraser</button>
          <button class="chip-btn small" data-act="pad-clear">Wipe</button>
        </div>
        <canvas id="padCanvas" width="1200" height="420"></canvas>
      </section>
      <section class="work" id="work"></section>
    </div>`;
  thinkPad = createPad($('#padCanvas'), { color: '#2d2440', size: 7 });
  updatePlay();
  scrollTo(0, 0);
}

function updatePlay() {
  renderStory();
  renderEquation();
  renderWork();
}

// ---------- play: pieces of the screen ----------

function renderStory() {
  const { p, phase } = game;
  const active = phase === 'build'
    ? { start: 'start', op: 'change', change: 'change', end: 'end' }[STEPS[game.step]]
    : null;
  const sentences = p.sentences.map(s =>
    `<span class="sent${s.role === active ? ' active' : ''}${s.isQuestion ? ' q' : ''}">${s.text}</span>`).join(' ');
  $('#story').innerHTML = `<p>${sentences}</p>${p.question ? `<p class="question">${p.question}</p>` : ''}`;
}

function renderEquation() {
  const { p, filled, phase, pick } = game;
  const current = phase === 'build' ? STEPS[game.step] : null;
  const num = role => {
    const v = filled[role];
    if (v === undefined) return `<span class="slot empty${current === role ? ' current' : ''}"></span>`;
    if (v !== '?') return `<span class="slot">${v}</span>`;
    if (phase === 'won') return `<span class="slot solved">${p.answer}</span>`;
    if (pick != null) return `<span class="slot mystery trying">${pick}</span>`;
    return `<span class="slot mystery">?</span>`;
  };
  const op = filled.op
    ? `<span class="slot op">${filled.op}</span>`
    : `<span class="slot op empty${current === 'op' ? ' current' : ''}"></span>`;
  $('#equation').innerHTML = `${num('start')}${op}${num('change')}<span class="eq-sign">=</span>${num('end')}`;
}

// The picture version of the number sentence. `v` maps each role to a count,
// or null where the mystery box still hides it.
function stageHTML(v, { after = false, only = null, note = '' } = {}) {
  const { p } = game;
  const e = p.theme.emoji;
  const canLeave = v.start != null && v.change != null && v.change <= v.start;
  const leaving = after && p.op === 'sub' && canLeave ? v.change : 0;

  const piece = role => {
    if (only && only[role] === undefined) return `<div class="piece ghost"></div>`;
    const n = v[role];
    if (n == null) return `<div class="piece mystery" data-role="${role}"><div class="box">🎁</div><div class="label">?</div></div>`;
    const guess = role === p.unknown && game.phase !== 'won' ? ' guess' : '';
    const faded = i => (p.op === 'sub' && role === 'change') || (role === 'start' && i >= n - leaving);
    const creatures = Array.from({ length: n }, (_, i) => `<span class="cr${faded(i) ? ' gone' : ''}">${e}</span>`).join('');
    return `<div class="piece ${role}${guess}" data-role="${role}">
      <div class="cluster">${creatures || '<span class="zero">none</span>'}</div>
      <div class="label">${n}</div>
    </div>`;
  };

  const sign = !only || only.op ? SIGN[p.op] : '';
  return `${piece('start')}<div class="sign">${sign}</div>${piece('change')}<div class="sign">=</div>${piece('end')}
    <div class="counter" id="counter">${note}</div>`;
}

const mysteryValues = p => ({ ...p.values, [p.unknown]: null });

function renderWork() {
  const { p, phase } = game;
  const m = p.theme.many;
  const w = $('#work');

  if (phase === 'build' || phase === 'built') {
    let html = `<div class="stage" id="stage">${stageHTML(mysteryValues(p), { only: game.filled })}</div>`;
    if (phase === 'built') {
      html += `
        <div class="verdict">You turned the story into a number sentence! The 🎁 is the mystery number.</div>
        <div class="actions"><button class="primary" data-act="to-guess">Find the mystery number ▶</button></div>`;
    } else {
      const step = STEPS[game.step];
      const prompt = {
        start: `How many ${m} at the start?`,
        op: 'What happened next?',
        change: p.op === 'add' ? `How many ${m} came?` : `How many ${m} went away?`,
        end: `How many ${m} at the end?`,
      }[step];
      let choices;
      if (step === 'op') {
        choices = `
          <button class="choice" data-act="choose" data-v="+">+<small>more ${m} came</small></button>
          <button class="choice" data-act="choose" data-v="−">−<small>some ${m} went away</small></button>`;
      } else {
        const known = ['start', 'change', 'end'].filter(r => r !== p.unknown).map(r => p.values[r]).sort((a, b) => a - b);
        choices = known.map(n => `<button class="choice" data-act="choose" data-v="${n}">${n}</button>`).join('')
          + `<button class="choice mystery-choice" data-act="choose" data-v="?">🎁 ?<small>it doesn’t say</small></button>`;
      }
      html += `
        <div class="prompt"><span class="step">Step ${game.step + 1} of 4 · read the yellow part</span>${prompt}</div>
        <div class="choices">${choices}</div>
        <div class="hint" id="hint"></div>`;
    }
    w.innerHTML = html;
    return;
  }

  if (phase === 'pip') {
    w.innerHTML = `
      <div class="stage" id="stage">${stageHTML(mysteryValues(p))}</div>
      <div class="pip">
        <div class="pip-face">🐲</div>
        <div class="bubble">“I think the mystery number is <b>${game.pip}</b>!”</div>
      </div>
      <div class="verdict">Is Pip right? You don’t have to know yet. Test it with the story!</div>
      <div class="actions"><button class="primary" data-act="test-pip">Test Pip’s answer ▶</button></div>`;
    return;
  }

  if (phase === 'guess' || phase === 'testing') {
    const tried = new Set(game.guesses.map(x => x.g));
    const nums = Array.from({ length: store.max + 1 }, (_, n) =>
      `<button class="num${game.pick === n ? ' picked' : ''}${tried.has(n) ? ' tried' : ''}" data-act="pick" data-n="${n}"${tried.has(n) ? ' disabled' : ''}>${n}</button>`).join('');
    const clues = game.guesses.map(x => {
      const result = x.impossible ? 'not enough' : (p.unknown === 'end' ? `counted ${x.made}` : `makes ${x.made}`);
      return `<span class="clue">${x.who === 'pip' ? '🐲 ' : ''}${x.g} → ${result}</span>`;
    }).join('');
    const opening = p.unknown === 'end'
      ? `How many ${m} will there be at the end? Pick a number, then test it.`
      : `What number is hiding in the mystery box? Pick one and test it. Every guess gives you a clue!`;
    const values = game.shown || mysteryValues(p);
    w.innerHTML = `
      <div class="stage" id="stage">${stageHTML(values, { after: !!game.shown, note: game.shown ? game.note : '' })}</div>
      <div class="verdict" id="verdict">${game.msg || opening}</div>
      <div class="strip${store.max <= 10 ? ' short' : ''}">${nums}</div>
      <div class="actions"><button class="primary" data-act="test"${game.pick == null ? ' disabled' : ''}>Test it ▶</button></div>
      ${clues ? `<div class="log"><span>Clues so far:</span>${clues}</div>` : ''}`;
    return;
  }

  if (phase === 'won') {
    const v = p.values;
    const sentence = `${v.start} ${SIGN[p.op]} ${v.change} = ${v.end}`;
    const n = game.guesses.length;
    let praise;
    if (game.guesses[n - 1].who === 'pip') praise = 'Pip was right, and you proved it by testing!';
    else if (n === 1) praise = 'You found the mystery number and checked it with the story.';
    else praise = `You used ${n} clues to find the mystery number. That’s how mathematicians work!`;

    let reward = '';
    if (game.reward) {
      reward = `<div class="reward">✨ ${game.reward} is now in your Art Studio!</div>`;
    } else if (game.rewardChoices.length) {
      reward = `<div class="reward">Choose a sticker for your Art Studio:
        <div class="reward-choices">${game.rewardChoices.map(s =>
          `<button class="sticker-btn" data-act="reward" data-s="${s}">${s}</button>`).join('')}</div></div>`;
    }
    w.innerHTML = `
      <div class="stage" id="stage">${stageHTML(v, { after: true, note: sentence })}</div>
      <div class="verdict win">🎉 It matches the story! ${praise}</div>
      ${reward}
      <div class="actions">
        <button class="primary" data-act="next">${game.mode === 'pip' ? 'Help Pip again ▶' : 'Next story ▶'}</button>
        <button class="secondary" data-act="studio">🎨 Art Studio</button>
      </div>`;
  }
}

// ---------- play: testing a guess ----------

async function runTest(g, who) {
  const me = game;
  const { p } = me;
  const m = p.theme.many;
  const r = evaluate(p, g);
  const here = () => game === me && $('#stage');

  me.phase = 'testing';
  me.pick = g;
  renderEquation();
  $$('#work button').forEach(b => { b.disabled = true; });
  const verdict = $('.verdict');
  if (verdict) verdict.textContent = 'Let’s play the story and see…';
  const stage = $('#stage');
  stage.innerHTML = stageHTML(r.v);
  stage.classList.add('fresh');
  stage.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
  const counter = $('#counter');
  await sleep(calm ? 0 : 700);
  if (!here()) return;

  let note = '';
  if (!r.impossible) {
    let toCount;
    if (p.op === 'add') {
      toCount = $$('[data-role="start"] .cr, [data-role="change"] .cr', stage);
    } else {
      const all = $$('[data-role="start"] .cr', stage);
      const stay = all.length - r.v.change;
      all.slice(stay).forEach(el => el.classList.add('gone'));
      toCount = all.slice(0, stay);
      await sleep(calm ? 0 : 800);
      if (!here()) return;
    }
    const delay = calm ? 0 : (toCount.length > 20 ? 70 : 120);
    counter.textContent = '0';
    for (let i = 0; i < toCount.length; i++) {
      toCount[i].classList.add('counted');
      counter.textContent = String(i + 1);
      if (delay) await sleep(delay);
      if (!here()) return;
    }
    note = `${r.v.start} ${SIGN[p.op]} ${r.v.change} = ${r.made}`;
    counter.textContent = note;
    await sleep(calm ? 0 : 500);
    if (!here()) return;
  }

  me.guesses.push({ g, made: r.made, impossible: r.impossible, who });

  if (r.correct) {
    me.phase = 'won';
    me.pick = null;
    store.solved++;
    save();
    me.rewardChoices = shuffle(STICKERS.filter(s => !store.stickers.includes(s))).slice(0, 3);
    updatePlay();
    burst(p.theme.emoji);
    return;
  }

  let msg;
  if (r.impossible) {
    msg = `${r.v.change} ${m} can’t leave when the story only has ${r.v.start}! ${who === 'pip' ? 'Can you help Pip?' : 'That’s a clue too.'}`;
  } else if (p.unknown === 'end') {
    msg = who === 'pip'
      ? `Pip said ${g}, but we counted ${r.made}. Can you help Pip?`
      : `You predicted ${g}, and we counted ${r.made}. What will you pick now?`;
  } else if (who === 'pip') {
    msg = `Pip’s number makes ${r.made}, but the story says ${r.v.end}. Pip needs your help! What number would you try?`;
  } else {
    msg = `${note}, but the story says ${r.v.end}. That’s a clue! Will you try a bigger number or a smaller one?`;
  }
  const misses = me.guesses.filter(x => x.who === 'you').length;
  if (misses >= 3) msg += ` <span class="nudge">Hint: try a ${g < p.answer ? 'bigger' : 'smaller'} number.</span>`;

  me.phase = 'guess';
  me.pick = null;
  me.shown = r.v;
  me.note = note;
  me.msg = msg;
  updatePlay();
}

// ---------- art studio ----------

const COLORS = ['#2d2440', '#e5484d', '#f2853a', '#f5c518', '#3fae5a', '#2f8fe0', '#6c4bd8', '#e36bb0', '#8b5a2b'];
const SIZES = { s: { pen: 6, sticker: 70 }, m: { pen: 14, sticker: 120 }, l: { pen: 30, sticker: 190 } };
const studio = { color: COLORS[6], size: 'm', mode: 'pen', sticker: null };
let artTimer = null;

function saveArt() {
  clearTimeout(artTimer);
  artTimer = setTimeout(() => {
    try { localStorage.setItem(ART_KEY, studioPad.toDataURL()); } catch { /* storage full: keep drawing */ }
  }, 400);
}

function renderStudio() {
  game = null;
  app.innerHTML = `
    <div class="studio">
      <header class="bar">
        <button class="icon-btn" data-act="home" aria-label="Home">🏠</button>
        <div class="bar-title">🎨 Art Studio</div>
        <button class="chip-btn" data-act="art-undo">↩ Undo</button>
        <button class="chip-btn" data-act="art-clear">New page</button>
      </header>
      <div class="studio-body">
        <canvas id="art" width="1200" height="900"></canvas>
        <div class="card tools" id="tools"></div>
      </div>
    </div>`;
  studioPad = createPad($('#art'), { onChange: saveArt });
  try {
    const saved = localStorage.getItem(ART_KEY);
    if (saved) studioPad.load(saved);
  } catch { /* nothing saved */ }
  renderTools();
}

function renderTools() {
  const size = SIZES[studio.size];
  studioPad.set({ color: studio.color, size: size.pen, stickerSize: size.sticker, mode: studio.mode, sticker: studio.sticker });
  const locked = STICKERS.length - store.stickers.length;
  $('#tools').innerHTML = `
    <div class="tool-row">
      ${COLORS.map(c => `<button class="dot${studio.mode === 'pen' && studio.color === c ? ' on' : ''}" data-act="art-color" data-c="${c}" style="--c:${c}" aria-label="Colour"></button>`).join('')}
      <button class="chip-btn small${studio.mode === 'eraser' ? ' on' : ''}" data-act="art-erase">Eraser</button>
    </div>
    <div class="tool-row">
      ${Object.keys(SIZES).map(k => `<button class="size${studio.size === k ? ' on' : ''}" data-act="art-size" data-k="${k}" aria-label="Size ${k}"><i class="size-${k}"></i></button>`).join('')}
    </div>
    <div class="tool-title">Stickers — tap one, then tap your picture</div>
    <div class="tool-row stickers">
      ${store.stickers.map(s => `<button class="sticker-btn small${studio.mode === 'sticker' && studio.sticker === s ? ' on' : ''}" data-act="art-sticker" data-s="${s}">${s}</button>`).join('')}
    </div>
    ${locked ? `<div class="tool-note">🔒 ${locked} more to find. Solve a story to earn one!</div>` : '<div class="tool-note">You found every sticker! 🌟</div>'}`;
}

// ---------- grown-ups ----------

function renderGrownups() {
  game = null;
  app.innerHTML = `
    <div class="grown">
      <header class="bar">
        <button class="icon-btn" data-act="home" aria-label="Home">🏠</button>
        <div class="bar-title">For grown-ups</div>
      </header>
      <section class="card">
        <h2>Number size</h2>
        <div class="toggle-row">
          ${[10, 20].map(n => `<button class="toggle${store.max === n ? ' on' : ''}" data-act="set-max" data-n="${n}">Up to ${n}</button>`).join('')}
        </div>
        <h2>Where the mystery hides</h2>
        <div class="toggle-row">
          ${Object.entries(KIND_LABEL).map(([k, [name, eg]]) =>
            `<button class="toggle${store.kinds[k] ? ' on' : ''}" data-act="set-kind" data-k="${k}">${name}<small>${eg}</small></button>`).join('')}
        </div>
        <p class="fine">“At the start” is the hardest kind. The first story of each sitting is always an easy warm-up.</p>
      </section>
      <section class="card">
        <h2>Paper practice</h2>
        <p>Six stories on one page, with room to draw and the same number-sentence frame the app uses.</p>
        <button class="secondary" data-act="sheet">Make a worksheet</button>
      </section>
      <section class="card">
        <h2>Sitting alongside</h2>
        <ul>
          <li>Praise the test, not the answer: “You checked it!” rather than “You’re right!”</li>
          <li>When a guess misses, ask “What did that clue tell you?” and then wait.</li>
          <li>Let her press <b>Test it</b> even when you can see the guess is wrong.</li>
          <li>Stop while it’s still fun. Three or four stories is plenty.</li>
        </ul>
      </section>
      <section class="card">
        <p>Stories solved: <b>${store.solved}</b> · Stickers found: <b>${store.stickers.length} of ${STICKERS.length}</b></p>
        <button class="secondary" data-act="reset">Reset stickers and drawing</button>
      </section>
    </div>`;
}

function renderSheet() {
  game = null;
  const kinds = enabledKinds();
  let theme = null;
  const problems = Array.from({ length: 6 }, (_, i) => {
    const p = makeProblem({ max: store.max, kinds: [kinds[i % kinds.length]], avoidTheme: theme });
    theme = p.theme.id;
    return p;
  });
  app.innerHTML = `
    <div class="sheet-view">
      <header class="bar no-print">
        <button class="icon-btn" data-act="grownups" aria-label="Back">←</button>
        <div class="bar-title">Worksheet</div>
        <button class="chip-btn" data-act="sheet">New stories</button>
        <button class="chip-btn on" data-act="print">Print</button>
      </header>
      <div class="sheet">
        <div class="sheet-head">
          <h1>🎁 Mystery Box Stories</h1>
          <div>Name ____________________</div>
        </div>
        <p class="sheet-how">Draw the story. Put a ? box where the mystery number hides. Write the number sentence. Then test your answer with the story!</p>
        <ol class="sheet-grid">
          ${problems.map(p => `
            <li>
              <p class="sheet-story">${p.theme.emoji} ${p.sentences.map(s => s.text).join(' ')} ${p.question || ''}</p>
              <div class="sheet-draw"></div>
              <div class="sheet-eq"><i></i><b></b><i></i><em>=</em><i></i></div>
              <div class="sheet-check"><span></span> I tested my answer with the story.</div>
            </li>`).join('')}
        </ol>
      </div>
    </div>`;
}

// ---------- actions ----------

const actions = {
  home: renderHome,
  studio: renderStudio,
  grownups: renderGrownups,
  sheet: renderSheet,
  print: () => window.print(),
  play: b => startGame(b.dataset.mode),
  next: () => startGame(game.mode),

  pad(b) {
    const pad = $('#pad');
    pad.hidden = !pad.hidden;
    b.classList.toggle('on', !pad.hidden);
  },
  'pad-color'(b) {
    thinkPad.set({ mode: 'pen', color: b.dataset.c });
    $$('#pad .dot, #pad [data-act="pad-erase"]').forEach(el => el.classList.remove('on'));
    b.classList.add('on');
  },
  'pad-erase'(b) {
    thinkPad.set({ mode: 'eraser' });
    $$('#pad .dot').forEach(el => el.classList.remove('on'));
    b.classList.add('on');
  },
  'pad-clear': () => thinkPad.clear(),

  choose(b) {
    const { p } = game;
    const step = STEPS[game.step];
    const want = step === 'op' ? SIGN[p.op] : slotVal(p, step);
    const got = b.dataset.v;
    if (got === String(want)) {
      game.filled[step] = want;
      game.step++;
      if (game.step === STEPS.length) game.phase = 'built';
      updatePlay();
      return;
    }
    const m = p.theme.many;
    let hint;
    if (step === 'op') hint = `Read the yellow sentence again. Did more ${m} come, or did some go away?`;
    else if (want === '?') hint = 'Look at the yellow part again. It doesn’t tell us a number, so it’s the mystery!';
    else if (got === '?') hint = 'Look closely. The yellow sentence does tell us a number.';
    else hint = 'That number is in the story, but in a different sentence. Read the yellow one again.';
    $('#hint').textContent = hint;
    b.classList.remove('shake');
    void b.offsetWidth;
    b.classList.add('shake');
  },
  'to-guess'() {
    game.phase = 'guess';
    updatePlay();
  },
  pick(b) {
    if (game.phase !== 'guess') return;
    game.pick = Number(b.dataset.n);
    game.shown = null;
    renderEquation();
    renderWork();
  },
  test() {
    if (game.phase === 'guess' && game.pick != null) runTest(game.pick, 'you');
  },
  'test-pip'() {
    if (game.phase === 'pip') runTest(game.pip, 'pip');
  },
  reward(b) {
    const s = b.dataset.s;
    if (!store.stickers.includes(s)) store.stickers.push(s);
    save();
    game.reward = s;
    renderWork();
  },

  'art-color'(b) { studio.mode = 'pen'; studio.color = b.dataset.c; renderTools(); },
  'art-erase'() { studio.mode = 'eraser'; renderTools(); },
  'art-size'(b) { studio.size = b.dataset.k; renderTools(); },
  'art-sticker'(b) { studio.mode = 'sticker'; studio.sticker = b.dataset.s; renderTools(); },
  'art-undo': () => studioPad.undo(),
  'art-clear'(b) {
    confirmTap(b, 'Tap again to clear', () => {
      studioPad.clear();
      delete b.dataset.armed;
      b.textContent = 'New page';
    });
  },

  'set-max'(b) { store.max = Number(b.dataset.n); save(); renderGrownups(); },
  'set-kind'(b) {
    const k = b.dataset.k;
    const on = enabledKinds();
    if (store.kinds[k] && on.length === 1) return; // keep at least one kind
    store.kinds[k] = !store.kinds[k];
    save();
    renderGrownups();
  },
  reset(b) {
    confirmTap(b, 'Tap again to reset', () => {
      try { localStorage.removeItem(STORE_KEY); localStorage.removeItem(ART_KEY); } catch { /* ignore */ }
      store = loadStore();
      renderGrownups();
    });
  },
};

app.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const act = actions[b.dataset.act];
  if (act) act(b);
});

renderHome();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
}
