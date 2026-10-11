// Balance simulation: a greedy bot plays the real game logic with warped time and reports pacing.
// Run: node tests/balance.js   (prints a table; no assertions except "no deadlock")
const path = require('path'), fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium } = pw;
const GAME = path.resolve(__dirname, '..', 'index.html');
const HOURS = +(process.argv[2] || 8);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
  await ctx.addInitScript(() => { const real = Date.now.bind(Date); window.__warp = 0; Date.now = () => real() + window.__warp; });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + GAME); await p.waitForTimeout(800);
  await p.click('#mBtns .btn'); await p.waitForTimeout(200);
  const res = await p.evaluate((HOURS) => {
    const B = window.__bakery, S = B.sim, G = B.G, board = B.board, N = board.length;
    G.tu = 9;
    const ACT = 1500;                     // ms of player time per action
    let active = 0, wall = 0, sells = 0, waits = 0, steps = 0, maxFull = 0, merges = 0, spawns = 0;
    const log = [], unlocks = {};
    const adv = ms => { window.__warp += ms; wall += ms; };
    const act = () => { adv(ACT); active += ACT; steps++; };
    const cc = i => B.cellCenter(i);
    const items = () => { const a = []; for (let i = 0; i < N; i++) if (board[i] && board[i].k === 'i') a.push(i); return a; };
    const needs = () => { const m = new Map(); for (const sl of B.slots) if (sl.o) sl.o.req.forEach((r, k) => { if (!sl.o.have[k]) m.set(r.c, Math.max(m.get(r.c) || 0, r.l)); }); return m; };
    function tryBuy() {
      for (const id of ['cake', 'fruit', 'coffee', 'ice', 'choco', 'pizza']) {
        const u = S.UPG.find(x => x.id === id);
        if (G.up[id] === 0 && !(u.minLvl && G.lvl < u.minLvl)) { if (S.buyUpgrade(u)) { unlocks[id] = Math.round(active / 60000); return true; } return false; }
      }
      for (const id of ['regen', 'cap', 'luck', 'store']) { const u = S.UPG.find(x => x.id === id); if (S.buyUpgrade(u)) { unlocks[id + G.up[id]] = Math.round(active / 60000); return true; } }
      return false;
    }
    let lastLvl = G.lvl;
    while (active < HOURS * 3600000 && steps < 40000) {
      S.tickEnergy();
      if (steps % 10 === 0) { S.slowTick(); B.slots.forEach((sl, k) => { if (sl.state === 'out') { B.setOrder(k, S.genOrder(), true); B.recount(); } }); }
      // 1. deliver
      const ready = B.slots.findIndex(sl => sl.o && sl.o.ready && sl.state !== 'out');
      if (ready >= 0) {
        B.deliver(ready, 1); B.setOrder(ready, S.genOrder(), true); B.recount(); act();
        if (G.lvl > lastLvl) { for (let l = lastLvl + 1; l <= G.lvl; l++) { G.coins += 10 * l; G.energy = Math.max(G.energy, S.energyMax()); log.push({ lvl: l, act: Math.round(active / 60000), wall: Math.round(wall / 60000), orders: G.stats.o }); } lastLvl = G.lvl; }
        while (tryBuy()) {}
        continue;
      }
      // 2. merge something useful
      const nd = needs(), seen = new Map(); let best = null;
      const exact = new Map(), have = new Map();   // items an order needs as they are must not be merged away
      for (const sl of B.slots) if (sl.o) sl.o.req.forEach(r => exact.set(r.c + r.l, (exact.get(r.c + r.l) || 0) + 1));
      for (const i of items()) { const k = board[i].c + board[i].l; have.set(k, (have.get(k) || 0) + 1); }
      for (const i of items()) {
        const it = board[i], k = it.c + it.l;
        if (it.l >= S.CHAINS[it.c].max) continue;
        if ((have.get(k) || 0) - 2 < (exact.get(k) || 0)) continue;
        if (seen.has(k)) { const useful = (nd.get(it.c) || 0) > it.l; const sc = (useful ? 100 : 0) + it.l; if (!best || sc > best.sc) best = { a: seen.get(k), b: i, sc }; }
        else seen.set(k, i);
      }
      const empty = board.filter(x => !x).length;
      maxFull = Math.max(maxFull, N - empty);
      if (best) { const c = cc(best.b); S.handleDrop(best.a, best.b, c.x, c.y); merges++; act(); continue; }
      // 3. spawn from the most needed generator
      if (G.energy >= 1 && empty > 0) {
        let gen = -1, want = -1;
        for (let i = 0; i < N; i++) { const it = board[i]; if (it && it.k === 'g') { const w = (nd.get(it.c) || 0) * 10 + (it.c === 'bread' ? 1 : 0); if (w > want) { want = w; gen = i; } } }
        if (gen >= 0) { B.spawnFrom(gen); spawns++; act(); continue; }
      }
      // 4. merge anything to make room
      if (best) { const c = cc(best.b); S.handleDrop(best.a, best.b, c.x, c.y); merges++; act(); continue; }
      // 5. board full, nothing to merge: sell the lowest unneeded item
      if (empty === 0) {
        const junk = items().filter(i => !nd.has(board[i].c)), pool = junk.length ? junk : items();
        const cand = pool.sort((x, y) => board[x].l - board[y].l);
        if (cand.length) { const i = cand[0]; G.coins += S.sellPrice(board[i].l); board[i] = null; B.changed(); sells++; act(); continue; }
        return { error: 'deadlock: no items to sell', steps };
      }
      // 6. wait for energy
      const wait = Math.max(1000, S.regenMs() - (Date.now() - G.eTs) + 5);
      adv(wait); waits++;
    }
    const comp = {}; for (const it of board) { const k = !it ? 'empty' : it.k === 'i' ? it.c + it.l : it.k === 'b' ? 'bubble' : it.k === 'g' ? 'gen' : 'crate'; comp[k] = (comp[k] || 0) + 1; }
    const ords = B.slots.map(sl => sl.o && sl.o.req.map(r => r.c + r.l).join('+'));
    return { comp, ords, log, unlocks, sells, waits, steps, merges, spawns, maxFull, act: Math.round(active / 60000), wall: Math.round(wall / 60000), lvl: G.lvl, coins: G.coins, orders: G.stats.o, disc: G.disc };
  }, HOURS);
  if (res.error) { console.log('FAIL ' + res.error); process.exitCode = 1; }
  else {
    console.log('level | active min | wall min (incl. waiting for energy) | orders');
    for (const r of res.log) console.log(String(r.lvl).padStart(5) + ' | ' + String(r.act).padStart(10) + ' | ' + String(r.wall).padStart(8) + ' | ' + r.orders);
    console.log('unlock/upgrade at active minute:', JSON.stringify(res.unlocks));
    console.log('totals:', JSON.stringify({ act: res.act, wall: res.wall, lvl: res.lvl, orders: res.orders, merges: res.merges, spawns: res.spawns, sells: res.sells, maxFull: res.maxFull, coins: res.coins }));
    console.log('discovered:', JSON.stringify(res.disc));
    console.log('final board:', JSON.stringify(res.comp), 'orders:', JSON.stringify(res.ords));
    console.log(errs.length ? 'FAIL errors ' + JSON.stringify(errs) : 'ALL PASSED (no deadlock, no errors)');
  }
  await b.close();
})();
