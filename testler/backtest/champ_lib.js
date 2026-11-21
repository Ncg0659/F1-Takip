/* Şampiyonluk backtest (ölçüm aracı). Her checkpoint'te YALNIZ o turdan ÖNCEKİ veri kullanılır (tv.ozellik sızıntıyı süzer; gerçek puanlar da R'den önceki turlardan hesaplanır). */
"use strict";
const L = require("./backtest-lib.js"), TM = L.TM, ESKI = require("./ref/prediction-engine-champ-v1.js");
const ORANLAR = [0.25, 0.5, 0.75];
function sez(ds, S) { return ds.seasons[String(S)]; }
function checkpointlar(ds, S) {   // [{ad, R}]  R = tahmin edilen (henüz koşulmamış) tur
  const T = sez(ds, S).toplam, out = ORANLAR.map(o => ({ ad: Math.round(o * 100) + "%", R: Math.floor(o * T) + 1 }));
  out.push({ ad: "son5", R: T - 4 }); return out;
}
function gercekPuanlar(ds, S, R) {   // R'den ÖNCEKİ turların yarış+sprint puanları
  const p = {}; sez(ds, S).races.forEach(r => { if (r.round >= R) { return; }
    r.results.forEach(x => { p[x.Driver.driverId] = (p[x.Driver.driverId] || 0) + Number(x.points || 0); });
    (r.sprintResults || []).forEach(x => { p[x.Driver.driverId] = (p[x.Driver.driverId] || 0) + Number(x.points || 0); }); });
  return p;
}
function sprintPuanlari(ds, S, R) { const p = {}; sez(ds, S).races.forEach(r => { if (r.round < R) { (r.sprintResults || []).forEach(x => { p[x.Driver.driverId] = (p[x.Driver.driverId] || 0) + Number(x.points || 0); }); } }); return p; }
function kalanSprint(ds, S, R) { return sez(ds, S).races.filter(r => r.round >= R && r.sprint).length; }
function suruculer(ds, S, R) {   // R'den önce görünen pilotlar ∪ R'nin giriş listesi
  const k = new Set(); sez(ds, S).races.forEach(r => { if (r.round <= R) { r.results.forEach(x => k.add(x.Driver.driverId)); } }); return Array.from(k).sort();
}
function dogruEleme(ds, S, R, puan, kural) {   // gerçek puanlar + sezon kuralı ile matematiksel eleme
  const T = sez(ds, S).toplam, kalan = T - (R - 1), maxK = kalan * kural.yarisMax + kalanSprint(ds, S, R) * kural.sprintMax, ids = Object.keys(puan), lider = Math.max.apply(null, ids.map(d => puan[d]));
  const el = {}; ids.forEach(d => { el[d] = puan[d] + maxK < lider; }); return { elendi: el, maxKalan: maxK, lider: lider };
}
// ---- baseline'lar (gerçek puanlar; yalnız R'den önceki veri) ----
function bazA(puan, ids) { const t = ids.reduce((a, d) => a + (puan[d] || 0), 0) || 1; return ids.map(d => (puan[d] || 0) / t); }   // puan-orantılı
function bazB(puan, ids, el, maxK) {   // puan + kalan maksimum puan farkı: yaşayanlar arasında (puan+maxK−lider)/maxK ile orantılı
  const lider = Math.max.apply(null, ids.map(d => puan[d] || 0)), w = ids.map(d => el[d] ? 0 : Math.max(0, ((puan[d] || 0) + maxK - lider) / maxK)), t = w.reduce((a, b) => a + b, 0) || 1; return w.map(x => x / t);
}
// ---- ölçüler ----
function olc(ids, p, sampiyon) {
  const yi = ids.indexOf(sampiyon), y = ids.map(d => d === sampiyon ? 1 : 0), sira = ids.map((d, i) => i).sort((a, b) => p[b] - p[a] || (ids[a] < ids[b] ? -1 : 1));
  return { pSampiyon: yi >= 0 ? p[yi] : 0, birinci: yi >= 0 && sira[0] === yi, ilk3: yi >= 0 && sira.slice(0, 3).indexOf(yi) >= 0, toplam: p.reduce((a, b) => a + b, 0), brier: p.reduce((a, x, i) => a + Math.pow(x - y[i], 2), 0), logLoss: -Math.log(Math.max(yi >= 0 ? p[yi] : 0, 1e-4)), max: Math.max.apply(null, p) };
}
async function hazirla(ds, tv, sezonlar) {   // checkpoint başına: özellikler (PRE) + yarış-modeli beklentisi
  const out = [];
  for (const S of sezonlar) { for (const cp of checkpointlar(ds, S)) {
    const ids = suruculer(ds, S, cp.R), f = (await Promise.all(ids.map(d => tv.ozellik({ season: S, round: cp.R, driver: d, mode: "PRE_WEEKEND" })))).filter(x => x && x.durum === "ok");
    const rp = TM.racePredict(f), E = {}; if (rp.durum === "ok") { rp.suruculer.forEach(s => { E[s.driver] = 25 * s.winProbability + 16.5 * (s.podiumProbability - s.winProbability) + 6.14 * (s.pointsProbability - s.podiumProbability); }); }
    const puan = gercekPuanlar(ds, S, cp.R), kural = TM.sezonKurali(S), el = dogruEleme(ds, S, cp.R, puan, kural), sprintO = await tv.sprintOzeti({ season: S, round: cp.R });
    out.push({ S: S, cp: cp.ad, R: cp.R, T: sez(ds, S).toplam, sampiyon: sez(ds, S).sampiyon, f: f, ids: ids, E: E, puan: puan, sprintP: sprintPuanlari(ds, S, cp.R), sprintO: sprintO, kalanSprint: kalanSprint(ds, S, cp.R), kural: kural, elTrue: el }); } }
  return out;
}
function motorCalistir(motor, H, yeniOpts) {   // motor: ESKI | TM ; yeniOpts: true → sprint puanı + yarış beklentisi verilir
  const o = { toplamYaris: H.T, kalanSprint: H.kalanSprint }; if (yeniOpts) { o.sprint = H.sprintO; }
  return motor.championshipPredict(H.f, o);
}
function degerle(H, c) {   // c: championshipPredict çıktısı → ölçü + eleme/denetim
  if (c.durum !== "ok") { return null; }
  const ids = c.suruculer.map(s => s.driver), p = c.suruculer.map(s => s.championshipProbability || 0), m = olc(ids, p, H.sampiyon);
  const elEng = c.suruculer.filter(s => s.elendi).map(s => s.driver), tr = H.elTrue.elendi;
  m.elenenPPozitif = c.suruculer.filter(s => s.elendi && s.championshipProbability > 0).length;
  m.yanlisEleme = elEng.filter(d => tr[d] === false).length;           // motor eledi, gerçekte elenmemiş
  m.kacanEleme = Object.keys(tr).filter(d => tr[d] && ids.indexOf(d) >= 0 && elEng.indexOf(d) < 0).length;   // gerçekte elenmiş, motor elememiş
  m.elenenSampiyon = elEng.indexOf(H.sampiyon) >= 0;
  m.aralikIhlal = p.filter(x => x < 0 || x > 1).length;
  const canliGercek = Object.keys(tr).filter(d => !tr[d]); m.garantiGercek = canliGercek.length === 1 ? canliGercek[0] : null;
  m.garantiOk = m.garantiGercek == null ? null : (p[ids.indexOf(m.garantiGercek)] === 1);
  m.bire = p.filter(x => x === 1).length;                                // 1 yalnız garanti varsa
  m.fazlaGuven = p.some(x => x >= 0.9) && !(canliGercek.length === 1);
  return m;
}
function ozet(liste) {
  const n = liste.length, ort = k => liste.reduce((a, b) => a + b[k], 0) / n;
  return { n: n, pSampiyon: ort("pSampiyon"), brier: ort("brier"), logLoss: ort("logLoss"), birinci: liste.filter(x => x.birinci).length / n, ilk3: liste.filter(x => x.ilk3).length / n, toplamMin: Math.min.apply(null, liste.map(x => x.toplam)), toplamMax: Math.max.apply(null, liste.map(x => x.toplam)) };
}
function kovalar(satirlar, sinir) {   // satirlar: [{p,y}]
  const k = sinir.slice(0, -1).map((a, i) => ({ aralik: [a, sinir[i + 1]], n: 0, p: 0, y: 0 }));
  satirlar.forEach(s => { for (let j = 0; j < k.length; j++) { if (s.p >= k[j].aralik[0] && s.p < k[j].aralik[1]) { k[j].n++; k[j].p += s.p; k[j].y += s.y; break; } } });
  return k.map(b => ({ aralik: b.aralik, n: b.n, ortTahmin: b.n ? b.p / b.n : null, gozlenen: b.n ? b.y / b.n : null }));
}
module.exports = { L, TM, ESKI, ORANLAR, checkpointlar, gercekPuanlar, sprintPuanlari, kalanSprint, suruculer, dogruEleme, bazA, bazB, olc, hazirla, motorCalistir, degerle, ozet, kovalar };
