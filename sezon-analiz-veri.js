/* A3.1 — Sezon analiz veri katmanı (Y2b).
   Tek iş: bir sezonun TÜM ana yarış ve sprint satırlarını Jolpica'nın sezon çapında toplu uçlarından (sayfalı, limit=100) çekip
   küçük bir modele çevirmek ve önbelleklemek. Tur başına standings çağrısı YAPILMAZ.
   - Ağ: yalnızca JolpicaIstemci.al (tek kuyruk, 400 ms aralık, 429 yeniden deneme). Yeni istemci yok.
   - Takvim: HaftaVeri.takvimYukle ile ORTAK önbellek (A1/A2 ile aynı veri).
   - Önbellek: f1-hafta-v1-sezon-<yıl>-a3-sonuc | -a3-sprint  (JolpicaIstemci öneki ve sezon-* adı korunur).
   - Ömür: beklenen tüm turlar geldiyse 24 saat, eksikse 15 dk. Yeni yarıştan sonra yalnızca SON sayfalar yenilenir (artımlı);
     7 günde bir tam kontrol yapılır. Eksik sayfa ASLA önbelleğe yazılmaz (tutarsız ise eski önbellek korunur).
   - A1/A2 dosyalarına, Race Feed'e, OpenF1'e dokunmaz. */
(function () {
  "use strict";
  var JI = window.JolpicaIstemci, HV = window.HaftaVeri;
  var SURUM = 1, SAYFA = 100, MAKS_SAYFA = 12;
  var KISA_OMUR = 15 * 60 * 1000, UZUN_OMUR = 24 * 3600 * 1000, TAM_KONTROL = 7 * 24 * 3600 * 1000;
  var agSayisi = 0;                                  // bu oturumda bu modülün yaptığı gerçek ağ çağrıları

  function sayi(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function zaman(d, t) { return new Date(d + "T" + (t || "12:00:00Z")).getTime(); }

  // Takvime göre "şu ana kadar kaç numaralı tura kadar veri beklenir" (A2 ile aynı süre payları)
  function beklenen(yarislar, tur, simdi) {
    var en = 0;
    yarislar.forEach(function (y) {
      var bitis = null;
      if (tur === "race") { bitis = zaman(y.date, y.time) + 3 * 3600 * 1000; }
      else if (tur === "sprint" && y.Sprint && y.Sprint.date) { bitis = zaman(y.Sprint.date, y.Sprint.time) + 90 * 60 * 1000; }
      if (bitis !== null && bitis < simdi) { en = Math.max(en, Number(y.round)); }
    });
    return en;
  }

  // MRData sayfası -> kompakt satırlar [tur, pilotId, takimId, grid, pozisyon, positionText, puan, status]
  function sayfaAyikla(mr, anahtar, sozluk) {
    var satir = [];
    ((mr && mr.RaceTable && mr.RaceTable.Races) || []).forEach(function (y) {
      var n = Number(y.round);
      sozluk.tur[n] = y.raceName || sozluk.tur[n] || "";
      (y[anahtar] || []).forEach(function (r) {
        var d = r.Driver || {}, c = r.Constructor || {};
        if (!d.driverId || !c.constructorId) { return; }
        sozluk.pilot[d.driverId] = [d.code || (d.familyName || "").slice(0, 3).toUpperCase(), ((d.givenName || "") + " " + (d.familyName || "")).trim()];
        sozluk.takim[c.constructorId] = c.name || c.constructorId;
        satir.push([n, d.driverId, c.constructorId, sayi(r.grid), sayi(r.position), String(r.positionText != null ? r.positionText : ""), sayi(r.points), String(r.status || "")]);
      });
    });
    return satir;
  }

  // Sayfa sayfa çek (basla = ilk satır ofseti). Toplam sayı değişirse ya da sayfa eksik kalırsa FIRLATIR (önbelleğe yazılmaz).
  async function sayfala(yol, anahtar, basla, ilerle) {
    var o = basla, toplam = null, satir = [], sozluk = { pilot: {}, takim: {}, tur: {} }, no = 0;
    for (;;) {
      if (no++ >= MAKS_SAYFA) { throw new Error("sayfa sınırı aşıldı"); }
      var c = await JI.al(yol + "?limit=" + SAYFA + "&offset=" + o);
      agSayisi++;
      var mr = c.veri || {}, t = Number(mr.total);
      if (!isFinite(t)) { throw new Error("toplam satır sayısı okunamadı"); }
      if (toplam !== null && t !== toplam) { throw new Error("sayfalama sırasında toplam değişti"); }
      toplam = t;
      var ek = sayfaAyikla(mr, anahtar, sozluk);
      satir = satir.concat(ek);
      if (ilerle) { ilerle(no, Math.max(1, Math.ceil((toplam - basla) / SAYFA))); }
      o += SAYFA;
      if (o >= toplam) { break; }
      if (!ek.length) { throw new Error("boş sayfa: veri eksik"); }
    }
    if (satir.length !== toplam - basla) { throw new Error("sayfalar eksik: " + satir.length + " / " + (toplam - basla)); }
    return { satir: satir, toplam: toplam, sozluk: sozluk };
  }

  function birlestir(a, b) { var o = {}, k; for (k in a) { o[k] = a[k]; } for (k in b) { o[k] = b[k]; } return o; }
  function enBuyukTur(satir) { var m = 0; satir.forEach(function (r) { if (r[0] > m) { m = r[0]; } }); return m; }

  // Bir tür (sonuc | sprint) için: önbellek -> artımlı -> tam. { veri, kaynak: onbellek|artimli|tam, eski }
  async function turYukle(tur, sezon, anahtar, yol, bek, o) {
    var onbellekAdi = "sezon-" + sezon + "-a3-" + tur;
    var kayit = JI.oku(onbellekAdi);
    var veri = kayit && kayit.veri && kayit.veri.surum === SURUM && Array.isArray(kayit.veri.satir) ? kayit.veri : null;
    var simdi = o.simdi != null ? o.simdi : Date.now();
    if (veri && !o.yenile) {
      var tamMi = enBuyukTur(veri.satir) >= bek;
      if (simdi - kayit.t < (tamMi ? UZUN_OMUR : KISA_OMUR)) { return { veri: veri, kaynak: "onbellek", eski: false }; }
    }
    var tamKontrol = !veri || o.yenile === "tam" || simdi - (veri.t0 || 0) > TAM_KONTROL;
    var basla = tamKontrol ? 0 : Math.floor(veri.satir.length / SAYFA) * SAYFA;
    try {
      var r;
      try { r = await sayfala(yol, anahtar, basla, function (n, top) { if (o.ilerle) { o.ilerle(tur, n, top); } }); }
      catch (h) {
        if (tamKontrol || basla === 0) { throw h; }
        basla = 0; tamKontrol = true;                                   // artımlı tutarsız: bir kez tam çek
        r = await sayfala(yol, anahtar, 0, function (n, top) { if (o.ilerle) { o.ilerle(tur, n, top); } });
      }
      var satir = basla ? veri.satir.slice(0, basla).concat(r.satir) : r.satir;
      if (satir.length !== r.toplam) { throw new Error("birleşik satır sayısı toplamla eşleşmiyor"); }
      var yeni = {
        surum: SURUM, t0: tamKontrol ? simdi : veri.t0, toplam: r.toplam, satir: satir,
        pilot: birlestir(veri ? veri.pilot : {}, r.sozluk.pilot), takim: birlestir(veri ? veri.takim : {}, r.sozluk.takim), tur: birlestir(veri ? veri.tur : {}, r.sozluk.tur)
      };
      JI.kaydet(onbellekAdi, yeni);
      return { veri: yeni, kaynak: tamKontrol ? "tam" : "artimli", eski: false };
    } catch (h2) {
      if (veri) { return { veri: veri, kaynak: "onbellek", eski: true, hata: h2 }; }
      throw h2;
    }
  }

  function satirNesne(r) { return { p: r[1], t: r[2], g: r[3], s: r[4], x: r[5], n: r[6], d: r[7] }; }

  function modelKur(sezon, yarisV, sprintV, yarislar) {
    var turlar = {}, pilotlar = {}, takimlar = {}, k;
    function al(n) { return turlar[n] || (turlar[n] = { n: n, ad: "", sprintMi: false, yaris: [], sprint: [] }); }
    [yarisV, sprintV].forEach(function (v) {
      if (!v) { return; }
      for (k in v.pilot) { pilotlar[k] = { k: v.pilot[k][0], a: v.pilot[k][1] }; }
      for (k in v.takim) { takimlar[k] = v.takim[k]; }
    });
    if (yarisV) { yarisV.satir.forEach(function (r) { al(r[0]).yaris.push(satirNesne(r)); }); }
    if (sprintV) { sprintV.satir.forEach(function (r) { al(r[0]).sprint.push(satirNesne(r)); }); }
    yarislar.forEach(function (y) { var n = Number(y.round); if (turlar[n]) { turlar[n].ad = y.raceName; } if (turlar[n] && y.Sprint && y.Sprint.date) { turlar[n].sprintMi = true; } });
    Object.keys(turlar).forEach(function (n) {
      var t = turlar[n];
      if (!t.ad) { t.ad = (yarisV && yarisV.tur[n]) || (sprintV && sprintV.tur[n]) || ("Tur " + n); }
      if (t.sprint.length) { t.sprintMi = true; }
    });
    return { sezon: sezon, turlar: turlar, pilotlar: pilotlar, takimlar: takimlar };
  }

  // Ana yükleme -> { model, hatalar, tam, eksikTurlar, eski, ag, kaynaklar, toplamTur }
  async function yukle(sezon, opsiyon) {
    var o = opsiyon || {}, basla = agSayisi, simdi = o.simdi != null ? o.simdi : Date.now();
    var yarislar = [], takvimHata = false, hatalar = [], eski = false;
    try { var tk = await HV.takvimYukle(sezon); yarislar = tk.yarislar || []; if (tk.eski) { eski = true; } }
    catch (h) { takvimHata = true; hatalar.push("takvim"); }
    var bekR = beklenen(yarislar, "race", simdi), bekS = beklenen(yarislar, "sprint", simdi);
    var p = "f1/" + sezon + "/", kaynaklar = {};
    var oo = { simdi: simdi, yenile: o.yenile, ilerle: o.ilerle };
    var ry = await turYukle("sonuc", sezon, "Results", p + "results/", bekR, oo);   // ana sonuçlar yoksa fırlatır
    kaynaklar.sonuc = ry.kaynak; if (ry.eski) { eski = true; hatalar.push("sonuc"); }
    var sy = null;
    try { sy = await turYukle("sprint", sezon, "SprintResults", p + "sprint/", bekS, oo); kaynaklar.sprint = sy.kaynak; if (sy.eski) { eski = true; hatalar.push("sprint"); } }
    catch (h2) { hatalar.push("sprint"); }                                           // sprint puanı eksik: toplamlar eksik olabilir (arayüz uyarır)
    var model = modelKur(sezon, ry.veri, sy ? sy.veri : null, yarislar);
    var enR = enBuyukTur(ry.veri.satir), enS = sy ? enBuyukTur(sy.veri.satir) : 0, eksik = [];
    for (var n = 1; n <= bekR; n++) { if (!model.turlar[n] || !model.turlar[n].yaris.length) { eksik.push(n); } }
    var tam = !takvimHata && !eski && hatalar.length === 0 && eksik.length === 0 && enR >= bekR && enS >= bekS;
    return { model: model, hatalar: hatalar, tam: tam, eksikTurlar: eksik, eski: eski, ag: agSayisi - basla, kaynaklar: kaynaklar, toplamTur: yarislar.length, beklenenYaris: bekR, beklenenSprint: bekS };
  }

  window.SezonAnaliz = {
    yukle: yukle,
    agSayisi: function () { return agSayisi; },
    _ic: { beklenen: beklenen, sayfaAyikla: sayfaAyikla, modelKur: modelKur, SAYFA: SAYFA }
  };
})();
