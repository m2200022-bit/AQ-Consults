// يولّد مشروع تطبيق أندرويد (Trusted Web Activity) من ملف manifest الخاص بالنظام.
// التطبيق يفتح الموقع نفسه داخل Chrome بملء الشاشة: نفس البيانات ونفس الدخول ونفس الإشعارات.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import bw from '@bubblewrap/core';
const { TwaManifest, TwaGenerator, ConsoleLog } = bw;

const here = dirname(fileURLToPath(import.meta.url));
const SITE = 'https://m2200022-bit.github.io/AQ-Consults/';
const out = process.argv[2] || join(here, 'build', 'project');
const web = JSON.parse(readFileSync(join(here, '..', 'manifest.webmanifest'), 'utf8'));
const cfg = JSON.parse(readFileSync(join(here, 'app.json'), 'utf8'));

const m = TwaManifest.fromWebManifestJson(new URL('manifest.webmanifest', SITE), web);
m.packageId = cfg.packageId;
m.host = 'm2200022-bit.github.io';
m.startUrl = '/AQ-Consults/';
m.fullScopeUrl = new URL(SITE);
m.name = web.name;
m.launcherName = web.short_name;
m.appVersionCode = Number(process.env.VERSION_CODE || cfg.versionCode);
m.appVersionName = process.env.VERSION_NAME || cfg.versionName;
m.enableNotifications = true;
m.fallbackType = 'customtabs';
const ICONS = process.env.ICON_BASE || SITE;
m.iconUrl = ICONS + 'icon-512.png';
m.maskableIconUrl = ICONS + 'icon-maskable-512.png';
m.webManifestUrl = new URL('manifest.webmanifest', ICONS);
m.signingKey = { path: process.env.KEYSTORE_PATH || join(here, 'build', 'upload.jks'), alias: cfg.keyAlias };
m.minSdkVersion = 24;   // أندرويد 7 فما فوق (متطلب مكتبة androidbrowserhelper)
m.generatorApp = 'aq-consults';

await new TwaGenerator().createTwaProject(out, m, new ConsoleLog('twa'));
writeFileSync(join(out, 'twa-manifest.json'), JSON.stringify(m.toJson(), null, 2));
console.log('TWA project generated at', out);
