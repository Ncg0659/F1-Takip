/* BAĞLAMSAL BİLGİ KATMANI — SAF HESAP (DOM yok, fetch yok, timer yok, depolama yazımı yok).
   Amaç: kullanıcı hangi ekrana/seansa bakıyorsa o ekranı doğrudan etkileyen KRİTİK güncel bilgi orada görünsün. Genel haber sayfası değildir.

   VERİ MODELİ — ContextualInfoCard
     { id, type, severity, session, title, shortText, source, timestamp, effectiveFrom, revisedTime, expiry, verified,
       kaynakSeviye: "official" | "feed" | "static", hedef: { pilot:[kod], takim:[ad], pist:id }, neden: "hava"|null, sezon, tur }
     type: SESSION_DELAYED · SESSION_POSTPONED · NEW_TIME_CONFIRMED · SESSION_CANCELLED   (program türleri → state'i geçersiz kılar)
           RED_FLAG · SESSION_STOPPED · RESTART · SAFETY_CAR · VSC · START_PROCEDURE · SESSION_SHORTENED · WEATHER · TRACK_CHANGE
           GRID_PENALTY · PIT_LANE_START · PENALTY · TECH_UPDATE · OPERATIONAL
     severity: critical | warning | info · session: seans anahtarı (Qualifying, Sprint, Race…) · timestamp/effectiveFrom/revisedTime/expiry: ISO metin

   PROGRAM OVERRIDE (hafta-state.js'e giden küçük nesne): { tip: SCHEDULED|DELAYED|POSTPONED|NEW_TIME_CONFIRMED|CANCELLED, yeniBaslangic, yeniBitis, kaynak, verified, timestamp, kartId }

   KAYNAK ÖNCELİĞİ (ücretsiz, yeni servis yok): 1) doğrulanmış resmi/statik girdi (program-degisiklik.js: FIA / Formula 1)  2) mevcut Race Feed deposu (Chris Medland; yalnızca okunur)
   Aynı seans için doğrulanmış (resmi/statik) girdi, doğrulanmamış feed girdisini geçersiz kılar; aynı düzeyde en yeni olan kazanır.
   Yalnızca uygulama davranışını etkileyen bilgi kritik sayılır (saat/erteleme/start prosedürü/grid/pit lane/resmi ceza/hava-pist). Magazin/söylenti haberi girmez. */
(function (kok) {
  "use strict";
  var DK = 60000, SA = 3600000;
  var ANA_TZ = "Europe/Istanbul";

  var TURLER = {
    SESSION_DELAYED:    { baslik: "BAŞLANGIÇ GECİKTİ", siddet: "warning",  program: true },
    SESSION_POSTPONED:  { baslik: "ERTELENDİ",         siddet: "critical", program: true },
    NEW_TIME_CONFIRMED: { baslik: "YENİ SAAT",         siddet: "warning",  program: true },
    SESSION_CANCELLED:  { baslik: "İPTAL EDİLDİ",      siddet: "critical", program: true },
    RED_FLAG:           { baslik: "KIRMIZI BAYRAK",    siddet: "critical" },
    SESSION_STOPPED:    { baslik: "SEANS DURDURULDU",  siddet: "critical" },
    RESTART:            { baslik: "YENİDEN BAŞLADI",   siddet: "info" },
    SAFETY_CAR:         { baslik: "SAFETY CAR",        siddet: "warning" },
    VSC:                { baslik: "VSC",               siddet: "warning" },
    START_PROCEDURE:    { baslik: "START PROSEDÜRÜ",   siddet: "warning" },
    SESSION_SHORTENED:  { baslik: "SEANS KISALTILDI",  siddet: "warning" },
    WEATHER:            { baslik: "HAVA / PİST",       siddet: "warning" },
    TRACK_CHANGE:       { baslik: "PİST DEĞİŞİKLİĞİ",  siddet: "info" },
    GRID_PENALTY:       { baslik: "GRİD CEZASI",       siddet: "warning" },
    PIT_LANE_START:     { baslik: "PİT LANE'DEN START", siddet: "warning" },
    PENALTY:            { baslik: "RESMİ CEZA",        siddet: "warning" },
    TECH_UPDATE:        { baslik: "TEKNİK GÜNCELLEME", siddet: "info" },
    OPERATIONAL:        { baslik: "TAKIM KARARI",      siddet: "info" }
  };
  var PROG_TIP = { SESSION_DELAYED: "DELAYED", SESSION_POSTPONED: "POSTPONED", NEW_TIME_CONFIRMED: "NEW_TIME_CONFIRMED", SESSION_CANCELLED: "CANCELLED" };
  var TIP_TUR = { DELAYED: "SESSION_DELAYED", POSTPONED: "SESSION_POSTPONED", NEW_TIME_CONFIRMED: "NEW_TIME_CONFIRMED", CANCELLED: "SESSION_CANCELLED" };
  var PILOT_TURLERI = ["GRID_PENALTY", "PIT_LANE_START", "PENALTY", "OPERATIONAL"];
  var TAKIM_TURLERI = ["GRID_PENALTY", "PIT_LANE_START", "PENALTY", "TECH_UPDATE", "OPERATIONAL"];
  var PIST_TURLERI = ["WEATHER", "TRACK_CHANGE"];

  function ms(x) { if (x == null || x === "") { return null; } var t = x instanceof Date ? x.getTime() : (typeof x === "number" ? x : Date.parse(x)); return isFinite(t) ? t : null; }
  function iso(t) { return t == null ? null : new Date(t).toISOString(); }

  // ---------- Saat dilimi yardımcıları (Intl; sabit offset yok) ----------
  function parcalar(tz, t) {
    var f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    var o = {}; f.formatToParts(new Date(t)).forEach(function (p) { if (p.type !== "literal") { o[p.type] = parseInt(p.value, 10); } });
    return o;
  }
  function tzFark(tz, t) { var p = parcalar(tz, t); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000; }
  // refMs'nin YEREL gününde (tz) hh:mm olan an; minMs'den önceyse ertesi gün
  function yerelSaatMs(tz, refMs, hh, mm, minMs) {
    try {
      var p = parcalar(tz, refMs);
      for (var g = 0; g < 3; g++) {
        var tahmin = Date.UTC(p.year, p.month - 1, p.day + g, hh, mm);
        var t = tahmin - tzFark(tz, tahmin);
        t = tahmin - tzFark(tz, t);
        if (minMs == null || t >= minMs) { return t; }
      }
    } catch (e) { /* geçersiz tz */ }
    return null;
  }
  function saatMetni(t, tz) {
    try { return new Intl.DateTimeFormat("tr-TR", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(t)); } catch (e) { return null; }
  }
  function tzAd(t, tz) {
    try {
      var f = new Intl.DateTimeFormat("tr-TR", { timeZone: tz, timeZoneName: "short", hour: "2-digit" });
      var p = f.formatToParts(new Date(t)).filter(function (x) { return x.type === "timeZoneName"; })[0];
      return p ? p.value : "";
    } catch (e) { return ""; }
  }
  // { tr:"16:30", local:"21:30", tzAd:"GMT+8", gunTr:"10 Eki" } — local yalnızca pist saat dilimi biliniyorsa
  function saatCifti(t, pistTz) {
    var r = { tr: saatMetni(t, ANA_TZ), local: null, tzAd: "" };
    if (pistTz) { r.local = saatMetni(t, pistTz); r.tzAd = tzAd(t, pistTz); }
    return r;
  }

  // ---------- Hafta yardımcıları ----------
  function seansBul(hafta, anahtar) { var l = hafta && hafta.seanslar || []; for (var i = 0; i < l.length; i++) { if (l[i].anahtar === anahtar) { return l[i]; } } return null; }
  function sqAnahtari(hafta) { return seansBul(hafta, "SprintQualifying") ? "SprintQualifying" : (seansBul(hafta, "SprintShootout") ? "SprintShootout" : null); }
  function mevcutMu(hafta, anahtar) { return !!(anahtar && seansBul(hafta, anahtar)); }
  function planli(hafta, anahtar) {
    var s = seansBul(hafta, anahtar); if (!s) { return null; }
    var b = ms(s.baslangic), e = ms(s.bitis); return { bas: b, bit: e, sure: e - b, ad: s.ad };
  }
  function seansAdi(hafta, anahtar) { var s = seansBul(hafta, anahtar); return s ? s.ad : (anahtar || "Hafta sonu"); }

  // ---------- Statik / resmi girdiler (program-degisiklik.js) ----------
  // { id, sezon, tur, seans, tip, baslik?, metin?, kaynak, zaman, yeniBaslangic?, gecerli?, bitis?, dogrulandi, neden?, pilot?[], takim?[], pist? }
  function statikGirdi(g, hafta) {
    var tip = String(g.tip || "").toUpperCase();
    var tur = TURLER[tip] ? tip : TIP_TUR[tip];
    if (!tur || !TURLER[tur]) { return null; }
    var ts = ms(g.zaman); if (ts == null) { return null; }
    var kaynak = g.kaynak || "Uygulama içeriği";
    var resmi = /^(fia|formula 1|f1)/i.test(kaynak);
    return olustur({ id: g.id || ("statik-" + tur + "-" + (g.seans || "") + "-" + ts), type: tur, session: g.seans || null, title: g.baslik || null, shortText: g.metin || null,
      source: kaynak, timestamp: ts, effectiveFrom: ms(g.gecerli) != null ? ms(g.gecerli) : ts, revisedTime: ms(g.yeniBaslangic), expiry: ms(g.bitis),
      verified: g.dogrulandi !== false, kaynakSeviye: resmi ? "official" : "static", neden: g.neden || null,
      hedef: { pilot: g.pilot || [], takim: g.takim || [], pist: g.pist || null }, sezon: g.sezon, tur: g.tur }, hafta);
  }

  // Kart nesnesini tamamlar: başlık/metin varsayılanları, süre sonu
  function olustur(k, hafta) {
    var meta = TURLER[k.type] || { baslik: k.type, siddet: "info" };
    var o = { id: k.id, type: k.type, severity: k.severity || meta.siddet, session: k.session || null, title: k.title || meta.baslik,
      shortText: k.shortText || varsayilanMetin(k.type, k.neden), source: k.source, timestamp: iso(k.timestamp), effectiveFrom: iso(k.effectiveFrom != null ? k.effectiveFrom : k.timestamp),
      revisedTime: iso(k.revisedTime), expiry: iso(k.expiry), verified: !!k.verified, kaynakSeviye: k.kaynakSeviye || "feed", neden: k.neden || null,
      hedef: k.hedef || { pilot: [], takim: [], pist: null }, sezon: k.sezon || (hafta && hafta.sezon) || null, tur: k.tur || (hafta && hafta.tur) || null, program: !!meta.program };
    return o;
  }
  function varsayilanMetin(type, neden) {
    var ek = neden === "hava" ? " Neden: hava koşulları." : "";
    switch (type) {
      case "SESSION_DELAYED": return "Başlangıç gecikti. Yeni başlangıç saati bekleniyor." + ek;
      case "SESSION_POSTPONED": return "Seans ertelendi. Yeni başlangıç saati bekleniyor." + ek;
      case "NEW_TIME_CONFIRMED": return "Yeni başlangıç saati açıklandı." + ek;
      case "SESSION_CANCELLED": return "Seans iptal edildi." + ek;
      default: return "";
    }
  }

  // ---------- Feed metninden çıkarım ----------
  function metin(o) { return String((o && (o.originalText || o.textTr)) || ""); }
  function kisalt(s, n) { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

  var RE_SQ = /\bsprint[- ]?(qualifying|shootout)\b|\bSQ\b/i;
  var RE_Q = /\bqualifying\b/i;
  var RE_SPRINT = /\bsprint\b/i;
  var RE_RACE = /\b(grand prix|race|gp)\b/i;
  var RE_FP = /\b(?:fp|free practice|practice)\s*([123])\b/i;
  function seansAnahtariMetinden(t, hafta) {
    var sq = RE_SQ.exec(t);
    if (sq) { return sqAnahtari(hafta); }
    if (RE_Q.test(t)) { return "Qualifying"; }
    var fp = RE_FP.exec(t); if (fp) { return ["FirstPractice", "SecondPractice", "ThirdPractice"][parseInt(fp[1], 10) - 1]; }
    if (RE_SPRINT.test(t)) { return "Sprint"; }
    if (RE_RACE.test(t)) { return "Race"; }
    return null;
  }

  var RE_IPTAL = /\b(cancel(?:l)?ed|called off|scrapped|will not (?:take place|go ahead|run))\b/i;
  var RE_ERTELE = /\b(postpone\w*|put back|pushed back|push(?:ed)? back|re-?scheduled|moved (?:back|to)|held back)\b/i;
  var RE_GECIKTI = /\bdelay\w*\b/i;
  var RE_YENI_SAAT_1 = /\b(?:will\s+)?(?:now\s+)?(?:start|begin|get under ?way|take place|run|go green)\b[^.!?]{0,20}\b(?:at|from)\s*(\d{1,2})[:.](\d{2})\b/i;
  var RE_YENI_SAAT_2 = /\b(?:re-?scheduled|moved|pushed back|put back|postponed|delayed|now (?:set|scheduled))\b[^.!?]{0,30}\b(?:to|until|for|at)\s*(\d{1,2})[:.](\d{2})\b/i;
  var RE_YENI_SAAT_3 = /\bnew (?:start )?time\b[^.!?]{0,15}(\d{1,2})[:.](\d{2})/i;
  var RE_KONTROL = /\binspect\w*\b/i;
  var RE_HAVA = /\b(rain\w*|downpour|storm\w*|weather|standing water|aquaplan\w*|wet|lightning|thunder\w*)\b/i;

  function climaParcala(t) { return t.split(/[.!?;]+\s*|\s*,\s*(?:so|and|but|therefore|with)\b|\s+so\s+/i).map(function (x) { return x.trim(); }).filter(Boolean); }

  // Bir Race Feed olayından program girdileri (diğer seansı ya da kendi seansının yeni saatini bildiren açık kalıplar). kendi: bu deponun seansı ("Sprint"|"Race")
  function programFeedGirdileri(o, hafta, kendi) {
    var tum = metin(o), ts = ms(o.timestamp), sonuc = [];
    if (ts == null) { return sonuc; }
    var parcalar_ = climaParcala(tum);
    var onceki = null;   // önceki cümlede adı geçen seans ("… Sprint delayed. Next inspection …" gibi bağlam)
    parcalar_.forEach(function (c) {
      var anahtar = seansAnahtariMetinden(c, hafta);
      var acik = !!anahtar;
      if (!anahtar) { anahtar = kendi; } else { onceki = anahtar; }
      if (!anahtar || !mevcutMu(hafta, anahtar)) { return; }
      var kendiMi = anahtar === kendi && !acik;
      var tipi = null, yeni = null;
      if (RE_IPTAL.test(c) && acik) { tipi = "SESSION_CANCELLED"; }
      else if (!RE_KONTROL.test(c)) {
        var m = RE_YENI_SAAT_1.exec(c) || RE_YENI_SAAT_2.exec(c) || RE_YENI_SAAT_3.exec(c);
        var pl = planli(hafta, anahtar);
        if (m && pl && hafta.pistTz) {
          var hh = parseInt(m[1], 10), mm = parseInt(m[2], 10);
          if (hh <= 23 && mm <= 59) {
            var t = yerelSaatMs(hafta.pistTz, pl.bas, hh, mm, pl.bas - 2 * DK);
            if (t != null && Math.abs(t - pl.bas) > 2 * DK && t - pl.bas < 36 * SA) { tipi = "NEW_TIME_CONFIRMED"; yeni = t; }
          }
        }
        if (!tipi && RE_ERTELE.test(c) && (acik || kendiMi)) { tipi = "SESSION_POSTPONED"; }
        else if (!tipi && RE_GECIKTI.test(c) && acik && anahtar !== kendi) { tipi = "SESSION_DELAYED"; }   // kendi seansının "delayed start"ı hafta-state feed makinesinin işi
      }
      if (!tipi) { return; }
      var neden = RE_HAVA.test(tum) ? "hava" : null;
      sonuc.push(olustur({ id: "feed-" + tipi + "-" + anahtar + "-" + ts, type: tipi, session: anahtar, source: "Race Feed (Chris Medland)", timestamp: ts, effectiveFrom: ts,
        revisedTime: yeni, verified: false, kaynakSeviye: "feed", neden: neden, shortText: tipi === "NEW_TIME_CONFIRMED" || tipi === "SESSION_POSTPONED" || tipi === "SESSION_DELAYED" ? null : null,
        hedef: { pilot: [], takim: [], pist: hafta.pistId || null } }, hafta));
    });
    return sonuc;
  }

  // Bilgi kartları (program dışı): hava/pist, start prosedürü, kısaltma, pit lane / grid / ceza, teknik
  var RE_HAVA_KRITIK = /\b(heavy rain|downpour|torrential|standing water|aquaplan\w*|lightning|thunder\w*|rain (?:has |is )?(?:started|falling|returned|stopped|easing)|track is (?:wet|damp|drying)|drying)\b/i;
  var RE_START_PROS = /\b(revised start|start procedure|rolling start|standing start|safety car start|behind the safety car|formation lap (?:will|has|is))\b/i;
  var RE_KISALT = /\b(shorten\w*|reduced (?:to|by)|cut (?:to|short)|\d+[- ]lap (?:race|sprint)|will (?:now )?(?:be|run) (?:over )?\d+ laps)\b/i;
  var RE_PITLANE = /\bpit[- ]?lane start|start(?:s|ing)? from the pit ?lane\b/i;
  var RE_GRID = /\bgrid (?:penalty|drop)\b|\b\d+[- ](?:place|position)s? (?:grid )?(?:penalty|drop)\b|\bdrops? \d+ places? on the grid\b|\bstart(?:s|ing)? from the back\b/i;
  var RE_CEZA = /\b(\d+[- ]second|drive[- ]through|stop[- ]go|time) penalty\b/i;
  var RE_TEKNIK = /\b(upgrade\w*|new (?:floor|front wing|rear wing|power unit|engine|gearbox)|engine (?:change|penalty)|component change)\b/i;
  var RE_PISTDEG = /\b(track limits|kerb\w*|drs zone|chicane)\b[^.]{0,30}\b(changed?|new|removed|added|moved|extended)\b/i;

  function surucuHedef(o, harita) {
    var kod = [], takim = [];
    (o.drivers || []).forEach(function (f) { var p = harita && harita[f]; if (p) { if (p.kod && kod.indexOf(p.kod) < 0) { kod.push(p.kod); } if (p.takim && takim.indexOf(p.takim) < 0) { takim.push(p.takim); } } });
    return { pilot: kod, takim: takim };
  }
  function bilgiFeedGirdileri(o, hafta, kendi, harita) {
    var t = metin(o), ts = ms(o.timestamp), l = [];
    if (ts == null || !kendi) { return l; }
    var h = surucuHedef(o, harita);
    function ekle(type, hedefler) {
      l.push(olustur({ id: "feed-" + type + "-" + kendi + "-" + ts + "-" + (h.pilot[0] || ""), type: type, session: kendi, source: "Race Feed (Chris Medland)", timestamp: ts, effectiveFrom: ts, verified: false,
        kaynakSeviye: "feed", neden: type === "WEATHER" ? "hava" : null, shortText: kisalt(o.textTr || t, 150), hedef: hedefler }, hafta));
    }
    var tam = { pilot: h.pilot, takim: h.takim, pist: hafta.pistId || null };
    if (RE_HAVA_KRITIK.test(t)) { ekle("WEATHER", { pilot: [], takim: [], pist: hafta.pistId || null }); }
    if (RE_START_PROS.test(t)) { ekle("START_PROCEDURE", { pilot: [], takim: [], pist: null }); }
    if (RE_KISALT.test(t)) { ekle("SESSION_SHORTENED", { pilot: [], takim: [], pist: null }); }
    if (RE_PITLANE.test(t) && h.pilot.length) { ekle("PIT_LANE_START", { pilot: h.pilot, takim: h.takim, pist: null }); }
    else if (RE_GRID.test(t) && h.pilot.length) { ekle("GRID_PENALTY", { pilot: h.pilot, takim: h.takim, pist: null }); }
    else if ((o.category === "PENALTY" || RE_CEZA.test(t)) && h.pilot.length) { ekle("PENALTY", { pilot: h.pilot, takim: h.takim, pist: null }); }
    if (RE_TEKNIK.test(t) && h.takim.length) { ekle("TECH_UPDATE", { pilot: h.pilot, takim: h.takim, pist: null }); }
    if (RE_PISTDEG.test(t)) { ekle("TRACK_CHANGE", { pilot: [], takim: [], pist: hafta.pistId || null }); }
    return l;
  }

  // ---------- Girdileri topla + süre sonu ----------
  // ctx: { sezon, tur, hafta:{seanslar:[{anahtar,ad,baslangic,bitis}], pistTz, pistId}, statik:[], feed:{ Sprint:[olaylar], Race:[olaylar] }, pilotHarita:{ Norris:{kod,takim} } }
  function programSecimi(girdiler, anahtar, simdi, hafta) {
    var pl = planli(hafta, anahtar);
    var aday = girdiler.filter(function (g) {
      return g.program && g.session === anahtar && ms(g.effectiveFrom) <= simdi && !(sureDoldu(g, pl, simdi));
    });
    if (!aday.length) { return null; }
    aday.sort(function (a, b) { return (b.verified - a.verified) || (ms(b.timestamp) - ms(a.timestamp)); });
    var g = aday[0], tip = PROG_TIP[g.type];
    var bas = ms(g.revisedTime), bit = null;
    if (tip === "NEW_TIME_CONFIRMED" && bas != null && pl) { bit = bas + pl.sure; }
    if (tip === "NEW_TIME_CONFIRMED" && bas == null) { tip = "DELAYED"; }
    return { tip: tip, yeniBaslangic: bas, yeniBitis: bit, kaynak: g.source, verified: g.verified, kaynakSeviye: g.kaynakSeviye, timestamp: ms(g.timestamp), kartId: g.id, neden: g.neden };
  }
  // Geçici program (DELAYED/POSTPONED, yeni saat yok): planlı bitişten 24 saat sonra bayat sayılır → normal akış. YENİ SAAT ve İPTAL kalıcıdır (hafta sonuna ait).
  function sureDoldu(g, pl, simdi) {
    if (g.type === "SESSION_DELAYED" || g.type === "SESSION_POSTPONED") {
      var son = ms(g.expiry) != null ? ms(g.expiry) : (pl ? pl.bit + 24 * SA : null);
      return son != null && simdi > son;
    }
    return ms(g.expiry) != null && simdi > ms(g.expiry) && g.type !== "NEW_TIME_CONFIRMED" && g.type !== "SESSION_CANCELLED";
  }

  function efektif(hafta, anahtar, prog) {
    var pl = planli(hafta, anahtar); if (!pl) { return null; }
    if (prog && prog.tip === "NEW_TIME_CONFIRMED" && prog.yeniBaslangic != null) { return { bas: prog.yeniBaslangic, bit: prog.yeniBitis != null ? prog.yeniBitis : prog.yeniBaslangic + pl.sure, degisti: true }; }
    return { bas: pl.bas, bit: pl.bit, degisti: false };
  }

  function kartSonu(g, hafta, programlar) {
    var pl = planli(hafta, g.session);
    var e = g.session ? efektif(hafta, g.session, programlar[g.session]) : null;
    var yarisE = efektif(hafta, "Race", programlar.Race);
    if (ms(g.expiry) != null) { return ms(g.expiry); }
    switch (g.type) {
      case "SESSION_DELAYED": case "SESSION_POSTPONED": return pl ? pl.bit + 24 * SA : null;
      case "NEW_TIME_CONFIRMED": return e ? e.bit + 2 * SA : null;
      case "SESSION_CANCELLED": return yarisE ? yarisE.bit + 3 * 24 * SA : null;
      case "GRID_PENALTY": case "PIT_LANE_START": case "TECH_UPDATE": case "OPERATIONAL": return yarisE ? yarisE.bit + 3 * SA : null;
      case "PENALTY": return e ? e.bit + 6 * SA : (yarisE ? yarisE.bit + 3 * SA : null);
      default: return e ? e.bit + 2 * SA : null;     // oturuma bağlı canlı bilgiler: seans efektif bitişinden 2 saat sonra kalkar
    }
  }

  function girdilerTopla(ctx, simdi) {
    var hafta = ctx.hafta, harita = ctx.pilotHarita || {};
    simdi = simdi == null ? Date.now() : simdi;
    var tumu = [];
    (ctx.statik || []).forEach(function (g) {
      if (g && Number(g.sezon) === Number(hafta.sezon) && Number(g.tur) === Number(hafta.tur)) { var k = statikGirdi(g, hafta); if (k && (k.session == null || mevcutMu(hafta, k.session))) { tumu.push(k); } }
    });
    var feed = ctx.feed || {};
    ["Sprint", "Race"].forEach(function (kendi) {
      var ol = (feed[kendi] || []).slice().sort(function (a, b) { return ms(a.timestamp) - ms(b.timestamp); });
      if (kendi === "Sprint" && !mevcutMu(hafta, "Sprint")) { return; }
      ol.forEach(function (o) {
        programFeedGirdileri(o, hafta, kendi).forEach(function (k) { tumu.push(k); });
        bilgiFeedGirdileri(o, hafta, kendi, harita).forEach(function (k) { tumu.push(k); });
      });
    });
    // aynı kimlik / çok yakın tekrar (10 dk, aynı tür+seans+pilot) tek karta indirilir
    var gorulen = {}, tekil = [];
    tumu.sort(function (a, b) { return ms(a.timestamp) - ms(b.timestamp); }).forEach(function (k) {
      var anahtar = k.type + "|" + k.session + "|" + (k.hedef.pilot || []).join(",") + "|" + Math.floor(ms(k.timestamp) / (10 * DK));
      var onceki = gorulen[anahtar];
      if (onceki && onceki.kaynakSeviye === k.kaynakSeviye) { tekil[tekil.indexOf(onceki)] = k; gorulen[anahtar] = k; return; }
      gorulen[anahtar] = k; tekil.push(k);
    });
    var programlar = {};
    hafta.seanslar.forEach(function (s) { var p = programSecimi(tekil, s.anahtar, simdi, hafta); if (p) { programlar[s.anahtar] = p; } });
    tekil.forEach(function (k) { var son = kartSonu(k, hafta, programlar); if (son != null && ms(k.expiry) == null) { k.expiry = iso(son); } });
    return { girdiler: tekil, programlar: programlar };
  }

  // "Red Bull" ~ "Red Bull Racing", "Alpine F1 Team" ~ "Alpine": normalleştirip biri diğerini içeriyorsa eşleşir
  function takimEsles(a, b) {
    function n(x) { return String(x || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\b(f1|team|racing)\b/g, "").replace(/\s+/g, " ").trim(); }
    var x = n(a), y = n(b); return !!x && !!y && (x === y || x.indexOf(y) >= 0 || y.indexOf(x) >= 0);
  }
  function aktifMi(k, simdi) { var b = ms(k.effectiveFrom), e = ms(k.expiry); return (b == null || simdi >= b) && (e == null || simdi <= e); }

  // Bir seansın program override'ı (hafta-state.js `program` alanı) — yoksa null
  function programDurumu(ctx, anahtar, simdi) {
    simdi = simdi == null ? Date.now() : simdi;
    var r = girdilerTopla(ctx, simdi);
    return r.programlar[anahtar] || null;
  }

  // ---------- Ekran filtresi ----------
  // ekran: { tip:"seans", seans } | { tip:"hafta" } | { tip:"pilot", kod } | { tip:"takim", ad } | { tip:"pist", id }
  function kartlar(ctx, ekran, simdi) {
    simdi = simdi == null ? Date.now() : simdi;
    var r = girdilerTopla(ctx, simdi);
    var aktif = r.girdiler.filter(function (k) { return aktifMi(k, simdi); });
    // yalnızca EN GÜNCEL program kartı geçerlidir (eski gecikme kartı, sonraki YENİ SAAT ile birlikte görünmez)
    aktif = aktif.filter(function (k) {
      if (!k.program) { return true; }
      var p = r.programlar[k.session]; return !!p && p.kartId === k.id;
    });
    var cikti;
    if (ekran.tip === "seans") { cikti = aktif.filter(function (k) { return k.session === ekran.seans; }); }
    else if (ekran.tip === "hafta") { cikti = aktif.filter(function (k) { return k.program; }); }
    else if (ekran.tip === "pilot") { cikti = aktif.filter(function (k) { return PILOT_TURLERI.indexOf(k.type) >= 0 && (k.hedef.pilot || []).indexOf(ekran.kod) >= 0; }); }
    else if (ekran.tip === "takim") { cikti = aktif.filter(function (k) { return TAKIM_TURLERI.indexOf(k.type) >= 0 && (k.hedef.takim || []).some(function (t) { return takimEsles(t, ekran.ad); }); }); }
    else if (ekran.tip === "pist") { cikti = aktif.filter(function (k) { return (PIST_TURLERI.indexOf(k.type) >= 0 || (k.program && k.neden === "hava")) && (k.hedef.pist === ekran.id || (k.program && ctx.hafta.pistId === ekran.id)); }); }
    else { cikti = []; }
    var sira = { critical: 0, warning: 1, info: 2 };
    return cikti.sort(function (a, b) { return (sira[a.severity] - sira[b.severity]) || (ms(b.timestamp) - ms(a.timestamp)); });
  }

  // ---------- Durum (hafta-state.js çıktısı) → kart ----------
  // Yalnızca Race Feed'den doğan canlı durumlar (program kartları kartlar() ile gelir)
  function durumKartlari(st, seans, hafta, simdi) {
    var l = [];
    if (!st) { return l; }
    var anahtar = seans.anahtar, ts = st.ts != null ? st.ts : simdi;
    function ekle(type, metni) {
      l.push(olustur({ id: "durum-" + type + "-" + anahtar, type: type, session: anahtar, source: "Race Feed (Chris Medland)", timestamp: simdi, effectiveFrom: simdi, verified: false, kaynakSeviye: "feed",
        shortText: metni, hedef: { pilot: [], takim: [], pist: null }, durumSatirlari: st.satirlar }, hafta));
    }
    if (st.kaynak === "feed" || st.kaynak === "program") {
      if (st.kaynak === "feed" && st.durum === "DELAYED") { ekle("SESSION_DELAYED", st.ozet); }
      else if (st.durum === "RED_FLAG") { ekle("RED_FLAG", st.ozet); }
      else if (st.durum === "SESSION_STOPPED") { ekle("SESSION_STOPPED", st.ozet); }
      else if (st.durum === "RESUMED") { ekle("RESTART", st.ozet); }
    }
    if (st.chip === "SAFETY CAR") { ekle("SAFETY_CAR", "Safety car devrede (Race Feed'e göre)."); }
    if (st.chip === "VSC") { ekle("VSC", "Sanal safety car (VSC) devrede (Race Feed'e göre)."); }
    // durum satırları (pist kontrolü, neden…) yalnızca ilk kartta gösterilir
    if (l.length && st.satirlar && st.satirlar.length) { l[0].satirlar = st.satirlar.slice(); }
    return l;
  }

  // ---------- HTML ----------
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function kaynakEtiketi(k) {
    var z = k.timestamp ? saatMetni(ms(k.timestamp), ANA_TZ) : null;
    return "Kaynak: " + esc(k.source) + (z ? " · " + z + " TR" : "") + (k.verified ? " · doğrulandı" : " · gazeteci notu, resmi doğrulama yok");
  }
  // opts: { pistTz, planliBas (ms) — yeni saat kartında eski planlı saat ikincil bilgi, seansAd, kisa: true (hafta özeti) }
  function kartHtml(k, opts) {
    opts = opts || {};
    var ad = esc(String(opts.seansAd || k.session || "").toUpperCase());
    var baslik = (ad ? ad + " — " : "") + esc(k.title);
    var saat = "";
    if (k.revisedTime) {
      var c = saatCifti(ms(k.revisedTime), opts.pistTz);
      saat = "<div class='bk-saat'><b>" + esc(c.tr) + " TR</b>" + (c.local ? " <span>" + esc(c.local) + " local" + (c.tzAd ? " (" + esc(c.tzAd) + ")" : "") + "</span>" : "") + "</div>";
    }
    var eski = "";
    if (opts.planliBas != null && (k.type === "NEW_TIME_CONFIRMED" || k.type === "SESSION_POSTPONED" || k.type === "SESSION_DELAYED") && k.program) {
      var pc = saatCifti(opts.planliBas, opts.pistTz);
      eski = "<div class='bk-eski'>Planlı saat: " + esc(pc.tr) + " TR" + (pc.local ? " · " + esc(pc.local) + " local" : "") + "</div>";
    }
    var satirlar = (k.satirlar || []).map(function (x) { return "<div class='bk-ek'>" + esc(x) + "</div>"; }).join("");
    if (opts.kisa) {
      return "<div class='bk bk-" + esc(k.severity) + " bk-kisa' data-bk='" + esc(k.id) + "'><b>" + baslik + "</b>" + (k.revisedTime ? " <span>" + esc(saatCifti(ms(k.revisedTime), opts.pistTz).tr) + " TR</span>" : "") + "</div>";
    }
    return "<div class='bk bk-" + esc(k.severity) + " bk-t-" + esc(k.type) + "' role='status' data-bk='" + esc(k.id) + "'>" +
      "<div class='bk-baslik'>" + baslik + "</div>" +
      (k.shortText ? "<div class='bk-metin'>" + esc(k.shortText) + "</div>" : "") + saat + satirlar + eski +
      "<div class='bk-kaynak'>" + kaynakEtiketi(k) + "</div></div>";
  }

  var API = { TURLER: TURLER, girdilerTopla: girdilerTopla, programDurumu: programDurumu, kartlar: kartlar, durumKartlari: durumKartlari, kartHtml: kartHtml,
              efektif: efektif, saatCifti: saatCifti, yerelSaatMs: yerelSaatMs, seansAnahtariMetinden: seansAnahtariMetinden, aktifMi: aktifMi, statikGirdi: statikGirdi,
              programFeedGirdileri: programFeedGirdileri, bilgiFeedGirdileri: bilgiFeedGirdileri, PROG_TIP: PROG_TIP };
  if (kok) { kok.HaftaBaglam = API; }
  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
})(typeof window !== "undefined" ? window : null);
