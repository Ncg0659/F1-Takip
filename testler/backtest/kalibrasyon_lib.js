/* Kalibrasyon v2 yardımcıları (ölçüm aracı). Motorun dışa açık AGIRLIK / PARAM.SICAKLIK nesnelerini GEÇİCİ ezer, her zaman geri alır. */
"use strict";
const L = require("./backtest-lib.js"), TM = L.TM;
const FOLDLAR = [{ val: 2024, train: [2023] }, { val: 2025, train: [2023, 2024] }, { val: 2026, train: [2023, 2024, 2025] }];
// v1 (kalibrasyon ÖNCESİ) referans değerler — 'eski' model buradan kurulur; motor dosyası artık yeni değerleri taşır
const ESKI = { AGIRLIK: { PRE_WEEKEND: { recentForm: 0.25, qualifyingForm: 0.20, grid: 0.00, teamForm: 0.22, reliability: 0.08, trackHistory: 0.10, teammateDelta: 0.05, telemetrySummary: 0.10 },
  POST_QUALIFYING: { recentForm: 0.15, qualifyingForm: 0.08, grid: 0.35, teamForm: 0.17, reliability: 0.06, trackHistory: 0.07, teammateDelta: 0.02, telemetrySummary: 0.10 } }, SICAKLIK: { win: 0.12, podium: 0.25, points: 0.50 } };
const TEMP_CARPAN = [0.3, 0.4, 0.5, 0.65, 0.8, 1, 1.25, 1.6];

function kopya(o) { return JSON.parse(JSON.stringify(o)); }
function norm(w) { const t = Object.keys(w).reduce((a, k) => a + w[k], 0), o = {}; Object.keys(w).forEach(k => { o[k] = w[k] / t; }); return o; }
function yuv(w) { const o = {}; Object.keys(w).forEach(k => { o[k] = Math.round(w[k] * 1000) / 1000; }); return o; }

// ---- aday üretimi (deterministik) ----
function postAdaylar(taban) {
  const out = [];
  [0.35, 0.45, 0.55, 0.65].forEach(g => {
    const k = (1 - g) / (1 - taban.grid), w = {}; Object.keys(taban).forEach(a => { w[a] = a === "grid" ? g : taban[a] * k; });
    out.push({ ad: "grid" + g, grid: g, agirlik: yuv(w) });
    // form kaydırma: takım formu +%30, yarış formu −%30 (kalan sabit)
    const w2 = kopya(w), kay = w2.recentForm * 0.3; w2.recentForm -= kay; w2.teamForm += kay; out.push({ ad: "grid" + g + "_takim+", grid: g, agirlik: yuv(w2) });
  });
  return out;
}
function preAdaylar(taban) {
  const out = [{ ad: "taban", agirlik: yuv(taban) }];
  [0.20, 0.25, 0.32].forEach(rf => [0.22, 0.30].forEach(tf => [0.05, 0.10, 0.15].forEach(th => [0.12, 0.20].forEach(qf => {
    const w = kopya(taban); w.recentForm = rf; w.teamForm = tf; w.trackHistory = th; w.qualifyingForm = qf;
    out.push({ ad: "rf" + rf + "_tf" + tf + "_th" + th + "_qf" + qf, agirlik: yuv(norm(w)) });
  }))));
  return out;
}

// ---- tek yapılandırmayı çalıştır ----
function calistirCfg(cfg, yarislar) {   // cfg: {mod, agirlik, sicaklik:{win,podium,points}} ; yarislar: calistir() çıktısı (ozellikler dolu)
  const oA = kopya(TM.AGIRLIK[cfg.mod]), oS = kopya(TM.PARAM.SICAKLIK[cfg.mod]);
  try {
    TM.AGIRLIK[cfg.mod] = Object.assign({}, cfg.agirlik); Object.assign(TM.PARAM.SICAKLIK[cfg.mod], cfg.sicaklik);
    return yarislar.map(t => { const p = TM.racePredict(t.ozellikler); return Object.assign(L.motorSatir({ suruculer: p.suruculer.map(s => ({ driver: s.driver, win: s.winProbability, pod: s.podiumProbability, pts: s.pointsProbability })) }), { gercek: t.gercek, season: t.season, round: t.round }); });
  } finally { TM.AGIRLIK[cfg.mod] = oA; Object.assign(TM.PARAM.SICAKLIK[cfg.mod], oS); }
}
function skorlar(satirlar, uni) {   // uni: aynı kümede uniform ölçü
  const m = L.olc(satirlar);
  return { m: m, sBW: 1 - m.brierWin / uni.brierWin, sLL: 1 - m.logLossWin / uni.logLossWin, sBP: 1 - m.brierPodium / uni.brierPodium, sBQ: 1 - m.brierPoints / uni.brierPoints };
}
function J(x) { return (x.sBW + x.sLL + x.sBP + x.sBQ + x.m.top1 + x.m.top3) / 6; }
function uniOlc(yarislar) { return L.olc(yarislar.map(t => Object.assign(L.uniform(t.suruculer.map(s => s.driver)), { gercek: t.gercek }))); }

// ---- aday + sıcaklık seçimi (YALNIZ verilen eğitim kümesinde) ----
function sec(mod, adaylar, egitim, taban) {
  const uni = uniOlc(egitim), sT0 = ESKI.SICAKLIK, sonuc = [];
  adaylar.forEach(a => {
    // sıcaklık: her hedef için bağımsız (win T yalnız win çıktısını etkiler)
    const en = {};
    TEMP_CARPAN.forEach(c => {
      const T = { win: sT0.win * c, podium: sT0.podium * c, points: sT0.points * c };
      const x = skorlar(calistirCfg({ mod: mod, agirlik: a.agirlik, sicaklik: T }, egitim), uni);
      const pW = (x.sBW + x.sLL) / 2, pP = x.sBP, pQ = x.sBQ;
      if (!en.win || pW > en.win.p + 1e-12) { en.win = { p: pW, c: c, T: T.win }; }
      if (!en.podium || pP > en.podium.p + 1e-12) { en.podium = { p: pP, c: c, T: T.podium }; }
      if (!en.points || pQ > en.points.p + 1e-12) { en.points = { p: pQ, c: c, T: T.points }; }
    });
    const Ts = { win: en.win.T, podium: en.podium.T, points: en.points.T };
    const x = skorlar(calistirCfg({ mod: mod, agirlik: a.agirlik, sicaklik: Ts }, egitim), uni);
    sonuc.push({ ad: a.ad, grid: a.grid, agirlik: a.agirlik, sicaklik: Ts, carpan: { win: en.win.c, podium: en.podium.c, points: en.points.c }, egitimJ: J(x), egitim: x.m });
  });
  sonuc.sort((p, q) => q.egitimJ - p.egitimJ || (p.ad < q.ad ? -1 : 1));
  return sonuc;
}
module.exports = { ESKI, L, TM, FOLDLAR, TEMP_CARPAN, kopya, norm, yuv, postAdaylar, preAdaylar, calistirCfg, skorlar, J, uniOlc, sec };
