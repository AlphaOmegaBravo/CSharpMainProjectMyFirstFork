// Minimal score relay for the VK friends leaderboard (VKWebAppShowLeaderBoardBox).
// VK only accepts game results from a trusted server (secure.addAppEvent with the app's service key),
// so the game posts its weekly score here and this server forwards it after checking the launch-params signature.
//
// Run:  VK_APP_SECRET=... VK_SERVICE_KEY=... node server/vk-score.js   (Node 18+, no dependencies)
// Then set VK_SCORE_URL in index.html to the public https URL of this server (e.g. https://example.com/score).
// ⚠ Verify against the current VK docs before release: secure.addAppEvent parameters (activity_id 2 = points),
//   API version, rate limits, and whether a CORS origin restriction is needed.
const http = require('http'), crypto = require('crypto');
const SECRET = process.env.VK_APP_SECRET || '', SERVICE = process.env.VK_SERVICE_KEY || '', PORT = +process.env.PORT || 8080;

/** VK launch params signature: HMAC-SHA256 over sorted vk_* params, base64url without padding. */
function checkSign(query) {
  const p = new URLSearchParams(query), sign = p.get('sign');
  const keys = [...p.keys()].filter(k => k.startsWith('vk_')).sort();
  const str = keys.map(k => k + '=' + encodeURIComponent(p.get(k))).join('&');
  const hash = crypto.createHmac('sha256', SECRET).update(str).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return sign && hash === sign ? p.get('vk_user_id') : null;
}
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.end(); return; }
  if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
  let body = ''; req.on('data', c => { body += c; if (body.length > 1e4) req.destroy(); });
  req.on('end', async () => {
    try {
      const { score, params } = JSON.parse(body), userId = checkSign(params || '');
      if (!userId || !(score >= 0) || score > 1e8) { res.statusCode = 403; res.end('bad sign'); return; }
      const q = new URLSearchParams({ user_id: userId, activity_id: '2', value: String(Math.round(score)), access_token: SERVICE, client_secret: SECRET, v: '5.199' });
      const r = await fetch('https://api.vk.com/method/secure.addAppEvent', { method: 'POST', body: q });
      res.end(JSON.stringify(await r.json()));
    } catch (e) { res.statusCode = 400; res.end('error'); }
  });
}).listen(PORT, () => console.log('vk-score relay on :' + PORT));
