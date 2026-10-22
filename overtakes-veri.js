/* OPENF1 A7.3 — HISTORICAL OVERTAKES (yalnızca Sprint/Race, seans SONRASI, kullanıcı "Geçişler"i açınca).
   OpenF1 belgesi (openf1.org/docs, overtakes): date, meeting_key, session_key, overtaking_driver_number, overtaken_driver_number, position (geçen pilotun geçişten SONRAKİ sırası).
   Belge notları: "yalnızca yarışlarda bulunur ve eksik olabilir"; kayıtlar pist içi geçişlerin yanında pit ve yarış sonrası ceza kaynaklı sıra değişimlerini de içerebilir.
   → `lap_number` alanı YOK: lapNumber null kalır (turdan türetme/tahmin yapılmaz). Pit/ceza kaynaklı kayıtlar ayrıştırılmaz ve ayrıca "geçiş" üretilmez.
   SAF katman (Node'da test edilir) + tembel VERİ katmanı (OpenF1Veri.meetingBul/sirali + JolpicaIstemci önbelleği). Canlı/ücretli OpenF1, polling, zamanlayıcı YOK.
   Seans bitişi + 30 dk dolmadan istek yok. Race Control / Laps / ticker / Race Feed / session-state / sonuç motoruna dokunmaz. Yorum/nedensellik üretilmez. */
(function (kok) {
  "use strict";
  var SEANSLAR = { Sprint: 1, Race: 1 };            // ürün sınırı: FP/SQ/Q için gösterilmez
  function sayi(x) { if (x == null || x === "") { return null; } var n = Number(x); return isFinite(n) ? n : null; }
  function poz(x) { var n = sayi(x); return n != null && n > 0 ? n : null; }

  // Ham satırlar → { gecisler, atilan, tekrar }. Başka session_key/meeting_key atılır; iki pilot numarası da yoksa atılır; aynı olay (date+geçen+geçilen+sıra) tek.
  function normalize(rows, opts) {
    opts = opts || {}; var atilan = 0, tekrar = 0, gorulen = {}, out = [];
    (Array.isArray(rows) ? rows : []).forEach(function (r) {
      if (!r || typeof r !== "object") { atilan++; return; }
      var ms = r.date ? Date.parse(r.date) : NaN, a = poz(r.overtaking_driver_number), b = poz(r.overtaken_driver_number);
      if (!isFinite(ms) || (a == null && b == null)) { atilan++; return; }
      if (opts.sessionKey != null && r.session_key != null && Number(r.session_key) !== Number(opts.sessionKey)) { atilan++; return; }
      if (opts.meetingKey != null && r.meeting_key != null && Number(r.meeting_key) !== Number(opts.meetingKey)) { atilan++; return; }
      var pos = poz(r.position), k = ms + "|" + a + "|" + b + "|" + pos;
      if (gorulen[k]) { tekrar++; return; }
      gorulen[k] = 1;
      out.push({ sessionKey: r.session_key != null ? Number(r.session_key) : (opts.sessionKey != null ? Number(opts.sessionKey) : null), date: new Date(ms).toISOString(), ms: ms,
                 lapNumber: poz(r.lap_number), overtakingDriverNumber: a, overtakenDriverNumber: b, position: pos });
    });
    out.sort(function (x, y) { return x.ms - y.ms; });
    return { gecisler: out, atilan: atilan, tekrar: tekrar };
  }

  // Pilot bazında: yaptığı / kendisine yapılan geçiş sayısı. Sıra: yapılan çok → az; eşitlikte pilot numarası.
  function pilotSayilari(gecisler) {
    var m = {};
    function g(n) { return m[n] || (m[n] = { driverNumber: n, yapilan: 0, yapilanGecis: 0 }); }
    (gecisler || []).forEach(function (e) {
      if (e.overtakingDriverNumber != null) { g(e.overtakingDriverNumber).yapilan++; }
      if (e.overtakenDriverNumber != null) { g(e.overtakenDriverNumber).yapilanGecis++; }
    });
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.yapilan - a.yapilan || a.driverNumber - b.driverNumber; });
  }
  // yapilan = pilotun yaptığı geçiş, yapilanGecis = pilota yapılan (geçilme) sayısı

  function ozet(gecisler) {
    var p = pilotSayilari(gecisler);
    return { toplam: (gecisler || []).length, pilotSayisi: p.length, enCokGecis: p.filter(function (x) { return x.yapilan > 0; }).slice(0, 3), sonGecisler: (gecisler || []).slice(-3) };
  }

  var MESAJ = { yayimlanmadi: "Geçiş verisi henüz yayımlanmadı.", hata: "OpenF1 geçiş verisine şu anda ulaşılamıyor." };
  function durumMesaji(d) {
    if (d === "bos" || d === "yayimlanmadi" || d === "oturum-yok" || d === "yok-meeting") { return MESAJ.yayimlanmadi; }
    if (d === "hata" || d === "kisit") { return MESAJ.hata; }
    return "";
  }
  function sikistir(g) { return g.map(function (e) { return [e.ms, e.overtakingDriverNumber, e.overtakenDriverNumber, e.position, e.lapNumber]; }); }
  function ac(s, sessionKey) {
    return (s || []).map(function (a) { return { sessionKey: sessionKey, date: new Date(a[0]).toISOString(), ms: a[0], overtakingDriverNumber: a[1], overtakenDriverNumber: a[2], position: a[3], lapNumber: a[4] }; });
  }

  var API = { normalize: normalize, pilotSayilari: pilotSayilari, ozet: ozet, durumMesaji: durumMesaji, MESAJ: MESAJ, sikistir: sikistir, ac: ac, SEANSLAR: SEANSLAR };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
  if (!kok) { return; }
  kok.OvertakesHesap = API;

  // ---------- VERİ KATMANI ----------
  var OF = kok.OpenF1Veri, JI = kok.JolpicaIstemci, RC = kok.RaceControl;
  if (!OF || !OF.sirali || !OF.meetingBul || !JI || !RC || !RC.oturumSec) { return; }
  var BOS_OMUR_MS = 10 * 60 * 1000, TAZE_MS = 2 * 3600 * 1000, KALICI_LIMIT = 100000, TOPLAM_LIMIT = 300000;
  var bekleyen = {}, bellekBos = {}, bellekVeri = {}, cagri = [];
  function anahtar(yil, tur, seans) { return "ovt-" + yil + "-r" + tur + "-" + seans; }
  function bul(f, d) { try { return f(); } catch (e) { return d; } }
  function butceTemizle(yil, tur) {
    bul(function () {
      var onek = JI.ONEK + "ovt-", liste = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i); if (!k || k.indexOf(onek) !== 0) { continue; }
        var m = /^ovt-(\d{4})-r(\d+)-/.exec(k.slice(JI.ONEK.length)); if (!m) { continue; }
        var v = localStorage.getItem(k) || "", tm = 0; try { tm = JSON.parse(v).t || 0; } catch (e) { /* bozuk kayıt silinir */ }
        liste.push({ k: k, n: v.length, t: tm, eski: Number(m[1]) !== yil || Number(m[2]) < tur - 2 || Number(m[2]) > tur + 1 });
      }
      liste.filter(function (x) { return x.eski || !x.t; }).forEach(function (x) { localStorage.removeItem(x.k); });
      var top = 0;
      liste.filter(function (x) { return !x.eski && x.t; }).sort(function (a, b) { return b.t - a.t; }).forEach(function (x) { top += x.n; if (top > TOPLAM_LIMIT) { localStorage.removeItem(x.k); } });
    });
  }

  // Dönüş: { durum, gecisler?, ozet?, isimler?, oturum?, onbellekten?, kalici?, boyut? }  durum: ok|bos|yayimlanmadi|oturum-yok|yok-meeting|kisit|hata
  async function yukle(hafta, seans) {
    if (!SEANSLAR[seans.anahtar]) { return { durum: "desteklenmiyor" }; }
    var yil = Number(hafta.sezon), tur = Number(hafta.tur), ak = anahtar(yil, tur, seans.anahtar), simdi = Date.now();
    if (bellekVeri[ak]) { return Object.assign({}, bellekVeri[ak], { onbellekten: true }); }
    var kayit = JI.oku(ak);
    if (kayit && kayit.veri && kayit.veri.durum === "ok" && kayit.veri.s && kayit.veri.s.length) {
      var yas = kayit.veri.alinma != null && kayit.veri.bitis != null ? kayit.veri.alinma - kayit.veri.bitis : TAZE_MS;
      if (yas >= TAZE_MS || simdi - kayit.t < RC.YAYIN_GECIKME_MS) {
        var gl = ac(kayit.veri.s, kayit.veri.oturum && kayit.veri.oturum.anahtar);
        var s0 = { durum: "ok", gecisler: gl, ozet: ozet(gl), isimler: kayit.veri.isim || {}, oturum: kayit.veri.oturum, onbellekten: true, kalici: true };
        bellekVeri[ak] = s0; return s0;
      }
    }
    if (bellekBos[ak] && simdi - bellekBos[ak].t < BOS_OMUR_MS) { return { durum: bellekBos[ak].durum, onbellekten: true }; }
    if (bekleyen[ak]) { return bekleyen[ak]; }
    bekleyen[ak] = (async function () {
      var bitis = seans.bitis.getTime();
      if (!RC.yayimlandiMi(bitis, simdi)) { return { durum: "yayimlanmadi" }; }
      var mt = await OF.meetingBul(hafta);
      if (mt.durum !== "ok") { if (mt.durum === "yok-meeting") { bellekBos[ak] = { t: Date.now(), durum: "yok-meeting" }; } return { durum: mt.durum }; }
      var mk = mt.meeting.meeting_key, oturum = null, ok = JI.oku("ovt-oturum-" + yil + "-r" + tur + "-" + seans.anahtar);
      if (ok && ok.veri && ok.veri.session_key) { oturum = ok.veri; }
      else {
        var liste = bul(function () { var b = OF._bellek.oturumlar[mk]; return b && b.liste ? b.liste : null; }, null);
        var sec = liste ? RC.oturumSec(liste, seans.anahtar, seans.baslangic.getTime()) : null;
        if (!sec) {
          var r = await OF.sirali("sessions?meeting_key=" + mk);
          if (r.tur === "kisit" || r.tur === "hata") { return { durum: r.tur }; }
          liste = r.tur === "ok" && Array.isArray(r.veri) ? r.veri : [];
          if (liste.length) { bul(function () { OF._bellek.oturumlar[mk] = { t: Date.now(), liste: liste }; }); }
          sec = RC.oturumSec(liste, seans.anahtar, seans.baslangic.getTime());
        }
        if (!sec) { bellekBos[ak] = { t: Date.now(), durum: "oturum-yok" }; return { durum: "oturum-yok" }; }
        oturum = { session_key: sec.session_key, meeting_key: sec.meeting_key, ad: sec.session_name, date_end: sec.date_end };
        JI.kaydet("ovt-oturum-" + yil + "-r" + tur + "-" + seans.anahtar, oturum);
      }
      var oBitis = Date.parse(oturum.date_end); if (isFinite(oBitis)) { bitis = oBitis; }
      if (!RC.yayimlandiMi(bitis, Date.now())) { return { durum: "yayimlanmadi" }; }
      cagri.push(ak);
      var rs = await OF.sirali("overtakes?session_key=" + oturum.session_key);
      if (rs.tur === "kisit") { return { durum: "kisit" }; }
      if (rs.tur === "bos") { bellekBos[ak] = { t: Date.now(), durum: "bos" }; return { durum: "bos" }; }
      if (rs.tur !== "ok" || !Array.isArray(rs.veri)) { return { durum: "hata" }; }
      var n = normalize(rs.veri, { sessionKey: oturum.session_key, meetingKey: mk });
      if (!n.gecisler.length) { bellekBos[ak] = { t: Date.now(), durum: "bos" }; return { durum: "bos" }; }
      // pilot adları: mevcut openf1-veri bellek önbelleği; yalnız eksik numara varsa tek 'drivers' çağrısı (aynı kuyruk)
      var no = {}; n.gecisler.forEach(function (e) { if (e.overtakingDriverNumber != null) { no[e.overtakingDriverNumber] = 1; } if (e.overtakenDriverNumber != null) { no[e.overtakenDriverNumber] = 1; } });
      var im = bul(function () { return OF._bellek.surucular[mk]; }, null) || {};
      if (Object.keys(no).some(function (k) { return !im[k]; })) {
        var rd = await OF.sirali("drivers?session_key=" + oturum.session_key);
        if (rd.tur === "ok" && Array.isArray(rd.veri)) {
          rd.veri.forEach(function (d) { if (d && d.driver_number != null) { im[d.driver_number] = { kod: d.name_acronym, ad: d.full_name || ((d.first_name || "") + " " + (d.last_name || "")).trim(), takim: d.team_name || "" }; } });
          bul(function () { OF._bellek.surucular[mk] = im; });
        }
      }
      var isim = {}; Object.keys(no).forEach(function (k) { if (im[k]) { isim[k] = { kod: im[k].kod, ad: im[k].ad || "" }; } });
      var bilgi = { anahtar: oturum.session_key, ad: oturum.ad };
      var sonuc = { durum: "ok", gecisler: n.gecisler, ozet: ozet(n.gecisler), isimler: isim, oturum: bilgi, tekrar: n.tekrar, atilan: n.atilan, kalici: false };
      var obj = { durum: "ok", s: sikistir(n.gecisler), isim: isim, oturum: bilgi, alinma: Date.now(), bitis: bitis };
      sonuc.boyut = JSON.stringify(obj).length;
      if (sonuc.boyut <= KALICI_LIMIT) { butceTemizle(yil, tur); JI.kaydet(ak, obj); sonuc.kalici = true; }
      bellekVeri[ak] = sonuc;
      return sonuc;
    })();
    try { return await bekleyen[ak]; } finally { delete bekleyen[ak]; }
  }
  // SALT OKUNUR, AĞSIZ önbellek okuma; yoksa null.
  function oku(hafta, seans) {
    if (!SEANSLAR[seans.anahtar]) { return null; }
    var yil = Number(hafta.sezon), tur = Number(hafta.tur), ak = anahtar(yil, tur, seans.anahtar), simdi = Date.now();
    if (bellekVeri[ak]) { return Object.assign({}, bellekVeri[ak], { onbellekten: true }); }
    var kayit = JI.oku(ak);
    if (kayit && kayit.veri && kayit.veri.durum === "ok" && kayit.veri.s && kayit.veri.s.length) {
      var yas = kayit.veri.alinma != null && kayit.veri.bitis != null ? kayit.veri.alinma - kayit.veri.bitis : TAZE_MS;
      if (yas >= TAZE_MS || simdi - kayit.t < RC.YAYIN_GECIKME_MS) {
        var gl = ac(kayit.veri.s, kayit.veri.oturum && kayit.veri.oturum.anahtar);
        var s0 = { durum: "ok", gecisler: gl, ozet: ozet(gl), isimler: kayit.veri.isim || {}, oturum: kayit.veri.oturum, onbellekten: true, kalici: true };
        bellekVeri[ak] = s0; return s0;
      }
    }
    return null;
  }
  kok.OvertakesVeri = { yukle: yukle, oku: oku, anahtar: anahtar, KALICI_LIMIT: KALICI_LIMIT, TOPLAM_LIMIT: TOPLAM_LIMIT, _cagri: cagri };
})(typeof window !== "undefined" ? window : null);
