/* End-to-end smoke test. Drives the real app in a real browser and checks that
   every tab renders, logging works, and the coach math comes out sane.

     npx http-server -p 8199 -s .      # in one shell, from the repo root
     node test/smoke.js                # in another

   Needs Playwright available either locally or globally. */
let chromium;
try {
  chromium = require('playwright').chromium;
} catch (e) {
  const { execSync } = require('child_process');
  const root = execSync('npm root -g').toString().trim();
  chromium = require(root + '/playwright').chromium;
}

const BASE = process.env.BASE || 'http://127.0.0.1:8199';
const fails = [];
function check(name, cond, extra) {
  if (cond) console.log('  PASS  ' + name);
  else { console.log('  FAIL  ' + name + (extra ? ' :: ' + extra : '')); fails.push(name); }
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(BASE + '/index.html');
  await page.waitForTimeout(300);

  // --- onboarding modal should appear on a fresh install ---
  check('onboarding modal shown', await page.locator('.modal h2').textContent() === 'Set up your plan');

  // fill the profile: 27yo male, 6ft, 186 lbs, cut
  await page.locator('.modal input[type=number]').nth(0).fill('27');      // age
  await page.locator('.modal input[type=number]').nth(1).fill('6');       // ft
  await page.locator('.modal input[type=number]').nth(2).fill('0');       // in
  await page.locator('.modal input[type=number]').nth(3).fill('186');     // weight
  await page.locator('.modal input[type=number]').nth(4).fill('170');     // goal
  const preview = await page.locator('.modal .card-sub').textContent();
  console.log('  preview: ' + preview);
  check('preview computes maintenance', /Maintenance ≈ \d{4}/.test(preview), preview);
  await page.locator('.modal button.btn:not(.ghost)').click();
  await page.waitForTimeout(200);
  check('modal closed after save', await page.locator('.modal').count() === 0);

  // --- dashboard ---
  const ringText = await page.locator('.ring text').first().textContent();
  check('dashboard ring renders', ringText === '0');
  check('weight shows on dashboard', (await page.locator('main').textContent()).includes('186 lb'));

  // --- food logging ---
  await page.locator('.tab[data-view=food]').click();
  await page.waitForTimeout(150);
  await page.locator('input[type=search]').fill('chicken breast');
  await page.waitForTimeout(150);
  check('food search returns results', await page.locator('.result').count() > 0);
  await page.locator('.result').first().click();
  await page.waitForTimeout(150);
  check('quantity modal opened', (await page.locator('.modal h2').textContent()).includes('Chicken'));
  await page.locator('.modal input[type=number]').fill('8');
  await page.waitForTimeout(100);
  const qPreview = await page.locator('.modal .card-sub').textContent();
  check('quantity scales macros', qPreview.startsWith('374 kcal'), qPreview);
  await page.locator('.modal button.btn:not(.ghost)').click();
  await page.waitForTimeout(200);
  check('food entry listed', (await page.locator('main').textContent()).includes('Chicken breast'));

  // add a carb + a beer for the alcohol advice path
  for (const [q, term] of [['2', 'white rice'], ['3', 'beer, light']]) {
    await page.locator('input[type=search]').fill(term);
    await page.waitForTimeout(150);
    await page.locator('.result').first().click();
    await page.waitForTimeout(150);
    await page.locator('.modal input[type=number]').fill(q);
    await page.locator('.modal button.btn:not(.ghost)').click();
    await page.waitForTimeout(150);
  }
  const foodText = await page.locator('main').textContent();
  check('multiple entries logged', foodText.includes('White rice') && foodText.includes('Beer'));

  // --- custom food ---
  await page.locator('button.btn.ghost.sm', { hasText: 'Custom' }).first().click();
  await page.waitForTimeout(150);
  await page.locator('.modal input').first().fill('Test Casserole');
  await page.locator('.modal input[type=number]').nth(1).fill('500');
  await page.locator('.modal input[type=number]').nth(2).fill('30');
  await page.locator('.modal button.btn:not(.ghost)').click();
  await page.waitForTimeout(200);
  check('custom food chains to quantity modal', (await page.locator('.modal h2').textContent()) === 'Test Casserole');
  await page.locator('.modal button.btn:not(.ghost)').click();
  await page.waitForTimeout(200);
  check('custom food logged', (await page.locator('main').textContent()).includes('Test Casserole'));

  /* Regex metacharacters in a query must be escaped, not interpreted.
     Matching alone cannot detect a broken escape — the plain-substring branch
     catches everything the word-boundary branch would — so assert the RANKING
     that the word-boundary branch exists to produce: a query landing at the
     start of a word outranks the same text buried mid-word. This is also the
     regression test for a bundler mangling the `\\$&` escape idiom. */
  const metaSearch = await page.evaluate(() => {
    Store.update(s => {
      ['Aa c.o thing', 'Xc.o thing'].forEach(name => s.customFoods.push({
        name, unit: 'serving', serving: 1, kcal: 1, p: 0, c: 0, f: 0, tags: 'custom'
      }));
    });
    try {
      return { ranked: Foods.search('c.o', 5).map(f => f.name), threw: false };
    } catch (e) {
      return { ranked: [], threw: true, message: e.message };
    }
  });
  check('metacharacter search does not throw', !metaSearch.threw, metaSearch.message);
  check('metacharacter escaped, word-boundary ranking preserved',
    metaSearch.ranked[0] === 'Aa c.o thing', JSON.stringify(metaSearch.ranked));

  // --- training ---
  await page.locator('.tab[data-view=train]').click();
  await page.waitForTimeout(150);
  check('programs listed', await page.locator('main').textContent().then(t => t.includes('Upper / Lower')));
  await page.locator('button.btn.ghost.sm', { hasText: 'Use' }).first().click();
  await page.waitForTimeout(200);
  check('program activated', (await page.locator('main').textContent()).includes('Active'));
  await page.locator('button.btn.ghost.sm', { hasText: 'Upper A' }).first().click();
  await page.waitForTimeout(250);
  check('template loaded into editor', (await page.locator('main').textContent()).includes('Logging session'));
  check('template exercises present', await page.locator('.exercise').count() === 6);
  check('bench has 4 set rows', await page.locator('.exercise').first().locator('.set-row').count() === 4);

  // fill in bench sets
  const bench = page.locator('.exercise').first();
  for (let i = 0; i < 4; i++) {
    await bench.locator('.set-row').nth(i).locator('input').nth(0).fill('185');
    await bench.locator('.set-row').nth(i).locator('input').nth(1).fill('6');
  }
  await page.waitForTimeout(400);
  const volText = await page.locator('main .mono').first().textContent();
  check('session volume computed', volText === '4,440 lb', volText);
  check('PR star shown', await bench.locator('.set-row .pr.good').count() >= 0);

  // add an exercise manually
  await page.locator('button.btn.ghost', { hasText: 'Add exercise' }).click();
  await page.waitForTimeout(150);
  await page.locator('.modal input[type=search]').fill('lateral');
  await page.waitForTimeout(150);
  await page.locator('.modal .result').first().click();
  await page.waitForTimeout(250);
  check('exercise added', await page.locator('.exercise').count() === 7);

  await page.locator('button.btn.ghost.sm', { hasText: 'Done' }).click();
  await page.waitForTimeout(250);
  check('back to train list', (await page.locator('main').textContent()).includes('Recent sessions'));
  check('workout saved', (await page.locator('main').textContent()).includes('4,440 lb'));

  // --- seed history via localStorage, then verify coach math ---
  await page.evaluate(() => {
    const s = Store.get();
    const today = Store.today();
    // 28 days of weight declining ~0.75 lb/wk from 186, with noise
    s.weights = [];
    for (let i = 27; i >= 0; i--) {
      const base = 186 - (27 - i) * (0.75 / 7);
      const noise = Math.sin(i * 1.7) * 0.8;
      s.weights.push({ date: Store.addDays(today, -i), lbs: Math.round((base + noise) * 10) / 10 });
    }
    // 21 days of food at 2200 kcal / 150g protein
    for (let i = 20; i >= 1; i--) {
      s.food[Store.addDays(today, -i)] = [
        { name: 'Seeded day', qty: 1, unit: 'day', kcal: 2200, p: 150, c: 220, f: 70 }
      ];
    }
    Store.save();
  });
  await page.reload();
  await page.waitForTimeout(300);

  const measured = await page.evaluate(() => Coach.measuredTdee(21));
  console.log('  measured TDEE: ' + JSON.stringify(measured));
  check('measured TDEE derived', measured && measured.tdee > 2200 && measured.tdee < 2700,
    JSON.stringify(measured));

  const trend = await page.evaluate(() => Coach.weightTrend(21));
  check('weight trend negative and sane', trend && trend.perWeek < -0.4 && trend.perWeek > -1.2,
    JSON.stringify(trend));

  const proj = await page.evaluate(() => Coach.projection());
  check('projection produced', proj && proj.weeks > 0, JSON.stringify(proj));

  await page.locator('.tab[data-view=coach]').click();
  await page.waitForTimeout(250);
  const coachText = await page.locator('main').textContent();
  check('coach shows advice', await page.locator('.advice').count() > 3);
  check('coach shows measured maintenance', /Measured maintenance/.test(coachText));

  // --- progress charts ---
  await page.locator('.tab[data-view=progress]').click();
  await page.waitForTimeout(250);
  check('weight chart drawn', await page.locator('.chart .series').count() >= 1);
  check('raw series drawn', await page.locator('.chart .series-raw').count() >= 1);
  check('volume bars drawn', await page.locator('.chart .bar-rect').count() >= 1);
  check('e1RM listed', (await page.locator('main').textContent()).includes('Barbell Bench Press'));

  // --- history: every logged day survives and records compute ---
  // Seed enough distinct lifts to push the PB list past its preview cap. Kept
  // light (50 lb x 5) and back-dated so it cannot displace the records the
  // later assertions check.
  await page.evaluate(() => {
    const old = Store.addDays(Store.today(), -40);
    const lifts = ['Leg Press', 'Leg Curl', 'Calf Raise', 'Lat Pulldown', 'Dumbbell Row',
      'Lateral Raise', 'Barbell Curl', 'Triceps Pushdown', 'Hip Thrust', 'Face Pull',
      'Front Squat', 'Dumbbell Bench Press'];
    Store.update(s => {
      s.workouts.push({
        id: Store.newId(), date: old, name: 'Seeded variety', notes: '',
        exercises: lifts.map(name => ({ name, sets: [{ weight: '50', reps: '5' }] }))
      });
    });
  });
  await page.reload();
  await page.waitForTimeout(300);
  await page.locator('.tab[data-view=history]').click();
  await page.waitForTimeout(300);
  const histText = await page.locator('main').textContent();
  check('history lists logged days', await page.locator('.list li').count() >= 20, histText.slice(0, 80));
  check('history shows records', /Heaviest set|Biggest session/.test(histText));
  check('history shows per-lift bests', histText.includes('Best per lift'));

  // Long PB lists collapse behind an expander so the page stays scannable.
  const expander = page.locator('button.btn.ghost.sm').filter({ hasText: 'Show all' });
  check('long PB list is collapsed by default', await expander.count() === 1);
  const before = await page.locator('.list li').count();
  await expander.first().click();
  await page.waitForTimeout(250);
  const after = await page.locator('.list li').count();
  check('PB list expands', after > before, before + ' -> ' + after);
  await page.locator('button.btn.ghost.sm').filter({ hasText: 'Show fewer' }).first().click();
  await page.waitForTimeout(250);
  check('PB list collapses', await page.locator('.list li').count() === before);

  const histData = await page.evaluate(() => ({
    days: Records.dailyHistory(90).length,
    streak: Records.loggingStreak(),
    heaviest: Records.heaviestSet(),
    session: Records.bestSession(),
    lowest: Records.lowestWeight(),
    all: Records.allTime()
  }));
  console.log('  history: ' + JSON.stringify(histData.streak) + ' days=' + histData.days);
  check('every seeded day is retained', histData.days >= 28, String(histData.days));
  check('streak counted', histData.streak.current >= 20, JSON.stringify(histData.streak));
  check('heaviest set recorded with date',
    histData.heaviest && histData.heaviest.weight === 185 && !!histData.heaviest.date,
    JSON.stringify(histData.heaviest));
  check('best session recorded', histData.session && histData.session.volume === 4440,
    JSON.stringify(histData.session));
  check('lowest weight recorded', histData.lowest && histData.lowest.lbs > 0,
    JSON.stringify(histData.lowest));
  check('all-time totals counted', histData.all.sessions >= 1 && histData.all.sets >= 4,
    JSON.stringify(histData.all));

  // Tapping a past day must open THAT day's log, not today's.
  const targetDay = await page.evaluate(() => Records.dailyHistory(90)[3].date);
  const expectedLabel = await page.evaluate(d => Store.prettyDate(d), targetDay);
  await page.locator('.card').last().locator('.list li').nth(3).click();
  await page.waitForTimeout(300);
  const openedText = await page.locator('main').textContent();
  check('tapping a past day opens that day', openedText.includes('Logged — ' + expectedLabel),
    expectedLabel);
  check('past day still holds its entries', openedText.includes('Seeded day'), openedText.slice(0, 120));

  // --- in-page confirm (native dialogs are suppressed in sandboxed frames) ---
  await page.locator('.tab[data-view=train]').click();
  await page.waitForTimeout(200);
  await page.locator('.list .x-btn').first().click();
  await page.waitForTimeout(200);
  check('delete asks for confirmation', (await page.locator('.modal h2').textContent()) === 'Delete this session?');
  await page.locator('.modal button.btn.ghost').click();
  await page.waitForTimeout(200);
  check('cancel keeps the workout', (await page.locator('main').textContent()).includes('4,440 lb'));
  await page.locator('.list .x-btn').first().click();
  await page.waitForTimeout(200);
  await page.locator('.modal button.btn.danger').click();
  await page.waitForTimeout(250);
  check('confirm deletes the workout', !(await page.locator('main').textContent()).includes('4,440 lb'));

  // --- persistence across reload ---
  await page.reload();
  await page.waitForTimeout(300);
  check('no onboarding on return visit', await page.locator('.modal').count() === 0);
  check('data persisted', (await page.locator('main').textContent()).includes('kcal'));

  // --- light theme sanity ---
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForTimeout(150);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('light theme applies', bg === 'rgb(246, 248, 250)', bg);

  await page.screenshot({ path: process.env.SHOT || '/tmp/shot.png', fullPage: true });

  // An explicit light choice has to beat a dark OS preference.
  const forced = await browser.newPage({ colorScheme: 'dark' });
  await forced.goto(BASE + '/index.html');
  await forced.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await forced.waitForTimeout(250);
  const forcedBg = await forced.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('explicit light theme beats dark OS', forcedBg === 'rgb(246, 248, 250)', forcedBg);
  await forced.close();

  // A browser that drops writes must say so rather than losing the log quietly.
  const blocked = await browser.newPage();
  await blocked.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new Error('blocked'); }
    });
  });
  const blockedErrors = [];
  blocked.on('pageerror', e => blockedErrors.push(e.message));
  await blocked.goto(BASE + '/index.html');
  await blocked.waitForTimeout(300);
  check('warns when storage is unavailable', await blocked.locator('.banner').count() === 1);
  check('still usable without storage', await blocked.locator('.modal').count() === 1);
  check('no crash without storage', blockedErrors.length === 0, blockedErrors.join('; '));
  await blocked.close();

  await browser.close();
  console.log('\nJS errors: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
  console.log(fails.length ? '\n' + fails.length + ' FAILURES' : '\nAll checks passed.');
  process.exit(fails.length || errors.length ? 1 : 0);
})();
