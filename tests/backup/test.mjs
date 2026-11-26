// اختبار سكربت النسخ الخارجي: تسجيل الدخول، رمز App Check، التشفير وفك التشفير
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { createDecipheriv } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const key = readFileSync(join(here, '..', 'ui', 'ext', 'key.txt'), 'utf8').trim();
const DBG = '00000000-0000-4000-A000-000000000001';
const fx = { pass: 'pw', dbg: DBG, app: { consultations_v2: [{ id: 'c1' }, { id: 'c2' }], messages_v2: [{ id: 'm1' }] } };
const run = (a) => {
  const out = mkdtempSync(join(tmpdir(), 'aqb-'));
  const sec = Buffer.from(JSON.stringify(a ? { e: 'b@x', p: 'pw', k: key, a } : { e: 'b@x', p: 'pw', k: key })).toString('base64');
  try {
    execFileSync('node', ['--import', join(here, '..', 'ui', 'ext', 'mockfetch.mjs'), join(root, 'scripts', 'backup.mjs'), out],
      { env: { ...process.env, FX: JSON.stringify(fx), AQ_BACKUP: sec }, stdio: 'pipe' });
  } catch (e) { return { ok: false }; }
  const f = readdirSync(out)[0];
  const b = Buffer.from(readFileSync(join(out, f), 'utf8').trim(), 'base64');
  const d = createDecipheriv('aes-256-gcm', Buffer.from(key, 'base64'), b.subarray(0, 12));
  d.setAuthTag(b.subarray(b.length - 16));
  const j = JSON.parse(Buffer.concat([d.update(b.subarray(12, b.length - 16)), d.final()]).toString('utf8'));
  return { ok: true, j };
};
let bad = 0;
const check = (name, cond) => { console.log(cond ? 'PASS' : 'FAIL', name); if (!cond) bad++; };
const good = run(DBG);
check('backup with App Check token succeeds', good.ok);
const c = good.ok && good.j.appState.consultations_v2;
const cv = c && (typeof c.value === 'string' ? JSON.parse(c.value) : c.value || c);
check('decrypted backup holds consultations', Array.isArray(cv) && cv.length === 2);
check('decrypted backup holds audit', good.ok && Array.isArray(good.j.audit) && good.j.audit.length === 1);
check('backup without App Check token is refused once enforced', !run('').ok);
check('backup with wrong App Check token is refused', !run('WRONG').ok);
console.log(bad ? 'BACKUP TESTS FAILED: ' + bad : 'BACKUP TESTS OK');
process.exit(bad ? 1 : 0);
