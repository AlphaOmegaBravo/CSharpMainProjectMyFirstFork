// Bakery Merge automated test (Playwright). Run: node tests/<name>.js  (or tests/run-all.sh)
const path = require('path'), fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium } = pw;
const GAME = path.resolve(__dirname, '..', 'index.html');
fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true }); process.chdir(path.join(__dirname, 'out'));
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1100, height: 560 } });
  p.on('pageerror', e => console.log('pageerror: ' + e.message));
  await p.goto('file://' + GAME);
  await p.waitForTimeout(800);
  await p.evaluate(() => {
    const B = window.__bakery, S = 120;
    const keys = [];
    for (const c of ['ice','coffee']) for (let l=1;l<=8;l++) keys.push('i:'+c+':'+l);
    keys.push('gi:ice','gi:coffee','bub','heart','crown','gt','coin','tick');
    
    const cv = document.createElement('canvas'); cv.width = 8*S+20; cv.height = Math.ceil(keys.length/8)*S+20;
    const g = cv.getContext('2d'); g.fillStyle='#fbe6c2'; g.fillRect(0,0,cv.width,cv.height);
    keys.forEach((k,i)=>{ g.drawImage(B.renderKey(k,S), 10+(i%8)*S, 10+Math.floor(i/8)*S); });
    cv.style.cssText='position:fixed;left:0;top:0;z-index:999'; document.body.appendChild(cv);
  });
  await p.screenshot({ path: 'sprites.png', clip: { x: 0, y: 0, width: 1000, height: 560 } });
  await b.close();
})();
