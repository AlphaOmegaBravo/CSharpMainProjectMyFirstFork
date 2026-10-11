// VK Mini Apps adapter test with a mocked VK Bridge
const path = require('path'), fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium } = pw;
const GAME = path.resolve(__dirname, '..', 'index.html');
fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true }); process.chdir(path.join(__dirname, 'out'));
let fails = 0;
const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const URL = 'file://' + GAME + '?vk_app_id=123&vk_platform=mobile_android&vk_language=en&vk_user_id=1';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ru-RU' });
  await ctx.addInitScript(() => {
    const log = window.__vklog = []; const subs = [];
    const store = JSON.parse(localStorage.getItem('__vkstore') || '{}');
    window.__vkAds = true;
    const mock = {
      send(m, p) {
        log.push(m + (p && p.ad_format ? ':' + p.ad_format : ''));
        switch (m) {
          case 'VKWebAppCheckNativeAds': return Promise.resolve({ result: window.__vkAds });
          case 'VKWebAppShowNativeAds': return new Promise(r => setTimeout(() => r({ result: true }), 200));
          case 'VKWebAppStorageSet': store[p.key] = p.value; localStorage.setItem('__vkstore', JSON.stringify(store)); return Promise.resolve({ result: true });
          case 'VKWebAppStorageGet': return Promise.resolve({ keys: p.keys.map(k => ({ key: k, value: store[k] || '' })) });
          case 'VKWebAppShowInviteBox': return Promise.resolve({ success: true });
          case 'VKWebAppAddToFavorites': return Promise.resolve({ result: true });
          default: return Promise.resolve({ result: true });
        }
      },
      subscribe(fn) { subs.push(fn); },
    };
    window.__vkfire = (type, data) => subs.forEach(f => f({ detail: { type, data } }));
    Object.defineProperty(window, 'vkBridge', { configurable: true, get: () => mock, set: () => {} });
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await sleep(1000);
  const log = () => p.evaluate(() => window.__vklog.slice());
  let r = await p.evaluate(() => ({ name: window.__bakery.Platform.name, lang: document.documentElement.lang }));
  assert(r.name === 'vk', 'VK adapter selected from launch params');
  assert(r.lang === 'en', 'language from vk_language');
  let L0 = await log();
  assert(L0[0] === 'VKWebAppInit', 'VKWebAppInit sent first');
  assert(L0.includes('VKWebAppSetSwipeSettings'), 'swipe-back disabled for drag & drop');
  assert(L0.includes('VKWebAppCheckNativeAds:reward'), 'rewarded ads preloaded');
  await p.click('#mBtns .btn'); await sleep(300);
  await p.evaluate(() => { const B = window.__bakery; B.G.tu = 9; B.G.daily.d = B.dayStr(0); B.changed(); });
  const e0 = await p.evaluate(() => window.__bakery.G.energy);
  await p.click('#btnEnergyAd'); await sleep(700);
  assert(await p.evaluate(() => window.__bakery.G.energy) === e0 + 20, 'VK rewarded ad gives +20 energy');
  assert((await log()).includes('VKWebAppShowNativeAds:reward'), 'VKWebAppShowNativeAds reward called');
  await p.evaluate(() => { window.__vkAds = false; });
  await p.click('#btnEnergyAd'); await sleep(500);
  const toastTxt = await p.textContent('#toast');
  assert(/No ads/.test(toastTxt) && await p.evaluate(() => window.__bakery.G.energy) === e0 + 20, 'no-ad case: message, no reward (' + toastTxt + ')');
  await p.evaluate(() => { window.__vkAds = true; });
  // pause/resume via VK events (flushes cloud save)
  await p.evaluate(() => window.__vkfire('VKWebAppViewHide')); await sleep(300);
  r = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('__vkstore') || '{}'); return { n: s.bmn, len: Object.keys(s).length }; });
  assert(+r.n >= 1, 'ViewHide flushes chunked cloud save (' + r.n + ' chunk(s))');
  await p.evaluate(() => window.__vkfire('VKWebAppViewRestore')); await sleep(200);
  // insets
  await p.evaluate(() => window.__vkfire('VKWebAppUpdateInsets', { insets: { top: 44, bottom: 20, left: 0, right: 0 } })); await sleep(100);
  r = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--inset-top').trim());
  assert(r === '44px', 'safe-area insets from VK applied (' + r + ')');
  await p.evaluate(() => window.__vkfire('VKWebAppUpdateInsets', { insets: { top: 0, bottom: 0, left: 0, right: 0 } }));
  // social rewards
  await sleep(1200);
  await p.click('#btnQuests'); await sleep(400);
  await p.locator('.tab').nth(0).click(); await sleep(300);
  assert(await p.locator('.vkrow').count() === 2, 'VK invite + favorites rows in tasks tab');
  await p.screenshot({ path: 'vk_social.png' });
  const e1 = await p.evaluate(() => window.__bakery.G.energy), c1 = await p.evaluate(() => window.__bakery.G.coins);
  await p.locator('.vkrow .btn').first().click(); await sleep(400);
  assert(await p.evaluate(() => window.__bakery.G.energy) === e1 + 20, 'invite friends: +20 energy');
  await p.locator('.vkrow .btn').first().click(); await sleep(400);
  assert(await p.evaluate(() => window.__bakery.G.coins) === c1 + 100, 'add to favorites: +100 coins');
  assert(await p.locator('.vkrow .btn').count() === 0, 'social rewards claimed only once');
  await p.click('#mBtns .btn'); await sleep(200);
  // cloud save restores progress on a fresh device (empty localStorage except the VK cloud mock)
  await p.evaluate(() => { window.__bakery.G.coins = 777; window.__vkfire('VKWebAppViewHide'); }); await sleep(300);
  const cloud = await p.evaluate(() => localStorage.getItem('__vkstore'));
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
  await ctx2.addInitScript(cloud => { if (!sessionStorage.getItem('__s')) { sessionStorage.setItem('__s', 1); localStorage.clear(); localStorage.setItem('__vkstore', cloud); } }, cloud);
  await ctx2.addInitScript(() => {
    const store = JSON.parse(localStorage.getItem('__vkstore') || '{}');
    const mock = { send(m, p) { if (m === 'VKWebAppStorageGet') return Promise.resolve({ keys: p.keys.map(k => ({ key: k, value: store[k] || '' })) }); return Promise.resolve({ result: true }); }, subscribe() {} };
    Object.defineProperty(window, 'vkBridge', { configurable: true, get: () => mock, set: () => {} });
  });
  const p2 = await ctx2.newPage(); p2.on('pageerror', e => errs.push(e.message));
  await p2.goto(URL); await sleep(1200);
  assert(await p2.evaluate(() => window.__bakery.G.coins) === 777, 'progress restored from VK cloud storage on a new device');
  assert(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})();
