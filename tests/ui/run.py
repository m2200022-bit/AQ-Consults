import json, sys, threading, http.server, functools, os, time
from playwright.sync_api import sync_playwright
ROOT=os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..')); T=os.path.dirname(os.path.abspath(__file__)); OUT=os.environ.get('AQ_SHOTS', T+'/shots'); os.makedirs(OUT, exist_ok=True)
H=functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
class Q(http.server.ThreadingHTTPServer): pass
srv=Q(('127.0.0.1',8765), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
mock=open(T+'/mock-fb.js').read(); lucide=open(T+'/lucide.js').read()
now=time.time()
def iso(h): return time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime(now-h*3600))
legacy=[
 {"id":"c_old","number":"2570001","date":"2026-07-01","askerName":"قديم","subject":"علاج الوسواس في الطهارة قديماً","question":"وسواس","priority":"عادي","status":"مؤرشفة","answer":"<p>الإعراض عن الوسواس علاجه</p>","createdAt":iso(2600),"assignedAt":iso(2600),"answeredAt":iso(2550),"archivedAt":iso(2500),"history":[]},
 {"id":"c_a1","number":"2578001","date":"2026-10-25","askerName":"أحمد","askerCountry":"اليمن","askerGender":"ذكر","askerAge":"30","askerMarital":"متزوج","subject":"الوسواس في الطهارة والصلاة","question":"أعاني من وسواس شديد في الطهارة والوضوء وأعيد الصلاة مرات كثيرة","priority":"عادي","status":"تحت الإجابة","assignedTo":["د. عقيل محمد المقطري"],"createdAt":iso(50),"assignedAt":iso(50),"history":[{"ts":iso(50),"actor":"الإدارة","action":"تم إنشاء الاستشارة"}],"notesThread":[{"id":"n1","from":"admin","text":"يرجى الاهتمام","ts":iso(49)}]},
 {"id":"c_a2","number":"2578002","date":"2026-10-30","askerName":"فاطمة","askerCountry":"مصر","askerGender":"أنثى","askerAge":"25","subject":"خلافات مع الزوج","question":"زوجي كثير الغضب","priority":"مستعجل","status":"تحت الإجابة","createdAt":iso(5),"assignedAt":iso(5),"history":[]},
 {"id":"c_a3","number":"2578003","date":"2026-10-20","askerName":"خالد","subject":"الوسواس القهري في الصلاة","question":"وسواس في الصلاة والطهارة يتعبني","priority":"عادي","status":"مؤرشفة","answer":"<p>بسم الله الرحمن الرحيم</p><p>علاج الوسواس بالإعراض عنه <script>alert(1)</script><img src=x onerror=alert(2)></p>","createdAt":iso(300),"assignedAt":iso(300),"answeredAt":iso(280),"archivedAt":iso(270),"history":[]},
 {"id":"c_a4","number":"2578004","date":"2026-10-28","askerName":"سارة","subject":"تربية الأبناء","question":"كيف أربي ابني","priority":"عادي","status":"تمت الإجابة","answer":"<p>أوصيك بالرفق</p>","createdAt":iso(100),"assignedAt":iso(100),"answeredAt":iso(20),"history":[]},
 {"id":"c_a5","number":"2578005","date":"2026-10-24","askerName":"عمر","subject":"قديمة جداً","question":"سؤال","priority":"عادي","status":"تحت الإجابة","createdAt":iso(120),"assignedAt":iso(120),"history":[]},
]
seed={"docs":{
 "app_state/consultations_v2":{"value":json.dumps(legacy, ensure_ascii=False)},
 "app_state/messages_v2":{"value":json.dumps([{"id":"m1","from":"admin","text":"مرحباً دكتور، الاستشارة رقم 2578001 مهمة","ts":iso(40)}], ensure_ascii=False)},
 "app_state/audit_v2":{"value":json.dumps([{"ts":iso(30),"actor":"د. عقيل محمد المقطري","action":"تسجيل دخول المستشار","device":"x"}], ensure_ascii=False)},
 "app_state/profiles_v2":{"value":json.dumps({"admin":{"name":"الإدارة","username":"admin","password":"adm1n"},"consultant":{"name":"د. عقيل محمد المقطري","username":"aqeel","password":"aqeel123"}}, ensure_ascii=False)},
 "app_state/branding_v1":{"value":json.dumps({"logoUrl":""})},
 "app_state/suggestions_v1":{"value":json.dumps(["اقتراح قديم"], ensure_ascii=False)},
}}
errors=[]
def shot(page, name, full=True):
    page.wait_for_timeout(350); page.screenshot(path=f'{OUT}/{name}.png', full_page=full)
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':1366,'height':860}, locale='ar', permissions=['notifications'])
    ctx.add_init_script("if(navigator.serviceWorker){ navigator.serviceWorker.register=async()=>({ fake:true }); } try{ Object.defineProperty(Notification,'permission',{get:()=>'granted'}); }catch(e){}")
    ctx.add_init_script("window.__seed="+json.dumps(seed, ensure_ascii=False)+";")
    def route(r):
        u=r.request.url
        if 'firebasejs' in u: return r.fulfill(status=200, content_type='application/javascript', body=mock)
        if 'lucide' in u: return r.fulfill(status=200, content_type='application/javascript', body=lucide)
        if 'api.github.com/repos/' in u:
            enc=open(T+'/ext/out/2026-11-26.json.enc').read()
            return r.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin':'*'}, body=json.dumps([{'name':'2026-11-26.json.enc','size':len(enc),'download_url':'https://raw.githubusercontent.com/test/enc'}]))
        if 'raw.githubusercontent.com/test/enc' in u:
            return r.fulfill(status=200, content_type='text/plain', headers={'access-control-allow-origin':'*'}, body=open(T+'/ext/out/2026-11-26.json.enc').read())
        if 'api.alquran.cloud' in u:
            import re as _re
            m=_re.search(r'surah/(\d+)/quran-simple\?offset=(\d+)&limit=(\d+)', u); s_,o,l=int(m.group(1)),int(m.group(2)),int(m.group(3))
            ay=[{'numberInSurah':o+i+1,'text':('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ' if o+i==0 and s_ not in (1,9) else '')+'نص الآية رقم '+str(o+i+1)} for i in range(l)]
            return r.fulfill(status=200, content_type='application/json', body=json.dumps({'code':200,'data':{'ayahs':ay}}, ensure_ascii=False))
        if 'fonts.g' in u or 'cdnjs' in u: return r.fulfill(status=200, content_type='text/css', body='')
        return r.continue_()
    ctx.route('**/*', route)
    ctx.add_init_script("""(()=>{
      const S=sessionStorage, J=(k,d)=>{ try{ return JSON.parse(S.getItem(k))??d; }catch(e){ return d; } };
      const files=()=>J('__lbFiles',{}), save=f=>S.setItem('__lbFiles',JSON.stringify(f));
      const mkDir=()=>({ name:'نسخي', kind:'directory',
        queryPermission: async()=> S.getItem('__lbPerm')||'granted',
        requestPermission: async()=>{ S.setItem('__lbPerm','granted'); return 'granted'; },
        getFileHandle: async(n)=>({ createWritable: async()=>{ let buf=''; return { write: async(d)=>{ buf+=d; }, close: async()=>{ const f=files(); f[n]=buf.length; save(f); S.setItem('__lbWrites', String(+(S.getItem('__lbWrites')||0)+1)); S.setItem('__lbLast', buf.slice(0,4000000)); } }; } }),
        entries: async function*(){ for(const n of Object.keys(files())) yield [n,{kind:'file'}]; },
        removeEntry: async(n)=>{ const f=files(); delete f[n]; save(f); } });
      window.showDirectoryPicker=async()=>{ S.setItem('__lbHas','1'); return mkDir(); };
      window.__lbTestDir = S.getItem('__lbHas') ? mkDir() : null;
    })();""")
    page=ctx.new_page()
    page.on('pageerror', lambda e: errors.append('PAGEERROR '+str(e)))
    page.on('console', lambda m: errors.append('CONSOLE '+m.type+': '+m.text) if m.type in ('error','warning') else None)
    try:
        exec(open(T+'/steps.py').read())
        exec(open(T+'/steps_ext.py').read())
    except Exception as ex:
        import traceback; traceback.print_exc()
    b.close()
srv.shutdown()
print('\n'.join(errors) if errors else 'NO ERRORS')
