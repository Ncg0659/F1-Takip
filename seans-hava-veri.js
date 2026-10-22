/* OPENF1 A7.5 — HISTORICAL WEATHER (tamamlanmış HER seans: FP1/2/3, SQ, Sprint, Q, Race; seans SONRASI, kullanıcı "Seans Hava Koşulları"nı açınca).
   OpenF1 belgesi (openf1.org/docs, weather; "pist üstündeki hava, her dakika güncellenir"): date, meeting_key, session_key, air_temperature (°C), track_temperature (°C),
   humidity (%), pressure (mbar), rainfall ("yağış var mı"; belgedeki örnekte sayı: 0), wind_direction (°, 0–359), wind_speed (m/s).
   Bu veri Open-Meteo tahmininin YERİNE GEÇMEZ: "seans içi OpenF1 ölçümleri"dir (gerçekleşen). Mevcut Open-Meteo/hafta hava kodlarına dokunulmaz.
   SAF katman (Node'da test edilir) + tembel VERİ katmanı (OpenF1Veri.meetingBul/sirali + JolpicaIstemci önbelleği). Canlı/ücretli OpenF1, polling, zamanlayıcı YOK.
   Seans bitişi + 30 dk dolmadan istek yok. Ham dakikalık seri yalnız sayfa açıkken BELLEKTE; localStorage'a yalnızca küçük özet yazılır. Nedensel yorum üretilmez. */
(function (kok) {
  "use strict";
  var SEANSLAR = { FirstPractice: 1, SecondPractice: 1, ThirdPractice: 1, SprintQualifying: 1, Sprint: 1, Qualifying: 1, Race: 1 };
  function sayi(x) { if (x == null || x === "" || typeof x === "boolean") { return null; } var n = Number(x); return isFinite(n) ? n : null; }
  // rainfall: boolean → boolean; 0/1 (sayı ya da "0"/"1") → boolean; "true"/"false" → boolean; başka her şey → null (uydurma yok)
  function yagis(x) {
    if (x === true || x === false) { return x; }
    if (x === 0 || x === 1) { return x === 1; }
    if (typeof x === "string") { var t = x.trim().toLowerCase(); if (t === "1" || t === "true") { return true; } if (t === "0" || t === "false") { return false; } }
    return null;
  }
  function yon(x) { var n = sayi(x); return n != null && n >= 0 && n <= 360 ? n : null; }
  function nem(x) { var n = sayi(x); return n != null && n >= 0 && n <= 100 ? n : null; }

  // Ham satırlar → { olcumler, atilan, tekrar }. Başka session_key/meeting_key atılır; tarihi geçersiz atılır; aynı (session,date) tek.
  function normalize(rows, opts) {
    opts = opts || {}; var atilan = 0, tekrar = 0, gorulen = {}, out = [];
    (Array.isArray(rows) ? rows : []).forEach(function (r) {
      if (!r || typeof r !== "object") { atilan++; return; }
      var ms = r.date ? Date.parse(r.date) : NaN; if (!isFinite(ms)) { atilan++; return; }
      if (opts.sessionKey != null && r.session_key != null && Number(r.session_key) !== Number(opts.sessionKey)) { atilan++; return; }
      if (opts.meetingKey != null && r.meeting_key != null && Number(r.meeting_key) !== Number(opts.meetingKey)) { atilan++; return; }
      var sk = r.session_key != null ? Number(r.session_key) : (opts.sessionKey != null ? Number(opts.sessionKey) : null);
      var k = sk + "|" + ms; if (gorulen[k]) { tekrar++; return; } gorulen[k] = 1;
      out.push({ sessionKey: sk, meetingKey: r.meeting_key != null ? Number(r.meeting_key) : (opts.meetingKey != null ? Number(opts.meetingKey) : null), date: new Date(ms).toISOString(), ms: ms,
                 airTemperature: sayi(r.air_temperature), trackTemperature: sayi(r.track_temperature), humidity: nem(r.humidity), pressure: sayi(r.pressure),
                 rainfall: yagis(r.rainfall), windDirection: yon(r.wind_direction), windSpeed: (function (v) { return v != null && v >= 0 ? v : null; })(sayi(r.wind_speed)) });
    });
    out.sort(function (a, b) { return a.ms - b.ms; });
    return { olcumler: out, atilan: atilan, tekrar: tekrar };
  }

  var ALANLAR = ["airTemperature", "trackTemperature", "humidity", "pressure", "rainfall", "windDirection", "windSpeed"];
  function veriVar(o) { return ALANLAR.some(function (a) { return o[a] != null; }); }
  function kisa(o) { return o ? { date: o.date, ms: o.ms, airTemperature: o.airTemperature, trackTemperature: o.trackTemperature, humidity: o.humidity, pressure: o.pressure, rainfall: o.rainfall, windDirection: o.windDirection, windSpeed: o.windSpeed } : null; }
  function minmax(l, alan) {
    var v = l.map(function (o) { return o[alan]; }).filter(function (x) { return x != null; });
    return v.length ? { min: Math.min.apply(null, v), max: Math.max.apply(null, v) } : null;
  }
  // Deterministik özet: ilk/son ölçüm, min/max hava ve pist sıcaklığı, en yüksek rüzgâr, yağış görüldü mü, yağışlı kayıt sayısı. Yorum yok.
  function ozet(olcumler) {
    var l = olcumler || [], b = l.filter(veriVar), yg = l.filter(function (o) { return o.rainfall != null; }), mr = minmax(l, "windSpeed");
    return { olcumSayisi: l.length, veriVar: b.length > 0, baslangic: kisa(b[0] || null), bitis: kisa(b[b.length - 1] || null),
             hava: minmax(l, "airTemperature"), pist: minmax(l, "trackTemperature"), maxRuzgar: mr ? mr.max : null,
             yagis: { olcumVar: yg.length > 0, goruldu: yg.some(function (o) { return o.rainfall === true; }), yagisliKayit: yg.filter(function (o) { return o.rainfall === true; }).length, kayit: yg.length } };
  }

  var MESAJ = { yayimlanmadi: "Seans hava verisi henüz yayımlanmadı.", hata: "OpenF1 hava verisine şu anda ulaşılamıyor." };
  function durumMesaji(d) {
    if (d === "bos" || d === "yayimlanmadi" || d === "oturum-yok" || d === "yok-meeting") { return MESAJ.yayimlanmadi; }
    if (d === "hata" || d === "kisit") { return MESAJ.hata; }
    return "";
  }
  // Biçim: tek rüzgâr birimi m/s (OpenF1 belgesindeki birim; dönüşüm yapılmaz)
  function derece(x) { return x == null ? null : x.toFixed(1) + "°C"; }
  function yuzde(x) { return x == null ? null : "%" + Math.round(x); }
  function ruzgar(x) { return x == null ? null : x.toFixed(1) + " m/s"; }
  function yonYaz(x) { return x == null ? null : Math.round(x) + "°"; }
  function yagisYaz(x) { return x === true ? "Var" : (x === false ? "Yok" : null); }

  var API = { normalize: normalize, ozet: ozet, durumMesaji: durumMesaji, MESAJ: MESAJ, derece: derece, yuzde: yuzde, ruzgar: ruzgar, yonYaz: yonYaz, yagisYaz: yagisYaz, yagis: yagis, SEANSLAR: SEANSLAR };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
  if (!kok) { return; }
  kok.SeansHavaHesap = API;

  // ---------- VERİ KATMANI ----------
  var OF = kok.OpenF1Veri, JI = kok.JolpicaIstemci, RC = kok.RaceControl;
  if (!OF || !OF.sirali || !OF.meetingBul || !JI || !RC || !RC.oturumSec) { return; }
  var BOS_OMUR_MS = 10 * 60 * 1000, TAZE_MS = 2 * 3600 * 1000, KALICI_LIMIT = 8000, TOPLAM_LIMIT = 80000;
  var bekleyen = {}, bellekBos = {}, bellekVeri = {}, cagri = [];
  function anahtar(yil, tur, seans) { return "hv-" + yil + "-r" + tur + "-" + seans; }
  function bul(f, d) { try { return f(); } catch (e) { return d; } }
  function butceTemizle(yil, tur) {
    bul(function () {
      var onek = JI.ONEK + "hv-", liste = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i); if (!k || k.indexOf(onek) !== 0) { continue; }
        var m = /^hv-(\d{4})-r(\d+)-/.exec(k.slice(JI.ONEK.length)); if (!m) { continue; }
        var v = localStorage.getItem(k) || "", tm = 0; try { tm = JSON.parse(v).t || 0; } catch (e) { /* bozuk kayıt silinir */ }
        liste.push({ k: k, n: v.length, t: tm, eski: Number(m[1]) !== yil || Number(m[2]) < tur - 2 || Number(m[2]) > tur + 1 });
      }
      liste.filter(function (x) { return x.eski || !x.t; }).forEach(function (x) { localStorage.removeItem(x.k); });
      var top = 0;
      liste.filter(function (x) { return !x.eski && x.t; }).sort(function (a, b) { return b.t - a.t; }).forEach(function (x) { top += x.n; if (top > TOPLAM_LIMIT) { localStorage.removeItem(x.k); } });
    });
  }

  // Dönüş: { durum, ozet?, olcumler? (yalnız bellek), oturum?, onbellekten?, kalici?, boyut? }  durum: ok|bos|yayimlanmadi|oturum-yok|yok-meeting|kisit|hata
  async function yukle(hafta, seans) {
    if (!SEANSLAR[seans.anahtar]) { return { durum: "desteklenmiyor" }; }
    var yil = Number(hafta.sezon), tur = Number(hafta.tur), ak = anahtar(yil, tur, seans.anahtar), simdi = Date.now();
    if (bellekVeri[ak]) { return Object.assign({}, bellekVeri[ak], { onbellekten: true }); }
    var kayit = JI.oku(ak);
    if (kayit && kayit.veri && kayit.veri.durum === "ok" && kayit.veri.ozet) {
      var yas = kayit.veri.alinma != null && kayit.veri.bitis != null ? kayit.veri.alinma - kayit.veri.bitis : TAZE_MS;
      if (yas >= TAZE_MS || simdi - kayit.t < RC.YAYIN_GECIKME_MS) {
        var s0 = { durum: "ok", ozet: kayit.veri.ozet, oturum: kayit.veri.oturum, onbellekten: true, kalici: true };      // ham dakikalık seri yazılmaz → yalnız özet
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
      var mk = mt.meeting.meeting_key, oturum = null, ok = JI.oku("hv-oturum-" + yil + "-r" + tur + "-" + seans.anahtar);
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
        JI.kaydet("hv-oturum-" + yil + "-r" + tur + "-" + seans.anahtar, oturum);
      }
      var oBitis = Date.parse(oturum.date_end); if (isFinite(oBitis)) { bitis = oBitis; }
      if (!RC.yayimlandiMi(bitis, Date.now())) { return { durum: "yayimlanmadi" }; }
      cagri.push(ak);
      var rs = await OF.sirali("weather?session_key=" + oturum.session_key);
      if (rs.tur === "kisit") { return { durum: "kisit" }; }
      if (rs.tur === "bos") { bellekBos[ak] = { t: Date.now(), durum: "bos" }; return { durum: "bos" }; }
      if (rs.tur !== "ok" || !Array.isArray(rs.veri)) { return { durum: "hata" }; }
      var n = normalize(rs.veri, { sessionKey: oturum.session_key, meetingKey: mk });
      rs = null;                                                   // ham JSON'u bırak
      var oz = ozet(n.olcumler);
      if (!n.olcumler.length || !oz.veriVar) { bellekBos[ak] = { t: Date.now(), durum: "bos" }; return { durum: "bos" }; }
      var bilgi = { anahtar: oturum.session_key, ad: oturum.ad };
      var sonuc = { durum: "ok", ozet: oz, oturum: bilgi, tekrar: n.tekrar, atilan: n.atilan, kalici: false, olcumler: n.olcumler };   // olcumler: ham seri YALNIZ bellekte
      var obj = { durum: "ok", ozet: oz, oturum: bilgi, alinma: Date.now(), bitis: bitis };
      sonuc.boyut = JSON.stringify(obj).length;
      if (sonuc.boyut <= KALICI_LIMIT) { butceTemizle(yil, tur); JI.kaydet(ak, obj); sonuc.kalici = true; }
      bellekVeri[ak] = sonuc;
      return sonuc;
    })();
    try { return await bekleyen[ak]; } finally { delete bekleyen[ak]; }
  }
  // SALT OKUNUR, AĞSIZ önbellek okuma; yoksa null.
  function oku(hafta, seans) {
    var yil = Number(hafta.sezon), tur = Number(hafta.tur), ak = anahtar(yil, tur, seans.anahtar), simdi = Date.now();
    if (bellekVeri[ak]) { return Object.assign({}, bellekVeri[ak], { onbellekten: true }); }
    var kayit = JI.oku(ak);
    if (kayit && kayit.veri && kayit.veri.durum === "ok" && kayit.veri.ozet) {
      var yas = kayit.veri.alinma != null && kayit.veri.bitis != null ? kayit.veri.alinma - kayit.veri.bitis : TAZE_MS;
      if (yas >= TAZE_MS || simdi - kayit.t < RC.YAYIN_GECIKME_MS) {
        var s0 = { durum: "ok", ozet: kayit.veri.ozet, oturum: kayit.veri.oturum, onbellekten: true, kalici: true };
        bellekVeri[ak] = s0; return s0;
      }
    }
    return null;
  }
  kok.SeansHavaVeri = { yukle: yukle, oku: oku, anahtar: anahtar, KALICI_LIMIT: KALICI_LIMIT, TOPLAM_LIMIT: TOPLAM_LIMIT, _cagri: cagri };
})(typeof window !== "undefined" ? window : null);
