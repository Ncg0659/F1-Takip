/* OPENF1 A7.1 — HISTORICAL RACE CONTROL (yalnızca seans SONRASI zenginleştirme).
   İki katman:
   1) SAF katman (DOM/ağ/zamanlayıcı/depolama YOK; Node'da test edilir): ham OpenF1 `race_control` satırlarını normalize olay modeline çevirir,
      "en kritik N olay" seçer, yeniden kullanılabilir özet sayıları üretir (Yarışı Kaçırdıysan için hazır veri katmanı).
   2) VERİ katmanı (RaceControlVeri.yukle): TEK SEFERLİK, tembel (kullanıcı "Seans Olayları"nı açınca) tarihsel çağrı. Yeni istemci/anahtar/ücretli katman YOK:
      openf1-veri.js'in meetingBul + sirali (hız sınırı/429) kuyruğu ve JolpicaIstemci önbelleği kullanılır. Canlı/gerçek zamanlı OpenF1 kullanılmaz:
      seans bitişinden (date_end) 30 dk geçmeden istek yapılmaz. Polling/zamanlayıcı YOK. Sonuç motoruna (hafta-veri/openf1-veri sonuç akışı) dokunmaz.
   Hiçbir olay uydurulmaz: yalnızca gelen satırlar normalize edilir. Feed notundan Race Control olayı ÜRETİLMEZ. */
(function (kok) {
  "use strict";

  // ---------- 1) SAF KATMAN ----------
  var TIPLER = ["RED_FLAG", "YELLOW_FLAG", "GREEN_FLAG", "SESSION_STOPPED", "SESSION_RESUMED", "SAFETY_CAR", "VSC", "CHEQUERED", "START", "RESTART",
                "INCIDENT", "INVESTIGATION", "PENALTY", "TRACK_LIMITS", "SESSION_STATUS", "OTHER"];
  var IKON = { RED_FLAG: "🔴", YELLOW_FLAG: "🟡", GREEN_FLAG: "🟢", SESSION_STOPPED: "⏸", SESSION_RESUMED: "🟢", SAFETY_CAR: "🚗", VSC: "🚗", CHEQUERED: "🏁",
               START: "🟢", RESTART: "🟢", INCIDENT: "⚠️", INVESTIGATION: "🔎", PENALTY: "⛔", TRACK_LIMITS: "📏", SESSION_STATUS: "🕒", OTHER: "ℹ️" };
  // "en kritik" sıralaması: küçük = daha kritik
  var ONCELIK = { RED_FLAG: 0, SESSION_STOPPED: 0, SAFETY_CAR: 1, VSC: 1, PENALTY: 1, SESSION_RESUMED: 2, RESTART: 2, INVESTIGATION: 3, CHEQUERED: 3, START: 4, INCIDENT: 5, SESSION_STATUS: 5,
                  TRACK_LIMITS: 7, YELLOW_FLAG: 7, GREEN_FLAG: 8, OTHER: 9 };

  function msOf(t) { var x = Date.parse(t); return isFinite(x) ? x : null; }
  function buyuk(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim().toUpperCase(); }
  function num(x) { return typeof x === "number" && isFinite(x) ? x : (x != null && x !== "" && isFinite(Number(x)) ? Number(x) : null); }
  function suruculer(mesaj) {                       // "CARS 11 (PER), 77 (BOT) AND 55 (SAI)" → [{no, kod}]
    var out = [], re = /(?:CARS?\s+)?(?:^|[\s,])(\d{1,2})\s*\(([A-Z]{3})\)/g, m;
    while ((m = re.exec(mesaj))) { out.push({ no: Number(m[1]), kod: m[2] }); }
    var gor = {}; return out.filter(function (d) { if (gor[d.no]) { return false; } gor[d.no] = 1; return true; });
  }
  function virajNo(mesaj) { var m = /\bTURN\s+(\d{1,2})\b/.exec(mesaj); return m ? Number(m[1]) : null; }

  // Tek satırın tipi (durum makinesi gerektirmeyen kısım). Dönüş: { tip, alt, gizli?, siddet }
  function siniflandir(r) {
    var msg = buyuk(r.message), flag = buyuk(r.flag), cat = buyuk(r.category).replace(/\s+/g, "");
    var m;
    // 1) Bayraklar
    if (flag === "RED" || /^RED FLAG\b/.test(msg)) { return { tip: "RED_FLAG", alt: null }; }
    if (flag === "CHEQUERED" || /CHEQUERED FLAG/.test(msg)) { return { tip: "CHEQUERED", alt: null }; }
    if (flag === "YELLOW" || flag === "DOUBLE YELLOW") { return { tip: "YELLOW_FLAG", alt: flag === "DOUBLE YELLOW" ? "DOUBLE" : "SINGLE" }; }
    if (flag === "BLUE") { return { tip: "OTHER", alt: "BLUE", gizli: "gürültü" }; }
    if (flag === "BLACK AND WHITE" || flag === "BLACK") { return { tip: "PENALTY", alt: flag === "BLACK" ? "BLACK" : "BLACK_WHITE" }; }
    if (flag === "GREEN" || flag === "CLEAR") {
      if (/PIT EXIT OPEN/.test(msg)) { return { tip: "GREEN_FLAG", alt: "PIT_EXIT_OPEN" }; }
      if (/^TRACK CLEAR/.test(msg) || (r.scope && buyuk(r.scope) === "TRACK")) { return { tip: "GREEN_FLAG", alt: "TRACK_CLEAR" }; }
      return { tip: "GREEN_FLAG", alt: "SECTOR_CLEAR", gizli: "sektör temiz (sarı bayrağın karşılığı)" };
    }
    // 2) Safety car / VSC
    if (/VIRTUAL SAFETY CAR|\bVSC\b/.test(msg)) { return { tip: "VSC", alt: /ENDING|ENDED/.test(msg) ? "END" : "START" }; }
    if (/SAFETY CAR/.test(msg) || cat === "SAFETYCAR") { return { tip: "SAFETY_CAR", alt: /IN THIS LAP|ENDING|ENDED/.test(msg) ? "END" : "START" }; }
    // 3) Seans durumu
    if (/^SESSION (ABORTED|SUSPENDED|STOPPED)/.test(msg)) { return { tip: "SESSION_STOPPED", alt: null }; }
    if (/^SESSION (RESUMED|RESTARTED)/.test(msg) || /\bRESUMED\b/.test(msg)) { return { tip: "SESSION_RESUMED", alt: "EXPLICIT" }; }
    if (/^SESSION STARTED/.test(msg)) { return { tip: "START", alt: "SESSION_STARTED" }; }          // durum makinesi RESUMED'a çevirebilir
    if (/^SESSION FINISHED|^SESSION ENDED/.test(msg)) { return { tip: "SESSION_STATUS", alt: "FINISHED" }; }
    if (/(RACE|SESSION|SPRINT|Q[123]|SQ[123]|PART \d)\s+(WILL\s+)?RESTART/.test(msg) && !/WILL RESTART AT/.test(msg)) { return { tip: "RESTART", alt: null }; }
    if (/^START OF [A-Z0-9 ]+ WILL BE DELAYED/.test(msg) || /\bWILL BE DELAYED\b/.test(msg)) { return { tip: "SESSION_STATUS", alt: "START_DELAYED" }; }
    if (/\bWILL RESUME AT\b/.test(msg)) { return { tip: "SESSION_STATUS", alt: "WILL_RESUME" }; }
    if (/\bWILL (?:START|RESTART) AT\b/.test(msg)) { return { tip: "SESSION_STATUS", alt: "WILL_START" }; }
    // 4) Hakem kararları
    if (/NO FURTHER (ACTION|INVESTIGATION)|NO INVESTIGATION|REVIEWED/.test(msg) && /INCIDENT|INVESTIGATION/.test(msg)) { return { tip: "INCIDENT", alt: "NO_FURTHER_ACTION" }; }
    if (/PENALTY|DRIVE[- ]THROUGH|STOP[\/ -]?GO|REPRIMAND|DISQUALIFIED|EXCLUDED|BLACK AND WHITE|\bWARNING\b/.test(msg) && !/PENALTY (SERVED|NOTED)/.test(msg) || /PENALTY SERVED/.test(msg)) {
      return { tip: "PENALTY", alt: /SERVED/.test(msg) ? "SERVED" : (/WARNING/.test(msg) ? "WARNING" : "PENALTY") };
    }
    if (/UNDER INVESTIGATION|WILL BE INVESTIGATED|INVESTIGATION/.test(msg)) { return { tip: "INVESTIGATION", alt: /AFTER THE (SESSION|RACE)/.test(msg) ? "AFTER_SESSION" : "OPEN" }; }
    if (/INCIDENT/.test(msg) && /NOTED/.test(msg)) { return { tip: "INCIDENT", alt: "NOTED" }; }
    // 5) Pist sınırı / tur silme
    if (/TRACK LIMITS/.test(msg)) { return { tip: "TRACK_LIMITS", alt: /LAP DELETED/.test(msg) ? "LAP_DELETED" : "TIME_DELETED" }; }
    if (/(TIME|LAP) DELETED/.test(msg)) { return { tip: "INCIDENT", alt: "LAP_DELETED" }; }
    // 6) Olay benzeri araç mesajları
    if (/\b(STOPPED ON TRACK|OFF TRACK|SPUN|COLLISION|CONTACT|CRASH|RECOVERY VEHICLE|DEBRIS)\b/.test(msg)) { return { tip: "INCIDENT", alt: "CAR_EVENT" }; }
    // 7) Gürültü / bilinmeyen
    if (/^OVERTAKE (ENABLED|DISABLED)/.test(msg)) { return { tip: "OTHER", alt: "OVERTAKE", gizli: "gürültü" }; }
    if (/^DRS (ENABLED|DISABLED)/.test(msg) || cat === "DRS") { return { tip: "OTHER", alt: "DRS", gizli: "gürültü" }; }
    if (/^FIRST CAR TO TAKE THE FLAG/.test(msg)) { return { tip: "OTHER", alt: "FIRST_CAR" }; }
    if (/TRACK SURFACE SLIPPERY|SLIPPERY/.test(msg)) { return { tip: "OTHER", alt: "SLIPPERY" }; }
    if (/RISK OF RAIN|RAIN/.test(msg)) { return { tip: "OTHER", alt: "WEATHER" }; }
    m = null; return { tip: "OTHER", alt: null };
  }

  function siddetOf(tip, alt) {
    if (tip === "RED_FLAG" || tip === "SESSION_STOPPED" || tip === "SAFETY_CAR" || tip === "VSC" || (tip === "PENALTY" && alt !== "SERVED")) { return "critical"; }
    if (tip === "SESSION_RESUMED" || tip === "RESTART" || tip === "CHEQUERED" || tip === "INVESTIGATION" || (tip === "SESSION_STATUS" && alt !== "FINISHED")) { return "warning"; }
    return "info";
  }

  // Ham satırlar → normalize olaylar (zamana göre sıralı). opts: { sessionKey, meetingKey, sessionType }
  // Başka oturuma (session_key) ait satırlar ATILIR (karışma koruması). Dönüş: { olaylar, atilan, uyarilar }
  function normalize(rows, opts) {
    opts = opts || {}; var uyarilar = [], atilan = 0, ham = [];
    (Array.isArray(rows) ? rows : []).forEach(function (r, i) {
      if (!r || typeof r !== "object") { atilan++; return; }
      var t = msOf(r.date); if (t == null) { atilan++; uyarilar.push("tarihi geçersiz satır atıldı (#" + i + ")"); return; }
      if (opts.sessionKey != null && r.session_key != null && Number(r.session_key) !== Number(opts.sessionKey)) { atilan++; return; }
      if (opts.meetingKey != null && r.meeting_key != null && Number(r.meeting_key) !== Number(opts.meetingKey)) { atilan++; return; }
      ham.push({ r: r, t: t, i: i });
    });
    ham.sort(function (a, b) { return a.t - b.t || a.i - b.i; });
    var durduruldu = false, kirmiziSon = null, durduSon = null, out = [], gorulen = {};
    ham.forEach(function (x) {
      var r = x.r, c = siniflandir(r), msg = String(r.message == null ? "" : r.message).trim();
      var anahtar = x.t + "|" + buyuk(msg) + "|" + (r.driver_number == null ? "" : r.driver_number) + "|" + (r.sector == null ? "" : r.sector) + "|" + buyuk(r.flag);
      if (gorulen[anahtar]) { atilan++; return; }                       // aynı kayıt iki kez gelirse tek
      gorulen[anahtar] = 1;
      var tip = c.tip, alt = c.alt, gizli = c.gizli || null;
      // Durum makinesi (yalnızca aynı oturumun satır SIRASINDAN): durdurma sonrası "SESSION STARTED" = yeniden başlama
      if (tip === "RED_FLAG" || tip === "SESSION_STOPPED") { durduruldu = true; if (tip === "RED_FLAG") { kirmiziSon = x.t; } else { durduSon = x.t; } }
      else if (tip === "START" && alt === "SESSION_STARTED") { if (durduruldu) { tip = "SESSION_RESUMED"; alt = "AFTER_STOP"; } durduruldu = false; }
      else if (tip === "SESSION_RESUMED") { durduruldu = false; }
      else if (tip === "SESSION_STATUS" && alt === "FINISHED") { durduruldu = false; }
      var sur = suruculer(msg), dn = num(r.driver_number);
      out.push({ sessionKey: r.session_key != null ? Number(r.session_key) : (opts.sessionKey != null ? Number(opts.sessionKey) : null), date: new Date(x.t).toISOString(), ms: x.t,
                 lapNumber: num(r.lap_number), category: r.category == null ? null : String(r.category), flag: r.flag == null ? null : String(r.flag), scope: r.scope == null ? null : String(r.scope),
                 sector: num(r.sector), driverNumber: dn != null ? dn : (sur.length === 1 ? sur[0].no : null), drivers: sur, message: msg,
                 normalizedType: tip, subType: alt, severity: siddetOf(tip, alt), qualifyingPhase: num(r.qualifying_phase), turn: virajNo(msg), gizli: gizli, _i: x.i });
    });
    // Birleştirme (tekrarı önler; model KAYBOLMAZ, yalnızca listeden gizlenir): SESSION ABORTED ~ RED FLAG, SESSION FINISHED ~ CHEQUERED, GREEN LIGHT ~ SESSION STARTED/RESUMED
    function yakin(e, tipler, sn, alt) { return out.some(function (o) { return o !== e && tipler.indexOf(o.normalizedType) >= 0 && Math.abs(o.ms - e.ms) <= sn * 1000 && (!alt || o.subType === alt); }); }
    out.forEach(function (e) {
      if (e.gizli) { return; }
      if (e.normalizedType === "SESSION_STOPPED" && yakin(e, ["RED_FLAG"], 10)) { e.gizli = "kırmızı bayrakla birleşti"; }
      else if (e.normalizedType === "SESSION_STATUS" && e.subType === "FINISHED" && yakin(e, ["CHEQUERED"], 10)) { e.gizli = "damalı bayrakla birleşti"; }
      else if (e.normalizedType === "GREEN_FLAG" && e.subType === "PIT_EXIT_OPEN" && yakin(e, ["START", "SESSION_RESUMED"], 5)) { e.gizli = "seans başlangıcıyla birleşti"; }
    });
    // Son damalı bayrak (seansın bitişi) önceliği yükselir
    var damali = out.filter(function (e) { return e.normalizedType === "CHEQUERED"; });
    if (damali.length) { damali[damali.length - 1]._son = true; }
    return { olaylar: out, atilan: atilan, uyarilar: uyarilar };
  }

  function listelenen(olaylar) { return (olaylar || []).filter(function (e) { return !e.gizli; }); }
  function oncelik(e) { var p = ONCELIK[e.normalizedType]; if (p == null) { p = 9; } if (e._son) { p = 1; } if (e.normalizedType === "SESSION_STATUS" && e.subType === "START_DELAYED") { p = 2; } return p; }

  // İlk görünüm: en kritik 3–5 olay (kronolojik sırada). 5 veya daha azı varsa hepsi.
  function kritikler(olaylar, n) {
    n = n || 5; var l = listelenen(olaylar);
    if (l.length <= n) { return l.slice(); }
    var sec = l.slice().sort(function (a, b) { return oncelik(a) - oncelik(b) || a.ms - b.ms; }).slice(0, n);
    return l.filter(function (e) { return sec.indexOf(e) >= 0; });
  }

  // Yeniden kullanılabilir özet (Yarışı Kaçırdıysan v2 vb. için): yalnızca model olaylarından sayar, UI'dan bağımsız
  function ozet(olaylar) {
    var o = { toplam: 0, listelenen: 0, kritik: 0, kirmiziBayrak: 0, seansDurduruldu: 0, safetyCar: 0, vsc: 0, yenidenBaslama: 0, restart: 0, sorusturma: 0, ceza: 0, olay: 0, pistSiniri: 0, sariBayrak: 0, damali: 0 };
    (olaylar || []).forEach(function (e) {
      o.toplam++;
      if (!e.gizli) { o.listelenen++; }
      if (e.severity === "critical") { o.kritik++; }
      switch (e.normalizedType) {
        case "RED_FLAG": o.kirmiziBayrak++; break;
        case "SESSION_STOPPED": o.seansDurduruldu++; break;
        case "SAFETY_CAR": if (e.subType !== "END") { o.safetyCar++; } break;
        case "VSC": if (e.subType !== "END") { o.vsc++; } break;
        case "SESSION_RESUMED": o.yenidenBaslama++; break;
        case "RESTART": o.restart++; break;
        case "INVESTIGATION": o.sorusturma++; break;
        case "PENALTY": if (e.subType !== "SERVED") { o.ceza++; } break;
        case "INCIDENT": o.olay++; break;
        case "TRACK_LIMITS": o.pistSiniri++; break;
        case "YELLOW_FLAG": o.sariBayrak++; break;
        case "CHEQUERED": o.damali++; break;
      }
    });
    return o;
  }

  // ---------- Türkçe sunum (ham İngilizce mesaj doğrudan basılmaz; çevirisi olmayan mesaj SOLUK ikincil satırda, olduğu gibi gösterilir) ----------
  function kodlar(e) { return e.drivers.length ? e.drivers.map(function (d) { return d.kod; }).join(", ") : (e.driverNumber != null ? "#" + e.driverNumber : ""); }
  function faz(e, ad) { return e.qualifyingPhase ? (ad ? ad + e.qualifyingPhase : e.qualifyingPhase + ". etap") : ""; }
  function trMetin(e, ctx) {
    ctx = ctx || {}; var msg = buyuk(e.message), m, k = kodlar(e), vr = e.turn != null ? "Viraj " + e.turn : "";
    switch (e.normalizedType) {
      case "RED_FLAG": return { baslik: "KIRMIZI BAYRAK", metin: "Seans durduruldu", cevrildi: true };
      case "SESSION_STOPPED": return { baslik: "SEANS DURDURULDU", metin: "", cevrildi: true };
      case "SESSION_RESUMED": return { baslik: "SEANS YENİDEN BAŞLADI", metin: "", cevrildi: true };
      case "START": return { baslik: "SEANS BAŞLADI", metin: e.qualifyingPhase ? faz(e, "SQ/Q ") .replace("SQ/Q ", "") + ". etap" : "", cevrildi: true };
      case "RESTART": return { baslik: "YENİDEN BAŞLAMA", metin: "", cevrildi: true };
      case "CHEQUERED": return { baslik: "DAMALI BAYRAK", metin: e.qualifyingPhase ? e.qualifyingPhase + ". etap sona erdi" : (ctx.seansAd ? ctx.seansAd + (e._son ? " tamamlandı" : ": etap/seans sona erdi") : "Seans/etap sona erdi"), cevrildi: true };
      case "SAFETY_CAR": return { baslik: "SAFETY CAR", metin: e.subType === "END" ? "Safety Car bu tur pite giriyor" : "Safety Car pistte", cevrildi: true };
      case "VSC": return { baslik: "SANAL SAFETY CAR (VSC)", metin: e.subType === "END" ? "VSC sona eriyor" : "VSC devrede", cevrildi: true };
      case "YELLOW_FLAG": return { baslik: e.subType === "DOUBLE" ? "ÇİFT SARI BAYRAK" : "SARI BAYRAK", metin: e.sector != null ? "Sektör " + e.sector : "", cevrildi: true };
      case "GREEN_FLAG":
        if (e.subType === "PIT_EXIT_OPEN") { return { baslik: "YEŞİL IŞIK", metin: "Pit çıkışı açıldı", cevrildi: true }; }
        if (e.subType === "TRACK_CLEAR") { return { baslik: "PİST TEMİZ", metin: "", cevrildi: true }; }
        return { baslik: "SEKTÖR TEMİZ", metin: e.sector != null ? "Sektör " + e.sector : "", cevrildi: true };
      case "SESSION_STATUS":
        if (e.subType === "FINISHED") { return { baslik: "SEANS/ETAP BİTTİ", metin: "", cevrildi: true }; }
        if ((m = /^START OF ([A-Z0-9 ]+?) WILL BE DELAYED/.exec(msg))) { return { baslik: "BAŞLANGIÇ GECİKECEK", metin: m[1] + " başlangıcı gecikecek", cevrildi: true }; }
        if ((m = /^([A-Z0-9 ]+?) WILL RESUME AT (\d{1,2}:\d{2})/.exec(msg))) { return { baslik: "YENİDEN BAŞLAMA SAATİ", metin: m[1] + " yeniden başlayacak: " + m[2] + " (pist saati)", cevrildi: true }; }
        if ((m = /^([A-Z0-9 ]+?) WILL (?:START|RESTART) AT (\d{1,2}:\d{2})/.exec(msg))) { return { baslik: "BAŞLAMA SAATİ", metin: m[1] + " başlayacak: " + m[2] + " (pist saati)", cevrildi: true }; }
        return { baslik: "SEANS DURUMU", metin: e.message, cevrildi: false };
      case "INVESTIGATION": return { baslik: "SORUŞTURMA", metin: (k ? k + " — " : "") + (e.subType === "AFTER_SESSION" ? "olay seans sonrası incelenecek" : "hakemler olayı inceliyor"), cevrildi: "kısmen", ham: e.message };
      case "INCIDENT":
        if (e.subType === "NO_FURTHER_ACTION") { return { baslik: "İŞLEM YOK", metin: (k ? k + " — " : "") + "hakemler ek işlem uygulamadı", cevrildi: "kısmen", ham: e.message }; }
        if (e.subType === "NOTED") { return { baslik: "OLAY KAYDA ALINDI", metin: (k ? k + (vr ? " · " + vr : "") : vr), cevrildi: "kısmen", ham: e.message }; }
        if (e.subType === "LAP_DELETED") { return { baslik: "TUR ZAMANI SİLİNDİ", metin: (k ? k : "") + (vr ? " · " + vr : ""), cevrildi: "kısmen", ham: e.message }; }
        return { baslik: "OLAY", metin: k, cevrildi: "kısmen", ham: e.message };
      case "PENALTY": return { baslik: e.subType === "WARNING" ? "UYARI" : (e.subType === "SERVED" ? "CEZA UYGULANDI" : "CEZA"), metin: k, cevrildi: "kısmen", ham: e.message };
      case "TRACK_LIMITS": return { baslik: "PİST SINIRI", metin: (k ? k + " — " : "") + (e.subType === "LAP_DELETED" ? "tur silindi" : "tur zamanı silindi") + (vr ? " · " + vr : ""), cevrildi: "kısmen", ham: e.message };
      default:
        if (e.subType === "FIRST_CAR") { return { baslik: "DAMALI BAYRAĞI İLK GÖREN", metin: k, cevrildi: true }; }
        if (e.subType === "SLIPPERY") { return { baslik: "PİST KAYGAN", metin: e.sector != null ? "Sektör " + e.sector : (/SECTOR (\d+)/.test(msg) ? "Sektör " + /SECTOR (\d+)/.exec(msg)[1] : ""), cevrildi: true }; }
        return { baslik: "BİLGİ", metin: e.message, cevrildi: false };
    }
  }

  function saatMetni(ms, tz) { try { return new Intl.DateTimeFormat("tr-TR", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(ms)); } catch (e) { return null; } }
  // UI satırı: { id, saat (TR), yerel, ikon, baslik, metin, ham, siddet, tip }
  function satir(e, ctx) {
    ctx = ctx || {}; var t = trMetin(e, ctx), tr = saatMetni(e.ms, "Europe/Istanbul"), yerel = ctx.pistTz ? saatMetni(e.ms, ctx.pistTz) : null;
    var ham = t.cevrildi === true ? "" : (t.ham || (t.cevrildi === false ? "" : ""));
    return { id: e.sessionKey + "-" + e.ms + "-" + e._i, saat: tr, yerel: yerel && yerel !== tr ? yerel : null, ikon: IKON[e.normalizedType] || "ℹ️", baslik: t.baslik, metin: t.metin || "", ham: ham, siddet: e.severity, tip: e.normalizedType };
  }

  // Hata/bekleme metinleri (iki durumu karıştırma): yayımlanmadı ≠ ulaşılamıyor
  var MESAJ = { yayimlanmadi: "Race Control verisi henüz yayımlanmadı.", hata: "OpenF1 Race Control verisine şu anda ulaşılamıyor." };
  function durumMesaji(durum) {
    if (durum === "bos" || durum === "yayimlanmadi" || durum === "oturum-yok" || durum === "yok-meeting") { return MESAJ.yayimlanmadi; }
    if (durum === "hata" || durum === "kisit") { return MESAJ.hata; }
    return "";
  }

  // OpenF1 oturum listesinden bu seansın oturumunu seçer (her seans AYRI oturum; adlar tam eşleşir, "Sprint" ≠ "Sprint Qualifying")
  function norm(x) { return String(x == null ? "" : x).trim().toLowerCase(); }
  function oturumSec(oturumlar, anahtar, planliBas) {
    var l = Array.isArray(oturumlar) ? oturumlar.filter(function (o) { return o && o.session_key != null; }) : [], bul = null;
    var pn = { FirstPractice: 1, SecondPractice: 2, ThirdPractice: 3 }[anahtar];
    function ad(o) { return norm(o.session_name); }
    if (pn) {
      bul = l.filter(function (o) { return ad(o) === "practice " + pn || ad(o) === "free practice " + pn || ad(o) === "fp" + pn; })[0] || null;
      if (!bul && !l.some(function (o) { return /^practice \d$/.test(ad(o)); })) {
        var pr = l.filter(function (o) { return norm(o.session_type) === "practice"; }).sort(function (a, b) { return Date.parse(a.date_start) - Date.parse(b.date_start); });
        if (pr.length >= pn) { bul = pr[pn - 1]; }
      }
    } else if (anahtar === "SprintQualifying" || anahtar === "SprintShootout") {
      bul = l.filter(function (o) { return /^sprint (qualifying|shootout)$/.test(ad(o)); })[0] || null;
    } else if (anahtar === "Sprint") {
      bul = l.filter(function (o) { return ad(o) === "sprint"; })[0] || null;
    } else if (anahtar === "Qualifying") {
      bul = l.filter(function (o) { return ad(o) === "qualifying"; })[0] || null;
    } else if (anahtar === "Race") {
      bul = l.filter(function (o) { return ad(o) === "race" && norm(o.session_type) === "race"; })[0] || null;
    }
    if (bul && planliBas != null && isFinite(Date.parse(bul.date_start)) && Math.abs(Date.parse(bul.date_start) - planliBas) > 12 * 3600 * 1000) { return null; }   // yanlış hafta sonu koruması
    return bul;
  }

  var YAYIN_GECIKME_MS = 30 * 60 * 1000;          // tarihsel (ücretsiz) pencere: seans bitişinden 30 dk sonra
  function yayimlandiMi(bitisMs, simdi) { return isFinite(bitisMs) && simdi >= bitisMs + YAYIN_GECIKME_MS; }

  var API = { normalize: normalize, siniflandir: siniflandir, kritikler: kritikler, listelenen: listelenen, ozet: ozet, satir: satir, trMetin: trMetin, durumMesaji: durumMesaji, MESAJ: MESAJ,
              oturumSec: oturumSec, yayimlandiMi: yayimlandiMi, TIPLER: TIPLER, IKON: IKON, YAYIN_GECIKME_MS: YAYIN_GECIKME_MS };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
  if (!kok) { return; }
  kok.RaceControl = API;

  // ---------- 2) VERİ KATMANI (tembel, tek seferlik, tarihsel) ----------
  var OF = kok.OpenF1Veri, JI = kok.JolpicaIstemci;
  if (!OF || !OF.sirali || !OF.meetingBul || !JI) { return; }
  var BOS_OMUR_MS = 10 * 60 * 1000;               // "henüz yok" yanıtı en çok 10 dk hatırlanır (kalıcı başarı sayılmaz)
  var TAZE_MS = 2 * 3600 * 1000;                  // seans bitişinden 2 sa sonra alınan veri kalıcı; daha önce alınan 30 dk sonra tazelenebilir
  var bekleyen = {};                              // eşzamanlı çift çağrıyı önler
  var bellekBos = {};                             // anahtar → zaman
  var cagri = [];                                 // test/rapor: yapılan race_control çağrı anahtarları

  function anahtar(yil, tur, seans) { return "rc-" + yil + "-r" + tur + "-" + seans; }
  function bul(f, d) { try { return f(); } catch (e) { return d; } }
  function ayikla(rows) {                         // yalnızca saklama boyutunu küçültür: arayüzde hiç gösterilmeyen gürültü satırları atılır
    return (rows || []).filter(function (r) { var c = siniflandir(r); return !c.gizli || c.alt === "PIT_EXIT_OPEN"; })
      .map(function (r) { return { date: r.date, lap_number: r.lap_number, category: r.category, flag: r.flag, scope: r.scope, sector: r.sector, driver_number: r.driver_number, message: r.message, qualifying_phase: r.qualifying_phase, session_key: r.session_key, meeting_key: r.meeting_key }; });
  }
  function eskileriTemizle(yil, tur) {            // son 3 tur dışındaki Race Control kayıtlarını sil (localStorage kotası)
    bul(function () {
      var onek = JI.ONEK + "rc-", sil = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i); if (!k || k.indexOf(onek) !== 0) { continue; }
        var m = /^rc-(\d{4})-r(\d+)-/.exec(k.slice(JI.ONEK.length)); if (!m) { continue; }
        if (Number(m[1]) !== yil || Number(m[2]) < tur - 2 || Number(m[2]) > tur + 1) { sil.push(k); }
      }
      sil.forEach(function (k) { localStorage.removeItem(k); });
    });
  }

  // hafta: HaftaVeri.haftaKur çıktısı, seans: hafta.seanslar öğesi. Dönüş: { durum, olaylar?, ozet?, oturum?, onbellekten? }
  // durum: ok | bos | yayimlanmadi | oturum-yok | yok-meeting | kisit | hata
  async function yukle(hafta, seans) {
    var yil = Number(hafta.sezon), tur = Number(hafta.tur), ak = anahtar(yil, tur, seans.anahtar), simdi = Date.now();
    var kayit = JI.oku(ak);
    if (kayit && kayit.veri && kayit.veri.durum === "ok" && kayit.veri.rows && kayit.veri.rows.length) {
      var yas = kayit.veri.alinma != null && kayit.veri.bitis != null ? kayit.veri.alinma - kayit.veri.bitis : TAZE_MS;
      if (yas >= TAZE_MS || simdi - kayit.t < YAYIN_GECIKME_MS) {                    // kalıcı (bitişten ≥2 sa sonra alınmış) ya da henüz taze
        var n0 = normalize(kayit.veri.rows, { sessionKey: kayit.veri.oturum && kayit.veri.oturum.anahtar });
        return { durum: "ok", olaylar: n0.olaylar, ozet: ozet(n0.olaylar), oturum: kayit.veri.oturum, onbellekten: true };
      }
    }
    if (bellekBos[ak] && simdi - bellekBos[ak].t < BOS_OMUR_MS) { return { durum: bellekBos[ak].durum, onbellekten: true }; }
    if (bekleyen[ak]) { return bekleyen[ak]; }
    bekleyen[ak] = (async function () {
      var bitis = seans.bitis.getTime();
      if (!yayimlandiMi(bitis, simdi)) { return { durum: "yayimlanmadi" }; }          // canlı (ücretli) pencere: istek YOK
      var mt = await OF.meetingBul(hafta);
      if (mt.durum !== "ok") { var d0 = mt.durum === "yok-meeting" ? "yok-meeting" : mt.durum; if (d0 !== "hata" && d0 !== "kisit") { bellekBos[ak] = { t: Date.now(), durum: d0 }; } return { durum: d0 }; }
      var mk = mt.meeting.meeting_key, oturum = null, ok = JI.oku("rc-oturum-" + yil + "-r" + tur + "-" + seans.anahtar);
      if (ok && ok.veri && ok.veri.session_key) { oturum = ok.veri; }
      else {
        var liste = bul(function () { var b = OF._bellek.oturumlar[mk]; return b && b.liste ? b.liste : null; }, null);   // openf1-veri.js'in oturum önbelleği (aynı format) — varsa ek çağrı yok
        var secilen = liste ? oturumSec(liste, seans.anahtar, seans.baslangic.getTime()) : null;
        if (!secilen) {
          var r = await OF.sirali("sessions?meeting_key=" + mk);
          if (r.tur === "kisit" || r.tur === "hata") { return { durum: r.tur }; }
          liste = r.tur === "ok" && Array.isArray(r.veri) ? r.veri : [];
          if (liste.length) { bul(function () { OF._bellek.oturumlar[mk] = { t: Date.now(), liste: liste }; }); }
          secilen = oturumSec(liste, seans.anahtar, seans.baslangic.getTime());
        }
        if (!secilen) { bellekBos[ak] = { t: Date.now(), durum: "oturum-yok" }; return { durum: "oturum-yok" }; }
        oturum = { session_key: secilen.session_key, meeting_key: secilen.meeting_key, ad: secilen.session_name, tur: secilen.session_type, date_end: secilen.date_end };
        JI.kaydet("rc-oturum-" + yil + "-r" + tur + "-" + seans.anahtar, oturum);
      }
      var oBitis = Date.parse(oturum.date_end); if (isFinite(oBitis)) { bitis = oBitis; }
      if (!yayimlandiMi(bitis, Date.now())) { return { durum: "yayimlanmadi" }; }     // oturumun GERÇEK bitişi: canlı pencerede istek yok
      cagri.push(ak);
      var rc = await OF.sirali("race_control?session_key=" + oturum.session_key);
      if (rc.tur === "kisit") { return { durum: "kisit" }; }
      if (rc.tur === "bos") { bellekBos[ak] = { t: Date.now(), durum: "bos" }; return { durum: "bos" }; }
      if (rc.tur !== "ok" || !Array.isArray(rc.veri)) { return { durum: "hata" }; }
      var n = normalize(rc.veri, { sessionKey: oturum.session_key, meetingKey: mk });
      if (!n.olaylar.length) { bellekBos[ak] = { t: Date.now(), durum: "bos" }; return { durum: "bos" }; }
      var bilgi = { anahtar: oturum.session_key, ad: oturum.ad, tur: oturum.tur };
      eskileriTemizle(yil, tur);
      JI.kaydet(ak, { durum: "ok", rows: ayikla(rc.veri), oturum: bilgi, alinma: Date.now(), bitis: bitis });
      return { durum: "ok", olaylar: n.olaylar, ozet: ozet(n.olaylar), oturum: bilgi, atilan: n.atilan };
    })();
    try { return await bekleyen[ak]; } finally { delete bekleyen[ak]; }
  }

  // SALT OKUNUR, AĞSIZ: yalnızca geçerli önbellek varsa sonuç (yukle ile aynı şekil); yoksa null. Başka modüller (Yarışı Kaçırdıysan v2) ağ çağrısı yapmadan zenginleşmek için kullanır.
  function oku(hafta, seans) {
    var ak = anahtar(Number(hafta.sezon), Number(hafta.tur), seans.anahtar), kayit = JI.oku(ak), simdi = Date.now();
    if (kayit && kayit.veri && kayit.veri.durum === "ok" && kayit.veri.rows && kayit.veri.rows.length) {
      var yas = kayit.veri.alinma != null && kayit.veri.bitis != null ? kayit.veri.alinma - kayit.veri.bitis : TAZE_MS;
      if (yas >= TAZE_MS || simdi - kayit.t < YAYIN_GECIKME_MS) {
        var n0 = normalize(kayit.veri.rows, { sessionKey: kayit.veri.oturum && kayit.veri.oturum.anahtar });
        return { durum: "ok", olaylar: n0.olaylar, ozet: ozet(n0.olaylar), oturum: kayit.veri.oturum, onbellekten: true };
      }
    }
    return null;
  }
  kok.RaceControlVeri = { yukle: yukle, oku: oku, anahtar: anahtar, BOS_OMUR_MS: BOS_OMUR_MS, _cagri: cagri };
})(typeof window !== "undefined" ? window : null);
