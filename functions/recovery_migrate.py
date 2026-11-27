#!/usr/bin/env python3
"""نقل حسابات نظام الاستشارات إلى بريد الاسترجاع.

يغيّر بريد كل حساب نشط (المدير والمستشار) في Firebase Authentication إلى
m2200022+aq-<اسم المستخدم>@gmail.com مع الإبقاء على الحساب نفسه وكلمة مروره،
ثم يكتب login_ids/<بصمة اسم المستخدم> ويُفرغ الخريطة القديمة security/usernames.

التشغيل من Cloud Shell (بصلاحيات المالك):
    python3 functions/recovery_migrate.py            # معاينة فقط، لا يغيّر شيئاً
    APPLY=1 python3 functions/recovery_migrate.py    # تنفيذ
"""
import hashlib, json, os, re, subprocess, sys, urllib.request, urllib.error
from datetime import datetime, timezone

P = 'aq-consults'
BASE, DOMAIN, CODE = 'm2200022', 'gmail.com', 'aq'
APPLY = os.environ.get('APPLY') == '1'
TOKEN = subprocess.check_output(['gcloud', 'auth', 'print-access-token'], text=True).strip()
FS = f'https://firestore.googleapis.com/v1/projects/{P}/databases/(default)/documents'
IT = f'https://identitytoolkit.googleapis.com/v1/projects/{P}'


def call(method, url, body=None):
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json',
                                          'x-goog-user-project': P})
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'{method} {url.split("/v1/")[-1]} -> {e.code} {e.read().decode()[:300]}')


def norm(u): return str(u or '').strip().lower()
def slug(u, role): return re.sub(r'[^a-z0-9._-]', '', norm(u)) or role
def key(u): return 'h_' + hashlib.sha256(('aq-consults|' + norm(u)).encode()).hexdigest()
def val(f): return list(f.values())[0] if f else None


now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
prof = json.loads(val(call('GET', f'{FS}/app_state/profiles_v2')['fields']['value']))
users = call('GET', f'{FS}/users?pageSize=200').get('documents', [])
rows = []
for role in ['admin', 'consultant']:
    act = [d for d in users if val(d['fields'].get('role')) == role and val(d['fields'].get('active')) is not False]
    if len(act) != 1:
        print(f'!! {role}: {len(act)} active accounts — skipped'); continue
    uid = act[0]['name'].split('/')[-1]
    uname = (prof.get(role) or {}).get('username') or val(act[0]['fields'].get('username'))
    cur = call('POST', f'{IT}/accounts:lookup', {'localId': [uid]}).get('users', [{}])[0].get('email', '')
    want = f'{BASE}+{CODE}-{slug(uname, role)}@{DOMAIN}'
    rows.append((role, uname, uid, cur, want))

print('\nالدور | اسم المستخدم | البريد الحالي | بريد الاسترجاع')
for role, uname, uid, cur, want in rows:
    print(f'{role} | {uname} | {cur} | {want}')

if not APPLY:
    print('\n(معاينة فقط — للتنفيذ: APPLY=1 python3 functions/recovery_migrate.py)'); sys.exit(0)

for role, uname, uid, cur, want in rows:
    email = want
    if norm(cur) != want:
        try:
            call('POST', f'{IT}/accounts:update', {'localId': uid, 'email': email, 'emailVerified': True})
        except RuntimeError as e:
            if 'EMAIL_EXISTS' not in str(e): raise
            email = want.replace('@', '-' + uid[:4].lower() + '@')
            call('POST', f'{IT}/accounts:update', {'localId': uid, 'email': email, 'emailVerified': True})
    call('PATCH', f'{FS}/login_ids/{key(uname)}', {'fields': {
        'email': {'stringValue': email}, 'role': {'stringValue': role}, 'updatedAt': {'stringValue': now}}})
    print(f'OK {role}: {uname} -> {email}')

call('PATCH', f'{FS}/security/usernames?updateMask.fieldPaths=map&updateMask.fieldPaths=updatedAt',
     {'fields': {'map': {'mapValue': {}}, 'updatedAt': {'stringValue': now}}})
print('OK security/usernames map cleared')
print('== RECOVERY-MIGRATE-DONE')
