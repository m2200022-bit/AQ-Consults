#!/usr/bin/env bash
# آخر طلبات دالة الإشعارات خلال ساعة: الوقت، حالة الطلب، الرسالة
gcloud logging read 'resource.labels.service_name="aq-notify"' --limit=15 --freshness=1h \
  --format='table(timestamp.date("%H:%M:%S"),httpRequest.status,severity,textPayload.slice(0:90))'
