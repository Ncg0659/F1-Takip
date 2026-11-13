/* F1 TAKİP service worker — F1-TAKIP-v3.0.6-PWA1
   • Yalnız YEREL (aynı origin, kapsam içi) statik dosyalar: app shell + CSS/JS + ikonlar + manifest.
   • Dış kaynaklar (Jolpica, OpenF1, Bluesky/Race Feed, hava durumu, CDN) asla yakalanmaz: fetch olayında respondWith çağrılmaz → doğrudan ağ. Canlı veri stale cache'ten gösterilmez.
   • index.html / gezinme: network-first (no-cache ile yeniden doğrulama), ağ yoksa önbellekteki kabuk.
   • Statik varlıklar (?v=3.0.6 sürümlü): cache-first. Sürüm değişince yeni cache adı + activate'te eski F1-TAKIP-* cache'leri silinir.
   • Başka projelerin cache'lerine dokunmaz (yalnız "F1-TAKIP-" önekli olanlar). Zorla yeniden yükleme YOK. */
"use strict";
var VERSION = "F1-TAKIP-v3.0.6-PWA1";
var PREFIX = "F1-TAKIP-";
var KOK = new URL("./", self.location).pathname;           // örn. /F1-Takip/  (GitHub Pages proje yolu)
var KABUK = new URL("index.html", self.location).href;
var PRECACHE = [
  "./",
  "./index.html",
  "./favicon.ico",
  "./favicon-32.png",
  "./favicon-16.png",
  "./apple-touch-icon.png",
  "./manifest.webmanifest",
  "./diger-seriler.js?v=3.0.6",
  "./yaris-notlari.js?v=3.0.6",
  "./notlar-kaynaklar.js?v=3.0.6",
  "./notlar-motor.js?v=3.0.6",
  "./tasarim.js?v=3.0.6",
  "./seri-ayarlari.js?v=3.0.6",
  "./jolpica-istemci.js?v=3.0.6",
  "./openf1-veri.js?v=3.0.6",
  "./hafta-veri.js?v=3.0.6",
  "./hafta-state.js?v=3.0.6",
  "./program-yardimci.js?v=3.0.6",
  "./program-degisiklik.js?v=3.0.6",
  "./hafta-baglam.js?v=3.0.6",
  "./baglam-ui.js?v=3.0.6",
  "./race-control.js?v=3.0.6",
  "./seans-olaylari.js?v=3.0.6",
  "./laps-veri.js?v=3.0.6",
  "./tur-analizi.js?v=3.0.6",
  "./overtakes-veri.js?v=3.0.6",
  "./gecisler.js?v=3.0.6",
  "./pit-veri.js?v=3.0.6",
  "./pitler.js?v=3.0.6",
  "./seans-hava-veri.js?v=3.0.6",
  "./seans-hava.js?v=3.0.6",
  "./v3-bilesen.js?v=3.0.6",
  "./hafta-ui.js?v=3.0.6",
  "./gun-v3.js?v=3.0.6",
  "./yaris-v3.js?v=3.0.6",
  "./bugun-v3.js?v=3.0.6",
  "./nav-v3.js?v=3.0.6",
  "./motion-v1.js?v=3.0.6",
  "./motion-v2.js?v=3.0.6",
  "./favori-v1.js?v=3.0.6",
  "./sezon-veri.js?v=3.0.6",
  "./pist-siluetleri.js?v=3.0.6",
  "./sezon-takvim.js?v=3.0.6",
  "./yorum-motoru.js?v=3.0.6",
  "./icerik-sozluk.js?v=3.0.6",
  "./icerik-lastik.js?v=3.0.6",
  "./icerik-sozluk-a3.js?v=3.0.6",
  "./icerik-sozluk-a4.js?v=3.0.6",
  "./icerik-sozluk-v2.js?v=3.0.6",
  "./ogren-ui.js?v=3.0.6",
  "./ogren-v2.js?v=3.0.6",
  "./scroll-telemetry.js?v=3.0.6",
  "./detay-panel.js?v=3.0.6",
  "./detay-sezon.js?v=3.0.6",
  "./sezon-hesap.js?v=3.0.6",
  "./sezon-analiz-veri.js?v=3.0.6",
  "./svg-grafik.js?v=3.0.6",
  "./analiz-merkezi.js?v=3.0.6",
  "./sezon-hesap-a32.js?v=3.0.6",
  "./analiz-form.js?v=3.0.6",
  "./pilot-karsilastirma.js?v=3.0.6",
  "./sezon-hesap-a33.js?v=3.0.6",
  "./analiz-sprint.js?v=3.0.6",
  "./pist-siniflandirma.js?v=3.0.6",
  "./sezon-hesap-a34.js?v=3.0.6",
  "./analiz-pist.js?v=3.0.6",
  "./lastik-hesap.js?v=3.0.6",
  "./openf1-stint.js?v=3.0.6",
  "./analiz-lastik.js?v=3.0.6",
  "./ghost-hesap.js?v=3.0.6",
  "./ghost-lap.js?v=3.0.6",
  "./icerik-pilotlar.js?v=3.0.6",
  "./icerik-takimlar.js?v=3.0.6",
  "./profil-veri.js?v=3.0.6",
  "./profil-pilot.js?v=3.0.6",
  "./profil-takim.js?v=3.0.6",
  "./profil-giris.js?v=3.0.6",
  "./icerik-pistler.js?v=3.0.6",
  "./pist-hesap.js?v=3.0.6",
  "./profil-pist.js?v=3.0.6",
  "./hafta-bilmen.js?v=3.0.6",
  "./arama.js?v=3.0.6",
  "./arama-ui.js?v=3.0.6",
  "./feed-canli.js?v=3.0.6",
  "./ticker.js?v=3.0.6",
  "./yaris-ozet-hesap.js?v=3.0.6",
  "./yaris-ozet-v2-hesap.js?v=3.0.6",
  "./yaris-ozet-v2.js?v=3.0.6",
  "./yaris-ozet.js?v=3.0.6",
  "./ui-final.js?v=3.0.6",
  "./diger-ui.js?v=3.0.6",
  "./pwa.js?v=3.0.6",
  "./tasarim.css?v=3.0.6",
  "./v3-bilesen.css?v=3.0.6",
  "./hafta.css?v=3.0.6",
  "./gun-v3.css?v=3.0.6",
  "./yaris-v3.css?v=3.0.6",
  "./seans-olaylari.css?v=3.0.6",
  "./sezon-takvim.css?v=3.0.6",
  "./yorum-motoru.css?v=3.0.6",
  "./ogren.css?v=3.0.6",
  "./detay-panel.css?v=3.0.6",
  "./svg-grafik.css?v=3.0.6",
  "./analiz-merkezi.css?v=3.0.6",
  "./analiz-form.css?v=3.0.6",
  "./pilot-karsilastirma.css?v=3.0.6",
  "./analiz-sprint.css?v=3.0.6",
  "./analiz-pist.css?v=3.0.6",
  "./analiz-lastik.css?v=3.0.6",
  "./ghost-lap.css?v=3.0.6",
  "./profil.css?v=3.0.6",
  "./profil-pist.css?v=3.0.6",
  "./hafta-bilmen.css?v=3.0.6",
  "./arama.css?v=3.0.6",
  "./ticker.css?v=3.0.6",
  "./yaris-ozet.css?v=3.0.6",
  "./ui-final.css?v=3.0.6",
  "./diger-ui.css?v=3.0.6",
  "./v3-rozet.css?v=3.0.6",
  "./bugun-v3.css?v=3.0.6",
  "./nav-v3.css?v=3.0.6",
  "./motion-v1.css?v=3.0.6",
  "./motion-v2.css?v=3.0.6",
  "./polish-v1.css?v=3.0.6",
  "./telemetry-data.js?v=3.0.6",
  "./prediction-data.js?v=3.0.6",
  "./prediction-engine.js?v=3.0.6",
  "./prediction-ui.js?v=3.0.6",
  "./prediction-ui.css?v=3.0.6",
  "./favori-v1.css?v=3.0.6",
  "./ogren-v2.css?v=3.0.6",
  "./scroll-telemetry.css?v=3.0.6",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (c) {
      return c.addAll(PRECACHE.map(function (u) { return new Request(u, { cache: "reload" }); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k.indexOf(PREFIX) === 0 && k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function agOnce(req) {
  return fetch(req, { cache: "no-cache" }).then(function (r) {
    if (r && r.ok) { var kopya = r.clone(); caches.open(VERSION).then(function (c) { c.put(KABUK, kopya); }); }
    return r;
  }).catch(function () {
    return caches.match(KABUK, { ignoreSearch: true }).then(function (m) { return m || Response.error(); });
  });
}
function onbellekOnce(req) {
  return caches.match(req).then(function (m) {
    if (m) { return m; }
    return fetch(req).then(function (r) {
      if (r && r.ok && r.type === "basic") { var kopya = r.clone(); caches.open(VERSION).then(function (c) { c.put(req, kopya); }); }
      return r;
    });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") { return; }
  var u = new URL(req.url);
  if (u.origin !== self.location.origin) { return; }         // dış kaynak/API: SW karışmaz
  if (u.pathname.indexOf(KOK) !== 0) { return; }             // kapsam dışı
  var kabuk = req.mode === "navigate" || u.pathname === KOK || u.pathname === KOK + "index.html";
  if (req.mode === "navigate" && !(u.pathname === KOK || u.pathname === KOK + "index.html")) { return; }
  e.respondWith(kabuk ? agOnce(req) : onbellekOnce(req));
});
