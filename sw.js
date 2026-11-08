/* F1 TAKİP service worker — F1-TAKIP-v3.0.5-PWA1
   • Yalnız YEREL (aynı origin, kapsam içi) statik dosyalar: app shell + CSS/JS + ikonlar + manifest.
   • Dış kaynaklar (Jolpica, OpenF1, Bluesky/Race Feed, hava durumu, CDN) asla yakalanmaz: fetch olayında respondWith çağrılmaz → doğrudan ağ. Canlı veri stale cache'ten gösterilmez.
   • index.html / gezinme: network-first (no-cache ile yeniden doğrulama), ağ yoksa önbellekteki kabuk.
   • Statik varlıklar (?v=3.0.5 sürümlü): cache-first. Sürüm değişince yeni cache adı + activate'te eski F1-TAKIP-* cache'leri silinir.
   • Başka projelerin cache'lerine dokunmaz (yalnız "F1-TAKIP-" önekli olanlar). Zorla yeniden yükleme YOK. */
"use strict";
var VERSION = "F1-TAKIP-v3.0.5-PWA1";
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
  "./diger-seriler.js?v=3.0.5",
  "./yaris-notlari.js?v=3.0.5",
  "./notlar-kaynaklar.js?v=3.0.5",
  "./notlar-motor.js?v=3.0.5",
  "./tasarim.js?v=3.0.5",
  "./seri-ayarlari.js?v=3.0.5",
  "./jolpica-istemci.js?v=3.0.5",
  "./openf1-veri.js?v=3.0.5",
  "./hafta-veri.js?v=3.0.5",
  "./hafta-state.js?v=3.0.5",
  "./program-yardimci.js?v=3.0.5",
  "./program-degisiklik.js?v=3.0.5",
  "./hafta-baglam.js?v=3.0.5",
  "./baglam-ui.js?v=3.0.5",
  "./race-control.js?v=3.0.5",
  "./seans-olaylari.js?v=3.0.5",
  "./laps-veri.js?v=3.0.5",
  "./tur-analizi.js?v=3.0.5",
  "./overtakes-veri.js?v=3.0.5",
  "./gecisler.js?v=3.0.5",
  "./pit-veri.js?v=3.0.5",
  "./pitler.js?v=3.0.5",
  "./seans-hava-veri.js?v=3.0.5",
  "./seans-hava.js?v=3.0.5",
  "./v3-bilesen.js?v=3.0.5",
  "./hafta-ui.js?v=3.0.5",
  "./gun-v3.js?v=3.0.5",
  "./yaris-v3.js?v=3.0.5",
  "./bugun-v3.js?v=3.0.5",
  "./nav-v3.js?v=3.0.5",
  "./motion-v1.js?v=3.0.5",
  "./motion-v2.js?v=3.0.5",
  "./favori-v1.js?v=3.0.5",
  "./sezon-veri.js?v=3.0.5",
  "./pist-siluetleri.js?v=3.0.5",
  "./sezon-takvim.js?v=3.0.5",
  "./yorum-motoru.js?v=3.0.5",
  "./icerik-sozluk.js?v=3.0.5",
  "./icerik-lastik.js?v=3.0.5",
  "./icerik-sozluk-a3.js?v=3.0.5",
  "./icerik-sozluk-a4.js?v=3.0.5",
  "./icerik-sozluk-v2.js?v=3.0.5",
  "./ogren-ui.js?v=3.0.5",
  "./ogren-v2.js?v=3.0.5",
  "./scroll-telemetry.js?v=3.0.5",
  "./detay-panel.js?v=3.0.5",
  "./detay-sezon.js?v=3.0.5",
  "./sezon-hesap.js?v=3.0.5",
  "./sezon-analiz-veri.js?v=3.0.5",
  "./svg-grafik.js?v=3.0.5",
  "./analiz-merkezi.js?v=3.0.5",
  "./sezon-hesap-a32.js?v=3.0.5",
  "./analiz-form.js?v=3.0.5",
  "./pilot-karsilastirma.js?v=3.0.5",
  "./sezon-hesap-a33.js?v=3.0.5",
  "./analiz-sprint.js?v=3.0.5",
  "./pist-siniflandirma.js?v=3.0.5",
  "./sezon-hesap-a34.js?v=3.0.5",
  "./analiz-pist.js?v=3.0.5",
  "./lastik-hesap.js?v=3.0.5",
  "./openf1-stint.js?v=3.0.5",
  "./analiz-lastik.js?v=3.0.5",
  "./ghost-hesap.js?v=3.0.5",
  "./ghost-lap.js?v=3.0.5",
  "./icerik-pilotlar.js?v=3.0.5",
  "./icerik-takimlar.js?v=3.0.5",
  "./profil-veri.js?v=3.0.5",
  "./profil-pilot.js?v=3.0.5",
  "./profil-takim.js?v=3.0.5",
  "./profil-giris.js?v=3.0.5",
  "./icerik-pistler.js?v=3.0.5",
  "./pist-hesap.js?v=3.0.5",
  "./profil-pist.js?v=3.0.5",
  "./hafta-bilmen.js?v=3.0.5",
  "./arama.js?v=3.0.5",
  "./arama-ui.js?v=3.0.5",
  "./feed-canli.js?v=3.0.5",
  "./ticker.js?v=3.0.5",
  "./yaris-ozet-hesap.js?v=3.0.5",
  "./yaris-ozet-v2-hesap.js?v=3.0.5",
  "./yaris-ozet-v2.js?v=3.0.5",
  "./yaris-ozet.js?v=3.0.5",
  "./ui-final.js?v=3.0.5",
  "./diger-ui.js?v=3.0.5",
  "./pwa.js?v=3.0.5",
  "./tasarim.css?v=3.0.5",
  "./v3-bilesen.css?v=3.0.5",
  "./hafta.css?v=3.0.5",
  "./gun-v3.css?v=3.0.5",
  "./yaris-v3.css?v=3.0.5",
  "./seans-olaylari.css?v=3.0.5",
  "./sezon-takvim.css?v=3.0.5",
  "./yorum-motoru.css?v=3.0.5",
  "./ogren.css?v=3.0.5",
  "./detay-panel.css?v=3.0.5",
  "./svg-grafik.css?v=3.0.5",
  "./analiz-merkezi.css?v=3.0.5",
  "./analiz-form.css?v=3.0.5",
  "./pilot-karsilastirma.css?v=3.0.5",
  "./analiz-sprint.css?v=3.0.5",
  "./analiz-pist.css?v=3.0.5",
  "./analiz-lastik.css?v=3.0.5",
  "./ghost-lap.css?v=3.0.5",
  "./profil.css?v=3.0.5",
  "./profil-pist.css?v=3.0.5",
  "./hafta-bilmen.css?v=3.0.5",
  "./arama.css?v=3.0.5",
  "./ticker.css?v=3.0.5",
  "./yaris-ozet.css?v=3.0.5",
  "./ui-final.css?v=3.0.5",
  "./diger-ui.css?v=3.0.5",
  "./v3-rozet.css?v=3.0.5",
  "./bugun-v3.css?v=3.0.5",
  "./nav-v3.css?v=3.0.5",
  "./motion-v1.css?v=3.0.5",
  "./motion-v2.css?v=3.0.5",
  "./favori-v1.css?v=3.0.5",
  "./ogren-v2.css?v=3.0.5",
  "./scroll-telemetry.css?v=3.0.5",
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
