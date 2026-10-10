// v0.6: order skip button, no lucky spawns in tutorial, combo bonus cap
const path = require('path'), fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium } = pw;
const GAME = path.resolve(__dirname, '..', 'index.html');
fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true }); process.chdir(path.join(__dirname, 'out'));
let fails = 0;
const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ru-RU' });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + GAME); await sleep(900);
  await p.click('#mBtns .btn'); await sleep(300);
  // tutorial spawns are always level 1 even with max luck
  await p.evaluate(() => { const B = window.__bakery; B.G.up.luck = 4; for (let k = 0; k < 12; k++) B.spawnFrom(24); });
  const lv = await p.evaluate(() => window.__bakery.board.filter(x => x && x.k === 'i' && x.c === 'bread').map(x => x.l));
  assert(lv.every(l => l <= 2) && lv.filter(l => l === 2).length <= 1, 'no lucky L2 spawns during tutorial: ' + lv.join(''));
  await p.evaluate(() => { const B = window.__bakery; B.G.tu = 9; B.G.daily.d = B.dayStr(0); B.G.up.luck = 0; B.changed(); });
  await sleep(1200);
  // skip button appears on old orders
  await p.evaluate(() => { const B = window.__bakery; const o = B.makeOrder([{ c: 'fruit', l: 6 }]); o.t = Date.now() - 4 * 60000; B.setOrder(0, o, true); B.recount(); });
  await sleep(200);
  const sk = await p.evaluate(() => { const B = window.__bakery, r = B.L.cards[0].skip; return r && { x: r.x + r.w / 2 + B.L.ax, y: r.y + r.h / 2 + B.L.ay }; });
  assert(!!sk, 'skip button shown on a 4-minute-old order');
  await p.screenshot({ path: 'skip.png' });
  const fresh = await p.evaluate(() => !!window.__bakery.L.cards[1].skip);
  assert(!fresh, 'no skip button on fresh orders');
  await p.mouse.click(sk.x, sk.y); await sleep(200);
  assert(await p.evaluate(() => window.__bakery.slots[0].state === 'out'), 'skip sends the guest away');
  await sleep(1800);
  assert(await p.evaluate(() => { const sl = window.__bakery.slots[0]; return sl.state !== 'out' && !!sl.o && !sl.o.sad; }), 'a new guest arrives');
  // combo bonus capped
  const gain = await p.evaluate(() => {
    const B = window.__bakery, S = B.sim; let co = B.G.coins;
    for (let k = 0; k < 12; k++) { B.board[0] = { k: 'i', c: 'cake', l: 3 }; B.board[1] = { k: 'i', c: 'cake', l: 3 }; const c = B.cellCenter(1); S.handleDrop(0, 1, c.x, c.y); B.board[1] = null; }
    return B.G.coins - co;
  });
  assert(gain <= 12 * 5 + 40, 'combo bonus capped (12 quick merges gave ' + gain + ' coins)');
  assert(errs.length === 0, 'no errors ' + JSON.stringify(errs));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})();
// --- welcome back after the tab was hidden for a while (separate run)
(async () => {
  await new Promise(r => setTimeout(r, 15000));
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
  await ctx.addInitScript(() => { const real = Date.now.bind(Date); window.__warp = 0; Date.now = () => real() + window.__warp; });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + GAME); await sleep(800);
  await p.click('#mBtns .btn'); await sleep(200);
  await p.evaluate(() => { const B = window.__bakery; B.G.tu = 9; B.G.daily.d = B.dayStr(0); B.changed(); });
  await sleep(300);
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await p.evaluate(() => { window.__warp += 2 * 3600000; Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(800);
  const title = await p.textContent('#mTitle').catch(() => '');
  const ok = await p.isVisible('#modal') && title === 'С возвращением!';
  console.log((ok ? 'PASS' : 'FAIL') + ' welcome-back modal after 2h in background (' + title + ')');
  console.log(errs.length ? 'FAIL errors ' + JSON.stringify(errs) : 'PASS no errors (resume)');
  await b.close();
})();
