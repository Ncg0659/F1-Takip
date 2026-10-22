/* Y2 — Sezon veri katmanı (A2.1).
   Tek iş: bir sezonun biten yarışları için kazanan / podyum / pole / sprint kazananı bilgisini
   Jolpica'dan (ücretsiz, anahtarsız) toplayıp küçültülmüş halde önbellekler.
   - Ağ: yalnızca JolpicaIstemci.al (tek kuyruk, 400 ms aralık, 429 yeniden deneme). Yeni istemci yok.
   - Takvim: HaftaVeri.takvimYukle ile ORTAK önbellek (takvim-<yıl>); A1 ile aynı veri.
   - Önbellek anahtarları: f1-hafta-v1-sezon-<yıl>-* (JolpicaIstemci öneki; değişmedi).
   - A1 dosyalarına, Race Feed'e, OpenF1'e dokunmaz. */
(function () {
  var JI = window.JolpicaIstemci;
  var HV = window.HaftaVeri;
  var KISA_OMUR = 15 * 60 * 1000;      // eksik veri varsa: 15 dk sonra tekrar sor
  var UZUN_OMUR = 24 * 3600 * 1000;    // beklenen tüm turlar geldiyse: 24 saat
  var POLE_YEDEK_LIMIT = 4;            // toplu çağrıda eksik kalan pole için tek tek en çok 4 çağrı
  var agSayisi = 0;                    // bu sayfa oturumunda bu modülün yaptığı gerçek ağ çağrıları (test/rapor için)

  function zaman(d, t) { return new Date(d + "T" + (t || "12:00:00Z")).getTime(); }

  // Takvime göre "şu ana kadar kaç numaralı tura kadar veri beklenir"
  function beklenenTur(yarislar, tur, simdi) {
    var en = 0;
    yarislar.forEach(function (y) {
      var bitis = null;
      if (tur === "race") { bitis = zaman(y.date, y.time) + 3 * 3600 * 1000; }
      else if (tur === "sprint" && y.Sprint && y.Sprint.date) { bitis = zaman(y.Sprint.date, y.Sprint.time) + 90 * 60 * 1000; }
      else if (tur === "quali" && y.Qualifying && y.Qualifying.date) { bitis = zaman(y.Qualifying.date, y.Qualifying.time) + 2 * 3600 * 1000; }
      if (bitis !== null && bitis < simdi) { en = Math.max(en, Number(y.round)); }
    });
    return en;
  }

  function enBuyukTur(kayit) { return kayit && typeof kayit.enBuyuk === "number" ? kayit.enBuyuk : 0; }

  function pilotKaydi(r) {
    var d = r.Driver || {};
    return {
      k: d.code || (d.familyName || "").slice(0, 3).toUpperCase(),
      a: ((d.givenName || "") + " " + (d.familyName || "")).trim(),
      t: r.Constructor ? r.Constructor.name : "-",
      g: r.grid != null ? String(r.grid) : "",
      s: r.Time && r.Time.time ? r.Time.time : "",
      d: r.status || ""
    };
  }

  // MRData (results / sprint, belirli bir sıra) -> { "<tur>": pilotKaydi }
  function turlaraAyir(mr, anahtar, sira) {
    var cikti = {}, enBuyuk = 0;
    var yarislar = (mr && mr.RaceTable && mr.RaceTable.Races) || [];
    yarislar.forEach(function (y) {
      var liste = y[anahtar] || [];
      var satir = liste.filter(function (r) { return String(r.position) === String(sira); })[0];
      if (satir) { cikti[y.round] = pilotKaydi(satir); enBuyuk = Math.max(enBuyuk, Number(y.round)); }
    });
    return { turlar: cikti, enBuyuk: enBuyuk };
  }

  // Önbellek + ağ: küçültülmüş kaydı döndürür. Hata olursa eski kayıt (varsa) kullanılır.
  async function kaynak(anahtar, yol, ayikla, bek) {
    var k = JI.oku(anahtar);
    if (k && k.veri) {
      var yas = Date.now() - k.t;
      var tamam = enBuyukTur(k.veri) >= bek;
      if (yas < (tamam ? UZUN_OMUR : KISA_OMUR)) { return { veri: k.veri, eski: false }; }
    }
    try {
      var c = await JI.al(yol);            // önbelleksiz tek çağrı (küçültüp kendimiz saklıyoruz)
      agSayisi++;
      var veri = ayikla(c.veri);
      JI.kaydet(anahtar, veri);
      return { veri: veri, eski: false };
    } catch (h) {
      if (k && k.veri) { return { veri: k.veri, eski: true }; }
      throw h;
    }
  }

  // Tek bir turun pole sahibi (Sıralama P1). Önce toplu önbellek, sonra tur önbelleği, son çare tek çağrı.
  async function poleAl(sezon, tur) {
    var toplu = JI.oku("sezon-" + sezon + "-pole");
    if (toplu && toplu.veri && toplu.veri.turlar && toplu.veri.turlar[tur]) { return toplu.veri.turlar[tur]; }
    var tek = JI.oku("sezon-" + sezon + "-pole-r" + tur);
    if (tek && tek.veri && tek.veri.pole) { return tek.veri.pole; }
    var c = await JI.al("f1/" + sezon + "/" + tur + "/qualifying/1/?limit=100");
    agSayisi++;
    var o = turlaraAyir(c.veri, "QualifyingResults", 1);
    var p = o.turlar[tur] || null;
    if (p) { JI.kaydet("sezon-" + sezon + "-pole-r" + tur, { pole: p, enBuyuk: Number(tur) }); }
    return p;
  }

  function takvimOzet(y) {
    return { tur: Number(y.round), ad: y.raceName };
  }

  // ana yükleme: { yarislar, turlar: {<tur>: {...}}, hatalar: [..], eski: bool, ag: n }
  async function yukle(sezon, opsiyon) {
    var o = opsiyon || {};
    var simdi = o.simdi != null ? o.simdi : Date.now();
    var basla = agSayisi;
    var tk = await HV.takvimYukle(sezon);     // başarısızsa fırlatır: kartlar yedek (eski tablo) ile kalır
    var yarislar = tk.yarislar;
    var hatalar = [], eski = !!tk.eski;
    var bekR = beklenenTur(yarislar, "race", simdi);
    var bekS = beklenenTur(yarislar, "sprint", simdi);
    var bekQ = beklenenTur(yarislar, "quali", simdi);
    var p = "f1/" + sezon + "/";
    var sonuc = { 1: {}, 2: {}, 3: {} }, sprint = {}, pole = {};

    for (var sira = 1; sira <= 3; sira++) {
      try {
        var r = await kaynak("sezon-" + sezon + "-sonuc" + sira, p + "results/" + sira + "/?limit=100",
          (function (s) { return function (mr) { return turlaraAyir(mr, "Results", s); }; })(sira), bekR);
        sonuc[sira] = r.veri.turlar; if (r.eski) { eski = true; }
      } catch (h) { hatalar.push("sonuc" + sira); }
    }
    try {
      var s = await kaynak("sezon-" + sezon + "-sprint", p + "sprint/1/?limit=100",
        function (mr) { return turlaraAyir(mr, "SprintResults", 1); }, bekS);
      sprint = s.veri.turlar; if (s.eski) { eski = true; }
    } catch (h) { hatalar.push("sprint"); }
    try {
      var q = await kaynak("sezon-" + sezon + "-pole", p + "qualifying/1/?limit=100",
        function (mr) { return turlaraAyir(mr, "QualifyingResults", 1); }, bekQ);
      pole = q.veri.turlar; if (q.eski) { eski = true; }
    } catch (h) { hatalar.push("pole"); }

    // Toplu sıralama çağrısında eksik kalan turlar için tek tek (en çok POLE_YEDEK_LIMIT)
    var yedek = 0;
    for (var i = 0; i < yarislar.length && yedek < POLE_YEDEK_LIMIT; i++) {
      var tur = Number(yarislar[i].round);
      if (tur <= bekQ && tur <= bekR && sonuc[1][tur] && !pole[tur] && hatalar.indexOf("pole") < 0) {
        yedek++;
        try { var pp = await poleAl(sezon, tur); if (pp) { pole[tur] = pp; } } catch (h) { /* pole yok sayılır */ }
      }
    }

    var turlar = {};
    yarislar.forEach(function (y) {
      var n = Number(y.round);
      turlar[n] = Object.assign(takvimOzet(y), {
        kazanan: sonuc[1][n] || null, p2: sonuc[2][n] || null, p3: sonuc[3][n] || null,
        pole: pole[n] || null, sprint: sprint[n] || null,
        sprintHaftasi: !!(y.Sprint && y.Sprint.date)
      });
    });
    return { yarislar: yarislar, turlar: turlar, hatalar: hatalar, eski: eski, ag: agSayisi - basla };
  }

  window.SezonVeri = {
    yukle: yukle, poleAl: poleAl,
    agSayisi: function () { return agSayisi; },
    _ic: { beklenenTur: beklenenTur, turlaraAyir: turlaraAyir, pilotKaydi: pilotKaydi }
  };
})();
