"""يشغّل اختبارات الواجهة ويقارن كل خطوة بالنتيجة المتوقعة، ويفشل عند أي خطأ في الصفحة."""
import os, re, subprocess, sys
T = os.path.dirname(os.path.abspath(__file__))
ALLOWED = [r'dropped refused ops']   # تحذير متوقع في اختبار رفض الكتابة
def run(script, expect):
    p = subprocess.run([sys.executable, os.path.join(T, script)], capture_output=True, text=True, timeout=900)
    out = p.stdout
    got = {}
    for line in out.splitlines():
        if line.startswith('>> '):
            k, _, v = line[3:].partition(' ')
            got[k] = v
    bad = []
    for line in open(os.path.join(T, expect), encoding='utf-8'):
        line = line.rstrip('\n')
        if not line or line.startswith('#'): continue
        k, rx = line.split('\t', 1)
        if k not in got: bad.append(f'{k}: missing'); continue
        if not re.search(rx, got[k]): bad.append(f'{k}: got «{got[k][:160]}»')
    tail = out.split('>> ')[-1].splitlines()[1:]
    errs = [l for l in tail if (l.startswith('CONSOLE') or l.startswith('PAGEERROR')) and not any(re.search(a, l) for a in ALLOWED)]
    if 'Traceback' in (p.stderr or '') or 'Traceback' in out: bad.append('exception:\n' + (p.stderr or out)[-2000:])
    bad += ['page error: ' + e[:300] for e in errs]
    print(f'== {script}: {len(got)} steps, {len(bad)} problems')
    for b in bad: print('  FAIL', b)
    return not bad
ok = run('run.py', 'expect_main.txt') & run('run_legacy.py', 'expect_legacy.txt')
print('UI TESTS OK' if ok else 'UI TESTS FAILED')
sys.exit(0 if ok else 1)
