#!/usr/bin/env bash
# تشغيل نشر دالة الإشعارات من Cloud Shell
cd ~ && rm -rf aq && git clone -q https://github.com/m2200022-bit/AQ-Consults aq && bash aq/functions/deploy.sh 2>&1 | tee ~/deploy.log
