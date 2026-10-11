// Visual snapshots for manual review (no assertions)
const path = require('path'), fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium } = pw;
const GAME = path.resolve(__dirname, '..', 'index.html');
fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true }); process.chdir(path.join(__dirname, 'out'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ru-RU' });
  p.on('pageerror', e => console.log('pageerror', e.message));
  await p.goto('file://' + GAME); await sleep(900);
  await p.click('#mBtns .btn'); await sleep(200);
  await p.evaluate(() => { const B = window.__bakery; B.G.tu = 9; B.G.daily.d = B.dayStr(0);
    const cs = ['bread', 'cake', 'fruit', 'coffee', 'ice']; for (let i = 0; i < 35; i++) if (!B.board[i]) B.board[i] = { k: 'i', c: cs[i % 5], l: 1 + (i * 3 % 8) }; B.changed(); });
  await sleep(1300);
  const cc = i => p.evaluate(i => { const B = window.__bakery, c = B.cellCenter(i); return { x: c.x + B.L.ax, y: c.y + B.L.ay }; }, i);
  const a = await cc(16), c = await cc(19);
  await p.mouse.move(a.x, a.y); await p.mouse.down();
  for (let k = 1; k <= 10; k++) { await p.mouse.move(a.x + (c.x - a.x) * k / 10, a.y + 40 * k / 10); await sleep(16); }
  await p.screenshot({ path: 'vis_drag.png' });
  await p.mouse.up(); await sleep(300);
  await p.evaluate(() => { const B = window.__bakery; B.G.xp = 999; const o = B.makeOrder([{ c: 'bread', l: 1 }]); B.setOrder(0, o, true); B.board[40] = { k: 'i', c: 'bread', l: 1 }; B.changed(); });
  const R = await p.evaluate(() => { const B = window.__bakery, R = B.L.cards[0]; return { x: R.x + R.w / 2 + B.L.ax, y: R.y + R.h * 0.85 + B.L.ay }; });
  await p.mouse.click(R.x, R.y); await sleep(1700);
  await p.screenshot({ path: 'vis_levelup.png' });
  await b.close();
})();
