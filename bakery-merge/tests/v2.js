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
async function helpers(p) {
  const cc = i => p.evaluate(i => { const B = window.__bakery; const c = B.cellCenter(i); return { x: c.x + B.L.ax, y: c.y + B.L.ay }; }, i);
  const st = () => p.evaluate(() => { const B = window.__bakery; return { tu: B.G.tu, e: B.G.energy, co: B.G.coins, lvl: B.G.lvl, daily: B.G.daily, b: B.board.map(x => x ? (x.k === 'i' ? x.c + x.l : x.k === 'g' ? 'G' + x.c : 'X' + x.hp) : '') }; });
  const drag = async (a, b) => {
    const A = await cc(a), C = await cc(b), cs = await p.evaluate(() => window.__bakery.L.cs);
    await p.mouse.move(A.x, A.y); await p.mouse.down();
    for (let k = 1; k <= 8; k++) await p.mouse.move(A.x + (C.x - A.x) * k / 8, A.y + (C.y - A.y + cs * 0.25) * k / 8);
    await p.mouse.up(); await sleep(300);
  };
  const tip = () => p.evaluate(() => { const t = document.getElementById('tip'); return t.classList.contains('hidden') ? '' : t.textContent; });
  return { cc, st, drag, tip };
}
(async () => {
  const b = await chromium.launch();
  /* ---------- 1. tutorial + daily + shop (stub, ru) ---------- */
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ru-RU' });
    const p = await ctx.newPage(); const errs = [];
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
    p.on('pageerror', e => errs.push('pageerror: ' + e.message));
    await p.goto(URL); await sleep(900);
    const { cc, st, drag, tip } = await helpers(p);
    await p.click('#mBtns .btn'); await sleep(400);
    assert((await tip()).includes('Перетащи'), 'tutorial step 1 tip: ' + await tip());
    await p.screenshot({ path: 'tut1.png' });
    await drag(16, 18);
    assert((await st()).tu === 2 && (await tip()).includes('Отдать'), 'step 2 after merge: ' + await tip());
    await sleep(300); await p.screenshot({ path: 'tut2.png' });
    const ri = await p.evaluate(() => window.__bakery.slots.findIndex(s => s.o && s.o.ready));
    const R = await p.evaluate(i => { const B = window.__bakery, R = B.L.cards[i]; return { x: R.x + R.w / 2 + B.L.ax, y: R.y + R.h * 0.85 + B.L.ay }; }, ri);
    await p.mouse.click(R.x, R.y); await sleep(300);
    assert((await st()).tu === 3 && (await tip()).includes('мельниц'), 'step 3 after deliver: ' + await tip());
    const mill = await cc(24);
    await p.mouse.click(mill.x, mill.y); await sleep(150); await p.mouse.click(mill.x, mill.y); await sleep(500);
    assert((await st()).tu === 4, 'step 4 after 2 spawns: ' + await tip());
    await p.screenshot({ path: 'tut4.png' });
    const pair = await p.evaluate(() => { const bd = window.__bakery.board; const m = {}; for (let i = 0; i < bd.length; i++) { const x = bd[i]; if (x && x.k === 'i') { const k = x.c + x.l; if (m[k] !== undefined) return [m[k], i]; m[k] = i; } } return null; });
    await drag(pair[1], pair[0]);
    assert((await st()).tu === 9 && (await tip()) === '', 'tutorial complete');
    await sleep(1300);
    assert(await p.isVisible('#btnGift'), 'daily gift button appears after tutorial');
    const co0 = (await st()).co;
    await p.click('#btnGift', { force: true }); await sleep(400);
    await p.screenshot({ path: 'daily.png' });
    assert(await p.locator('.dcard').count() === 7, '7-day calendar shown');
    await p.click('#mBtns .btn.green'); await sleep(1500);
    const s1 = await st();
    assert(s1.co === co0 + 20 && s1.daily.s === 1, 'day 1 reward +20 coins (' + co0 + '->' + s1.co + ')');
    await sleep(1200);
    assert(!(await p.isVisible('#btnGift')), 'gift button hidden after claim');
    // simulate next day: set last claim to yesterday
    await p.evaluate(() => { const d = new Date(Date.now() - 86400000); window.__bakery.G.daily.d = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); });
    await sleep(1200);
    const e0 = (await st()).e;
    await p.click('#btnGift', { force: true }); await sleep(300); await p.click('#mBtns .btn.green'); await sleep(300);
    const s2 = await st();
    assert(s2.daily.s === 2 && s2.e === e0 + 15, 'day 2 streak gives +15 energy');
    // shop tabs + lock
    await p.evaluate(() => { window.__bakery.G.coins = 5000; });
    await sleep(1100);
    assert(await p.isVisible('#shopDot'), 'shop red dot when upgrade affordable');
    await p.click('#btnShop'); await sleep(400);
    const lockTxt = await p.locator('.ubuy').nth(6).textContent();
    assert(/5/.test(lockTxt), 'coffee locked by level: ' + lockTxt);
    await p.screenshot({ path: 'shop2.png' });
    await p.locator('.tab').nth(1).click(); await sleep(300);
    assert(await p.locator('.bsec').count() === 5, 'recipe book shows 5 chains');
    await p.screenshot({ path: 'book.png' });
    await p.click('#mBtns .btn'); await sleep(300);
    await p.evaluate(() => { const B = window.__bakery; B.G.disc.bread = 8; B.G.lvl = 5; });
    await sleep(1100);
    await p.click('#btnShop'); await sleep(400);
    assert(await p.locator('.tab.on').textContent() === 'Рецепты', 'shop opens on book tab when reward claimable');
    const co1 = (await st()).co;
    await p.locator('.bfoot .btn').first().click({ force: true }); await sleep(300);
    assert((await st()).co === co1 + 100, 'book chain reward +100');
    await p.locator('.tab').nth(0).click(); await sleep(300);
    await p.locator('.ubuy').nth(6).click(); await sleep(300);
    assert((await st()).b.includes('Gcoffee'), 'coffee machine placed after unlock at lvl 5');
    await p.click('#mBtns .btn'); await sleep(300);
    const cm = await cc((await st()).b.indexOf('Gcoffee'));
    await p.mouse.click(cm.x, cm.y); await sleep(400);
    assert((await st()).b.some(x => x.startsWith('coffee')), 'coffee machine spawns beans');
    // music toggle
    await p.click('#btnSettings'); await sleep(300);
    await p.locator('.srow', { hasText: 'Музыка' }).locator('.btn').nth(1).click(); await sleep(200);
    assert(await p.evaluate(() => window.__bakery.Snd.music) === false, 'music toggle off');
    await p.click('#mBtns .btn'); await sleep(300);
    await p.screenshot({ path: 'v2game.png' });
    assert(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
    await ctx.close();
  }
  /* ---------- 2. v0.1 save migration ---------- */
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
    await ctx.addInitScript(() => {
      if (sessionStorage.getItem('__seeded')) return; sessionStorage.setItem('__seeded', '1');
      const bd = Array(63).fill(0); bd[24] = 'g:bread'; bd[10] = 'bread:3'; for (let i = 35; i < 63; i++) bd[i] = 'x2';
      localStorage.setItem('bakery_merge_save_v1', JSON.stringify({ v: 1, ts: Date.now(), b: bd, e: 12, et: Date.now(), co: 77, xp: 3, lv: 2, dn: 5, up: { cap: 1, regen: 0, luck: 0, cake: 1, fruit: 0 }, disc: { bread: 4, cake: 2 }, tut: 4, lang: null, pg: [], snd: 1, o: [null, null, null] }));
    });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL); await sleep(900);
    const s = await p.evaluate(() => { const B = window.__bakery; return { tu: B.G.tu, co: B.G.coins, coffee: B.G.up.coffee, b10: B.board[10] && B.board[10].l, orders: B.slots.filter(x => x.o).length, hen: B.board.some(x => x && x.k === 'g' && x.c === 'cake') }; });
    assert(s.tu === 9 && s.co === 77 && s.coffee === 0 && s.b10 === 3 && s.orders === 3, 'v0.1 save migrated ' + JSON.stringify(s));
    assert(s.hen, 'missing hen house restored on board');
    assert(!(await p.isVisible('#tip')), 'no tutorial for veteran');
    assert(errs.length === 0, 'migration no errors ' + JSON.stringify(errs));
    await ctx.close();
  }
  /* ---------- 3. Yandex adapter with mock SDK ---------- */
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
    await ctx.addInitScript(() => {
      const log = window.__yalog = []; const handlers = {};
      window.__cloud = window.__cloudInit || null;
      const ysdk = {
        environment: { i18n: { lang: 'en' } },
        features: { LoadingAPI: { ready: () => log.push('ready') }, GameplayAPI: { start: () => log.push('start'), stop: () => log.push('stop') } },
        adv: {
          showRewardedVideo: ({ callbacks }) => { log.push('rv'); callbacks.onOpen && callbacks.onOpen(); setTimeout(() => { callbacks.onRewarded && callbacks.onRewarded(); callbacks.onClose && callbacks.onClose(); }, 300); },
          showFullscreenAdv: ({ callbacks }) => { log.push('fs'); callbacks.onOpen && callbacks.onOpen(); setTimeout(() => callbacks.onClose && callbacks.onClose(true), 200); },
        },
        getPlayer: () => Promise.resolve({ getData: () => { const o = sessionStorage.getItem('__cloudOverride'); if (o) { sessionStorage.removeItem('__cloudOverride'); return Promise.resolve({ s: JSON.parse(o) }); } return Promise.resolve(window.__cloud ? { s: window.__cloud } : {}); }, setData: d => { log.push('set'); window.__cloud = d.s; localStorage.setItem('__cloud', JSON.stringify(d.s)); return Promise.resolve(); } }),
        on: (ev, fn) => { handlers[ev] = fn; },
      };
      window.__yafire = ev => handlers[ev] && handlers[ev]();
      try { const c = localStorage.getItem('__cloud'); if (c) window.__cloud = JSON.parse(c); } catch (e) {}
      window.YaGames = { init: () => Promise.resolve(ysdk) };
    });
    const p = await ctx.newPage(); const errs = [];
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL); await sleep(900);
    let r = await p.evaluate(() => ({ name: window.__bakery.Platform.name, lang: document.documentElement.lang, log: window.__yalog.slice() }));
    assert(r.name === 'yandex', 'yandex adapter selected');
    assert(r.lang === 'en', 'language taken from SDK (en over ru browser)');
    assert(r.log.filter(x => x === 'ready').length === 1, 'LoadingAPI.ready called once');
    await p.click('#mBtns .btn'); await sleep(400);
    r = await p.evaluate(() => window.__yalog.slice());
    assert(r.includes('start'), 'GameplayAPI.start after welcome closed');
    const e0 = await p.evaluate(() => window.__bakery.G.energy);
    await p.click('#btnEnergyAd'); await sleep(700);
    const e1 = await p.evaluate(() => window.__bakery.G.energy);
    r = await p.evaluate(() => window.__yalog.slice());
    assert(e1 === e0 + 20 && r.includes('rv'), 'rewarded via SDK gives +20 energy');
    const idxRv = r.lastIndexOf('rv');
    assert(r.slice(0, idxRv).includes('stop') && r.slice(idxRv).includes('start'), 'gameplay stop during ad, start after: ' + r.join(','));
    await sleep(4600);
    r = await p.evaluate(() => ({ log: window.__yalog.slice(), cloud: window.__cloud }));
    assert(r.log.includes('set') && r.cloud && r.cloud.e === e1, 'cloud save via player.setData');
    await p.evaluate(() => window.__yafire('game_api_pause')); await sleep(200);
    const paused = await p.evaluate(() => { const l = window.__yalog; return l[l.length - 1]; });
    await p.evaluate(() => window.__yafire('game_api_resume')); await sleep(200);
    const resumed = await p.evaluate(() => { const l = window.__yalog; return l[l.length - 1]; });
    assert(paused === 'stop' || paused === 'set', 'game_api_pause stops gameplay (' + paused + ')');
    assert(resumed === 'start', 'game_api_resume restarts gameplay');
    // cloud newer than local wins
    await p.evaluate(() => { const c = JSON.parse(localStorage.getItem('__cloud')); c.co = 4242; c.ts = Date.now() + 60000; sessionStorage.setItem('__cloudOverride', JSON.stringify(c)); });
    await p.reload(); await sleep(900);
    assert(await p.evaluate(() => window.__bakery.G.coins) === 4242, 'newer cloud save wins over local');
    assert(errs.length === 0, 'yandex: no errors ' + JSON.stringify(errs));
    await ctx.close();
  }
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})();
