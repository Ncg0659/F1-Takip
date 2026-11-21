/* Güven v3 doğrulaması: kesimler YALNIZ eğitim sezonlarından (tercil), hata YALNIZ doğrulama sezonlarında ölçülür (ileri-zincir). */
"use strict";
const L = require("./backtest-lib.js"), TM = L.TM, K = require("./kalibrasyon_lib.js");
const MIN_N = 10, MIN_FARK = 0.05;   // grup başına en az yarış; seviyeler arası en az hata farkı (mutlak)
function yarisSatirlari(T) {
  return T.map(t => {
    const p = TM.racePredict(t.ozellikler), s = p.suruculer, sk = TM.genelGuvenSkor(s);
    const win = Object.keys(t.gercek.win).find(k => t.gercek.win[k] === 1);
    const pod3 = s.slice().sort((a, b) => b.podiumProbability - a.podiumProbability || (a.driver < b.driver ? -1 : 1)).slice(0, 3).map(x => x.driver);
    return { season: t.season, round: t.round, mod: t.mode, skor: sk.skor, hata1: s[0].driver === win ? 0 : 1, hataPod: 1 - pod3.filter(d => t.gercek.pod[d] === 1).length / 3 };
  });
}
function tercil(skorlar) { const a = skorlar.slice().sort((x, y) => x - y), n = a.length; return { MEDIUM: a[Math.floor(n / 3)], HIGH: a[Math.floor(2 * n / 3)] }; }
function seviye(skor, k) { return skor >= k.HIGH ? "HIGH" : (skor >= k.MEDIUM ? "MEDIUM" : "LOW"); }
function grupla(rows, k) {
  const g = { HIGH: [], MEDIUM: [], LOW: [] }; rows.forEach(r => g[seviye(r.skor, k)].push(r));
  const o = {}; Object.keys(g).forEach(s => { const x = g[s]; o[s] = { n: x.length, hata1: x.length ? x.reduce((a, b) => a + b.hata1, 0) / x.length : null, hataPod: x.length ? x.reduce((a, b) => a + b.hataPod, 0) / x.length : null }; });
  return o;
}
function monoton(o) {   // HIGH < MEDIUM < LOW, her ikisinde de (kazanan hatası + podyum hatası), farklar ≥ MIN_FARK, grup n ≥ MIN_N
  const gr = ["HIGH", "MEDIUM", "LOW"]; if (gr.some(s => !o[s] || o[s].n < MIN_N)) { return { ok: false, neden: "grup-az-ornek" }; }
  for (const m of ["hata1", "hataPod"]) { for (let i = 0; i < 2; i++) { if (!(o[gr[i + 1]][m] - o[gr[i]][m] >= MIN_FARK)) { return { ok: false, neden: m + ":" + gr[i] + "→" + gr[i + 1] }; } } }
  return { ok: true, neden: "" };
}
function degerle(rows, mod) {   // rows: tüm sezonlar (2023–2026), tek mod
  // Kesimler yalnız SKOR dağılımının tercilidir (etiket/sonuç kullanılmaz → gözetimsiz); sonuç hataları 2024–2026 değerlendirme yarışlarında ölçülür.
  const R = rows.filter(r => r.mod === mod), k = tercil(R.map(r => r.skor)), V = R.filter(r => r.season >= 2024);
  const g = { HIGH: [], MEDIUM: [], LOW: [] }; V.forEach(r => g[seviye(r.skor, k)].push(r));
  const ort = (x, m) => x.length ? x.reduce((a, b) => a + b[m], 0) / x.length : null, grup = {};
  Object.keys(g).forEach(s => { grup[s] = { n: g[s].length, hata1: ort(g[s], "hata1"), hataPod: ort(g[s], "hataPod") }; });
  const sezon = {}; [2024, 2025, 2026].forEach(y => { const h = V.filter(r => r.season === y && seviye(r.skor, k) === "HIGH"), l = V.filter(r => r.season === y && seviye(r.skor, k) === "LOW"); sezon[y] = { nHigh: h.length, nLow: l.length, highDahaIyi: h.length > 0 && l.length > 0 ? (ort(h, "hata1") + ort(h, "hataPod")) < (ort(l, "hata1") + ort(l, "hataPod")) : null }; });
  const mn = monoton(grup), tutarli = Object.keys(sezon).filter(y => sezon[y].highDahaIyi === true).length >= 2;
  const ok = mn.ok && tutarli;
  return { mod: mod, kesim: k, grup: grup, sezon: sezon, monoton: mn, sezonTutarli: tutarli, durum: ok ? "OK" : "UNRELIABLE", n: V.length };
}
module.exports = { yarisSatirlari, tercil, seviye, grupla, monoton, degerle, MIN_N, MIN_FARK };
