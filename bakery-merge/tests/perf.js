// Bakery Merge automated test (Playwright). Run: node tests/<name>.js  (or tests/run-all.sh)
const path = require('path'), fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium } = pw;
const GAME = path.resolve(__dirname, '..', 'index.html');
fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true }); process.chdir(path.join(__dirname, 'out'));
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await p.goto('file://' + GAME); await p.waitForTimeout(800);
  await p.click('#mBtns .btn'); await p.waitForTimeout(300);
  // fill board with items for worst case
  await p.evaluate(() => { const B = window.__bakery; const cs = ['bread','cake','fruit']; for (let i = 0; i < 35; i++) if (!B.board[i]) B.board[i] = { k: 'i', c: cs[i % 3], l: 1 + (i % 8) }; });
  for (const rate of [1, 6]) {
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    const r = await p.evaluate(() => { const B = window.__bakery, cv = document.getElementById('cv'); const g = cv.getContext('2d');
      for (let i = 0; i < 10; i++) B.render(performance.now(), 16);
      const t0 = performance.now(); for (let i = 0; i < 60; i++) B.render(performance.now(), 16); g.getImageData(0, 0, 1, 1); return ((performance.now() - t0) / 60).toFixed(2); });
    console.log('cpu x' + rate + ' render() ms/frame (incl. raster):', r);
  }
  await b.close();
})();
