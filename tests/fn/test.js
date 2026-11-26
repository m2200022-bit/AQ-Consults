process.env.AQ_TEST='1';
const path=require('path').join(__dirname,'..','..','functions')+'/';
const protobuf=require(require.resolve('protobufjs',{paths:[path]}));
const { handle } = require(path+'index.js');
(async()=>{
const root=await protobuf.load(path+'data.proto'); const T=root.lookupType('aq.DocumentEventData');
const mk=(key,arr)=>({ name:'projects/aq-consults/databases/(default)/documents/app_state/'+key, fields:{ value:{ stringValue:JSON.stringify(arr) }, updatedAt:{ integerValue:5 } } });
const ev=(key,b,a)=>({ data: Buffer.from(T.encode(T.fromObject({ oldValue: b&&mk(key,b), value: a&&mk(key,a) })).finish()) });
const users={ uA:{role:'admin'}, uC1:{role:'consultant'}, uC2:{role:'consultant'}, uOff:{role:'consultant', active:false} };
let tokens={ tA:{uid:'uA',role:'admin'}, tC1:{uid:'uC1',role:'consultant'}, tC2:{uid:'uC2',role:'consultant'}, tOff:{uid:'uOff',role:'consultant'}, tDead:{uid:'uC1',role:'consultant'} };
const sentLog=[];
const db={ collection:(n)=>({ get: async()=>({ docs: Object.entries(n==='users'?users:tokens).map(([id,d])=>({ id, data:()=>d, ref:{ delete: async()=>{ delete tokens[id]; } } })) }) }) };
const messaging={ sendEach: async(msgs)=>({ responses: msgs.map(m=>{ sentLog.push(m.token+':'+m.webpush.notification.title+':'+m.webpush.notification.body); return m.token==='tDead'?{success:false,error:{code:'messaging/registration-token-not-registered'}}:{success:true}; }) }) };
const deps={db,messaging};
const base=[{id:'c1',number:101,subject:'زكاة',status:'تحت الإجابة',assignedUid:'uC1'}];
const r=[];
r.push(['new assigned C1', await handle(ev('consultations_v2', base, [...base,{id:'c2',number:102,subject:'صلاة',status:'تحت الإجابة',assignedUid:'uC2'}]), deps)]);
r.push(['answered', await handle(ev('consultations_v2', base, [{...base[0],status:'تمت الإجابة'}]), deps)]);
r.push(['returned', await handle(ev('consultations_v2', [{...base[0],status:'تمت الإجابة'}], base), deps)]);
r.push(['unassigned new', await handle(ev('consultations_v2', base, [...base,{id:'c3',status:'تحت الإجابة'}]), deps)]);
r.push(['assigned to inactive', await handle(ev('consultations_v2', base, [...base,{id:'c4',status:'تحت الإجابة',assignedUid:'uOff'}]), deps)]);
r.push(['msg from admin', await handle(ev('messages_v2', [{id:'m1'}], [{id:'m1'},{id:'m2',from:'admin',fromName:'الإدارة',text:'السلام عليكم'}]), deps)]);
r.push(['bulk restore', await handle(ev('consultations_v2', [], Array.from({length:20},(_, i)=>({id:'x'+i,status:'تحت الإجابة'}))), deps)]);
r.push(['created doc', await handle(ev('consultations_v2', null, base), deps)]);
r.push(['other key', await handle(ev('settings_v1', [], [1]), deps)]);
r.push(['no change', await handle(ev('consultations_v2', base, base), deps)]);
const want={ 'new assigned C1':[1,1], 'answered':[1,1], 'returned':[1,1], 'unassigned new':[1,2], 'assigned to inactive':[1,2], 'msg from admin':[1,2], 'bulk restore':[20,0], 'created doc':[0,0], 'other key':[0,0], 'no change':[0,0] };
let bad=0;
r.forEach(([n,o])=>{ const w=want[n]; const ok=o.events===w[0]&&o.sent===w[1]; if(!ok) bad++; console.log(ok?'PASS':'FAIL', n, JSON.stringify(o)); });
const expSent=['tC2:استشارة جديدة:رقم 102 — صلاة','tA:إجابة جديدة بانتظار الاعتماد:رقم 101 — زكاة','tC1:استشارة أُعيدت إليك:رقم 101 — زكاة'];
expSent.forEach(x=>{ if(!sentLog.includes(x)){ bad++; console.log('FAIL missing send', x); } });
if(sentLog.some(x=>x.startsWith('tOff:'))){ bad++; console.log('FAIL sent to inactive consultant'); }
if('tDead' in tokens){ bad++; console.log('FAIL dead token not removed'); }
console.log(bad?'FUNCTION TESTS FAILED: '+bad:'FUNCTION TESTS OK'); process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
