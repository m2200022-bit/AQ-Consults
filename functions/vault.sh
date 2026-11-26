#!/usr/bin/env bash
# متى أُعدّ النسخ الخارجي آخر مرة وبأي حساب (دون عرض المفاتيح)
T=$(gcloud auth print-access-token)
curl -s -H "Authorization: Bearer $T" "https://firestore.googleapis.com/v1/projects/aq-consults/databases/(default)/documents/vault/backup" \
 | python3 -c "import sys,json; f=json.load(sys.stdin).get('fields',{}); print('email=',f.get('email',{}).get('stringValue'),'| createdAt=',f.get('createdAt',{}).get('stringValue'),'| keys=',len(f.get('keys',{}).get('arrayValue',{}).get('values',[])),'| appCheck=',bool(f.get('appCheck')))"
echo "== VAULT-DONE"
