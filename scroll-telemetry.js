/* SCROLL TELEMETRY v1 — kaydırmayı sanal telemetriye çevirir (eğlence; gerçek mesafe DEĞİL).
   • Tamamen cihaz içi: fetch / polling / sunucuya veri yok. Tek kalıcı veri: localStorage "f1-scroll-telemetry".
   • Mesafe: |scrollY - önceki scrollY| toplanır; yukarı + aşağı ikisi de sayılır. 1 ekran yüksekliği = SCROLL_METRE_PER_VIEWPORT metre.
   • Yalnız KULLANICI kaydırması sayılır: wheel / dokunmatik sürükleme / klavye kaydırma tuşları / kaydırma çubuğu sürüklemesi sonrası gelen scroll olayları.
     Girdisiz scroll (sayfa yükü scroll geri yükleme, scrollTo, scrollIntoView, ticker CTA, çıpa, sekme geçişi) SAYILMAZ.
     Ek güvenlik: sekme geçişi/hashchange sonrası kısa süre sayılmaz; tek olayda ekran yüksekliğinin 1.75 katından büyük sıçrama sayılmaz.
   • Aktif süre: ardışık sayılan scroll olayları arasındaki boşluk ≤ BOSTA_MS ise o boşluk eklenir (interval / sürekli rAF yok).
   • UI güncellemesi: scroll olayında en çok bir requestAnimationFrame; yazma: scroll bittikten sonra tek seferlik zamanlayıcı (+ en çok 5 sn'de bir). */
(function () {
  "use strict";
  var D = document, W = window;
  var SCROLL_METRE_PER_VIEWPORT = 25;   // TEK YERDE SABİT: 1 ekran yüksekliği = 25 m sanal mesafe
  var ZIPLAMA = 1.75;                   // tek olayda bu kadar ekrandan büyük sıçrama = programatik kabul edilir
  var BOSTA_MS = 350;                   // son sayılan olaydan bu süre sonra aktivite biter
  var BLOK_MS = 700;                    // sekme geçişi / hashchange sonrası yok sayma penceresi
  var YAZ_ARALIK = 5000;                // kesintisiz kaydırmada en çok bu aralıkla localStorage'a yaz
  var KEY = "f1-scroll-telemetry";

  // ---- pist karşılaştırması: uzunluk verisi mevcut proje verisinden (icerik-pistler.js) ----
  var PISTLER = [["monaco", "Monaco"], ["monza", "Monza"], ["spa", "Spa"], ["silverstone", "Silverstone"], ["suzuka", "Suzuka"]];
  function pistUzunluk(id) {
    var P = W.ICERIK_PISTLER && W.ICERIK_PISTLER.pistler, p = P && P[id];
    return p && typeof p.uzunlukKm === "number" ? p.uzunlukKm : null;
  }
  // Eşikler (sanal km, BU OTURUM). Her eşikte mesaj anahtarı değişir → mesaj yalnızca eşikte güncellenir.
  function mesaj(km) {
    var mon = pistUzunluk("monaco"), mnz = pistUzunluk("monza"), spa = pistUzunluk("spa");
    function tur(ad, L) { var n = Math.max(1, Math.round(km / L)); return ad + "'da yaklaşık " + n + " tur."; }
    if (km >= 20 && mnz) { var n20 = Math.max(1, Math.round(km / mnz)); return { k: "20|" + n20, t: "Uzun stint. " + tur("Monza", mnz) }; }
    if (km >= 10 && mnz) { var n10 = Math.max(1, Math.round(km / mnz)); return { k: "10|" + n10, t: tur("Monza", mnz) }; }
    if (spa && km >= spa) { return { k: "spa", t: tur("Spa", spa) }; }
    if (mnz && km >= mnz) { return { k: "monza", t: tur("Monza", mnz) }; }
    if (mon && km >= mon) { return { k: "monaco", t: tur("Monaco", mon) }; }
    if (km >= 3) { return { k: "3", t: "Artık gerçek bir stint'e dönüştü." }; }
    if (km >= 0.5) { return { k: "0.5", t: "Isınma turu tamam." }; }
    return { k: "", t: "" };
  }

  // ---- kalıcı veri ----
  var bellek = null;   // localStorage yoksa
  function oku() {
    var o = { totalPx: 0, totalActiveMs: 0, totalVirtualKm: 0 };
    try {
      var s = W.localStorage.getItem(KEY); var j = s ? JSON.parse(s) : bellek;
      if (j && typeof j === "object") {
        ["totalPx", "totalActiveMs", "totalVirtualKm"].forEach(function (a) { var v = +j[a]; if (isFinite(v) && v > 0) { o[a] = v; } });
      }
    } catch (e) { if (bellek) { o = bellek; } }
    return o;
  }
  function yaz(o) {
    var s = { totalPx: Math.round(o.totalPx), totalActiveMs: Math.round(o.totalActiveMs), totalVirtualKm: Math.round(o.totalVirtualKm * 10000) / 10000 };
    try { W.localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { bellek = s; }
  }

  // ---- durum ----
  var S = {
    prevY: 0, uT: 0, surukle: false, blok: 0, lt: 0, son: 0,
    ses: { px: 0, vp: 0, ms: 0, km: 0 },      // bu oturum (sayfa açıldığından beri)
    bek: { px: 0, ms: 0, km: 0 },             // henüz yazılmamış fark
    tot: oku(),                               // son okunan/yazılan toplam
    raf: 0, idle: 0, degisti: false, sonYaz: 0, mesajK: "", sifirOnay: 0, sifirT: 0, yazim: 0, tepki: 0
  };
  function now() { return (W.performance && performance.now) ? performance.now() : Date.now(); }
  function $(id) { return D.getElementById(id); }
  function scrollY() { return W.pageYOffset || (D.documentElement && D.documentElement.scrollTop) || 0; }
  S.prevY = scrollY();

  // ---- kullanıcı girdisi pencereleri ----
  function girdi(ms) { var t = now() + ms; if (t > S.uT) { S.uT = t; } }
  var hareket = false;
  D.addEventListener("wheel", function () { girdi(900); }, { passive: true, capture: true });
  D.addEventListener("touchmove", function () { hareket = true; girdi(1600); }, { passive: true, capture: true });
  D.addEventListener("touchend", function () { if (hareket) { girdi(1600); hareket = false; } }, { passive: true, capture: true });
  D.addEventListener("touchcancel", function () { if (hareket) { girdi(1600); hareket = false; } }, { passive: true, capture: true });
  D.addEventListener("keydown", function (e) {
    var k = e.key;
    if (k !== "PageDown" && k !== "PageUp" && k !== "Home" && k !== "End" && k !== "ArrowDown" && k !== "ArrowUp" && k !== " " && k !== "Spacebar") { return; }
    var t = e.target, tg = t && t.tagName;
    if (tg === "INPUT" || tg === "TEXTAREA" || tg === "SELECT" || (t && t.isContentEditable)) { return; }
    girdi(700);
  }, { passive: true, capture: true });
  function surukle(e) { if (e.target === D.documentElement || e.target === D) { S.surukle = true; } }
  function birak() { if (S.surukle) { S.surukle = false; girdi(300); } }
  D.addEventListener("pointerdown", surukle, { passive: true, capture: true });
  D.addEventListener("mousedown", surukle, { passive: true, capture: true });
  D.addEventListener("pointerup", birak, { passive: true, capture: true });
  D.addEventListener("mouseup", birak, { passive: true, capture: true });
  D.addEventListener("pointercancel", birak, { passive: true, capture: true });

  // sekme geçişi (NAV v3 sekmeAc → "f1-sekme") ve çıpa: programatik; kısa süre say(ma)
  function blokla() { S.blok = now() + BLOK_MS; S.uT = 0; S.surukle = false; }
  D.addEventListener("f1-sekme", blokla);
  W.addEventListener("hashchange", blokla);

  // ---- sayım ----
  function say(d, n) {
    var vh = W.innerHeight || D.documentElement.clientHeight || 1;
    var vp = d / vh, km = vp * SCROLL_METRE_PER_VIEWPORT / 1000;
    S.ses.px += d; S.ses.vp += vp; S.ses.km += km;
    S.bek.px += d; S.bek.km += km;
    if (S.lt && n - S.lt <= BOSTA_MS) { var dt = n - S.lt; S.ses.ms += dt; S.bek.ms += dt; }
    S.lt = n; S.son = n;
  }
  function olay() {
    var n = now(), y = scrollY(), d = Math.abs(y - S.prevY);
    S.prevY = y;
    if (!d) { return; }
    if (n < S.blok) { return; }
    if (!(S.surukle || n < S.uT)) { return; }                      // girdisiz scroll = programatik
    var vh = W.innerHeight || D.documentElement.clientHeight || 1;
    if (d > ZIPLAMA * vh) { return; }                              // dev sıçrama
    say(d, n);
    if (!S.raf) { S.raf = W.requestAnimationFrame(guncelle); }
    if (!S.idle) { S.idle = W.setTimeout(bitis, BOSTA_MS); }
    if (n - S.sonYaz > YAZ_ARALIK) { yazDurum(); }
  }
  W.addEventListener("scroll", olay, { passive: true });

  function bitis() {
    S.idle = 0;
    var kalan = BOSTA_MS - (now() - S.son);
    if (kalan > 5) { S.idle = W.setTimeout(bitis, kalan); return; }  // arada yeni olay geldi
    S.lt = 0;
    yazDurum();
    if (S.raf) { W.cancelAnimationFrame(S.raf); S.raf = 0; }
    guncelle(true);
  }
  function yazDurum() {
    S.sonYaz = now();
    if (!S.bek.px && !S.bek.ms && !S.bek.km) { return; }
    var o = oku();                                                  // diğer sekmelerin yazdığıyla birleşir
    o.totalPx += S.bek.px; o.totalActiveMs += S.bek.ms; o.totalVirtualKm += S.bek.km;
    yaz(o); S.tot = o; S.bek = { px: 0, ms: 0, km: 0 };
  }
  function toplamKm() { return S.tot.totalVirtualKm + S.bek.km; }
  function toplamMs() { return S.tot.totalActiveMs + S.bek.ms; }

  // ---- biçim ----
  function kmYaz(km) { return km >= 100 ? km.toFixed(1) : km.toFixed(2); }
  function sureYaz(ms) {
    var s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    function p(v) { return (v < 10 ? "0" : "") + v; }
    return h ? (h + ":" + p(m) + ":" + p(x)) : (p(m) + ":" + p(x));
  }
  function hizYaz() {
    if (S.ses.ms < 500) { return "—"; }                             // anlamsız spike olmasın
    return (S.ses.vp / (S.ses.ms / 1000)).toFixed(1);
  }

  // ---- UI ----
  var U = { dugme: null, km: null, pop: null, satir: {}, msg: null, sifirOturum: null, sifirTum: null, ac: false };
  function hafifOyna(el, ad) { try { if (el && W.MotionV1 && MotionV1.oyna) { MotionV1.oyna(el, ad); } } catch (e) { /* önemsiz */ } }
  function yazMetin(el, t) { if (el && el.textContent !== t) { el.textContent = t; return true; } return false; }

  function guncelle(bitti) {
    S.raf = 0;
    if (!U.dugme) { return; }
    var km = S.ses.km, t = kmYaz(km);
    if (yazMetin(U.km, t)) { S.degisti = true; }
    if (bitti === true && S.degisti) { S.degisti = false; hafifOyna(U.km, "sw"); }   // sayı değişimi: scroll boyunca değişenler için bitişte tek hafif geçiş
    var ad = "Scroll telemetry: bu oturum " + t + " km (sanal)";
    if (U.dugme.getAttribute("aria-label") !== ad) { U.dugme.setAttribute("aria-label", ad); U.dugme.title = "Scroll telemetry (sanal): " + t + " km"; }
    var m = mesaj(km);
    if (m.k !== S.mesajK) {
      S.mesajK = m.k;
      if (U.msg) {
        U.msg.hidden = !m.t; yazMetin(U.msg, m.t);
        if (m.t && U.ac) { hafifOyna(U.msg, "panel"); }             // eşik mesajı: tek seferlik küçük reveal
      }
      if (m.t) { hafifOyna(U.dugme, "sw"); }
    }
    if (U.ac) { popYaz(); }
  }
  function popYaz() {
    yazMetin(U.satir.oturum, kmYaz(S.ses.km) + " km");
    yazMetin(U.satir.toplam, kmYaz(toplamKm()) + " km");
    yazMetin(U.satir.sure, sureYaz(S.ses.ms));
    var h = hizYaz(); yazMetin(U.satir.hiz, h === "—" ? "—" : h + " ekran/sn");
  }

  function mk(tag, id, cls, html) { var e = D.createElement(tag); if (id) { e.id = id; } if (cls) { e.className = cls; } if (html) { e.innerHTML = html; } return e; }
  function kur() {
    if (U.dugme) { return true; }
    var bar = $("rc-bar"), sag = bar && bar.querySelector(".rc-sag"); if (!sag) { return false; }
    var b = mk("button", "nv-scroll", "nv-tb st-dugme",
      "<svg class='st-ik' viewBox='0 0 24 24' width='16' height='16' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M4.5 17a8.5 8.5 0 1 1 15 0'/><path d='M12 14l4-5'/><circle cx='12' cy='14' r='1.2'/></svg>" +
      "<span class='st-ad'>SCROLL <b id='st-km'>0.00</b> KM</span>");
    b.type = "button"; b.setAttribute("aria-haspopup", "true"); b.setAttribute("aria-expanded", "false"); b.setAttribute("aria-controls", "nv-scroll-pop");
    b.title = "Scroll telemetry (sanal)";
    var p = mk("div", "nv-scroll-pop", "nv-pop st-pop",
      "<p class='nv-pop-b'>SCROLL TELEMETRY</p>" +
      "<dl class='st-liste'>" +
      "<div><dt>Bu oturum</dt><dd id='st-oturum'>0.00 km</dd></div>" +
      "<div><dt>Toplam</dt><dd id='st-toplam'>0.00 km</dd></div>" +
      "<div><dt>Aktif kaydırma</dt><dd id='st-sure'>00:00</dd></div>" +
      "<div><dt>Ortalama</dt><dd id='st-hiz'>—</dd></div>" +
      "</dl>" +
      "<p class='st-msg' id='st-msg' hidden></p>" +
      "<p class='st-not'>Sanal ölçüm: 1 ekran = " + SCROLL_METRE_PER_VIEWPORT + " m. Yalnızca bu cihazda tutulur.</p>" +
      "<div class='st-alt'><button type='button' id='st-sifir-oturum' class='st-sifir'>Oturumu sıfırla</button>" +
      "<button type='button' id='st-sifir-tum' class='st-sifir'>Tüm geçmişi sıfırla</button></div>");
    p.hidden = true; p.setAttribute("role", "group"); p.setAttribute("aria-label", "Scroll telemetry");
    sag.appendChild(b); bar.appendChild(p);
    U.dugme = b; U.km = $("st-km"); U.pop = p; U.msg = $("st-msg");
    U.satir = { oturum: $("st-oturum"), toplam: $("st-toplam"), sure: $("st-sure"), hiz: $("st-hiz") };
    U.sifirOturum = $("st-sifir-oturum"); U.sifirTum = $("st-sifir-tum");
    guncelle();
    return true;
  }
  function popAc() { if (!U.pop) { return; } U.pop.hidden = false; U.dugme.setAttribute("aria-expanded", "true"); U.ac = true; popYaz(); }
  function popKapat() {
    if (!U.pop || U.pop.hidden) { U.ac = false; return; }
    U.pop.hidden = true; U.dugme.setAttribute("aria-expanded", "false"); U.ac = false; onayIptal();
  }
  function onayIptal() {
    if (S.sifirT) { W.clearTimeout(S.sifirT); S.sifirT = 0; }
    S.sifirOnay = 0; if (U.sifirTum) { U.sifirTum.textContent = "Tüm geçmişi sıfırla"; U.sifirTum.removeAttribute("data-onay"); }
  }
  function oturumSifirla() { S.ses = { px: 0, vp: 0, ms: 0, km: 0 }; S.lt = 0; S.mesajK = ""; guncelle(); }
  function tumunuSifirla() {
    S.ses = { px: 0, vp: 0, ms: 0, km: 0 }; S.bek = { px: 0, ms: 0, km: 0 }; S.lt = 0; S.mesajK = "";
    S.tot = { totalPx: 0, totalActiveMs: 0, totalVirtualKm: 0 }; yaz(S.tot); guncelle();
  }

  D.addEventListener("click", function (e) {
    var t = e.target, c = t && t.closest ? t.closest.bind(t) : null; if (!c) { return; }
    if (c("#nv-scroll")) { if (U.ac) { popKapat(); } else { popAc(); } return; }
    if (c("#st-sifir-oturum")) { oturumSifirla(); onayIptal(); return; }
    if (c("#st-sifir-tum")) {
      if (!S.sifirOnay) {                                           // yanlışlıkla dokunmaya karşı ikinci adım
        S.sifirOnay = 1; U.sifirTum.textContent = "Emin misin? Tekrar dokun"; U.sifirTum.setAttribute("data-onay", "1");
        S.sifirT = W.setTimeout(onayIptal, 4000);
      } else { onayIptal(); tumunuSifirla(); }
      return;
    }
    if (U.ac && !c("#nv-scroll-pop")) { popKapat(); }
  });
  D.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && U.ac) { popKapat(); try { U.dugme.focus(); } catch (x) { /* önemsiz */ } }
  });
  D.addEventListener("visibilitychange", function () { if (D.hidden) { yazDurum(); } });
  W.addEventListener("pagehide", yazDurum);

  function hazir() {
    if (kur()) { return; }
    if (W.MutationObserver) {                                       // #rc-bar geç eklenirse; kurulunca bırakılır
      var mo = new MutationObserver(function () { if (kur()) { mo.disconnect(); } });
      mo.observe(D.body || D.documentElement, { childList: true, subtree: true });
    }
  }
  if (D.readyState === "loading") { D.addEventListener("DOMContentLoaded", hazir); } else { hazir(); }

  W.ScrollTelemetry = {
    METRE: SCROLL_METRE_PER_VIEWPORT, KEY: KEY, mesaj: mesaj, kmYaz: kmYaz, sureYaz: sureYaz,
    durum: function () { return { oturum: { px: S.ses.px, vp: S.ses.vp, ms: S.ses.ms, km: S.ses.km }, toplam: { km: toplamKm(), ms: toplamMs() }, hiz: hizYaz() }; },
    yaz: yazDurum
  };
})();
