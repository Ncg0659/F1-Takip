// hafta-state.js (web, referans) → Swift RaceStateEngine için altın vektörler. Çalıştır: node golden_uret.js
const HS = require("../../f1/hafta-state.js");
const fs = require("fs");
const OPENF1 = ["FirstPractice","SecondPractice","ThirdPractice","SprintQualifying","SprintShootout"];
const DUR = { FirstPractice:60, SecondPractice:60, ThirdPractice:60, SprintQualifying:45, SprintShootout:45, Sprint:40, Qualifying:70, Race:120 };
const ST = { UPCOMING:"upcoming", DELAYED:"delayed", LIVE:"live", RED_FLAG:"redFlag", SESSION_STOPPED:"sessionStopped", RESUMED:"resumed", RESULT_PENDING:"resultPending", COMPLETED:"completed" };
const SRC = { sonuc:"result", feed:"feed", faz:"phase", saat:"clock" };
const CHIP = { "VSC":"vsc", "SAFETY CAR":"safetyCar" };
const DK = 60000;
function legacy(key, bas, bit, hasResult, now) {
  if (hasResult) return "tamamlandi";
  if (now < bas) return "yaklasan";
  if (now < bit) return "canli";
  if (OPENF1.includes(key) && now - bit > 3*3600*1000) return "bitti";
  return "sonuc-bekleniyor";
}
function vektor(ad, key, startIso, nowOffsetMin, hasResult, evs) {
  const bas = Date.parse(startIso), bit = bas + DUR[key]*DK, now = bas + nowOffsetMin*DK;
  const olaylar = evs.map(([dk, t]) => ({ originalText: t, timestamp: new Date(bas + dk*DK).toISOString() }));
  const r = HS.durum({ seans:{ anahtar:key, baslangic:new Date(bas), bitis:new Date(bit) }, simdi:now, sonucVar:hasResult, eski:legacy(key,bas,bit,hasResult,now), olaylar });
  return { ad, key, start:startIso, now:new Date(now).toISOString(), hasResult,
    events: olaylar.map(o => ({ text:o.originalText, time:o.timestamp })),
    expect:{ state:ST[r.durum], source:SRC[r.kaynak], estimated:!!r.tahmini, extended:!!r.uzamis, chip:r.chip?CHIP[r.chip]:null,
             restartAnnounced:!!r.restartAciklandi, lastCheck:r.sonKontrol||null, atLeastMin:r.enAz||null } };
}
const S = "2026-11-08T13:00:00Z";
const V = [];
V.push(vektor("yarış öncesi", "Race", S, -60, false, []));
V.push(vektor("saat tahmini LIVE (feed yok)", "Race", S, 30, false, []));
V.push(vektor("formation lap → LIVE feed", "Race", S, -1, false, [[-2,"Formation lap underway, cars on the grid"]]));
V.push(vektor("lights out", "Race", S, 3, false, [[1,"Lights out and away we go!"]]));
V.push(vektor("VSC", "Race", S, 20, false, [[1,"Lights out and away we go!"],[18,"Virtual Safety Car deployed after Alonso stops on track"]]));
V.push(vektor("SC", "Race", S, 20, false, [[1,"Lights out and away we go!"],[18,"Safety car deployed, debris on the straight"]]));
V.push(vektor("SC biter", "Race", S, 25, false, [[1,"Lights out and away we go!"],[18,"Safety car deployed, debris on the straight"],[23,"Safety car in this lap"]]));
V.push(vektor("kırmızı bayrak", "Race", S, 30, false, [[1,"Lights out and away we go!"],[28,"Red flag! The race has been stopped after a big crash"]]));
V.push(vektor("restart açıklandı", "Race", S, 40, false, [[1,"Lights out and away we go!"],[28,"Red flag! The race has been stopped after a big crash"],[36,"Race control announces the restart procedure will begin at 14:05"]]));
V.push(vektor("kırmızı → resumed (taze)", "Race", S, 52, false, [[1,"Lights out and away we go!"],[28,"Red flag! The race has been stopped"],[50,"Race resumed, green flag"]]));
V.push(vektor("resumed 12 dk sonra LIVE", "Race", S, 62, false, [[1,"Lights out and away we go!"],[28,"Red flag! The race has been stopped"],[50,"Race resumed, green flag"]]));
V.push(vektor("kareli bayrak", "Race", S, 100, false, [[1,"Lights out and away we go!"],[98,"Chequered flag! Verstappen wins the race"]]));
V.push(vektor("sonuç var COMPLETED", "Race", S, 150, true, []));
V.push(vektor("başlangıç gecikmesi", "Race", S, 5, false, [[-10,"Race start delayed due to rain, inspection at 13:30"]]));
V.push(vektor("gecikme bayat (5 saat)", "Race", S, 300, false, [[-10,"Race start delayed due to rain"]]));
V.push(vektor("Sprint LIVE feed", "Sprint", "2026-11-07T13:00:00Z", 5, false, [[1,"Lights out for the sprint, green flag"]]));
V.push(vektor("SQ faz tahmini", "SprintQualifying", S, 22, false, []));
V.push(vektor("Q faz tahmini", "Qualifying", S, 30, false, []));
V.push(vektor("Q uzamış", "Qualifying", S, 66, false, []));
V.push(vektor("Q erken sonuç kabul edilmez", "Qualifying", S, 20, true, []));
V.push(vektor("Q sonuç + bitiş sonrası", "Qualifying", S, 75, true, []));
V.push(vektor("FP1 saat tahmini", "FirstPractice", S, 20, false, []));
V.push(vektor("FP1 3 saat sonra bitti", "FirstPractice", S, 60+190, false, []));
V.push(vektor("yarış bitti, feed yok → bekleme", "Race", S, 150, false, []));
V.push(vektor("FP feed asla kullanılmaz", "FirstPractice", S, 10, false, [[1,"Red flag! session stopped"]]));
// Rastgele (sabit tohum) 400 dizi
let seed = 20261108; const rnd = () => (seed = (seed*1664525 + 1013904223) % 4294967296) / 4294967296;
const HAVUZ = [
 "Lights out and away we go!","Formation lap underway","Red flag! The race has been stopped","Red flag","No red flag needed, they cleared the car",
 "After the red flag restart, Hamilton leads","Race resumed, green flag","Restart at 14:10","Restart in 3 minutes, cars lining up",
 "Safety car deployed","Safety car in this lap","Virtual Safety Car deployed","VSC ending","Session suspended","Race control stopped the race",
 "Start delayed due to heavy rain, next inspection at 13:45","Start will be delayed by at least 20 minutes","Hamilton delayed his pit stop",
 "Chequered flag, Norris wins the race","Chequered flag in two laps","Final classification confirmed","Track inspection ongoing, standing water on the straight",
 "The restart will be announced soon","Green flag! Racing is back","Medical car out on track","Verstappen takes the victory",
 "Pit lane is open, cars heading to the grid","Race to resume at 14:30","Stopped","RED FLAG","Cars leaving the pits to the grid", "Restart procedure under way","Racing resumes now"
];
const KEYS = ["Race","Sprint","Race","Race"];
for (let i=0;i<400;i++) {
  const key = KEYS[Math.floor(rnd()*KEYS.length)], n = 1 + Math.floor(rnd()*6), evs = [];
  let t = -20 + Math.floor(rnd()*30);
  for (let j=0;j<n;j++) { evs.push([t, HAVUZ[Math.floor(rnd()*HAVUZ.length)]]); t += 1 + Math.floor(rnd()*25); }
  const nowOff = Math.max(...evs.map(e=>e[0])) + Math.floor(rnd()*40) + (rnd()<0.2 ? 400 : 0);
  V.push(vektor("fuzz-"+i, key, S, nowOff, false, evs));
}
fs.writeFileSync("../../f1-ios/F1Core/Tests/F1CoreTests/Resources/golden_state.json", JSON.stringify(V));
const sayac = {}; V.forEach(v => { const k = v.expect.state+"/"+v.expect.source; sayac[k]=(sayac[k]||0)+1; });
console.log("vektör:", V.length); console.log(sayac);
