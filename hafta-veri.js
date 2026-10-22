/* Yarış Haftası: veri modeli, durum kuralları, sonuç çözümleme ve sonuç bekleme döngüsü.
   Arayüz içermez. Bağımlılıklar: seri-ayarlari.js, jolpica-istemci.js */
(function () {
  var SA = window.SERI_AYARLARI;
  var ANA_TZ = window.ANA_SAAT_DILIMI || "Europe/Istanbul";
  var BEKLE_ARALIK_MS = 60 * 1000;      // seans başına en fazla dakikada 1 çağrı
  var BEKLE_SINIR_MS = 3 * 3600 * 1000; // seans bitişinden sonra en fazla 3 saat
  var TAKVIM_OMUR_MS = 6 * 3600 * 1000;

  // ---------- Saat biçimleme (Intl; sabit offset yok) ----------
  var onbellekFmt = {};
  function fmt(tz, secenek, anahtar) {
    var k = tz + "|" + anahtar;
    if (!onbellekFmt[k]) {
      try { onbellekFmt[k] = new Intl.DateTimeFormat("tr-TR", Object.assign({ timeZone: tz }, secenek)); }
      catch (e) { onbellekFmt[k] = null; }
    }
    return onbellekFmt[k];
  }
  function saatYaz(tarih, tz) {
    var f = fmt(tz, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, "saat");
    return f ? f.format(tarih) : null;
  }
  function gunAnahtari(tarih, tz) {
    var f = fmt(tz, { year: "numeric", month: "2-digit", day: "2-digit" }, "gunkey");
    return f ? f.format(tarih) : "";
  }
  function gunYaz(tarih, tz) {
    var f = fmt(tz, { weekday: "long", day: "numeric", month: "long" }, "gun");
    return f ? f.format(tarih) : "";
  }
  function kisaGunYaz(tarih, tz) {
    var f = fmt(tz, { weekday: "short", day: "numeric", month: "short" }, "kisagun");
    return f ? f.format(tarih) : "";
  }
  function tzKisaAd(tarih, tz) {
    var f = fmt(tz, { timeZoneName: "short", hour: "2-digit" }, "tzad");
    if (!f) { return ""; }
    var p = f.formatToParts(tarih).filter(function (x) { return x.type === "timeZoneName"; })[0];
    return p ? p.value : "";
  }
  // Pist yerel saati metni (ör. "21:00 GMT+8") ya da null (saat dilimi bilinmiyorsa/geçersizse)
  function pistSaati(tarih, tz) {
    if (!tz) { return null; }
    var s = saatYaz(tarih, tz);
    return s ? s + " " + tzKisaAd(tarih, tz) : null;
  }

  // ---------- Hafta modeli ----------
  function tarihZaman(d, t) { return new Date(d + "T" + (t || "12:00:00Z")); }

  // yarisKaydi: Jolpica takvim kaydı. seriKodu: "f1"
  function haftaKur(yarisKaydi, seriKodu) {
    var ayar = SA[seriKodu || "f1"];
    var pist = yarisKaydi.Circuit || {};
    var tz = (ayar.pistSaatDilimi || {})[pist.circuitId] || null;
    var seanslar = [];
    ayar.seansAnahtarlari.forEach(function (anahtar) {
      var k = yarisKaydi[anahtar];
      if (!k || !k.date || !k.time) { return; } // saati olmayan seans gösterilmez
      var tur = ayar.seanslar[anahtar];
      var bas = tarihZaman(k.date, k.time);
      seanslar.push({ anahtar: anahtar, ad: tur.ad, kisa: tur.kisa, acikla: tur.acikla, sonucKaynagi: tur.sonucKaynagi, saglayici: tur.saglayici || "jolpica",
                      baslangic: bas, bitis: new Date(bas.getTime() + tur.sureDk * 60000) });
    });
    var yt = ayar.seanslar.Race;
    var ybas = tarihZaman(yarisKaydi.date, yarisKaydi.time);
    seanslar.push({ anahtar: "Race", ad: yt.ad, kisa: yt.kisa, acikla: yt.acikla, sonucKaynagi: yt.sonucKaynagi, saglayici: "jolpica",
                    baslangic: ybas, bitis: new Date(ybas.getTime() + yt.sureDk * 60000) });
    seanslar.sort(function (a, b) { return a.baslangic - b.baslangic; });
    var sprintMi = seanslar.some(function (s) { return s.anahtar === "Sprint"; });
    return {
      seri: seriKodu || "f1", sezon: Number(yarisKaydi.season), tur: Number(yarisKaydi.round), ad: yarisKaydi.raceName,
      pistAdi: pist.circuitName || "", yer: (pist.Location ? pist.Location.locality : ""), ulke: (pist.Location ? pist.Location.country : ""),
      pistId: pist.circuitId || "", pistTz: tz, sprintMi: sprintMi, seanslar: seanslar,
      sonuclar: { sprint: null, qualifying: null, race: null, fp1: null, fp2: null, fp3: null, sq: null }, // çözümlenmiş sonuçlar
      hamSonuclar: { sprint: null, qualifying: null, race: null },
      of: {}, // OpenF1 durumu: { fp1: { durum, oturum } ... }
      sonDeneme: {}, hata: null, eski: false
    };
  }

  // Varsayılan hafta sonu: başlangıcının üzerinden 6 saat geçmemiş ilk yarış; yoksa sezonun son yarışı
  function varsayilanTur(yarislar, simdi) {
    var n = simdi == null ? Date.now() : simdi;
    var bul = yarislar.find(function (y) { return tarihZaman(y.date, y.time).getTime() + 6 * 3600 * 1000 > n; });
    return bul || yarislar[yarislar.length - 1] || null;
  }

  // ---------- Durum kuralı ----------
  // yaklasan | canli | bitti | sonuc-bekleniyor | tamamlandi
  // canli: yalnızca saat hesabıyla (TAHMİNİ). tamamlandi: sonuç verisi geldi (kesin).
  // Sonuç kaynağı olan her seans (Jolpica: Sprint/Qualifying/Race; OpenF1: FP1-3 ve Sprint Sıralaması) bitince sonuç beklenir.
  // OpenF1 seanslarında bekleme süresi (3 saat) dolunca durum "bitti" olur (eski hafta sonları için).
  function seansDurumu(seans, hafta, simdi) {
    var n = simdi == null ? Date.now() : simdi;
    var kaynak = seans.sonucKaynagi;
    if (kaynak && hafta.sonuclar[kaynak]) { return "tamamlandi"; }
    if (n < seans.baslangic.getTime()) { return "yaklasan"; }
    if (n < seans.bitis.getTime()) { return "canli"; }
    if (!kaynak) { return "bitti"; }
    if (seans.saglayici === "openf1" && bekleSuresiDoldu(seans, n)) { return "bitti"; }
    return "sonuc-bekleniyor";
  }
  function kaynakSeans(kaynak) { return kaynak === "sprint" ? "Sprint" : (kaynak === "qualifying" ? "Qualifying" : "Race"); }
  function bekleSuresiDoldu(seans, simdi) {
    return (simdi == null ? Date.now() : simdi) - seans.bitis.getTime() > BEKLE_SINIR_MS;
  }

  // ---------- Sonuç çözümleme ----------
  function surePuan(s) { return s ? s : ""; }
  function surucu(r) {
    var d = r.Driver || {};
    return { kod: d.code || (d.familyName || "?").slice(0, 3).toUpperCase(), ad: ((d.givenName || "") + " " + (d.familyName || "")).trim(),
             takim: (r.Constructor || {}).name || "" };
  }

  // Qualifying: pole = Qualifying sonucundaki P1 (grid/start değil)
  function siralamaCoz(satirlar) {
    if (!satirlar || !satirlar.length) { return null; }
    var liste = satirlar.map(function (r) {
      var s = surucu(r);
      var en = r.Q3 || r.Q2 || r.Q1 || "";
      return Object.assign(s, { sira: Number(r.position), Q1: r.Q1 || "", Q2: r.Q2 || "", Q3: r.Q3 || "", enIyi: en });
    }).sort(function (a, b) { return a.sira - b.sira; });
    var n = liste.length;
    var q2 = liste.filter(function (x) { return x.Q2; }).length;
    var q3 = liste.filter(function (x) { return x.Q3; }).length;
    // Sıralamadaki sıralar kesintisiz mi: 1..q3 Q3'lü, q3+1..q2 yalnızca Q2'li, geri kalan Q2'siz
    var guvenilir = q3 > 0 && q2 >= q3 && liste.every(function (x, i) {
      var s = i + 1;
      if (s <= q3) { return !!x.Q3; }
      if (s <= q2) { return !!x.Q2 && !x.Q3; }
      return !x.Q2 && !x.Q3;
    });
    var pole = liste.find(function (x) { return x.sira === 1; }) || liste[0];
    liste.forEach(function (x, i) {
      x.elendi = guvenilir ? (i + 1 > q2 ? "Q1" : (i + 1 > q3 ? "Q2" : "")) : "";
      x.pozFark = null;
    });
    return { liste: liste, n: n, q2Sayisi: q2, q3Sayisi: q3, elemeGuvenilir: guvenilir,
             q1Elenen: guvenilir ? n - q2 : null, q2Elenen: guvenilir ? q2 - q3 : null,
             pole: { kod: pole.kod, ad: pole.ad, takim: pole.takim, sure: pole.enIyi } };
  }

  // Sprint / Yarış sonucu
  function yarisCoz(satirlar) {
    if (!satirlar || !satirlar.length) { return null; }
    var liste = satirlar.map(function (r) {
      var s = surucu(r);
      var hizli = r.FastestLap || null;
      var sure = r.Time ? r.Time.time : "";
      return Object.assign(s, { sira: Number(r.position), metin: r.positionText, grid: Number(r.grid), puan: Number(r.points || 0),
        durum: r.status || "", sure: sure, tur: Number(r.laps || 0),
        enHizli: hizli && hizli.Time ? { sira: Number(hizli.rank), tur: Number(hizli.lap), sure: hizli.Time.time } : null });
    }).sort(function (a, b) { return a.sira - b.sira; });
    return { liste: liste };
  }

  // Grid cezası işareti: yarış sonucundaki grid, sıralamadaki sıradan farklıysa (yalnızca iki sonuç da varsa)
  function gridCezalari(siralama, yaris) {
    var out = {};
    if (!siralama || !yaris) { return out; }
    var qSira = {};
    siralama.liste.forEach(function (x) { qSira[x.kod] = x.sira; });
    yaris.liste.forEach(function (x) {
      var q = qSira[x.kod];
      if (q && x.grid !== q) { out[x.kod] = { siralama: q, start: x.grid === 0 ? "PL" : x.grid }; }
    });
    return out;
  }

  // ---------- Yükleme ----------
  function kaynakYolu(hafta, kaynak) {
    var uc = kaynak === "race" ? "results" : kaynak;
    return "f1/" + hafta.sezon + "/" + hafta.tur + "/" + uc + "/?limit=100";
  }
  function satirlariAl(kaynak, veri) {
    var r = veri && veri.RaceTable && veri.RaceTable.Races && veri.RaceTable.Races[0];
    if (!r) { return []; }
    return (kaynak === "qualifying" ? r.QualifyingResults : (kaynak === "sprint" ? r.SprintResults : r.Results)) || [];
  }
  function sonucuIsle(hafta, kaynak, satirlar) {
    hafta.hamSonuclar[kaynak] = satirlar;
    hafta.sonuclar[kaynak] = satirlar.length ? (kaynak === "qualifying" ? siralamaCoz(satirlar) : yarisCoz(satirlar)) : null;
  }
  // OpenF1 kaynaklı sonuçlar (FP: liste, Sprint Sıralaması: Qualifying biçimli satırlar)
  function openf1Isle(hafta, kaynak, rows) {
    hafta.sonuclar[kaynak] = kaynak === "sq" ? siralamaCoz(rows) : { liste: rows };
  }

  // Tek kaynağı çek (sonuç varsa kaydeder). Dönüş: sonuç var mı
  async function kaynakYukle(hafta, kaynak) {
    hafta.sonDeneme[kaynak] = Date.now();
    var seans = hafta.seanslar.filter(function (x) { return x.sonucKaynagi === kaynak; })[0];
    if (seans && seans.saglayici === "openf1") {
      if (!window.OpenF1Veri) { hafta.of[kaynak] = { durum: "hata" }; return false; }
      var r = await window.OpenF1Veri.sonucAl(hafta, seans, kaynak);
      hafta.of[kaynak] = { durum: r.durum, oturum: r.oturum || null, oturumlar: r.oturumlar || null, uyarilar: r.uyarilar || [] };
      if (r.durum === "ok") { openf1Isle(hafta, kaynak, r.rows); return true; }
      return false;
    }
    var cevap = await window.JolpicaIstemci.al(kaynakYolu(hafta, kaynak), {
      onbellek: "sonuc-" + hafta.sezon + "-" + hafta.tur + "-" + kaynak,
      kaydetKosul: function (v) { return satirlariAl(kaynak, v).length > 0; }
    });
    var satirlar = satirlariAl(kaynak, cevap.veri);
    if (cevap.eski) { hafta.eski = true; }
    sonucuIsle(hafta, kaynak, satirlar);
    return satirlar.length > 0;
  }

  // Başlamış ve sonuç kaynağı olan seansların sonuçlarını bir kez yükler (sıralı)
  async function haftaYukle(hafta, simdi, iptal) {
    var n = simdi == null ? Date.now() : simdi;
    hafta.hata = null; hafta.eski = false;
    for (var i = 0; i < hafta.seanslar.length; i++) {
      var s = hafta.seanslar[i];
      if (iptal && iptal()) { return; } // hafta değişti ya da sekmeden çıkıldı: gereksiz istek yok
      if (!s.sonucKaynagi || n < s.baslangic.getTime()) { continue; }
      if (s.saglayici === "openf1" && n < s.bitis.getTime()) { continue; } // OpenF1: seans bitmeden istek yok
      try { await kaynakYukle(hafta, s.sonucKaynagi); }
      catch (e) { hafta.hata = e.message; }
    }
    // Yarış bitmişse grid cezası işareti için sıralama da gerekir (seans listede olmasa bile)
    if (hafta.sonuclar.race && !hafta.sonuclar.qualifying && !hafta.hamSonuclar.qualifying) {
      try { await kaynakYukle(hafta, "qualifying"); } catch (e) { /* işaret gösterilmez */ }
    }
  }

  // ---------- Sonuç bekleme döngüsü ----------
  // Yalnızca Sprint / Qualifying / Race için; yalnızca sekme görünürken; seans başına en fazla dakikada 1 çağrı; en çok 3 saat.
  function bekleBaslat(hafta, guncellendi) {
    var calisiyor = false;
    var zamanlayici = setInterval(tik, 30 * 1000);
    async function tik() {
      guncellendi();
      if (calisiyor || (typeof document !== "undefined" && document.visibilityState === "hidden")) { return; }
      var n = Date.now();
      var bekleyenler = hafta.seanslar.filter(function (s) {
        return s.sonucKaynagi && seansDurumu(s, hafta, n) === "sonuc-bekleniyor" && !bekleSuresiDoldu(s, n) &&
               n - (hafta.sonDeneme[s.sonucKaynagi] || 0) >= BEKLE_ARALIK_MS;
      });
      if (!bekleyenler.length) { return; }
      calisiyor = true;
      try {
        for (var i = 0; i < bekleyenler.length; i++) {
          try { if (await kaynakYukleTaze(hafta, bekleyenler[i].sonucKaynagi)) { guncellendi(); } } catch (e) { hafta.hata = e.message; }
        }
      } finally { calisiyor = false; }
    }
    return { durdur: function () { clearInterval(zamanlayici); } };
  }
  // Bekleme döngüsünde önbelleği atla (boş sonuç zaten önbelleğe yazılmaz)
  async function kaynakYukleTaze(hafta, kaynak) { return kaynakYukle(hafta, kaynak); }

  // ---------- Takvim ----------
  async function takvimYukle(sezon) {
    var cevap = await window.JolpicaIstemci.al("f1/" + sezon + "/races/?limit=100", {
      onbellek: "takvim-" + sezon, omurMs: TAKVIM_OMUR_MS,
      kaydetKosul: function (v) { return v && v.RaceTable && v.RaceTable.Races && v.RaceTable.Races.length > 0; }
    });
    return { yarislar: cevap.veri.RaceTable.Races || [], eski: cevap.eski };
  }

  window.HaftaVeri = {
    haftaKur: haftaKur, varsayilanTur: varsayilanTur, seansDurumu: seansDurumu, bekleSuresiDoldu: bekleSuresiDoldu,
    siralamaCoz: siralamaCoz, yarisCoz: yarisCoz, gridCezalari: gridCezalari,
    haftaYukle: haftaYukle, kaynakYukle: kaynakYukle, bekleBaslat: bekleBaslat, takvimYukle: takvimYukle,
    saatYaz: saatYaz, gunYaz: gunYaz, kisaGunYaz: kisaGunYaz, gunAnahtari: gunAnahtari, pistSaati: pistSaati,
    ANA_TZ: ANA_TZ, kaynakSeans: kaynakSeans, openf1Isle: openf1Isle
  };
})();
