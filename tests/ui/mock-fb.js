// In-memory mock of the Firebase v10 modular API subset used by the app.
// Shared store lives on window.__store so tests can inspect/seed it (seed via window.__seed before load).
const W = window;
const store = W.__store = W.__store || { docs: new Map(), users: new Map(), listeners: new Set() };
const _saved = sessionStorage.getItem('__mockdb');
if (_saved) { W.__seeded = true; JSON.parse(_saved).forEach(([k, v]) => store.docs.set(k, v)); }
const _savedU = sessionStorage.getItem('__mockusers'); if (_savedU) JSON.parse(_savedU).forEach(([k, v]) => store.users.set(k, v));
const saveUsers = () => sessionStorage.setItem('__mockusers', JSON.stringify([...store.users]));
if (W.__seed && !W.__seeded) { W.__seeded = true; for (const [k, v] of Object.entries(W.__seed.docs || {})) store.docs.set(k, JSON.parse(JSON.stringify(v))); for (const [k, v] of Object.entries(W.__seed.users || {})) store.users.set(k, v); }
const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
let idc = 0; const autoId = () => 'id' + Date.now().toString(36) + (idc++);

// ---- app ----
export function initializeApp(cfg, name) { return { name: name || '[DEFAULT]', cfg }; }

// ---- auth ----
const authInstances = [];
function mkAuth(app) { const a = { app, currentUser: null, _l: [] }; authInstances.push(a); return a; }
Object.defineProperty(W, '__dA', { value: W.__dA || { v: null }, writable: true }); const DA = W.__dA;
export function getAuth(app) { if (!app || app.name === '[DEFAULT]') { if (!DA.v) { DA.v = mkAuth(app); const saved = sessionStorage.getItem('__mockUser'); if (saved) { const u = store.users.get(saved); if (u) DA.v.currentUser = { uid: u.uid, email: saved }; } } return DA.v; } return mkAuth(app); }
export function initializeAuth(app) { return mkAuth(app); }
export const inMemoryPersistence = {};
function fire(a) { a._l.forEach(f => setTimeout(() => f(a.currentUser), 0)); if (a === DA.v) { if (a.currentUser) sessionStorage.setItem('__mockUser', a.currentUser.email); else sessionStorage.removeItem('__mockUser'); } }
export function onAuthStateChanged(a, f) { a._l.push(f); setTimeout(() => f(a.currentUser), 0); return () => { a._l = a._l.filter(x => x !== f); }; }
const err = (code) => { const e = new Error(code); e.code = code; return e; };
export async function signInWithEmailAndPassword(a, email, pass) { await tick(); const u = store.users.get(email); if (!u || u.password !== pass) throw err('auth/invalid-credential'); a.currentUser = { uid: u.uid, email }; fire(a); return { user: a.currentUser }; }
export async function createUserWithEmailAndPassword(a, email, pass) { await tick(); if (store.users.has(email)) throw err('auth/email-already-in-use'); if (W.__authOff || sessionStorage.getItem('__authOff')==='1') throw err('auth/operation-not-allowed'); if (pass.length < 6) throw err('auth/weak-password'); const uid = 'u_' + autoId(); store.users.set(email, { uid, password: pass }); saveUsers(); a.currentUser = { uid, email }; fire(a); return { user: a.currentUser }; }
export async function signOut(a) { a.currentUser = null; fire(a); }
export const EmailAuthProvider = { credential: (email, password) => ({ email, password }) };
export async function reauthenticateWithCredential(user, cred) { const u = store.users.get(cred.email); if (!u || u.password !== cred.password) throw err('auth/invalid-credential'); }
export async function updatePassword(user, p) { store.users.get(user.email).password = p; saveUsers(); }

// ---- firestore ----
const tick = () => new Promise(r => setTimeout(r, 5));
export function getFirestore() { return { kind: 'db' }; }
export function initializeFirestore() { return { kind: 'db' }; }
export const persistentLocalCache = () => ({}); export const persistentMultipleTabManager = () => ({});
export function collection(db, name) { return { kind: 'col', path: name }; }
export function doc(a, ...segs) { if (a.kind === 'col') return { kind: 'doc', col: a.path, id: segs[0] || autoId(), get path() { return this.col + '/' + this.id; } }; return { kind: 'doc', col: segs[0], id: segs[1], get path() { return this.col + '/' + this.id; } }; }
export function query(col, ...cs) { return { kind: 'query', path: col.path, cs }; }
export function orderBy(f, dir = 'asc') { return { t: 'order', f, dir }; }
export function limit(n) { return { t: 'limit', n }; }
const AU = Symbol('arrayUnion');
export function arrayUnion(...vals) { return { [AU]: true, vals }; }
function denied(path) { if (!store.docs.has('security/lock')) return false; if (/^(public|security)\//.test(path)) return false; return !(DA.v && DA.v.currentUser); }
function snapDoc(ref, data) { return { id: ref.id, ref, exists: () => data !== undefined, data: () => clone(data) }; }
export async function getDoc(ref) { await tick(); if (denied(ref.path)) throw err('permission-denied'); if (W.__denyRead && W.__denyRead(ref.path)) throw err('permission-denied'); return snapDoc(ref, store.docs.get(ref.path)); }
function colDocs(path) { const out = []; for (const [k, v] of store.docs) { const [c, id] = k.split('/'); if (c === path) out.push({ id, data: v }); } return out; }
function runQuery(q) { let d = colDocs(q.path); for (const c of (q.cs || [])) { if (c.t === 'order') d.sort((a, b) => (a.data[c.f] > b.data[c.f] ? 1 : -1) * (c.dir === 'desc' ? -1 : 1)); if (c.t === 'limit') d = d.slice(0, c.n); } return d; }
export async function getDocs(q) { await tick(); const d = runQuery(q.kind === 'col' ? { path: q.path } : q); if (denied(q.path + '/x')) throw err('permission-denied'); return { docs: d.map(x => snapDoc({ id: x.id, path: q.path + '/' + x.id }, x.data)) }; }
function applyFields(base, fields) { const out = clone(base) || {}; for (const [k, v] of Object.entries(fields)) { if (v && v[AU]) { const arr = Array.isArray(out[k]) ? out[k] : []; v.vals.forEach(x => { if (!arr.some(y => JSON.stringify(y) === JSON.stringify(x))) arr.push(clone(x)); }); out[k] = arr; } else out[k] = clone(v); } return out; }
function write(path, val) { if (val === undefined) store.docs.delete(path); else store.docs.set(path, val); sessionStorage.setItem('__mockdb', JSON.stringify([...store.docs])); W.__writes = (W.__writes || 0) + 1; notifyAll(); }
export async function setDoc(ref, data, opts) { await tick(); if (denied(ref.path)) throw err('permission-denied'); if (W.__denyWrite && W.__denyWrite(ref.path, data)) throw err('permission-denied'); write(ref.path, opts && opts.merge ? applyFields(store.docs.get(ref.path), data) : applyFields({}, data)); }
export async function updateDoc(ref, data) { await tick(); if (denied(ref.path)) throw err('permission-denied'); if (W.__denyWrite && W.__denyWrite(ref.path, data)) throw err('permission-denied'); if (!store.docs.has(ref.path)) throw err('not-found'); write(ref.path, applyFields(store.docs.get(ref.path), data)); }
export async function deleteDoc(ref) { await tick(); write(ref.path, undefined); }
export async function addDoc(col, data) { const ref = doc(col); await setDoc(ref, data); return ref; }
export function writeBatch() { const ops = []; return { update(ref, data) { ops.push(() => write(ref.path, applyFields(store.docs.get(ref.path), data))); }, set(ref, data, opts) { ops.push(() => write(ref.path, opts && opts.merge ? applyFields(store.docs.get(ref.path), data) : applyFields({}, data))); }, async commit() { await tick(); ops.forEach(f => f()); } }; }
export async function runTransaction(db, fn) {
  await tick();
  if (W.__offline || sessionStorage.getItem('__offline')==='1') throw err('unavailable');
  const sets = [];
  const tx = { get: async (ref) => { if (denied(ref.path)) throw err('permission-denied'); return snapDoc(ref, store.docs.get(ref.path)); }, set: (ref, data) => { sets.push([ref, data]); } };
  const r = await fn(tx);
  for (const [ref] of sets) if (W.__denyWrite && W.__denyWrite(ref.path)) throw err('permission-denied');
  sets.forEach(([ref, data]) => write(ref.path, applyFields({}, data)));
  W.__tx = (W.__tx || 0) + 1;
  return r;
}
function notifyAll() { store.listeners.forEach(l => l()); }
export function onSnapshot(target, next, error) {
  let prev = new Map();
  let alive = true;
  const emit = () => {
    if (!alive) return;
    if (denied(target.path + (target.kind === 'doc' ? '' : '/x'))) { if (!emit.err) { emit.err = 1; error && error(err('permission-denied')); } return; }
    if (target.kind === 'doc') { const j = JSON.stringify(store.docs.get(target.path)); if (emit.done && j === emit.last) return; emit.done = true; emit.last = j; next({ ...snapDoc(target, store.docs.get(target.path)), metadata: { hasPendingWrites: false, fromCache: false } }); return; }
    const d = runQuery(target.kind === 'col' ? { path: target.path } : target);
    const cur = new Map(d.map(x => [x.id, JSON.stringify(x.data)]));
    const changes = [];
    d.forEach(x => { if (!prev.has(x.id)) changes.push({ type: 'added', doc: snapDoc({ id: x.id }, x.data) }); else if (prev.get(x.id) !== cur.get(x.id)) changes.push({ type: 'modified', doc: snapDoc({ id: x.id }, x.data) }); });
    const same = prev.size === cur.size && changes.length === 0;
    prev = cur;
    if (same && emit.done) return; emit.done = true;
    next({ docs: d.map(x => snapDoc({ id: x.id }, x.data)), docChanges: () => changes, metadata: { hasPendingWrites: false, fromCache: false } });
  };
  const l = () => setTimeout(emit, 0);
  store.listeners.add(l); setTimeout(emit, 0);
  return () => { alive = false; store.listeners.delete(l); };
}
export function initializeAppCheck(app, opts) { W.__appCheck = opts && opts.provider && opts.provider.key; return {}; }
export class ReCaptchaEnterpriseProvider { constructor(k) { this.key = k; } }
export function getMessaging() { return { kind: 'messaging' }; }
export async function isSupported() { return true; }
export async function getToken(m, opts) { W.__pushOpts = opts; return 'tok-' + (W.__tokN = (W.__tokN || 0) + 1); }
export async function deleteToken() { W.__tokDeleted = (W.__tokDeleted || 0) + 1; return true; }
