#!/usr/bin/env bash
# فحص أن دالة الإشعارات تستقبل أحداث Firestore: ينشئ مستنداً مؤقتاً ثم يحذفه ويعرض السجل
set -u
T=$(gcloud auth print-access-token)
U="https://firestore.googleapis.com/v1/projects/aq-consults/databases/(default)/documents/app_state/zz_probe"
curl -s -o /dev/null -w "create %{http_code}\n" -X PATCH -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
  -d '{"fields":{"value":{"stringValue":"[]"}}}' "$U"
sleep 25
curl -s -o /dev/null -w "delete %{http_code}\n" -X DELETE -H "Authorization: Bearer $T" "$U"
sleep 10
gcloud logging read 'resource.labels.service_name="aq-notify" AND httpRequest.status>0' --limit=5 --freshness=10m \
  --format='table(timestamp.date("%H:%M:%S"),httpRequest.status,httpRequest.requestMethod)'
echo "== PROBE-DONE"
