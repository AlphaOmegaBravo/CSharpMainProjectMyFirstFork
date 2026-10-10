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
  const cc = i => p.evaluate(i => { const B = window.__bakery; const c = B.cellCenter(i); return { x: c.x + B.L.ax, y: c.y + B.L.ay }; }, i);
  const st = () => p.evaluate(() => { const B = window.__bakery; return { co: B.G.coins, e: B.G.energy, lvl: B.G.lvl, st: B.G.st.slice(), q: B.G.q, b: B.board.map(x => x ? (x.k === 'i' ? x.c + x.l : x.k === 'g' ? 'G' + x.c : x.k === 'b' ? 'B' + x.c + x.l : 'X' + x.hp) : '') }; });
  const drag = async (a, c2) => {
    const A = await cc(a), C = await cc(c2), cs = await p.evaluate(() => window.__bakery.L.cs);
    await p.mouse.move(A.x, A.y); await p.mouse.down();
    for (let k = 1; k <= 6; k++) await p.mouse.move(A.x + (C.x - A.x) * k / 6, A.y + (C.y - A.y + cs * 0.25) * k / 6);
    await p.mouse.up(); await sleep(250);
  };
  const put = (i, v) => p.evaluate(([i, v]) => { const B = window.__bakery; const q = v.split(':'); B.board[i] = v ? { k: 'i', c: q[0], l: +q[1] } : null; B.changed(); }, [i, v]);
  const tap = async i => { const c = await cc(i); await p.mouse.click(c.x, c.y); await sleep(200); };

  /* --- quests generated after tutorial --- */
  let s = await st();
  assert(s.q && s.q.list.length === 3, 'daily quests generated: ' + (s.q && s.q.list.map(q => q.t).join(',')));
  /* --- bubbles --- */
  await p.evaluate(() => window.__bakery.spawnBubble(17, 'bread', 3)); await sleep(600);
  s = await st();
  const bi = s.b.indexOf('Bbread3');
  assert(bi >= 0, 'bubble spawned at ' + bi);
  await drag(bi, 0);
  assert((await st()).b[bi] === 'Bbread3', 'bubble cannot be dragged');
  await tap(bi);
  const ib = await p.evaluate(() => [document.getElementById('ib1').textContent, document.getElementById('ib2').textContent, document.getElementById('infoName').textContent]);
  assert(ib[0].includes('AD') && ib[1].includes('6') && ib[2].includes('Пузырь'), 'bubble info buttons: ' + ib.join(' | '));
  await p.screenshot({ path: 'bubble.png' });
  const co0 = (await st()).co;
  await p.click('#ib2'); await sleep(300);
  s = await st();
  assert(s.b[bi] === 'bread3' && s.co === co0 - 6, 'bubble bought for 6 coins');
  await p.evaluate(() => window.__bakery.spawnBubble(17, 'bread', 4)); await sleep(300);
  const bj = (await st()).b.indexOf('Bbread4');
  await p.evaluate(j => { window.__bakery.board[j].exp = Date.now() - 1; }, bj); await sleep(1300);
  assert((await st()).b[bj] === '', 'expired bubble pops');
  /* --- storage --- */
  await put(30, 'bread:2');
  await tap(30);
  assert(await p.isVisible('#ib1'), 'to-storage button visible for item');
  await p.click('#ib1'); await sleep(300);
  s = await st();
  assert(s.st.length === 1 && s.st[0] === 'bread:2' && s.b[30] === '', 'item moved to storage');
  await tap(0); // empty cell -> deselect
  const sb = await p.evaluate(() => document.getElementById('ib2').textContent);
  assert(sb.includes('1/4'), 'storage button shows 1/4: ' + sb);
  await p.click('#ib2'); await sleep(300);
  assert(await p.locator('.sslot').count() === 10 && await p.locator('.sslot.full').count() === 1 && await p.locator('.sslot.locked').count() === 6, 'storage modal: 4 open + 6 locked slots');
  await p.screenshot({ path: 'storage.png' });
  await p.locator('.sslot.full').first().click(); await sleep(300);
  s = await st();
  assert(s.st.length === 0 && s.b.filter(x => x === 'bread2').length >= 1, 'item taken back from storage');
  await p.click('#mBtns .btn'); await sleep(200);
  await p.evaluate(() => { window.__bakery.G.st = ['bread:1', 'bread:1', 'bread:1', 'bread:1']; });
  await put(31, 'bread:3'); await tap(31); await p.click('#ib1'); await sleep(200);
  assert((await st()).b[31] === 'bread3', 'storage full blocks storing');
  await p.evaluate(() => { window.__bakery.G.st = []; });
  /* --- quests progress + claim + chest --- */
  await p.evaluate(() => { const G = window.__bakery.G; G.q.list[0] = { t: 'merge', g: 2, p: 0, x: 0, ok: 0, r: { c: 33, e: 0 } }; });
  await put(0, 'cake:1'); await put(1, 'cake:1'); await put(2, 'cake:1'); await put(3, 'cake:1');
  await drag(0, 1); await drag(2, 3);
  s = await st();
  assert(s.q.list[0].p === 2, 'merge quest progressed to 2/2');
  await sleep(1200);
  assert(await p.isVisible('#questDot'), 'quest red dot shown');
  await p.click('#btnQuests'); await sleep(400);
  await p.screenshot({ path: 'quests.png' });
  const co1 = (await st()).co;
  await p.locator('.qright .btn').first().click({ force: true }); await sleep(300);
  assert((await st()).co === co1 + 33, 'quest reward +33');
  await p.evaluate(() => { const G = window.__bakery.G; G.q.list.forEach(q => { q.p = q.g; q.ok = 1; }); });
  await p.click('#mBtns .btn'); await sleep(200); await p.click('#btnQuests'); await sleep(300);
  const co2 = (await st()).co, e2 = (await st()).e;
  await p.locator('.qright .btn').last().click({ force: true }); await sleep(300);
  s = await st();
  assert(s.co > co2 && s.e === e2 + 25 && s.q.ch === 1, 'chest opened (+coins +25 energy)');
  await p.click('#mBtns .btn'); await sleep(300);
  /* --- VIP --- */
  await p.evaluate(() => { const B = window.__bakery; const o = B.makeOrder([{ c: 'fruit', l: 1 }]); o.vip = Date.now() + 90000; o.reward *= 3; B.setOrder(0, o, true); B.board[40] = null; B.board[39] = { k: 'i', c: 'fruit', l: 1 }; B.changed(); });
  await sleep(300);
  await p.screenshot({ path: 'vip.png' });
  const e3 = (await st()).e;
  const R = await p.evaluate(() => { const B = window.__bakery, R = B.L.cards[0]; return { x: R.x + R.w / 2 + B.L.ax, y: R.y + R.h * 0.85 + B.L.ay }; });
  await p.mouse.click(R.x, R.y); await sleep(700);
  assert((await st()).e === e3 + 10, 'VIP delivery gives +10 energy');
  await sleep(150); await p.screenshot({ path: 'thanks.png' });
  await p.evaluate(() => { const B = window.__bakery; const o = B.makeOrder([{ c: 'fruit', l: 5 }]); o.vip = Date.now() + 800; B.setOrder(1, o, true); B.recount(); });
  await sleep(2300);
  const v = await p.evaluate(() => { const sl = window.__bakery.slots[1]; return sl.state + ':' + (sl.o && sl.o.sad); });
  assert(v === 'out:1', 'VIP leaves when timer ends (' + v + ')');
  /* --- discovery celebration --- */
  await put(5, 'fruit:2'); await put(6, 'fruit:2');
  await drag(5, 6); await sleep(500);
  await p.screenshot({ path: 'celebrate.png' });
  /* --- level up refill --- */
  await sleep(2000);
  await p.evaluate(() => { const B = window.__bakery; B.G.xp = 100; B.G.energy = 3; const o = B.makeOrder([{ c: 'bread', l: 1 }]); B.setOrder(2, o, true); B.board[44] = null; B.board[43] = { k: 'i', c: 'bread', l: 1 }; B.changed(); });
  const R2 = await p.evaluate(() => { const B = window.__bakery, R = B.L.cards[2]; return { x: R.x + R.w / 2 + B.L.ax, y: R.y + R.h * 0.85 + B.L.ay }; });
  await p.mouse.click(R2.x, R2.y); await sleep(1500);
  assert(await p.isVisible('#modal'), 'level up modal');
  const lvtxt = await p.textContent('#mBody');
  await p.screenshot({ path: 'levelup.png' });
  await p.click('#mBtns .btn'); await sleep(300);
  s = await st();
  assert(s.e === await p.evaluate(() => 40 + 10 * window.__bakery.G.up.cap), 'level-up refilled energy to max (' + s.e + ') ' + lvtxt.slice(0, 60));
  /* --- persistence --- */
  await p.evaluate(() => { const B = window.__bakery; B.G.st = ['cake:2']; B.spawnBubble(10, 'cake', 3); });
  await sleep(1500);
  const before = await st();
  await p.reload(); await sleep(900);
  const after = await st();
  assert(after.st.join() === 'cake:2' && after.b.includes('Bcake3') && after.q.list.length === 3, 'storage, bubble and quests persisted');
  assert(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
  await ctx.close();
  /* --- HUD fits on 320px --- */
  const c2 = await b.newContext({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, locale: 'ru-RU' });
  const p2 = await c2.newPage();
  await p2.goto(URL); await sleep(800); await p2.click('#mBtns .btn'); await sleep(200);
  await p2.evaluate(() => { const B = window.__bakery; B.G.tu = 9; B.G.coins = 12345; B.G.daily.d = ''; });
  await sleep(1300);
  const fit = await p2.evaluate(() => { const r = [...document.querySelectorAll('#hud > *')].filter(e => !e.classList.contains('hidden')).map(e => e.getBoundingClientRect().right); return { max: Math.max(...r), w: window.innerWidth }; });
  assert(fit.max <= fit.w, 'HUD fits 320px with gift button (' + Math.round(fit.max) + '/' + fit.w + ')');
  await p2.screenshot({ path: 'hud320.png' });
  await c2.close();
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})();
