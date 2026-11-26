// دالة الإشعارات لنظام الاستشارات
// تعمل عند كل تعديل على مستندات app_state، وتقارن الاستشارات والرسائل قبل التعديل وبعده،
// ثم ترسل تنبيهاً (Firebase Cloud Messaging) إلى أجهزة من يعنيهم الأمر — حتى والنظام مغلق.
const path = require('path');
const protobuf = require('protobufjs');

const ICON = 'https://m2200022-bit.github.io/AQ-Consults/icon-192.png';
const MAX_EVENTS = 6; // تعديل جماعي (استعادة نسخة، استيراد) لا يُرسل إشعارات
const STATUS = {
  'تحت الإجابة': 'pending', 'تمت الإجابة': 'answered', 'معتمدة': 'to_publish',
  'قيد الطباعة': 'published', 'مؤرشفة': 'published', 'اعتذار': 'declined'
};
const st = (s) => STATUS[s] || s || 'pending';
const OTHER = { admin: 'consultant', consultant: 'admin' };

let EventType;
async function eventType() {
  if (!EventType) {
    const root = await protobuf.load(path.join(__dirname, 'data.proto'));
    EventType = root.lookupType('aq.DocumentEventData');
  }
  return EventType;
}
function arr(d) {
  const s = d && d.fields && d.fields.value && d.fields.value.stringValue;
  if (!s) return [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
const label = (c) => 'رقم ' + (c.number || c.id) + (c.subject ? ' — ' + String(c.subject).slice(0, 80) : '');

// يحدّد التنبيهات المطلوبة من الفرق بين القائمتين
function diff(key, before, after) {
  const ev = [];
  if (key === 'consultations_v2') {
    const prev = new Map(before.filter(Boolean).map((c) => [c.id, c]));
    for (const c of after) {
      if (!c || c.deleted) continue;
      const p = prev.get(c.id), s = st(c.status), ps = p ? st(p.status) : null;
      if (s === 'pending' && (!p || ps !== 'pending')) {
        ev.push({ to: 'consultant', uid: c.assignedUid || null, title: p ? 'استشارة أُعيدت إليك' : 'استشارة جديدة', body: label(c) });
      } else if (p && ps === 'pending' && (s === 'answered' || s === 'declined')) {
        ev.push({ to: 'admin', title: s === 'answered' ? 'إجابة جديدة بانتظار الاعتماد' : 'اعتذار عن استشارة', body: label(c) });
      }
    }
  } else if (key === 'messages_v2') {
    const seen = new Set(before.filter(Boolean).map((m) => m.id));
    for (const m of after) {
      if (!m || seen.has(m.id)) continue;
      const to = OTHER[m.from || m.fromRole];
      if (!to) continue;
      ev.push({ to, title: 'رسالة جديدة', body: (m.fromName ? m.fromName + ': ' : '') + String(m.text || '').slice(0, 90) });
    }
  }
  return ev;
}

// يرسل التنبيهات إلى الأجهزة المسجّلة لأصحاب الحسابات النشطة فقط، ويحذف الرموز المنتهية
async function deliver(ev, db, messaging) {
  const users = new Map((await db.collection('users').get()).docs.map((d) => [d.id, d.data()]));
  const isActive = (uid, role) => { const u = users.get(uid); return !!u && u.active !== false && u.role === role; };
  const tokens = (await db.collection('push_tokens').get()).docs
    .map((d) => ({ token: d.id, ref: d.ref, ...d.data() }))
    .filter((t) => isActive(t.uid, t.role));
  let sent = 0;
  for (const e of ev) {
    let target = tokens.filter((t) => t.role === e.to);
    // المسندة لمستشار نشط تذهب إليه وحده؛ غير المسندة أو المسندة لحساب موقوف تذهب لكل المستشارين
    if (e.to === 'consultant' && e.uid && isActive(e.uid, 'consultant')) target = target.filter((t) => t.uid === e.uid);
    if (!target.length) continue;
    const res = await messaging.sendEach(target.map((t) => ({
      token: t.token,
      webpush: {
        headers: { Urgency: 'high', TTL: '86400' },
        notification: { title: e.title, body: e.body, icon: ICON, badge: ICON, dir: 'rtl', lang: 'ar', tag: 'aq-' + e.title }
      }
    })));
    await Promise.all(res.responses.map((r, i) => {
      if (r.success) { sent++; return null; }
      const code = r.error && r.error.code;
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token' || code === 'messaging/invalid-argument') {
        return target[i].ref.delete().catch(() => {});
      }
      console.warn('send failed', code);
      return null;
    }));
  }
  return sent;
}

async function handle(cloudEvent, deps) {
  const T = await eventType();
  const data = T.decode(cloudEvent.data);
  const name = (data.value && data.value.name) || (data.oldValue && data.oldValue.name) || '';
  const key = name.split('/').pop();
  if (key !== 'consultations_v2' && key !== 'messages_v2') return { key, events: 0, sent: 0 };
  if (!data.oldValue || !data.value) return { key, events: 0, sent: 0 };
  const ev = diff(key, arr(data.oldValue), arr(data.value));
  if (!ev.length || ev.length > MAX_EVENTS) return { key, events: ev.length, sent: 0 };
  const sent = await deliver(ev, deps.db, deps.messaging);
  console.log(JSON.stringify({ key, events: ev.length, sent }));
  return { key, events: ev.length, sent };
}

module.exports = { handle, diff };

// التشغيل الفعلي على Google Cloud
if (!process.env.AQ_TEST) {
  const functions = require('@google-cloud/functions-framework');
  const admin = require('firebase-admin');
  admin.initializeApp();
  const deps = { db: admin.firestore(), messaging: admin.messaging() };
  functions.cloudEvent('notify', (e) => handle(e, deps));
}
