// HAFTA SONU v1: Swift WeekendBuilder mantığının JS referansı (durumlar web hafta-state.js'ten). Bu Swift'in kendisi DEĞİLDİR.
const HS = require("../../f1/hafta-state.js"); const DK = 60000, H = 3600000, D = 86400000;
const DUR = { FirstPractice:60, SecondPractice:60, ThirdPractice:60, SprintQualifying:45, Sprint:40, Qualifying:70, Race:120 };
const NAME = { FirstPractice:"Antrenman 1", SecondPractice:"Antrenman 2", ThirdPractice:"Antrenman 3", SprintQualifying:"Sprint Sıralaması", Sprint:"Sprint", Qualifying:"Sıralama", Race:"Yarış" };
const OPENF1 = k => /Practice|SprintQualifying/.test(k), JOLP = k => ["Sprint","Qualifying","Race"].includes(k);
const R = Date.parse("2026-11-08T13:00:00Z");
const mk = l => l.map(([k, off]) => ({ key:k, start:R+off, end:R+off+DUR[k]*DK }));
const NORMAL = mk([["FirstPractice",-2*D],["SecondPractice",-2*D+4*H],["ThirdPractice",-D],["Qualifying",-D+4*H],["Race",0]]);
const SPRINT = mk([["Race",0],["Qualifying",-D+4*H],["Sprint",-D],["SprintQualifying",-2*D+4*H],["FirstPractice",-2*D]]);
function stat(s, now, res, evs) { const olaylar = (evs||[]).map(([m,t]) => ({ originalText:t, timestamp:new Date(s.start+m*DK).toISOString() }));
  const eski = res ? "tamamlandi" : now < s.start ? "yaklasan" : now < s.end ? "canli" : (OPENF1(s.key) && now - s.end > 3*H) ? "bitti" : "sonuc-bekleniyor";
  return HS.durum({ seans:{anahtar:s.key,baslangic:new Date(s.start),bitis:new Date(s.end)}, simdi:now, sonucVar:!!res, eski, olaylar }); }
function pres(r) { switch (r.durum) { case "DELAYED": return ["GECİKMELİ","estimated"]; case "LIVE": return r.tahmini ? ["LIVE TAHMİNİ","estimated"] : r.chip==="VSC" ? ["VSC","critical"] : r.chip==="SAFETY CAR" ? ["SC","critical"] : ["LIVE","live"];
  case "RED_FLAG": return [r.restartAciklandi?"RESTART ANNOUNCED":"RED FLAG","critical"]; case "SESSION_STOPPED": return [r.restartAciklandi?"RESTART ANNOUNCED":"DURDURULDU","critical"];
  case "RESUMED": return ["RESUMED","neutral"]; case "RESULT_PENDING": return ["SONUÇ BEKLENİYOR","estimated"]; case "COMPLETED": return ["COMPLETED","neutral"]; default: return ["YAKLAŞAN","neutral"]; } }
function build(W, now, results, events) {
  const seen = new Set(), ss = [...W].sort((a,b) => a.start-b.start).filter(s => { const k = NAME[s.key]+"|"+s.start; if (seen.has(k)) return false; seen.add(k); return true; });
  const stt = ss.map(s => stat(s, now, results.includes(s.key), (events[s.key]||null)));
  const busy = ["LIVE","RED_FLAG","SESSION_STOPPED","RESUMED","DELAYED"];
  const ai = stt.findIndex(r => busy.includes(r.durum)); const ni = ai < 0 ? ss.findIndex(s => s.start > now) : -1;
  const cards = ss.map((s,i) => { const r = stt[i]; let b;
    if (r.durum === "UPCOMING") b = [i===ni ? "SIRADA":"YAKLAŞAN","neutral"]; else if (r.durum === "COMPLETED") b = ["TAMAMLANDI","neutral"];
    else if (r.durum === "RESULT_PENDING") b = JOLP(s.key) ? pres(r) : ["BİTTİ","neutral"]; else b = pres(r);
    return { key:s.key, name:NAME[s.key], badge:b, active:i===ai }; });
  const bannerOK = ai >= 0 && stt[ai].kaynak === "feed" && !stt[ai].tahmini && ["LIVE","RED_FLAG","SESSION_STOPPED","RESUMED"].includes(stt[ai].durum);
  const type = ss.some(s => /Sprint/.test(s.key)) ? "sprint" : "normal";
  return { cards, banner: bannerOK ? pres(stt[ai]) : null, type, order: ss.map(s => s.key) };
}
let ok = 0, n = 0; const T = (a, g, e) => { n++; const p = JSON.stringify(g) === JSON.stringify(e); ok += p; console.log((p?"OK   ":"FAIL ")+a+(p?"":"  got="+JSON.stringify(g)+" exp="+JSON.stringify(e))); };
let c = build(NORMAL, R-3*D, [], {}); T("normal hafta sonu: sıra, sprint yok, SIRADA/YAKLAŞAN", [c.type, c.order, c.cards[0].badge[0], c.cards[1].badge[0], c.banner], ["normal",["FirstPractice","SecondPractice","ThirdPractice","Qualifying","Race"],"SIRADA","YAKLAŞAN",null]);
c = build(SPRINT, R-3*D, [], {}); T("sprint hafta sonu sırası", [c.type, c.order], ["sprint",["FirstPractice","SprintQualifying","Sprint","Qualifying","Race"]]);
c = build(NORMAL, R-2*D+30*DK, [], {}); T("aktif FP: LIVE TAHMİNİ, banner yok", [c.cards.find(x=>x.active).key, c.cards[0].badge, c.banner], ["FirstPractice",["LIVE TAHMİNİ","estimated"],null]);
c = build(NORMAL, R-D+4*H+30*DK, [], {}); T("aktif Q: amber, banner yok", [c.cards.find(x=>x.active).key, c.cards.find(x=>x.active).badge[1], c.banner], ["Qualifying","estimated",null]);
const S = SPRINT.find(s=>s.key==="Sprint"); c = build(SPRINT, S.start+10*DK, [], { Sprint:[[1,"Lights out for the sprint, green flag"]] }); T("aktif Sprint gerçek LIVE banner", [c.banner, c.cards.find(x=>x.active).key], [["LIVE","live"],"Sprint"]);
const L = [1,"Lights out and away we go!"];
for (const [txt, lab, m] of [["Virtual Safety Car deployed","VSC",18],["Safety car deployed, debris","SC",18],["Red flag! The race has been stopped","RED FLAG",28]]) { c = build(NORMAL, R+(m+2)*DK, [], { Race:[L,[m,txt]] }); T("aktif Race "+lab, c.banner, [lab,"critical"]); }
const RF=[28,"Red flag! The race has been stopped"], RA=[36,"Race control announces the restart procedure will begin at 14:05"], RS=[50,"Race resumed, green flag"];
T("RESTART ANNOUNCED", build(NORMAL, R+40*DK, [], { Race:[L,RF,RA] }).banner, ["RESTART ANNOUNCED","critical"]);
T("RESUMED", build(NORMAL, R+52*DK, [], { Race:[L,RF,RA,RS] }).banner, ["RESUMED","neutral"]);
c = build(NORMAL, R+30*DK, [], {}); T("Race LIVE TAHMİNİ: banner yok", [c.banner, c.cards[4].badge], [null, ["LIVE TAHMİNİ","estimated"]]);
c = build(NORMAL, R-D+6*H, ["Qualifying"], {}); T("tamamlanan seanslar", [c.cards[3].badge[0], c.cards[4].badge[0], c.cards[0].badge[0]], ["TAMAMLANDI","SIRADA","TAMAMLANDI"]);
c = build(NORMAL, R-2*D+2*H, [], {}); T("FP bitti: sonuç bekleniyor DEĞİL, BİTTİ", c.cards[0].badge[0], "BİTTİ");
c = build(NORMAL, R+3*H, [], {}); T("Race sonuç bekleniyor amber", c.cards[4].badge, ["SONUÇ BEKLENİYOR","estimated"]);
c = build(NORMAL, R+4*H, ["Qualifying","Race"], {}); T("Race tamamlandı (sonuç özeti ayrı: yoksa 'özet alınamadı')", [c.cards[4].badge[0], c.cards[3].badge[0]], ["TAMAMLANDI","TAMAMLANDI"]);
T("eksik seans crash yok", build([{key:"Race",start:R,end:R+2*H}], R-D, [], {}).order, ["Race"]);
T("SQ/Shootout çift gelirse tek", build([...SPRINT, {key:"SprintQualifying",start:R-2*D+4*H,end:R-2*D+4*H+45*DK}], R-3*D, [], {}).cards.filter(x=>x.name==="Sprint Sıralaması").length, 1);
console.log(ok+"/"+n); process.exit(ok===n?0:1);
