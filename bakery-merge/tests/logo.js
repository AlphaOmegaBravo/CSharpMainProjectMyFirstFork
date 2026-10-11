const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
(async () => { const b = await pw.chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ru-RU' });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(1250); await p.screenshot({ path: path.join(__dirname, 'out', 'logo.png'), clip: { x: 0, y: 200, width: 390, height: 360 } }); await b.close(); })();
