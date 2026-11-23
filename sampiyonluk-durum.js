/* ŞAMPİYONLUK DURUMU — tek mantık. BUGÜN, SEZON, şampiyonluk hesaplayıcı, ANALİZ ve yarış özeti "lider / şampiyon /
   matematiksel olarak belli" ifadelerini YALNIZ buradan alır; veri aynıysa her ekran aynı sonucu söyler. Tahmin modeli DEĞİLDİR.
   Kural (mevcut hesaplayıcı ve tahmin motoruyla aynı): kalan en fazla puan = kalan yarış × 25 + kalan sprint × 8.
     • Kalan yarış = puan durumunun işlendiği turdan (Jolpica StandingsLists.round) SONRAKİ takvim turları.
     • Lider ile ikinci arasındaki fark kalan en fazla puandan KESİN büyükse → şampiyon matematiksel olarak belli.
     • Kalan yarış yoksa puan durumunun 1. sırası şampiyondur (resmî sıralama eşitlik bozmayı içerir).
     • Puan durumu ya da işlendiği tur bilinmiyorsa → "yok" (hiçbir iddia üretilmez).
   Saf hesap (hesapla) + sayfadaki mevcut veriden okuyan yardımcı (mevcut). Ağ isteği yok. */
(function (kok) {
  "use strict";
  var YARIS = 25, SPRINT = 8;
  function sayi(x) { var n = Number(x); return isFinite(n) ? n : null; }
  function pilot(r) {
    if (!r || !r.Driver) { return null; }
    var d = r.Driver, p = sayi(r.points);
    if (p == null) { return null; }
    return { id: d.driverId || null, kod: d.code || null, ad: ((d.givenName || "") + " " + (d.familyName || "")).trim(), soyad: d.familyName || "", puan: p };
  }
  function buyuk(s) { return String(s || "").toUpperCase(); }   // yabancı ad: "Kimi" → "KIMI" (tr büyük harf "KİMİ" yapardı)

  // girdi: { sezon, pilotlar: DriverStandings[], puanTuru: number, yarislar: Races[] }
  function hesapla(g) {
    var yok = { durum: "yok" };
    if (!g || !g.pilotlar || g.pilotlar.length < 2) { return yok; }
    var tur = sayi(g.puanTuru); if (tur == null || tur < 1) { return yok; }
    var lider = pilot(g.pilotlar[0]), ikinci = pilot(g.pilotlar[1]);
    if (!lider || !ikinci) { return yok; }
    var kalan = (g.yarislar || []).filter(function (y) { return sayi(y && y.round) > tur; });
    var kalanSprint = kalan.filter(function (y) { return !!(y && y.Sprint); }).length;
    var kalanMaks = kalan.length * YARIS + kalanSprint * SPRINT;
    var fark = lider.puan - ikinci.puan;
    var adaylar = g.pilotlar.map(pilot).filter(function (p) { return p && p.puan + kalanMaks >= lider.puan; });
    var belli = kalan.length === 0 || fark > kalanMaks;
    var o = { durum: belli ? "belli" : "acik", sezon: String(g.sezon || ""), lider: lider, ikinci: ikinci, fark: fark, puanTuru: tur,
              kalanYaris: kalan.length, kalanSprint: kalanSprint, kalanMaks: kalanMaks, adaySayisi: adaylar.length, sezonBitti: kalan.length === 0 };
    if (belli) {
      o.sampiyon = lider;
      o.manset = buyuk(lider.ad) + " " + o.sezon + " DÜNYA ŞAMPİYONU";
      o.kisa = o.sezonBitti ? "Sezon tamamlandı · " + lider.puan + " puan" : "Matematiksel olarak belli · fark " + fark + ", kalan en fazla " + kalanMaks + " puan";
    } else {
      o.manset = "LİDER " + buyuk(lider.soyad) + " · " + fark + " PUAN ÖNDE";
      o.kisa = "Kalan " + kalan.length + " yarış" + (kalanSprint ? " + " + kalanSprint + " sprint" : "") + " · en fazla " + kalanMaks + " puan · şampiyonluk şansı olan " + adaylar.length + " pilot";
    }
    return o;
  }
  // Sayfadaki mevcut veriden (index.html: BugunKaynak + SezonDurumu.puanTuru). Veri yoksa { durum: "yok" }.
  function mevcut() {
    try {
      var K = kok.BugunKaynak && kok.BugunKaynak(), sd = kok.SezonDurumu || {};
      if (!K || String(sd.sezon) !== String(K.sezon)) { return { durum: "yok" }; }
      return hesapla({ sezon: K.sezon, pilotlar: K.pilotlar, puanTuru: sd.puanTuru, yarislar: K.yarislar });
    } catch (e) { return { durum: "yok" }; }
  }
  var API = { hesapla: hesapla, mevcut: mevcut, YARIS: YARIS, SPRINT: SPRINT };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
  if (kok) { kok.SampiyonlukDurumu = API; }
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));

/* SEZON sekmesi manşeti: başlığın hemen altında tek satır (ortak mantıktan). Veri yoksa gösterilmez. */
(function () {
  "use strict";
  if (typeof document === "undefined") { return; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ciz() {
    var bas = document.getElementById("sezon-baslik"); if (!bas || !window.SampiyonlukDurumu) { return; }
    var SD = window.SampiyonlukDurumu.mevcut(), el = document.getElementById("samp-manset");
    if (SD.durum === "yok") { if (el && el.parentNode) { el.parentNode.removeChild(el); } return; }
    var html = "<b>" + esc(SD.manset) + "</b><small>" + esc(SD.kisa) + "</small>";
    if (!el) { el = document.createElement("p"); el.id = "samp-manset"; el.className = "samp-manset"; bas.parentNode.insertBefore(el, bas.nextSibling); }
    el.setAttribute("data-samp", SD.durum);
    if (el.innerHTML !== html) { el.innerHTML = html; }
  }
  document.addEventListener("f1-sezon-durumu", ciz);
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", ciz); } else { ciz(); }
})();
