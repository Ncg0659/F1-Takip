// Node'da gerçek hafta-veri/seri-ayarlari/hafta-state/hafta-baglam ile sınama düzeneği (tarayıcı gerekmez)
const path = require("path"); const F1 = process.env.F1_DIR || "/home/claude/f1-takip";
global.window = global; global.localStorage = { getItem: () => null, setItem() {} };
global.document = { addEventListener() {}, readyState: "complete", visibilityState: "visible" };
require(path.join(F1, "seri-ayarlari.js")); try { require(path.join(F1, "jolpica-istemci.js")); } catch (e) {}
require(path.join(F1, "hafta-veri.js")); const HS = require(path.join(F1, "hafta-state.js")); const HB = require(path.join(F1, "hafta-baglam.js"));
const HV = window.HaftaVeri;
function kayit(rnd, ad, tarih, circ, sprint) {
  const d = new Date(tarih + "T12:00:00Z"); const gun = n => new Date(d - n * 86400000).toISOString().slice(0, 10);
  const k = { season: "2026", round: String(rnd), raceName: ad, date: tarih, time: "12:00:00Z", Circuit: { circuitId: circ, circuitName: circ, Location: { locality: "L", country: "Singapore" } } };
  if (sprint) { k.FirstPractice = { date: gun(2), time: "08:30:00Z" }; k.SprintQualifying = { date: gun(2), time: "12:30:00Z" }; k.Sprint = { date: gun(1), time: "09:00:00Z" }; k.Qualifying = { date: gun(1), time: "13:00:00Z" }; }
  else { k.FirstPractice = { date: gun(2), time: "11:30:00Z" }; k.SecondPractice = { date: gun(2), time: "15:00:00Z" }; k.ThirdPractice = { date: gun(1), time: "10:30:00Z" }; k.Qualifying = { date: gun(1), time: "14:00:00Z" }; }
  return k;
}
const SNG = () => HV.haftaKur(kayit(17, "Singapore Grand Prix", "2026-10-11", "marina_bay", true), "f1");
const T = s => Date.parse(s);
function ev(zamanIso, text, ek) { return Object.assign({ originalText: text, textTr: text, timestamp: zamanIso, category: "COMMENT", priority: "low", drivers: [] }, ek || {}); }
let ok = 0, top = 0; function k(ad, c, e) { top++; if (c) { ok++; console.log("OK  ", ad); } else console.log("FAIL", ad, e === undefined ? "" : JSON.stringify(e)); }
module.exports = { HS, HB, HV, SNG, T, ev, k, sonuc: () => { console.log("TOPLAM", ok, "/", top); return ok === top; }, kayit,
  ctx: (h, o) => Object.assign({ sezon: 2026, tur: 17, hafta: h, statik: [], feed: { Sprint: [], Race: [] }, pilotHarita: {} }, o || {}) };
