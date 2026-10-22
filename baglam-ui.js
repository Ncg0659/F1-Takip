/* Bağlamsal bilgi köprüsü: hafta-baglam.js (saf hesap) ile uygulamanın mevcut verisi arasında.
   YENİ fetch / setInterval / setTimeout YOK: yalnızca mevcut Race Feed deposunu (localStorage, RaceFeed.yukle) ve takvim önbelleğini OKUR.
   Çıktı HTML metnidir; çizimi çağıran ekran yapar (Yarış Haftası, Sprint, Yarış Günü, pilot/takım/pist profilleri). */
(function (kok) {
  "use strict";
  var HB = kok.HaftaBaglam, HV = kok.HaftaVeri;
  var S = { anahtar: null, ctx: null };

  function bul(f, d) { try { return f(); } catch (e) { return d; } }

  function pilotHarita() {
    var h = {};
    var l = bul(function () { return typeof sezonPilotlar !== "undefined" ? sezonPilotlar : []; }, []);
    l.forEach(function (k) {
      var d = k.Driver || {}, c = (k.Constructors || [])[(k.Constructors || []).length - 1];
      if (d.familyName) { h[d.familyName] = { kod: d.code || null, takim: c ? c.name : null }; }
    });
    return h;
  }
  function depoHam(anahtar) { return bul(function () { return localStorage.getItem("f1-feed-v1-" + anahtar); }, null); }

  // hafta: HaftaVeri.haftaKur çıktısı. Aynı depo içeriği + aynı hafta ise ayrıştırma önbellekten gelir (Yarış Günü saniyede bir çağırır).
  function ctx(hafta) {
    var kS = hafta.sezon + "-" + hafta.tur + "-sprint", kR = hafta.sezon + "-" + hafta.tur;
    var hS = depoHam(kS), hR = depoHam(kR), st = (kok.PROGRAM_DEGISIKLIK || []);
    var ph = bul(function () { return typeof sezonPilotlar !== "undefined" ? sezonPilotlar.length : 0; }, 0);
    var anahtar = [kR, hS ? hS.length : 0, hR ? hR.length : 0, st.length, ph].join("|");
    if (S.anahtar === anahtar && S.ctx && S.ctx.hafta.tur === hafta.tur) { S.ctx.hafta = hafta; return S.ctx; }
    var feed = { Sprint: [], Race: [] };
    if (kok.RaceFeed) {
      feed.Sprint = hafta.sprintMi ? (bul(function () { return kok.RaceFeed.yukle(kS).olaylar; }, []) || []) : [];
      feed.Race = bul(function () { return kok.RaceFeed.yukle(kR).olaylar; }, []) || [];
    }
    S.anahtar = anahtar;
    S.ctx = { sezon: hafta.sezon, tur: hafta.tur, hafta: hafta, statik: st, feed: feed, pilotHarita: pilotHarita() };
    return S.ctx;
  }

  // Seansın program override'ı (hafta-state.js `program` alanı); yoksa null
  function program(hafta, seans, simdi) {
    if (!HB || !hafta || !seans) { return null; }
    return bul(function () { return HB.programDurumu(ctx(hafta), seans.anahtar, simdi); }, null);
  }

  function seansAdi(hafta, anahtar) { var s = (hafta.seanslar || []).filter(function (x) { return x.anahtar === anahtar; })[0]; return s ? s.ad : anahtar; }
  function planliBas(hafta, anahtar) { var s = (hafta.seanslar || []).filter(function (x) { return x.anahtar === anahtar; })[0]; return s ? s.baslangic.getTime() : null; }

  function html(kartlar, hafta, opts) {
    opts = opts || {};
    return kartlar.map(function (k) {
      return HB.kartHtml(k, { pistTz: hafta.pistTz, seansAd: opts.seansAd === false ? "" : seansAdi(hafta, k.session), planliBas: k.session ? planliBas(hafta, k.session) : null, kisa: !!opts.kisa });
    }).join("");
  }

  // Bir seans kartı için: program kartları + Race Feed canlı durum kartları (aynı bilgi iki kez gösterilmez)
  function seansKartlari(hafta, seans, st, simdi) {
    if (!HB) { return { html: "", var: false, kartlar: [] }; }
    simdi = simdi == null ? Date.now() : simdi;
    var c = bul(function () { return ctx(hafta); }, null); if (!c) { return { html: "", var: false, kartlar: [] }; }
    var l = bul(function () { return HB.kartlar(c, { tip: "seans", seans: seans.anahtar }, simdi); }, []);
    var durum = bul(function () { return HB.durumKartlari(st, seans, hafta, simdi); }, []);
    var programTipleri = l.filter(function (k) { return k.program; }).map(function (k) { return k.type; });
    var programVar = programTipleri.length > 0;
    // program kartı varsa feed'den doğan "gecikti" durum kartı tekrar edilmez; durum kartı varken hava kartı (neden satırı zaten orada) tekrar edilmez
    durum = durum.filter(function (k) { return !(programVar && k.type === "SESSION_DELAYED"); });
    var durumVar = durum.some(function (k) { return k.type === "SESSION_DELAYED" || k.type === "RED_FLAG" || k.type === "SESSION_STOPPED"; });
    l = l.filter(function (k) { return !(durumVar && k.type === "WEATHER"); });
    var hepsi = l.concat(durum);
    return { html: html(hepsi, hafta, { seansAd: true }), var: hepsi.length > 0, kartlar: hepsi };
  }

  // Yarış Haftası üstünde kısa özet: yalnızca program değişiklikleri (tam kart ilgili seansın içinde)
  function haftaOzeti(hafta, simdi) {
    if (!HB) { return ""; }
    simdi = simdi == null ? Date.now() : simdi;
    var l = bul(function () { return HB.kartlar(ctx(hafta), { tip: "hafta" }, simdi); }, []);
    if (!l.length) { return ""; }
    return "<div class='bk-hafta' role='status'><div class='bk-hafta-baslik'>Program değişikliği</div>" + html(l, hafta, { kisa: true }) + "</div>";
  }

  // Aktif hafta sonu: seansları ±24 saat içinde olan yarış (profil ekranları yalnızca o hafta sonunun bilgisini gösterir)
  function aktifHafta(simdi) {
    simdi = simdi == null ? Date.now() : simdi;
    var yl = bul(function () { return typeof sezonYarislar !== "undefined" ? sezonYarislar : []; }, []);
    for (var i = 0; i < yl.length; i++) {
      var h = bul(function () { return HV.haftaKur(yl[i], "f1"); }, null); if (!h || !h.seanslar.length) { continue; }
      var b = h.seanslar[0].baslangic.getTime() - 24 * 3600000, e = h.seanslar[h.seanslar.length - 1].bitis.getTime() + 24 * 3600000;
      if (simdi >= b && simdi <= e) { return h; }
    }
    return null;
  }

  // Profil ekranları: tip "pilot" (kod) | "takim" (ad) | "pist" (circuitId)
  function profil(tip, id, simdi) {
    if (!HB) { return ""; }
    simdi = simdi == null ? Date.now() : simdi;
    var h = aktifHafta(simdi); if (!h) { return ""; }
    if (tip === "pist" && h.pistId !== id) { return ""; }
    var ekran = tip === "pilot" ? { tip: "pilot", kod: id } : (tip === "takim" ? { tip: "takim", ad: id } : { tip: "pist", id: id });
    var l = bul(function () { return HB.kartlar(ctx(h), ekran, simdi); }, []);
    if (!l.length) { return ""; }
    return "<section class='bk-profil' aria-label='Bu hafta sonu için güncel bilgi'><h3 class='bk-profil-baslik'>Bu hafta sonu · " + String(h.ad || "").replace(/[<>&]/g, "") + "</h3>" + html(l, h, {}) + "</section>";
  }

  kok.BaglamUI = { ctx: ctx, program: program, seansKartlari: seansKartlari, haftaOzeti: haftaOzeti, profil: profil, aktifHafta: aktifHafta };
})(typeof window !== "undefined" ? window : null);
