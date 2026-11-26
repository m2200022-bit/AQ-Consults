#!/usr/bin/env bash
# تشخيص الإشعارات: الخدمات المفعّلة وقيود مفتاح المتصفح
echo "== services"
gcloud services list --enabled --format='value(config.name)' | grep -E 'fcm|firebaseinstallations|fcmregistrations|identitytoolkit|firestore' 
echo "== api keys"
for K in $(gcloud services api-keys list --format='value(name)'); do
  gcloud services api-keys describe "$K" --format='yaml(displayName,restrictions)'
  echo "---"
done
echo "== DIAG-DONE"
