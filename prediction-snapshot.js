/* PREDICTION SNAPSHOT + EVALUATION v1 — Tahminlerin geçmiş değerleri kaybolmasın; yarış bitince model başarısı ölçülebilsin.
   • Yeni model / ağırlık / ayar YOK. Motor çıktısı (TahminMotoru.racePredict → suruculer[].win/podium/pointsProbability) AYNEN saklanır.
   • Aşamalar: PRE_WEEKEND, POST_QUALIFYING, RACE_START_FROZEN. Yalnız yarış başlamadan ÖNCE hesaplanmış tahmin kaydedilir.
     RACE_START_FROZEN = yarış başladığında geçerli olan son yarış-öncesi tahmin (POST_QUALIFYING varsa o, yoksa PRE_WEEKEND).
   • Depo: localStorage "f1-tahmin-arsiv-v1" (yalnız bu cihaz; backend/hesap yok). Anahtar: "sezon-tur". Aynı aşama İKİNCİ KEZ yazılmaz
     (ilk kayıt korunur → tekrar yok, geçmiş değişmez). En çok 60 yarış tutulur (en eski silinir).
   • Değerlendirme (geliştirici aracı; arayüzde gösterilmez): TahminArsiv.degerlendir(kayit, sonuclar) — sonuclar Jolpica Results dizisi.
     Ölçüler backtest (testler/backtest/backtest-lib.js) ile aynı tanımlar: top-1, kazananın olasılığı, podyum kapsama, puan (top-10) kapsama,
     Brier (win/podium/points), log-loss (win). Eksik veri → null; veri uydurulmaz.
   • Ağ isteği, zamanlayıcı, yeni arayüz YOK. Konsoldan: TahminArsiv.liste(), TahminArsiv.ozet(sonuclarHaritasi). */
(function (kok) {
  "use strict";
  var ANAH = "f1-tahmin-arsiv-v1", MAKS = 60, EPS = 1e-6;
  var ASAMALAR = ["PRE_WEEKEND", "POST_QUALIFYING", "RACE_START_FROZEN"];
  var bellek = null;                                                  // localStorage yoksa (gizli mod) oturum içi yedek

  function oku() {
    try { var s = kok.localStorage && kok.localStorage.getItem(ANAH); if (s) { var o = JSON.parse(s); if (o && typeof o === "object") { return o; } } } catch (e) { /* bozuk/erişilemez */ }
    return bellek || {};
  }
  function yaz(o) {
    var k = Object.keys(o);
    if (k.length > MAKS) {                                            // en eski yarışlar (sezon, tur) silinir
      k.sort(function (a, b) { var x = a.split("-"), y = b.split("-"); return (+x[0] - +y[0]) || (+x[1] - +y[1]); });
      k.slice(0, k.length - MAKS).forEach(function (s) { delete o[s]; });
    }
    bellek = o;
    try { kok.localStorage && kok.localStorage.setItem(ANAH, JSON.stringify(o)); return true; } catch (e) { return false; }
  }
  function sayi(x) { return typeof x === "number" && isFinite(x); }
  function sikistir(pred) {                                           // [id, win, podium, points] — motor değerleri aynen
    if (!pred || !pred.suruculer || !pred.suruculer.length) { return null; }
    var l = pred.suruculer.filter(function (s) { return s && s.driver && sayi(s.winProbability); })
      .map(function (s) { return [String(s.driver), s.winProbability, sayi(s.podiumProbability) ? s.podiumProbability : null, sayi(s.pointsProbability) ? s.pointsProbability : null]; });
    return l.length ? l : null;
  }

  // t: { season, round, ad, raceBas (ms|null) } · asama: PRE_WEEKEND | POST_QUALIFYING · ts: tahminin hesaplandığı an (ms)
  function kaydet(t, asama, pred, ts) {
    if (!t || !sayi(+t.season) || !sayi(+t.round) || ASAMALAR.indexOf(asama) < 0 || asama === "RACE_START_FROZEN") { return false; }
    if (!sayi(ts) || (sayi(t.raceBas) && ts >= t.raceBas)) { return false; }   // yarış başladıktan sonra hesaplanan tahmin "yarış öncesi" diye saklanmaz
    var sur = sikistir(pred); if (!sur) { return false; }
    var o = oku(), key = +t.season + "-" + +t.round, k = o[key] || { season: +t.season, round: +t.round, ad: t.ad || null, raceBas: sayi(t.raceBas) ? t.raceBas : null, asamalar: {} };
    if (k.asamalar[asama]) { return false; }                          // tekrar yok: ilk kayıt korunur
    k.asamalar[asama] = { ts: ts, model: pred.model || null, mode: pred.mode || asama, suruculer: sur };
    if (!k.raceBas && sayi(t.raceBas)) { k.raceBas = t.raceBas; }
    o[key] = k; return yaz(o);
  }
  // Yarış başladıysa: başlangıçta geçerli olan son yarış-öncesi kaydı RACE_START_FROZEN olarak bir kez sabitler.
  function dondur(t, simdi) {
    if (!t || !sayi(t.raceBas) || !sayi(simdi) || simdi < t.raceBas) { return false; }
    var o = oku(), key = +t.season + "-" + +t.round, k = o[key];
    if (!k || k.asamalar.RACE_START_FROZEN) { return false; }
    var aday = ["POST_QUALIFYING", "PRE_WEEKEND"].map(function (a) { return k.asamalar[a] ? { a: a, v: k.asamalar[a] } : null; })
      .filter(function (x) { return x && x.v.ts < t.raceBas; })[0];
    if (!aday) { return false; }
    k.asamalar.RACE_START_FROZEN = { ts: aday.v.ts, model: aday.v.model, mode: aday.v.mode, kaynakAsama: aday.a, sabitlendi: t.raceBas, suruculer: aday.v.suruculer };
    o[key] = k; return yaz(o);
  }

  // ---------- değerlendirme ----------
  // sonuclar: Jolpica Results [{position|positionText, points, Driver:{driverId}}]; yalnız sınıflandırılmış sıra kullanılır.
  function gercekKur(sonuclar) {
    if (!sonuclar || !sonuclar.length) { return null; }
    var sira = sonuclar.map(function (r) { return { id: r && r.Driver && r.Driver.driverId, p: Number(r && r.position) }; })
      .filter(function (x) { return x.id && sayi(x.p) && x.p > 0; }).sort(function (a, b) { return a.p - b.p; });
    if (!sira.length || sira[0].p !== 1) { return null; }
    return { kazanan: sira[0].id, podyum: sira.slice(0, 3).map(function (x) { return x.id; }), ilk10: sira.slice(0, 10).map(function (x) { return x.id; }), hepsi: sira.map(function (x) { return x.id; }) };
  }
  function sirala(sur, i) { return sur.filter(function (s) { return sayi(s[i]); }).slice().sort(function (a, b) { return b[i] - a[i] || (a[0] < b[0] ? -1 : 1); }).map(function (s) { return s[0]; }); }
  function asamaOlc(v, g) {
    var sur = v.suruculer, n = sur.length;
    var winSira = sirala(sur, 1), podSira = sirala(sur, 2), ptsSira = sirala(sur, 3);
    var kaz = sur.filter(function (s) { return s[0] === g.kazanan; })[0] || null;
    var brier = function (i, kume) {
      var ok = sur.filter(function (s) { return sayi(s[i]); }); if (!ok.length) { return null; }
      return ok.reduce(function (a, s) { var y = kume.indexOf(s[0]) >= 0 ? 1 : 0; return a + Math.pow(s[i] - y, 2); }, 0) / ok.length;
    };
    var ptsN = Math.min(10, g.ilk10.length);
    return {
      pilotSayisi: n,
      top1: winSira[0] === g.kazanan,
      kazananOlasiligi: kaz ? kaz[1] : null,                             // kazanan tahmin listesinde yoksa null
      kazananSirasi: kaz ? winSira.indexOf(g.kazanan) + 1 : null,
      podyumIsabet: podSira.length ? podSira.slice(0, 3).filter(function (d) { return g.podyum.indexOf(d) >= 0; }).length : null,   // 0–3
      puanKapsama: ptsSira.length && ptsN ? ptsSira.slice(0, ptsN).filter(function (d) { return g.ilk10.indexOf(d) >= 0; }).length / ptsN : null,
      brierWin: brier(1, [g.kazanan]), brierPodium: brier(2, g.podyum), brierPoints: brier(3, g.ilk10),
      logLossWin: kaz ? -Math.log(Math.max(kaz[1], EPS)) : null
    };
  }
  function degerlendir(kayit, sonuclar) {
    var g = gercekKur(sonuclar); if (!kayit || !kayit.asamalar) { return null; }
    var out = { season: kayit.season, round: kayit.round, ad: kayit.ad || null, sonucVar: !!g, asamalar: {} };
    ASAMALAR.forEach(function (a) { out.asamalar[a] = (g && kayit.asamalar[a]) ? asamaOlc(kayit.asamalar[a], g) : null; });
    return out;
  }
  // sonucHaritasi: { "2026-21": JolpicaResults[] , ... } → aşama başına ortalamalar (yalnız ölçülebilen yarışlar; n ile birlikte)
  function ozet(sonucHaritasi) {
    var o = oku(), r = { yaris: 0, asamalar: {} };
    ASAMALAR.forEach(function (a) { r.asamalar[a] = { n: 0, top1: 0, kazananOlasiligi: [], podyumIsabet: [], puanKapsama: [], brierWin: [], brierPodium: [], brierPoints: [], logLossWin: [] }; });
    Object.keys(o).forEach(function (key) {
      var d = degerlendir(o[key], sonucHaritasi && sonucHaritasi[key]); if (!d || !d.sonucVar) { return; }
      r.yaris++;
      ASAMALAR.forEach(function (a) {
        var m = d.asamalar[a], t = r.asamalar[a]; if (!m) { return; }
        t.n++; if (m.top1) { t.top1++; }
        ["kazananOlasiligi", "podyumIsabet", "puanKapsama", "brierWin", "brierPodium", "brierPoints", "logLossWin"].forEach(function (f) { if (sayi(m[f])) { t[f].push(m[f]); } });
      });
    });
    ASAMALAR.forEach(function (a) {
      var t = r.asamalar[a], ort = function (l) { return l.length ? l.reduce(function (x, y) { return x + y; }, 0) / l.length : null; };
      r.asamalar[a] = t.n ? { n: t.n, top1Orani: t.top1 / t.n, ortKazananOlasiligi: ort(t.kazananOlasiligi), ortPodyumIsabet: ort(t.podyumIsabet),
        ortPuanKapsama: ort(t.puanKapsama), brierWin: ort(t.brierWin), brierPodium: ort(t.brierPodium), brierPoints: ort(t.brierPoints), logLossWin: ort(t.logLossWin) } : { n: 0 };
    });
    return r;
  }
  function liste() { return oku(); }
  function temizle() { bellek = {}; try { kok.localStorage && kok.localStorage.removeItem(ANAH); } catch (e) { /* önemsiz */ } }

  var API = { ANAH: ANAH, ASAMALAR: ASAMALAR, kaydet: kaydet, dondur: dondur, degerlendir: degerlendir, ozet: ozet, liste: liste, temizle: temizle, _gercekKur: gercekKur };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
  if (kok) { kok.TahminArsiv = API; }
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
