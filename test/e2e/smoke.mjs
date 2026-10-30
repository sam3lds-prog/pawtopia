// End-to-end smoke tests in a real browser (iPhone-sized viewport).
//
//   npm run dev            # in one terminal (the dev-only window.__pt hook is needed)
//   npm run e2e            # in another; E2E_URL overrides http://localhost:5173
//
// Needs Playwright once: `npm i -D playwright && npx playwright install chromium`.
// Covers the spec's critical regressions: first-run flow, "Next level" advances, progress survives reload,
// in-progress boards resume, decor is charged exactly once, reset keeps unrelated data, faces are facial-only.

import { createRequire } from 'node:module';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  try {
    ({ chromium } = createRequire(import.meta.url)('playwright'));
  } catch {
    /* handled below */
  }
}
if (!chromium) {
  console.error('Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const URL = process.env.E2E_URL ?? 'http://localhost:5173/';
const results = [];
let failed = 0;

function check(name, cond, detail = '') {
  results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${!cond && detail ? `  (${detail})` : ''}`);
  if (!cond) failed++;
}

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

async function reload() {
  await page.reload();
  await page.waitForFunction(() => !!window.__pt);
}

const coins = () => page.evaluate(() => window.__pt.app.coins());
const title = () => page.textContent('.game-title h1').catch(() => null);

/** Double-taps a tile (D35: a double tap places the board's animal; the animal buttons pick which on two-animal boards). */
async function dblTap(r, c) {
  await page.dblclick(`.cell[data-r="${r}"][data-c="${c}"]`, { delay: 10 });
}

/** Picks the animal for a species (two-animal boards only; one-animal boards have no animal buttons). */
async function pick(species) {
  const sel = `[data-tool="${species === 1 ? 'cat' : 'dog'}"]`;
  if (await page.$(sel)) await page.click(sel);
}

async function place(r, c, species) {
  await pick(species);
  await dblTap(r, c);
}

async function solveActive({ stopAfter = Infinity, pace = 0 } = {}) {
  const sol = await page.evaluate(() => window.__pt.app.active.session.puzzle.solution);
  let placed = 0;
  for (let r = 0; r < sol.length; r++)
    for (let c = 0; c < sol.length; c++) {
      const cells = await page.evaluate(() => window.__pt.app.active?.session.cells);
      if (!cells || !sol[r][c] || cells[r][c] === sol[r][c]) continue;
      if (placed >= stopAfter) return;
      if (pace) await page.waitForTimeout(pace);
      await place(r, c, sol[r][c]);
      placed++;
    }
  await page.waitForSelector('.win-sheet', { timeout: 5000 });
}

/** A tile that can't hold an animal on the active board, still empty. */
const emptyTile = () =>
  page.evaluate(() => {
    const s = window.__pt.app.active.session;
    for (let r = 0; r < s.size; r++) for (let c = 0; c < s.size; c++) if (!s.givenMask[r][c] && s.cells[r][c] === 0 && s.puzzle.solution[r][c] === 0) return [r, c];
    return null;
  });

/** Puts the player past the two-animal lesson (D35), as if they had played that far. */
async function reachPairs(level = 25) {
  await page.evaluate((L) => {
    const s = window.__pt.app.save;
    for (let i = 1; i < L; i++) s.journey.clears['L' + i] ??= { firstClearAt: new Date().toISOString(), bestSeconds: 60, bestMistakes: 0, clean: true, hintFree: true, stars: 3 };
    if (s.journey.nextLevel < L) s.journey.nextLevel = L;
    Object.assign(s.onboarding, { soloRulesSeen: true, pairRulesSeen: true, pairLessonDone: true, seenRules: true });
    window.__pt.app.persist();
  }, level);
}

try {
  await page.goto(URL);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('someone.else', 'keep me');
  });
  await reload();
  await page.waitForSelector('.welcome');
  check('first run shows the welcome screen', true);

  // Guided tutorial: a one-animal board with the sheep (D35)
  await page.click('[data-act="start"]');
  await page.waitForSelector('.cell.is-guide');
  check('tutorial highlights exactly one tile', (await page.$$('.cell.is-guide')).length === 1);
  check('tutorial board is forgiving (no hearts shown)', !(await page.$('[data-hearts]')));
  check('the first board is a one-animal board', await page.evaluate(() => window.__pt.app.active.session.rule === 'solo'));
  check('one-animal boards have only Erase and Hint', !(await page.$('[data-tool]')) && (await page.$$('.controls--solo .act')).length === 2 && !(await page.$('.controls [data-act="undo"]')));
  check('the coach explains tap and double-tap', /double-tap/i.test((await page.textContent('[data-coach]')) ?? ''));

  // Tap marks ✕ and a second, slow tap clears it again; animals only come with a double tap.
  const free0 = await emptyTile();
  await page.click(`.cell[data-r="${free0[0]}"][data-c="${free0[1]}"]`);
  check('a tap marks ✕', (await page.evaluate(([r, c]) => window.__pt.app.active.session.cells[r][c], free0)) === 3);
  await page.waitForTimeout(500);
  await page.click(`.cell[data-r="${free0[0]}"][data-c="${free0[1]}"]`);
  check('a second tap later clears the ✕', (await page.evaluate(([r, c]) => window.__pt.app.active.session.cells[r][c], free0)) === 0);
  await page.waitForTimeout(500);

  // Facial-only: placing an animal never transforms its element, and its face reacts.
  const g = await page.$('.cell.is-guide');
  const box0 = await g.boundingBox();
  await g.dblclick({ delay: 10 });
  await page.waitForTimeout(60);
  check('the board shows the animal being brought home (Cotton the sheep)', !!(await page.$('.board .pet[data-pet="cotton"]')));
  const moods = await page.$$eval('.board .pet', (els) => els.map((e) => e.dataset.mood));
  check('a correct placement makes a face react', moods.some((m) => m === 'happy' || m === 'proud'), moods.join(','));
  const transforms = await page.$$eval('.board .cell__pet', (els) => els.map((e) => getComputedStyle(e).transform));
  check('pet tiles are never transformed', transforms.every((t) => t === 'none'), transforms.join(','));
  const box1 = await (await page.$(`.cell[data-r="${await g.getAttribute('data-r')}"][data-c="${await g.getAttribute('data-c')}"]`)).boundingBox();
  check('the tile never moves or resizes', box0.x === box1.x && box0.y === box1.y && box0.width === box1.width, JSON.stringify([box0, box1]));

  await solveActive();
  check('the first win brings Cotton home and offers to meet her', (await page.textContent('[data-act="meet"]'))?.includes('Meet Cotton') && /Cotton the sheep came home/.test((await page.textContent('.win-sheet')) ?? ''));
  check('the win sheet shows who comes next', /Truffle the piglet/.test((await page.textContent('.win-sheet')) ?? ''));
  const afterFirst = await coins();
  check('first clear pays coins', afterFirst >= 45, String(afterFirst));
  await page.click('[data-act="meet"]');
  await page.waitForSelector('.region');
  await page.waitForSelector('.sheet [data-choose="wheelbarrow"]');
  check('meeting her opens the Farm, with Farm starter gifts', !!(await page.$('[data-choose="trough"]')));
  await page.click('[data-choose="wheelbarrow"]');
  await page.click('.sheet [data-act="play"]');
  check('starter flow continues to level 2', (await title()) === 'Level 2');
  check('level 2 shows the next animal on its way (Truffle)', await page.evaluate(() => window.__pt.app.active.cast.a === 'truffle'));

  // Next level advances (v1 regression)
  await solveActive();
  const nextLabel = await page.textContent('[data-act="next"]');
  check('win sheet offers the NEXT level', nextLabel?.includes('level 3'), nextLabel ?? '');
  await page.click('[data-act="next"]');
  await page.waitForTimeout(200);
  check('"Next level" opens level 3', (await title()) === 'Level 3');

  // Replay pays nothing
  const journeyEntries = () => page.evaluate(() => window.__pt.app.save.inventory.ledger.filter((e) => e.source === 'journey').length);
  const before = await journeyEntries();
  await page.evaluate(() => window.__pt.start({ kind: 'level', level: 2 }));
  await page.waitForTimeout(200);
  await solveActive();
  check('replaying a solved level mints no journey coins', (await journeyEntries()) === before, `${before} → ${await journeyEntries()}`);
  await page.click('[data-act="next"]');

  // Resume after reload
  await page.evaluate(() => window.__pt.start({ kind: 'level', level: 3 }));
  await page.waitForTimeout(200);
  await solveActive({ stopAfter: 1 }).catch(() => {});
  await reload();
  await page.waitForSelector('.home');
  const cont = await page.textContent('[data-act="continue"]');
  check('home offers to resume the board in progress', /Resume/i.test(cont ?? ''), cont ?? '');
  await page.click('[data-act="continue"]');
  await page.waitForTimeout(300);
  const placedCount = await page.evaluate(() => window.__pt.app.active.session.placedCount());
  const givens = await page.evaluate(() => window.__pt.app.active.session.puzzle.givens.length);
  check('the resumed board keeps its placements', placedCount === givens + 1, `${placedCount} vs ${givens + 1}`);

  // Five hearts on casual boards; a wrong animal is a fading ghost with a strike, and the tile is marked ✕
  check('Journey boards show five hearts', (await page.$$('[data-hearts] .ico')).length === 5);
  const wrongCell = await emptyTile();
  await dblTap(wrongCell[0], wrongCell[1]);
  const afterWrong = await page.evaluate(([r, c]) => {
    const s = window.__pt.app.active.session;
    return { hearts: s.hearts, cell: s.cells[r][c] };
  }, wrongCell);
  const strike = await page.$(`.cell[data-r="${wrongCell[0]}"][data-c="${wrongCell[1]}"] .cell__strike`);
  check('a wrong double-tap costs one heart and leaves a ✕', afterWrong.hearts === 4 && afterWrong.cell === 3, JSON.stringify(afterWrong));
  check('the mistake shows a fading ghost with a strike', !!strike);
  await page.waitForTimeout(800);
  check('the ghost and strike are gone afterwards', !(await page.$('.cell__strike')) && !(await page.$('.cell__ghost')));
  check('regions are separated by soft seams, not dark lines', await page.evaluate(() => getComputedStyle(document.querySelector('.board__lines .div')).stroke !== 'rgb(52, 67, 63)'));

  // Erase is a mode; undo, redo and How to play live in the pause sheet
  await page.click('[data-act="erase"]');
  check('Erase stays on until it is tapped again', (await page.getAttribute('[data-act="erase"]', 'aria-pressed')) === 'true');
  await page.click(`.cell[data-r="${wrongCell[0]}"][data-c="${wrongCell[1]}"]`);
  check('with Erase on, a tap takes the ✕ back', (await page.evaluate(([r, c]) => window.__pt.app.active.session.cells[r][c], wrongCell)) === 0);
  await page.click('[data-act="erase"]');
  await page.click('[data-act="pause"]');
  check('the pause sheet has undo, redo and How to play', !!(await page.$('.sheet [data-act="undo"]')) && !!(await page.$('.sheet [data-act="rules"]')));
  await page.click('.sheet [data-act="rules"]');
  check('How to play explains the one-animal rule with the board animal', /One piglet/.test((await page.textContent('.rules')) ?? ''));
  await page.click('[data-act="ok"]');
  await page.waitForTimeout(200);

  // Hints: the board's first look is free, the exact cell costs one hint, placing that cell costs nothing more
  const hintCount = () => page.evaluate(() => window.__pt.app.save.inventory.items.filter((e) => e.item === 'hint').reduce((a, e) => a + e.delta, 0));
  const t0 = await hintCount();
  check('a fresh board offers a free first hint', (await page.textContent('[data-hint-badge]'))?.trim() === 'Free');
  await page.click('[data-act="hint"]');
  check('the first look costs no ticket', (await hintCount()) === t0, `${t0} → ${await hintCount()}`);
  await page.click('[data-act="hint"]');
  check('the exact cell costs one ticket', (await hintCount()) === t0 - 1, `${t0} → ${await hintCount()}`);
  await page.click('[data-act="hint"]');
  check('placing that same cell costs nothing more', (await hintCount()) === t0 - 1, `${t0} → ${await hintCount()}`);

  // Extra lives: one heart back from the hearts button, kept with the board
  const wc = await emptyTile();
  await dblTap(wc[0], wc[1]);
  const heartsBefore = await page.evaluate(() => window.__pt.app.active.session.hearts);
  const treatsBefore = await page.evaluate(() => window.__pt.app.save.inventory.items.filter((e) => e.item === 'life').reduce((a, e) => a + e.delta, 0));
  await page.click('[data-act="hearts"]');
  await page.click('[data-act="life"]');
  await page.waitForTimeout(150);
  const afterTreat = await page.evaluate(() => ({
    hearts: window.__pt.app.active.session.hearts,
    treats: window.__pt.app.save.inventory.items.filter((e) => e.item === 'life').reduce((a, e) => a + e.delta, 0),
  }));
  check('an extra life gives one heart back and is used once', afterTreat.hearts === heartsBefore + 1 && afterTreat.treats === treatsBefore - 1, JSON.stringify({ heartsBefore, treatsBefore, ...afterTreat }));
  await solveActive();
  check('the win sheet shows Paw Points', /Paw Points/.test((await page.textContent('.win-sheet')) ?? ''));
  await page.click('[data-act="next"]');
  await page.waitForTimeout(200);

  // Decor charged exactly once
  await page.evaluate(() => {
    window.__pt.app.save.inventory.ledger.push({ id: 'e2e:seed', delta: 500, at: new Date().toISOString(), source: 'gift' });
    window.__pt.app.persist();
    window.__pt.go({ screen: 'shop', sanctuary: 'harmony' });
  });
  const c0 = await coins();
  await page.click('[data-decor="rug"]');
  await page.click('[data-act="buy"]');
  await page.waitForTimeout(200);
  await page.click('[data-decor="rug"]');
  const buyAgain = await page.$('[data-act="buy"]');
  check('decor costs exactly its price, once', (await coins()) === c0 - 110 && !buyAgain, `${c0} → ${await coins()}`);
  await page.keyboard.press('Escape');
  await reload();
  check('purchased decor survives reload', await page.evaluate(() => !!window.__pt.app.save.inventory.decor.rug));

  // Video tokens come only from a (test) reward video; each sanctuary has its own treats, fed from an animal's card
  await page.evaluate(() => window.__pt.go({ screen: 'shop' }));
  await page.waitForSelector('[data-act="watch-token"]');
  const vt = () => page.evaluate(() => window.__pt.app.save.inventory.items.filter((e) => e.item === 'vtoken').reduce((a, e) => a + e.delta, 0));
  const vt0 = await vt();
  await page.click('[data-act="watch-token"]');
  await page.waitForTimeout(1900);
  check('a watched test video grants one video token', (await vt()) === vt0 + 1, `${vt0} → ${await vt()}`);
  await page.click('[data-tab="food"]');
  await page.click('[data-place="farm"]');
  check('the Farm sells its own treats', !!(await page.$('[data-food="hay"]')) && !(await page.$('[data-food="kibble"]')));
  await page.click('[data-food="hay"]');
  await page.click('[data-act="buy"]');
  await page.click('[data-act="close"]');
  await page.evaluate(() => window.__pt.go({ screen: 'region', id: 'farm' }));
  await page.click('.resident-row [data-friend-card="cotton"]');
  await page.click('[data-feed="hay"]');
  check('feeding a favorite food adds two hearts of affection', (await page.evaluate(() => window.__pt.app.save.sanctuary.affection.cotton)) === 2);
  await page.keyboard.press('Escape');

  // Sanctuary life: a tap on an animal gets a small reaction; ambient actions come and go on their own
  await page.evaluate(() => window.__pt.go({ screen: 'region', id: 'farm' }));
  await page.waitForSelector('.sanctuary__scene.is-live .sanctuary__pet');
  const greeted = await page
    .waitForFunction(() => document.querySelector('.sanctuary__scene .sanctuary__pet:is(.is-greet, .is-hop, .is-wag)'), null, { timeout: 3000 })
    .then(
      () => true,
      () => false,
    );
  check('the animals say hello when you arrive', greeted);
  await page.waitForSelector('.sanctuary__scene.has-3d > canvas.scene3d', { timeout: 15000 }).catch(() => {});
  check('the Farm animals appear as 3D toys over the drawn scene', await page.evaluate(() => !!document.querySelector('.sanctuary__scene.has-3d > canvas.scene3d') && getComputedStyle(document.querySelector('.sanctuary__scene .sanctuary__pet')).opacity === '0'));
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    window.__seen = new Set();
    new MutationObserver((ms) => {
      for (const m of ms) for (const c of m.target.classList) if (c.startsWith('is-') && c !== 'is-live') window.__seen.add(c);
    }).observe(document.querySelector('.sanctuary__scene svg'), { subtree: true, attributes: true, attributeFilter: ['class'] });
  });
  await page.click('.sanctuary__scene .sanctuary__pet');
  check('tapping an animal in the scene makes it react', await page.evaluate(() => window.__seen.has('is-greet') || window.__seen.has('is-love')));
  await page.waitForTimeout(10_000);
  const seen = await page.evaluate(() => [...window.__seen]);
  check('the garden comes alive by itself within 10 seconds', seen.some((c) => c !== 'is-love' && c !== 'is-greet'), seen.join(','));
  check('no more than three figures move at once', await page.evaluate(() => document.querySelectorAll('.sanctuary__scene [class*="is-"]:not(.is-live)').length <= 3));

  // Decoration activities: tapping the little red tractor sends someone for a ride, then brings them back
  await page.evaluate(() => {
    window.__pt.app.save.inventory.decor.tractor = { ownedAt: new Date().toISOString() };
    window.__pt.app.persist();
    window.__pt.go({ screen: 'region', id: 'farm' });
  });
  await page.waitForSelector('.sanctuary__scene [data-decor="tractor"].has-act');
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelector('.sanctuary__scene [data-decor="tractor"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForTimeout(300);
  const ride = await page.evaluate(() => ({
    rider: !!document.querySelector('.sp-tractor .sp-act .sp-rider-fig'),
    away: document.querySelectorAll('.sanctuary__scene .sanctuary__pet.is-away').length,
    caption: document.querySelector('[data-chat] span')?.textContent ?? '',
  }));
  check('tapping the tractor sends an animal for a ride', ride.rider && ride.away === 1 && /tractor/.test(ride.caption), JSON.stringify(ride));
  check('in 3D, the toy itself rides the tractor', await page.evaluate(() => (window.__stage3d?.riders() ?? []).some((r) => r.decor === 'tractor')));
  await page.waitForTimeout(6800);
  check('the ride ends and the animal comes back', await page.evaluate(() => !document.querySelector('.sp-act') && !document.querySelector('.is-away')));

  // Tricks: tap an animal, ask for a free trick; a locked one opens its card instead
  await page.click('.sanctuary__scene .sanctuary__pet');
  await page.waitForSelector('.trick-tray');
  check('tapping an animal offers its tricks', /^Ask .+ to…$/.test((await page.textContent('.trick-tray__head b'))?.trim() ?? ''));
  await page.click('.trick-chip[data-trick="wave"]');
  const trick = await page.evaluate(() => {
    const fig = document.querySelector('.sanctuary__scene .sanctuary__pet[data-trick]');
    const key = fig?.dataset.pet ?? `friend:${fig?.dataset.friend}`;
    // Drawn animals get a drawn emote; 3D toys perform it on the stage (D34).
    const shown = !!document.querySelector('.sanctuary__scene .sp-trick .sp-trick-emote') || window.__stage3d?.actor(key)?.performing(performance.now()) === 'wave';
    return { on: fig?.dataset.trick, shown };
  });
  check('a free trick plays with its emote', trick.on === 'wave' && trick.shown, JSON.stringify(trick));
  await page.waitForTimeout(1800);
  check('the trick ends by itself', await page.evaluate(() => !document.querySelector('.sp-trick') && !document.querySelector('.sanctuary__scene [data-trick]')));
  await page.click('[data-tray-tab="emote"]');
  await page.click('.trick-chip[data-trick="love"]');
  check('a free emote plays from the Emotes tab', await page.evaluate(() => document.querySelector('.sanctuary__scene .sanctuary__pet[data-trick]')?.dataset.trick === 'love'));
  await page.waitForTimeout(1900);
  await page.click('[data-tray-tab="trick"]');
  await page.click('.trick-chip[data-trick="backflip"]');
  await page.waitForSelector('.trick-sheet');
  await page.waitForSelector('.trick-sheet__stage.has-3d', { timeout: 10000 }).catch(() => {});
  check('the card previews the trick with a 3D toy', await page.evaluate(() => !!document.querySelector('.trick-sheet__stage.has-3d > canvas.scene3d')));
  check('a premium trick opens its card, bought with gems only', /gem/i.test(await page.textContent('.trick-sheet')) && !(await page.$('.trick-sheet [data-act="watch"]')));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  const spent = await page.evaluate(() => {
    const s = window.__pt.app.save;
    return s.inventory.items.length;
  });
  await page.click('.trick-chip[data-trick="spin"]');
  await page.waitForSelector('.trick-sheet');
  check('a video-token trick can’t be bought without tokens', !!(await page.$('.trick-sheet button[disabled]')) && !(await page.$('.trick-sheet [data-act="buy"]')));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  check('closing a card releases its 3D preview', await page.evaluate(() => document.querySelectorAll('canvas.scene3d').length === 1));
  check('looking at tricks charges nothing', (await page.evaluate(() => window.__pt.app.save.inventory.items.length)) === spent);
  // Without a pointer: the Tricks button opens the same tray, focus goes into it and comes back when it closes
  await page.click('[data-act="tray-close"]');
  check('closing the tray returns focus to the Tricks button', await page.evaluate(() => document.activeElement?.dataset?.act === 'tricks' && document.querySelector('.trick-tray-slot').hidden));
  await page.keyboard.press('Enter');
  await page.waitForSelector('.trick-tray');
  check('the Tricks button opens the tray from the keyboard', await page.evaluate(() => !!document.activeElement?.closest('.trick-tray') && document.querySelector('[data-act="tricks"]').getAttribute('aria-expanded') === 'true'));
  await page.evaluate(() => window.__pt.go({ screen: 'shop', tab: 'tricks' }));
  await page.waitForSelector('.trick-card');
  check('the Shop lists every trick and emote', (await page.$$('.trick-card')).length === 18);

  // Paw Cup waits for the two-animal lesson; then an open attempt survives other play, resumes, and scores from its log
  await page.evaluate(() => window.__pt.go({ screen: 'league' }));
  await page.click('.segmented [data-tab="week"]');
  await page.click('[data-act="ok"]').catch(() => {});
  check('Paw Cup boards stay closed before two animals', !(await page.$('[data-board="0"]')));

  // Level 21: the two-animal lesson, a guided board with an animal button for each
  await page.evaluate(() => {
    const s = window.__pt.app.save;
    for (let i = 1; i < 21; i++) s.journey.clears['L' + i] ??= { firstClearAt: new Date().toISOString(), bestSeconds: 60, bestMistakes: 0, clean: true, hintFree: true, stars: 3 };
    s.journey.nextLevel = 21;
    s.onboarding.pairLessonDone = false;
    window.__pt.app.persist();
    window.__pt.start({ kind: 'level', level: 21 });
  });
  await page.waitForSelector('.game.is-guided .cell.is-guide');
  const lesson = await page.evaluate(() => ({
    rule: window.__pt.app.active.session.rule ?? 'pair',
    tools: document.querySelectorAll('.controls--pair [data-tool]').length,
    coach: document.querySelector('[data-coach]')?.textContent ?? '',
    cast: window.__pt.app.active.cast,
  }));
  check('level 21 teaches two animals on a guided board', lesson.rule === 'pair' && lesson.tools === 2 && /two animals/i.test(lesson.coach), JSON.stringify(lesson));
  check('the lesson pairs the animal coming home with a different kind already home', !!lesson.cast.b && lesson.cast.a !== lesson.cast.b, JSON.stringify(lesson.cast));
  await reachPairs(25);
  await page.evaluate(() => window.__pt.go({ screen: 'home' }));
  await page.evaluate(() => window.__pt.go({ screen: 'league' }));
  await page.click('.segmented [data-tab="week"]');
  await page.click('[data-board="0"]');
  await page.click('[data-act="go"]');
  await page.waitForTimeout(200);
  check('two-animal boards add two animal buttons', (await page.$$('.controls--pair [data-tool]')).length === 2);
  await solveActive({ stopAfter: 2 }).catch(() => {});
  await page.click('[data-act="pause"]');
  check('Paw Cup hides the board while paused', !!(await page.$('.board-veil')));
  await page.click('.sheet [data-act="rules"]');
  check('…and while the rules are open', !!(await page.$('.board-veil')));
  await page.click('[data-act="ok"]');
  await page.waitForTimeout(150);
  check('the board comes back after the rules', !(await page.$('.board-veil')));
  await page.click('[data-act="leave"]');
  await page.evaluate(() => window.__pt.start({ kind: 'level', level: 4 }));
  await page.waitForTimeout(200);
  await solveActive({ stopAfter: 1 }).catch(() => {});
  await page.evaluate(() => window.__pt.go({ screen: 'league' }));
  check('the open Cup attempt is still resumable after playing another board', !!(await page.$('[data-resume="0"]')));
  await page.click('[data-resume="0"]');
  await page.waitForTimeout(200);
  await solveActive();
  const pts = Number((await page.textContent('.score-card__total .num')) ?? 0);
  check('a resumed Cup attempt scores from its whole log', pts > 550, String(pts));
  await page.click('[data-act="next"]');

  // Two-animal boards remember the animal picked last
  await page.evaluate(() => window.__pt.start({ kind: 'level', level: 23 }));
  await page.waitForTimeout(300);
  await page.click('[data-tool="dog"]');
  await page.evaluate(() => window.__pt.app.saveActive());
  await reload();
  await page.evaluate(() => window.__pt.start({ kind: 'level', level: 24 }));
  await page.waitForTimeout(300);
  check('the next two-animal board opens with the last animal picked', (await page.getAttribute('[data-tool="dog"]', 'aria-checked')) === 'true');
  const castNames = await page.$$eval('.controls [data-tool] .tool__label', (els) => els.map((e) => e.textContent));
  check('the animal buttons are named for the board’s animals', castNames.length === 2 && castNames.every((n) => n && n !== 'Cat' && n !== 'Dog'), castNames.join(','));

  // Re-entering a mode resumes its saved board instead of wiping it
  const dk = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  await page.evaluate((k) => window.__pt.start({ kind: 'daily', dateKey: k }), dk);
  await page.waitForTimeout(200);
  await solveActive({ stopAfter: 1 }).catch(() => {});
  await page.evaluate(() => window.__pt.go({ screen: 'home' }));
  await page.click('[data-act="daily"]');
  await page.waitForTimeout(200);
  const dPlaced = await page.evaluate(() => window.__pt.app.active.session.placedCount());
  const dGivens = await page.evaluate(() => window.__pt.app.active.session.puzzle.givens.length);
  check('tapping the Daily again continues the saved daily', dPlaced === dGivens + 1, `${dPlaced} vs ${dGivens + 1}`);

  // World map: a pin for every sanctuary; the Farm is built first; every solve grows the sanctuary being built
  await page.evaluate(() => window.__pt.go({ screen: 'home' }));
  await page.click('.nav [data-tab="world"]');
  await page.waitForSelector('.world-map');
  check('the World tab shows a pin for every sanctuary', (await page.$$('.world-pin')).length === 6);
  check('the Farm is being built', !!(await page.$('.world-pin.is-building[data-go="farm"]')));
  check('the Outback is open by level 25', !(await page.$('.world-pin.is-locked[data-go="outback"]')));
  check('later sanctuaries stay locked until their level', !!(await page.$('.world-pin.is-locked[data-go="amazon"]')));
  await page.click('.world-card[data-go="farm"]');
  await page.waitForSelector('.region .sanctuary__scene svg');
  const g0 = await page.evaluate(() => window.__pt.app.save.world.growth.farm ?? 0);
  await page.click('.region-progress [data-act="play"]');
  await page.waitForSelector('.board');
  await page.waitForTimeout(500);
  if (await page.$('.overlay')) await page.evaluate(() => document.querySelector('.overlay [data-act]')?.click());
  await page.waitForTimeout(300);
  await solveActive();
  const g1 = await page.evaluate(() => window.__pt.app.save.world.growth.farm ?? 0);
  check('solving a puzzle grows the sanctuary being built by one', g1 === g0 + 1, `${g0} → ${g1}`);
  check('the win sheet says who is coming home next', /is on the way/.test((await page.textContent('.win-sheet')) ?? ''));
  await page.evaluate(() => window.__pt.go({ screen: 'shop', sanctuary: 'amazon' }));
  check('a locked sanctuary’s decorations cannot be bought yet', !!(await page.$('.shop-card.is-locked[data-decor="waterfall"]')));

  // Leaderboard (on-device in development builds): opt-in, points only from server-checked solves, leaving deletes all
  await page.evaluate(() => window.__pt.go({ screen: 'league' }));
  await page.click('.segmented [data-tab="leaderboard"]');
  await page.waitForSelector('.lb-join');
  check('the leaderboard is opt-in and starts with a suggested name', ((await page.inputValue('input[name="nickname"]')) ?? '').length >= 3);
  await page.fill('input[name="nickname"]', 'no');
  await page.click('[data-act="join"]');
  await page.waitForTimeout(300);
  check('a too-short name is refused with a reason', /characters/.test((await page.textContent('.lb-field__error')) ?? ''));
  await page.fill('input[name="nickname"]', 'Cozy Otter 77');
  await page.click('[data-act="join"]');
  await page.waitForSelector('.lb-me');
  check('joining shows you on the leaderboard', /Cozy Otter 77/.test((await page.textContent('.lb-me')) ?? ''));
  await page.evaluate(() => window.__pt.start({ kind: 'level', level: 2 }));
  await page.waitForSelector('.board');
  await page.waitForTimeout(400);
  if (await page.$('.overlay')) await page.evaluate(() => document.querySelector('.overlay [data-act]')?.click());
  // At a person's pace: the server doesn't count boards solved faster than a person can place animals.
  await solveActive({ pace: 320 });
  const lbTotal = await page
    .waitForFunction(() => {
      const l = window.__pt.app.save.leaderboard;
      return l.pending.length === 0 && (l.last?.total ?? 0) > 0 && l.last.total;
    }, null, { timeout: 8000 })
    .then((h) => h.jsonValue(), () => 0);
  check('a solved level adds server-checked points to the leaderboard', lbTotal > 100, String(lbTotal));
  await page.evaluate(() => window.__pt.go({ screen: 'league' }));
  await page.waitForSelector('.lb-row.is-you');
  check('the table shows your points', Number(((await page.textContent('.lb-row.is-you .lb-pts')) ?? '0').replace(/\D/g, '')) === lbTotal);
  await page.click('.lb-actions [data-act="leave"]');
  await page.click('.overlay [data-act="leave"]');
  await page.waitForSelector('.lb-join');
  check('leaving the leaderboard deletes your entry', await page.evaluate(() => !window.__pt.app.save.leaderboard.joined && !(localStorage.getItem('pawtopia.lb.device') ?? '').includes('Cozy Otter 77')));

  // Scoped reset
  // Settings → 3D animals off: the drawn animals come back, and no 3D layer is made.
  await page.evaluate(() => window.__pt.go({ screen: 'home' }));
  await page.click('[data-act="settings"]');
  await page.click('[data-switch="toys3d"]');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__pt.go({ screen: 'region', id: 'farm' }));
  await page.waitForTimeout(1200);
  check('with 3D animals off, the drawn animals show and no 3D layer is made', await page.evaluate(() => !window.__pt.app.settings.toys3d && !document.querySelector('canvas.scene3d') && getComputedStyle(document.querySelector('.sanctuary__scene .sanctuary__pet')).opacity === '1'));
  await page.evaluate(() => window.__pt.go({ screen: 'home' }));
  await page.click('[data-act="settings"]');
  await page.click('[data-act="reset"]');
  await page.click('[data-act="erase"]');
  await page.waitForTimeout(200);
  const other = await page.evaluate(() => localStorage.getItem('someone.else'));
  check('erasing progress keeps unrelated storage', other === 'keep me');
  check('erasing progress resets the journey', (await page.evaluate(() => window.__pt.app.save.journey.nextLevel)) === 1);

  check('no page errors', errors.length === 0, errors.join(' | '));
} catch (e) {
  check('suite ran to completion', false, String(e).slice(0, 300));
} finally {
  await browser.close();
}

console.log(results.join('\n'));
console.log(failed ? `\n${failed} failed` : `\nall ${results.length} passed`);
process.exit(failed ? 1 : 0);
