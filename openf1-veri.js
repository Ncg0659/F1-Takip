/* OpenF1 (ücretsiz geçmiş veri uç noktaları): yalnızca FP1/FP2/FP3 ve Sprint Sıralaması sonuçlarını tamamlar.
   Takvim, Qualifying, Sprint ve Yarış sonuçları Jolpica'dan gelir; buradan alınmaz.
   Ücretli/canlı OpenF1 servisi ve API anahtarı KULLANILMAZ. Bağımlılık: jolpica-istemci.js (yalnızca önbellek yardımcıları). */
(function () {
  var TABAN = "https://api.openf1.org/v1/";
  var ARALIK_MS = 450;                  // en fazla ~2 istek/sn (OpenF1 sınırı: 3/sn, 30/dk)
  var MEETING_OMUR_MS = 6 * 3600 * 1000;
  var OTURUM_TAZELE_MS = 5 * 60 * 1000; // oturum listesinde seans yoksa en fazla 5 dakikada bir yeniden iste
  var kuyruk = Promise.resolve();
  var sonCagri = 0;
  var gunluk = [];                      // kullanılan endpointler (test sayfası/rapor için)
  var bellek = { oturumlar: {}, surucular: {} };
  var JI = function () { return window.JolpicaIstemci; };

  function bekle(ms) { return new Promise(function (c) { setTimeout(c, ms); }); }

  // Tek HTTP isteği. Dönüş: { tur: ok|bos|kisit|hata, veri, http }
  async function ham(yol) {
    for (var deneme = 0; deneme < 3; deneme++) {
      var fark = Date.now() - sonCagri;
      if (fark < ARALIK_MS) { await bekle(ARALIK_MS - fark); }
      sonCagri = Date.now();
      var cevap;
      try { cevap = await fetch(TABAN + yol); }
      catch (e) { gunluk.push({ yol: yol, http: null, tur: "hata" }); return { tur: "hata", veri: null, http: null, hata: e.message }; }
      if (cevap.status === 429) { await bekle(2000 * (deneme + 1)); continue; }
      var tur = cevap.ok ? "ok" : (cevap.status === 404 ? "bos" : (cevap.status === 401 || cevap.status === 403 ? "kisit" : "hata"));
      var veri = null;
      if (cevap.ok) { try { veri = await cevap.json(); } catch (e2) { tur = "hata"; } }
      gunluk.push({ yol: yol, http: cevap.status, tur: tur });
      return { tur: tur, veri: veri, http: cevap.status };
    }
    gunluk.push({ yol: yol, http: 429, tur: "hata" });
    return { tur: "hata", veri: null, http: 429, hata: "istek sınırı (429)" };
  }
  function sirali(yol) {
    var is = kuyruk.then(function () { return ham(yol); });
    kuyruk = is.catch(function () {});
    return is;
  }

  // ---------- Biçimleme ----------
  function sureYaz(sn) {
    if (typeof sn !== "number" || !isFinite(sn)) { return ""; }
    var dk = Math.floor(sn / 60), kalan = sn - dk * 60;
    var s = kalan.toFixed(3);
    if (kalan < 10 && dk > 0) { s = "0" + s; }
    return dk > 0 ? dk + ":" + s : s;
  }
  function farkYaz(g) {
    if (typeof g === "number") { return g > 0 ? "+" + g.toFixed(3) : ""; }
    return typeof g === "string" ? g : "";
  }
  function norm(x) { return String(x == null ? "" : x).trim().toLowerCase(); }

  // ---------- Meeting bulma (hafta sonunu Jolpica yarış tarihine göre eşler) ----------
  async function meetingBul(hafta) {
    var yil = hafta.sezon;
    var kayit = JI().oku("of-meetings-" + yil);
    var liste = null;
    if (kayit && Date.now() - kayit.t < MEETING_OMUR_MS) { liste = kayit.veri; }
    if (!liste) {
      var r = await sirali("meetings?year=" + yil);
      if (r.tur === "hata" || r.tur === "kisit") { return { durum: r.tur }; }
      liste = Array.isArray(r.veri) ? r.veri : [];
      if (liste.length) { JI().kaydet("of-meetings-" + yil, liste); }
    }
    var yarisAni = hafta.seanslar.filter(function (s) { return s.anahtar === "Race"; })[0].baslangic.getTime();
    var gun = 24 * 3600 * 1000, adaylar = [];
    liste.forEach(function (m) {
      if (m.is_cancelled) { return; }
      var a = Date.parse(m.date_start) - gun, b = Date.parse(m.date_end) + gun;
      if (yarisAni >= a && yarisAni <= b) { adaylar.push(m); }
    });
    if (!adaylar.length) { return { durum: "yok-meeting" }; }
    adaylar.sort(function (x, y) { return Math.abs(Date.parse(x.date_end) - yarisAni) - Math.abs(Date.parse(y.date_end) - yarisAni); });
    return { durum: "ok", meeting: adaylar[0] };
  }

  // ---------- Oturum eşleme: sabit tek isim yok; session_name + session_type kontrollü eşleşir ----------
  var PRATIK_NO = { FirstPractice: 1, SecondPractice: 2, ThirdPractice: 3 };
  function oturumEsle(anahtar, oturumlar, seans) {
    var pratikler = oturumlar.filter(function (o) { return norm(o.session_type) === "practice"; })
      .sort(function (a, b) { return Date.parse(a.date_start) - Date.parse(b.date_start); });
    var bulunan = null;
    if (PRATIK_NO[anahtar]) {
      var n = PRATIK_NO[anahtar];
      bulunan = oturumlar.filter(function (o) { var ad = norm(o.session_name); return ad === "practice " + n || ad === "free practice " + n || ad === "fp" + n; })[0] || null;
      if (!bulunan && pratikler.length && pratikler.length >= n && !oturumlar.some(function (o) { return /^practice \d$/.test(norm(o.session_name)); })) { bulunan = pratikler[n - 1]; }
    } else { // Sprint Sıralaması / Sprint Shootout (adı sezona göre değişir)
      bulunan = oturumlar.filter(function (o) { return /sprint\s*(qualifying|shootout)|^sq\d?$/.test(norm(o.session_name)); })[0] || null;
      if (!bulunan) {
        var q = oturumlar.filter(function (o) { return norm(o.session_type) === "qualifying" && !/^qualifying$/.test(norm(o.session_name)); });
        if (q.length === 1) { bulunan = q[0]; }
      }
    }
    if (bulunan && seans && isFinite(Date.parse(bulunan.date_start))) {
      if (Math.abs(Date.parse(bulunan.date_start) - seans.baslangic.getTime()) > 12 * 3600 * 1000) { return null; } // yanlış hafta sonu/seans koruması
    }
    return bulunan;
  }

  async function oturumlariAl(hafta, meeting, seans, anahtar, zorla) {
    var m = bellek.oturumlar[meeting.meeting_key];
    var taze = m && (Date.now() - m.t < OTURUM_TAZELE_MS);
    if (m && (taze || oturumEsle(anahtar, m.liste, seans)) && !zorla) { return { durum: "ok", liste: m.liste }; }
    var r = await sirali("sessions?meeting_key=" + meeting.meeting_key);
    var liste = r.tur === "ok" && Array.isArray(r.veri) ? r.veri : null;
    if (!liste || !liste.length) { // yedek: yıl bazlı liste, meeting_key ile süz
      var r2 = await sirali("sessions?year=" + hafta.sezon);
      if (r2.tur === "hata" || r2.tur === "kisit") { return { durum: r2.tur }; }
      liste = (Array.isArray(r2.veri) ? r2.veri : []).filter(function (o) { return o.meeting_key === meeting.meeting_key; });
    }
    if (!liste.length) { return { durum: "bos" }; }
    bellek.oturumlar[meeting.meeting_key] = { t: Date.now(), liste: liste };
    return { durum: "ok", liste: liste };
  }

  // ---------- Pilot/takım adları (session_result yalnızca driver_number verir) ----------
  async function suruculer(meetingKey, sessionKey, gerekenler) {
    var m = bellek.surucular[meetingKey] || {};
    var eksik = gerekenler.some(function (n) { return !m[n]; });
    if (!eksik) { return m; }
    var r = await sirali("drivers?session_key=" + sessionKey);
    if (r.tur === "ok" && Array.isArray(r.veri)) {
      r.veri.forEach(function (d) { m[d.driver_number] = { kod: d.name_acronym, ad: d.full_name || ((d.first_name || "") + " " + (d.last_name || "")).trim(), ilk: d.first_name || "", son: d.last_name || "", takim: d.team_name || "" }; });
      bellek.surucular[meetingKey] = m;
    }
    return m;
  }
  function surucu(m, no) {
    var d = m[no];
    return d ? d : { kod: "#" + no, ad: "#" + no, ilk: "", son: "#" + no, takim: "" };
  }
  // Temizleme: driver_number'ı olmayan kayıtlar atılır, aynı pilot yalnızca bir kez tutulur (en iyi position'lı),
  // geçerli position'a göre sıralanır (position'sız kayıtlar sona, API sırasıyla). Uyarılar yalnızca bilgi içindir, sonucu engellemez.
  function siraliSatirlar(rows, uyarilar) {
    var u = uyarilar || [];
    var gorulen = {}, temiz = [];
    rows.forEach(function (r, i) {
      if (r == null || r.driver_number == null) { u.push("driver_number yok, kayıt atlandı (dizi #" + i + ")"); return; }
      var pos = typeof r.position === "number" && isFinite(r.position) ? r.position : null;
      var onceki = gorulen[r.driver_number];
      if (onceki) {
        u.push("tekrarlanan pilot #" + r.driver_number + " temizlendi");
        var eskiKayit = temiz[onceki.idx].r;
        var daIyi = pos != null && (onceki.pos == null || pos < onceki.pos || (pos === onceki.pos && (r.number_of_laps || 0) > (eskiKayit.number_of_laps || 0)));
        if (daIyi) { temiz[onceki.idx] = { r: r, pos: pos, i: i }; gorulen[r.driver_number] = { idx: onceki.idx, pos: pos }; }
        return;
      }
      gorulen[r.driver_number] = { idx: temiz.length, pos: pos };
      temiz.push({ r: r, pos: pos, i: i });
    });
    temiz.sort(function (a, b) {
      if (a.pos == null && b.pos == null) { return a.i - b.i; }
      if (a.pos == null) { return 1; }
      if (b.pos == null) { return -1; }
      return a.pos - b.pos || a.i - b.i;
    });
    if (temiz.some(function (x) { return x.pos == null; })) { u.push("position alanı olmayan kayıt(lar) listenin sonuna eklendi"); }
    if (rows.some(function (r, i) { return i > 0 && r && rows[i - 1] && r.position != null && rows[i - 1].position != null && r.position < rows[i - 1].position; })) { u.push("API dizisi position sırasında gelmedi; position'a göre yeniden sıralandı"); }
    return temiz.map(function (x) { return x.r; });
  }

  // FP: [{sira, kod, ad, takim, sure, fark, tur}]
  function fpCoz(rows, m, uyarilar) {
    var liste = siraliSatirlar(rows, uyarilar).map(function (r, i) {
      var d = surucu(m, r.driver_number);
      var sure = Array.isArray(r.duration) ? r.duration.filter(function (x) { return typeof x === "number"; }).sort(function (a, b) { return a - b; })[0] : r.duration;
      return { sira: r.position == null ? i + 1 : r.position, kod: d.kod, ad: d.ad, takim: d.takim, sure: sureYaz(sure), fark: farkYaz(Array.isArray(r.gap_to_leader) ? null : r.gap_to_leader),
               tur: r.number_of_laps || 0, dnf: !!r.dnf, dns: !!r.dns, dsq: !!r.dsq, _sn: sure };
    });
    // Debug uyarısı: süreler position sırasında artmıyorsa yalnızca bilgi verilir (resmi sınıflandırma süreden farklı olabilir), sonuç engellenmez
    var onceki = null, sirasiz = false;
    liste.forEach(function (x) { if (typeof x._sn === "number") { if (onceki != null && x._sn < onceki - 1e-9) { sirasiz = true; } onceki = x._sn; } delete x._sn; });
    if (sirasiz && uyarilar) { uyarilar.push("süreler position sırasında artmıyor (uyarı; sonuç yine de kabul edildi)"); }
    return liste;
  }
  // Sprint Sıralaması: Jolpica Qualifying satırı biçimine çevrilir (HaftaVeri.siralamaCoz aynen kullanılır)
  function sqCoz(rows, m, uyarilar) {
    return siraliSatirlar(rows, uyarilar).map(function (r, i) {
      var d = surucu(m, r.driver_number);
      var dur = Array.isArray(r.duration) ? r.duration : [r.duration];
      return { position: String(r.position == null ? i + 1 : r.position),
               Driver: { code: d.kod, givenName: d.ilk, familyName: d.son || d.ad }, Constructor: { name: d.takim },
               Q1: sureYaz(dur[0]), Q2: sureYaz(dur[1]), Q3: sureYaz(dur[2]) };
    });
  }

  var SEANS_ESLEME = { fp1: "FirstPractice", fp2: "SecondPractice", fp3: "ThirdPractice" };

  // Ana giriş. kaynak: fp1|fp2|fp3|sq. Dönüş: { durum, rows, oturum }
  // durum: ok | bos (sonuç henüz yok) | oturum-yok | yok-meeting | kisit | hata
  async function sonucAl(hafta, seans, kaynak) {
    var onbellekAdi = "of-sonuc-" + hafta.sezon + "-" + hafta.tur + "-" + kaynak;
    var kayit = JI().oku(onbellekAdi);
    if (kayit && kayit.veri && kayit.veri.rows && kayit.veri.rows.length) { return { durum: "ok", rows: kayit.veri.rows, oturum: kayit.veri.oturum, onbellekten: true }; }

    var mt = await meetingBul(hafta);
    if (mt.durum !== "ok") { return { durum: mt.durum }; }
    var anahtar = seans.anahtar;
    var os = await oturumlariAl(hafta, mt.meeting, seans, anahtar, false);
    if (os.durum !== "ok") { return { durum: os.durum === "bos" ? "oturum-yok" : os.durum }; }
    var oturum = oturumEsle(anahtar, os.liste, seans);
    if (!oturum) {
      var os2 = await oturumlariAl(hafta, mt.meeting, seans, anahtar, true); // listede yoksa bir kez tazele
      oturum = os2.durum === "ok" ? oturumEsle(anahtar, os2.liste, seans) : null;
    }
    if (!oturum) { return { durum: "oturum-yok", oturumlar: os.liste.map(function (o) { return o.session_name; }) }; }
    var sr = await sirali("session_result?session_key=" + oturum.session_key);
    if (sr.tur !== "ok") { return { durum: sr.tur, oturum: { ad: oturum.session_name, tur: oturum.session_type, anahtar: oturum.session_key } }; }
    if (!Array.isArray(sr.veri) || !sr.veri.length) { return { durum: "bos", oturum: { ad: oturum.session_name, tur: oturum.session_type, anahtar: oturum.session_key } }; }
    var no = sr.veri.map(function (r) { return r.driver_number; });
    var m = await suruculer(mt.meeting.meeting_key, oturum.session_key, no);
    var uyarilar = [];
    var rows = kaynak === "sq" ? sqCoz(sr.veri, m, uyarilar) : fpCoz(sr.veri, m, uyarilar);
    if (!rows.length) { return { durum: "bos", oturum: { ad: oturum.session_name, tur: oturum.session_type, anahtar: oturum.session_key } }; }
    if (uyarilar.length && typeof console !== "undefined") { console.debug("[OpenF1 " + kaynak + "] " + uyarilar.join(" | ")); }
    var bilgi = { ad: oturum.session_name, tur: oturum.session_type, anahtar: oturum.session_key };
    JI().kaydet(onbellekAdi, { rows: rows, oturum: bilgi }); // tamamlanmış seans sonucu bir daha çağrılmaz
    return { durum: "ok", rows: rows, oturum: bilgi, uyarilar: uyarilar };
  }

  window.OpenF1Veri = { sonucAl: sonucAl, meetingBul: meetingBul, oturumEsle: oturumEsle, sureYaz: sureYaz, SEANS_ESLEME: SEANS_ESLEME,
                        gunluk: gunluk, _bellek: bellek, fpCoz: fpCoz, sqCoz: sqCoz,
                        sirali: sirali };   // A3.4b: aynı kuyruk/hız sınırı/429 mantığı yeniden kullanılır (davranış değişmedi; yalnızca dışa açıldı)
})();
