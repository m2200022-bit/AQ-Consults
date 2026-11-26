#!/usr/bin/env bash
# عدد الأجهزة المسجّلة للإشعارات لكل دور (دون عرض الرموز نفسها)
T=$(gcloud auth print-access-token)
curl -s -H "Authorization: Bearer $T" "https://firestore.googleapis.com/v1/projects/aq-consults/databases/(default)/documents/push_tokens?pageSize=300" \
 | python3 -c "import sys,json; d=json.load(sys.stdin).get('documents',[]); r={}
for x in d:
  f=x['fields']; k=f['role']['stringValue']; r.setdefault(k,[]).append(f.get('device',{}).get('stringValue','')+' @ '+f.get('ts',{}).get('stringValue','')[:16])
print('devices:',len(d))
for k,v in r.items(): print(k, len(v)); [print('   ',i) for i in v]"
echo "== DEVICES-DONE"
