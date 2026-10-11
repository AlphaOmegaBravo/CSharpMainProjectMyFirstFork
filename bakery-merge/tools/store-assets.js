// Generates store/catalog images (icon, covers) from the game's own art.
// Run: node tools/store-assets.js   -> writes PNGs into bakery-merge/store/
const path = require('path'), fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium } = pw;
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'store');
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 400, height: 400 } });
  await p.goto('file://' + path.join(ROOT, 'index.html')); await p.waitForTimeout(800);
  const make = (w, h, kind, title) => p.evaluate(([w, h, kind, title]) => {
    const B = window.__bakery, c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), m = Math.min(w, h);
    const bg = g.createRadialGradient(w / 2, h * 0.55, m * 0.1, w / 2, h * 0.55, Math.max(w, h) * 0.75);
    bg.addColorStop(0, '#fff3d6'); bg.addColorStop(1, '#f2a65f'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(214,120,60,0.13)';
    for (let y = 0; y < h + 40; y += 40) for (let x = (y / 40 % 2) * 20; x < w + 40; x += 40) { g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 5, y); g.lineTo(x, y + 6); g.lineTo(x - 5, y); g.fill(); }
    const aw = h * (kind === 'icon' ? 0.17 : 0.13), n = kind === 'icon' ? 6 : 12, sw = w / n;
    for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? '#fff4e2' : '#e8584a'; g.fillRect(i * sw, 0, sw + 1, aw); g.beginPath(); g.arc(i * sw + sw / 2, aw, sw / 2, 0, Math.PI); g.fill(); }
    g.beginPath(); g.moveTo(0, aw); for (let i = 0; i < n; i++) g.arc(i * sw + sw / 2, aw, sw / 2, Math.PI, 0, true); g.lineWidth = m * 0.012; g.strokeStyle = '#3d2412'; g.stroke();
    const glow = B.renderKey('glow', 256), spark = B.renderKey('spark', 128);
    const put = (key, x, y, s, rot) => { const img = B.renderKey(key, Math.round(s * 1.2)); g.save(); g.translate(x, y); g.rotate(rot || 0); g.drawImage(img, -s / 2, -s / 2, s, s); g.restore(); };
    if (kind === 'icon') {
      g.globalAlpha = 0.9; g.drawImage(glow, w * 0.05, h * 0.15, w * 0.9, h * 0.9); g.globalAlpha = 1;
      put('host:h', w * 0.5, h * 0.52, m * 0.74);
      put('i:bread:7', w * 0.5, h * 0.86, m * 0.44);
      put('i:cake:4', w * 0.16, h * 0.74, m * 0.28, -0.25); put('i:fruit:2', w * 0.84, h * 0.74, m * 0.26, 0.25);
      g.drawImage(spark, w * 0.66, h * 0.22, m * 0.14, m * 0.14);
    } else {
      g.globalAlpha = 0.8; g.drawImage(glow, w / 2 - m * 0.6, h * 0.2, m * 1.2, m * 1.0); g.globalAlpha = 1;
      const row = ['i:fruit:6', 'i:cake:5', 'i:bread:7', 'i:coffee:4', 'i:ice:6'];
      row.forEach((k, i) => put(k, w * (0.14 + i * 0.18), h * (i === 2 ? 0.66 : 0.72), m * (i === 2 ? 0.42 : 0.3), (i - 2) * 0.08));
      put('host:h', w * 0.1, h * 0.9, m * 0.5); put('c:7:h', w * 0.92, h * 0.98, m * 0.4);
      let f = Math.round(m * 0.13); g.font = '900 ' + f + 'px "Nunito","Arial Rounded MT Bold","Trebuchet MS",sans-serif';
      const tw = g.measureText(title).width; if (tw > w * 0.84) { f = Math.floor(f * w * 0.84 / tw); g.font = '900 ' + f + 'px "Nunito","Arial Rounded MT Bold","Trebuchet MS",sans-serif'; }
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      g.lineWidth = f * 0.28; g.strokeStyle = '#3d2412'; g.strokeText(title, w / 2, h * 0.33);
      g.fillStyle = '#fff'; g.fillText(title, w / 2, h * 0.33);
      [[0.2, 0.25], [0.8, 0.27], [0.5, 0.48]].forEach(([x, y]) => g.drawImage(spark, w * x, h * y, m * 0.08, m * 0.08));
    }
    return c.toDataURL('image/png');
  }, [w, h, kind, title]);
  const jobs = [['icon-512.png', 512, 512, 'icon'], ['icon-278.png', 278, 278, 'icon'], ['cover-1920x1080.png', 1920, 1080, 'cover'], ['cover-1100x700.png', 1100, 700, 'cover'], ['cover-800x450.png', 800, 450, 'cover']];
  for (const [name, w, h, kind] of jobs) {
    const url = await make(w, h, kind, 'Пышка: пекарня-мёрдж');
    fs.writeFileSync(path.join(OUT, name), Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote store/' + name);
  }
  await b.close();
})();
