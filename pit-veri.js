/* OPENF1 A7.4 — HISTORICAL PIT (yalnızca Sprint/Race, seans SONRASI, kullanıcı "Pit Stoplar"ı açınca).
   OpenF1 belgesi (openf1.org/docs, pit): date, driver_number, lap_number, lane_duration (pit lane'de geçen süre), stop_duration (aracın pit kutusunda DURDUĞU süre),
   meeting_key, session_key. `pit_duration` ESKİ/deprecated (lane_duration ile aynı; 2026 sezonu sonunda kaldırılacak) → HİÇ OKUNMAZ.
   `stop_duration` yalnızca 2024 ABD GP'den itibaren bulunur → eksik olması normaldir (null). stopDuration ≠ laneDuration: asla karıştırılmaz.
   SAF katman (Node'da test edilir) + tembel VERİ katmanı (OpenF1Veri.meetingBul/sirali + JolpicaIstemci önbelleği). Canlı/ücretli OpenF1, polling, zamanlayıcı YOK.
   Seans bitişi + 30 dk dolmadan istek yok. Race Control / Laps / Overtakes / stints / ticker / Race Feed / session-state / sonuç motoruna dokunmaz. Strateji yorumu üretilmez.
   Yeniden kullanılabilir: normalize `PitHesap.normalize` çıktısı ileride lastik stratejisi / stint değişimi / Yarışı Kaçırdıysan v2 tarafından okunabilir. */
(function (kok) {
  "use strict";
  var SEANSLAR = { Sprint: 1, Race: 1 };
  function sayi(x) { if (x == null || x === "") { return null; } var n = Number(x); return isFinite(n) ? n : null; }
  function poz(x) { var n = sayi(x); return n != null && n > 0 ? n : null; }

  // Ham satırlar → { kayitlar, atilan, tekrar }. Kimlik: session + pilot + tur + date(ms). Pilot numarası/tarih yoksa atılır.
  // Süreler: yalnızca lane_duration ve stop_duration okunur (>0, sonlu); yoksa null. (pit_duration okunmaz.)
  function normalize(rows, opts) {
    opts = opts || {}; var atilan = 0, tekrar = 0, gorulen = {}, out = [];
    (Array.isArray(rows) ? rows : []).forEach(function (r) {
      if (!r || typeof r !== "object") { atilan++; return; }
      var ms = r.date ? Date.parse(r.date) : NaN, dn = poz(r.driver_number);
      if (!isFinite(ms) || dn == null) { atilan++; return; }
      if (opts.sessionKey != null && r.session_key != null && Number(r.session_key) !== Number(opts.sessionKey)) { atilan++; return; }
      if (opts.meetingKey != null && r.meeting_key != null && Number(r.meeting_key) !== Number(opts.meetingKey)) { atilan++; return; }
      var sk = r.session_key != null ? Number(r.session_key) : (opts.sessionKey != null ? Number(opts.sessionKey) : null), ln = poz(r.lap_number);
      var k = sk + "|" + dn + "|" + ln + "|" + ms;
      if (gorulen[k]) { tekrar++; return; }
      gorulen[k] = 1;
      out.push({ sessionKey: sk, meetingKey: r.meeting_key != null ? Number(r.meeting_key) : (opts.meetingKey != null ? Number(opts.meetingKey) : null), date: new Date(ms).toISOString(), ms: ms,
                 driverNumber: dn, lapNumber: ln, laneDuration: poz(r.lane_duration), stopDuration: poz(r.stop_duration) });
    });
    out.sort(function (a, b) { return a.ms - b.ms || a.driverNumber - b.driverNumber; });
    return { kayitlar: out, atilan: atilan, tekrar: tekrar };
  }

  // Pilot bazında: toplam pit kaydı, en kısa stop, toplam pit lane süresi (yalnız bilinenlerin toplamı; laneEksik = süresi olmayan kayıt sayısı).
  function pilotOzetleri(kayitlar) {
    var m = {};
    (kayitlar || []).forEach(function (e) {
      var p = m[e.driverNumber] || (m[e.driverNumber] = { driverNumber: e.driverNumber, toplamPit: 0, enKisaStop: null, laneToplam: 0, laneEksik: 0 });
      p.toplamPit++;
      if (e.stopDuration != null && (p.enKisaStop == null || e.stopDuration < p.enKisaStop)) { p.enKisaStop = e.stopDuration; }
      if (e.laneDuration != null) { p.laneToplam += e.laneDuration; } else { p.laneEksik++; }
    });
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.toplamPit - a.toplamPit || a.driverNumber - b.driverNumber; });
  }
  // En kısa stop süresi olan 3 pilot (pilot başına en iyi stop); stop süresi olmayanlar listeye girmez.
  function enKisaStoplar(kayitlar, n) {
    return pilotOzetleri(kayitlar).filter(function (p) { return p.enKisaStop != null; })
      .sort(function (a, b) { return a.enKisaStop - b.enKisaStop || a.driverNumber - b.driverNumber; }).slice(0, n || 3)
      .map(function (p) { return { driverNumber: p.driverNumber, stopDuration: p.enKisaStop }; });
  }
  function ozet(kayitlar) {
    var k = kayitlar || [];
    return { toplam: k.length, pilotSayisi: pilotOzetleri(k).length, stopSureli: k.filter(function (e) { return e.stopDuration != null; }).length, enKisa: enKisaStoplar(k, 3), sonPitler: k.slice(-3) };
  }

  var MESAJ = { yayimlanmadi: "Pit verisi henüz yayımlanmadı.", hata: "OpenF1 pit verisine şu anda ulaşılamıyor." };
  function durumMesaji(d) {
    if (d === "bos" || d === "yayimlanmadi" || d === "oturum-yok" || d === "yok-meeting") { return MESAJ.yayimlanmadi; }
    if (d === "hata" || d === "kisit") { return MESAJ.hata; }
    return "";
  }
  function sikistir(g) { return g.map(function (e) { return [e.ms, e.driverNumber, e.lapNumber, e.laneDuration, e.stopDuration]; }); }
  function ac(s, sessionKey, meetingKey) {
    return (s || []).map(function (a) { return { sessionKey: sessionKey, meetingKey: meetingKey != null ? meetingKey : null, date: new Date(a[0]).toISOString(), ms: a[0], driverNumber: a[1], lapNumber: a[2], laneDuration: a[3], stopDuration: a[4] }; });
  }
  function stopYaz(sn) { return sn == null ? null : sn.toFixed(2) + " sn"; }
  function laneYaz(sn) { return sn == null ? null : sn.toFixed(1) + " sn"; }

  var API = { normalize: normalize, pilotOzetleri: pilotOzetleri, enKisaStoplar: enKisaStoplar, ozet: ozet, durumMesaji: durumMesaji, MESAJ: MESAJ, sikistir: sikistir, ac: ac, stopYaz: stopYaz, laneYaz: laneYaz, SEANSLAR: SEANSLAR };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
  if (!kok) { return; }
  kok.PitHesap = API;

  // ---------- VERİ KATMANI ----------
  var OF = kok.OpenF1Veri, JI = kok.JolpicaIstemci, RC = kok.RaceControl;
  if (!OF || !OF.sirali || !OF.meetingBul || !JI || !RC || !RC.oturumSec) { return; }
  var BOS_OMUR_MS = 10 * 60 * 1000, TAZE_MS = 2 * 3600 * 1000, KALICI_LIMIT = 60000, TOPLAM_LIMIT = 200000;
  var bekleyen = {}, bellekBos = {}, bellekVeri = {}, cagri = [];
  function anahtar(yil, tur, seans) { return "pit-" + yil + "-r" + tur + "-" + seans; }
  function bul(f, d) { try { return f(); } catch (e) { return d; } }
  function butceTemizle(yil, tur) {
    bul(function () {
      var onek = JI.ONEK + "pit-", liste = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i); if (!k || k.indexOf(onek) !== 0) { continue; }
        var m = /^pit-(\d{4})-r(\d+)-/.exec(k.slice(JI.ONEK.length)); if (!m) { continue; }
        var v = localStorage.getItem(k) || "", tm = 0; try { tm = JSON.parse(v).t || 0; } catch (e) { /* bozuk kayıt silinir */ }
        liste.push({ k: k, n: v.length, t: tm, eski: Number(m[1]) !== yil || Number(m[2]) < tur - 2 || Number(m[2]) > tur + 1 });
      }
      liste.filter(function (x) { return x.eski || !x.t; }).forEach(function (x) { localStorage.removeItem(x.k); });
      var top = 0;
      liste.filter(function (x) { return !x.eski && x.t; }).sort(function (a, b) { return b.t - a.t; }).forEach(function (x) { top += x.n; if (top > TOPLAM_LIMIT) { localStorage.removeItem(x.k); } });
    });
  }

  // Dönüş: { durum, kayitlar?, ozet?, isimler?, oturum?, onbellekten?, kalici?, boyut? }  durum: ok|bos|yayimlanmadi|oturum-yok|yok-meeting|kisit|hata
  async function yukle(hafta, seans) {
    if (!SEANSLAR[seans.anahtar]) { return { durum: "desteklenmiyor" }; }
    var yil = Number(hafta.sezon), tur = Number(hafta.tur), ak = anahtar(yil, tur, seans.anahtar), simdi = Date.now();
    if (bellekVeri[ak]) { return Object.assign({}, bellekVeri[ak], { onbellekten: true }); }
    var kayit = JI.oku(ak);
    if (kayit && kayit.veri && kayit.veri.durum === "ok" && kayit.veri.s && kayit.veri.s.length) {
      var yas = kayit.veri.alinma != null && kayit.veri.bitis != null ? kayit.veri.alinma - kayit.veri.bitis : TAZE_MS;
      if (yas >= TAZE_MS || simdi - kayit.t < RC.YAYIN_GECIKME_MS) {
        var gl = ac(kayit.veri.s, kayit.veri.oturum && kayit.veri.oturum.anahtar);
        var s0 = { durum: "ok", kayitlar: gl, ozet: ozet(gl), isimler: kayit.veri.isim || {}, oturum: kayit.veri.oturum, onbellekten: true, kalici: true };
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
      var mk = mt.meeting.meeting_key, oturum = null, ok = JI.oku("pit-oturum-" + yil + "-r" + tur + "-" + seans.anahtar);
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
        JI.kaydet("pit-oturum-" + yil + "-r" + tur + "-" + seans.anahtar, oturum);
      }
      var oBitis = Date.parse(oturum.date_end); if (isFinite(oBitis)) { bitis = oBitis; }
      if (!RC.yayimlandiMi(bitis, Date.now())) { return { durum: "yayimlanmadi" }; }
      cagri.push(ak);
      var rs = await OF.sirali("pit?session_key=" + oturum.session_key);
      if (rs.tur === "kisit") { return { durum: "kisit" }; }
      if (rs.tur === "bos") { bellekBos[ak] = { t: Date.now(), durum: "bos" }; return { durum: "bos" }; }
      if (rs.tur !== "ok" || !Array.isArray(rs.veri)) { return { durum: "hata" }; }
      var n = normalize(rs.veri, { sessionKey: oturum.session_key, meetingKey: mk });
      if (!n.kayitlar.length) { bellekBos[ak] = { t: Date.now(), durum: "bos" }; return { durum: "bos" }; }
      // pilot adları: mevcut openf1-veri bellek önbelleği; yalnız eksik numara varsa tek 'drivers' çağrısı (aynı kuyruk)
      var no = {}; n.kayitlar.forEach(function (e) { if (e.driverNumber != null) { no[e.driverNumber] = 1; } });
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
      var sonuc = { durum: "ok", kayitlar: n.kayitlar, ozet: ozet(n.kayitlar), isimler: isim, oturum: bilgi, tekrar: n.tekrar, atilan: n.atilan, kalici: false };
      var obj = { durum: "ok", s: sikistir(n.kayitlar), isim: isim, oturum: bilgi, alinma: Date.now(), bitis: bitis };
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
        var s0 = { durum: "ok", kayitlar: gl, ozet: ozet(gl), isimler: kayit.veri.isim || {}, oturum: kayit.veri.oturum, onbellekten: true, kalici: true };
        bellekVeri[ak] = s0; return s0;
      }
    }
    return null;
  }
  kok.PitVeri = { yukle: yukle, oku: oku, anahtar: anahtar, KALICI_LIMIT: KALICI_LIMIT, TOPLAM_LIMIT: TOPLAM_LIMIT, _cagri: cagri };
})(typeof window !== "undefined" ? window : null);
