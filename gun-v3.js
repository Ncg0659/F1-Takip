/* UI v3 — Yarış Günü / LIVE RACE CONTROL sunum katmanı.
   YALNIZ sunum: durum, veri, fetch, zamanlayıcı YOK. index.html'deki mevcut 1 sn'lik gunSaatGuncelle çağrısından render() tetiklenir.
   Girdi: window.GunCtx() (index.html; mevcut durum çıktıları). Canlı tur sayacı / canlı sıralama verisi olmadığı için ÜRETİLMEZ. */
(function () {
  var V3 = window.V3, esc = V3.esc;
  var G = { aktif: "sonuc", feedAcik: false, podyum: [], sekImza: "", panelK: "" };
  var A7 = [["olay", "OLAYLAR", "SeansOlaylari", "so"], ["tur", "TURLAR", "TurAnalizi", "ta"], ["gecis", "GEÇİŞ", "Gecisler", "gc"], ["pit", "PİT", "Pitler", "pt"], ["hava", "HAVA", "SeansHava", "sh"]];
  var TERIM_KISA = { "kirmizi-bayrak": "Kırmızı bayrakta ne olur?", "vsc": "VSC nedir?", "safety-car": "Safety Car nedir?", "restart": "Restart nedir?", "start": "Start nedir?", "tur-farki": "Tur farkı nedir?" };
  function $(id) { return document.getElementById(id); }

  // ---- CANONICAL STATE: hero rozeti + durum şeridi + kritik çip TEK kaynaktan ----
  // Kaynak (yeni durum mantığı YOK): GunCtx() = HaftaState.durum(Race) çıktısı (st.chip = çözülmüş SC/VSC) + gunFeedDurumu() (fst) + program (pg).
  // Hero rozeti (index.html gunDurumCiz) da bu fonksiyonu çağırır; geçmiş feed olayı ham taranmaz.
  // rozet: [css sınıfı, etiket, ipucu]
  var FEED = {
    POSTPONED: ["POSTPONED", "bekle", "Postponed", "Yarış ertelendi", "start", "canli"],
    CANCELLED: ["CANCELLED", "kirmizi", "Cancelled", "Yarış iptal edildi", "start", "canli"],
    DELAYED: ["DELAYED", "bekle", "Delayed", "Başlangıç gecikti", "start", "once"],
    RED_FLAG: ["RED_FLAG", "kirmizi", "Red flag", "Yarış durduruldu", "kirmizi-bayrak", "canli"],
    SESSION_STOPPED: ["STOPPED", "bekle", "Stopped", "Yarış durduruldu", "kirmizi-bayrak", "canli"],
    RESUMED: ["RESUMED", "live", "Resumed", "Yarış yeniden başladı", "restart", "canli"]
  };
  function K(anahtar, ton, etiket, baslik, terim, faz, rozetSinif, ipucu) {
    return { anahtar: anahtar, ton: ton, baslik: baslik, terim: terim, faz: faz, etiket: etiket, rozet: [rozetSinif || ton, etiket, ipucu || ""] };
  }
  function kanonik(c) {
    if (!c || !c.yaris) { return null; }
    var chip = c.st && c.st.chip, f = c.fst && FEED[c.fst.durum];
    if (f && !(c.fst.durum === "RESUMED" && chip)) {      // RESUMED'dan SONRA yeni SC/VSC çıktıysa güncel olan chip'tir
      return K(f[0], f[1], f[2], f[3], f[4], f[5], f[1] === "kirmizi" ? "kirmizi" : (f[1] === "live" ? "live" : (f[0] === "STOPPED" ? "sc" : "bekle")), "Race Feed'e göre");
    }
    if (c.fark > 0) {
      if (c.pg && c.pg.tip === "NEW_TIME_CONFIRMED") { return K("RESCHEDULED", "bekle", "Rescheduled", "Başlangıç saati değişti", "start", "once", "bekle", "Program değişikliği"); }
      return c.fark < 12 * 3600 * 1000 ? K("RACE_DAY", "yaklasan", "Race day", "Yarış başlamadı", "start", "once", "yakinda") : K("UPCOMING", "yaklasan", "Upcoming", "Yarış başlamadı", "start", "once", "yakinda");
    }
    if (c.sonuc) { return K("COMPLETED", "bitti", "Finished", "Yarış tamamlandı", "tur-farki", "bitti", "bitti"); }
    if (-c.fark < 3 * 3600 * 1000) {
      if (chip === "VSC") { return K("VSC", "bekle", "VSC", "VSC devrede", "vsc", "canli", "sc", "Race Feed'e göre"); }
      if (chip === "SAFETY CAR") { return K("SAFETY_CAR", "bekle", "Safety car", "Safety Car devrede", "safety-car", "canli", "sc", "Race Feed'e göre"); }
      return K("LIVE", "live", "Live", "Yarış devam ediyor", "safety-car", "canli", "live");
    }
    return K("PENDING", "bekle", "Results pending", "Sonuçlar bekleniyor", "tur-farki", "bitti", "bekle");
  }
  var ALT = { RED_FLAG: "Yeniden başlama bekleniyor", STOPPED: "Yeniden başlama bekleniyor" };
  var DURUM_ALT = { LIVE: 1, SAFETY_CAR: 1, VSC: 1, RESUMED: 1, RACE_DAY: 1, UPCOMING: 1, PENDING: 1, RESCHEDULED: 1, DELAYED: 1 };
  function kisa(s, n) { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; }

  // tek durum bloğu: kod (hero rozetiyle AYNI etiket) + başlık + (gerekirse) tek alt satır; kritik bağlam kartları (#gun-baglam) aynı bloğun içinde
  function serit(c, d) {
    var kap = $("gun-v3-serit"), blok = $("gun-v3-durum"); if (!kap || !blok) { return; }
    var bg = $("gun-baglam"), bgVar = !!(bg && bg.children.length), sayac = $("gun-sayac"), satir = "";
    if (ALT[d.anahtar]) { satir = bgVar ? "" : ALT[d.anahtar]; }
    else if (DURUM_ALT[d.anahtar]) { satir = (d.anahtar === "DELAYED" && bgVar) ? "" : kisa(sayac && sayac.textContent, 110); }
    var anahtar = d.anahtar + "|" + d.ton;
    if (kap.dataset.k !== anahtar) {
      kap.dataset.k = anahtar;
      kap.innerHTML = "<span class='g3-kod'>" + esc(d.etiket.toUpperCase()) + "</span><b class='g3-baslik'>" + esc(d.baslik) + "</b><span class='g3-satir'></span>";
    }
    blok.setAttribute("data-k", d.anahtar); blok.setAttribute("data-ton", d.ton);
    var s = kap.querySelector(".g3-satir");
    if (s && s.textContent !== satir) { s.textContent = satir; }
  }

  // ---- özet çipleri: YALNIZ gerçek/yüklenmiş veri ----
  function modDurum(mod, h, s) {
    var m = window[mod], id = h.sezon + "-" + h.tur + "-" + s.anahtar, d = m && m._durum && m._durum[id];
    return d && d.durum === "ok" ? d : null;
  }
  function cipler(c, d) {
    var out = [];
    if (c.sonuc) { G.podyum.slice(0, 3).forEach(function (r) { out.push(V3.cip("P" + r.sira, r.kod, "p")); }); }
    if (d.anahtar === "VSC" || d.anahtar === "SAFETY_CAR") { out.push(V3.cip(d.anahtar === "VSC" ? "VSC" : "SAFETY CAR", "", "durum")); }
    if (c.r) {
      var h = c.r.h, s = c.r.s;
      var o = modDurum("SeansOlaylari", h, s);
      if (o && o.veri && o.veri.ozet && o.veri.ozet.kritik > 0) { out.push(V3.cip(o.veri.ozet.kritik, "KRİTİK OLAY")); }
      var g = modDurum("Gecisler", h, s);
      if (g && g.veri && g.veri.ozet && g.veri.ozet.toplam > 0) { out.push(V3.cip(g.veri.ozet.toplam, "GEÇİŞ KAYDI")); }
      var p = modDurum("Pitler", h, s);
      if (p && p.veri && p.veri.ozet && p.veri.ozet.toplam > 0) { out.push(V3.cip(p.veri.ozet.toplam, "PİT")); }
    }
    var hv = $("gun-hava");
    if (!c.sonuc && hv && hv.dataset.sicak) { out.push(V3.cip(hv.dataset.sicak + "°C", "HAVA")); }
    return out;
  }
  function cipYaz(c, d) {
    var kap = $("gun-v3-cipler"); if (!kap) { return; }
    var h = V3.cipSerit(cipler(c, d), "Yarış özeti");
    var imza = h;
    if (kap.dataset.imza !== imza) { kap.dataset.imza = imza; kap.innerHTML = h; }
  }

  // ---- pist silüeti (mevcut GeoJSON'dan üretilmiş PistSiluetleri; yeni veri yok) ----
  function pist(c) {
    var kap = $("gun-v3-pist"); if (!kap || kap.dataset.id || !c.r) { return; }
    var id = c.r.h.pistId, PS = window.PistSiluetleri;
    kap.dataset.id = id || "-";
    if (!PS || !PS.YOL || !PS.YOL[id]) { kap.hidden = true; return; }
    kap.innerHTML = "<svg class='g3-svg' viewBox='0 0 300 200' role='img' aria-label='Pist silueti (dekoratif çizim)' preserveAspectRatio='xMidYMid meet'><path class='g3-hat-alt' d='" + PS.YOL[id] + "'/><path class='g3-hat' d='" + PS.YOL[id] + "'/></svg>";
  }

  // ---- ayrıntı sekmeleri (tek seçili); A7 modülleri aynen, lazy-load modülün kendi düğmesiyle ----
  function a7Liste(c) {
    var out = [];
    if (!c.sonuc || !c.r) { return out; }
    A7.forEach(function (m) {
      var mod = window[m[2]]; if (!mod) { return; }
      var x = ""; try { x = mod.html(c.r.h, c.r.s, "tamamlandi", c.st); } catch (e) { x = ""; }
      if (x) { out.push({ k: m[0], ad: m[1], on: m[3], html: x }); }
    });
    return out;
  }
  function panelGoster() {
    var sp = $("gun-sonuc-panel"), ap = $("gun-a7-panel"); if (!sp || !ap) { return; }
    var sonuc = G.aktif === "sonuc";
    sp.hidden = !sonuc; ap.hidden = sonuc;
    if (sonuc) { ap.innerHTML = ""; G.panelK = ""; }
  }
  function sekmeler(c) {
    var bar = $("gun-v3-sek"); if (!bar) { return; }
    var liste = a7Liste(c), imza = liste.map(function (x) { return x.k; }).join(",") + "|" + G.aktif;
    if (!liste.length) {
      if (bar.innerHTML) { bar.innerHTML = ""; }
      if (G.aktif !== "sonuc") { G.aktif = "sonuc"; }
      panelGoster(); G.sekImza = ""; return;
    }
    if (!liste.some(function (x) { return x.k === G.aktif; }) && G.aktif !== "sonuc") { G.aktif = "sonuc"; }
    var yeni = liste.map(function (x) { return x.k; }).join(",") + "|" + G.aktif;
    if (G.sekImza !== yeni) {
      G.sekImza = yeni;
      bar.innerHTML = V3.sekmeler([{ k: "sonuc", ad: "SONUÇ" }].concat(liste), G.aktif, "gsek", "Yarış ayrıntıları");
    }
    panelGoster();
    if (G.aktif !== "sonuc" && G.panelK !== G.aktif) {      // modül kutusu yalnız sekme değişince kurulur (modülün kendi durumu ezilmez)
      var m = liste.filter(function (x) { return x.k === G.aktif; })[0], ap = $("gun-a7-panel");
      if (m && ap) {
        ap.innerHTML = m.html; G.panelK = G.aktif;
        var b = ap.querySelector("[data-" + m.on + "-act='ac']");
        if (b && b.getAttribute("aria-expanded") === "false") { b.click(); }
      }
    }
  }

  // ---- İzlerken öğren: duruma göre TEK mini kart (mevcut sözlükten) ----
  var KART_DURUM = { SAFETY_CAR: 1, VSC: 1, RED_FLAG: 1, STOPPED: 1, RESUMED: 1 };
  function ogren(c, d) {
    var kap = $("gun-ogren"); if (!kap) { return; }
    var S = window.ICERIK && window.ICERIK.sozluk && window.ICERIK.sozluk.terimler, t = S && S[d.terim];
    var anahtar = t && KART_DURUM[d.anahtar] ? d.terim : "";        // yalnız anlamlı bağlam: SC / VSC / kırmızı bayrak / restart. LIVE, UPCOMING, COMPLETED… → kart yok
    if (!anahtar) { t = null; }
    if (kap.dataset.k === anahtar) { return; }
    kap.dataset.k = anahtar;
    if (!t) { kap.innerHTML = ""; kap.hidden = true; return; }
    kap.hidden = false;
    kap.innerHTML = "<b class='g3-ogr-b'>İZLERKEN ÖĞREN</b><div class='g3-ogr-g'><div><strong>" + esc(TERIM_KISA[d.terim] || (t.ad + " nedir?")) + "</strong><p>" + esc(t.kisa || "") + "</p></div>" +
      "<button type='button' class='g3-mini' data-gun-terim='" + esc(d.terim) + "'>DETAY</button></div>";
  }

  function render() {
    var c = window.GunCtx && window.GunCtx(); if (!c || !c.yaris) { return; }
    var d = kanonik(c);
    pist(c); serit(c, d); cipYaz(c, d); sekmeler(c); ogren(c, d);
    var kok = $("sekme-gun"); if (kok) { kok.setAttribute("data-g3-faz", d.faz); kok.setAttribute("data-g3-ton", d.ton); }
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-act='gsek']");
    if (t && $("sekme-gun") && $("sekme-gun").contains(t)) {
      var k = t.getAttribute("data-v"); if (k === G.aktif) { return; }
      G.aktif = k; G.sekImza = ""; G.panelK = ""; render(); return;
    }
    var f = e.target.closest && e.target.closest("[data-gun-feed]");
    if (f) { G.feedAcik = !G.feedAcik; if (typeof window.gunNotlariYenile === "function") { window.gunNotlariYenile(); } return; }
    var o = e.target.closest && e.target.closest("[data-gun-terim]");
    if (o && window.Ogren) { window.Ogren.ac(o.getAttribute("data-gun-terim")); }
  });

  // Race Feed satırlarını race-control düzenine çevirir (yalnız DOM yeniden düzeni; ortak olaySatiri'na dokunulmaz): sabit zaman sütunu
  function satirlar(kok) {
    if (!kok) { return; }
    kok.querySelectorAll(".tl-oge").forEach(function (r) {
      if (r.querySelector(":scope > .g3-t")) { return; }
      var t = r.querySelector(".tl-saat"); if (!t) { return; }
      var e = document.createElement("div"); e.className = "g3-t"; e.textContent = t.textContent;
      var n = r.querySelector(".tl-nokta"); if (n) { n.remove(); }
      t.remove(); r.insertBefore(e, r.firstChild);
    });
  }

  window.GunV3 = {
    satirlar: satirlar,
    render: render, kanonik: kanonik, _durum: G,
    sonucAyarla: function (liste) {      // yalnız mevcut Jolpica sonucundan P1–P3
      G.podyum = (liste || []).slice(0, 3).map(function (r) { return { sira: r.position, kod: r.Driver && (r.Driver.code || r.Driver.familyName) }; }).filter(function (r) { return r.kod && /^\d+$/.test(String(r.sira)); });
    },
    feedAcik: function () { return G.feedAcik; }
  };
})();
