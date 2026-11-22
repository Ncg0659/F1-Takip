// LiveActivityPolicy.swift'in JS referans modeli (web durum motoru üstünde) — Swift'te yazılan test senaryolarının mantığını ÇALIŞTIRARAK doğrular.
// Bu Swift'in kendisi DEĞİLDİR; Swift testleri (F1CoreTests) Xcode'da çalıştırılmadı.
const HS = require("../../f1/hafta-state.js");
const DK = 60000, S0 = Date.parse("2026-11-08T13:00:00Z"), DUR = { Race:120, Sprint:40, FirstPractice:60, Qualifying:70, SprintQualifying:45 };
const RAW = { Race:1, Sprint:1 };
function status(key, min, evs, hasResult) {
  const bas = S0, bit = bas + DUR[key]*DK, now = bas + min*DK;
  const olaylar = evs.map(([m,t]) => ({ originalText:t, timestamp:new Date(bas+m*DK).toISOString() }));
  const eski = hasResult ? "tamamlandi" : now < bas ? "yaklasan" : now < bit ? "canli" : "sonuc-bekleniyor";
  return HS.durum({ seans:{anahtar:key,baslangic:new Date(bas),bitis:new Date(bit)}, simdi:now, sonucVar:!!hasResult, eski, olaylar });
}
const feedKey = k => k === "Race" || k === "Sprint";
function realActive(r, key, min) { return feedKey(key) && min >= 0 && r.kaynak === "feed" && !r.tahmini && ["LIVE","RED_FLAG","SESSION_STOPPED","RESUMED"].includes(r.durum); }
function disp(r) {
  switch (r.durum) { case "RED_FLAG": return r.restartAciklandi ? "restartAnnounced" : "redFlag"; case "SESSION_STOPPED": return r.restartAciklandi ? "restartAnnounced" : "stopped";
    case "RESUMED": return "resumed"; case "LIVE": return r.chip === "VSC" ? "vsc" : r.chip === "SAFETY CAR" ? "safetyCar" : "live";
    case "RESULT_PENDING": return "finished"; case "COMPLETED": return "completed"; default: return null; } }
const final = d => d === "finished" || d === "completed";
function decide(key, min, evs, active, ended, hasResult) {
  const r = status(key, min, evs, hasResult), d = disp(r), id = "2026-22-" + key;
  if (active && active.id === id) { if (!d) return "none"; if (final(d)) return "end:" + d; return d === active.d ? "none" : "update:" + d; }
  if (active) return "none"; if (ended && ended.has(id)) return "none";
  if (!realActive(r, key, min) || !d || final(d)) return "none";
  return "start:" + d;
}
const L = [1, "Lights out and away we go!"], RF = [28, "Red flag! The race has been stopped"], RA = [36, "Race control announces the restart procedure will begin at 14:05"], RS = [50, "Race resumed, green flag"];
const A = d => ({ id:"2026-22-Race", d });
const T = [
 ["oturum aktif değil → activity yok", decide("Race", -60, []), "none"],
 ["başlamadan önce (formation lap) → yok", decide("Race", -1, [[-2,"Formation lap underway"]]), "none"],
 ["saat tahmini LIVE → yok", decide("Race", 30, []), "none"],
 ["FP/Q/SQ → asla otomatik", ["FirstPractice","Qualifying","SprintQualifying"].map(k => decide(k, 20, [[1,"Red flag! stopped"]])).join(), "none,none,none"],
 ["gerçek LIVE → start", decide("Race", 3, [L]), "start:live"],
 ["Sprint LIVE → start", decide("Sprint", 3, [[1,"Lights out for the sprint, green flag"]]), "start:live"],
 ["çift başlatma yok (aynı seans)", decide("Race", 4, [L], A("live")), "none"],
 ["çift başlatma yok (başka seans sürüyor)", decide("Race", 4, [L], {id:"2026-21-Race", d:"live"}), "none"],
 ["biten seans yeniden başlamaz", decide("Race", 4, [L], null, new Set(["2026-22-Race"])), "none"],
 ["VSC → update", decide("Race", 20, [L,[18,"Virtual Safety Car deployed"]], A("live")), "update:vsc"],
 ["SC → update", decide("Race", 20, [L,[18,"Safety car deployed, debris"]], A("live")), "update:safetyCar"],
 ["RED FLAG → update", decide("Race", 30, [L,RF], A("live")), "update:redFlag"],
 ["RESTART ANNOUNCED", decide("Race", 40, [L,RF,RA], A("redFlag")), "update:restartAnnounced"],
 ["RESUMED (≠ restart announced)", decide("Race", 52, [L,RF,RA,RS], A("restartAnnounced")), "update:resumed"],
 ["RESUMED 10 dk sonra LIVE", decide("Race", 62, [L,RF,RS], A("resumed")), "update:live"],
 ["kareli bayrak → end (BİTTİ)", decide("Race", 100, [L,[98,"Chequered flag! Verstappen wins the race"]], A("live")), "end:finished"],
 ["sonuç → end (COMPLETED)", decide("Race", 150, [L], A("live"), null, true), "end:completed"],
 ["gecikme (başlamadan) → start yok", decide("Race", 5, [[-10,"Race start delayed due to rain"]]), "none"],
];
let ok = 0; T.forEach(([ad, got, exp]) => { const g = String(got) === exp; console.log((g ? "OK   " : "FAIL ") + ad + (g ? "" : "  got=" + got + " exp=" + exp)); ok += g; });
console.log(ok + "/" + T.length); process.exit(ok === T.length ? 0 : 1);
