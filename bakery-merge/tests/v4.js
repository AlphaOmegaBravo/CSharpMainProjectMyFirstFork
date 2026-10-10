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
  const st = () => p.evaluate(() => { const B = window.__bakery; return { co: B.G.coins, lvl: B.G.lvl, pr: B.G.pr, th: B.G.th, ach: Object.keys(B.G.ach), disc: B.G.disc, up: B.G.up, b: B.board.map(x => x ? (x.k === 'i' ? x.c + x.l : x.k === 'g' ? 'G' + x.c : x.k) : '') }; });
  /* --- ice cream chain unlock --- */
  await p.evaluate(() => { const B = window.__bakery; B.G.lvl = 10; B.G.coins = 5000; });
  await p.click('#btnShop'); await sleep(400);
  await p.locator('.ubuy').nth(7).click(); await sleep(300);
  assert((await st()).b.includes('Gice'), 'ice cream cart placed');
  /* --- prestige card --- */
  const prTxt = await p.locator('.urow.prest').textContent();
  assert(prTxt.includes('Морская'), 'prestige card shows next location: ' + prTxt.slice(0, 50));
  await p.locator('.urow.prest').scrollIntoViewIfNeeded();
  await p.screenshot({ path: 'prest.png' });
  await p.locator('.urow.prest .btn').click(); await sleep(300);
  assert(await p.textContent('#mTitle') === 'Новая пекарня', 'prestige confirm dialog');
  await p.locator('#mBtns .btn').nth(1).click(); await sleep(600);
  let s = await st();
  assert(s.pr === 1 && s.th === 1 && s.lvl === 1 && s.co === 50 && s.up.ice === 0, 'prestige reset: pr=1 theme=1 lvl=1 coins=50 ' + JSON.stringify({ pr: s.pr, th: s.th, lvl: s.lvl, co: s.co }));
  assert(s.disc.bread >= 1, 'discoveries kept after prestige');
  await p.screenshot({ path: 'prest_done.png' });
  await p.click('#mBtns .btn'); await sleep(400);
  await p.screenshot({ path: 'theme1.png' });
  const mult = await p.evaluate(() => { const B = window.__bakery; return B.makeOrder([{ c: 'bread', l: 3 }]).reward; });
  assert(mult === Math.round(Math.round(1.5 * 4 + 2) * 1.25), 'order rewards +25% after prestige (' + mult + ')');
  /* --- theme picker --- */
  await p.click('#btnSettings'); await sleep(300);
  assert(await p.locator('.btn.swb').count() === 2, 'interior picker with 2 locations');
  await p.locator('.btn.swb').first().click(); await sleep(200);
  assert((await st()).th === 0, 'switched back to first interior');
  await p.locator('.btn.swb').nth(1).click(); await sleep(200);
  await p.click('#mBtns .btn'); await sleep(200);
  /* --- achievements --- */
  await sleep(1300);
  assert(await p.isVisible('#questDot'), 'quest dot lit for achievement (prestige)');
  await p.click('#btnQuests'); await sleep(400);
  assert((await p.locator('.tab.on').textContent()) === 'Достижения', 'opens on achievements tab');
  await p.screenshot({ path: 'ach.png' });
  const co0 = (await st()).co;
  await p.locator('.qright .btn').first().click({ force: true }); await sleep(300);
  s = await st();
  assert(s.ach.length >= 1 && s.co > co0, 'achievement claimed: ' + s.ach.join(','));
  await p.click('#mBtns .btn'); await sleep(200);
  /* --- other themes render --- */
  for (const th of [2, 3, 4]) { await p.evaluate(th => { const B = window.__bakery; B.G.pr = 4; B.G.th = th; B.layout(); }, th); await sleep(200); await p.screenshot({ path: 'theme' + th + '.png' }); }
  /* --- offline earnings --- */
  await sleep(800);
  await p.evaluate(() => { const B = window.__bakery; B.G.th = 1; });
  const ts = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('bakery_merge_save_v1')); d.ts = Date.now() - 3 * 3600000; d.daily.d = (() => { const x = new Date(); return x.getFullYear() + '-' + (x.getMonth() + 1) + '-' + x.getDate(); })(); return d; });
  await ctx.addInitScript(d => { if (!sessionStorage.getItem('__aw')) { sessionStorage.setItem('__aw', '1'); localStorage.setItem('bakery_merge_save_v1', JSON.stringify(d)); } }, ts);
  await p.reload(); await sleep(1500);
  const title = await p.textContent('#mTitle');
  assert(title === 'С возвращением!', 'away reward modal: ' + title);
  const co1 = (await st()).co;
  await p.screenshot({ path: 'away.png' });
  await p.click('#mBtns .btn.green'); await sleep(300);
  assert((await st()).co > co1, 'away coins granted');
  assert(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})();
