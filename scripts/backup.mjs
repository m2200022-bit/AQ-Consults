// نسخة احتياطية خارجية مشفّرة لنظام الاستشارات — تعمل يومياً عبر GitHub Actions
// تقرأ البيانات بحساب «النسخ» (قراءة فقط)، وتشفّرها بـ AES-256-GCM قبل حفظها، فلا يمكن قراءتها دون المفتاح.
import { createCipheriv, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

const API_KEY = 'AIzaSyDUDzOYvFnChyU3QU81RapJ7wG5VtzG0tU';
const PROJECT = 'aq-consults';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const outDir = process.argv[2] || 'out';

const raw = process.env.AQ_BACKUP;
if (!raw) { console.log('لم يُضبط المفتاح السري AQ_BACKUP بعد — تم التخطي.'); process.exit(0); }
const cfg = JSON.parse(Buffer.from(raw.trim(), 'base64').toString('utf8'));

async function j(url, opts) {
  const r = await fetch(url, opts);
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ' ' + t.slice(0, 300));
  return JSON.parse(t);
}
const login = await j(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: cfg.e, password: cfg.p, returnSecureToken: true })
});
const H = { Authorization: 'Bearer ' + login.idToken };
// App Check: عند تفعيل الحماية يجب أن يحمل كل طلب رمزاً صالحاً — نحصل عليه من «رمز التطوير» المسجّل في Firebase
const APP_ID = '1:1006318779836:web:d73eacdb83dea69e1abfb9';
const debugTok = cfg.a || process.env.AQ_APPCHECK || '';
if (debugTok) {
  const ac = await j(`https://firebaseappcheck.googleapis.com/v1/projects/${PROJECT}/apps/${APP_ID}:exchangeDebugToken?key=${API_KEY}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ debugToken: debugTok })
  });
  H['X-Firebase-AppCheck'] = ac.token;
}

function plain(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, plain(x)]));
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(plain);
  return null;
}
async function list(col) {
  const out = []; let token = '';
  do {
    const r = await j(`${BASE}/${col}?pageSize=300${token ? '&pageToken=' + encodeURIComponent(token) : ''}`, { headers: H });
    (r.documents || []).forEach(d => out.push({ id: d.name.split('/').pop(), ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, x]) => [k, plain(x)])) }));
    token = r.nextPageToken || '';
  } while (token);
  return out;
}

const appState = {};
for (const d of await list('app_state')) { try { appState[d.id] = JSON.parse(d.value); } catch { appState[d.id] = d.value; } }
const audit = await list('audit');
const payload = { version: 3, kind: 'external', exportedAt: new Date().toISOString(), appState, audit };

const key = Buffer.from(cfg.k, 'base64');
const iv = randomBytes(12);
const c = createCipheriv('aes-256-gcm', key, iv);
const ct = Buffer.concat([c.update(JSON.stringify(payload), 'utf8'), c.final()]);
const blob = Buffer.concat([iv, ct, c.getAuthTag()]).toString('base64');

mkdirSync(outDir, { recursive: true });
const day = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); // توقيت قطر
writeFileSync(`${outDir}/${day}.json.enc`, blob);
const n = (appState.consultations_v2 || []).length + Object.keys(appState).filter(k => k.startsWith('archive_') && k !== 'archive_index').reduce((s, k) => s + (appState[k] || []).length, 0);
console.log(`تمت النسخة ${day}: ${n} استشارة، ${audit.length} عملية في السجل.`);
