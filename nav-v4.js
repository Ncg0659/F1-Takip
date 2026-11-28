/* UI v4 — NAVİGASYON KABUĞU (v4.0 Aşama 1). YALNIZ GİZLİ ÖNİZLEMEDE etkin: html[data-v4="1"] (adres: ?nav=v4; çıkış: ?nav=v3).
   • Yayındaki v3 düzeni DEĞİŞMEZ: bayrak yoksa bu dosya hiçbir DOM/stil değişikliği yapmaz (yalnız olay dinleyicisi kurar ve döner).
   • İçerik TAŞINMAZ (Aşama 2+). Her düğme mevcut window.sekmeAc(ad)'ı çağırır; ekranların kimlikleri ve yan etkileri aynen kalır.
   • 4 ana sekme: ANA SAYFA · YARIŞ HAFTASI · ANALİZ · KEŞFET. Alt menüler kullanıcı onaylı listedir.
   • ANA SAYFA (Aşama 2) = #sekme-sezon + akıllı durum kartı (ana-v4.js). v4'te "bugun" ekranı açılmaz; sekmeAc("bugun") ana sayfaya yönlenir.
   • Geçiş dönemi seçicisi (#seg-v4): içerik Aşama 4'te birleşene kadar ANALİZ › PİLOTLAR & TAKIMLAR → PROFİLLER · ŞAMPİYONLAR.
   • Canlı durum: YENİ HESAP YOK — BugunV3.modBelirle() okunur. canli + gercek (Race Feed doğrulaması) → kırmızı LIVE;
     canli ama doğrulanmamış → amber LIVE TAHMİNİ. Canlıyken YARIŞ HAFTASI tek dokunuşla CANLI (sekme-gun) açar.
   • Yeni fetch / zamanlayıcı / polling / depolama anahtarı YOK (bayrak f1-nav4 index.html başlığında yazılır). Yeniden değerlendirme:
     f1-sekme olayı + mevcut saat çubuğu (#rc-saat) gözlemcisi (10 sn'de bir okuma). */
(function () {
  "use strict";
  var ANA = { bugun: "ana", sezon: "ana", hafta: "hafta", sprint: "hafta", gun: "hafta", yaris: "analiz", profil: "analiz", sampiyonlar: "analiz", grafik: "analiz", diger: "kesfet" };
  var CTX = {
    hafta: [["program", "PROGRAM"], ["sprint", "SPRINT"], ["canli", "CANLI"]],
    analiz: [["yaris", "YARIŞ"], ["pilotlar", "PİLOTLAR & TAKIMLAR"], ["pistler", "PİSTLER"], ["grafikler", "GRAFİKLER"], ["tahmin", "TAHMİN"]],
    kesfet: [["ogren", "ÖĞREN"], ["seriler", "SERİLER"]]
  };
  var SEG = {                                         // Aşama 2: ANA SAYFA seçicisi kalktı (BUGÜN özeti ana sayfanın üst kartı)
    pilotlar: [["profil", "PROFİLLER"], ["sampiyonlar", "ŞAMPİYONLAR"]]
  };
  var HEDEF = { program: "hafta", sprint: "sprint", canli: "gun", yaris: "yaris", pilotlar: "profil", pistler: "profil", grafikler: "grafik", tahmin: "grafik", seriler: "diger" };
  var IK = {
    ana: "<path d='M3 11l9-7 9 7'/><path d='M5 10v10h14V10'/>",
    hafta: "<path d='M5 21V4M5 4h11l-2 4 2 4H5'/>",
    analiz: "<path d='M4 20V10M10 20V4M16 20v-8M22 20H2'/>",
    kesfet: "<circle cx='12' cy='12' r='9'/><path d='M15 9l-2 5-5 1 2-5z'/>"
  };
  var AD = { ana: "ANA SAYFA", hafta: "YARIŞ HAFTASI", analiz: "ANALİZ", kesfet: "KEŞFET" };
  var KISA = { ana: "ANA SAYFA", hafta: "YARIŞ HAFTASI", analiz: "ANALİZ", kesfet: "KEŞFET" };
  var S = { sekme: null, ctx: null, seg: null, canli: null, imza: null, tik: 0, kuruldu: false, haftaSon: "program" };

  function $(id) { return document.getElementById(id); }
  function v4() { return document.documentElement.getAttribute("data-v4") === "1"; }
  function git(ad) { if (typeof window.sekmeAc === "function") { window.sekmeAc(ad); } }
  function sprintVar() { var b = $("btn-sprint"); return !!b && !b.hidden; }
  function tahminVar() { var t = $("tp-analiz"); return !!t && !t.hidden && !!t.firstElementChild; }

  // ---------- canlı durum (yalnız okuma) ----------
  function canliOku() {
    var m = null;
    try { if (window.BugunV3 && BugunV3.modBelirle) { m = BugunV3.modBelirle(Date.now()); } } catch (e) { m = null; }
    if (!m || m.mod !== "A" || !m.canli) { return null; }
    return m.gercek ? "live" : "tahmin";
  }

  // ---------- kurulum ----------
  function kur() {
    if (S.kuruldu) { return true; }
    var eski = $("nav-v3"); if (!eski || !eski.parentNode) { return false; }
    var nav = document.createElement("div");
    nav.id = "nav-v4"; nav.setAttribute("role", "navigation"); nav.setAttribute("aria-label", "Ana menü");
    nav.innerHTML = ["ana", "hafta", "analiz", "kesfet"].map(function (k) {
      return "<button type='button' id='nv4-" + k + "' data-nv4='" + k + "' aria-label='" + AD[k] + "'>" +
        "<svg class='nv4-ik' viewBox='0 0 24 24' width='22' height='22' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>" + IK[k] + "</svg>" +
        "<span class='nv4-u'>" + AD[k] + "</span><span class='nv4-k'>" + KISA[k] + "</span>" +
        (k === "hafta" ? "<span class='nv4-durum' id='nv4-durum' hidden></span>" : "") + "</button>";
    }).join("");
    var ctx = document.createElement("div"); ctx.id = "ctx-v4"; ctx.setAttribute("role", "navigation"); ctx.setAttribute("aria-label", "Alt menü"); ctx.hidden = true;
    var seg = document.createElement("div"); seg.id = "seg-v4"; seg.setAttribute("role", "group"); seg.setAttribute("aria-label", "Bölüm seçimi"); seg.hidden = true;
    eski.parentNode.insertBefore(nav, eski);
    var ectx = $("ctx-v3"); var sonra = ectx && ectx.parentNode === eski.parentNode ? ectx.nextSibling : eski.nextSibling;
    eski.parentNode.insertBefore(ctx, sonra); eski.parentNode.insertBefore(seg, ctx.nextSibling);
    S.kuruldu = true; return true;
  }
  function logoKur() {
    var sol = document.querySelector("#rc-bar .rc-sol"); if (!sol || sol.getAttribute("data-nv4-logo")) { return; }
    sol.setAttribute("data-nv4-logo", "1"); sol.setAttribute("role", "button"); sol.setAttribute("tabindex", "0"); sol.setAttribute("aria-label", "F1 TAKİP — ana sayfa");
    var cip = document.createElement("a"); cip.id = "nv4-onizleme"; cip.href = "?nav=v3"; cip.className = "nv4-onizleme"; cip.innerHTML = "<span>v4</span><span class='nv4-oz-u'>ÖNİZLEME</span><span>· ÇIK</span>";
    cip.title = "Yayındaki görünüme dön"; sol.parentNode.insertBefore(cip, sol.nextSibling);
    if (!$("nv4-cikis")) {                         // mobil: üst çubuk dar → çıkış bağlantısı sayfa sonunda
      var alt = document.createElement("p"); alt.id = "nv4-cikis"; alt.className = "nv4-cikis";
      alt.innerHTML = "v4 önizleme açık · <a href='?nav=v3'>Yayındaki görünüme dön</a>"; document.body.appendChild(alt);
    }
  }

  // ---------- çizim ----------
  function ctxVarsayilan(ad) {
    if (ad === "hafta") { return "program"; } if (ad === "sprint") { return "sprint"; } if (ad === "gun") { return "canli"; }
    if (ad === "yaris") { return "yaris"; } if (ad === "sampiyonlar") { return "pilotlar"; } if (ad === "diger") { return "seriler"; }
    if (ad === "profil") { return S.ctx === "pistler" ? "pistler" : "pilotlar"; }
    if (ad === "grafik") { return S.ctx === "tahmin" && tahminVar() ? "tahmin" : "grafikler"; }
    return null;
  }
  function render(ad) {
    if (!v4() || !kur()) { return; }
    if (ad === "bugun") {                                       // v4: BUGÜN özeti ana sayfanın içinde → ana sayfaya yönlen
      try { if (window.AnaV4 && AnaV4.kur) { AnaV4.kur(); } } catch (e) {}
      git("sezon"); return;
    }
    S.sekme = ad; var ana = ANA[ad] || null;
    S.ctx = ctxVarsayilan(ad);
    S.seg = S.ctx === "pilotlar" ? (ad === "sampiyonlar" ? "sampiyonlar" : "profil") : null;
    if (ana === "hafta") { S.haftaSon = S.ctx; }
    ["ana", "hafta", "analiz", "kesfet"].forEach(function (k) {
      var b = $("nv4-" + k); if (!b) { return; }
      if (k === ana) { b.setAttribute("aria-current", "page"); } else { b.removeAttribute("aria-current"); }
    });
    yaz();
  }
  function yaz() {
    var ana = ANA[S.sekme] || null;
    var liste = (ana && CTX[ana] ? CTX[ana] : []).filter(function (x) {
      if (x[0] === "sprint") { return sprintVar(); }
      if (x[0] === "tahmin") { return tahminVar(); }
      return true;
    });
    var sl = S.ctx === "pilotlar" ? SEG.pilotlar : [];
    var imza = [ana, S.ctx, S.seg, liste.map(function (x) { return x[0]; }).join(",")].join("|");
    if (imza === S.imza) { return; }
    S.imza = imza;
    var c = $("ctx-v4"), g = $("seg-v4");
    c.hidden = !liste.length;
    c.innerHTML = liste.map(function (x) {
      var a = x[0] === S.ctx;
      return "<button type='button' id='cx4-" + x[0] + "' data-cx4='" + x[0] + "'" + (a ? " aria-current='page'" : "") + ">" + x[1] + "</button>";
    }).join("");
    g.hidden = !sl.length;
    g.innerHTML = sl.length ? sl.map(function (x) {
      var a = x[0] === S.seg;
      return "<button type='button' id='sg4-" + x[0] + "' data-sg4='" + x[0] + "' aria-pressed='" + (a ? "true" : "false") + "'>" + x[1] + "</button>";
    }).join("") : "";
  }
  function durumYaz() {
    var d = $("nv4-durum"), b = $("nv4-hafta"); if (!d || !b) { return; }
    var c = canliOku(); if (c === S.canli) { return; }
    S.canli = c;
    d.hidden = !c; d.className = "nv4-durum" + (c ? " nv4-" + c : "");
    d.textContent = c === "live" ? "LIVE" : (c === "tahmin" ? "LIVE TAHMİNİ" : "");
    b.setAttribute("aria-label", AD.hafta + (c === "live" ? " — canlı seans (Race Feed doğruladı); dokun: CANLI" : c === "tahmin" ? " — canlı seans tahmini (saate göre, doğrulanmadı); dokun: CANLI" : ""));
    b.setAttribute("data-canli", c || "");
  }

  // ---------- kaydırma (PİSTLER / TAHMİN aynı ekranın bölümleri; içerik Aşama 4'te ayrılır) ----------
  function kaydir(hedef) {
    var e = null;
    if (hedef === "pistler") {                     // tablonun (veya sarmalayıcısının) önündeki en yakın başlık: "Sezonun pistleri"
      var t = $("pist-govde"), kok = $("sekme-profil"), n = t ? (t.closest("table") || t) : null; e = n;
      while (n && n !== kok) { var h = n.previousElementSibling; while (h && !/^H[23]$/.test(h.tagName)) { h = h.previousElementSibling; } if (h) { e = h; break; } n = n.parentElement; }
    }
    if (hedef === "tahmin") { e = $("tp-analiz"); }
    try { if (e) { window.scrollTo(0, Math.max(0, e.getBoundingClientRect().top + window.pageYOffset - 12)); } else { window.scrollTo(0, 0); } } catch (x) {}
  }

  // ---------- olaylar ----------
  document.addEventListener("f1-sekme", function (e) { render(e.detail); });
  document.addEventListener("click", function (e) {
    if (!v4()) { return; }
    var t = e.target;
    var lg = t.closest && t.closest("#rc-bar .rc-sol[data-nv4-logo]");
    if (lg) { git("sezon"); window.scrollTo(0, 0); return; }
    var n = t.closest && t.closest("#nav-v4 [data-nv4]");
    if (n) {
      var k = n.getAttribute("data-nv4");
      if (k === "ana") { git("sezon"); }
      else if (k === "hafta") {
        if (canliOku()) { git("gun"); }                                   // canlıyken tek dokunuş: CANLI
        else { var h = S.haftaSon === "sprint" && !sprintVar() ? "program" : S.haftaSon; git(HEDEF[h] || "hafta"); }
      }
      else if (k === "analiz") { S.ctx = "yaris"; git("yaris"); }
      else if (k === "kesfet") { git("diger"); }
      window.scrollTo(0, 0); return;
    }
    var c = t.closest && t.closest("#ctx-v4 [data-cx4]");
    if (c) {
      var h2 = c.getAttribute("data-cx4");
      if (h2 === "ogren") { try { if (window.Ogren && Ogren.sozluk) { Ogren.sozluk(); } } catch (x) {} return; }   // mevcut sözlük paneli; ekran değişmez
      S.ctx = h2; var hd = HEDEF[h2];
      if (S.sekme === hd) { render(hd); } else { git(hd); S.ctx = h2; render(hd); }
      if (h2 === "pistler" || h2 === "tahmin") { kaydir(h2); } else { window.scrollTo(0, 0); }
      return;
    }
    var g = t.closest && t.closest("#seg-v4 [data-sg4]");
    if (g) { var sg = g.getAttribute("data-sg4"); git(sg); window.scrollTo(0, 0); }
  });
  document.addEventListener("keydown", function (e) {
    if (!v4() || (e.key !== "Enter" && e.key !== " ")) { return; }
    var lg = e.target && e.target.closest && e.target.closest("#rc-bar .rc-sol[data-nv4-logo]");
    if (lg) { e.preventDefault(); git("sezon"); }
  });

  function gorunen() {
    var b = Object.keys(ANA);
    for (var i = 0; i < b.length; i++) { var e = $("sekme-" + b[i]); if (e && !e.hidden) { return b[i]; } }
    return null;
  }
  function hazir() {
    if (!v4()) { return; }
    if (!kur()) { return; }
    logoKur();
    var a = gorunen(); if (a) { render(a); }
    durumYaz();
    if (window.MutationObserver) {
      var sb = $("btn-sprint"); if (sb) { new MutationObserver(function () { S.imza = null; yaz(); }).observe(sb, { attributes: true, attributeFilter: ["hidden"] }); }
      var tp = $("tp-analiz"); if (tp) { new MutationObserver(function () { S.imza = null; yaz(); }).observe(tp, { attributes: true, attributeFilter: ["hidden"], childList: true }); }
      var bar = $("rc-bar");
      if (bar) { new MutationObserver(function () { logoKur(); }).observe(bar, { childList: true }); }
      var saat = $("rc-saat");
      if (saat) { new MutationObserver(function () { S.tik = (S.tik + 1) % 10; if (S.tik === 0) { durumYaz(); } }).observe(saat, { childList: true, characterData: true, subtree: true }); }
      document.addEventListener("f1-feed-guncel", durumYaz);
      document.addEventListener("f1-sekme", durumYaz);
    }
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", hazir); } else { hazir(); }
  window.NavV4 = { render: render, canliOku: canliOku, durumYaz: durumYaz, _durum: S, _yeniden: function () { S.imza = null; S.canli = undefined; hazir(); } };
})();
