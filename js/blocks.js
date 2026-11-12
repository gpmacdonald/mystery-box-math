// Base-ten blocks: a flat is 100, a rod is 10, a one is 1.
// Every pile has three zones so blocks can be gathered and traded.

const $ = (sel, root) => root.querySelector(sel);

export const split = n => ({ h: Math.floor(n / 100), t: Math.floor(n % 100 / 10), o: n % 10 });

export function expanded(n) {
  const { h, t, o } = split(n);
  return [h * 100, t * 10, o].filter(Boolean).join(' + ') || '0';
}

// `traded` rods are drawn in the ones colour: they are tens that the ones made.
export function pileHTML(n, traded = 0) {
  const { h, t, o } = split(n);
  const fresh = Math.min(traded, t);
  return `<div class="pile">
    <div class="z z-flats">${'<i class="flat"></i>'.repeat(h)}</div>
    <div class="z z-tens">${'<i class="rod"></i>'.repeat(t - fresh)}${'<i class="rod new"></i>'.repeat(fresh)}</div>
    <div class="z z-ones">${'<i class="one"></i>'.repeat(o)}</div>
  </div>`;
}

// Push every source pile into the target, then trade 10 ones for a ten and
// 10 tens for a hundred. `say` sets the caption; `pause` waits (and throws if
// the player has left the screen).
export async function playAdd(sources, target, { say, pause }) {
  const flats = $('.z-flats', target);
  const tens = $('.z-tens', target);
  const ones = $('.z-ones', target);

  const gather = async (sel, zone, cls, step) => {
    for (const source of sources) {
      for (const el of source.querySelectorAll(sel)) {
        el.classList.add('moved');
        zone.insertAdjacentHTML('beforeend', `<i class="${cls} pop"></i>`);
        await pause(step);
      }
    }
  };

  say('First, gather the tens.');
  await gather('.rod', tens, 'rod', 130);
  await pause(500);
  say('Now gather the ones.');
  await gather('.one', ones, 'one', 80);
  await pause(600);

  while (ones.children.length >= 10) {
    const ten = [...ones.children].slice(0, 10);
    ten.forEach(el => el.classList.add('glow'));
    say('10 ones make a new ten!');
    await pause(1400);
    ten.forEach(el => el.remove());
    tens.insertAdjacentHTML('beforeend', '<i class="rod new pop"></i>');
    await pause(900);
  }
  while (tens.children.length >= 10) {
    const ten = [...tens.children].slice(0, 10);
    ten.forEach(el => el.classList.add('glow'));
    say('10 tens make a hundred!');
    await pause(1400);
    ten.forEach(el => el.remove());
    flats.insertAdjacentHTML('beforeend', '<i class="flat pop"></i>');
    await pause(900);
  }
}

// Take `taken` away from the source pile, opening a ten if there are not
// enough ones, then show what is left in the target.
export async function playSub(source, target, taken, { say, pause }) {
  const tens = $('.z-tens', source);
  const ones = $('.z-ones', source);
  const { t: takeTens, o: takeOnes } = split(taken);

  if (ones.children.length < takeOnes) {
    const rod = tens.lastElementChild;
    rod.classList.add('glow');
    say(`Not enough ones to take away ${takeOnes}. Open a ten!`);
    await pause(1500);
    rod.remove();
    ones.insertAdjacentHTML('beforeend', '<i class="one new pop"></i>'.repeat(10));
    await pause(1000);
  }

  say(`Take away ${takeOnes} ${takeOnes === 1 ? 'one' : 'ones'}…`);
  [...ones.children].slice(-takeOnes).forEach(el => el.classList.add('gone'));
  await pause(1000);
  say(`…and ${takeTens} ${takeTens === 1 ? 'ten' : 'tens'}.`);
  [...tens.children].slice(-takeTens).forEach(el => el.classList.add('gone'));
  await pause(1000);

  const left = sel => source.querySelectorAll(`${sel}:not(.gone)`).length;
  $('.z-tens', target).innerHTML = '<i class="rod pop"></i>'.repeat(left('.rod'));
  $('.z-ones', target).innerHTML = '<i class="one pop"></i>'.repeat(left('.one'));
  await pause(500);
}
