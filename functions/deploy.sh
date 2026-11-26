#!/usr/bin/env bash
# نشر دالة الإشعارات لنظام الاستشارات — يُشغَّل مرة واحدة من Google Cloud Shell:
#   git clone -q https://github.com/m2200022-bit/AQ-Consults aq && bash aq/functions/deploy.sh
set -euo pipefail
P=aq-consults
SRC="$(cd "$(dirname "$0")" && pwd)"
gcloud config set project "$P" >/dev/null

echo "== تفعيل الخدمات اللازمة"
gcloud services enable cloudfunctions.googleapis.com cloudbuild.googleapis.com run.googleapis.com \
  eventarc.googleapis.com artifactregistry.googleapis.com pubsub.googleapis.com fcm.googleapis.com

LOC=$(gcloud firestore databases describe --database='(default)' --format='value(locationId)')
case "$LOC" in nam5) REG=us-central1 ;; eur3) REG=europe-west1 ;; *) REG="$LOC" ;; esac
PN=$(gcloud projects describe "$P" --format='value(projectNumber)')
SA="$PN-compute@developer.gserviceaccount.com"
echo "== موقع قاعدة البيانات: $LOC  — منطقة الدالة: $REG"

echo "== منح الصلاحيات لحساب الخدمة"
for R in roles/eventarc.eventReceiver roles/run.invoker roles/datastore.user \
         roles/firebasecloudmessaging.admin roles/cloudbuild.builds.builder roles/logging.logWriter \
         roles/artifactregistry.writer; do
  gcloud projects add-iam-policy-binding "$P" --member="serviceAccount:$SA" --role="$R" --condition=None --quiet >/dev/null
done
# وكيل Pub/Sub يحتاج إنشاء رموز الهوية لتوصيل أحداث Eventarc
gcloud projects add-iam-policy-binding "$P" --member="serviceAccount:service-$PN@gcp-sa-pubsub.iam.gserviceaccount.com" \
  --role=roles/iam.serviceAccountTokenCreator --condition=None --quiet >/dev/null || true

echo "== نشر الدالة (قد يستغرق 3-5 دقائق)"
gcloud functions deploy aq-notify --gen2 --runtime=nodejs20 --region="$REG" --source="$SRC" --entry-point=notify \
  --trigger-event-filters=type=google.cloud.firestore.document.v1.written \
  --trigger-event-filters=database='(default)' \
  --trigger-event-filters-path-pattern=document='app_state/{key}' \
  --trigger-location="$LOC" --trigger-service-account="$SA" --service-account="$SA" \
  --memory=256Mi --max-instances=3 --quiet

echo "== AQ-NOTIFY-DEPLOYED-OK"
