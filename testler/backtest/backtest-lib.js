/* Prediction BACKTEST kütüphanesi (yalnız test/ölçüm aracı; uygulama kodu DEĞİL).
   Gerçek prediction-data.js + prediction-engine.js'i çalıştırır; ağ yerine verilen veri setinden Jolpica biçimli yanıt üretir.
   Veri seti: { seasons: { "2024": { toplam, tamamlanan, sampiyon, races:[{round, raceName, date, circuitId, sprint, results:[...], qualifying:[...]}] } } } */
"use strict";
const UYG = process.env.F1_UYG || "/home/claude/f1-takip/";
const TV = require(UYG + "prediction-data.js"), TM = require(UYG + "prediction-engine.js");
const EPS = 1e-6;

// ---------- Jolpica taklidi (veri setinden; gelecek verisi DE servis edilir → sızıntıyı veri katmanı süzmek zorunda) ----------
function taklitKur(ds) {
  const log = [], duz = {};
  function satirlar(y, tur) {
    const k = y + "/" + tur; if (duz[k]) { return duz[k]; }
    const s = ds.seasons[String(y)], out = [];
    if (s) { s.races.forEach(function (r) { const a = tur === "results" ? r.results : (tur === "sprint" ? (r.sprintResults || []) : r.qualifying); a.forEach(function (x) { out.push([r, x]); }); }); }
    return (duz[k] = out);
  }
  function meta(y, r) { return { season: String(y), round: String(r.round), raceName: r.raceName, date: r.date, Circuit: { circuitId: r.circuitId } }; }
  async function jolpica(yol) {
    log.push(yol);
    const m = yol.match(/^(\d{4})\/(results|qualifying|sprint)\/\?limit=100&offset=(\d+)/);
    if (!m) { return { tur: "bos", veri: null }; }
    const y = +m[1], tur = m[2], off = +m[3], f = satirlar(y, tur);
    if (!f.length) { return { tur: "bos", veri: null }; }
    const anah = tur === "results" ? "Results" : (tur === "sprint" ? "SprintResults" : "QualifyingResults"), by = {};
    f.slice(off, off + 100).forEach(function (p) { const r = p[0]; (by[r.round] = by[r.round] || Object.assign(meta(y, r), { [anah]: [] }))[anah].push(p[1]); });
    return { tur: "ok", veri: { total: String(f.length), RaceTable: { Races: Object.keys(by).map(function (k) { return by[k]; }) } } };
  }
  function takvim(y) { const s = ds.seasons[String(y)]; return s ? { RaceTable: { Races: s.races.map(function (r) { return Object.assign(meta(y, r), { Circuit: { circuitId: r.circuitId } }, r.sprint ? { Sprint: { date: r.date } } : {}); }) } } : null; }
  return { jolpica: jolpica, takvim: takvim, log: log };
}
function veriKatmani(ds, ek) { const t = taklitKur(ds); return { tv: TV.kur(Object.assign({ jolpica: t.jolpica, takvim: t.takvim, pit: false }, ek || {})), taklit: t }; }

// ---------- gerçek sonuçlar ----------
function tamamlananlar(ds, s) { return ds.seasons[String(s)].races.filter(function (r) { return r.results.length; }); }
function gercek(race) {
  const w = null, rows = race.results, win = {}, pod = {}, pts = {};
  rows.forEach(function (x) { const p = parseInt(x.position, 10), id = x.Driver.driverId; win[id] = p === 1 ? 1 : 0; pod[id] = p >= 1 && p <= 3 ? 1 : 0; pts[id] = Number(x.points) > 0 ? 1 : 0; });
  return { win: win, pod: pod, pts: pts };
}

// ---------- olasılık normalizasyonu (baseline'lar için: toplam = slot, her biri ≤ 1) ----------
function slotlaCap(w, slot) {
  const top = w.reduce(function (a, b) { return a + b; }, 0); let p = w.map(function (x) { return x / top * slot; });
  for (let it = 0; it < 50; it++) {
    let fazla = 0, serbest = 0; p.forEach(function (x) { if (x > 1) { fazla += x - 1; } });
    if (fazla < 1e-12) { break; }
    p.forEach(function (x, i) { if (x >= 1) { p[i] = 1; } else { serbest += w[i]; } });
    if (serbest <= 0) { break; }
    p = p.map(function (x, i) { return x >= 1 ? 1 : x + fazla * w[i] / serbest; });
  }
  return p;
}
function agirliktanTahmin(ids, w) {
  const n = ids.length;
  return { ids: ids, win: slotlaCap(w, 1), pod: slotlaCap(w, Math.min(3, n)), pts: slotlaCap(w, Math.min(10, Math.ceil(n / 2))) };
}

// ---------- baseline'lar ----------
function sezonPuanlari(ds, S, R) {   // R'den ÖNCEKİ turların yarış puanları (R=1 ise önceki sezonun toplamı)
  const out = {}, s = ds.seasons[String(R > 1 ? S : S - 1)]; if (!s) { return out; }
  s.races.forEach(function (r) { if (R > 1 && r.round >= R) { return; } r.results.forEach(function (x) { out[x.Driver.driverId] = (out[x.Driver.driverId] || 0) + Number(x.points || 0); }); });
  return out;
}
function bazPre(ds, S, R, ids) { const p = sezonPuanlari(ds, S, R); return agirliktanTahmin(ids, ids.map(function (d) { return (p[d] || 0) + 1; })); }
function qualiPozisyon(race, id) { const x = race.qualifying.filter(function (q) { return q.Driver.driverId === id; })[0]; const p = x ? parseInt(x.position, 10) : NaN; return p > 0 ? p : null; }
function bazPost(ds, S, R, ids) {
  const race = ds.seasons[String(S)].races.filter(function (r) { return r.round === R; })[0];
  return agirliktanTahmin(ids, ids.map(function (d) { const g = qualiPozisyon(race, d); return 1 / (g || 25); }));
}
function gridTablosu(ds, sezonlar) {   // eğitim sezonlarından P(kazan/podyum/puan | başlangıç gridi) (Laplace)
  const t = {}; for (let g = 1; g <= 20; g++) { t[g] = { n: 0, w: 0, p: 0, q: 0 }; }
  sezonlar.forEach(function (s) { (ds.seasons[String(s)] ? tamamlananlar(ds, s) : []).forEach(function (r) { r.results.forEach(function (x) {
    const g = parseInt(x.grid, 10); if (!(g >= 1)) { return; } const c = t[Math.min(g, 20)], p = parseInt(x.position, 10);
    c.n++; if (p === 1) { c.w++; } if (p >= 1 && p <= 3) { c.p++; } if (Number(x.points) > 0) { c.q++; } }); }); });
  return t;
}
function bazGridEmp(ds, S, R, ids, tablo) {
  const race = ds.seasons[String(S)].races.filter(function (r) { return r.round === R; })[0];
  const gs = ids.map(function (d) { return qualiPozisyon(race, d) || 20; }), c = gs.map(function (g) { return tablo[Math.min(g, 20)]; });
  const n = ids.length;
  return { ids: ids, win: slotlaCap(c.map(function (x) { return (x.w + 0.5) / (x.n + 20); }), 1), pod: slotlaCap(c.map(function (x) { return (x.p + 0.5) / (x.n + 6); }), Math.min(3, n)), pts: slotlaCap(c.map(function (x) { return (x.q + 0.5) / (x.n + 2); }), Math.min(10, Math.ceil(n / 2))) };
}
function uniform(ids) { const n = ids.length; return agirliktanTahmin(ids, ids.map(function () { return 1; })); }

// ---------- backtest çalıştırıcı ----------
async function calistir(ds, o) {
  const tv = o.tv, out = [];
  for (const S of o.sezonlar) {
    for (const race of tamamlananlar(ds, S)) {
      const R = race.round, ids = race.results.map(function (x) { return x.Driver.driverId; }), g = gercek(race);
      for (const mod of o.modlar) {
        const f = await Promise.all(ids.map(function (d) { return tv.ozellik({ season: S, round: R, driver: d, mode: mod }); }));
        const ok = f.filter(function (x) { return x && x.durum === "ok"; }); if (!ok.length) { continue; }
        const pr = TM.racePredict(ok); if (pr.durum !== "ok") { continue; }
        out.push({ season: S, round: R, mode: mod, alan: ids.length, atlanan: ids.filter(function (d) { return !ok.some(function (x) { return x.driver === d; }); }),
                   suruculer: pr.suruculer.map(function (s) { return { driver: s.driver, win: s.winProbability, pod: s.podiumProbability, pts: s.pointsProbability, conf: s.confidence, sev: s.confidenceSeviye, nedenSayisi: s.reasons.length }; }),
                   gercek: g, ozellikler: o.ozellikleriTut ? ok : undefined });
      }
    }
  }
  return out;
}
function motorSatir(t) {
  const ids = t.suruculer.map(function (s) { return s.driver; });
  return { ids: ids, win: t.suruculer.map(function (s) { return s.win; }), pod: t.suruculer.map(function (s) { return s.pod; }), pts: t.suruculer.map(function (s) { return s.pts; }) };
}

// ---------- ölçüler ----------
function sirala(ids, p) { return ids.map(function (d, i) { return [d, p[i]]; }).sort(function (a, b) { return b[1] - a[1] || (a[0] < b[0] ? -1 : 1); }).map(function (x) { return x[0]; }); }
function olc(satirlar) {   // satirlar: [{ids,win,pod,pts,gercek}]
  let n = 0, bw = 0, bp = 0, bq = 0, bwr = 0, ll = 0, llN = 0, top1 = 0, top3 = 0, pw = 0, podCov = 0, ptsCov = 0, kayip = 0;
  satirlar.forEach(function (r) {
    r.ids.forEach(function (d, i) { const yw = r.gercek.win[d] || 0, yp = r.gercek.pod[d] || 0, yq = r.gercek.pts[d] || 0; bw += Math.pow(r.win[i] - yw, 2); bp += Math.pow(r.pod[i] - yp, 2); bq += Math.pow(r.pts[i] - yq, 2); bwr += Math.pow(r.win[i] - yw, 2); n++; });
    const wi = r.ids.findIndex(function (d) { return r.gercek.win[d] === 1; });
    if (wi < 0) { kayip++; ll += -Math.log(EPS); llN++; } else { const p = r.win[wi]; ll += -Math.log(Math.max(p, EPS)); llN++; pw += p; }
    const sw = sirala(r.ids, r.win), win = r.ids.find(function (d) { return r.gercek.win[d] === 1; });
    if (win && sw[0] === win) { top1++; } if (win && sw.slice(0, 3).indexOf(win) >= 0) { top3++; }
    const sp = sirala(r.ids, r.pod).slice(0, 3), sq = sirala(r.ids, r.pts).slice(0, Math.min(10, Math.ceil(r.ids.length / 2)));
    podCov += sp.filter(function (d) { return r.gercek.pod[d] === 1; }).length / Math.min(3, r.ids.length);
    ptsCov += sq.filter(function (d) { return r.gercek.pts[d] === 1; }).length / sq.length;
  });
  const R = satirlar.length;
  return { yaris: R, satir: n, brierWin: bw / n, brierWinYarisBasina: bwr / R, brierPodium: bp / n, brierPoints: bq / n, logLossWin: ll / llN, top1: top1 / R, top3: top3 / R, ortKazananOlasiligi: pw / R, podiumKapsama: podCov / R, pointsKapsama: ptsCov / R, kazananAlanDisi: kayip };
}
function beceriSkoru(b, ref) { return 1 - b / ref; }
function kovalar(satirlar, anah, sinirlar, minN) {
  const k = sinirlar.slice(0, -1).map(function (a, i) { return { aralik: [a, sinirlar[i + 1]], n: 0, toplamP: 0, toplamY: 0 }; });
  const yk = { win: "win", pod: "pod", pts: "pts" }[anah];
  satirlar.forEach(function (r) { r.ids.forEach(function (d, i) {
    const p = r[anah][i], y = r.gercek[yk][d] || 0;
    for (let j = 0; j < k.length; j++) { if (p >= k[j].aralik[0] && p < k[j].aralik[1]) { k[j].n++; k[j].toplamP += p; k[j].toplamY += y; break; } } }); });
  return k.map(function (b) { return { aralik: b.aralik, n: b.n, ortTahmin: b.n ? b.toplamP / b.n : null, gozlenen: b.n ? b.toplamY / b.n : null, yeterliOrnek: b.n >= (minN || 30) }; });
}
function guvenGruplari(tahminler) {   // seviye → ortalama hata (win/podium/points Brier) ve satır sayısı
  const g = {};
  tahminler.forEach(function (t) { t.suruculer.forEach(function (s) {
    const x = g[s.sev] = g[s.sev] || { n: 0, bw: 0, bp: 0, bq: 0, toplamConf: 0 };
    x.n++; x.bw += Math.pow(s.win - (t.gercek.win[s.driver] || 0), 2); x.bp += Math.pow(s.pod - (t.gercek.pod[s.driver] || 0), 2); x.bq += Math.pow(s.pts - (t.gercek.pts[s.driver] || 0), 2); x.toplamConf += s.conf; }); });
  const o = {}; Object.keys(g).forEach(function (k) { const x = g[k]; o[k] = { n: x.n, ortConf: x.toplamConf / x.n, brierWin: x.bw / x.n, brierPodium: x.bp / x.n, brierPoints: x.bq / x.n }; });
  return o;
}

// ---------- şampiyonluk ----------
function sprintKalan(ds, S, R) { return ds.seasons[String(S)].races.filter(function (r) { return r.round >= R && r.sprint; }).length; }
async function sampiyonlukOlc(ds, tv, sezonlar, oranlar) {
  const out = [];
  for (const S of sezonlar) {
    const s = ds.seasons[String(S)]; if (!s || !s.sampiyon) { continue; }
    for (const oran of oranlar) {
      const k = Math.round(oran * s.toplam), R = k + 1, race = s.races.filter(function (r) { return r.round === R; })[0]; if (!race || R > s.tamamlanan) { continue; }
      const ids = race.results.map(function (x) { return x.Driver.driverId; });
      const f = await Promise.all(ids.map(function (d) { return tv.ozellik({ season: S, round: R, driver: d, mode: "PRE_WEEKEND" }); })), ok = f.filter(function (x) { return x && x.durum === "ok"; });
      const c = TM.championshipPredict(ok, { toplamYaris: s.toplam, kalanSprint: sprintKalan(ds, S, R) }); if (c.durum !== "ok") { continue; }
      const pts = sezonPuanlari(ds, S, R), pid = c.suruculer.map(function (x) { return x.driver; });
      const wt = pid.map(function (d) { return (pts[d] || 0) + 1; }), top = wt.reduce(function (a, b) { return a + b; }, 0), bp = wt.map(function (x) { return x / top; });
      const yy = pid.map(function (d) { return d === s.sampiyon ? 1 : 0; }), pm = c.suruculer.map(function (x) { return x.championshipProbability || 0; });
      const brier = function (p) { return p.reduce(function (a, x, i) { return a + Math.pow(x - yy[i], 2); }, 0); };
      const ci = pid.indexOf(s.sampiyon), pr = c.suruculer.filter(function (x) { return x.championshipProbability != null; }).map(function (x) { return x.driver; });
      out.push({ season: S, oran: oran, tamamlananTur: k, sampiyon: s.sampiyon, sampiyonAlanda: ci >= 0, motorOlasilik: ci >= 0 ? pm[ci] : null, baselineOlasilik: ci >= 0 ? bp[ci] : null,
                 motorSira: ci >= 0 ? pr.indexOf(s.sampiyon) + 1 : null, baselineSira: ci >= 0 ? sirala(pid, bp).indexOf(s.sampiyon) + 1 : null,
                 motorBrier: ci >= 0 ? brier(pm) : null, baselineBrier: ci >= 0 ? brier(bp) : null,
                 sampiyonElendiMi: ci >= 0 ? !!c.suruculer[ci].elendi : null, kalanYaris: c.kalanYaris, lider: pid[pm.indexOf(Math.max.apply(null, pm))], motorLiderOlasilik: Math.max.apply(null, pm) });
    }
  }
  return out;
}

module.exports = { TV, TM, taklitKur, veriKatmani, tamamlananlar, gercek, slotlaCap, agirliktanTahmin, sezonPuanlari, bazPre, bazPost, bazGridEmp, gridTablosu, uniform, calistir, motorSatir, olc, beceriSkoru, kovalar, guvenGruplari, sirala, sampiyonlukOlc, qualiPozisyon };
