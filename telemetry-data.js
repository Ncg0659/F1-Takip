/* TELEMETRY DATA LAYER v1 — Ghost Lap / Location Replay / AI Prediction için ortak, UI'sız veri katmanı.
   Yalnız OpenF1'in ücretsiz GEÇMİŞ uç noktaları: sessions, drivers, laps, car_data, location, stints, pit. Anahtar/OAuth/ücretli canlı katman YOK.
   İstekler openf1-veri.js'in mevcut kuyruğundan (OpenF1Veri.sirali: hız sınırı + 429 yeniden deneme) geçer; canlı polling YOK, her şey lazy.
   Erişilemeyen alan (fren sıcaklığı, ERS/batarya, lastik enerjisi, takım içi veri…) YOKTUR ve uydurulmaz. Eksik alan = null, tahmini değer üretilmez.
   Dönüş sözleşmesi: hiçbir fonksiyon fırlatmaz; { durum: ok|bos|kisit|hata|yayimlanmadi|oturum-yok|yok-meeting|gecersiz, ... }.
   Önbellek: bellekte, anahtar "sezon/oturum/sürücü/tur"; yalnız DOLU ve başarılı yanıt tutulur (boş/başarısız asla kalıcı değil); eşzamanlı aynı istek tek fetch'e iner. */
(function (kok) {
  "use strict";

  var ESLEME_TOL_MS = 150;     // konum örneği ↔ car_data örneği eşleştirme toleransı (interpolasyon/tahmin YOK; yoksa null)

  function sayi(v) { return typeof v === "number" && isFinite(v) ? v : null; }
  function zaman(v) { var t = Date.parse(v); return isFinite(t) ? t : null; }
  function norm(x) { return String(x == null ? "" : x).trim().toLowerCase(); }
  function iso(ms) { return new Date(ms).toISOString(); }

  // ---------- Normalize (saf fonksiyonlar) ----------
  // laps → [{ session, driver, lap, start, duration, s1, s2, s3, pitOut, speedTrapI1, speedTrapI2, speedTrapFl }]
  function turlariNormalle(ham, oturumKey, surucu) {
    if (!Array.isArray(ham)) { return []; }
    var cikti = [];
    ham.forEach(function (r) {
      if (!r || sayi(r.lap_number) == null) { return; }
      if (r.driver_number != null && Number(r.driver_number) !== Number(surucu)) { return; }      // yanlış sürücü karışmasın
      if (r.session_key != null && Number(r.session_key) !== Number(oturumKey)) { return; }        // yanlış oturum karışmasın
      cikti.push({
        session: Number(oturumKey), driver: Number(surucu), lap: r.lap_number,
        start: zaman(r.date_start), duration: sayi(r.lap_duration),
        s1: sayi(r.duration_sector_1), s2: sayi(r.duration_sector_2), s3: sayi(r.duration_sector_3),
        pitOut: typeof r.is_pit_out_lap === "boolean" ? r.is_pit_out_lap : null,
        speedTrapI1: sayi(r.i1_speed), speedTrapI2: sayi(r.i2_speed), speedTrapFl: sayi(r.st_speed)
      });
    });
    cikti.sort(function (a, b) { return a.lap - b.lap; });
    return cikti;
  }

  // stints → [{ session, driver, stint, compound, lapStart, lapEnd, tyreAgeStart }]
  function stintleriNormalle(ham, oturumKey) {
    if (!Array.isArray(ham)) { return []; }
    var cikti = [];
    ham.forEach(function (r) {
      if (!r || r.driver_number == null) { return; }
      if (r.session_key != null && Number(r.session_key) !== Number(oturumKey)) { return; }
      cikti.push({
        session: Number(oturumKey), driver: Number(r.driver_number), stint: sayi(r.stint_number),
        compound: r.compound ? String(r.compound).toUpperCase() : null,
        lapStart: sayi(r.lap_start), lapEnd: sayi(r.lap_end), tyreAgeStart: sayi(r.tyre_age_at_start)
      });
    });
    cikti.sort(function (a, b) { return (a.driver - b.driver) || ((a.lapStart == null ? 0 : a.lapStart) - (b.lapStart == null ? 0 : b.lapStart)); });
    return cikti;
  }

  function stintBul(stintler, surucu, tur) {
    var l = (stintler || []).filter(function (s) { return s.driver === Number(surucu); });
    for (var i = 0; i < l.length; i++) {
      var s = l[i];
      if (s.lapStart != null && tur >= s.lapStart && (s.lapEnd == null || tur <= s.lapEnd)) { return s; }
    }
    return null;
  }

  // car_data → ham örnekler; location → konum örnekleri. Eşleştirme: en yakın konum, ±150 ms içinde; yoksa x/y/z = null.
  function konumlariNormalle(ham, oturumKey, surucu) {
    if (!Array.isArray(ham)) { return []; }
    var c = [];
    ham.forEach(function (r) {
      if (!r) { return; }
      if (r.driver_number != null && Number(r.driver_number) !== Number(surucu)) { return; }
      if (r.session_key != null && Number(r.session_key) !== Number(oturumKey)) { return; }
      var t = zaman(r.date), x = sayi(r.x), y = sayi(r.y);
      if (t == null || x == null || y == null) { return; }
      c.push({ timestamp: t, x: x, y: y, z: sayi(r.z) });
    });
    c.sort(function (a, b) { return a.timestamp - b.timestamp; });
    return c;
  }
  function enYakinKonum(konum, t) {
    if (!konum.length) { return null; }
    var lo = 0, hi = konum.length - 1;
    while (lo < hi) { var m = (lo + hi) >> 1; if (konum[m].timestamp < t) { lo = m + 1; } else { hi = m; } }
    var en = konum[lo];
    if (lo > 0 && Math.abs(konum[lo - 1].timestamp - t) < Math.abs(en.timestamp - t)) { en = konum[lo - 1]; }
    return Math.abs(en.timestamp - t) <= ESLEME_TOL_MS ? en : null;
  }

  // Tek ortak yapı: session, driver, lap, timestamp, speed, throttle, brake, gear, rpm, x, y, compound, stint, pit
  function orneklerNormalle(ham, bag) {   // bag: { session, driver, lap, start, konum, stint, pit }
    if (!Array.isArray(ham)) { return []; }
    var cikti = [];
    ham.forEach(function (r) {
      if (!r) { return; }
      if (r.driver_number != null && Number(r.driver_number) !== Number(bag.driver)) { return; }
      if (r.session_key != null && Number(r.session_key) !== Number(bag.session)) { return; }
      var t = zaman(r.date);
      if (t == null) { return; }
      var k = enYakinKonum(bag.konum || [], t);
      cikti.push({
        session: Number(bag.session), driver: Number(bag.driver), lap: bag.lap, timestamp: t,
        t: bag.start != null ? t - bag.start : null,                    // tur başından geçen ms (ölçülmüş fark; tahmin değil)
        speed: sayi(r.speed), throttle: sayi(r.throttle), brake: sayi(r.brake), gear: sayi(r.n_gear != null ? r.n_gear : r.gear), rpm: sayi(r.rpm),
        x: k ? k.x : null, y: k ? k.y : null,
        compound: bag.stint ? bag.stint.compound : null, stint: bag.stint ? bag.stint.stint : null,
        pit: bag.pit == null ? null : bag.pit
      });
    });
    cikti.sort(function (a, b) { return a.timestamp - b.timestamp; });
    return cikti;
  }

  // ---------- Tur yardımcıları (yorum YOK) ----------
  function enHizliTur(turlar) {
    var en = null;
    (turlar || []).forEach(function (t) { if (t && t.duration != null && t.duration > 0 && (en === null || t.duration < en.duration)) { en = t; } });
    return en;
  }
  function turGetir(turlar, no) {
    for (var i = 0; i < (turlar || []).length; i++) { if (turlar[i].lap === Number(no)) { return turlar[i]; } }
    return null;
  }

  // ---------- Servis fabrikası: istek fonksiyonu enjekte edilebilir (testte taklit) ----------
  // istek(yol) → Promise<{ tur: ok|bos|kisit|hata, veri, http }>
  function kur(istek, secenek) {
    secenek = secenek || {};
    var onbellek = {};     // anahtar → sonuç (yalnız dolu + ok)
    var bekleyen = {};     // anahtar → Promise (eşzamanlı çift istek)
    var sayac = { istek: 0 };

    function anahtar(oturum, surucu, tur, ek) { return [oturum.season || "?", oturum.session_key, surucu == null ? "-" : surucu, tur == null ? "-" : tur, ek || ""].join("/"); }

    async function ham(yol) {
      sayac.istek++;
      try { var r = await istek(yol); return r || { tur: "hata", veri: null }; }
      catch (e) { return { tur: "hata", veri: null, hata: e && e.message }; }       // UI'ya ham JS hatası gitmez
    }
    function durumDon(r) { return r.tur === "kisit" ? "kisit" : (r.tur === "bos" ? "bos" : "hata"); }

    // Genel: dolu başarılı yanıt önbelleğe girer; boş/hata girmez
    async function onbellekli(k, getir) {
      if (Object.prototype.hasOwnProperty.call(onbellek, k)) { var o = onbellek[k]; return Object.assign({ onbellekten: true }, o); }
      if (bekleyen[k]) { return bekleyen[k]; }
      bekleyen[k] = (async function () {
        var s = await getir();
        if (s && s.durum === "ok") { onbellek[k] = s; }
        return s;
      })();
      try { return await bekleyen[k]; } finally { delete bekleyen[k]; }
    }

    function gecerli(oturum, surucu) { return oturum && oturum.session_key != null && (surucu === undefined || sayi(Number(surucu)) != null); }

    // Sürücüler (oturum başına)
    function suruculer(oturum) {
      if (!gecerli(oturum)) { return Promise.resolve({ durum: "gecersiz" }); }
      return onbellekli(anahtar(oturum, null, null, "drivers"), async function () {
        var r = await ham("drivers?session_key=" + oturum.session_key);
        if (r.tur !== "ok") { return { durum: durumDon(r) }; }
        if (!Array.isArray(r.veri) || !r.veri.length) { return { durum: "bos" }; }
        return { durum: "ok", suruculer: r.veri.filter(function (d) { return d && d.driver_number != null; }).map(function (d) {
          return { session: Number(oturum.session_key), driver: Number(d.driver_number), kod: d.name_acronym || null, ad: d.full_name || d.broadcast_name || null, takim: d.team_name || null };
        }) };
      });
    }

    // Turlar (sürücü başına tüm turlar; lap time + sektör + pit-out)
    function turlar(oturum, surucu) {
      if (!gecerli(oturum, surucu)) { return Promise.resolve({ durum: "gecersiz" }); }
      return onbellekli(anahtar(oturum, surucu, null, "laps"), async function () {
        var r = await ham("laps?session_key=" + oturum.session_key + "&driver_number=" + surucu);
        if (r.tur !== "ok") { return { durum: durumDon(r) }; }
        var t = turlariNormalle(r.veri, oturum.session_key, surucu);
        return t.length ? { durum: "ok", turlar: t } : { durum: "bos" };
      });
    }

    // Stintler (oturum başına; compound/stint)
    function stintler(oturum) {
      if (!gecerli(oturum)) { return Promise.resolve({ durum: "gecersiz" }); }
      return onbellekli(anahtar(oturum, null, null, "stints"), async function () {
        var r = await ham("stints?session_key=" + oturum.session_key);
        if (r.tur !== "ok") { return { durum: durumDon(r) }; }
        var s = stintleriNormalle(r.veri, oturum.session_key);
        return s.length ? { durum: "ok", stintler: s } : { durum: "bos" };
      });
    }

    // Pit turları (oturum başına; pit girişi yapılan tur numaraları)
    function pitler(oturum) {
      if (!gecerli(oturum)) { return Promise.resolve({ durum: "gecersiz" }); }
      return onbellekli(anahtar(oturum, null, null, "pit"), async function () {
        var r = await ham("pit?session_key=" + oturum.session_key);
        if (r.tur !== "ok") { return { durum: durumDon(r) }; }
        if (!Array.isArray(r.veri) || !r.veri.length) { return { durum: "bos" }; }
        var l = r.veri.filter(function (p) { return p && p.driver_number != null && sayi(p.lap_number) != null && (p.session_key == null || Number(p.session_key) === Number(oturum.session_key)); })
          .map(function (p) { return { driver: Number(p.driver_number), lap: p.lap_number, duration: sayi(p.pit_duration) }; });
        return l.length ? { durum: "ok", pitler: l } : { durum: "bos" };
      });
    }

    // Tek tur telemetrisi: car_data (+ varsa location) + stint/compound + pit bayrağı. Anahtar: sezon/oturum/sürücü/tur
    function turTelemetri(oturum, surucu, turNo) {
      if (!gecerli(oturum, surucu) || sayi(Number(turNo)) == null) { return Promise.resolve({ durum: "gecersiz" }); }
      return onbellekli(anahtar(oturum, surucu, turNo, "tel"), async function () {
        var tl = await turlar(oturum, surucu);
        if (tl.durum !== "ok") { return { durum: tl.durum }; }
        var tur = turGetir(tl.turlar, turNo);
        if (!tur) { return { durum: "bos", neden: "tur-yok" }; }
        if (tur.start == null || tur.duration == null) { return { durum: "bos", neden: "tur-zamani-yok" }; }   // zaman penceresi bilinmiyorsa tahmin edilmez
        var a = iso(tur.start), b = iso(tur.start + Math.round(tur.duration * 1000));
        var q = "session_key=" + oturum.session_key + "&driver_number=" + surucu + "&date>=" + a + "&date<=" + b;
        var cd = await ham("car_data?" + q);
        if (cd.tur !== "ok") { return { durum: durumDon(cd) }; }
        if (!Array.isArray(cd.veri) || !cd.veri.length) { return { durum: "bos", neden: "car-data-yok" }; }
        var lc = await ham("location?" + q), konum = [];
        if (lc.tur === "ok") { konum = konumlariNormalle(lc.veri, oturum.session_key, surucu); }   // location yoksa/hata → x/y null (fallback path YOK)
        var st = await stintler(oturum), stint = st.durum === "ok" ? stintBul(st.stintler, surucu, Number(turNo)) : null;
        var pt = await pitler(oturum), pit = null;
        if (pt.durum === "ok") { pit = pt.pitler.some(function (p) { return p.driver === Number(surucu) && p.lap === Number(turNo); }) || tur.pitOut === true; }
        else if (tur.pitOut === true) { pit = true; }
        var ornek = orneklerNormalle(cd.veri, { session: oturum.session_key, driver: surucu, lap: Number(turNo), start: tur.start, konum: konum, stint: stint, pit: pit });
        if (!ornek.length) { return { durum: "bos", neden: "car-data-gecersiz" }; }
        // konumHam: OpenF1 location örnekleri KENDİ zaman damgalarıyla (t = tur başından ms). Yalnız replay'in akıcı oynatımı için; değer üretilmez/değiştirilmez.
        var konumHam = konum.map(function (k) { return { t: k.timestamp - tur.start, x: k.x, y: k.y }; }).filter(function (k) { return k.t >= 0 && k.t <= tur.duration * 1000 + 1; });
        return { durum: "ok", session: Number(oturum.session_key), driver: Number(surucu), lap: Number(turNo), tur: tur, ornekler: ornek, konumHam: konumHam, konumVar: konum.length > 0 && ornek.some(function (o) { return o.x != null; }), stint: stint };
      });
    }

    // En hızlı tur (yorum yok): { tur, telemetri }
    async function enHizliTurTelemetri(oturum, surucu) {
      var tl = await turlar(oturum, surucu);
      if (tl.durum !== "ok") { return { durum: tl.durum }; }
      var en = enHizliTur(tl.turlar);
      if (!en) { return { durum: "bos", neden: "gecerli-tur-yok" }; }
      var t = await turTelemetri(oturum, surucu, en.lap);
      return t.durum === "ok" ? { durum: "ok", tur: en, telemetri: t } : { durum: t.durum, tur: en };
    }

    // İki pilotu AYNI oturumda eşleştir: lap = sayı | "fastest" (her biri kendi en hızlı turu)
    async function eslestir(oturum, surucuA, surucuB, tur) {
      if (!gecerli(oturum, surucuA) || !gecerli(oturum, surucuB) || Number(surucuA) === Number(surucuB)) { return { durum: "gecersiz" }; }
      var a, b;
      if (tur === "fastest" || tur == null) { a = await enHizliTurTelemetri(oturum, surucuA); b = await enHizliTurTelemetri(oturum, surucuB); }
      else { var ta = await turTelemetri(oturum, surucuA, tur), tb = await turTelemetri(oturum, surucuB, tur); a = ta.durum === "ok" ? { durum: "ok", tur: ta.tur, telemetri: ta } : ta; b = tb.durum === "ok" ? { durum: "ok", tur: tb.tur, telemetri: tb } : tb; }
      if (a.durum !== "ok" || b.durum !== "ok") { return { durum: a.durum !== "ok" ? a.durum : b.durum, a: a, b: b }; }
      if (a.telemetri.session !== b.telemetri.session) { return { durum: "gecersiz" }; }
      return { durum: "ok", session: a.telemetri.session, a: a, b: b };
    }

    function temizle() { Object.keys(onbellek).forEach(function (k) { delete onbellek[k]; }); }
    return { suruculer: suruculer, turlar: turlar, stintler: stintler, pitler: pitler, turTelemetri: turTelemetri, enHizliTurTelemetri: enHizliTurTelemetri, eslestir: eslestir,
             enHizliTur: enHizliTur, turGetir: turGetir, stintBul: stintBul, temizle: temizle, _sayac: sayac, _onbellek: onbellek };
  }

  // ---------- Tarayıcı örneği: mevcut OpenF1 kuyruğu (hız sınırı + 429) üzerinden; oturum çözümlemesi mevcut meetingBul ile ----------
  var OF = kok && kok.OpenF1Veri, LH = kok && kok.LastikHesap, HV = kok && kok.HaftaVeri;
  var API = { kur: kur, turlariNormalle: turlariNormalle, stintleriNormalle: stintleriNormalle, konumlariNormalle: konumlariNormalle, orneklerNormalle: orneklerNormalle,
              enHizliTur: enHizliTur, turGetir: turGetir, stintBul: stintBul, ESLEME_TOL_MS: ESLEME_TOL_MS };

  if (OF && OF.sirali) {
    var varsayilan = kur(function (yol) { return OF.sirali(yol); });
    var oturumBellek = {};
    var ANAHTAR_TUR = { Race: "race", Qualifying: "qualifying", Sprint: "sprint", FirstPractice: "practice 1", SecondPractice: "practice 2", ThirdPractice: "practice 3", SprintQualifying: "sprint qualifying" };
    // yarisKaydi: Jolpica takvim kaydı. anahtar: Race|Qualifying|Sprint|FirstPractice|… Dönüş: { durum, oturum:{ season, session_key, meeting_key, ad, tur } }
    API.oturumBul = async function (yarisKaydi, anahtar) {
      try {
        if (!yarisKaydi || !HV) { return { durum: "gecersiz" }; }
        anahtar = anahtar || "Race";
        var yil = Number(yarisKaydi.season), ok = yil + "/" + yarisKaydi.round + "/" + anahtar;
        if (oturumBellek[ok]) { return { durum: "ok", oturum: oturumBellek[ok], onbellekten: true }; }
        var hafta = HV.haftaKur(yarisKaydi, "f1");
        var seans = hafta.seanslar.filter(function (s) { return s.anahtar === anahtar; })[0];
        if (!seans) { return { durum: "oturum-yok" }; }
        var mt = await OF.meetingBul(hafta);
        if (mt.durum !== "ok") { return { durum: mt.durum }; }
        var r = await OF.sirali("sessions?meeting_key=" + mt.meeting.meeting_key);
        if (r.tur !== "ok" || !Array.isArray(r.veri)) { return { durum: r.tur === "bos" ? "oturum-yok" : (r.tur === "kisit" ? "kisit" : "hata") }; }
        var bas = seans.baslangic.getTime(), sec = null;
        if (anahtar === "Race" && LH) { sec = LH.yarisOturumuSec(r.veri, bas); }
        else {
          var ad = ANAHTAR_TUR[anahtar];
          sec = r.veri.filter(function (o) { var n = norm(o.session_name); return n === ad || (anahtar === "SprintQualifying" && /sprint\s*(qualifying|shootout)/.test(n)) || (ad && ad.indexOf("practice") === 0 && n === "free " + ad); })
                      .filter(function (o) { return Math.abs(Date.parse(o.date_start) - bas) <= 12 * 3600 * 1000; })[0] || null;
        }
        if (!sec) { return { durum: "oturum-yok" }; }
        if (LH && !LH.yayimlandiMi(sec.date_end, bas, Date.now())) { return { durum: "yayimlanmadi" }; }   // ücretli canlı pencere: istek yapılmaz
        var o = { season: yil, session_key: sec.session_key, meeting_key: sec.meeting_key, ad: sec.session_name, tur: sec.session_type };
        oturumBellek[ok] = o;
        return { durum: "ok", oturum: o };
      } catch (e) { return { durum: "hata" }; }
    };
    Object.keys(varsayilan).forEach(function (k) { API[k] = varsayilan[k]; });
    API.kur = kur;
  }

  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
  if (kok) { kok.TelemetriVeri = API; }
})(typeof window !== "undefined" ? window : null);
