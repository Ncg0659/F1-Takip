# prediction_engine_v1_test — prediction-engine.js (+ prediction-data.js entegrasyonu). Sentetik veri, ağ yok.
import json,subprocess,sys,re
S=[]
def k(a,ok,ek=""):
    S.append(bool(ok)); print(("PASS " if ok else "FAIL ")+a+((" | "+str(ek)[:300]) if not ok else ""),flush=True)
src=open("/home/claude/f1-takip/testler/prediction_data_v1_test.py").read()
pre=re.search(r"JS=r'''(.*?)\(async\(\)=>\{",src,re.S).group(1)   # Jolpica/telemetri/hava taklidi
JS=pre+r'''
const E=require("/home/claude/f1-takip/prediction-engine.js");
// ---- sentetik 20 pilot ----
function F(i,mod,o){ o=o||{}; const d="d"+String(i).padStart(2,"0"), t="t"+Math.floor((i-1)/2);
  const posF=o.recent!==undefined?o.recent:1+(i-1)*0.9, posQ=o.qual!==undefined?o.qual:1+(i-1)*0.9, gr=o.grid!==undefined?o.grid:i;
  const f={durum:"ok",season:2026,round:o.round||10,driver:d,team:t,mode:mod,track:{circuitId:"c1"},
   recentForm:o.noRecent?null:{n:o.nForm||5,degerler:[],ortalama:posF,agirlikliOrtalama:posF,sezonPuani:o.puan!==undefined?o.puan:Math.max(0,250-i*12),son5Puan:Math.max(0,125-i*6)},
   qualifyingForm:o.noQual?null:{n:5,ortalama:posQ,agirlikliOrtalama:posQ,buHaftaQualifying:mod==="POST_QUALIFYING"?gr:undefined},
   gridFinishDelta:{n:20,buHaftaGrid:mod==="POST_QUALIFYING"?gr:undefined},
   reliability:o.noRel?null:{n:30,dnf:o.dnf||0,agirlikliDnfOrani:o.dnfR!==undefined?o.dnfR:0.03},
   teammateDelta:o.noTm?null:{yarisFinishDelta:i%2?1.5:-1.5,qualifyingDelta:0},
   trackHistory:o.noTh?null:{circuitId:"c1",pilot:{n:5,agirlikliFinish:o.th!==undefined?o.th:posF},takim:null},
   teamForm:o.noTeam?null:{constructorId:t,constructorSirasi:Math.ceil(i/2),son5Puan:{n:5,seri:[],toplam:Math.max(0,250-i*10),egim:o.teamEgim||0}},
   telemetrySummary:o.noTel?null:{speed:{ortalama:200+(20-i)}},
   weatherContext:o.wet?{kosul:"wet"}:(o.noWx?null:{kosul:"dry"}),contextSignals:o.ctx||[],meta:{eksikSezonlar:o.eksik||[]}};
  return f; }
const field=(mod,fn)=>Array.from({length:20},(_,j)=>F(j+1,mod,fn?fn(j+1):{}));
const sum=(a,k)=>a.reduce((x,y)=>x+y[k],0);
(async()=>{ const R={};
 const pre=E.racePredict(field("PRE_WEEKEND")), post=E.racePredict(field("POST_QUALIFYING"));
 R.ok=pre.durum==="ok"&&post.durum==="ok"&&pre.suruculer.length===20;
 R.winSum=Math.abs(sum(pre.suruculer,"winProbability")-1)<0.01&&Math.abs(sum(post.suruculer,"winProbability")-1)<0.01;
 const all=[...pre.suruculer,...post.suruculer];
 R.range=all.every(s=>["winProbability","podiumProbability","pointsProbability","confidence"].every(k=>s[k]>=0&&s[k]<=1));
 R.order=all.every(s=>s.winProbability<=s.podiumProbability&&s.podiumProbability<=s.pointsProbability);
 R.podSum=Math.abs(sum(pre.suruculer,"podiumProbability")-3)<0.05&&Math.abs(sum(pre.suruculer,"pointsProbability")-10)<0.05;
 R.sorted=pre.suruculer[0].driver==="d01"&&pre.suruculer[0].winProbability>pre.suruculer[19].winProbability;
 // PRE vs POST: grid etkisi
 const kotuGrid=E.racePredict(field("POST_QUALIFYING",i=>({grid:i===1?20:i}))); const w=(r,d)=>r.suruculer.find(s=>s.driver===d).winProbability;
 R.gridEtki=w(kotuGrid,"d01")<w(post,"d01")*0.5&&post.mode==="POST_QUALIFYING"&&pre.mode==="PRE_WEEKEND";
 R.preGridYok=pre.suruculer.every(s=>s.faktorSkorlari.grid===null)&&post.suruculer.every(s=>s.faktorSkorlari.grid!==null);
 R.modFark=JSON.stringify(pre.meta.agirliklar)!==JSON.stringify(post.meta.agirliklar)&&pre.meta.agirliklar.grid===0&&post.meta.agirliklar.grid>0;
 const ws=m=>Object.keys(E.AGIRLIK[m]).reduce((a,k)=>a+(typeof E.AGIRLIK[m][k]==="number"?E.AGIRLIK[m][k]:0),0);
 R.wTek=Math.abs(ws("PRE_WEEKEND")-1)<1e-9&&Math.abs(ws("POST_QUALIFYING")-1)<1e-9;
 // confidence
 const tam=E.racePredict(field("PRE_WEEKEND")).suruculer[0].confidence;
 const eksik=E.racePredict(field("PRE_WEEKEND",i=>i===1?{noRecent:true,noQual:true,noTh:true,noTel:true,noTeam:true}:{})).suruculer.find(s=>s.driver==="d01");
 R.confDus=eksik.confidence<tam-0.3&&eksik.kapsamSeviyesi==="LOW"&&tam>=0.75&&E.racePredict(field("PRE_WEEKEND")).suruculer[0].kapsamSeviyesi==="HIGH";
 const kisa=E.racePredict(field("PRE_WEEKEND",i=>({nForm:2}))).suruculer[0].confidence; R.confKisa=kisa<tam;
 const eksSez=E.racePredict(field("PRE_WEEKEND",i=>({eksik:[2024]}))).suruculer[0].confidence; R.confSezon=eksSez<tam;
 const postHavaYok=E.racePredict(field("POST_QUALIFYING",i=>({noWx:true}))).suruculer[0].confidence, postHava=post.suruculer.find(s=>s.driver==="d01").confidence; R.confHava=postHavaYok<postHava;
 // yüksek tahmin ≠ yüksek güven: lider olsa da veri azsa LOW
 const zayif=E.racePredict(field("PRE_WEEKEND",i=>({noQual:true,noTh:true,noTel:true,noTeam:true,noRel:true,noTm:true})));
 R.yuksekTahminDusukGuven=zayif.suruculer[0].winProbability>0.1&&zayif.suruculer[0].kapsamSeviyesi==="LOW";
 R.seviyeler=["HIGH","MEDIUM","LOW"].every(x=>[...all,...zayif.suruculer].some(s=>s.kapsamSeviyesi===x)||x==="MEDIUM"); 
 // reasons
 R.rMax=all.every(s=>s.reasons.length<=5);
 const r1=pre.suruculer.find(s=>s.driver==="d01"), r20=pre.suruculer.find(s=>s.driver==="d20");
 R.rFeature=r1.reasons.length>0&&r1.reasons.every(x=>x.faktor&&x.metin&&["+","-"].includes(x.yon))&&r1.reasons.some(x=>x.faktor==="recentForm"&&x.yon==="+")&&r20.reasons.some(x=>x.faktor==="recentForm"&&x.yon==="-");
 const noFormR=E.racePredict(field("PRE_WEEKEND",i=>i===1?{noRecent:true,noQual:true}:{})).suruculer.find(s=>s.driver==="d01"); R.rYokVeriYok=!noFormR.reasons.some(x=>x.faktor==="recentForm"||x.faktor==="qualifyingForm");
 const rel=E.racePredict(field("PRE_WEEKEND",i=>i===5?{dnfR:0.3}:{})).suruculer.find(s=>s.driver==="d05"); R.rRel=rel.reasons.some(x=>x.faktor==="reliability"&&x.yon==="-"&&/Reliability/.test(x.metin));
 const tr=E.racePredict(field("PRE_WEEKEND",i=>i===5?{teamEgim:8}:{})).suruculer.find(s=>s.driver==="d05"); R.rTrend=tr.reasons.some(x=>x.faktor==="teamTrend"&&/yükselişte/.test(x.metin));
 R.rBilgi=E.explain(r1).nedenler.length===r1.reasons.length&&/olasılık/i.test(E.explain(r1).ozet);
 // guardrail
 const metin=JSON.stringify([pre,post,zayif,E.explain(r1),E.explain(eksik)]); R.guard=!E.YASAK.test(metin);
 // contextSignals ağırlığı 0
 const ctxA=E.racePredict(field("PRE_WEEKEND")), ctxB=E.racePredict(field("PRE_WEEKEND",i=>({ctx:[{tip:"haber",deger:9,metin:"kesin"}]}))); R.ctx0=JSON.stringify(ctxA)===JSON.stringify(ctxB)&&E.AGIRLIK.contextSignals===0;
 // deterministik + girdi sırası bağımsız
 const a1=JSON.stringify(E.racePredict(field("POST_QUALIFYING"))), a2=JSON.stringify(E.racePredict(field("POST_QUALIFYING"))), a3=JSON.stringify(E.racePredict(field("POST_QUALIFYING").reverse())); R.det=a1===a2&&a1===a3;
 // yanlış driver karışmıyor
 const base=E.racePredict(field("PRE_WEEKEND")), degis=E.racePredict(field("PRE_WEEKEND",i=>i===7?{recent:19,qual:19,th:19}:{}));
 const gb=(r,d)=>r.suruculer.find(s=>s.driver===d);
 R.karismaz=gb(degis,"d07").skor<gb(base,"d07").skor&&["d01","d02","d08","d15"].every(d=>gb(degis,d).skor===gb(base,d).skor&&JSON.stringify(gb(degis,d).faktorSkorlari)===JSON.stringify(gb(base,d).faktorSkorlari))&&gb(degis,"d07").team==="t3";
 const dup=field("PRE_WEEKEND"); dup.push(F(3,"PRE_WEEKEND",{recent:20})); const dr=E.racePredict(dup); R.dup=dr.suruculer.length===20&&dr.meta.tekrar.join()==="d03"&&gb(dr,"d03").skor===gb(base,"d03").skor;
 R.karisikGirdi=E.racePredict([F(1,"PRE_WEEKEND"),F(2,"POST_QUALIFYING")]).durum==="gecersiz"&&E.racePredict([F(1,"PRE_WEEKEND"),F(2,"PRE_WEEKEND",{round:11})]).durum==="gecersiz"&&E.racePredict([]).durum==="bos"&&E.racePredict(null).durum==="gecersiz"&&E.racePredict([{durum:"hata"}]).durum==="bos";
 R.tekPilot=(()=>{const r=E.racePredict([F(1,"PRE_WEEKEND")]);return r.durum==="ok"&&r.suruculer[0].winProbability===1&&r.suruculer[0].podiumProbability===1;})();
 R.nanYok=!/NaN|Infinity|null"?:\s*undefined/.test(metin)&&all.every(s=>Number.isFinite(s.winProbability));
 const wet=E.racePredict(field("PRE_WEEKEND",i=>({wet:true}))); R.islak=wet.suruculer[0].winProbability<pre.suruculer[0].winProbability&&wet.meta.yagmurCarpani>1;
 // ---- ŞAMPİYONLUK ----
 const ch=(fn,R_,top,spr)=>E.championshipPredict(field("PRE_WEEKEND",i=>Object.assign({round:R_},fn?fn(i):{})),{toplamYaris:top,kalanSprint:spr});
 const c1=ch(null,10,24); const cp=c1.suruculer;
 R.chToplam=c1.durum==="ok"&&Math.abs(cp.reduce((a,s)=>a+s.championshipProbability,0)-1)<0.01&&cp.every(s=>s.championshipProbability>=0&&s.championshipProbability<=1)&&c1.kalanYaris===15;
 // d01 puan 238, kalan 15*25=375 → herkes canlı. Son yarışlara yakın: elenme
 const c2=ch(i=>({puan:i===1?300:(i===2?270:Math.max(0,250-i*12))}),22,24); // kalan 3 → 75; lider 300: d02 270+75=345 canlı; d03 214+75<300 elendi
 const g2=d=>c2.suruculer.find(s=>s.driver===d);
 R.elendi0=g2("d03").championshipProbability===0&&g2("d03").elendi===true&&g2("d20").championshipProbability===0&&g2("d01").championshipProbability>0&&g2("d02").championshipProbability>0;
 R.elendiYuz=Math.abs(g2("d01").championshipProbability+g2("d02").championshipProbability-1)<0.01;
 R.garantiDegil1Yok=g2("d01").championshipProbability<1&&g2("d01").championshipProbability<=0.99&&g2("d01").meta===undefined;
 const c3=ch(i=>({puan:i===1?400:Math.max(0,250-i*12)}),22,24); // d01 400 > diğer max (238+75)=... d02: 226+75=301 <400 → belli
 R.belli=c3.meta.sampiyonlukBelli===true&&c3.suruculer.find(s=>s.driver==="d01").championshipProbability===1&&c3.suruculer.filter(s=>s.championshipProbability>0).length===1;
 const c4=ch(i=>({puan:i===1?300:(i===2?299:100)}),10,24); R.yakin=c4.suruculer[0].championshipProbability<1&&c4.suruculer[0].championshipProbability>0.3&&c4.suruculer[1].championshipProbability>0.1;
 const c5=ch(i=>({puan:i<=2?100:50}),24,24); // kalan 1 → max 25; 100 vs 100: berabere ikisi canlı; diğerleri 75<100 elendi
 R.esitPuan=c5.suruculer.filter(s=>s.championshipProbability>0).length===2&&c5.suruculer.every(s=>s.championshipProbability<=0.99);
 const c6=ch(i=>({puan:i===1?100:(i===2?75:0)}),24,24); R.tamSinir=c6.suruculer.find(s=>s.driver==="d02").elendi===false; // 75+25=100 → elenmedi (eşitlik mümkün)
 const c7=ch(i=>({puan:i===1?100:(i===2?74:0)}),24,24); R.tamSinir2=c7.suruculer.find(s=>s.driver==="d02").elendi===true;
 const sp1=ch(i=>({puan:i===1?100:(i===2?70:0)}),24,24,1); R.sprintMax=sp1.suruculer.find(s=>s.driver==="d02").elendi===false&&sp1.maxKalanPuan===33;
 R.chToplamYok=E.championshipPredict(field("PRE_WEEKEND"),{}).durum==="kisit";
 R.chPuanYok=ch(i=>i===4?{puan:null}:{},10,24).suruculer.find(s=>s.driver==="d04").championshipProbability===null;
 R.chEkr=E.championshipPredict(field("PRE_WEEKEND",i=>({round:1,puan:null})),{toplamYaris:24}).suruculer.every(s=>s.puan===0);
 const cf=ch(i=>i===3?{puan:238-12*2,recent:1,dnfR:0.4}:{},10,24); 
 const cdet=JSON.stringify(ch(null,10,24))===JSON.stringify(ch(null,10,24)); R.chDet=cdet;
 R.chReasons=cp.every(s=>s.reasons.length>0&&s.reasons.length<=5)&&!E.YASAK.test(JSON.stringify([c1,c2,c3,c4,c5,E.explain(cp[0])]))&&c2.suruculer.find(s=>s.driver==="d03").reasons[0].metin.includes("Matematiksel");
 R.chConf=ch(null,3,24).suruculer[0].confidence<ch(null,20,24).suruculer[0].confidence;
 R.chContext=JSON.stringify(ch(null,10,24))===JSON.stringify(E.championshipPredict(field("PRE_WEEKEND",i=>({round:10,ctx:[{x:1}]})),{toplamYaris:24}));
 // ---- ENTEGRASYON (prediction-data) ----
 const D=require("/home/claude/f1-takip/prediction-data.js");
 const mkD=()=>D.kur({jolpica,telemetri:tele,hava,pistler,siniflandirma:sinif,gecmisHava:false});
 async function alan(mod,R_){ const s=mkD(); const out=[]; for(const [d] of SUR){ out.push(await s.ozellik({season:2026,round:R_,driver:d,mode:mod})); } return out; }
 const iPre=E.racePredict(await alan("PRE_WEEKEND",6)), iPost=E.racePredict(await alan("POST_QUALIFYING",6));
 R.intOk=iPre.durum==="ok"&&iPost.durum==="ok"&&iPre.suruculer.length===6&&iPre.suruculer.every(s=>s.winProbability<=s.podiumProbability&&s.podiumProbability<=s.pointsProbability);
 R.intPostFark=JSON.stringify(iPre.suruculer.map(s=>[s.driver,s.winProbability]))!==JSON.stringify(iPost.suruculer.map(s=>[s.driver,s.winProbability]));
 // LEAKAGE: hedef yarış (6) ve sonrasının SONUÇLARI değişse tahmin aynı kalmalı
 const orijRes=res; res=function(y,r){ const a=orijRes(y,r); if(y===2026&&r>=6){ return a.slice().reverse().map((x,i)=>Object.assign({},x,{position:String(i+1),positionText:String(i+1),grid:String(7-i),points:"77",status:"Finished"})); } return a; };
 const jPre=E.racePredict(await alan("PRE_WEEKEND",6)), jPost=E.racePredict(await alan("POST_QUALIFYING",6)); res=orijRes;
 R.leakPre=JSON.stringify(iPre)===JSON.stringify(jPre); R.leakPost=JSON.stringify(iPost)===JSON.stringify(jPost);
 const iCh=E.championshipPredict(await alan("PRE_WEEKEND",6),{toplamYaris:10}); res=function(y,r){ return orijRes(y,r).slice().reverse(); };
 res=orijRes; R.intCh=iCh.durum==="ok"&&iCh.kalanYaris===5&&Math.abs(iCh.suruculer.reduce((a,s)=>a+(s.championshipProbability||0),0)-1)<0.01;
 R.intDriver=iPre.suruculer.every(s=>s.team===SUR.find(x=>x[0]===s.driver)[2]);
 console.log(JSON.stringify(R)); })();
'''
out=subprocess.run(["node","-e",JS],capture_output=True,text=True)
if out.returncode: print(out.stderr[:2000]); sys.exit(1)
R=json.loads(out.stdout.strip().splitlines()[-1])
M={"ok":"PRE ve POST üretildi (20 pilot)","winSum":"win toplamı ≈ 1","range":"tüm olasılıklar 0–1","order":"win ≤ podium ≤ points","podSum":"podium≈3, points≈10 toplamı","sorted":"güçlü pilot önde","gridEtki":"grid dahil olunca POST değişiyor (kötü grid → win düşer)","preGridYok":"PRE'de grid faktörü yok, POST'ta var","modFark":"PRE/POST ağırlık setleri farklı","wTek":"ağırlıklar tek yerde, toplam 1","confDus":"veri eksikse confidence düşüyor (LOW), tam veride HIGH","confKisa":"kısa form geçmişi güveni düşürür","confSezon":"eksik sezon güveni düşürür","confHava":"POST'ta hava yoksa güven düşer","yuksekTahminDusukGuven":"yüksek tahmin ≠ yüksek güven","rMax":"reasons ≤ 5","rFeature":"reasons feature'a bağlı (faktör+yön)","rYokVeriYok":"verisi olmayan faktör için neden yok","rRel":"reliability riski nedeni","rTrend":"takım yükseliş nedeni","rBilgi":"explain() nedenlerle tutarlı","guard":"yasak kesinlik dili yok","ctx0":"contextSignals ağırlığı 0 (çıktı değişmez)","det":"deterministik + girdi sırasından bağımsız","karismaz":"yanlış driver karışmıyor","dup":"tekrarlı driver yok sayılır","karisikGirdi":"karışık sezon/round/mod ve boş girdi güvenli","tekPilot":"tek pilot sınır durumu","nanYok":"NaN/Infinity yok","islak":"ıslak yarış dağılımı daha düz","chToplam":"şampiyonluk toplamı ≈1, 0–1","elendi0":"matematiksel elenmiş = 0","elendiYuz":"canlı adaylar toplamı ≈ 1","garantiDegil1Yok":"garanti değilse 1 verilmez","belli":"matematiksel olarak belliyse 1","yakin":"yakın yarışta ikisi de makul","esitPuan":"eşit puanda ikisi canlı, ≤0.99","tamSinir":"sınırda eşit ulaşılabilir → elenmez","tamSinir2":"1 puan eksik → elenir","sprintMax":"sprint puanı maksimuma eklenir","chToplamYok":"toplam yarış yoksa kısıt","chPuanYok":"puan verisi yoksa null","chEkr":"Round 1: puanlar 0","chDet":"şampiyonluk deterministik","chReasons":"şampiyonluk nedenleri ≤5, yasak dil yok","chConf":"sezon başı güven daha düşük","chContext":"şampiyonlukta contextSignals etkisiz","intOk":"entegrasyon: veri katmanı → motor","intPostFark":"entegrasyon: POST ≠ PRE","leakPre":"LEAKAGE PRE: hedef yarış sonucu değişse tahmin aynı","leakPost":"LEAKAGE POST: hedef yarış sonucu değişse tahmin aynı","intCh":"entegrasyon: şampiyonluk","intDriver":"entegrasyon: pilot-takım eşleşmesi doğru"}
for a,b in M.items(): k(b,R.get(a) is True,R.get(a))
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    br=p.chromium.launch(); pg=br.new_page(); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e))); net=[]
    pg.route("**/*",lambda r:(net.append(r.request.url),r.abort())[1] if r.request.url.startswith("http") else r.continue_())
    pg.goto("file:///home/claude/f1-takip/index.html"); pg.wait_for_timeout(1000)
    k("tarayıcı: TahminMotoru yüklü",pg.evaluate("typeof TahminMotoru.racePredict==='function'&&typeof TahminMotoru.championshipPredict==='function'"))
    k("JS hatası yok",not errs,errs); br.close()
print(sum(S),"/",len(S))
