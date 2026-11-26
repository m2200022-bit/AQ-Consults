const fx = JSON.parse(process.env.FX);
globalThis.fetch = async (url, opts) => {
  const ok = (o) => ({ ok: true, status: 200, text: async () => JSON.stringify(o) });
  if (url.includes('signInWithPassword')) { const b = JSON.parse(opts.body); if (b.password !== fx.pass) return { ok:false, status:400, text: async()=>'bad' }; return ok({ idToken: 'tok' }); }
  if (url.includes(':exchangeDebugToken')) { const b = JSON.parse(opts.body); if (b.debugToken !== fx.dbg) return { ok:false, status:403, text: async()=>'bad dbg' }; return ok({ token: 'ac-tok', ttl: '3600s' }); }
  if (fx.dbg && opts?.headers?.['X-Firebase-AppCheck'] !== 'ac-tok') return { ok:false, status:401, text: async()=>'no appcheck' };
  if (opts?.headers?.Authorization !== 'Bearer tok') return { ok:false, status:403, text: async()=>'denied' };
  if (url.includes('/documents/app_state')) return ok({ documents: Object.entries(fx.app).map(([id, v]) => ({ name: 'p/app_state/' + id, fields: { value: { stringValue: JSON.stringify(v) }, updatedAt: { integerValue: '5' } } })) });
  if (url.includes('/documents/audit')) return ok({ documents: [{ name: 'p/audit/x1', fields: { ts: { stringValue: '2026-11-26T10:00:00Z' }, action: { stringValue: 'تجربة' }, uid: { stringValue: 'u1' } } }] });
  throw new Error('unexpected ' + url);
};
