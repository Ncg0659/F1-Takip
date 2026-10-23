/* PWA v1 — yalnız (1) service worker kaydı, (2) tarayıcı tema rengini uygulamanın koyu/açık temasıyla eşleme.
   • Yeni fetch / polling / zorla reload YOK. Kayıt göreli ('./sw.js', scope './') → GitHub Pages /F1-Takip/ alt yolunda doğru çalışır.
   • Yalnız güvenli bağlamda (https veya localhost) kaydolur; file:// ve diğerlerinde sessizce atlanır. */
(function () {
  "use strict";
  var D = document, W = window;
  var TEMA_RENK = { koyu: "#0f1722", acik: "#eef1f5" };       // index.html :root --zemin değerleri

  function renkYaz() {
    try {
      var t = D.documentElement.getAttribute("data-tema"), m = D.querySelector('meta[name="theme-color"]');
      if (m && TEMA_RENK[t] && m.getAttribute("content") !== TEMA_RENK[t]) { m.setAttribute("content", TEMA_RENK[t]); }
    } catch (e) { /* önemsiz */ }
  }
  renkYaz();
  try { if (W.MutationObserver) { new MutationObserver(renkYaz).observe(D.documentElement, { attributes: true, attributeFilter: ["data-tema"] }); } } catch (e) { /* önemsiz */ }

  function guvenli() { var h = W.location.hostname; return W.location.protocol === "https:" || h === "localhost" || h === "127.0.0.1" || h === "[::1]"; }
  if (!("serviceWorker" in W.navigator) || !guvenli()) { return; }
  function kaydol() { W.navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(function () { /* sessiz: uygulama SW'siz de çalışır */ }); }
  if (D.readyState === "complete") { kaydol(); } else { W.addEventListener("load", kaydol); }
})();
