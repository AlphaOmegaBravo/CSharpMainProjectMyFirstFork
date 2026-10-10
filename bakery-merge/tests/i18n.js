// Bakery Merge automated test (Playwright). Run: node tests/<name>.js  (or tests/run-all.sh)
const path = require('path'), fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium } = pw;
const GAME = path.resolve(__dirname, '..', 'index.html');
fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true }); process.chdir(path.join(__dirname, 'out'));
(async () => {
  const src = fs.readFileSync(GAME, 'utf8');
  const used = [...new Set([...src.matchAll(/\bt\('([a-z0-9_]+)'/g)].map(m => m[1]))].filter(k => !k.endsWith('_'));
  const dyn = [...src.matchAll(/t\('([a-z_]+)' \+/g)].map(m => m[1]);
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + GAME); await p.waitForTimeout(500);
  const r = await p.evaluate(([used]) => { const I = window.__bakery.I18N; const ru = Object.keys(I.ru), en = Object.keys(I.en);
    const dynKeys = ['gen_ice','upg_ice','upg_ice_d','chain_ice','upg_store','upg_store_d','theme_0','theme_1','theme_2','theme_3','theme_4','tab_quests','tab_ach','tab_wheel'].concat(['m','o','v','rec','mx','cb','cr','lvl','pr'].flatMap(x => ['ach_' + x, 'ach_' + x + '_d'])).concat(['gen_bread','gen_cake','gen_fruit','gen_coffee','upg_cap','upg_regen','upg_luck','upg_store','upg_cake','upg_fruit','upg_coffee','upg_cake_d','upg_fruit_d','upg_coffee_d','chain_bread','chain_cake','chain_fruit','chain_coffee','tab_upg','tab_book','q_merge','q_order','q_spawn','q_craft','q_coins','q_crate']);
    return { onlyRu: ru.filter(k => !en.includes(k)), onlyEn: en.filter(k => !ru.includes(k)), missing: used.concat(dynKeys).filter(k => !ru.includes(k) || !en.includes(k)) }; }, [used]);
  const ok = !r.onlyRu.length && !r.onlyEn.length && !r.missing.length;
  console.log(ok ? 'ALL PASSED (i18n keys)' : 'FAIL i18n ' + JSON.stringify(r));
  if (!ok) process.exitCode = 1;
  await b.close();
})();
