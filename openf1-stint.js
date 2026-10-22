/* A3.4b — Tek yarış için OpenF1 /stints verisi (yalnızca kullanıcı "Lastik Stratejisi" bloğunu açınca çağrılır).
   Yeni istemci YOK: openf1-veri.js'in meeting çözümlemesi (meetingBul) ve sıralı istek kuyruğu (hız sınırı + 429 yeniden deneme) kullanılır.
   Çağrılar: [meetings (6 sa önbellekli, yoksa 1)] + [sessions?meeting_key (yarış oturumu bir kez önbelleğe alınır)] + stints?session_key. PIT uç noktası YOK.
   Ücretli/canlı katman, anahtar, OAuth YOK. Canlı pencere (seans bitişi + 30 dk) dolmadan istek yapılmaz.
   Önbellek: f1-hafta-v1-stints-<yıl>-r<tur> — dolu sonuç kalıcı; boş yanıt yalnızca 10 dk (asla kalıcı başarı sayılmaz).
              f1-hafta-v1-stints-oturum-<yıl>-r<tur> — yarış oturumu eşlemesi (değişmez). */
(function () {
  "use strict";
  var OF = window.OpenF1Veri, JI = window.JolpicaIstemci, LH = window.LastikHesap, HV = window.HaftaVeri;
  if (!OF || !OF.sirali || !JI || !LH || !HV) { return; }
  var BOS_OMUR_MS = 10 * 60 * 1000;
  var bekleyen = {};   // aynı yarış için eşzamanlı çift çağrıyı önler

  function anahtar(yil, tur) { return "stints-" + yil + "-r" + tur; }

  // yarisKaydi: Jolpica takvim kaydı. Dönüş: { durum, stintler?, oturum?, onbellekten? }
  // durum: ok | bos | yayimlanmadi | kisit | hata | oturum-yok | yok-meeting
  async function yukle(yarisKaydi) {
    var yil = Number(yarisKaydi.season), tur = Number(yarisKaydi.round), ak = anahtar(yil, tur);
    var kayit = JI.oku(ak);
    if (kayit && kayit.veri && kayit.veri.durum === "ok" && kayit.veri.rows && kayit.veri.rows.length) {
      return { durum: "ok", rows: kayit.veri.rows, oturum: kayit.veri.oturum, onbellekten: true };
    }
    if (kayit && kayit.veri && kayit.veri.durum === "bos" && Date.now() - kayit.t < BOS_OMUR_MS) { return { durum: "bos", onbellekten: true }; }
    if (bekleyen[ak]) { return bekleyen[ak]; }
    bekleyen[ak] = (async function () {
      var hafta = HV.haftaKur(yarisKaydi, "f1");
      var yarisAni = hafta.seanslar.filter(function (s) { return s.anahtar === "Race"; })[0].baslangic.getTime();
      var oturum = null, ok = JI.oku("stints-oturum-" + yil + "-r" + tur);
      if (ok && ok.veri && ok.veri.session_key) { oturum = ok.veri; }
      else {
        var mt = await OF.meetingBul(hafta);
        if (mt.durum !== "ok") { return { durum: mt.durum === "yok-meeting" ? "yok-meeting" : mt.durum }; }
        var r = await OF.sirali("sessions?meeting_key=" + mt.meeting.meeting_key);
        if (r.tur === "kisit") { return { durum: "kisit" }; }
        if (r.tur !== "ok" || !Array.isArray(r.veri)) { return { durum: r.tur === "bos" ? "oturum-yok" : "hata" }; }
        var sec = LH.yarisOturumuSec(r.veri, yarisAni);
        if (!sec) { return { durum: "oturum-yok" }; }
        oturum = { session_key: sec.session_key, meeting_key: sec.meeting_key, ad: sec.session_name, date_end: sec.date_end };
        if (LH.yayimlandiMi(oturum.date_end, yarisAni, Date.now())) { JI.kaydet("stints-oturum-" + yil + "-r" + tur, oturum); }
      }
      if (!LH.yayimlandiMi(oturum.date_end, yarisAni, Date.now())) { return { durum: "yayimlanmadi" }; }   // canlı (ücretli) pencere: istek yapılmaz
      var s = await OF.sirali("stints?session_key=" + oturum.session_key);
      if (s.tur === "kisit") { return { durum: "kisit" }; }
      if (s.tur === "bos") { JI.kaydet(ak, { durum: "bos" }); return { durum: "bos" }; }
      if (s.tur !== "ok" || !Array.isArray(s.veri)) { return { durum: "hata" }; }
      if (!s.veri.length) { JI.kaydet(ak, { durum: "bos" }); return { durum: "bos" }; }
      var cozum = LH.stintleriCoz(s.veri);
      if (!Object.keys(cozum.pilot).length) { JI.kaydet(ak, { durum: "bos" }); return { durum: "bos" }; }
      var bilgi = { anahtar: oturum.session_key, ad: oturum.ad };
      JI.kaydet(ak, { durum: "ok", rows: s.veri, oturum: bilgi });
      return { durum: "ok", rows: s.veri, oturum: bilgi };
    })();
    try { return await bekleyen[ak]; } finally { delete bekleyen[ak]; }
  }

  window.LastikVeri = { yukle: yukle, anahtar: anahtar, BOS_OMUR_MS: BOS_OMUR_MS };
})();
