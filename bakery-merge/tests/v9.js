// v0.9: seasonal events, new chains, weekly score
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
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ru-RU' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + GAME + '?event=halloween'); await p.waitForSelector('#loader', { state: 'hidden' });
  await p.click('#mBtns .btn'); await sleep(300);
  await p.evaluate(() => { const B = window.__bakery; B.G.tu = 9; B.G.daily.d = B.dayStr(0); B.changed(); });
  await sleep(1500);
  let s = await p.evaluate(() => { const B = window.__bakery; return { gen: B.board.some(x => x && x.k === 'g' && x.c === 'pumpkin'), song: B.songIndex(), ev: B.G.ev }; });
  assert(s.gen, 'Halloween: pumpkin patch placed on the board');
  assert(s.song === 5, 'Halloween music');
  assert(s.ev && s.ev.k.startsWith('halloween'), 'event state created: ' + (s.ev && s.ev.k));
  await p.screenshot({ path: 'v9_halloween.png' });
  // event order -> points
  const o = await p.evaluate(() => { const B = window.__bakery; let o; for (let k = 0; k < 60; k++) { o = B.sim.genOrder(); if (o.ep) break; } B.setOrder(0, o, true); o.req.forEach((r, i) => { B.board[40 + i] = { k: 'i', c: r.c, l: r.l }; }); B.changed(); return { ep: o.ep, req: o.req }; });
  assert(o.ep > 0 && o.req.every(r => r.c === 'pumpkin'), 'event orders ask for pumpkin items (+' + o.ep + ' pts)');
  await sleep(200); await p.screenshot({ path: 'v9_evorder.png' });
  const R = await p.evaluate(() => { const B = window.__bakery, R = B.L.cards[0]; return { x: R.x + R.w / 2 + B.L.ax, y: R.y + R.h * 0.85 + B.L.ay }; });
  await p.mouse.click(R.x, R.y); await sleep(500);
  assert(await p.evaluate(() => window.__bakery.G.ev.pts) === o.ep, 'delivering gives holiday points');
  // event tab + track
  await p.evaluate(() => { window.__bakery.G.ev.pts = 160; }); await sleep(1200);
  await p.click('#btnQuests'); await sleep(400);
  assert((await p.locator('.tab.on').textContent()).startsWith('Хэллоуин'), 'rewards window opens on the holiday tab');
  await p.screenshot({ path: 'v9_evtab.png' });
  const c0 = await p.evaluate(() => window.__bakery.G.coins);
  for (let k = 0; k < 5; k++) { await p.locator('.qright .btn').first().click({ force: true }); await sleep(250); }
  s = await p.evaluate(() => ({ cl: window.__bakery.G.ev.cl.length, co: window.__bakery.G.coins }));
  assert(s.cl === 5 && s.co > c0 + 800, 'all 5 holiday milestones claimed (' + (s.co - c0) + ' coins)');
  await p.click('#mBtns .btn'); await sleep(300);
  // weekly score card
  await p.click('#btnQuests'); await sleep(300);
  await p.locator('.tab', { hasText: 'Достижения' }).click(); await sleep(300);
  const wk = await p.textContent('.weekcard');
  assert(/Моя неделя/.test(wk), 'weekly score card: ' + wk.slice(0, 40));
  await p.click('#mBtns .btn'); await sleep(300);
  // new permanent chains
  await p.evaluate(() => { const B = window.__bakery; B.G.lvl = 12; B.G.coins = 20000; ['choco', 'pizza'].forEach(id => B.sim.buyUpgrade(B.sim.UPG.find(u => u.id === id))); });
  s = await p.evaluate(() => window.__bakery.board.filter(x => x && x.k === 'g').map(x => x.c));
  assert(s.includes('choco') && s.includes('pizza'), 'chocolate pot and pizza oven placed: ' + s.join(','));
  await p.evaluate(() => { const B = window.__bakery; B.board.forEach((x, i) => { if (x && x.k === 'g' && (x.c === 'choco' || x.c === 'pizza')) B.spawnFrom(i); }); });
  await sleep(500);
  s = await p.evaluate(() => window.__bakery.board.filter(x => x && x.k === 'i' && (x.c === 'choco' || x.c === 'pizza')).length);
  assert(s >= 2, 'new generators spawn items');
  await p.screenshot({ path: 'v9_chains.png' });
  // event over: items bought out
  const save = await p.evaluate(() => { const B = window.__bakery; B.board[44] = { k: 'i', c: 'pumpkin', l: 4 }; B.changed(); return 1; });
  await sleep(1000);
  await p.goto('file://' + GAME); await p.waitForSelector('#loader', { state: 'hidden' }); await sleep(1500);
  s = await p.evaluate(() => ({ left: window.__bakery.board.filter(x => x && x.c === 'pumpkin').length, title: document.getElementById('mTitle').textContent, vis: !document.getElementById('modal').classList.contains('hidden') }));
  assert(s.left === 0 && s.vis && s.title === 'Праздник закончился', 'after the event, holiday items are bought out for coins');
  // new year decor
  await p.click('#mBtns .btn'); await p.goto('file://' + GAME + '?event=newyear'); await p.waitForSelector('#loader', { state: 'hidden' }); await sleep(1500);
  assert(await p.evaluate(() => window.__bakery.board.some(x => x && x.k === 'g' && x.c === 'ginger') && window.__bakery.songIndex() === 6), 'New Year: holiday tree + jingle music');
  await p.screenshot({ path: 'v9_newyear.png' });
  assert(errs.length === 0, 'no errors ' + JSON.stringify(errs));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})();
