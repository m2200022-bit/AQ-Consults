// اختبار قواعد الأمان الحقيقية على محاكي Firestore: من يقرأ ومن يكتب ماذا
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection } from 'firebase/firestore';

const here = dirname(fileURLToPath(import.meta.url));
const env = await initializeTestEnvironment({
  projectId: 'demo-aq',
  firestore: { rules: readFileSync(join(here, '..', '..', 'firestore.rules'), 'utf8'), host: '127.0.0.1', port: 8089 }
});
const now = '2026-11-27T00:00:00.000Z';
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'users/admin'), { role: 'admin', active: true, name: 'الإدارة' });
  await setDoc(doc(db, 'users/cons'), { role: 'consultant', active: true, name: 'مستشار' });
  await setDoc(doc(db, 'users/off'), { role: 'consultant', active: false, name: 'موقوف' });
  await setDoc(doc(db, 'users/bak'), { role: 'backup', active: true, name: 'نسخ' });
  await setDoc(doc(db, 'security/lock'), { at: now });
  await setDoc(doc(db, 'security/usernames'), { map: {} });
  await setDoc(doc(db, 'public/stats'), { items: [] });
  for (const k of ['consultations_v2', 'messages_v2', 'settings_v1', 'profiles_v2', 'templates_v1']) await setDoc(doc(db, 'app_state', k), { value: '[]', updatedAt: 1 });
  await setDoc(doc(db, 'audit/a1'), { ts: now, actor: 'x', actorRole: 'admin', action: 'y', device: 'z', uid: 'admin' });
  await setDoc(doc(db, 'vault/backup'), { key: 'k' });
  await setDoc(doc(db, 'push_tokens/tokAdmin'), { uid: 'admin', role: 'admin', device: 'd', ts: now });
  await setDoc(doc(db, 'push_tokens/tokCons'), { uid: 'cons', role: 'consultant', device: 'd', ts: now });
  await setDoc(doc(db, 'backups/2026-11-27__c'), { value: '[]' });
});
const anon = env.unauthenticatedContext().firestore();
const admin = env.authenticatedContext('admin').firestore();
const cons = env.authenticatedContext('cons').firestore();
const off = env.authenticatedContext('off').firestore();
const bak = env.authenticatedContext('bak').firestore();
const stranger = env.authenticatedContext('stranger').firestore();

let bad = 0;
async function t(name, p, ok) {
  try { await (ok ? assertSucceeds(p) : assertFails(p)); console.log('PASS', name); }
  catch (e) { bad++; console.log('FAIL', name, '—', e.message.split('\n')[0]); }
}
const v = { value: '[]', updatedAt: 2 };
const audit = (uid, extra = {}) => ({ ts: now, actor: 'a', actorRole: 'consultant', action: 'b', device: 'c', uid, ...extra });

// زائر بلا تسجيل دخول
await t('visitor cannot read consultations', getDoc(doc(anon, 'app_state/consultations_v2')), false);
await t('visitor cannot read profiles once locked', getDoc(doc(anon, 'app_state/profiles_v2')), false);
await t('visitor can read login-page counts', getDoc(doc(anon, 'public/stats')), true);
await t('visitor cannot write login-page counts', setDoc(doc(anon, 'public/stats'), { items: [] }), false);
await t('visitor can read username fingerprints', getDoc(doc(anon, 'security/usernames')), true);
await t('signed-in stranger cannot read consultations', getDoc(doc(stranger, 'app_state/consultations_v2')), false);
await t('stranger cannot create a user doc once locked', setDoc(doc(stranger, 'users/stranger'), { role: 'admin', active: true }), false);
await t('stranger cannot replace username map once locked', setDoc(doc(stranger, 'security/usernames'), { map: { x: 'y' } }), false);
// المستشار
await t('consultant reads consultations', getDoc(doc(cons, 'app_state/consultations_v2')), true);
await t('consultant writes consultations', setDoc(doc(cons, 'app_state/consultations_v2'), v), true);
await t('consultant writes messages', setDoc(doc(cons, 'app_state/messages_v2'), v), true);
await t('consultant writes templates', setDoc(doc(cons, 'app_state/templates_v1'), v), true);
await t('consultant cannot write settings', setDoc(doc(cons, 'app_state/settings_v1'), v), false);
await t('consultant cannot write profiles', setDoc(doc(cons, 'app_state/profiles_v2'), v), false);
await t('consultant cannot write archives', setDoc(doc(cons, 'app_state/archive_2026-08'), v), false);
await t('consultant cannot promote own account', updateDoc(doc(cons, 'users/cons'), { role: 'admin' }), false);
await t('consultant cannot read the vault', getDoc(doc(cons, 'vault/backup')), false);
await t('consultant cannot read audit log', getDoc(doc(cons, 'audit/a1')), false);
await t('consultant cannot read backups', getDoc(doc(cons, 'backups/2026-11-27__c')), false);
await t('consultant creates a backup', setDoc(doc(cons, 'backups/2026-11-28__m'), { value: '[]' }), true);
await t('consultant cannot overwrite a backup', setDoc(doc(cons, 'backups/2026-11-27__c'), { value: 'x' }), false);
// الحساب الموقوف
await t('suspended consultant cannot read consultations', getDoc(doc(off, 'app_state/consultations_v2')), false);
await t('suspended consultant cannot write consultations', setDoc(doc(off, 'app_state/consultations_v2'), v), false);
await t('suspended consultant cannot add audit entries', addDoc(collection(off, 'audit'), audit('off')), false);
// المدير
await t('admin writes settings', setDoc(doc(admin, 'app_state/settings_v1'), v), true);
await t('admin updates a user', updateDoc(doc(admin, 'users/cons'), { name: 'مستشار أول' }), true);
await t('admin reads the vault', getDoc(doc(admin, 'vault/backup')), true);
await t('admin reads backups', getDoc(doc(admin, 'backups/2026-11-27__c')), true);
// سجل العمليات: إضافة فقط
await t('consultant adds own audit entry', addDoc(collection(cons, 'audit'), audit('cons')), true);
await t('audit entry under someone else\'s uid is refused', addDoc(collection(cons, 'audit'), audit('admin')), false);
await t('audit entry with extra fields is refused', addDoc(collection(cons, 'audit'), audit('cons', { hacked: true })), false);
await t('admin reads audit', getDoc(doc(admin, 'audit/a1')), true);
await t('even admin cannot edit audit', updateDoc(doc(admin, 'audit/a1'), { action: 'changed' }), false);
await t('even admin cannot delete audit', deleteDoc(doc(admin, 'audit/a1')), false);
// حساب النسخ الخارجي: قراءة فقط
await t('backup account reads consultations', getDoc(doc(bak, 'app_state/consultations_v2')), true);
await t('backup account reads audit', getDoc(doc(bak, 'audit/a1')), true);
await t('backup account cannot write', setDoc(doc(bak, 'app_state/consultations_v2'), v), false);
await t('backup account cannot read the vault', getDoc(doc(bak, 'vault/backup')), false);
// رموز أجهزة الإشعارات
await t('consultant registers own device', setDoc(doc(cons, 'push_tokens/tokNew'), { uid: 'cons', role: 'consultant', device: 'd', ts: now }), true);
await t('consultant cannot register as admin', setDoc(doc(cons, 'push_tokens/tokEvil'), { uid: 'cons', role: 'admin', device: 'd', ts: now }), false);
await t('consultant cannot register for another user', setDoc(doc(cons, 'push_tokens/tokEvil2'), { uid: 'admin', role: 'admin', device: 'd', ts: now }), false);
await t('nobody reads device tokens', getDoc(doc(admin, 'push_tokens/tokCons')), false);
await t('consultant cannot delete admin device', deleteDoc(doc(cons, 'push_tokens/tokAdmin')), false);
await t('consultant deletes own device', deleteDoc(doc(cons, 'push_tokens/tokCons')), true);
await t('suspended consultant cannot register a device', setDoc(doc(off, 'push_tokens/tokOff'), { uid: 'off', role: 'consultant', device: 'd', ts: now }), false);

await env.cleanup();
console.log(bad ? 'RULES TESTS FAILED: ' + bad : 'RULES TESTS OK');
process.exit(bad ? 1 : 0);
