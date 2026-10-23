/* F1 TAKİP service worker — F1-TAKIP-v3.0.1-PWA1
   • Yalnız YEREL (aynı origin, kapsam içi) statik dosyalar: app shell + CSS/JS + ikonlar + manifest.
   • Dış kaynaklar (Jolpica, OpenF1, Bluesky/Race Feed, hava durumu, CDN) asla yakalanmaz: fetch olayında respondWith çağrılmaz → doğrudan ağ. Canlı veri stale cache'ten gösterilmez.
   • index.html / gezinme: network-first (no-cache ile yeniden doğrulama), ağ yoksa önbellekteki kabuk.
   • Statik varlıklar (?v=3.0.1 sürümlü): cache-first. Sürüm değişince yeni cache adı + activate'te eski F1-TAKIP-* cache'leri silinir.
   • Başka projelerin cache'lerine dokunmaz (yalnız "F1-TAKIP-" önekli olanlar). Zorla yeniden yükleme YOK. */
"use strict";
var VERSION = "F1-TAKIP-v3.0.1-PWA1";
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
  "./diger-seriler.js?v=3.0.1",
  "./yaris-notlari.js?v=3.0.1",
  "./notlar-kaynaklar.js?v=3.0.1",
  "./notlar-motor.js?v=3.0.1",
  "./tasarim.js?v=3.0.1",
  "./seri-ayarlari.js?v=3.0.1",
  "./jolpica-istemci.js?v=3.0.1",
  "./openf1-veri.js?v=3.0.1",
  "./hafta-veri.js?v=3.0.1",
  "./hafta-state.js?v=3.0.1",
  "./program-yardimci.js?v=3.0.1",
  "./program-degisiklik.js?v=3.0.1",
  "./hafta-baglam.js?v=3.0.1",
  "./baglam-ui.js?v=3.0.1",
  "./race-control.js?v=3.0.1",
  "./seans-olaylari.js?v=3.0.1",
  "./laps-veri.js?v=3.0.1",
  "./tur-analizi.js?v=3.0.1",
  "./overtakes-veri.js?v=3.0.1",
  "./gecisler.js?v=3.0.1",
  "./pit-veri.js?v=3.0.1",
  "./pitler.js?v=3.0.1",
  "./seans-hava-veri.js?v=3.0.1",
  "./seans-hava.js?v=3.0.1",
  "./v3-bilesen.js?v=3.0.1",
  "./hafta-ui.js?v=3.0.1",
  "./gun-v3.js?v=3.0.1",
  "./yaris-v3.js?v=3.0.1",
  "./bugun-v3.js?v=3.0.1",
  "./nav-v3.js?v=3.0.1",
  "./motion-v1.js?v=3.0.1",
  "./favori-v1.js?v=3.0.1",
  "./sezon-veri.js?v=3.0.1",
  "./pist-siluetleri.js?v=3.0.1",
  "./sezon-takvim.js?v=3.0.1",
  "./yorum-motoru.js?v=3.0.1",
  "./icerik-sozluk.js?v=3.0.1",
  "./icerik-lastik.js?v=3.0.1",
  "./icerik-sozluk-a3.js?v=3.0.1",
  "./icerik-sozluk-a4.js?v=3.0.1",
  "./icerik-sozluk-v2.js?v=3.0.1",
  "./ogren-ui.js?v=3.0.1",
  "./ogren-v2.js?v=3.0.1",
  "./scroll-telemetry.js?v=3.0.1",
  "./detay-panel.js?v=3.0.1",
  "./detay-sezon.js?v=3.0.1",
  "./sezon-hesap.js?v=3.0.1",
  "./sezon-analiz-veri.js?v=3.0.1",
  "./svg-grafik.js?v=3.0.1",
  "./analiz-merkezi.js?v=3.0.1",
  "./sezon-hesap-a32.js?v=3.0.1",
  "./analiz-form.js?v=3.0.1",
  "./pilot-karsilastirma.js?v=3.0.1",
  "./sezon-hesap-a33.js?v=3.0.1",
  "./analiz-sprint.js?v=3.0.1",
  "./pist-siniflandirma.js?v=3.0.1",
  "./sezon-hesap-a34.js?v=3.0.1",
  "./analiz-pist.js?v=3.0.1",
  "./lastik-hesap.js?v=3.0.1",
  "./openf1-stint.js?v=3.0.1",
  "./analiz-lastik.js?v=3.0.1",
  "./icerik-pilotlar.js?v=3.0.1",
  "./icerik-takimlar.js?v=3.0.1",
  "./profil-veri.js?v=3.0.1",
  "./profil-pilot.js?v=3.0.1",
  "./profil-takim.js?v=3.0.1",
  "./profil-giris.js?v=3.0.1",
  "./icerik-pistler.js?v=3.0.1",
  "./pist-hesap.js?v=3.0.1",
  "./profil-pist.js?v=3.0.1",
  "./hafta-bilmen.js?v=3.0.1",
  "./arama.js?v=3.0.1",
  "./arama-ui.js?v=3.0.1",
  "./feed-canli.js?v=3.0.1",
  "./ticker.js?v=3.0.1",
  "./yaris-ozet-hesap.js?v=3.0.1",
  "./yaris-ozet-v2-hesap.js?v=3.0.1",
  "./yaris-ozet-v2.js?v=3.0.1",
  "./yaris-ozet.js?v=3.0.1",
  "./ui-final.js?v=3.0.1",
  "./diger-ui.js?v=3.0.1",
  "./pwa.js?v=3.0.1",
  "./tasarim.css?v=3.0.1",
  "./v3-bilesen.css?v=3.0.1",
  "./hafta.css?v=3.0.1",
  "./gun-v3.css?v=3.0.1",
  "./yaris-v3.css?v=3.0.1",
  "./seans-olaylari.css?v=3.0.1",
  "./sezon-takvim.css?v=3.0.1",
  "./yorum-motoru.css?v=3.0.1",
  "./ogren.css?v=3.0.1",
  "./detay-panel.css?v=3.0.1",
  "./svg-grafik.css?v=3.0.1",
  "./analiz-merkezi.css?v=3.0.1",
  "./analiz-form.css?v=3.0.1",
  "./pilot-karsilastirma.css?v=3.0.1",
  "./analiz-sprint.css?v=3.0.1",
  "./analiz-pist.css?v=3.0.1",
  "./analiz-lastik.css?v=3.0.1",
  "./profil.css?v=3.0.1",
  "./profil-pist.css?v=3.0.1",
  "./hafta-bilmen.css?v=3.0.1",
  "./arama.css?v=3.0.1",
  "./ticker.css?v=3.0.1",
  "./yaris-ozet.css?v=3.0.1",
  "./ui-final.css?v=3.0.1",
  "./diger-ui.css?v=3.0.1",
  "./v3-rozet.css?v=3.0.1",
  "./bugun-v3.css?v=3.0.1",
  "./nav-v3.css?v=3.0.1",
  "./motion-v1.css?v=3.0.1",
  "./favori-v1.css?v=3.0.1",
  "./ogren-v2.css?v=3.0.1",
  "./scroll-telemetry.css?v=3.0.1",
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
