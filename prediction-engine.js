/* prediction-engine.js — F1 TAKİP Tahmin Motoru v1
 * Deterministik, açıklanabilir ağırlıklı skorlama. UI/ağ/LLM bağımlılığı YOK.
 * Girdi: TahminVeri.ozellik() çıktıları (feature set). contextSignals kullanılmaz (ağırlık 0).
 * API: racePredict(featureSet[]), championshipPredict(featureSet[], {toplamYaris, kalanSprint}), explain(sonuc)
 * Çıktılar yalnız olasılıktır (0–1). */
(function (kok) {
  "use strict";

  // ===== TEK YERDE AĞIRLIKLAR / PARAMETRELER =====
  var AGIRLIK = {
    PRE_WEEKEND:     { recentForm: 0.25, qualifyingForm: 0.20, grid: 0.00, teamForm: 0.22, reliability: 0.08, trackHistory: 0.10, teammateDelta: 0.05, telemetrySummary: 0.10 },
    POST_QUALIFYING: { recentForm: 0.057, qualifyingForm: 0.043, grid: 0.65, teamForm: 0.115, reliability: 0.033, trackHistory: 0.037, teammateDelta: 0.011, telemetrySummary: 0.054 },   // kalibrasyon v2→v3: grid .35→.55→.65 (2025+2026 belirgin iyi, 2024 eşit; ileri-zincir doğrulama)
    contextSignals: 0,            // haber/basın katmanı için ayrıldı; şimdilik kullanılmaz
    weatherContext: 0             // doğrudan skor etkisi yok; yalnız dağılım sıcaklığı (YAGMUR_CARPAN) ve güven
  };
  var P = {
    ALAN_REFERANS: 20,            // pozisyon → skor dönüşümünde referans grid büyüklüğü
    SICAKLIK: {                    // softmax sıcaklığı (küçük = daha keskin) — kalibrasyon v2: moda göre, TEK yerde
      PRE_WEEKEND:     { win: 0.12, podium: 0.20, points: 0.40 },
      POST_QUALIFYING: { win: 0.06, podium: 0.125, points: 0.325 }
    },
    YAGMUR_CARPAN: 1.3,           // ıslak yarışta dağılım daha belirsiz (daha düz)
    FORM_N: 5,
    GUVEN: { HIGH: 0.75, MEDIUM: 0.50 },
    // güven v3: yarış-düzeyi güven (kapsam + olasılık ayrışması). Eşikler/durum geçmiş yarış hatasıyla ölçülür (backtest); ilişki monotonik değilse UNRELIABLE.
    GUVEN_V3: {
      FORMUL: { wKapsam: 0.30, wFark: 0.35, farkRef: 0.25, wP1: 0.35, p1Ref: 0.45 },
      PRE_WEEKEND:     { durum: "UNRELIABLE", HIGH: null, MEDIUM: null },
      POST_QUALIFYING: { durum: "UNRELIABLE", HIGH: null, MEDIUM: null }
    },
    GUVEN_EKSIK_SEZON: 0.05,      // eksik sezon başına güven düşüşü
    GUVEN_HAVA_YOK_POST: 0.05,    // POST'ta hava bilgisi yoksa
    MAX_NEDEN: 5,
    NEDEN_ESIK: 0.02,
    SKOR_GUCLU: 0.70, SKOR_ZAYIF: 0.30,
    DNF_YUKSEK: 0.15, DNF_DUSUK: 0.05,
    SAMPIYONLUK: { MIN_P: 0.001, ERKEN_CAP: { ALT_ILERLEME: 0.30, UST_ILERLEME: 0.45, CAP_ALT: 0.80 }, MAX_YARIS_PUANI: 25, SPRINT_MAX: 8, FORM_PILOT: 0.6, FORM_TAKIM: 0.4, DNF_ETKI: 0.5, YAYILIM: 4, UST_SINIR: 0.99 }
  };
  var YASAK = /kesin|garanti|kazanacak/i;

  function sayiMi(x) { return typeof x === "number" && isFinite(x); }
  function kisit(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function yuvarla(x, n) { var k = Math.pow(10, n == null ? 4 : n); return Math.round(x * k) / k; }
  function posSkor(p) { return sayiMi(p) ? kisit(1 - (p - 1) / (P.ALAN_REFERANS - 1), 0, 1) : null; }
  function seviye(c) { return c >= P.GUVEN.HIGH ? "HIGH" : (c >= P.GUVEN.MEDIUM ? "MEDIUM" : "LOW"); }
  function g(o, yol) { var c = o; for (var i = 0; i < yol.length; i++) { if (c == null) { return null; } c = c[yol[i]]; } return c == null ? null : c; }

  // ===== FAKTÖR SKORLARI (0–1, yüksek = iyi; veri yoksa null) =====
  function faktorler(f, ctx, mod) {
    var o = {}, kal = {};   // kal: veri kalitesi 0–1
    var rf = f.recentForm, qf = f.qualifyingForm;
    o.recentForm = rf && rf.n ? posSkor(rf.agirlikliOrtalama != null ? rf.agirlikliOrtalama : rf.ortalama) : null;
    kal.recentForm = rf && rf.n ? Math.min(1, rf.n / P.FORM_N) : 0;
    o.qualifyingForm = qf && qf.n ? posSkor(qf.agirlikliOrtalama != null ? qf.agirlikliOrtalama : qf.ortalama) : null;
    kal.qualifyingForm = qf && qf.n ? Math.min(1, qf.n / P.FORM_N) : 0;
    // grid yalnız POST_QUALIFYING'de (PRE'de zaten feature'da yok)
    var grid = mod === "POST_QUALIFYING" ? (g(f, ["gridFinishDelta", "buHaftaGrid"]) != null ? f.gridFinishDelta.buHaftaGrid : g(f, ["qualifyingForm", "buHaftaQualifying"])) : null;
    o.grid = posSkor(grid); kal.grid = o.grid == null ? 0 : 1;
    // takım
    var tf = f.teamForm, trel = null;
    if (tf && tf.son5Puan && sayiMi(tf.son5Puan.toplam) && ctx.maxTakimPuan > 0) { trel = tf.son5Puan.toplam / ctx.maxTakimPuan; }
    var trank = tf && sayiMi(tf.constructorSirasi) && ctx.takimSayisi > 1 ? kisit(1 - (tf.constructorSirasi - 1) / (ctx.takimSayisi - 1), 0, 1) : null;
    o.teamForm = trel == null ? trank : (trank == null ? trel : 0.7 * trel + 0.3 * trank);
    kal.teamForm = o.teamForm == null ? 0 : Math.min(1, ((tf.son5Puan && tf.son5Puan.n) || P.FORM_N) / P.FORM_N);
    // güvenilirlik
    var rl = f.reliability;
    o.reliability = rl && rl.n && sayiMi(rl.agirlikliDnfOrani) ? kisit(1 - 2 * rl.agirlikliDnfOrani, 0, 1) : null;
    kal.reliability = o.reliability == null ? 0 : 1;
    // pist geçmişi (pilot, yoksa takım)
    var th = f.trackHistory, tp = g(th, ["pilot", "agirlikliFinish"]), tt = g(th, ["takim", "agirlikliFinish"]);
    o.trackHistory = posSkor(tp != null ? tp : tt); kal.trackHistory = o.trackHistory == null ? 0 : (tp != null ? 1 : 0.6);
    // takım arkadaşı
    var td = g(f, ["teammateDelta", "yarisFinishDelta"]);
    o.teammateDelta = sayiMi(td) ? 0.5 + 0.5 * (Math.exp(td / 4) - Math.exp(-td / 4)) / (Math.exp(td / 4) + Math.exp(-td / 4)) : null;
    kal.teammateDelta = o.teammateDelta == null ? 0 : 1;
    // telemetri: alan içi min–max
    var sp = g(f, ["telemetrySummary", "speed", "ortalama"]);
    if (sayiMi(sp) && ctx.hizAralik && ctx.hizAralik.n >= 2) { o.telemetrySummary = ctx.hizAralik.max === ctx.hizAralik.min ? 0.5 : (sp - ctx.hizAralik.min) / (ctx.hizAralik.max - ctx.hizAralik.min); }
    else { o.telemetrySummary = null; }
    kal.telemetrySummary = o.telemetrySummary == null ? 0 : 1;
    return { skor: o, kalite: kal, gridPos: grid };
  }

  function bilesik(fk, w) {
    var top = 0, ag = 0;
    Object.keys(w).forEach(function (k) { if (w[k] > 0 && fk.skor[k] != null) { top += w[k] * fk.skor[k]; ag += w[k]; } });
    return ag > 0 ? top / ag : null;   // mevcut faktörlerin ağırlığı yeniden normalize edilir
  }
  function kapsam(fk, w, f, mod) {
    var toplam = 0, var_ = 0;
    Object.keys(w).forEach(function (k) { if (w[k] > 0) { toplam += w[k]; var_ += w[k] * (fk.kalite[k] || 0); } });
    var c = toplam > 0 ? var_ / toplam : 0;
    var es = g(f, ["meta", "eksikSezonlar"]); if (es && es.length) { c -= P.GUVEN_EKSIK_SEZON * es.length; }
    if (mod === "POST_QUALIFYING" && f.weatherContext == null) { c -= P.GUVEN_HAVA_YOK_POST; }
    return kisit(c, 0, 1);
  }

  // ===== OLASILIK NORMALİZASYONU (toplam = slot; her biri ≤ 1) =====
  function dagit(skorlar, T, slot) {
    var n = skorlar.length, mx = Math.max.apply(null, skorlar), w = skorlar.map(function (s) { return Math.exp((s - mx) / T); });
    var toplamW = w.reduce(function (a, b) { return a + b; }, 0), p = w.map(function (x) { return x / toplamW * slot; });
    for (var it = 0; it < 50; it++) {
      var fazla = 0, serbest = 0;
      p.forEach(function (x) { if (x > 1) { fazla += x - 1; } });
      if (fazla < 1e-12) { break; }
      p.forEach(function (x, i) { if (x >= 1) { p[i] = 1; } else { serbest += w[i]; } });
      if (serbest <= 0) { break; }
      p = p.map(function (x, i) { return x >= 1 ? 1 : x + fazla * w[i] / serbest; });
    }
    return p.map(function (x) { return kisit(x, 0, 1); });
  }

  // ===== NEDENLER (yalnız feature'dan, şablon metin) =====
  var METIN = {
    recentForm: ["Son 5 yarış formu güçlü", "Son 5 yarış formu zayıf"],
    qualifyingForm: ["Qualifying formu yüksek", "Qualifying formu düşük"],
    grid: ["Başlangıç sırası ön sırada", "Başlangıç sırası arkada"],
    teamForm: ["Takım formu güçlü", "Takım formu zayıf"],
    trackHistory: ["Bu pistte geçmiş performansı güçlü", "Bu pistte geçmiş performansı zayıf"],
    teammateDelta: ["Takım arkadaşının önünde", "Takım arkadaşının gerisinde"],
    telemetrySummary: ["Telemetri hız özeti alanın üstünde", "Telemetri hız özeti alanın altında"],
    reliability: ["Bitirme güvenilirliği yüksek", "Reliability riski yüksek"],
    teamTrend: ["Takım formu yükselişte", "Takım formu düşüşte"],
    veriKapsami: [null, "Veri kapsamı sınırlı"]
  };
  function nedenler(f, fk, w, conf) {
    var aday = [];
    ["recentForm", "qualifyingForm", "grid", "teamForm", "trackHistory", "teammateDelta", "telemetrySummary"].forEach(function (k) {
      var s = fk.skor[k]; if (s == null || !(w[k] > 0)) { return; }
      var onem = w[k] * Math.abs(s - 0.5) * 2;
      if (onem < P.NEDEN_ESIK) { return; }
      if (s >= P.SKOR_GUCLU) { aday.push({ faktor: k, yon: "+", metin: METIN[k][0], onem: onem }); }
      else if (s <= P.SKOR_ZAYIF) { aday.push({ faktor: k, yon: "-", metin: METIN[k][1], onem: onem }); }
    });
    var rl = f.reliability;
    if (rl && rl.n && sayiMi(rl.agirlikliDnfOrani)) {
      if (rl.agirlikliDnfOrani >= P.DNF_YUKSEK) { aday.push({ faktor: "reliability", yon: "-", metin: METIN.reliability[1], onem: 0.5 + rl.agirlikliDnfOrani }); }
      else if (rl.agirlikliDnfOrani <= P.DNF_DUSUK && rl.n >= 10) { aday.push({ faktor: "reliability", yon: "+", metin: METIN.reliability[0], onem: w.reliability }); }
    }
    var egim = g(f, ["teamForm", "son5Puan", "egim"]), ort = g(f, ["teamForm", "son5Puan", "toplam"]), nn = g(f, ["teamForm", "son5Puan", "n"]);
    if (sayiMi(egim) && sayiMi(ort) && nn && ort > 0 && Math.abs(egim) > 0.1 * (ort / nn)) { aday.push({ faktor: "teamTrend", yon: egim > 0 ? "+" : "-", metin: METIN.teamTrend[egim > 0 ? 0 : 1], onem: 0.1 }); }
    aday.sort(function (a, b) { return b.onem - a.onem || (a.faktor < b.faktor ? -1 : 1); });
    var son = aday.slice(0, P.MAX_NEDEN);
    if (conf < P.GUVEN.MEDIUM) { if (son.length >= P.MAX_NEDEN) { son.pop(); } son.push({ faktor: "veriKapsami", yon: "-", metin: METIN.veriKapsami[1], onem: 0 }); }
    return son.map(function (a) { return { faktor: a.faktor, yon: a.yon, metin: a.metin }; });
  }

  // ===== GİRDİ DOĞRULAMA =====
  function hazirla(fs) {
    if (!Array.isArray(fs)) { return { durum: "gecersiz", neden: "featureSet-dizi-degil" }; }
    var atlanan = [], tekrar = [], goruldu = {}, liste = [];
    fs.forEach(function (f) {
      if (!f || f.durum !== "ok" || !f.driver) { atlanan.push(f && f.driver || null); return; }
      if (goruldu[f.driver]) { tekrar.push(f.driver); return; }
      goruldu[f.driver] = 1; liste.push(f);
    });
    if (!liste.length) { return { durum: "bos", neden: "gecerli-feature-yok", atlanan: atlanan }; }
    var a = liste[0];
    for (var i = 1; i < liste.length; i++) {
      if (liste[i].season !== a.season || liste[i].round !== a.round || liste[i].mode !== a.mode) { return { durum: "gecersiz", neden: "karisik-sezon-round-mod" }; }
    }
    if (!AGIRLIK[a.mode] || typeof AGIRLIK[a.mode] !== "object") { return { durum: "gecersiz", neden: "bilinmeyen-mod" }; }
    liste.sort(function (x, y) { return x.driver < y.driver ? -1 : (x.driver > y.driver ? 1 : 0); });
    return { durum: "ok", liste: liste, atlanan: atlanan, tekrar: tekrar };
  }
  function baglam(liste) {
    var takimlar = {}, maxT = 0, hizlar = [];
    liste.forEach(function (f) {
      if (f.team) { takimlar[f.team] = 1; }
      var t = g(f, ["teamForm", "son5Puan", "toplam"]); if (sayiMi(t) && t > maxT) { maxT = t; }
      var h = g(f, ["telemetrySummary", "speed", "ortalama"]); if (sayiMi(h)) { hizlar.push(h); }
    });
    return { takimSayisi: Object.keys(takimlar).length, maxTakimPuan: maxT,
             hizAralik: { n: hizlar.length, min: hizlar.length ? Math.min.apply(null, hizlar) : null, max: hizlar.length ? Math.max.apply(null, hizlar) : null } };
  }

  // ===== YARIŞ TAHMİNİ =====
  // yarış-düzeyi güven skoru (0–1): veri kapsamı + kazanan olasılığının ayrışması (top1–top2 farkı, top1 payı)
  function genelGuvenSkor(suruculer) {
    var F = P.GUVEN_V3.FORMUL, w = suruculer.map(function (s) { return s.winProbability; }).sort(function (x, y) { return y - x; });
    var ilk = suruculer.slice(0, 5), kap = ilk.reduce(function (a, s) { return a + (s.confidence || 0); }, 0) / (ilk.length || 1);
    var fark = (w[0] || 0) - (w[1] || 0), p1 = w[0] || 0;
    var sk = F.wKapsam * kap + F.wFark * Math.min(1, fark / F.farkRef) + F.wP1 * Math.min(1, p1 / F.p1Ref);
    return { skor: kisit(sk, 0, 1), kapsam: kap, fark: fark, p1: p1 };
  }
  function genelGuven(suruculer, mod) {
    var G = P.GUVEN_V3[mod], r = genelGuvenSkor(suruculer), sev;
    if (!G || G.durum !== "OK" || G.HIGH == null || G.MEDIUM == null) { sev = "UNRELIABLE"; }
    else { sev = r.skor >= G.HIGH ? "HIGH" : (r.skor >= G.MEDIUM ? "MEDIUM" : "LOW"); }
    return { seviye: sev, skor: yuvarla(r.skor, 3), sinyaller: { kapsam: yuvarla(r.kapsam, 3), top1Top2Fark: yuvarla(r.fark, 3), top1: yuvarla(r.p1, 3) } };
  }
  function racePredict(fs) {
    var h = hazirla(fs); if (h.durum !== "ok") { return h; }
    var liste = h.liste, mod = liste[0].mode, w = AGIRLIK[mod], ctx = baglam(liste);
    var satir = liste.map(function (f) {
      var fk = faktorler(f, ctx, mod), sk = bilesik(fk, w);
      return { f: f, fk: fk, skor: sk, conf: kapsam(fk, w, f, mod) };
    });
    var n = satir.length, podSlot = Math.min(3, n), ptSlot = Math.min(10, Math.ceil(n / 2));
    var yagmur = liste.some(function (f) { return g(f, ["weatherContext", "kosul"]) === "wet"; }) ? P.YAGMUR_CARPAN : 1;
    var skorlar = satir.map(function (s) { return s.skor == null ? 0 : s.skor; });   // skor yoksa nötr değil en düşük
    var TS = P.SICAKLIK[mod];
    var win = dagit(skorlar, TS.win * yagmur, 1), pod = dagit(skorlar, TS.podium * yagmur, podSlot), pts = dagit(skorlar, TS.points * yagmur, ptSlot);
    var cikti = satir.map(function (s, i) {
      var wi = win[i], pi = Math.max(pod[i], wi), qi = Math.max(pts[i], pi);   // mantıksal sıra: win ≤ podium ≤ points
      var conf = yuvarla(s.conf, 3), nedenListe = nedenler(s.f, s.fk, w, conf), faktorSkor = {};
      Object.keys(s.fk.skor).forEach(function (k) { faktorSkor[k] = s.fk.skor[k] == null ? null : yuvarla(s.fk.skor[k], 3); });
      return { driver: s.f.driver, team: s.f.team, winProbability: yuvarla(wi), podiumProbability: yuvarla(pi), pointsProbability: yuvarla(qi),
               confidence: conf, confidenceSeviye: seviye(conf), reasons: nedenListe, skor: s.skor == null ? null : yuvarla(s.skor, 4), faktorSkorlari: faktorSkor };
    });
    cikti.sort(function (a, b) { return b.winProbability - a.winProbability || (a.driver < b.driver ? -1 : 1); });
    var gg = genelGuven(cikti, mod);
    cikti.forEach(function (c) { c.kapsamSeviyesi = c.confidenceSeviye; c.confidenceSeviye = gg.seviye; });   // seviye artık yarış-düzeyi (v3); eski kapsam seviyesi ayrı alanda
    var wsum = cikti.reduce(function (a, b) { return a + b.winProbability; }, 0);
    return { durum: "ok", model: "agirlikli-skor-v1", mode: mod, season: liste[0].season, round: liste[0].round, suruculer: cikti,
             toplamlar: { win: yuvarla(wsum, 3), podium: podSlot, points: ptSlot },
             genelGuven: gg, meta: { agirliklar: w, atlanan: h.atlanan, tekrar: h.tekrar, contextSignalsKullanildi: false, yagmurCarpani: yagmur } };
  }

  // ===== ŞAMPİYONLUK =====
  // Sezon kuralı (sabit varsayım yok): en hızlı tur +1 puanı 2019–2024'te vardı (yarış başına en çok 26), 2025'te kalktı (25).
  // Sprint puanı: 2021'de ilk 3 (3-2-1, en çok 3), 2022'den itibaren ilk 8 (en çok 8); 2021 öncesi sprint yok.
  function sezonKurali(sezon) {
    var y = Number(sezon);
    if (!sayiMi(y)) { return { yarisMax: P.SAMPIYONLUK.MAX_YARIS_PUANI, sprintMax: P.SAMPIYONLUK.SPRINT_MAX, kaynak: "varsayilan" }; }
    return { yarisMax: (y >= 2019 && y <= 2024) ? 26 : 25, sprintMax: y < 2021 ? 0 : (y === 2021 ? 3 : 8), kaynak: "sezon-kurali" };
  }
  function championshipPredict(fs, opts) {
    opts = opts || {};
    var h = hazirla(fs); if (h.durum !== "ok") { return h; }
    var liste = h.liste, R = liste[0].round, S = P.SAMPIYONLUK;
    if (!sayiMi(opts.toplamYaris) || opts.toplamYaris < R) { return { durum: "kisit", neden: "toplam-yaris-yok" }; }
    var sp = opts.sprint && typeof opts.sprint === "object" ? opts.sprint : null, spEksik = !!sp && sp.sprintDataComplete === false;   // sprint verisi veri katmanından (TahminVeri.sprintOzeti)
    var tamam = R - 1, kalan = opts.toplamYaris - tamam, sprint = sp && sayiMi(sp.remainingSprintCount) ? sp.remainingSprintCount : (sayiMi(opts.kalanSprint) && opts.kalanSprint > 0 ? opts.kalanSprint : 0);
    var kural = sezonKurali(liste[0].season), maxKalan = kalan * kural.yarisMax + (sp && sayiMi(sp.remainingSprintMaxPoints) ? sp.remainingSprintMaxPoints : sprint * kural.sprintMax);
    var satir = liste.map(function (f) {
      var pu = g(f, ["recentForm", "sezonPuani"]); if (pu == null && R === 1) { pu = 0; }
      // Pilot puanı = yarış sonuçları (recentForm.sezonPuani, sprint İÇERMEZ) + tamamlanan sprint puanları; tek kez eklenir. Çağıran puanın sprinti zaten içerdiğini bildirirse (puanSprintDahil) eklenmez.
      if (pu != null && sp && !sp.puanSprintDahil && sp.driverSprintPoints && sayiMi(sp.driverSprintPoints[f.driver])) { pu += sp.driverSprintPoints[f.driver]; }
      return { f: f, puan: sayiMi(pu) ? pu : null };
    });
    var bilinen = satir.filter(function (s) { return s.puan != null; });
    if (!bilinen.length) { return { durum: "bos", neden: "puan-verisi-yok" }; }
    var lider = Math.max.apply(null, bilinen.map(function (s) { return s.puan; }));
    bilinen.forEach(function (s) {
      var f = s.f, rf = f.recentForm, tf = f.teamForm, pn = rf && rf.n ? rf.n : 0, ortP = pn && sayiMi(rf.son5Puan) ? rf.son5Puan / pn : null;
      var tn = g(tf, ["son5Puan", "n"]), tPu = g(tf, ["son5Puan", "toplam"]), ortT = tn && sayiMi(tPu) ? tPu / tn / 2 : null;   // takım ort. / 2 pilot
      var dnf = g(f, ["reliability", "agirlikliDnfOrani"]);
      var bekle = null;
      if (ortP != null || ortT != null) {
        bekle = ortP != null && ortT != null ? S.FORM_PILOT * ortP + S.FORM_TAKIM * ortT : (ortP != null ? ortP : ortT);
        if (sayiMi(dnf)) { bekle *= (1 - S.DNF_ETKI * dnf); }
      }
      s.bekle = bekle; s.elendi = spEksik ? false : s.puan + maxKalan < lider;   // sprint verisi eksikse puanlar eksik olabilir → matematiksel eleme YAPILMAZ
      s.proj = bekle == null ? null : s.puan + kalan * bekle;
    });
    var canli = bilinen.filter(function (s) { return !s.elendi; });
    var kesinlesti = !spEksik && canli.length === 1;
    var sonuc = {};
    if (kesinlesti) { canli[0].p = 1; }
    else {
      var projlu = canli.filter(function (s) { return s.proj != null; }), ref = projlu.length ? Math.max.apply(null, projlu.map(function (s) { return s.proj; })) : null;
      var T = Math.max(1, S.YAYILIM * Math.sqrt(Math.max(kalan, 0)) * 2.5), toplam = 0;
      canli.forEach(function (s) {
        // beklenti verisi yoksa mevcut puanı projeksiyon say (ek puan alamıyormuş gibi → temkinli, düşük)
        var pr = s.proj != null ? s.proj : s.puan;
        s.w = Math.exp((pr - (ref != null ? ref : lider)) / T); toplam += s.w;
      });
      canli.forEach(function (s) { s.p = s.w / toplam; });
      // sezon başı koruması: ilerleme <%30 iken en çok CAP_ALT, %45'te UST_SINIR'a doğrusal açılır (geçmiş sezonlarda %25'te 0.90+ olasılığı veri desteklemedi)
      var ilerleme = opts.toplamYaris > 0 ? tamam / opts.toplamYaris : 0, EC = S.ERKEN_CAP, ustSinir = ilerleme <= EC.ALT_ILERLEME ? EC.CAP_ALT : (ilerleme >= EC.UST_ILERLEME ? S.UST_SINIR : EC.CAP_ALT + (S.UST_SINIR - EC.CAP_ALT) * (ilerleme - EC.ALT_ILERLEME) / (EC.UST_ILERLEME - EC.ALT_ILERLEME));
      // 1 yalnız matematiksel olarak belliyse; aksi halde üst sınır, fazlası diğerlerine
      for (var it = 0; it < 20; it++) {
        var fazla = 0, serbest = 0;
        canli.forEach(function (s) { if (s.p > ustSinir) { fazla += s.p - ustSinir; } });
        if (fazla < 1e-12) { break; }
        canli.forEach(function (s) { if (s.p >= ustSinir) { s.p = ustSinir; } else { serbest += s.w; } });
        if (serbest <= 0) { break; }
        canli.forEach(function (s) { if (s.p < ustSinir) { s.p += fazla * s.w / serbest; } });
      }
    }
    if (!kesinlesti && canli.length > 1) {   // matematiksel eleme dışında gereksiz 0 yok: canlı pilota en az MIN_P, fazlası diğerlerinden orantılı alınır
      var MINP = S.MIN_P, acik = 0, esnek = 0;
      canli.forEach(function (c) { if (c.p < MINP) { acik += MINP - c.p; } else { esnek += c.p - MINP; } });
      if (acik > 0 && esnek > acik) { canli.forEach(function (c) { if (c.p < MINP) { c.p = MINP; } else { c.p -= acik * (c.p - MINP) / esnek; } }); }
    }
    var tamamlanma = opts.toplamYaris > 0 ? tamam / opts.toplamYaris : 0;
    var cikti = satir.map(function (s) {
      var f = s.f, p = s.puan == null ? null : (s.elendi ? 0 : (s.p != null ? s.p : 0)), nedenListe = [];
      var veriKal = (g(f, ["recentForm", "n"]) ? Math.min(1, f.recentForm.n / P.FORM_N) : 0) * 0.5 + (g(f, ["teamForm", "son5Puan", "n"]) ? Math.min(1, f.teamForm.son5Puan.n / P.FORM_N) : 0) * 0.3 + (sayiMi(g(f, ["reliability", "agirlikliDnfOrani"])) ? 0.2 : 0);
      var conf = s.puan == null ? 0 : yuvarla(kisit(veriKal * (0.5 + 0.5 * tamamlanma), 0, 1), 3);
      if (s.puan == null) { nedenListe.push({ faktor: "veriKapsami", yon: "-", metin: "Puan verisi yok" }); }
      else if (s.elendi) { nedenListe.push({ faktor: "puan", yon: "-", metin: "Matematiksel olarak şampiyonluk dışında" }); }
      else if (kesinlesti) { nedenListe.push({ faktor: "puan", yon: "+", metin: "Şampiyonluk matematiksel olarak belli" }); }
      else {
        if (s.puan === lider) { nedenListe.push({ faktor: "puan", yon: "+", metin: "Puan sıralamasında lider" }); }
        else { nedenListe.push({ faktor: "puan", yon: "-", metin: "Lidere " + (lider - s.puan) + " puan geride" }); }
        if (s.bekle != null && s.proj != null && canli.length) {
          var en = Math.max.apply(null, canli.filter(function (c) { return c.proj != null; }).map(function (c) { return c.proj; }));
          if (s.proj >= en) { nedenListe.push({ faktor: "recentForm", yon: "+", metin: "Kalan yarışlar için form beklentisi en yüksek" }); }
        }
        if (sayiMi(g(f, ["reliability", "agirlikliDnfOrani"])) && f.reliability.agirlikliDnfOrani >= P.DNF_YUKSEK) { nedenListe.push({ faktor: "reliability", yon: "-", metin: METIN.reliability[1] }); }
        if (g(f, ["teamForm", "son5Puan", "toplam"]) != null && ctxTakimLider(liste, f)) { nedenListe.push({ faktor: "teamForm", yon: "+", metin: METIN.teamForm[0] }); }
      }
      return { driver: f.driver, team: f.team, championshipProbability: p == null ? null : yuvarla(p), puan: s.puan, elendi: s.puan == null ? null : !!s.elendi,
               maxUlasilabilir: s.puan == null ? null : s.puan + maxKalan, confidence: conf, reasons: nedenListe.slice(0, P.MAX_NEDEN) };
    });
    cikti.sort(function (a, b) { return (b.championshipProbability || 0) - (a.championshipProbability || 0) || (a.driver < b.driver ? -1 : 1); });
    return { durum: "ok", model: "puan-projeksiyon-v1", season: liste[0].season, round: R, kalanYaris: kalan, maxKalanPuan: maxKalan, suruculer: cikti,
             meta: { sampiyonlukBelli: kesinlesti, lider: lider, kural: kural, sprintDataComplete: sp ? sp.sprintDataComplete !== false : null, elemeYapildi: !spEksik, kalanSprint: sprint, atlanan: h.atlanan, tekrar: h.tekrar } };
  }
  function ctxTakimLider(liste, f) {
    var m = 0; liste.forEach(function (x) { var t = g(x, ["teamForm", "son5Puan", "toplam"]); if (sayiMi(t) && t > m) { m = t; } });
    return m > 0 && f.teamForm.son5Puan.toplam >= m;
  }

  // ===== AÇIKLAMA (şablon) =====
  function explain(r) {
    if (!r || !r.driver) { return null; }
    var pct = function (x) { return x == null ? "—" : Math.round(x * 100) + "%"; }, satir;
    if (r.championshipProbability !== undefined) { satir = "Şampiyonluk olasılığı tahmini " + pct(r.championshipProbability); }
    else { satir = "Tahmini olasılıklar: ilk 1 " + pct(r.winProbability) + ", ilk 3 " + pct(r.podiumProbability) + ", puan " + pct(r.pointsProbability); }
    var nedenler = (r.reasons || []).slice(0, P.MAX_NEDEN).map(function (x) { return x.metin; });
    var ozet = satir + " (güven: " + (r.confidenceSeviye || "—") + "). Bu bir olasılık tahminidir." + (nedenler.length ? " Nedenler: " + nedenler.join("; ") + "." : "");
    return { driver: r.driver, ozet: ozet, nedenler: nedenler };
  }

  var API = { sezonKurali: sezonKurali, genelGuvenSkor: genelGuvenSkor, racePredict: racePredict, championshipPredict: championshipPredict, explain: explain, AGIRLIK: AGIRLIK, PARAM: P, YASAK: YASAK };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
  if (kok) { kok.TahminMotoru = API; }
})(typeof window !== "undefined" ? window : null);
