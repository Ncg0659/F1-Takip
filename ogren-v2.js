/* İZLERKEN ÖĞREN v2 — BAĞLAMSAL MİKRO ÖĞRENME KATMANI (yalnız SUNUM).
   • Mevcut bileşeni yeniden kullanır: <button class="a2-i" data-terim> → ogren-ui.js (tek <dialog>, Escape, odak dönüşü). Yeni modal YOK.
   • Terim metni tek kaynaktan gelir: ICERIK.sozluk (icerik-sozluk.js + icerik-sozluk-v2.js). Bu dosya HİÇ açıklama metni içermez.
   • Tetikleyiciler yalnızca YAPISAL alanlardan: BugunV3 kanonik durumu, GunV3.kanonik, Race Feed kategori alanı (.tl-kat = ham kategori),
     Seans Olayları data-tip (RaceControl normalizedType), HAFTA .h-ceza (yapısal start≠sıralama), sonuç rozeti "R", ANALİZ blok başlıkları.
     Serbest metin ayrıştırma / NLP YOK. Eşleşme güvenilir değilse hiçbir şey çizilmez.
   • Yeni fetch / polling / zamanlayıcı / depolama YOK. Gövde MutationObserver'ı idempotent: işaret zaten doğruysa DOM'a dokunmaz.
   • Açıklama modu "Kapalı" ise (html[data-a2-ogren=kapali]) mevcut CSS tüm .a2-i işaretlerini gizler. */
(function () {
  "use strict";
  var ETIKET = { "vsc": "VSC", "safety-car": "Safety Car", "kirmizi-bayrak": "Kırmızı bayrak", "restart": "Restart", "pist-limiti": "Track limits",
    "grid-cezasi": "Grid cezası", "dnf": "DNF", "dns-dsq": "DSQ", "pit-stop": "Pit stop", "flying-lap": "Flying lap", "gecis": "Geçiş" };
  var DURUM = { RED_FLAG: "kirmizi-bayrak", STOPPED: "kirmizi-bayrak", SAFETY_CAR: "safety-car", VSC: "vsc", RESUMED: "restart" };   // kanonik durum → terim
  var KATEGORI = { SAFETY_CAR: "safety-car", VSC: "vsc", RED_FLAG: "kirmizi-bayrak", RESTART: "restart" };                          // Race Feed ham kategori
  var TIP = { SAFETY_CAR: "safety-car", VSC: "vsc", RED_FLAG: "kirmizi-bayrak", RESTART: "restart", TRACK_LIMITS: "pist-limiti" };  // Seans Olayları data-tip
  function bul(f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } }
  function terimVar(k) { var S = bul(function () { return window.ICERIK.sozluk.terimler; }, null); return !!(S && Object.prototype.hasOwnProperty.call(S, k)); }
  function ad(k) { return ETIKET[k] || bul(function () { return window.ICERIK.sozluk.terimler[k].ad; }, k); }
  function txt(el) { return el ? String(el.textContent || "").replace(/\s+/g, " ").trim() : ""; }

  function dugme(k) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "a2-i a2-b2"; b.setAttribute("data-terim", k); b.setAttribute("data-b2", k);
    b.setAttribute("aria-label", ad(k) + " nedir?"); b.title = ad(k) + " nedir?";
    return b;
  }
  // el'den hemen sonra (kardeş olarak) tek işaret; terim değiştiyse güncelle, terim yoksa kaldır — zaten doğruysa DOM'a dokunma
  function koy(el, k) {
    if (!el) { return; }
    var s = el.nextElementSibling, var_ = s && s.getAttribute && s.getAttribute("data-b2") !== null ? s : null;
    if (!k || !terimVar(k)) { if (var_) { var_.remove(); } return; }
    if (var_ && var_.getAttribute("data-b2") === k) { return; }
    if (var_) { var_.remove(); }
    el.parentNode.insertBefore(dugme(k), el.nextSibling);
  }
  // kapsayıcı başına terim başına TEK işaret (her satıra [?] konmaz)
  function ilkineKoy(liste, kapsayici, hedefAl, terimAl) {
    var gorulen = [];
    Array.prototype.forEach.call(liste, function (e) {
      var k = terimAl(e); if (!k || !terimVar(k)) { return; }
      var kap = kapsayici(e); if (!kap) { return; }
      var id = kap.__b2 = kap.__b2 || (kap.__b2 = ++sayac);
      var anahtar = id + "|" + k; if (gorulen.indexOf(anahtar) >= 0) { return; }
      gorulen.push(anahtar);
      var h = hedefAl(e); if (!h) { return; }
      var blok = h.nodeType === 1 && h.tagName === "P";                 // blok başlık (<p>): işaret satırın İÇİNE (kendi satırına düşmesin)
      var s = blok ? h.lastElementChild : h.nextSibling;
      if (s && s.nodeType === 1 && s.getAttribute("data-b2") === k) { return; }
      if (blok) { h.appendChild(dugme(k)); } else { h.parentNode.insertBefore(dugme(k), h.nextSibling); }
    });
    // artık geçerli olmayan işaretleri temizle (satır yeniden çizildiyse zaten yok olur)
  }
  var sayac = 0;

  function durumIsaretleri() {
    // BUGÜN: hero etiketi = kanonik durum etiketi ise
    var kan = bul(function () { return window.BugunV3._durum.model.kan; }, null);
    var kod = document.querySelector("#bg-kok .bg-hero .bg-ust .bg-kod");
    if (kod) {
      var k = kan && DURUM[kan.anahtar] && txt(kod).toLocaleUpperCase("en") === String(kan.etiket || "").toLocaleUpperCase("en") ? DURUM[kan.anahtar] : "";
      koy(kod, k);
    }
    // GÜN: durum şeridi
    var g = document.querySelector("#gun-v3-serit .g3-kod");
    if (g) {
      var d = bul(function () { return window.GunV3.kanonik(window.GunCtx()); }, null);
      var kg = d && DURUM[d.anahtar] && txt(g).toLocaleUpperCase("en") === String(d.etiket || "").toLocaleUpperCase("en") ? DURUM[d.anahtar] : "";
      koy(g, kg);
    }
  }
  // aynı sekmede kanonik durum etiketinde aynı terimin işareti varsa feed satırına tekrar konmaz (aynı ekranda aynı terim iki kez işaretlenmez)
  function durumdaVar(el, k) {
    var sek = el.closest("[id^='sekme-']");
    return !!(sek && sek.querySelector("#gun-v3-serit .a2-b2[data-terim='" + k + "'], #bg-kok .bg-ust .a2-b2[data-terim='" + k + "']"));
  }
  function feedIsaretleri() {
    Array.prototype.forEach.call(document.querySelectorAll(".tl-kat + .a2-b2"), function (b) { if (durumdaVar(b, b.getAttribute("data-terim"))) { b.remove(); } });
    var kat = Array.prototype.filter.call(document.querySelectorAll(".tl-oge .tl-kat"), function (e) { return !durumdaVar(e, KATEGORI[txt(e)] || ""); });
    ilkineKoy(kat, function (e) { return e.closest(".tl-oge").parentNode; }, function (e) { return e; }, function (e) { return KATEGORI[txt(e)] || ""; });
    var so = document.querySelectorAll("li.so-sat[data-tip]");
    ilkineKoy(so, function (e) { return e.parentNode; }, function (e) { return e.querySelector(".so-metin > b"); }, function (e) { return TIP[e.getAttribute("data-tip")] || ""; });
  }
  function haftaIsaretleri() {
    ilkineKoy(document.querySelectorAll("#sekme-hafta .h-ceza"), function (e) { return e.closest("table") || e.parentNode; }, function (e) { return e; }, function () { return "grid-cezasi"; });
  }
  function sonucIsaretleri() {      // sonuç rozeti "R" (Jolpica positionText = retired) → DNF; "D" → DSQ
    ["sonuc-govde", "gun-sonuc-govde"].forEach(function (id) {
      var tb = document.getElementById(id); if (!tb) { return; }
      var satir = Array.prototype.filter.call(tb.querySelectorAll("tr"), function (r) { return r.querySelector(".poz-dnf") && r.children.length > 6; });
      ilkineKoy(satir, function () { return tb; }, function (r) { var td = r.children[5]; var son = td.lastChild; return son && son.getAttribute && son.getAttribute("data-b2") !== null ? son.previousSibling : son; },
        function (r) { var t = txt(r.querySelector(".poz-dnf")); return t === "R" ? "dnf" : (t === "D" ? "dns-dsq" : ""); });
    });
  }
  function analizIsaretleri() {
    ilkineKoy(document.querySelectorAll(".pt-bas"), function (e) { return e.parentNode; }, function (e) { return e; }, function () { return "pit-stop"; });
    ilkineKoy(document.querySelectorAll(".gc-bas"), function (e) { return e.parentNode; }, function (e) { return e; }, function () { return "gecis"; });
    // TURLAR: yapısal kanca — tur listesinin (ol.ta-liste) hemen önündeki .ta-not; başlık METNİNE bağlı değil (yükleniyor/hata notlarının listesi yoktur)
    ilkineKoy(document.querySelectorAll(".ta-not + .ta-liste"), function (e) { return e.parentNode; }, function (e) { return e.previousElementSibling; }, function () { return "flying-lap"; });
  }

  var mesgul = false;
  function isaretle() {
    if (mesgul) { return; }
    mesgul = true;
    try { durumIsaretleri(); } catch (e) { /* önemsiz */ }
    try { feedIsaretleri(); } catch (e) { /* önemsiz */ }
    try { haftaIsaretleri(); } catch (e) { /* önemsiz */ }
    try { sonucIsaretleri(); } catch (e) { /* önemsiz */ }
    try { analizIsaretleri(); } catch (e) { /* önemsiz */ }
    mesgul = false;
  }
  window.OgrenV2 = { isaretle: isaretle };
  document.addEventListener("f1-sekme", isaretle);
  function baslat() {
    // yalnız işaretin gerekebildiği sekme kapsayıcıları (hepsi index.html'de statik; içerikleri yeniden çizilir → subtree)
    if (window.MutationObserver) {
      var mo = new MutationObserver(function () { isaretle(); });
      ["sekme-bugun", "sekme-hafta", "sekme-gun", "sekme-yaris"].forEach(function (id) { var k = document.getElementById(id); if (k) { mo.observe(k, { childList: true, subtree: true }); } });
    }
    isaretle();
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", baslat); } else { baslat(); }
})();
