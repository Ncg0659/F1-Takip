// BUGÜN v1: Swift FeedSummary/TodayModel mantığının JS referansı. Regex'ler Swift dosyalarından DOĞRUDAN okunur (aynı desen dizeleri),
// durumlar web hafta-state.js'ten gelir. Bu Swift'in kendisi DEĞİLDİR; Swift testleri Xcode'da çalıştırılmadı.
const fs = require("fs"); const HS = require("../../f1/hafta-state.js");
const SW = "../../f1-ios/F1Core/Sources/F1Core/";
const eng = fs.readFileSync(SW + "RaceStateEngine.swift", "utf8"), fsum = fs.readFileSync(SW + "FeedSummary.swift", "utf8");
const rx = (src, name, ci = true) => { const m = src.match(new RegExp("static let " + name + " = Rx\\(#\"(.*?)\"#(, ci: false)?\\)")); if (!m) throw new Error("desen yok: " + name); return new RegExp(m[1], m[2] ? "" : "i"); };
const R = n => rx(eng, n), F = n => rx(fsum, n);
const [oluml, gecmis, aktif, buyuk, kirm] = [R("reKirmiziOlumsuz"), R("reKirmiziGecmis"), R("reKirmiziAktif"), rx(eng, "reKirmiziBuyuk"), R("reKirmizi")];
function kirmiziMi(t) { if (oluml.test(t)) return false; const a = aktif.test(t) || buyuk.test(t); if (gecmis.test(t) && !a) return false; if (a) return true; return kirm.test(t) && t.length <= 80; }
function classify(t) {
  if (kirmiziMi(t)) return "critical"; if (R("reVsc").test(t) && !R("reVscBitti").test(t)) return "critical";
  if (R("reSc").test(t) && !R("reScBitti").test(t)) return "critical"; if (R("reDurdu").test(t)) return "critical";
  if (F("penalty").test(t)) return "penalty"; if (F("incident").test(t)) return "incident"; if (F("technical").test(t)) return "technical";
  if (F("pit").test(t) && !F("pitNoise").test(t)) return "pit"; return "other";
}
let ok = 0, n = 0; const T = (ad, got, exp) => { n++; const g = JSON.stringify(got) === JSON.stringify(exp); ok += g; console.log((g ? "OK   " : "FAIL ") + ad + (g ? "" : "  got=" + JSON.stringify(got) + " exp=" + JSON.stringify(exp))); };
// --- Feed sınıflandırma (Swift testleriyle aynı metinler)
const cls = { "Lights out!": "other", "Hamilton and Alonso collision at turn 1": "incident", "Verstappen pits for hards, pit stop 2.3s": "pit",
  "Stewards investigating Norris for track limits, penalty possible": "penalty", "Leclerc reports engine problem": "technical", "Safety car deployed": "critical",
  "Nice weather today": "other", "Red flag! The race has been stopped": "critical", "Virtual Safety Car deployed": "critical", "Safety car in this lap": "other",
  "After the red flag restart, Hamilton leads": "other", "Pit lane is open": "other", "Safety car deployed, debris": "critical", "Verstappen pits for hards": "pit" };
for (const [t, k] of Object.entries(cls)) T("sınıf: " + t.slice(0, 40), classify(t), k);
// --- Mod mantığı (TodayBuilder aynası)
const DK = 60000, H = 3600000, DUR = { FirstPractice:60, Qualifying:70, Race:120 };
const mkW = (round, raceIso, name) => { const r = Date.parse(raceIso); return { id:"2026-"+round, name, race:r, sessions:[["FirstPractice", r-2*86400000],["Qualifying", r-86400000],["Race", r]].map(([k,s]) => ({ key:k, start:s, end:s+DUR[k]*DK })) }; };
const prev = mkW(21, "2026-10-25T13:00:00Z", "Mexico"), cur = mkW(22, "2026-11-08T13:00:00Z", "Las Vegas"), nxt = mkW(23, "2026-11-22T13:00:00Z", "Abu Dhabi");
function st(w, key, now, hasResult, evs) {
  const s = w.sessions.find(x => x.key === key); const olaylar = (evs||[]).map(([m,t]) => ({ originalText:t, timestamp:new Date(w.race+m*DK).toISOString() }));
  const eski = hasResult ? "tamamlandi" : now < s.start ? "yaklasan" : now < s.end ? "canli" : "sonuc-bekleniyor";
  return HS.durum({ seans:{anahtar:key,baslangic:new Date(s.start),bitis:new Date(s.end)}, simdi:now, sonucVar:!!hasResult, eski, olaylar });
}
function pres(r, upcoming) {
  if (!r || upcoming) return ["YAKLAŞAN","neutral"];
  switch (r.durum) { case "DELAYED": return ["GECİKMELİ","estimated"];
    case "LIVE": return r.tahmini ? ["LIVE TAHMİNİ","estimated"] : r.chip==="VSC" ? ["VSC","critical"] : r.chip==="SAFETY CAR" ? ["SC","critical"] : ["LIVE","live"];
    case "RED_FLAG": return [r.restartAciklandi ? "RESTART ANNOUNCED":"RED FLAG","critical"]; case "SESSION_STOPPED": return [r.restartAciklandi?"RESTART ANNOUNCED":"DURDURULDU","critical"];
    case "RESUMED": return ["RESUMED","neutral"]; case "RESULT_PENDING": return ["SONUÇ BEKLENİYOR","estimated"]; case "COMPLETED": return ["COMPLETED","neutral"]; default: return ["YAKLAŞAN","neutral"]; }
}
function bugun(now, S) { // S: {weekendId+key: durum sonucu}
  const ws = [prev, cur, nxt], get = (w,k) => S[w.id+k];
  const finished = w => w.race + 6*H <= now || (get(w,"Race") && get(w,"Race").durum === "COMPLETED" && get(w,"Race").kaynak === "sonuc");
  const up = ws.find(w => !finished(w)), last = [...ws].reverse().find(finished);
  const active = w => { const busy = ["LIVE","RED_FLAG","SESSION_STOPPED","RESUMED","DELAYED"]; const s = w.sessions.find(x => get(w,x.key) && busy.includes(get(w,x.key).durum)) || w.sessions.find(x => x.end > now) || w.sessions[w.sessions.length-1];
    const r = get(w, s.key); return { mode:"active", gp:w.name, session:s.key, badge: pres(r, !r || r.durum==="UPCOMING") }; };
  if (up && now >= up.sessions[0].start) return active(up);
  const raceEnd = w => w.sessions[2].end;
  if (last && get(last,"Race") && get(last,"Race").durum === "RESULT_PENDING" && now < raceEnd(last)+72*H) return active(last);
  if (last && get(last,"Race") && get(last,"Race").durum === "COMPLETED" && get(last,"Race").kaynak === "sonuc" && (!up || now < raceEnd(last)+72*H)) return { mode:"post", gp:last.name, badge:["COMPLETED","neutral"], next: up && up.name };
  if (up) return { mode:"normal", gp:up.name, badge:["SONRAKİ YARIŞ","neutral"] };
  return last && { mode:"post", gp:last.name };
}
const r1 = cur.race, L = [1,"Lights out and away we go!"];
const sc = (now, evs, res) => ({ "22Race": st(cur,"Race",now,res,evs) });
const S = (w,k,now,res,evs) => { const o = {}; o[w.id+k] = st(w,k,now,res,evs); return o; };
T("normal dönem", bugun(Date.parse("2026-11-03T10:00:00Z"), {}), { mode:"normal", gp:"Las Vegas", badge:["SONRAKİ YARIŞ","neutral"] });
T("hafta sonu başlamadan = normal", bugun(r1-2*86400000-H, {}).mode, "normal");
T("aktif hafta sonu (FP1 sonrası)", bugun(Date.parse("2026-11-06T23:00:00Z"), S(cur,"FirstPractice",Date.parse("2026-11-06T23:00:00Z"))).mode, "active");
let now = r1+10*DK; T("LIVE gerçek", bugun(now, S(cur,"Race",now,false,[L])).badge, ["LIVE","live"]);
now = r1+30*DK; T("LIVE TAHMİNİ amber", bugun(now, S(cur,"Race",now)).badge, ["LIVE TAHMİNİ","estimated"]);
now = r1+20*DK; T("VSC", bugun(now, S(cur,"Race",now,false,[L,[18,"Virtual Safety Car deployed"]])).badge, ["VSC","critical"]);
T("SC", bugun(now, S(cur,"Race",now,false,[L,[18,"Safety car deployed, debris"]])).badge, ["SC","critical"]);
now = r1+30*DK; T("RED FLAG", bugun(now, S(cur,"Race",now,false,[L,[28,"Red flag! The race has been stopped"]])).badge, ["RED FLAG","critical"]);
now = r1+4*H; T("COMPLETED → yarış sonrası", bugun(now, S(cur,"Race",now,true)), { mode:"post", gp:"Las Vegas", badge:["COMPLETED","neutral"], next:"Abu Dhabi" });
now = r1+3*H; T("sonuç bekleniyor aktif amber", bugun(now, S(cur,"Race",now)).badge, ["SONUÇ BEKLENİYOR","estimated"]);
now = r1+80*H; T("72 saat sonra normal (sonraki GP)", bugun(now, S(cur,"Race",now,true)), { mode:"normal", gp:"Abu Dhabi", badge:["SONRAKİ YARIŞ","neutral"] });
now = Date.parse("2026-11-07T13:30:00Z"); const q = bugun(now, S(cur,"Qualifying",now)); T("Sıralama tahmini amber, feed yok", [q.session, q.badge[1]], ["Qualifying","estimated"]);
console.log(ok + "/" + n); process.exit(ok === n ? 0 : 1);
