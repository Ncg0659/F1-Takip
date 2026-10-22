/* A3.1 — Saf SVG grafik altyapısı (harici kütüphane yok, CDN yok). Veri çekmez, hiçbir mevcut sisteme dokunmaz.
     SvgGrafik.cizgi(kap, { x:[etiket], xAd:[ipucu başlığı], seriler:[{id, kod, ad, renk, kesik, soluk, deger:[...]}],
                            sifirCizgisi, ipucu(i)->html, ozet(i)->düz metin, etiket })   // çok serili çizgi grafik
     SvgGrafik.cubuk(kap, { satirlar:[{kod, ad, renk, deger}], etiket })                   // yatay çubuk grafik
   Renkler CSS renk dizgisi olarak verilir (örn. "var(--a3-c-ferrari)"); açık/koyu tema CSS'ten gelir.
   Erişilebilirlik: svg odaklanabilir (ok tuşları / Home / End / Esc), canlı bölge metni, dokunmatikte dikey kaydırma korunur. */
(function () {
  "use strict";
  function esc(x) { return String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }
  function f(n) { return (Math.round(n * 10) / 10).toString(); }

  // Güzel eksen adımları: [lo, hi] -> { lo, hi, ticks }
  function eksen(lo, hi) {
    if (hi === lo) { hi = lo + 1; }
    var ham = (hi - lo) / 4, us = Math.pow(10, Math.floor(Math.log(ham) / Math.LN10)), oran = ham / us;
    var adim = (oran <= 1 ? 1 : oran <= 2 ? 2 : oran <= 5 ? 5 : 10) * us;
    var a = Math.floor(lo / adim) * adim, b = Math.ceil(hi / adim) * adim, t = [];
    for (var v = a; v <= b + adim / 1000; v += adim) { t.push(Math.round(v * 1000) / 1000); }
    return { lo: a, hi: b, ticks: t };
  }

  function cizgi(kap, o) {
    var durum = { o: o, secili: -1, genislik: 0 };
    var ipucuEl = null, srEl = null;

    function ciz() {
      var oo = durum.o, n = oo.x.length;
      var W = Math.max(260, Math.round(kap.clientWidth || 320)); durum.genislik = W;
      var H = W < 520 ? 250 : 320, m = { l: 40, r: 42, t: 14, b: 28 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
      var lo = 0, hi = 0;
      oo.seriler.forEach(function (s) { s.deger.forEach(function (v) { if (v < lo) { lo = v; } if (v > hi) { hi = v; } }); });
      var e = eksen(lo, hi);
      function X(i) { return n > 1 ? m.l + (iw * i) / (n - 1) : m.l + iw / 2; }
      function Y(v) { return m.t + ih - ((v - e.lo) / (e.hi - e.lo)) * ih; }
      durum.X = X; durum.Y = Y; durum.m = m; durum.H = H;
      var h = "<svg class='sg-svg' viewBox='0 0 " + W + " " + H + "' width='" + W + "' height='" + H + "' tabindex='0' role='group' aria-roledescription='grafik' aria-label='" + esc(oo.etiket || "Grafik") + ". Tur seçmek için sol ve sağ ok tuşlarını kullanın.'>";
      // yatay ızgara + y etiketleri
      e.ticks.forEach(function (t) {
        h += "<line class='sg-izgara" + (t === 0 && oo.sifirCizgisi ? " sg-sifir" : "") + "' x1='" + m.l + "' x2='" + (W - m.r) + "' y1='" + f(Y(t)) + "' y2='" + f(Y(t)) + "'/>";
        h += "<text class='sg-yet' x='" + (m.l - 6) + "' y='" + f(Y(t) + 4) + "' text-anchor='end'>" + esc(t) + "</text>";
      });
      // x etiketleri (sıklık: en az 24 px)
      var adim = n > 1 ? Math.max(1, Math.ceil(24 / (iw / (n - 1)))) : 1;
      for (var i = 0; i < n; i++) {
        if (i % adim === 0 || i === n - 1) { h += "<text class='sg-xet' x='" + f(X(i)) + "' y='" + (H - m.b + 16) + "' text-anchor='middle'>" + esc(oo.x[i]) + "</text>"; }
      }
      // çizgiler
      oo.seriler.forEach(function (s) {
        var d = s.deger.map(function (v, k) { return (k ? "L" : "M") + f(X(k)) + "," + f(Y(v)); }).join(" ");
        var op = s.soluk ? " sg-soluk" : "";
        h += "<g class='sg-seri" + op + "' data-id='" + esc(s.id) + "'>";
        h += "<path class='sg-cizgi' d='" + d + "' style='stroke:" + s.renk + "'" + (s.kesik ? " stroke-dasharray='7 4'" : "") + "/>";
        if (n <= 30) {
          s.deger.forEach(function (v, k) { h += "<circle class='sg-nokta' cx='" + f(X(k)) + "' cy='" + f(Y(v)) + "' r='2.3' style='stroke:" + s.renk + ";fill:" + (s.kesik ? "var(--kart)" : s.renk) + "'/>"; });
        }
        h += "</g>";
      });
      // uç etiketleri (çakışma giderme)
      var uc = oo.seriler.map(function (s) { return { s: s, y: Y(s.deger[n - 1]) }; }).sort(function (a, b) { return a.y - b.y; });
      for (var k = 1; k < uc.length; k++) { if (uc[k].y - uc[k - 1].y < 12) { uc[k].y = uc[k - 1].y + 12; } }
      uc.forEach(function (u) {
        h += "<text class='sg-uc" + (u.s.soluk ? " sg-soluk" : "") + "' x='" + (W - m.r + 6) + "' y='" + f(Math.min(u.y + 4, H - m.b + 4)) + "' style='fill:" + u.s.renk + "'>" + esc(u.s.kod) + "</text>";
      });
      // etkileşim katmanı
      h += "<g class='sg-isaret' hidden><line class='sg-rehber' y1='" + m.t + "' y2='" + (H - m.b) + "'/>";
      oo.seriler.forEach(function (s) { h += "<circle class='sg-i-nokta' r='4.2' data-id='" + esc(s.id) + "' style='stroke:" + s.renk + "'/>"; });
      h += "</g></svg><div class='sg-ipucu' hidden role='status'></div><div class='sg-sr' aria-live='polite'></div>";
      kap.classList.add("sg");
      kap.innerHTML = h;
      var svg = kap.querySelector(".sg-svg"); ipucuEl = kap.querySelector(".sg-ipucu"); srEl = kap.querySelector(".sg-sr");
      baglan(svg);
      if (durum.secili >= 0 && durum.secili < n) { sec(durum.secili, false); } else { durum.secili = -1; }
    }

    function sec(i, sesli) {
      var oo = durum.o, n = oo.x.length; if (i < 0 || i >= n) { return; }
      durum.secili = i;
      var g = kap.querySelector(".sg-isaret"); if (!g) { return; }
      g.hidden = false;
      var x = durum.X(i), rh = g.querySelector(".sg-rehber"); rh.setAttribute("x1", f(x)); rh.setAttribute("x2", f(x));
      oo.seriler.forEach(function (s) { var c = g.querySelector(".sg-i-nokta[data-id='" + s.id.replace(/'/g, "") + "']"); if (c) { c.setAttribute("cx", f(x)); c.setAttribute("cy", f(durum.Y(s.deger[i]))); c.style.fill = s.renk; } });
      var ip = ipucuEl; ip.innerHTML = oo.ipucu ? oo.ipucu(i) : ""; ip.hidden = !oo.ipucu;
      if (oo.ipucu) {
        var W = durum.genislik, sol = x + 12, gen = ip.offsetWidth || 160;
        if (sol + gen > W) { sol = Math.max(4, x - gen - 12); }
        ip.style.left = f(sol) + "px"; ip.style.top = "6px";
      }
      if (sesli !== false && srEl && oo.ozet) { srEl.textContent = oo.ozet(i); }
    }
    function temizle() { var g = kap.querySelector(".sg-isaret"); if (g) { g.hidden = true; } if (ipucuEl) { ipucuEl.hidden = true; } durum.secili = -1; }

    function indeks(e, svg) {
      var r = svg.getBoundingClientRect(), n = durum.o.x.length; if (!r.width) { return -1; }
      var px = (e.clientX - r.left) * (durum.genislik / r.width), iw = durum.genislik - durum.m.l - durum.m.r;
      if (n === 1) { return 0; }
      return Math.max(0, Math.min(n - 1, Math.round(((px - durum.m.l) / iw) * (n - 1))));
    }
    function baglan(svg) {
      svg.addEventListener("pointermove", function (e) { var i = indeks(e, svg); if (i >= 0) { sec(i, false); } });
      svg.addEventListener("pointerdown", function (e) { var i = indeks(e, svg); if (i >= 0) { sec(i); } });
      svg.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") { temizle(); } });
      svg.addEventListener("focus", function () { if (durum.secili < 0) { sec(durum.o.x.length - 1); } });
      svg.addEventListener("blur", function () { temizle(); });
      svg.addEventListener("keydown", function (e) {
        var n = durum.o.x.length, i = durum.secili < 0 ? n - 1 : durum.secili, y = true;
        if (e.key === "ArrowLeft") { i = Math.max(0, i - 1); } else if (e.key === "ArrowRight") { i = Math.min(n - 1, i + 1); }
        else if (e.key === "Home") { i = 0; } else if (e.key === "End") { i = n - 1; }
        else if (e.key === "Escape") { temizle(); return; } else { y = false; }
        if (y) { e.preventDefault(); sec(i); }
      });
    }

    var ro = null;
    if (typeof ResizeObserver === "function") {
      ro = new ResizeObserver(function () { var W = Math.round(kap.clientWidth || 0); if (W && W !== durum.genislik && kap.isConnected) { ciz(); } });
      ro.observe(kap);
    }
    ciz();
    return {
      yeniden: function (yeni) { if (yeni) { durum.o = yeni; } ciz(); },
      sec: function (i) { sec(i); },
      kapat: function () { if (ro) { ro.disconnect(); } }
    };
  }

  function metinKisalt(s, en) { s = String(s || ""); return s.length > en ? s.slice(0, Math.max(1, en - 1)) + "…" : s; }

  function cubuk(kap, o) {
    function ciz() {
      var W = Math.max(260, Math.round(kap.clientWidth || 320)), sat = o.satirlar, RH = 26, T = 6;
      var L = W < 420 ? 56 : 168, x0 = L + 6, bw = Math.max(40, W - x0 - 40), maks = 1;
      sat.forEach(function (s) { if (s.deger > maks) { maks = s.deger; } });
      var H = T * 2 + sat.length * RH;
      var aria = (o.etiket || "Çubuk grafik") + ": " + sat.map(function (s) { return s.ad + " " + s.deger; }).join(", ");
      var h = "<svg class='sg-svg sg-cubuk' viewBox='0 0 " + W + " " + H + "' width='" + W + "' height='" + H + "' role='img' aria-label='" + esc(aria) + "'>";
      sat.forEach(function (s, i) {
        var y = T + i * RH, w = Math.round((s.deger / maks) * bw * 10) / 10;
        h += "<g class='sg-satir'><title>" + esc(s.ad + ": " + s.deger) + "</title>";
        h += "<text class='sg-kod' x='0' y='" + (y + 17) + "'>" + esc(s.kod) + "</text>";
        if (W >= 420) { h += "<text class='sg-ad' x='34' y='" + (y + 17) + "'>" + esc(metinKisalt(s.ad, 18)) + "</text>"; }
        h += "<rect class='sg-zemin' x='" + x0 + "' y='" + (y + 5) + "' width='" + bw + "' height='14' rx='3'/>";
        if (w > 0) { h += "<rect class='sg-bar' x='" + x0 + "' y='" + (y + 5) + "' width='" + w + "' height='14' rx='3' style='fill:" + s.renk + "'/>"; }
        h += "<text class='sg-deger' x='" + (x0 + Math.max(w, 0) + 6) + "' y='" + (y + 17) + "'>" + esc(s.deger) + "</text></g>";
      });
      kap.classList.add("sg");
      kap.innerHTML = h + "</svg>";
      o._genislik = W;
    }
    var ro = null;
    if (typeof ResizeObserver === "function") {
      ro = new ResizeObserver(function () { var W = Math.round(kap.clientWidth || 0); if (W && W !== o._genislik && kap.isConnected) { ciz(); } });
      ro.observe(kap);
    }
    ciz();
    return { yeniden: function (yeni) { if (yeni) { o = yeni; } ciz(); }, kapat: function () { if (ro) { ro.disconnect(); } } };
  }

  window.SvgGrafik = { cizgi: cizgi, cubuk: cubuk, _ic: { eksen: eksen } };
})();
