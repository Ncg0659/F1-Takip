/* AI PREDICTION DATA LAYER v1 — Prediction Engine için tek, deterministik feature set. TAHMİN YÜZDESİ, UI, LLM, haber/sosyal sinyal YOK.
   Kaynaklar (yeni kaynak yok): Jolpica (sonuç/grid/qualifying/pit/takvim), telemetry-data.js (OpenF1 geçmiş), seans-hava-veri.js (OpenF1 geçmiş hava), icerik-pistler.js + pist-siniflandirma.js.
   Eksik/erişilemeyen alan = null (tahmin/uydurma yok). ERS/batarya, fren sıcaklığı, lastik enerjisi, downforce, lastik aşınması: HİÇBİR kaynakta yok → null.
   VERİ SIZINTISI KORUMASI: hedef yarış (S, R) için yalnız (sezon<S) veya (sezon==S ve tur<R) yarış sonuçları kullanılır; R'nin sonucu/gridi/puanı/hızlı turu/yarış havası HİÇBİR yoldan girmez.
   Modlar: PRE_WEEKEND (yalnız önceki yarışlar) · POST_QUALIFYING (+ R'nin qualifying sonucu/gridi ve R'nin Qualifying seansı hava/telemetrisi; yarış sonucu yine yok).
   Sezon penceresi: en fazla son 5 sezon (hedef sezon dahil), ağırlık tek yerde: sezonAgirligi(). Henüz optimize edilmedi (deterministik başlangıç değerleri).
   Önbellek: sezon verisi (results/qualifying/takvim) ve feature (sezon/tur/sürücü/mod) bellekte; yalnız DOLU + başarılı yanıt tutulur, boş/başarısız asla; eşzamanlı aynı istek tek fetch. */
(function (kok) {
  "use strict";

  var MODLAR = { PRE_WEEKEND: "PRE_WEEKEND", POST_QUALIFYING: "POST_QUALIFYING" };
  var SEZON_PENCERE = 5, FORM_N = 5;
  var AGIRLIK = [1.0, 0.6, 0.4, 0.25, 0.15];          // fark 0 (hedef sezon) … 4; pencere dışı 0

  // ---------- TEK AĞIRLIK FONKSİYONU ----------
  function sezonAgirligi(hedefSezon, sezon) {
    var f = Number(hedefSezon) - Number(sezon);
    return (isFinite(f) && f >= 0 && f < SEZON_PENCERE) ? AGIRLIK[f] : 0;
  }

  function sayi(v) { if (v == null || v === "") { return null; } var n = Number(v); return isFinite(n) ? n : null; }
  function ortalama(l) { return l.length ? l.reduce(function (a, b) { return a + b; }, 0) / l.length : null; }
  function agirlikliOrt(cift) {      // [{x,w}] → Σwx/Σw ; boşsa null
    var sw = 0, sx = 0; cift.forEach(function (c) { if (c.x != null && c.w > 0) { sw += c.w; sx += c.w * c.x; } });
    return sw > 0 ? sx / sw : null;
  }
  function yuvarla(x, n) { return x == null ? null : Math.round(x * Math.pow(10, n)) / Math.pow(10, n); }
  function egim(l) {                 // kronolojik dizi için en küçük kareler eğimi; <2 nokta → null
    if (l.length < 2) { return null; }
    var n = l.length, mx = (n - 1) / 2, my = ortalama(l), a = 0, b = 0;
    l.forEach(function (y, i) { a += (i - mx) * (y - my); b += (i - mx) * (i - mx); });
    return b ? a / b : null;
  }

  // ---------- Normalize (Jolpica → düz satırlar) ----------
  var RE_BITIS = /^finished$|^\+\d+ laps?$|lapped/i;
  function sonuclariNormalle(mr, sezon) {
    var out = [];
    (((mr || {}).RaceTable || {}).Races || []).forEach(function (r) {
      var tur = sayi(r.round); if (tur == null) { return; }
      var cid = r.Circuit && r.Circuit.circuitId || null;
      (r.Results || []).forEach(function (x) {
        if (!x || !x.Driver || !x.Constructor) { return; }
        var sinif = /^\d+$/.test(String(x.positionText != null ? x.positionText : x.position));
        var g = sayi(x.grid);
        out.push({ season: Number(sezon), round: tur, circuitId: cid, driverId: x.Driver.driverId, code: x.Driver.code || null, constructorId: x.Constructor.constructorId,
                   grid: g != null && g > 0 ? g : null, finish: sinif ? sayi(x.position) : null, points: sayi(x.points), status: x.status || null,
                   dnf: !RE_BITIS.test(String(x.status || "")) });
      });
    });
    return out;
  }
  function qualiNormalle(mr, sezon) {
    var out = [];
    (((mr || {}).RaceTable || {}).Races || []).forEach(function (r) {
      var tur = sayi(r.round); if (tur == null) { return; }
      (r.QualifyingResults || []).forEach(function (x) {
        if (!x || !x.Driver || !x.Constructor) { return; }
        out.push({ season: Number(sezon), round: tur, driverId: x.Driver.driverId, code: x.Driver.code || null, constructorId: x.Constructor.constructorId, position: sayi(x.position) });
      });
    });
    return out;
  }
  // Sprint puan kuralı (API 'points' alanı tercih edilir; bu tablo yalnız üst sınır ve tutarlılık denetimi içindir): 2021 → 3-2-1, 2022+ → 8…1, öncesi sprint yok
  function sprintKurali(y) { y = Number(y); return y >= 2022 ? [8, 7, 6, 5, 4, 3, 2, 1] : (y === 2021 ? [3, 2, 1] : []); }
  function sprintNormalle(mr, sezon) {
    var out = [];
    (((mr || {}).RaceTable || {}).Races || []).forEach(function (r) {
      var tur = sayi(r.round); if (tur == null) { return; }
      (r.SprintResults || []).forEach(function (x) {
        if (!x || !x.Driver || !x.Driver.driverId) { return; }
        out.push({ season: Number(sezon), round: tur, driverId: x.Driver.driverId, position: sayi(x.position), positionText: x.positionText != null ? String(x.positionText) : null, points: sayi(x.points), status: x.status || null });
      });
    });
    return out;
  }
  function takvimNormalle(mr, sezon) {
    return (((mr || {}).RaceTable || {}).Races || []).map(function (r) {
      return { season: Number(sezon), round: sayi(r.round), raceName: r.raceName || null, date: r.date || null, time: r.time || null, circuitId: r.Circuit && r.Circuit.circuitId || null, kayit: r };
    }).filter(function (r) { return r.round != null; });
  }

  function once(a, b) { return a.season !== b.season ? a.season - b.season : a.round - b.round; }
  // SIZINTI SÜZGECİ: hedef (S,R)'den kesinlikle önceki yarışlar + sezon penceresi
  function gecmisMi(satir, S, R) { return satir.season < S ? (S - satir.season) < SEZON_PENCERE : (satir.season === S && satir.round < R); }

  // ---------- Saf feature hesapları ----------
  function formHesap(satirlar, deger, S) {   // satirlar: kronolojik (eskiden yeniye) pilot satırları; deger(satir) → sayı|null
    var son = satirlar.slice(-FORM_N), liste = son.map(function (s) { return { s: s, v: deger(s) }; });
    var v = liste.map(function (c) { return c.v; }).filter(function (x) { return x != null; });
    if (!son.length) { return null; }
    return { n: son.length, degerler: liste.map(function (c) { return c.v; }), oncekiTurlar: son.map(function (s) { return s.season + "-" + s.round; }),
             ortalama: yuvarla(ortalama(v), 3), agirlikliOrtalama: yuvarla(agirlikliOrt(liste.map(function (c) { return { x: c.v, w: sezonAgirligi(S, c.s.season) }; })), 3),
             sonDeger: son.length ? liste[liste.length - 1].v : null, egim: yuvarla(egim(v), 3) };   // egim > 0 = değer büyüyor (pozisyon için: kötüleşme)
  }

  function gridFinish(satirlar, S) {
    var l = satirlar.filter(function (s) { return s.grid != null && s.finish != null; });
    if (!l.length) { return null; }
    var d = function (s) { return s.grid - s.finish; };     // + = grid'den ilerledi
    return { n: l.length, ortalamaDelta: yuvarla(ortalama(l.map(d)), 3), agirlikliDelta: yuvarla(agirlikliOrt(l.map(function (s) { return { x: d(s), w: sezonAgirligi(S, s.season) }; })), 3),
             son5Delta: yuvarla(ortalama(l.slice(-FORM_N).map(d)), 3) };
  }
  function guvenilirlik(satirlar, S) {
    if (!satirlar.length) { return null; }
    var w = satirlar.map(function (s) { return { x: s.dnf ? 1 : 0, w: sezonAgirligi(S, s.season) }; });
    var oran = agirlikliOrt(w);
    return { n: satirlar.length, dnf: satirlar.filter(function (s) { return s.dnf; }).length, dnfOrani: yuvarla(ortalama(satirlar.map(function (s) { return s.dnf ? 1 : 0; })), 3),
             agirlikliDnfOrani: yuvarla(oran, 3), bitirmeOrani: yuvarla(oran == null ? null : 1 - oran, 3) };
  }

  function sonucAnahtar(s) { return s.season + "-" + s.round; }

  function ozetTelemetri(t) {   // t: telemetry-data turTelemetri sonucu. HAM örnekler dışarı çıkmaz.
    var o = (t && t.ornekler) || [];
    var sp = o.map(function (r) { return r.speed; }).filter(function (x) { return x != null; });
    var th = o.map(function (r) { return r.throttle; }).filter(function (x) { return x != null; });
    var br = o.map(function (r) { return r.brake; }).filter(function (x) { return x != null; });
    var gr = o.map(function (r) { return r.gear; }).filter(function (x) { return x != null; });
    var rp = o.map(function (r) { return r.rpm; }).filter(function (x) { return x != null; });
    var dag = null;
    if (gr.length) { dag = {}; gr.forEach(function (g) { dag[g] = (dag[g] || 0) + 1; }); Object.keys(dag).forEach(function (g) { dag[g] = yuvarla(dag[g] / gr.length, 4); }); }
    var profil = null, ts = o.filter(function (r) { return r.t != null && r.speed != null; });
    if (ts.length >= 10 && t.tur && t.tur.duration) {      // 10 eşit zaman dilimi, dilim içi ortalama hız (ölçülen örneklerden; boş dilim null)
      var toplamMs = t.tur.duration * 1000; profil = [];
      for (var i = 0; i < 10; i++) {
        var a = toplamMs * i / 10, b = toplamMs * (i + 1) / 10, d = ts.filter(function (r) { return r.t >= a && (r.t < b || (i === 9 && r.t <= b)); });
        profil.push(d.length ? yuvarla(ortalama(d.map(function (r) { return r.speed; })), 1) : null);
      }
    }
    return {
      lapTime: t.tur ? t.tur.duration : null, lap: t.lap == null ? null : t.lap, sectors: t.tur ? { s1: t.tur.s1, s2: t.tur.s2, s3: t.tur.s3 } : null,
      speed: sp.length ? { ortalama: yuvarla(ortalama(sp), 2), max: Math.max.apply(null, sp), min: Math.min.apply(null, sp) } : null,
      speedProfile10: profil,
      throttle: th.length ? { ortalama: yuvarla(ortalama(th), 2), tamGazOrani: yuvarla(th.filter(function (x) { return x >= 98; }).length / th.length, 4) } : null,
      brake: br.length ? { fren_orani: yuvarla(br.filter(function (x) { return x > 0; }).length / br.length, 4) } : null,
      gearDistribution: dag, rpm: rp.length ? { ortalama: yuvarla(ortalama(rp), 0), max: Math.max.apply(null, rp), min: Math.min.apply(null, rp) } : null,
      stint: t.stint ? { stint: t.stint.stint, compound: t.stint.compound, lapStart: t.stint.lapStart, lapEnd: t.stint.lapEnd } : null,
      ersBatarya: null, frenSicakligi: null, lastikEnerjisi: null, ornekSayisi: o.length
    };
  }

  function havaOzet(h) {   // seans-hava-veri özetinden
    if (!h || h.durum !== "ok" || !h.ozet) { return null; }
    var z = h.ozet, ort = function (m) { return m && m.min != null && m.max != null ? yuvarla((m.min + m.max) / 2, 1) : null; };
    var yg = z.yagis && z.yagis.olcumVar ? z.yagis.goruldu : null;
    return { kosul: yg === null ? null : (yg ? "wet" : "dry"), yagis: yg, havaSicakligi: ort(z.hava), pistSicakligi: ort(z.pist), maxRuzgar: z.maxRuzgar == null ? null : z.maxRuzgar };
  }

  // ---------- Fabrika ----------
  // deps: { jolpica(yol)→{tur,veri}, telemetri?, hava?(yarisKaydi, seansAnahtari)→{durum,ozet}, pistler?, siniflandirma?, pit?:bool, gecmisHava?:bool }
  function kur(deps) {
    deps = deps || {};
    var veriOnb = {}, ozOnb = {}, bekleyen = {}, sayac = { jolpica: 0 };

    async function ham(yol) {
      sayac.jolpica++;
      try { var r = await deps.jolpica(yol); return r || { tur: "hata", veri: null }; } catch (e) { return { tur: "hata", veri: null }; }
    }
    async function tekil(k, depo, getir) {
      if (Object.prototype.hasOwnProperty.call(depo, k)) { return depo[k]; }
      if (bekleyen[k]) { return bekleyen[k]; }
      bekleyen[k] = (async function () { var s = await getir(); if (s && s.durum === "ok") { depo[k] = s; } return s; })();
      try { return await bekleyen[k]; } finally { delete bekleyen[k]; }
    }
    async function sayfali(yol, anahtar, normal) {    // Jolpica limit<=100: sayfa sayfa; herhangi sayfa başarısızsa TÜMÜ başarısız (kısmi veri cache'lenmez)
      var tum = [], off = 0, toplam = null;
      for (var g = 0; g < 12; g++) {
        var r = await ham(yol + "?limit=100&offset=" + off);
        if (r.tur !== "ok" || !r.veri) { return { durum: r.tur === "bos" ? "bos" : "hata" }; }
        tum = tum.concat(normal(r.veri)); toplam = sayi(r.veri.total);
        var sayfaSatir = ((r.veri.RaceTable || {}).Races || []).reduce(function (a, x) { return a + (x[anahtar] || []).length; }, 0);
        off += 100; if (!sayfaSatir || toplam == null || off >= toplam) { break; }
      }
      return tum.length ? { durum: "ok", satirlar: tum } : { durum: "bos" };
    }
    // ---- kalıcı arşiv (opsiyonel deps.arsiv {oku, yaz}): tamamlanmış sezonlar bir kez; güncel sezon yalnız eksik turlar tur-bazlı ----
    function arsivOku(k) { try { var r = deps.arsiv && deps.arsiv.oku ? deps.arsiv.oku(k) : null; return r && r.v === 1 && Array.isArray(r.satirlar) && r.satirlar.length && sayi(r.son) != null ? r : null; } catch (e) { return null; } }
    function arsivYaz(k, r) { try { if (deps.arsiv && deps.arsiv.yaz) { deps.arsiv.yaz(k, r); } } catch (e) { /* önemsiz */ } }
    var TUR = { res: { yol: "results", anah: "Results", normal: sonuclariNormalle }, q: { yol: "qualifying", anah: "QualifyingResults", normal: qualiNormalle } };
    function enBuyukTur(l) { return l.reduce(function (a, x) { return x.round != null && x.round > a ? x.round : a; }, 0); }
    async function sezonVeri(tur, y, S, ust) {          // ust: güncel sezonda gereken en yüksek tur; geçmiş sezon tamamen alınır
      var c = TUR[tur], ak = tur + "/" + y, arc = arsivOku(ak);
      if (arc) {
        if (y < S || arc.son >= ust) { return { durum: "ok", satirlar: arc.satirlar }; }
        var rows = arc.satirlar.slice(), son = arc.son;
        for (var r = son + 1; r <= ust; r++) {
          var x = await ham(y + "/" + r + "/" + c.yol + "/?limit=100");
          if (x.tur !== "ok" || !x.veri) { break; }
          var n = c.normal(x.veri, y); if (!n.length) { break; }
          rows = rows.concat(n); son = r;
        }
        if (son > arc.son) { arsivYaz(ak, { v: 1, son: son, satirlar: rows, ts: Date.now() }); }
        return { durum: "ok", satirlar: rows };
      }
      var sy = await sayfali(y + "/" + c.yol + "/", c.anah, function (mr) { return c.normal(mr, y); });
      if (sy.durum === "ok") { arsivYaz(ak, { v: 1, son: enBuyukTur(sy.satirlar), satirlar: sy.satirlar, ts: Date.now() }); }
      return sy;
    }
    function veriAnahtar(tur, y, S, ust) { return tur + "/" + y + (y === S ? "/" + ust : ""); }
    function sezonSonuc(y, S, R) { var ust = R - 1; return tekil(veriAnahtar("res", y, S, ust), veriOnb, function () { return sezonVeri("res", y, S, ust); }); }
    function sezonQuali(y, S, ust) { return tekil(veriAnahtar("q", y, S, ust), veriOnb, function () { return sezonVeri("q", y, S, ust); }); }
    function sezonTakvim(y) {
      return tekil("cal/" + y, veriOnb, async function () {
        if (deps.takvim) { try { var hz = deps.takvim(y), t0 = hz ? takvimNormalle(hz, y) : []; if (t0.length) { return { durum: "ok", takvim: t0 }; } } catch (e) { /* ağdan al */ } }
        var r = await ham(y + "/races/?limit=100");
        if (r.tur !== "ok" || !r.veri) { return { durum: r.tur === "bos" ? "bos" : "hata" }; }
        var t = takvimNormalle(r.veri, y); return t.length ? { durum: "ok", takvim: t } : { durum: "bos" };
      });
    }
    // ---- SPRINT (şampiyonluk motoru için): tamamlanan sprint puanları + kalan sprint (gerçek takvimden) + veri tamlığı ----
    // Önce kalıcı arşiv (tur başına), sonra uygulamanın mevcut sprint önbelleği (deps.sprintOnbellek), son olarak TEK sayfalı fetch (eşzamanlı aynı istek tek; başarısız/boş önbelleğe girmez).
    function paylasilanSprint(S) {
      try {
        var v = deps.sprintOnbellek ? deps.sprintOnbellek(S) : null; if (!v || !Array.isArray(v.satir)) { return null; }
        return v.satir.map(function (r) { return { season: S, round: sayi(r[0]), driverId: r[1], position: sayi(r[4]), positionText: r[5] != null ? String(r[5]) : null, points: sayi(r[6]), status: r[7] || null }; }).filter(function (x) { return x.round != null && x.driverId; });
      } catch (e) { return null; }
    }
    async function sprintSatirlari(S, gerekli, ust) {    // → { durum:"ok", tur:{round:[satir]}, eksik:[round], kaynak }
      var tur = {}, eksik = [], kaynak = "arsiv";
      gerekli.forEach(function (r) { var a = arsivOku("spr/" + S + "/" + r); if (a) { tur[r] = a.satirlar; } else { eksik.push(r); } });
      if (!eksik.length) { return { durum: "ok", tur: tur, eksik: [], kaynak: kaynak }; }
      var pay = paylasilanSprint(S);
      if (pay) { var kalan = []; eksik.forEach(function (r) { var l = pay.filter(function (x) { return x.round === r; }); if (l.length) { tur[r] = l; } else { kalan.push(r); } }); eksik = kalan; kaynak = "paylasilan"; }
      if (!eksik.length) { return { durum: "ok", tur: tur, eksik: [], kaynak: kaynak }; }
      var sy = await tekil("spr/" + S + "/" + ust, veriOnb, function () { return sayfali(S + "/sprint/", "SprintResults", function (mr) { return sprintNormalle(mr, S); }); });
      if (sy.durum !== "ok") { return { durum: sy.durum === "bos" ? "bos" : "hata", tur: tur, eksik: eksik, kaynak: "ag" }; }
      var kalan2 = [];
      eksik.forEach(function (r) { var l = sy.satirlar.filter(function (x) { return x.round === r; }); if (l.length) { tur[r] = l; arsivYaz("spr/" + S + "/" + r, { v: 1, son: r, satirlar: l, ts: Date.now() }); } else { kalan2.push(r); } });
      return { durum: "ok", tur: tur, eksik: kalan2, kaynak: "ag" };
    }
    async function sprintOzeti(g) {
      var S = sayi(g && g.season), R = sayi(g && g.round);
      if (S == null || R == null) { return { durum: "gecersiz" }; }
      var kural = sprintKurali(S), maxP = kural.length ? kural[0] : 0;
      var o = { durum: "ok", season: S, round: R, sprintDataComplete: false, neden: null, completedSprintCount: 0, completedSprintPoints: 0, remainingSprintCount: null, remainingSprintMaxPoints: null,
                driverSprintPoints: {}, eksikSprintTurlari: [], kuralUyumsuz: 0, kaynak: null, sprintMax: maxP };
      var tk = await sezonTakvim(S);
      if (tk.durum !== "ok") { o.neden = "takvim-yok"; return o; }                       // program bilinmiyor → kalan sprint bilinmiyor → tam değil
      var spr = tk.takvim.filter(function (r) { return r.kayit && r.kayit.Sprint && r.kayit.Sprint.date; }).map(function (r) { return r.round; }).sort(function (a, b) { return a - b; });
      var bitmis = spr.filter(function (r) { return r < R; }), kalanL = spr.filter(function (r) { return r >= R; });
      o.remainingSprintCount = kalanL.length; o.remainingSprintMaxPoints = kalanL.length * maxP; o.completedSprintCount = bitmis.length;
      if (!bitmis.length) { o.sprintDataComplete = true; o.kaynak = "yok"; return o; }       // henüz sprint koşulmadı: istek yok
      var sv = await sprintSatirlari(S, bitmis, bitmis[bitmis.length - 1]);
      o.kaynak = sv.kaynak; o.eksikSprintTurlari = sv.eksik.slice();
      var toplam = 0, bozuk = 0;
      bitmis.forEach(function (r) { (sv.tur[r] || []).forEach(function (x) {
        if (x.points == null || x.points < 0 || x.points > maxP) { bozuk++; return; }
        o.driverSprintPoints[x.driverId] = (o.driverSprintPoints[x.driverId] || 0) + x.points; toplam += x.points;
        var beklenen = x.position != null && /^\d+$/.test(String(x.positionText != null ? x.positionText : x.position)) ? (kural[x.position - 1] || 0) : null;
        if (beklenen != null && beklenen !== x.points) { o.kuralUyumsuz++; }
      }); });
      o.completedSprintPoints = toplam;
      if (sv.durum !== "ok" && sv.eksik.length === bitmis.length) { o.durum = "hata"; o.neden = "sprint-sonucu-alinamadi"; o.driverSprintPoints = {}; o.completedSprintPoints = 0; return o; }
      if (sv.eksik.length) { o.neden = "sprint-sonucu-eksik"; return o; }
      if (bozuk) { o.neden = "puan-kural-disi"; return o; }
      o.sprintDataComplete = true; return o;
    }
    function sezonPit(y, tur) {
      return tekil("pit/" + y + "/" + tur, veriOnb, async function () {
        var r = await ham(y + "/" + tur + "/pitstops/?limit=100");
        if (r.tur !== "ok" || !r.veri) { return { durum: r.tur === "bos" ? "bos" : "hata" }; }
        var l = [];
        (((r.veri.RaceTable || {}).Races || [])).forEach(function (x) { (x.PitStops || []).forEach(function (p) { var d = sayi(p.duration); if (d != null) { l.push({ driverId: p.driverId, lap: sayi(p.lap), duration: d }); } }); });
        return l.length ? { durum: "ok", pitler: l } : { durum: "bos" };
      });
    }

    function gecerliGirdi(g) { return g && sayi(g.season) != null && sayi(g.round) != null && g.driver && (g.mode === MODLAR.PRE_WEEKEND || g.mode === MODLAR.POST_QUALIFYING); }

    // g: { season, round, driver (Jolpica driverId), mode }
    function ozellik(g) {
      if (!gecerliGirdi(g)) { return Promise.resolve({ durum: "gecersiz" }); }
      var S = Number(g.season), R = Number(g.round), k = [S, R, g.driver, g.mode].join("/");
      return tekil(k, ozOnb, function () { return uret(S, R, String(g.driver), g.mode); });
    }

    async function uret(S, R, driverId, mod) {
      var eksik = [], gecmis = [], quali = [], takvim = null, y, i;
      for (i = 0; i < SEZON_PENCERE; i++) {
        y = S - i;
        var rs = await sezonSonuc(y, S, R);
        if (rs.durum === "ok") { gecmis = gecmis.concat(rs.satirlar); }
        else if (i === 0) { if (R > 1) { return { durum: rs.durum }; } else { eksik.push(y); } }   // hedef sezon: R=1 ise sonuç olmaması normal; aksi halde başarısız
        else { eksik.push(y); }
        if (i === 0) { var tk = await sezonTakvim(y); if (tk.durum === "ok") { takvim = tk.takvim; } }
      }
      // qualifying TEMBEL: yalnız hedef sezon; eski sezon, pilotun son 10 / takımın son 5 turu için gerekiyorsa (çıktı tam arşivle birebir aynı)
      var sonRes = gecmis.filter(function (x) { return x.driverId === driverId && gecmisMi(x, S, R); }).sort(once), sonTid = sonRes.length ? sonRes[sonRes.length - 1].constructorId : null;
      for (i = 0; i < SEZON_PENCERE; i++) {
        y = S - i;
        var qs = await sezonQuali(y, S, mod === MODLAR.POST_QUALIFYING ? R : R - 1); if (qs.durum === "ok") { quali = quali.concat(qs.satirlar); }
        var hq0 = quali.filter(function (x) { return x.season === S && x.round === R && x.driverId === driverId; })[0], tid = mod === MODLAR.POST_QUALIFYING && hq0 ? hq0.constructorId : sonTid;
        var qg = quali.filter(function (x) { return gecmisMi(x, S, R); }), dq = qg.filter(function (x) { return x.driverId === driverId; }).length, trn = {};
        qg.forEach(function (x) { if (x.constructorId === tid) { trn[sonucAnahtar(x)] = 1; } });
        if (tid && dq >= FORM_N * 2 && Object.keys(trn).length >= FORM_N) { break; }
      }
      // ---- SIZINTI SÜZGECİ (tek nokta): hedef yarış ve sonrası dışarıda ----
      var gecmisSonuc = gecmis.filter(function (s) { return gecmisMi(s, S, R); }).sort(once);
      var gecmisQuali = quali.filter(function (s) { return gecmisMi(s, S, R); }).sort(once);
      var hedefQuali = mod === MODLAR.POST_QUALIFYING ? quali.filter(function (s) { return s.season === S && s.round === R && s.driverId === driverId; })[0] || null : null;
      if (mod === MODLAR.POST_QUALIFYING && !hedefQuali) { delete veriOnb[veriAnahtar("q", S, S, R)]; return { durum: "bos", neden: "qualifying-yok" }; }   // hedef tur henüz yayımlanmadı: sezon önbelleği bayat kalmasın
      var hedefTakvim = takvim ? takvim.filter(function (t) { return t.round === R; })[0] || null : null;
      var circuitId = hedefTakvim ? hedefTakvim.circuitId : null;

      var pil = gecmisSonuc.filter(function (s) { return s.driverId === driverId; });
      if (!pil.length && !hedefQuali) { return { durum: "bos", neden: "pilot-gecmisi-yok" }; }
      var sonSatir = pil[pil.length - 1] || null;
      var takimId = hedefQuali ? hedefQuali.constructorId : (sonSatir ? sonSatir.constructorId : null);
      var kod = (pil[pil.length - 1] && pil[pil.length - 1].code) || (hedefQuali && hedefQuali.code) || null;

      // ---- pilot ----
      var pilQ = gecmisQuali.filter(function (s) { return s.driverId === driverId; });
      var cariSezon = gecmisSonuc.filter(function (s) { return s.season === S; });
      var puanTablosu = {}; cariSezon.forEach(function (s) { puanTablosu[s.driverId] = (puanTablosu[s.driverId] || 0) + (s.points || 0); });
      var sirali = Object.keys(puanTablosu).sort(function (a, b) { return puanTablosu[b] - puanTablosu[a]; });
      var recentForm = formHesap(pil, function (s) { return s.finish; }, S);
      if (recentForm) {
        var pS = cariSezon.filter(function (s) { return s.driverId === driverId; });
        recentForm.sezonPuani = pS.length ? pS.reduce(function (a, s) { return a + (s.points || 0); }, 0) : (cariSezon.length ? 0 : null);
        recentForm.sezonSirasi = pS.length ? sirali.indexOf(driverId) + 1 : null;
        recentForm.son5Puan = pil.slice(-FORM_N).reduce(function (a, s) { return a + (s.points || 0); }, 0);
      }
      var qualifyingForm = formHesap(pilQ, function (s) { return s.position; }, S);
      if (hedefQuali) { qualifyingForm = qualifyingForm || { n: 0, degerler: [], oncekiTurlar: [], ortalama: null, agirlikliOrtalama: null, sonDeger: null, egim: null }; qualifyingForm.buHaftaQualifying = hedefQuali.position; }
      var gf = gridFinish(pil, S) || null;
      if (hedefQuali) { gf = gf || { n: 0, ortalamaDelta: null, agirlikliDelta: null, son5Delta: null }; gf.buHaftaGrid = hedefQuali.position; }   // yarış gridi yerine qualifying sırası (ceza/pit-lane başlangıcı bilinmez)
      var reliability = guvenilirlik(pil, S);

      // takım arkadaşı kıyası (aynı yarış, aynı takım, diğer pilot[lar])
      var td = null;
      if (pil.length) {
        var cift = [], qc = [];
        pil.slice(-FORM_N * 2).forEach(function (s) {
          var es = gecmisSonuc.filter(function (x) { return x.season === s.season && x.round === s.round && x.constructorId === s.constructorId && x.driverId !== driverId && x.finish != null; });
          if (s.finish != null && es.length) { cift.push({ x: ortalama(es.map(function (e) { return e.finish; })) - s.finish, w: sezonAgirligi(S, s.season) }); }
        });
        pilQ.slice(-FORM_N * 2).forEach(function (s) {
          var es = gecmisQuali.filter(function (x) { return x.season === s.season && x.round === s.round && x.constructorId === s.constructorId && x.driverId !== driverId && x.position != null; });
          if (s.position != null && es.length) { qc.push({ x: ortalama(es.map(function (e) { return e.position; })) - s.position, w: sezonAgirligi(S, s.season) }); }
        });
        cift = cift.slice(-FORM_N); qc = qc.slice(-FORM_N);
        td = (cift.length || qc.length) ? { yarisN: cift.length, yarisFinishDelta: yuvarla(agirlikliOrt(cift), 3), qualifyingN: qc.length, qualifyingDelta: yuvarla(agirlikliOrt(qc), 3), aciklama: "pozitif = pilot takım arkadaşının önünde" } : null;
      }

      // ---- pist ----
      var pistVeri = deps.pistler && circuitId && deps.pistler[circuitId] || null, kat = deps.siniflandirma && circuitId ? deps.siniflandirma.kategoriOf(circuitId) : null;
      var pistSatir = circuitId ? gecmisSonuc.filter(function (s) { return s.circuitId === circuitId; }) : [];
      var pistPil = pistSatir.filter(function (s) { return s.driverId === driverId; }), pistTakim = takimId ? pistSatir.filter(function (s) { return s.constructorId === takimId; }) : [];
      var ob = pistSatir.filter(function (s) { return s.grid != null && s.finish != null; });
      var track = { circuitId: circuitId, uzunlukKm: pistVeri && pistVeri.uzunlukKm != null ? pistVeri.uzunlukKm : null, kategori: kat || null, sokak: kat ? kat === "sokak" : null,
                    gridFinishDavranisi: ob.length ? { n: ob.length, ortalamaMutlakDeger: yuvarla(agirlikliOrt(ob.map(function (s) { return { x: Math.abs(s.grid - s.finish), w: sezonAgirligi(S, s.season) }; })), 3) } : null,
                    wetDryGecmisi: null, downforce: null, lastikAsinmasi: null };
      var trackHistory = circuitId ? { circuitId: circuitId, pilot: pistPil.length ? { n: pistPil.length, yarislar: pistPil.map(function (s) { return { season: s.season, round: s.round, grid: s.grid, finish: s.finish, dnf: s.dnf }; }),
                                  agirlikliFinish: yuvarla(agirlikliOrt(pistPil.map(function (s) { return { x: s.finish, w: sezonAgirligi(S, s.season) }; })), 3) } : null,
                                  takim: pistTakim.length ? { n: pistTakim.length, agirlikliFinish: yuvarla(agirlikliOrt(pistTakim.map(function (s) { return { x: s.finish, w: sezonAgirligi(S, s.season) }; })), 3), puan: pistTakim.reduce(function (a, s) { return a + (s.points || 0); }, 0) } : null } : null;

      // wet/dry geçmişi (yalnız bu pistte GEÇMİŞ yarışların kendi havası; hedef yarışınki değil)
      if (deps.hava && deps.gecmisHava && circuitId && pistSatir.length) {
        var turlar = {}; pistSatir.forEach(function (s) { turlar[sonucAnahtar(s)] = s; });
        var anahtarlar = Object.keys(turlar).sort(function (a, b) { return once(turlar[a], turlar[b]); }).slice(-SEZON_PENCERE), wet = 0, n = 0;
        for (i = 0; i < anahtarlar.length; i++) {
          var tt = turlar[anahtarlar[i]], tk2 = await sezonTakvim(tt.season);
          var kayit = tk2.durum === "ok" ? tk2.takvim.filter(function (t) { return t.round === tt.round; })[0] : null;
          if (!kayit) { continue; }
          var h = null; try { h = havaOzet(await deps.hava(kayit.kayit, "Race")); } catch (e) { h = null; } if (h && h.yagis != null) { n++; if (h.yagis) { wet++; } }
        }
        track.wetDryGecmisi = n ? { n: n, wetOrani: yuvarla(wet / n, 3) } : null;
      }

      // ---- takım ----
      var teamForm = null;
      if (takimId) {
        var tr = gecmisSonuc.filter(function (s) { return s.constructorId === takimId; }), rounds = {};
        tr.forEach(function (s) { var kk = sonucAnahtar(s); rounds[kk] = rounds[kk] || { season: s.season, round: s.round, puan: 0, finish: [] }; rounds[kk].puan += s.points || 0; if (s.finish != null) { rounds[kk].finish.push(s.finish); } });
        var rl = Object.keys(rounds).map(function (k2) { return rounds[k2]; }).sort(once), son5 = rl.slice(-FORM_N);
        var cs = {}; cariSezon.forEach(function (s) { cs[s.constructorId] = (cs[s.constructorId] || 0) + (s.points || 0); });
        var cSira = Object.keys(cs).sort(function (a, b) { return cs[b] - cs[a]; });
        var tq = gecmisQuali.filter(function (s) { return s.constructorId === takimId; });
        var qr = {}; tq.forEach(function (s) { var kk = sonucAnahtar(s); qr[kk] = qr[kk] || { season: s.season, round: s.round, p: [] }; if (s.position != null) { qr[kk].p.push(s.position); } });
        var ql = Object.keys(qr).map(function (k3) { return qr[k3]; }).sort(once).slice(-FORM_N).map(function (x) { return ortalama(x.p); }).filter(function (x) { return x != null; });
        var puanSeri = son5.map(function (r) { return r.puan; }), sezonRounds = rl.filter(function (r) { return r.season === S; });
        var yarisi = Math.floor(sezonRounds.length / 2);
        teamForm = { constructorId: takimId, constructorPuani: cs[takimId] != null ? cs[takimId] : (cariSezon.length ? 0 : null), constructorSirasi: cs[takimId] != null ? cSira.indexOf(takimId) + 1 : null,
                     son5Puan: { n: son5.length, seri: puanSeri, toplam: puanSeri.reduce(function (a, b) { return a + b; }, 0), egim: yuvarla(egim(puanSeri), 3) },
                     qualifyingTrend: { n: ql.length, ortalamaSira: yuvarla(ortalama(ql), 3), egim: yuvarla(egim(ql), 3) },
                     finishTrend: { ortalama: yuvarla(ortalama([].concat.apply([], son5.map(function (r) { return r.finish; }))), 3), egim: yuvarla(egim(son5.map(function (r) { return ortalama(r.finish); }).filter(function (x) { return x != null; })), 3) },
                     reliability: guvenilirlik(tr, S), pist: trackHistory && trackHistory.takim,
                     seziIciTrend: sezonRounds.length >= 4 ? { ilkYariOrtPuan: yuvarla(ortalama(sezonRounds.slice(0, yarisi).map(function (r) { return r.puan; })), 3), ikinciYariOrtPuan: yuvarla(ortalama(sezonRounds.slice(yarisi).map(function (r) { return r.puan; })), 3) } : null,
                     pit: null };
        if (deps.pit !== false) {   // pit: yalnız hedef sezonda, hedeften önceki son ≤5 yarış; takım ortalama stop süresi (kayıp/kazanç YOK, ham süre)
          var ptur = sezonRounds.slice(-FORM_N), sureler = [];
          for (i = 0; i < ptur.length; i++) {
            var pr = await sezonPit(S, ptur[i].round);
            if (pr.durum === "ok") {
              var uyeler = {}; gecmisSonuc.filter(function (s) { return s.season === S && s.round === ptur[i].round && s.constructorId === takimId; }).forEach(function (s) { uyeler[s.driverId] = 1; });
              pr.pitler.forEach(function (p) { if (uyeler[p.driverId]) { sureler.push(p.duration); } });
            }
          }
          teamForm.pit = sureler.length ? { n: sureler.length, ortalamaSure: yuvarla(ortalama(sureler), 3), enHizli: Math.min.apply(null, sureler) } : null;
        }
      }

      // ---- telemetri (geçmiş yarış hızlı turu | POST: bu haftanın Qualifying hızlı turu) ----
      var telemetrySummary = null;
      if (deps.telemetri && kod) {
        var kaynakSatir = null, seansAd = null;
        if (mod === MODLAR.POST_QUALIFYING) { kaynakSatir = hedefTakvim; seansAd = "Qualifying"; }
        else if (pil.length) { var sp = pil[pil.length - 1], tkv = await sezonTakvim(sp.season); kaynakSatir = tkv.durum === "ok" ? tkv.takvim.filter(function (t) { return t.round === sp.round; })[0] : null; seansAd = "Race"; }
        if (kaynakSatir) {
          try {
            var ob2 = await deps.telemetri.oturumBul(kaynakSatir.kayit, seansAd);
            if (ob2.durum === "ok") {
              var sr = await deps.telemetri.suruculer(ob2.oturum), no = sr.durum === "ok" ? sr.suruculer.filter(function (d) { return d.kod === kod; })[0] : null;
              if (no) {
                var tl = await deps.telemetri.enHizliTurTelemetri(ob2.oturum, no.driver);
                if (tl.durum === "ok") {
                  var st = await deps.telemetri.stintler(ob2.oturum);
                  telemetrySummary = Object.assign({ kaynak: { season: kaynakSatir.season, round: kaynakSatir.round, seans: seansAd } }, ozetTelemetri(tl.telemetri), { stintOzeti: st.durum === "ok" ? ozetStint(st.stintler.filter(function (s) { return s.driver === no.driver; })) : null });
                }
              }
            }
          } catch (e) { telemetrySummary = null; }
        }
      }

      // ---- hava (yalnız POST: bu haftanın QUALIFYING seansı; Race havası ASLA) ----
      var weatherContext = null;
      if (mod === MODLAR.POST_QUALIFYING && deps.hava && hedefTakvim) { try { weatherContext = havaOzet(await deps.hava(hedefTakvim.kayit, "Qualifying")); } catch (e) { weatherContext = null; } }

      return { durum: "ok", season: S, round: R, driver: driverId, team: takimId, track: track, mode: mod,
               recentForm: recentForm, qualifyingForm: qualifyingForm, gridFinishDelta: gf, reliability: reliability, teammateDelta: td, trackHistory: trackHistory,
               teamForm: teamForm, telemetrySummary: telemetrySummary, weatherContext: weatherContext, contextSignals: [],
               meta: { sezonAgirliklari: AGIRLIK.map(function (w, f) { return { sezon: S - f, agirlik: w }; }), eksikSezonlar: eksik, kullanilanYaris: gecmisSonuc.length, sonKullanilan: gecmisSonuc.length ? sonucAnahtar(gecmisSonuc[gecmisSonuc.length - 1]) : null } };
    }

    function ozetStint(l) {
      if (!l.length) { return null; }
      return { stintSayisi: l.length, compoundlar: l.map(function (s) { return s.compound; }), stintler: l.map(function (s) { return { stint: s.stint, compound: s.compound, lapStart: s.lapStart, lapEnd: s.lapEnd }; }) };
    }
    function temizle() { [veriOnb, ozOnb].forEach(function (d) { Object.keys(d).forEach(function (k) { delete d[k]; }); }); }
    return { ozellik: ozellik, sprintOzeti: sprintOzeti, temizle: temizle, _sayac: sayac, _onbellek: { veri: veriOnb, ozellik: ozOnb } };
  }

  var API = { kur: kur, sprintKurali: sprintKurali, MODLAR: MODLAR, sezonAgirligi: sezonAgirligi, SEZON_PENCERE: SEZON_PENCERE, AGIRLIK: AGIRLIK, ozetTelemetri: ozetTelemetri, havaOzet: havaOzet,
              sonuclariNormalle: sonuclariNormalle, qualiNormalle: qualiNormalle };
  // Tarayıcı örneği: mevcut istemci/önbellek/modüllerle bağlanır; yeni fetch yolu yok
  var JI = kok && kok.JolpicaIstemci;
  if (JI && JI.al) {
    var HV = kok.HaftaVeri, SHV = kok.SeansHavaVeri;
    API.varsayilan = kur({
      jolpica: function (yol) { return JI.al(yol).then(function (r) { return { tur: "ok", veri: r.veri }; }).catch(function () { return { tur: "hata", veri: null }; }); },
      telemetri: kok.TelemetriVeri || null,
      hava: (SHV && HV) ? function (kayit, seansAnahtari) {
        var hafta = HV.haftaKur(kayit, "f1"), seans = hafta.seanslar.filter(function (s) { return s.anahtar === seansAnahtari; })[0];
        return seans ? SHV.yukle(hafta, seans) : Promise.resolve({ durum: "oturum-yok" });
      } : null,
      pistler: kok.ICERIK_PISTLER && kok.ICERIK_PISTLER.pistler, siniflandirma: kok.PIST_SINIFLANDIRMA, gecmisHava: false
    });
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
  if (kok) { kok.TahminVeri = API; }
})(typeof window !== "undefined" ? window : null);
