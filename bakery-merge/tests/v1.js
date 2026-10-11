// Bakery Merge automated test (Playwright). Run: node tests/<name>.js  (or tests/run-all.sh)
const path = require('path'), fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium } = pw;
const GAME = path.resolve(__dirname, '..', 'index.html');
fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true }); process.chdir(path.join(__dirname, 'out'));
const URL = 'file://' + GAME;
const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ru-RU' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await p.goto(URL); await p.waitForTimeout(900);
  assert(await p.evaluate(() => document.documentElement.lang) === 'ru', 'russian locale auto-detected');
  await p.click('#mBtns .btn'); await p.waitForTimeout(400);
  const cc = i => p.evaluate(i => { const B = window.__bakery; const c = B.cellCenter(i); return { x: c.x + B.L.ax, y: c.y + B.L.ay }; }, i);
  const st = () => p.evaluate(() => { const B = window.__bakery; return { e: B.G.energy, co: B.G.coins, lvl: B.G.lvl, done: B.G.done, b: B.board.map(x => x ? (x.k === 'i' ? x.c + x.l : x.k === 'g' ? 'G' + x.c : 'X' + x.hp) : '') }; });
  let s0 = await st();
  // merge two wheat: 16 -> 18
  let a = await cc(16), c = await cc(18);
  await p.mouse.move(a.x, a.y); await p.mouse.down(); 
  for (let k = 1; k <= 8; k++) await p.mouse.move(a.x + (c.x - a.x) * k / 8, a.y + (c.y - a.y) * k / 8 + 0);
  // drop point is offset -0.25 cell upwards inside game; compensate
  const cs = await p.evaluate(() => window.__bakery.L.cs);
  await p.mouse.move(c.x, c.y + cs * 0.25); await p.mouse.up();
  await p.waitForTimeout(300);
  let s1 = await st();
  assert(s1.b[18] === 'bread2' && s1.b[16] === '', 'drag-merge wheat+wheat -> flour');
  // tap mill 5 times
  const mill = await cc(24);
  for (let k = 0; k < 5; k++) { await p.mouse.click(mill.x, mill.y); await p.waitForTimeout(120); }
  let s2 = await st();
  assert(s2.e === s1.e - 5, 'mill taps spend energy (' + s1.e + ' -> ' + s2.e + ')');
  assert(s2.b.filter(x => x.startsWith('bread')).length === 6, 'mill spawned 5 items');
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'play1.png' });
  // deliver order 0 (needs flour) by tapping card
  const ready = await p.evaluate(() => window.__bakery.slots.map(s => s.o && s.o.ready));
  console.log('ready flags', ready);
  const ri = ready.indexOf(true);
  if (ri >= 0) {
    const R = await p.evaluate(i => { const B = window.__bakery, R = B.L.cards[i]; return { x: R.x + R.w / 2 + B.L.ax, y: R.y + R.h * 0.85 + B.L.ay }; }, ri);
    await p.mouse.click(R.x, R.y); await p.waitForTimeout(300);
    const s3 = await st();
    assert(s3.done === 1 && s3.co > s2.co, 'order delivered, coins ' + s2.co + ' -> ' + s3.co);
    await p.waitForTimeout(250); await p.screenshot({ path: 'play2.png' });
    await p.waitForTimeout(1800);
    const after = await p.evaluate(i => window.__bakery.slots[i].state, ri);
    assert(after === 'idle' || after === 'in', 'new customer arrived (' + after + ')');
  } else assert(false, 'an order should be ready');
  // shop: give coins, buy pastry shop
  await p.evaluate(() => { window.__bakery.G.coins = 1000; });
  await p.click('#btnShop'); await p.waitForTimeout(400);
  await p.screenshot({ path: 'shop.png' });
  const buys = await p.$$('.ubuy');
  await buys[4].click(); await p.waitForTimeout(300);
  await (await p.$$('.ubuy'))[0].click(); await p.waitForTimeout(200);
  const s4 = await st();
  assert(s4.b.includes('Gcake'), 'hen house placed after buying pastry shop');
  assert(s4.co === 1000 - 80 - 60, 'coins deducted (' + s4.co + ')');
  await p.click('#mBtns .btn'); await p.waitForTimeout(400);
  // energy ad
  const eBefore = (await st()).e;
  await p.click('#btnEnergyAd'); await p.waitForTimeout(300);
  assert(await p.isVisible('#ad'), 'ad overlay shown');
  await p.screenshot({ path: 'ad.png' });
  await p.waitForTimeout(5300);
  await p.click('#adClose'); await p.waitForTimeout(300);
  assert((await st()).e === eBefore + 20, 'rewarded ad gave +20 energy');
  // early-close rewarded => no reward
  await p.click('#btnEnergyAd'); await p.waitForTimeout(500);
  await p.click('#adClose'); await p.waitForTimeout(200);
  assert((await st()).e === eBefore + 20, 'early close gives no reward');
  // clear ad opens crates
  const cratesBefore = (await st()).b.filter(x => x.startsWith('X')).length;
  await p.click('#btnClearAd'); await p.waitForTimeout(5300); await p.click('#adClose'); await p.waitForTimeout(800);
  const cratesAfter = (await st()).b.filter(x => x.startsWith('X')).length;
  assert(cratesAfter === cratesBefore - 3, 'clear ad opened 3 crates (' + cratesBefore + ' -> ' + cratesAfter + ')');
  // select an item and sell
  await p.waitForTimeout(500);
  const before = await st();
  // persistence
  await p.waitForTimeout(1000);
  await p.reload(); await p.waitForSelector('#loader', { state: 'hidden' }); await p.waitForTimeout(300);
  const s5 = await st();
  assert(JSON.stringify(s5.b) === JSON.stringify(before.b), 'board persisted across reload');
  assert(s5.co === before.co, 'coins persisted');
  assert(!(await p.isVisible('#modal')), 'no welcome on 2nd launch');
  // tap hen to spawn egg
  const henIdx = s5.b.indexOf('Gcake'); const hen = await cc(henIdx);
  await p.mouse.click(hen.x, hen.y); await p.waitForTimeout(500);
  assert((await st()).b.includes('cake1') || (await st()).b.includes('cake2'), 'hen spawns eggs');
  await p.waitForTimeout(7500); // let hint appear
  await p.screenshot({ path: 'play3.png' });
  console.log('ERRORS:', JSON.stringify(errs, null, 1));
  // storage blocked scenario
  const ctx2 = await b.newContext({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, locale: 'en-US' });
  await ctx2.addInitScript(() => { const thr = () => { throw new Error('SecurityError'); }; Object.defineProperty(window, 'localStorage', { get: thr }); });
  const p2 = await ctx2.newPage(); const errs2 = [];
  p2.on('pageerror', e => errs2.push(e.message));
  await p2.goto(URL); await p2.waitForTimeout(900);
  await p2.click('#mBtns .btn'); await p2.waitForTimeout(300);
  await p2.screenshot({ path: 'small.png' });
  assert(errs2.length === 0, 'runs with blocked localStorage ' + JSON.stringify(errs2));
  // desktop
  const p3 = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await p3.goto(URL); await p3.waitForTimeout(800); await p3.screenshot({ path: 'desktop.png' });
  await b.close();
  console.log(process.exitCode ? 'FAILED' : 'ALL PASSED');
})();
