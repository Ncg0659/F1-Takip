/* Program değişikliği giriş/doğrulama yardımcısı. SAF: DOM/ağ/zamanlayıcı/depolama YOK; Node'da test edilir. Ücretsiz, yeni API yok.
   Amaç: program-degisiklik.js'e ELLE girilen kayıtlarda hatayı azaltmak. Otomatik sisteme çevirmez; kaynak yine insanın girdiği resmi bilgidir.
   programDegisikligiOlustur(girdi[, secenek]) → { ok:true, kayit } | { ok:false, hatalar:[...] }   (geçersizse KAYIT ÜRETMEZ, tahmin yapmaz)
     girdi: season, round, session, type, source, verified, revisedTimeLocal | revisedTimeTR ("YYYY-MM-DDTHH:MM"), trackTimezone (IANA),
            effectiveFrom (ISO, saat dilimi/Z ZORUNLU), expiry (ISO, ops.), title, shortText (ops.), reason ("hava" ops.), pilot[], team[], track (ops.)
     secenek.hafta: (ops.) HaftaVeri.haftaKur çıktısı → seansın o hafta sonunda var olduğu ve pist saat diliminin tutarlı olduğu da denetlenir.
   ekle(liste, girdi[, secenek]) → aynı sonuç; geçerliyse listeye ekler, AYNI kayıt ikinci kez eklenmez.
   kontrolListe(liste) → elle yazılmış girdilerdeki sorunlar (eksik alan, geçersiz tip/zaman, tekrar) — sessizce yutulmak yerine raporlanır.
   Saat: sabit GMT farkı YOK; IANA saat dilimi + Intl ile yerel→UTC çevrilir (DST/IANA, mevcut sistemle aynı yaklaşım). Yaz saati boşluğunda (olmayan yerel saat) ya da
   çift anlamlı saatte (tekrar eden saat) kayıt REDDEDİLİR. */
(function (kok) {
  "use strict";
  var TIPLER = ["DELAYED", "POSTPONED", "NEW_TIME_CONFIRMED", "CANCELLED"];
  var SEANSLAR = ["FirstPractice", "SecondPractice", "ThirdPractice", "SprintQualifying", "SprintShootout", "Sprint", "Qualifying", "Race"];
  var TAKMA = { FP1: "FirstPractice", FP2: "SecondPractice", FP3: "ThirdPractice", SQ: "SprintQualifying", Q: "Qualifying" };
  var RESMI = ["FIA", "Formula 1"];
  var TR_TZ = "Europe/Istanbul";

  function tzGecerli(tz) {
    if (typeof tz !== "string" || !tz || tz.indexOf("/") < 0 && tz !== "UTC") { return false; }
    try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch (e) { return false; }
  }
  function parcalar(tz, t) {
    var f = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    var o = {}; f.formatToParts(new Date(t)).forEach(function (p) { o[p.type] = parseInt(p.value, 10); });
    return o;
  }
  function yerelMs(tz, t) { var p = parcalar(tz, t); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second); }
  // "YYYY-MM-DDTHH:MM" (tz'de duvar saati) → UTC ms. Dönüş: { t } | { hata }
  function yerelden(metin, tz) {
    var m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/.exec(String(metin || "").trim());
    if (!m) { return { hata: "yerel saat 'YYYY-MM-DDTHH:MM' biçiminde olmalı (saat dilimi eki YOK): " + metin }; }
    var Y = +m[1], Mo = +m[2], D = +m[3], H = +m[4], Mi = +m[5];
    if (Mo < 1 || Mo > 12 || D < 1 || D > 31 || H > 23 || Mi > 59) { return { hata: "geçersiz tarih/saat: " + metin }; }
    var duvar = Date.UTC(Y, Mo - 1, D, H, Mi);
    if (new Date(duvar).getUTCDate() !== D) { return { hata: "geçersiz tarih: " + metin }; }
    var adaylar = [];
    [-36, 36].forEach(function (sa) {                                    // DST sınırının iki yanındaki ofsetleri dene
      var o = yerelMs(tz, duvar + sa * 3600000) - (duvar + sa * 3600000);
      var t = duvar - o;
      if (yerelMs(tz, t) === duvar && adaylar.indexOf(t) < 0) { adaylar.push(t); }
    });
    if (adaylar.length === 0) { return { hata: "bu yerel saat " + tz + " için mevcut değil (yaz saati geçişi): " + metin }; }
    if (adaylar.length > 1) { return { hata: "bu yerel saat " + tz + " için iki kez yaşanıyor (kış saati geçişi), belirsiz: " + metin }; }
    return { t: adaylar[0] };
  }
  // Saat dilimi eki (Z / ±hh:mm) ZORUNLU ISO → ms
  function zamanli(metin) {
    var s = String(metin == null ? "" : metin).trim();
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(s)) { return null; }
    var t = Date.parse(s); return isNaN(t) ? null : t;
  }
  function metinTemiz(x, ad, maks, hata) {
    if (x == null || x === "") { return null; }
    if (typeof x !== "string") { hata.push(ad + " metin olmalı"); return null; }
    var s = x.replace(/\s+/g, " ").trim();
    if (/[<>]/.test(s)) { hata.push(ad + " '<' veya '>' içeremez"); return null; }
    if (s.length > maks) { hata.push(ad + " en çok " + maks + " karakter olmalı"); return null; }
    return s || null;
  }
  function seansAnahtar(s) { var a = String(s == null ? "" : s).trim(); a = TAKMA[a.toUpperCase()] || a; return SEANSLAR.indexOf(a) >= 0 ? a : null; }

  function anahtar(k) { return [k.sezon, k.tur, k.seans, k.tip, Date.parse(k.zaman), k.yeniBaslangic ? Date.parse(k.yeniBaslangic) : ""].join("|"); }

  function olustur(g, sec) {
    var hata = [], h = []; g = g || {}; sec = sec || {};
    function e(m) { hata.push(m); }
    var season = g.season, round = g.round;
    if (!(typeof season === "number" && isFinite(season) && Math.floor(season) === season && season >= 1950 && season <= 2100)) { e("season geçerli bir yıl (tam sayı) olmalı"); }
    if (!(typeof round === "number" && isFinite(round) && Math.floor(round) === round && round >= 1 && round <= 30)) { e("round 1–30 arası tam sayı olmalı"); }
    var seans = seansAnahtar(g.session); if (!seans) { e("session desteklenmiyor: " + g.session + " (" + SEANSLAR.join(", ") + ")"); }
    var tip = typeof g.type === "string" ? g.type.trim().toUpperCase() : "";
    if (TIPLER.indexOf(tip) < 0) { e("type desteklenmiyor: " + g.type + " (" + TIPLER.join(", ") + ")"); }
    if (g.verified !== true) { e("verified === true olmadan resmi override üretilmez (doğrulanmamış bilgi program-degisiklik.js'e girmez)"); }
    var kaynak = typeof g.source === "string" ? g.source.trim() : "";
    if (!kaynak) { e("source (kaynak) zorunlu: " + RESMI.join(" | ") + " ya da açık bir kaynak adı"); }
    var eff = zamanli(g.effectiveFrom);
    if (eff == null) { e("effectiveFrom saat dilimiyle birlikte ISO olmalı (ör. 2026-10-10T10:15:00Z)"); }
    var bitis = null;
    if (g.expiry != null && g.expiry !== "") {
      bitis = zamanli(g.expiry);
      if (bitis == null) { e("expiry saat dilimiyle birlikte ISO olmalı"); }
      else if (eff != null && bitis <= eff) { e("expiry, effectiveFrom'dan sonra olmalı"); }
    }
    var yerelVar = g.revisedTimeLocal != null && g.revisedTimeLocal !== "", trVar = g.revisedTimeTR != null && g.revisedTimeTR !== "";
    var tz = g.trackTimezone != null && g.trackTimezone !== "" ? g.trackTimezone : null;
    if (tz != null && !tzGecerli(tz)) { e("trackTimezone geçerli bir IANA saat dilimi değil (tahmin yapılmaz): " + tz); tz = false; }
    var yeni = null;
    if (tip === "NEW_TIME_CONFIRMED") {
      if (!yerelVar && !trVar) { e("NEW_TIME_CONFIRMED için yeni saat zorunlu (revisedTimeLocal + trackTimezone, ya da revisedTimeTR)"); }
      else if (yerelVar && trVar) { e("revisedTimeLocal ve revisedTimeTR birlikte verilemez (tek kaynak olsun)"); }
      else if (yerelVar) {
        if (tz == null) { e("revisedTimeLocal için trackTimezone zorunlu"); }
        else if (tz) { var r = yerelden(g.revisedTimeLocal, tz); if (r.hata) { e(r.hata); } else { yeni = r.t; } }
      } else { var r2 = yerelden(g.revisedTimeTR, TR_TZ); if (r2.hata) { e(r2.hata); } else { yeni = r2.t; } }
      if (yeni != null && eff != null && yeni < eff) { e("yeni başlangıç, açıklama anından (effectiveFrom) önce olamaz"); }
    } else if (tip && TIPLER.indexOf(tip) >= 0) {
      if (yerelVar || trVar) { e(tip + " kaydı yeni saat kabul etmez (yeni saat için NEW_TIME_CONFIRMED kullan)"); }
    }
    var baslik = metinTemiz(g.title, "title", 120, hata), metin = metinTemiz(g.shortText, "shortText", 240, hata);
    var neden = g.reason == null || g.reason === "" ? null : String(g.reason).trim().toLowerCase();
    if (neden !== null && neden !== "hava") { e("reason yalnızca 'hava' olabilir (ya da boş)"); neden = null; }
    function liste(x, ad) { if (x == null) { return []; } if (!Array.isArray(x) || x.some(function (i) { return typeof i !== "string" || !i.trim(); })) { e(ad + " metin dizisi olmalı"); return []; } return x.map(function (i) { return i.trim(); }); }
    var pilot = liste(g.pilot, "pilot"), takim = liste(g.team, "team");
    var pist = g.track == null || g.track === "" ? null : (typeof g.track === "string" ? g.track.trim() : (e("track metin olmalı"), null));
    // Hafta takvimiyle çapraz denetim (ops.)
    if (sec.hafta && !hata.length) {
      var hf = sec.hafta;
      if (Number(hf.sezon) !== season || Number(hf.tur) !== round) { e("hafta bilgisi bu sezon/tur ile eşleşmiyor"); }
      else if (!(hf.seanslar || []).some(function (x) { return x.anahtar === seans; })) { e(seans + " bu hafta sonunda yok"); }
      else if (tz && hf.pistTz && hf.pistTz !== tz) { e("trackTimezone (" + tz + ") bu pistin saat diliminden (" + hf.pistTz + ") farklı"); }
    }
    if (hata.length) { return { ok: false, hatalar: hata }; }
    var kayit = { id: season + "-" + round + "-" + seans + "-" + tip + "-" + new Date(eff).toISOString().replace(/[-:.]/g, "").slice(0, 13),
      sezon: season, tur: round, seans: seans, tip: tip, zaman: new Date(eff).toISOString(), kaynak: kaynak, dogrulandi: true };
    if (yeni != null) { kayit.yeniBaslangic = new Date(yeni).toISOString(); }
    if (bitis != null) { kayit.bitis = new Date(bitis).toISOString(); }
    if (baslik) { kayit.baslik = baslik; }
    if (metin) { kayit.metin = metin; }
    if (neden) { kayit.neden = neden; }
    if (pilot.length) { kayit.pilot = pilot; }
    if (takim.length) { kayit.takim = takim; }
    if (pist) { kayit.pist = pist; }
    return { ok: true, kayit: kayit };
  }

  function ekle(liste, g, sec) {
    var r = olustur(g, sec);
    if (!r.ok) { return r; }
    if (!Array.isArray(liste)) { return { ok: false, hatalar: ["hedef liste bir dizi değil"] }; }
    var k = anahtar(r.kayit);
    var var_ = liste.some(function (x) { return x && (x.id === r.kayit.id || (x.zaman && anahtar(x) === k)); });
    if (var_) { return { ok: false, tekrar: true, hatalar: ["aynı kayıt zaten var: " + r.kayit.id] }; }
    liste.push(r.kayit); return r;
  }

  // Elle yazılmış listede: eksik sezon/tur/seans, geçersiz tip/zaman, yeni saat tutarsızlığı, tekrar
  function kontrolListe(liste) {
    var sorun = [], goruldu = {};
    (liste || []).forEach(function (x, i) {
      var ad = "#" + i + (x && x.id ? " (" + x.id + ")" : ""), p = [];
      if (!x || typeof x !== "object") { sorun.push(ad + ": kayıt nesne değil"); return; }
      if (!(Number(x.sezon) > 0)) { p.push("sezon eksik"); }
      if (!(Number(x.tur) > 0)) { p.push("tur eksik"); }
      if (!seansAnahtar(x.seans)) { p.push("seans eksik/geçersiz"); }
      var tip = String(x.tip || "").toUpperCase();
      if (!tip) { p.push("tip eksik"); }
      if (isNaN(Date.parse(x.zaman))) { p.push("zaman eksik/geçersiz"); }
      if (tip === "NEW_TIME_CONFIRMED" && isNaN(Date.parse(x.yeniBaslangic))) { p.push("NEW_TIME_CONFIRMED için yeniBaslangic eksik"); }
      if (tip === "CANCELLED" && x.yeniBaslangic) { p.push("CANCELLED yeni saat taşıyamaz"); }
      if (x.dogrulandi === false) { p.push("dogrulandi:false (doğrulanmamış kayıt resmi override sayılmaz)"); }
      if (!p.length) { var k = anahtar(x); if (goruldu[k] || (x.id && goruldu["id:" + x.id])) { p.push("tekrar eden kayıt"); } goruldu[k] = 1; if (x.id) { goruldu["id:" + x.id] = 1; } }
      p.forEach(function (m) { sorun.push(ad + ": " + m); });
    });
    return sorun;
  }

  var API = { programDegisikligiOlustur: olustur, ekle: ekle, kontrolListe: kontrolListe, yerelden: yerelden, TIPLER: TIPLER, SEANSLAR: SEANSLAR };
  if (kok) { kok.ProgramYardimci = API; kok.programDegisikligiOlustur = olustur; }
  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
})(typeof window !== "undefined" ? window : null);
