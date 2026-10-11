// Bakery Merge automated test (Playwright). Run: node tests/<name>.js  (or tests/run-all.sh)
const path = require('path'), fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium } = pw;
const GAME = path.resolve(__dirname, '..', 'index.html');
fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true }); process.chdir(path.join(__dirname, 'out'));
const URL = 'file://' + GAME;
let fails = 0;
const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ru-RU' });
  const p = await ctx.newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await p.goto(URL); await sleep(900);
  await p.click('#mBtns .btn'); await sleep(300);
  await p.evaluate(() => { const B = window.__bakery; B.G.tu = 9; B.G.daily.d = B.dayStr(0); B.changed(); });
  await sleep(1200);
  const st = () => p.evaluate(() => { const B = window.__bakery; return { co: B.G.coins, e: B.G.energy, wh: B.G.wh, items: B.board.filter(x => x && x.k === 'i').length }; });
  /* --- wheel --- */
  assert(await p.isVisible('#questDot'), 'rewards dot lit by free spin');
  await p.click('#btnQuests'); await sleep(400);
  assert((await p.locator('.tab.on').textContent()) === 'Колесо' || (await p.locator('.tab').count()) === 3, 'rewards window has 3 tabs');
  await p.locator('.tab').nth(2).click(); await sleep(300);
  await p.screenshot({ path: 'wheel.png' });
  let s0 = await st();
  await p.click('.wbtn', { force: true }); await sleep(1800);
  await p.screenshot({ path: 'wheel_spin.png' });
  await sleep(3200);
  let s1 = await st();
  assert(s1.wh.free === 1 && (s1.co > s0.co || s1.e > s0.e || s1.items > s0.items), 'free spin granted a prize');
  const btxt = await p.textContent('.wbtn');
  assert(btxt.includes('3'), 'next spins via ads: ' + btxt);
  await p.click('.wbtn', { force: true }); await sleep(400);
  assert(await p.isVisible('#ad'), 'ad shown for extra spin');
  await sleep(5300); await p.click('#adClose'); await sleep(4800);
  s1 = await st();
  assert(s1.wh.ads === 1, 'ad spin counted');
  await p.click('#mBtns .btn'); await sleep(300);
  /* --- order focus --- */
  await p.evaluate(() => { const B = window.__bakery; B.setOrder(1, B.makeOrder([{ c: 'bread', l: 4 }]), true); B.board[20] = { k: 'i', c: 'bread', l: 2 }; B.recount(); });
  const R = await p.evaluate(() => { const B = window.__bakery, R = B.L.cards[1]; return { x: R.x + R.w / 2 + B.L.ax, y: R.y + R.h * 0.3 + B.L.ay }; });
  await p.mouse.click(R.x, R.y); await sleep(200);
  const f = await p.evaluate(() => window.__bakery.focus);
  const ok = await p.evaluate(f => f && f.cells.length > 0 && f.cells.every(i => { const it = window.__bakery.board[i]; return it && it.c === 'bread' && (it.k === 'g' || it.l < 4); }), f);
  assert(ok, 'order tap highlights bread items below the needed level: ' + JSON.stringify(f && f.cells));
  await p.screenshot({ path: 'focus.png' });
  /* --- new customers --- */
  await p.evaluate(() => { const B = window.__bakery; [6, 7, 8].forEach((c, i) => { const o = B.makeOrder([{ c: 'bread', l: 2 }]); o.cust = c; B.setOrder(i, o, true); }); B.recount(); });
  await sleep(300); await p.screenshot({ path: 'newcust.png' });
  /* --- themes ambient --- */
  await p.evaluate(() => { const B = window.__bakery; B.G.pr = 4; B.G.th = 4; B.layout(); });
  await sleep(1500); await p.screenshot({ path: 'snow.png' });
  /* --- battery saver --- */
  await p.click('#btnSettings'); await sleep(300);
  const rows = await p.locator('.srow span').allTextContents();
  const ecoIdx = rows.findIndex(x => x.includes('Экономия'));
  assert(ecoIdx >= 0, 'battery saver setting present');
  await p.locator('.srow').nth(ecoIdx).locator('.btn').first().click(); await sleep(300);
  const dpr = await p.evaluate(() => window.__bakery.L.dpr);
  assert(dpr <= 1.25 && await p.evaluate(() => window.__bakery.G.eco) === 1, 'battery saver lowers resolution (dpr ' + dpr + ')');
  await p.click('#mBtns .btn'); await sleep(500);
  await p.reload(); await sleep(900);
  assert(await p.evaluate(() => window.__bakery.G.eco === 1 && window.__bakery.G.wh.ads === 1), 'eco + wheel state persisted');
  assert(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})();
