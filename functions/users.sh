#!/usr/bin/env bash
# حالة حسابات الدخول: الدور والتفعيل والاسم (بلا كلمات مرور)
T=$(gcloud auth print-access-token)
curl -s -H "Authorization: Bearer $T" "https://firestore.googleapis.com/v1/projects/aq-consults/databases/(default)/documents/users?pageSize=100" \
 | python3 -c "import sys,json
for x in json.load(sys.stdin).get('documents',[]):
  f=x['fields']; g=lambda k:list(f.get(k,{'nullValue':None}).values())[0]
  print(x['name'].split('/')[-1][:8], '| role=',g('role'),'| active=',g('active'),'| name=',g('name'))"
echo "== USERS-DONE"
