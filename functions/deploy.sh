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
# إنشاء وكلاء الخدمة (Eventarc وPub/Sub) ومنحهم أدوارهم
gcloud beta services identity create --service=eventarc.googleapis.com --quiet >/dev/null 2>&1 || true
gcloud beta services identity create --service=pubsub.googleapis.com --quiet >/dev/null 2>&1 || true
gcloud projects add-iam-policy-binding "$P" --member="serviceAccount:service-$PN@gcp-sa-eventarc.iam.gserviceaccount.com" \
  --role=roles/eventarc.serviceAgent --condition=None --quiet >/dev/null || true
# وكيل Pub/Sub يحتاج إنشاء رموز الهوية لتوصيل أحداث Eventarc
gcloud projects add-iam-policy-binding "$P" --member="serviceAccount:service-$PN@gcp-sa-pubsub.iam.gserviceaccount.com" \
  --role=roles/iam.serviceAccountTokenCreator --condition=None --quiet >/dev/null || true

echo "== نشر الدالة (قد يستغرق 3-5 دقائق)"
for i in 1 2 3 4; do
gcloud functions deploy aq-notify --gen2 --runtime=nodejs22 --region="$REG" --source="$SRC" --entry-point=notify \
  --trigger-event-filters=type=google.cloud.firestore.document.v1.written \
  --trigger-event-filters=database='(default)' \
  --trigger-event-filters-path-pattern=document='app_state/{key}' \
  --trigger-location="$LOC" --trigger-service-account="$SA" --service-account="$SA" \
  --memory=256Mi --max-instances=3 --quiet && break
  echo "== إعادة المحاولة بعد دقيقة (انتظار تفعيل الصلاحيات)"; sleep 60
done
gcloud functions describe aq-notify --gen2 --region="$REG" --format="value(state)"

echo "== AQ-NOTIFY-DEPLOYED-OK"
