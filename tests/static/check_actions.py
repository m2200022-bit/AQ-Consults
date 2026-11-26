"""يتحقق أن كل زر في النظام (data-action) مربوط بإجراء فعلي في ACTIONS، فلا يبقى زر لا يفعل شيئاً."""
import os, re, sys
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
s = open(os.path.join(root, 'index.html'), encoding='utf-8').read()
used = set(re.findall(r'data-action="([a-z0-9-]+)"', s)) | set(re.findall(r"data-action='([a-z0-9-]+)'", s))
start = s.index('const ACTIONS={')
end = s.index('\n};', start)
block = s[start:end]
defined = set(re.findall(r"'([a-z0-9-]+)'\s*:", block)) | set(re.findall(r'\b([a-z0-9]+)\s*:\s*(?:async\s*)?(?:\(|[a-zA-Z_]+\s*[,}]|el\s*=>)', block))
# أزرار تعالجها مستمعات خاصة خارج ACTIONS
handled_elsewhere = set(re.findall(r"dataset\.action\s*===\s*'([a-z0-9-]+)'", s)) | set(re.findall(r"\[data-action=\"([a-z0-9-]+)\"\]", s))
missing = sorted(a for a in used if a not in defined and a not in handled_elsewhere)
print(f'{len(used)} actions used, {len(defined)} defined')
if missing:
    for m in missing: print('FAIL button without handler:', m)
    sys.exit(1)
print('ACTIONS OK')
