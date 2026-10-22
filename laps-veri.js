/* OPENF1 A7.2 — HISTORICAL LAPS (yalnızca seans SONRASI, kullanıcı "Tur Analizi"ni açınca).
   1) SAF katman (DOM/ağ/depolama YOK; Node'da test edilir): ham `laps` satırları → normalize tur modeli → pilot bazında deterministik özet.
   2) VERİ katmanı (LapsVeri.yukle): tembel, tek seferlik; OpenF1Veri.meetingBul/sirali + JolpicaIstemci önbelleği. Canlı/ücretli OpenF1 yok;
      seans bitişi + 30 dk dolmadan istek yok; zamanlayıcı/polling yok. Race Control, ticker, Race Feed, session-state ve sonuç motoruna dokunmaz.
   Yorum/nedensellik YOK: yalnızca ölçülen değerler (en hızlı tur, sektör, speed trap, süreli tur sayısı). Veri uydurulmaz; olmayan alan null.
   Q/SQ fazı (Q1/Q2/Q3): `laps` verisinde faz alanı yok → faz etiketi ÜRETİLMEZ. */
(function (kok) {
  "use strict";

  // ---------- 1) SAF KATMAN ----------
  function sayi(x) { if (x == null || x === "") { return null; } var n = Number(x); return isFinite(n) ? n : null; }
  function poz(x) { var n = sayi(x); return n != null && n > 0 ? n : null; }
  function dizi(x) { return Array.isArray(x) ? x.map(function (v) { return v == null ? null : sayi(v); }) : null; }

  // Ham satırlar → { turlar, atilan, tekrar }. Başka session_key/meeting_key satırları ATILIR. Aynı (pilot, tur) tekrarı tek: süresi olan tercih edilir.
  function normalize(rows, opts) {
    opts = opts || {}; var atilan = 0, tekrar = 0, harita = {}, sira = [];
    (Array.isArray(rows) ? rows : []).forEach(function (r) {
      if (!r || typeof r !== "object") { atilan++; return; }
      var dn = sayi(r.driver_number), ln = sayi(r.lap_number);
      if (dn == null || ln == null) { atilan++; return; }
      if (opts.sessionKey != null && r.session_key != null && Number(r.session_key) !== Number(opts.sessionKey)) { atilan++; return; }
      if (opts.meetingKey != null && r.meeting_key != null && Number(r.meeting_key) !== Number(opts.meetingKey)) { atilan++; return; }
      var ds = r.date_start ? Date.parse(r.date_start) : NaN;
      var t = { sessionKey: r.session_key != null ? Number(r.session_key) : (opts.sessionKey != null ? Number(opts.sessionKey) : null), driverNumber: dn, lapNumber: ln,
                lapDuration: poz(r.lap_duration), sector1: poz(r.duration_sector_1), sector2: poz(r.duration_sector_2), sector3: poz(r.duration_sector_3),
                i1Speed: poz(r.i1_speed), i2Speed: poz(r.i2_speed), stSpeed: poz(r.st_speed), isPitOutLap: r.is_pit_out_lap === true,
                segmentsSector1: dizi(r.segments_sector_1), segmentsSector2: dizi(r.segments_sector_2), segmentsSector3: dizi(r.segments_sector_3), dateStart: isFinite(ds) ? new Date(ds).toISOString() : null };
      var k = dn + "|" + ln;
      if (harita[k]) { tekrar++; if (harita[k].lapDuration == null && t.lapDuration != null) { sira[sira.indexOf(harita[k])] = t; harita[k] = t; } return; }
      harita[k] = t; sira.push(t);
    });
    sira.sort(function (a, b) { return a.driverNumber - b.driverNumber || a.lapNumber - b.lapNumber; });
    return { turlar: sira, atilan: atilan, tekrar: tekrar };
  }

  // "Süreli tur": lap_duration olan ve pit-out olmayan tur. (OpenF1 laps verisi iptal/silinmiş tur bilgisi taşımaz → "geçerli" iddiası YOK.)
  function sureliMi(t) { return t.lapDuration != null && !t.isPitOutLap; }

  // Pilot bazında özet. Dönüş: [{ driverNumber, toplamTur, sureliTur, enHizli:{lapNumber,lapDuration,sector1..3,stSpeed,dateStart}|null, maxStSpeed|null }]
  // Sıra: en hızlı tura göre (turu olmayanlar sonda, pilot numarası sırasıyla).
  function pilotOzetleri(turlar) {
    var g = {};
    (turlar || []).forEach(function (t) { (g[t.driverNumber] = g[t.driverNumber] || []).push(t); });
    var out = Object.keys(g).map(function (k) {
      var l = g[k], en = null, mx = null, sureli = 0;
      l.forEach(function (t) {
        if (t.stSpeed != null && (mx == null || t.stSpeed > mx)) { mx = t.stSpeed; }
        if (!sureliMi(t)) { return; }
        sureli++;
        if (!en || t.lapDuration < en.lapDuration || (t.lapDuration === en.lapDuration && t.lapNumber < en.lapNumber)) { en = t; }
      });
      return { driverNumber: Number(k), toplamTur: l.length, sureliTur: sureli, maxStSpeed: mx,
               enHizli: en ? { lapNumber: en.lapNumber, lapDuration: en.lapDuration, sector1: en.sector1, sector2: en.sector2, sector3: en.sector3, stSpeed: en.stSpeed, dateStart: en.dateStart } : null };
    });
    out.sort(function (a, b) {
      if (a.enHizli && b.enHizli) { return a.enHizli.lapDuration - b.enHizli.lapDuration || a.driverNumber - b.driverNumber; }
      if (a.enHizli) { return -1; } if (b.enHizli) { return 1; }
      return a.driverNumber - b.driverNumber;
    });
    return out;
  }

  // Yeniden kullanılabilir seans özeti (Ghost Lap / pilot vs pilot / Yarışı Kaçırdıysan v2 için taban)
  function ozet(turlar) {
    var p = pilotOzetleri(turlar), lider = p.filter(function (x) { return x.enHizli; })[0] || null;
    return { pilotSayisi: p.length, toplamTur: (turlar || []).length, sureliTur: p.reduce(function (a, x) { return a + x.sureliTur; }, 0),
             enHizliTur: lider ? { driverNumber: lider.driverNumber, lapNumber: lider.enHizli.lapNumber, lapDuration: lider.enHizli.lapDuration } : null };
  }

  // Biçimlendirme
  function sureYaz(sn) {
    if (sn == null || !isFinite(sn)) { return "—"; }
    var d = Math.floor(sn / 60), kalan = sn - d * 60, s = kalan.toFixed(3);
    if (kalan < 9.9995) { s = "0" + s; }
    return d > 0 ? d + ":" + s : kalan.toFixed(3);
  }
  function sektorYaz(sn) { return sn == null ? "—" : sn.toFixed(3); }
  function hizYaz(v) { return v == null ? "—" : Math.round(v) + " km/s"; }

  var MESAJ = { yayimlanmadi: "Tur verisi henüz yayımlanmadı.", hata: "OpenF1 tur verisine şu anda ulaşılamıyor." };
  function durumMesaji(d) {
    if (d === "bos" || d === "yayimlanmadi" || d === "oturum-yok" || d === "yok-meeting") { return MESAJ.yayimlanmadi; }
    if (d === "hata" || d === "kisit") { return MESAJ.hata; }
    return "";
  }

  // Mini-sektör (segments_sector_*) yalnız veri GERÇEKTEN varsa kullanılır. OpenF1 belgelerine göre Sprint/Race seanslarında bu alanlar yoktur
  // (bu bir hata/eksik veri DEĞİLDİR); renkler TV grafikleriyle birebir uyuşmayabilir. İleride mini-sektör özelliği bu kapıdan geçmelidir.
  function segmentVarMi(turlar) {
    return (turlar || []).some(function (t) { return [t.segmentsSector1, t.segmentsSector2, t.segmentsSector3].some(function (a) { return Array.isArray(a) && a.length > 0; }); });
  }

  // Önbellek için SIKI satır: [no, tur, süre, s1, s2, s3, i1, i2, st, pit(0/1), dateStartMs]  (segmentler yazılmaz — boyut)
  function sikistir(turlar) {
    return turlar.map(function (t) { return [t.driverNumber, t.lapNumber, t.lapDuration, t.sector1, t.sector2, t.sector3, t.i1Speed, t.i2Speed, t.stSpeed, t.isPitOutLap ? 1 : 0, t.dateStart ? Date.parse(t.dateStart) : null]; });
  }
  function ac(satirlar, sessionKey) {
    return (satirlar || []).map(function (a) {
      return { sessionKey: sessionKey, driverNumber: a[0], lapNumber: a[1], lapDuration: a[2], sector1: a[3], sector2: a[4], sector3: a[5], i1Speed: a[6], i2Speed: a[7], stSpeed: a[8], isPitOutLap: a[9] === 1,
               segmentsSector1: null, segmentsSector2: null, segmentsSector3: null, dateStart: a[10] != null ? new Date(a[10]).toISOString() : null };
    });
  }

  var API = { normalize: normalize, sureliMi: sureliMi, segmentVarMi: segmentVarMi, pilotOzetleri: pilotOzetleri, ozet: ozet, sureYaz: sureYaz, sektorYaz: sektorYaz, hizYaz: hizYaz, durumMesaji: durumMesaji, MESAJ: MESAJ, sikistir: sikistir, ac: ac };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
  if (!kok) { return; }
  kok.LapsHesap = API;

  // ---------- 2) VERİ KATMANI ----------
  var OF = kok.OpenF1Veri, JI = kok.JolpicaIstemci, RC = kok.RaceControl;
  if (!OF || !OF.sirali || !OF.meetingBul || !JI || !RC || !RC.oturumSec) { return; }
  var BOS_OMUR_MS = 10 * 60 * 1000, TAZE_MS = 2 * 3600 * 1000, KALICI_LIMIT = 200000 /* tek seans için en çok ~200 KB */, TOPLAM_LIMIT = 600000;
  var bekleyen = {}, bellekBos = {}, bellekVeri = {}, cagri = [];

  function anahtar(yil, tur, seans) { return "laps-" + yil + "-r" + tur + "-" + seans; }
  function bul(f, d) { try { return f(); } catch (e) { return d; } }
  function butceTemizle(yil, tur) {                 // localStorage bütçesi: yalnızca 'laps-*' verileri; eski turlar silinir, toplam sınırlandırılır
    bul(function () {
      var onek = JI.ONEK + "laps-", liste = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i); if (!k || k.indexOf(onek) !== 0) { continue; }
        var m = /^laps-(\d{4})-r(\d+)-/.exec(k.slice(JI.ONEK.length)); if (!m) { continue; }
        var v = localStorage.getItem(k) || "", tm = 0; try { tm = JSON.parse(v).t || 0; } catch (e) { /* bozuk kayıt silinir */ }
        liste.push({ k: k, n: v.length, t: tm, eski: Number(m[1]) !== yil || Number(m[2]) < tur - 2 || Number(m[2]) > tur + 1 });
      }
      liste.filter(function (x) { return x.eski || !x.t; }).forEach(function (x) { localStorage.removeItem(x.k); });
      var kalan = liste.filter(function (x) { return !x.eski && x.t; }).sort(function (a, b) { return b.t - a.t; }), top = 0;
      kalan.forEach(function (x) { top += x.n; if (top > TOPLAM_LIMIT) { localStorage.removeItem(x.k); } });
    });
  }
  function isimler() { return bul(function () { return OF._bellek.surucular; }, {}) || {}; }

  // hafta: HaftaVeri.haftaKur çıktısı; seans: hafta.seanslar öğesi.
  // Dönüş: { durum, turlar?, ozet?, pilotlar?, isimler?, oturum?, onbellekten?, kalici? }  durum: ok|bos|yayimlanmadi|oturum-yok|yok-meeting|kisit|hata
  async function yukle(hafta, seans) {
    var yil = Number(hafta.sezon), tur = Number(hafta.tur), ak = anahtar(yil, tur, seans.anahtar), simdi = Date.now();
    if (bellekVeri[ak]) { return Object.assign({}, bellekVeri[ak], { onbellekten: true }); }
    var kayit = JI.oku(ak);
    if (kayit && kayit.veri && kayit.veri.durum === "ok" && kayit.veri.s && kayit.veri.s.length) {
      var yas = kayit.veri.alinma != null && kayit.veri.bitis != null ? kayit.veri.alinma - kayit.veri.bitis : TAZE_MS;
      if (yas >= TAZE_MS || simdi - kayit.t < RC.YAYIN_GECIKME_MS) {
        var tl = ac(kayit.veri.s, kayit.veri.oturum && kayit.veri.oturum.anahtar);
        var sonuc0 = { durum: "ok", turlar: tl, ozet: ozet(tl), isimler: kayit.veri.isim || {}, oturum: kayit.veri.oturum, onbellekten: true, kalici: true };
        bellekVeri[ak] = sonuc0; return sonuc0;
      }
    }
    if (bellekBos[ak] && simdi - bellekBos[ak].t < BOS_OMUR_MS) { return { durum: bellekBos[ak].durum, onbellekten: true }; }
    if (bekleyen[ak]) { return bekleyen[ak]; }
    bekleyen[ak] = (async function () {
      var bitis = seans.bitis.getTime();
      if (!RC.yayimlandiMi(bitis, simdi)) { return { durum: "yayimlanmadi" }; }
      var mt = await OF.meetingBul(hafta);
      if (mt.durum !== "ok") { if (mt.durum === "yok-meeting") { bellekBos[ak] = { t: Date.now(), durum: "yok-meeting" }; } return { durum: mt.durum }; }
      var mk = mt.meeting.meeting_key, oturum = null, ok = JI.oku("laps-oturum-" + yil + "-r" + tur + "-" + seans.anahtar);
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
        JI.kaydet("laps-oturum-" + yil + "-r" + tur + "-" + seans.anahtar, oturum);
      }
      var oBitis = Date.parse(oturum.date_end); if (isFinite(oBitis)) { bitis = oBitis; }
      if (!RC.yayimlandiMi(bitis, Date.now())) { return { durum: "yayimlanmadi" }; }
      cagri.push(ak);
      var rs = await OF.sirali("laps?session_key=" + oturum.session_key);
      if (rs.tur === "kisit") { return { durum: "kisit" }; }
      if (rs.tur === "bos") { bellekBos[ak] = { t: Date.now(), durum: "bos" }; return { durum: "bos" }; }
      if (rs.tur !== "ok" || !Array.isArray(rs.veri)) { return { durum: "hata" }; }
      var n = normalize(rs.veri, { sessionKey: oturum.session_key, meetingKey: mk });
      rs = null;                                                   // ham JSON'u bırak (bellek)
      if (!n.turlar.length) { bellekBos[ak] = { t: Date.now(), durum: "bos" }; return { durum: "bos" }; }
      // pilot adları (bir kez; bellekte yoksa 1 'drivers' çağrısı)
      var no = {}; n.turlar.forEach(function (t) { no[t.driverNumber] = 1; });
      var im = isimler()[mk] || {};
      if (Object.keys(no).some(function (k) { return !im[k]; })) {
        var rd = await OF.sirali("drivers?session_key=" + oturum.session_key);
        if (rd.tur === "ok" && Array.isArray(rd.veri)) {
          rd.veri.forEach(function (d) { if (d && d.driver_number != null) { im[d.driver_number] = { kod: d.name_acronym, ad: d.full_name || "", takim: d.team_name || "" }; } });
          bul(function () { OF._bellek.surucular[mk] = im; });
        }
      }
      var isim = {}; Object.keys(no).forEach(function (k) { if (im[k]) { isim[k] = { kod: im[k].kod, takim: im[k].takim || "" }; } });
      var bilgi = { anahtar: oturum.session_key, ad: oturum.ad };
      var sonuc = { durum: "ok", turlar: n.turlar, ozet: ozet(n.turlar), isimler: isim, oturum: bilgi, tekrar: n.tekrar, atilan: n.atilan, kalici: false };
      var kayitObj = { durum: "ok", s: sikistir(n.turlar), isim: isim, oturum: bilgi, alinma: Date.now(), bitis: bitis };
      var boyut = JSON.stringify(kayitObj).length; sonuc.boyut = boyut;
      if (boyut <= KALICI_LIMIT) { butceTemizle(yil, tur); JI.kaydet(ak, kayitObj); sonuc.kalici = true; }   // aşırı büyükse yalnız bellekte (sayfa ömrü); localStorage şişirilmez
      bellekVeri[ak] = sonuc;
      return sonuc;
    })();
    try { return await bekleyen[ak]; } finally { delete bekleyen[ak]; }
  }

  // SALT OKUNUR, AĞSIZ önbellek okuma (bellek → localStorage); yoksa null.
  function oku(hafta, seans) {
    var yil = Number(hafta.sezon), tur = Number(hafta.tur), ak = anahtar(yil, tur, seans.anahtar), simdi = Date.now();
    if (bellekVeri[ak]) { return Object.assign({}, bellekVeri[ak], { onbellekten: true }); }
    var kayit = JI.oku(ak);
    if (kayit && kayit.veri && kayit.veri.durum === "ok" && kayit.veri.s && kayit.veri.s.length) {
      var yas = kayit.veri.alinma != null && kayit.veri.bitis != null ? kayit.veri.alinma - kayit.veri.bitis : TAZE_MS;
      if (yas >= TAZE_MS || simdi - kayit.t < RC.YAYIN_GECIKME_MS) {
        var tl = ac(kayit.veri.s, kayit.veri.oturum && kayit.veri.oturum.anahtar);
        var s0 = { durum: "ok", turlar: tl, ozet: ozet(tl), isimler: kayit.veri.isim || {}, oturum: kayit.veri.oturum, onbellekten: true, kalici: true };
        bellekVeri[ak] = s0; return s0;
      }
    }
    return null;
  }
  kok.LapsVeri = { yukle: yukle, oku: oku, anahtar: anahtar, KALICI_LIMIT: KALICI_LIMIT, TOPLAM_LIMIT: TOPLAM_LIMIT, _cagri: cagri };
})(typeof window !== "undefined" ? window : null);
