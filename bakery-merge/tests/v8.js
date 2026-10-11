// v0.8: logo, host, interior, modal close animation, spawn styles, songs
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
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + GAME); await sleep(700);
  await p.screenshot({ path: 'v8_logo.png' });
  assert(await p.isVisible('#logo'), 'animated logo on loading screen');
  await sleep(1300);
  assert(!(await p.isVisible('#loader')), 'loader hides after the logo');
  await p.click('#mBtns .btn'); await sleep(60);
  assert(await p.evaluate(() => document.getElementById('modal').classList.contains('closing')), 'modal plays a closing animation');
  await sleep(300);
  assert(!(await p.isVisible('#modal')), 'modal hidden after animation');
  await p.evaluate(() => { const B = window.__bakery; B.G.tu = 9; B.G.daily.d = B.dayStr(0); B.changed(); });
  // host speaks
  await p.evaluate(() => window.__bakery.hostSay('host_hi'));
  await sleep(2600);
  const hb = await p.textContent('#hostBubble');
  assert(await p.isVisible('#host') && hb.startsWith('Привет'), 'host Pyshka speaks: ' + hb.slice(0, 30));
  await p.screenshot({ path: 'v8_host.png' });
  await p.click('#host'); await sleep(500);
  assert(!(await p.isVisible('#host')), 'tap hides the host');
  // spawn styles: hen rolls an egg (rotation), tree drops fruit
  await p.evaluate(() => { const B = window.__bakery; B.G.up.cake = 1; B.G.up.fruit = 1; B.board[22] = { k: 'g', c: 'cake' }; B.board[26] = { k: 'g', c: 'fruit' }; B.changed(); });
  await p.evaluate(() => { const B = window.__bakery; B.spawnFrom(22); B.spawnFrom(26); });
  await sleep(150);
  const sty = await p.evaluate(() => window.__bakery.board.filter(x => x && x._sty).map(x => x.c + ':' + x._sty));
  assert(sty.includes('cake:roll') && sty.includes('fruit:drop'), 'per-chain spawn animations: ' + sty.join(','));
  await p.screenshot({ path: 'v8_spawn.png' });
  // songs per theme
  const songs = await p.evaluate(() => { const B = window.__bakery; const r = []; for (let i = 0; i < 5; i++) { B.G.pr = 4; B.G.th = i; B.layout(); r.push(B.songIndex()); } B.G.th = 0; B.layout(); return r; });
  assert(songs.join() === '0,1,2,3,4', 'each interior has its own song');
  await sleep(400); await p.screenshot({ path: 'v8_interior.png' });
  assert(errs.length === 0, 'no errors ' + JSON.stringify(errs));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})();
