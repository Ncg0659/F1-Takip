/* F1 TAKİP — MOTION SYSTEM v1 (yalnız İŞARETLEME katmanı).
   • State ÜRETMEZ, ağ çağrısı YAPMAZ, polling/zamanlayıcı/requestAnimationFrame döngüsü YOK, depolama YOK.
   • Tek iş: mevcut DOM'a eklenen/değişen öğeleri görüp motion-v1.css'teki .mo-* sınıflarını TEK SEFERLİK vermek:
       sekme geçişi · hero girişi (yalnız yarış/sekme değişince) · pist çizimi (yalnız yeni pist) · state reveal (yalnız state DEĞİŞİNCE)
       geri sayım hane swap'ı · ticker içerik crossfade · seçili seans/detay · akordeon açılışı · sonuç/podyum · "Yarışı kaçırdıysan" kartı · kayan nav çizgisi.
   • Olay güdümlü: tek MutationObserver (+ nav için ikinci) ve f1-sekme olayı; sayfa gizliyken (document.hidden) hiçbir iş yapmaz.
   • prefers-reduced-motion: hiçbir sınıf eklenmez (içerik doğrudan son durumda). */
(function () {
  "use strict";
  var D = document;
  var S = { hk: {}, pk: {}, ck: {}, sl: {}, cz: {}, rk: null, kk: {}, tk: undefined, ak: undefined, ac: null };
  var HERO = ".bg-hero, .g3-hero, .h-hero, #yv-hero, .st-p-kart";
  var TITLE = ".bg-ad, .yk-yer b, .yv-yer b, .st-p-ad";
  var PATH = ".bg-hat, .g3-hat, .h-hat, .st-p-hat";
  var CHIP = ".bg-kod, .g3-kod";

  var TEMIZ = /^mo-(sekme|hero|ciz|durum|sel|panel|klive|ac|sw|res|kart|akis)-[ab]$/;

  function $(id) { return D.getElementById(id); }
  function reduced() { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } }
  function sekmeId(el) { var s = el && el.closest ? el.closest("section[id^='sekme-']") : null; return s ? s.id : ""; }
  function gizliMi(el) { var s = el && el.closest ? el.closest("section[id^='sekme-']") : null; return !!(s && s.hidden); }

  // Animasyonu (yeniden) başlat: a/b ikiz sınıf → keyframe adı değişir, reflow gerekmez
  function oyna(el, ad) {
    if (!el || !el.classList || reduced()) { return; }
    var A = "mo-" + ad + "-a", B = "mo-" + ad + "-b", son = el.__mo && el.__mo[ad];
    el.classList.remove(A, B);
    el.classList.add(son === "a" ? B : A);
    (el.__mo = el.__mo || {})[ad] = son === "a" ? "b" : "a";
  }
  function temizle(el) {
    if (!el || !el.classList) { return; }
    var sil = [], i; for (i = 0; i < el.classList.length; i++) { if (TEMIZ.test(el.classList[i])) { sil.push(el.classList[i]); } }
    sil.forEach(function (c) { el.classList.remove(c); });
  }
  // Animasyon bitince tetik sınıfı kalkar → yeniden çizimde (innerHTML) tekrar oynamaz
  D.addEventListener("animationend", function (e) { if (/^mo-/.test(e.animationName || "")) { temizle(e.target); } }, true);
  D.addEventListener("animationcancel", function (e) { if (/^mo-/.test(e.animationName || "")) { temizle(e.target); } }, true);

  function tonu(metin) {
    var t = String(metin || "").trim().toUpperCase();
    if (t === "LIVE") { return "live"; }
    if (t === "RED FLAG") { return "kirmizi"; }
    if (t === "RESUMED") { return "yesil"; }
    if (/^(SAFETY CAR|VSC|STOPPED|DELAYED|POSTPONED|CANCELLED|RESCHEDULED)$/.test(t)) { return "bekle"; }
    return "";
  }

  // ---- hero: yalnız yarış/sekme değişince giriş ----
  function heroAnahtar(h) { var t = h.querySelector(TITLE); return t ? String(t.textContent || "").trim() : ""; }
  function heroSlot(h) { return sekmeId(h) + "|" + (h.id || String(h.className).split(/\s+/)[0]); }
  function heroKontrol(h) {
    if (!h || gizliMi(h)) { return; }
    var k = heroAnahtar(h); if (!k) { return; }
    var s = heroSlot(h);
    if (S.hk[s] !== k) { S.hk[s] = k; oyna(h, "hero"); }
  }
  // ---- pist: yalnız yeni pist/round ----
  function pistKontrol(p) {
    if (!p || gizliMi(p)) { return; }
    var d = p.getAttribute("d"); if (!d) { return; }
    var s = sekmeId(p) + "|" + String(p.parentNode && p.parentNode.id || "") + "|" + String(p.getAttribute("class"));
    if (S.pk[s] === d) { return; }
    S.pk[s] = d; p.setAttribute("pathLength", "1"); oyna(p, "ciz");
  }
  // ---- state chip: yalnız DEĞİŞİNCE tek seferlik reveal; nabız yalnız metni tam "LIVE" olan (doğrulanmış) chip'te ----
  function chipKontrol(c) {
    if (!c) { return; }
    var m = String(c.textContent || "").trim(), t = tonu(m), s = sekmeId(c) + "|" + String(c.className).split(/\s+/)[0];
    if (t) { c.setAttribute("data-mo-t", t); } else { c.removeAttribute("data-mo-t"); }
    var onceki = S.ck[s]; S.ck[s] = m;
    if (onceki !== undefined && onceki !== m && t && t !== "live" && !gizliMi(c)) { oyna(c, "durum"); }
  }
  // ---- ticker: etiket tonu + yalnız içerik crossfade ----
  function tickerKontrol() {
    var tk = $("a45-ticker"), et = $("a45-et"), lv = $("a45-live"); if (!tk || !et || !lv) { return; }
    var m = String(et.textContent || "").trim(), t = tonu(m);
    if (t) { lv.setAttribute("data-mo-t", t); } else { lv.removeAttribute("data-mo-t"); }
    if (S.tk !== undefined && S.tk !== m && t && t !== "live" && !tk.hidden) { oyna(lv, "durum"); }
    S.tk = m;
    var ak = $("a45-akis"); if (!ak) { return; }
    var k = Array.prototype.map.call(ak.querySelectorAll(".tk-m, .tk-bos, .tk-pr"), function (x) { return x.textContent; }).join("|");
    if (S.ak !== undefined && S.ak !== k && !tk.hidden) { oyna(ak, "akis"); }
    S.ak = k;
  }
  // ---- seçili seans kartı / detay paneli / LIVE'a geçen kart ----
  function czKontrol(c) {
    var key = c.getAttribute("data-key"), canli = c.classList.contains("h-canli");
    if (c.classList.contains("h-sec")) {
      if (S.sl.cz !== undefined && S.sl.cz !== key && !gizliMi(c)) { oyna(c, "sel"); }
      S.sl.cz = key;
    }
    if (S.cz[key] === false && canli && !gizliMi(c)) { oyna(c, "klive"); }
    S.cz[key] = canli;
  }
  function dpKontrol(p) {
    var k = p.getAttribute("data-seans");
    if (S.sl.dp !== undefined && S.sl.dp !== k && !gizliMi(p)) { oyna(p, "panel"); }
    S.sl.dp = k;
  }
  // ---- sonuç tablosu: ilk 3 satır stagger, kalan toplu fade ----
  function resKontrol(tb) {
    var n = tb.children.length, tur = $("yv-tur"), k = n ? String(tur && tur.textContent || "var") : null;
    if (k && S.rk !== k && !gizliMi(tb)) { oyna(tb, "res"); }
    S.rk = k;
  }
  // ---- "Yarışı kaçırdıysan" kartı: ilk açılış / yeni yarış ----
  function kartKontrol(k) {
    if (!k || k.hidden || gizliMi(k)) { if (k && k.hidden) { S.kk.k = null; } return; }
    var anahtar = String(k.getAttribute("data-tur")) + "|" + (k.children.length ? 1 : 0);
    if (!k.children.length) { S.kk.k = anahtar; return; }
    if (S.kk.k !== anahtar) { S.kk.k = anahtar; oyna(k, "kart"); }
  }

  // ---- eklenen düğüm ----
  function ekle(n) {
    var h = n.closest ? n.closest(HERO) : null;
    if (h) { heroKontrol(h); }
    if (n.querySelectorAll) { Array.prototype.forEach.call(n.querySelectorAll(HERO), heroKontrol); }
    if (n.matches && n.matches(PATH)) { pistKontrol(n); }
    if (n.querySelectorAll) { Array.prototype.forEach.call(n.querySelectorAll(PATH), pistKontrol); }
    if (n.matches && n.matches(CHIP)) { chipKontrol(n); }
    if (n.querySelectorAll) { Array.prototype.forEach.call(n.querySelectorAll(CHIP), chipKontrol); }
    if (n.matches && n.matches(".h-cz")) { czKontrol(n); }
    if (n.querySelectorAll) { Array.prototype.forEach.call(n.querySelectorAll(".h-cz"), czKontrol); }
    if (n.matches && n.matches(".h-dp")) { dpKontrol(n); }
    if (n.querySelectorAll) { Array.prototype.forEach.call(n.querySelectorAll(".h-dp"), dpKontrol); }
    if (n.id === "a45-ticker" || (n.closest && n.closest("#a45-ticker"))) { tickerKontrol(); }
    // aria-expanded ile açılan, içeriği yeniden çizilen paneller: düğmeden SONRA gelen yeni içerik açılış animasyonu alır
    var ac = S.ac;
    if (ac && ac.kap && ac.kap.isConnected && performance.now() - ac.t < 600 && ac.kap.contains(n) && n !== ac.kap) {
      var b = ac.kap.querySelector("[aria-expanded='true']");
      if (b && (b.compareDocumentPosition(n) & 4) && !n.contains(b) && !(n.parentElement && n.parentElement.closest("[class*='mo-ac-']"))) { oyna(n, "ac"); }
    }
  }
  // ---- değişen hedef (metin/çocuk) ----
  function hedef(t) {
    if (t.hasAttribute && t.hasAttribute("data-u") && /\b(bg-sayi|st-p-sayi)\b/.test(String(t.className))) { oyna(t, "sw"); return; }
    if (t.id === "sonuc-govde") { resKontrol(t); return; }
    if (t.id === "yo-kart" || (t.closest && t.closest("#yo-kart"))) { kartKontrol($("yo-kart")); }
    if (t.closest && t.closest("#a45-ticker")) { tickerKontrol(); }
    var h = t.closest ? t.closest(HERO) : null; if (h) { heroKontrol(h); }
    if (t.matches && t.matches(CHIP)) { chipKontrol(t); } else if (t.closest) { var c = t.closest(CHIP); if (c) { chipKontrol(c); } }
  }
  function mo(liste) {
    if (D.hidden || reduced()) { return; }
    for (var i = 0; i < liste.length; i++) {
      var r = liste[i], t = r.target;
      try {
        if (r.type === "attributes") {
          if (r.attributeName === "hidden" && r.oldValue !== null && !t.hidden) {
            if (t.id === "yo-kart") { kartKontrol(t); }
            else if (t.matches && t.matches(".st-detay-ic, .a2-uzun, #yv-a7-panel")) { oyna(t, "ac"); }
          } else if (r.attributeName === "data-tur" && t.id === "yo-kart") { kartKontrol(t); }
          continue;
        }
        if (t.nodeType === 3) { t = t.parentElement; }
        if (t && t.nodeType === 1) { hedef(t); }
        for (var j = 0; j < r.addedNodes.length; j++) { if (r.addedNodes[j].nodeType === 1) { ekle(r.addedNodes[j]); } }
      } catch (e) { /* hareket katmanı hata verirse sessizce atlanır; uygulama etkilenmez */ }
    }
  }

  // ---- 1) sekme geçişi + hero/pist girişi (sekmeAc → f1-sekme; sekmeAc davranışı değişmez) ----
  D.addEventListener("f1-sekme", function (e) {
    try {
      var sekmeler = D.querySelectorAll("section[id^='sekme-']"), i;
      for (i = 0; i < sekmeler.length; i++) { temizle(sekmeler[i]); }
      Array.prototype.forEach.call(D.querySelectorAll("[class*='mo-hero-']"), temizle);
      if (D.hidden || reduced()) { return; }
      var sec = $("sekme-" + e.detail); if (!sec || sec.hidden) { return; }
      oyna(sec, "sekme");
      Object.keys(S.hk).forEach(function (k) { if (k.indexOf(sec.id + "|") === 0) { delete S.hk[k]; } });
      Object.keys(S.pk).forEach(function (k) { if (k.indexOf(sec.id + "|") === 0) { delete S.pk[k]; } });
      Array.prototype.forEach.call(sec.querySelectorAll(HERO), heroKontrol);
      Array.prototype.forEach.call(sec.querySelectorAll(PATH), pistKontrol);
      kartKontrol($("yo-kart"));
    } catch (x) { /* önemsiz */ }
  });

  // ---- 2) akordeon: <details> summary tıklanınca açılış (kapanış native: animasyonsuz) ----
  D.addEventListener("click", function (e) {
    if (reduced() || D.hidden) { return; }
    var el = e.target && e.target.closest ? e.target : null; if (!el) { return; }
    var sm = el.closest("summary");
    if (sm && sm.parentElement && sm.parentElement.tagName === "DETAILS" && !sm.parentElement.open) { oyna(sm.parentElement, "ac"); }
    var b = el.closest("[aria-expanded]");
    if (b && b.getAttribute("aria-expanded") === "false" && !/^nv-/.test(b.id || "")) {
      var kap = b.parentElement && b.parentElement.closest("[id]");
      if (kap) { S.ac = { t: performance.now(), kap: kap }; }
    }
  }, true);

  // ---- 2b) programatik kaydırma: ticker → Yarış Günü (scrollIntoView) yumuşak; geçici, olay güdümlü (zamanlayıcı yok) ----
  function yumusakKapat() { D.documentElement.style.removeProperty("scroll-behavior"); }
  D.addEventListener("click", function (e) {
    var ticker = e.target && e.target.closest && e.target.closest("#a45-git");
    if (!ticker) { yumusakKapat(); return; }            // başka bir tıklama: normal kaydırmaya dön
    if (!reduced()) { D.documentElement.style.scrollBehavior = "smooth"; }
  }, true);
  ["scrollend", "wheel", "touchstart", "keydown"].forEach(function (ad) { D.addEventListener(ad, yumusakKapat, true); });

  // ---- 3) kayan nav çizgisi: yalnız CSS değişkenleri yazar (konum ölçümü; döngü yok) ----
  function navCizgi() {
    var nav = $("nav-v3"); if (!nav || !nav.offsetWidth || D.hidden) { return; }
    var a = nav.querySelector("button[aria-current='page']"); if (!a) { return; }
    var mobil = false; try { mobil = window.matchMedia("(max-width: 600px)").matches; } catch (e) { /* önemsiz */ }
    nav.style.setProperty("--mo-x", a.offsetLeft + "px");
    nav.style.setProperty("--mo-sx", String(a.offsetWidth / 100));
    nav.style.setProperty("--mo-y", (mobil ? 0 : a.offsetTop + a.offsetHeight - 2) + "px");
    if (!nav.hasAttribute("data-mo-ind")) { nav.setAttribute("data-mo-ind", ""); }
  }

  function baslat() {
    if (window.MutationObserver) {
      new MutationObserver(mo).observe(D.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["hidden", "data-tur"], attributeOldValue: true });
      var nav = $("nav-v3");
      if (nav) { new MutationObserver(navCizgi).observe(nav, { attributes: true, attributeFilter: ["aria-current"], subtree: true }); }
    }
    window.addEventListener("resize", navCizgi);
    D.addEventListener("f1-sekme", navCizgi);
    navCizgi(); tickerKontrol();
  }
  if (D.readyState === "loading") { D.addEventListener("DOMContentLoaded", baslat); } else { baslat(); }
  window.MotionV1 = { oyna: oyna, _durum: S };
})();
