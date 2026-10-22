/* KİŞİSELLEŞTİRME v1 — FAVORİ PİLOT. Yalnız SUNUM katmanı: MEVCUT veriyi okur, DOM'a işaret koyar.
   • Yeni fetch / polling / zamanlayıcı / localStorage YAZIMI YOK (favori: mevcut "f1-favori" = driverId, yalnız okunur).
   • Eşleme: driverId → Driver.code (standings). Satır/çip yalnız KOD'a göre işaretlenir; görünen isim string'ine göre eşleme YOK.
   • Favori yoksa hiçbir ekranda ek blok / ★ / işaret üretilmez (tüm işaretler ve bloklar kaldırılır).
   • Satırlar: data-fav="1" (+ tablo satırında mevcut "favori" sınıfı: daralmış listede görünür kalma kuralı ui-final.css'te buna bağlı).
   • Çağrı: index.html'deki mevcut favoriVurgula() (gövde MutationObserver + favori seçimi) → FavoriV1.isaretle(). */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function bul(f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } }
  function esc(x) { return window.F1UI && F1UI.esc ? F1UI.esc(x) : String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }
  function txt(el) { return el ? String(el.textContent || "").trim() : ""; }

  // ---------- favori kaydı (yalnız okur) ----------
  function favKayit() {
    var id = bul(function () { return localStorage.getItem("f1-favori") || ""; }, "");
    if (!id) { return null; }
    var l = bul(function () { return window.BugunKaynak().pilotlar || []; }, []);
    for (var i = 0; i < l.length; i++) { if (l[i] && l[i].Driver && l[i].Driver.driverId === id) { return l[i]; } }
    return null;
  }
  function kodu(k) { var c = k && k.Driver && k.Driver.code; return c ? String(c).toUpperCase() : ""; }

  // ---------- satır / çip işaretleri ----------
  function isaretleDom(kod) {
    var set = [];
    function ekle(el) { if (el && set.indexOf(el) < 0) { set.push(el); } }
    if (kod) {
      Array.prototype.forEach.call(document.querySelectorAll(".pilot > .kod"), function (k) {
        if (txt(k).toUpperCase() !== kod) { return; }
        if (k.closest(".yo-pilot")) { return; }                           // cümle içi pilot göndermeleri satır değildir
        ekle(k.closest("tr") || k.closest(".bg-pod li, .bg-std li, .h-fp3"));
      });
      Array.prototype.forEach.call(document.querySelectorAll(".v3-cip-p i"), function (i) { if (txt(i).toUpperCase() === kod) { ekle(i.closest(".v3-cip")); } });
      Array.prototype.forEach.call(document.querySelectorAll("li.gc-pilot > b, li.pt-pilot > b, li.ta-sat .ta-pilot"), function (b) { if (txt(b).toUpperCase() === kod) { ekle(b.closest("li")); } });
    }
    Array.prototype.forEach.call(document.querySelectorAll("[data-fav]"), function (e) { if (set.indexOf(e) < 0 && e.id !== "dp-panel") { e.removeAttribute("data-fav"); } });
    Array.prototype.forEach.call(document.querySelectorAll("tr.favori"), function (e) { if (set.indexOf(e) < 0) { e.classList.remove("favori"); } });
    set.forEach(function (e) {
      if (e.getAttribute("data-fav") !== "1") { e.setAttribute("data-fav", "1"); }
      if (e.tagName === "TR" && !e.classList.contains("favori")) { e.classList.add("favori"); }
    });
  }

  // pilot profil paneli: başlıkta ★ FAVORİ (yalnız pilot profili: .pf-kimlik + "KOD · #no · takım" alt satırı)
  function isaretleProfil(kod) {
    var p = $("dp-panel"); if (!p) { return; }
    var alt = txt(p.querySelector("#dp-alt")), on = !!(kod && p.querySelector(".pf-kimlik") && alt.toUpperCase().indexOf(kod + " ·") === 0);
    if (on) { if (p.getAttribute("data-fav") !== "1") { p.setAttribute("data-fav", "1"); } } else if (p.hasAttribute("data-fav")) { p.removeAttribute("data-fav"); }
  }

  // ---------- SEZON: kompakt şampiyona özeti ----------
  function sezonOzet(k) {
    var tb = $("pilot-govde"), kap = tb && tb.closest(".kap"), el = $("fv-sezon");
    var html = "";
    if (k && kap) {
      var l = bul(function () { return window.BugunKaynak().pilotlar || []; }, []), lider = l[0], pts = Number(k.points), lp = lider ? Number(lider.points) : NaN;
      var poz = parseInt(k.position, 10);
      if (isFinite(poz) && isFinite(pts)) {
        html = "<span class='fv-y' aria-hidden='true'>★</span><b class='fv-kod'>" + esc(kodu(k)) + "</b><span>Sıra <b>P" + poz + "</b></span><span><b>" + esc(k.points) + "</b> puan</span>" +
          (poz > 1 && isFinite(lp) && lp >= pts ? "<span>Lidere <b>" + (lp - pts) + "</b> puan</span>" : (poz === 1 ? "<span>Şampiyona lideri</span>" : ""));
      }
    }
    if (!html) { if (el) { el.remove(); } return; }
    if (!el) { el = document.createElement("p"); el.id = "fv-sezon"; el.className = "fv-satir"; el.setAttribute("aria-label", "Favori pilot özeti"); kap.parentNode.insertBefore(el, kap); }
    if (el._h !== html) { el._h = html; el.innerHTML = html; }
  }

  // ---------- BUGÜN: küçük kişisel özet (hero'dan zayıf, ikincil) ----------
  function saatYaz(d) { return bul(function () { return HaftaVeri.saatYaz(d, HaftaVeri.ANA_TZ || "Europe/Istanbul"); }, "") || ""; }
  function farkYaz(grid, n) {
    grid = Number(grid); if (!(grid > 0) || !(n > 0)) { return ""; }
    var d = grid - n; return d > 0 ? " · +" + d + " pozisyon" : (d < 0 ? " · −" + (-d) + " pozisyon" : "");
  }
  function sonucSatiri(m, k) {
    if (!m.y) { return ""; }
    var tur = Number(m.y.round), id = k.Driver.driverId, kod = kodu(k);
    var liste = bul(function () { return BugunV3._durum.liste[tur]; }, null);
    if (liste && liste.length) {
      var r = null; for (var i = 0; i < liste.length; i++) { if (liste[i].Driver && liste[i].Driver.driverId === id) { r = liste[i]; break; } }
      if (r) { var n = parseInt(r.positionText, 10); return String(n) === String(r.positionText).trim() ? "Yarış sonucu: P" + n + farkYaz(r.grid, n) : "Yarış sonucu: " + (r.status ? r.status : "sıralanmadı"); }
      return "";
    }
    var t = bul(function () { return SezonTakvim._durum.model.turlar[tur]; }, null);
    if (t && kod) {                                                        // tam liste yoksa mevcut GERÇEK podyum kaydı
      var p = [t.kazanan, t.p2, t.p3];
      for (var j = 0; j < 3; j++) { if (p[j] && p[j].k === kod) { return "Yarış sonucu: P" + (j + 1) + farkYaz(p[j].g, j + 1); } }
    }
    return "";
  }
  function bugunHtml(k) {
    var m = bul(function () { return BugunV3._durum.model; }, null);
    if (!k || !m || (m.mod !== "A" && m.mod !== "B" && m.mod !== "C")) { return ""; }
    var poz = parseInt(k.position, 10); if (!isFinite(poz) || k.points == null) { return ""; }
    var d = k.Driver, ad = [d.givenName, d.familyName].filter(Boolean).join(" ");
    var s = ["Şampiyonada P" + poz + " · " + k.points + " puan"];
    if (m.mod === "A" && m.sonraki && m.sonraki.baslangic) { s.push("Sıradaki seans: " + String(m.sonraki.ad || "") + " · " + saatYaz(m.sonraki.baslangic)); }
    if (m.mod === "C") { var r = sonucSatiri(m, k); if (r) { s.push(r); } }
    return "<p class='fv-ust'><span class='fv-y' aria-hidden='true'>★</span><b class='fv-kod'>" + esc(kodu(k)) + "</b><span class='fv-ad'>" + esc(ad) + "</span></p>" +
      s.map(function (x) { return "<p class='fv-s'>" + esc(x) + "</p>"; }).join("");
  }
  function bugunBlok(k) {
    var kok = $("bg-kok"), el = $("fv-bugun");
    var html = kok ? bugunHtml(k) : "";
    if (!html) { if (el) { el.remove(); } return; }
    if (!el) { el = document.createElement("section"); el.id = "fv-bugun"; el.className = "fv-blok"; el.setAttribute("aria-label", "Favori pilot özeti"); kok.parentNode.insertBefore(el, kok.nextSibling); }
    if (el._h !== html) { el._h = html; el.innerHTML = html; }
  }

  function isaretle() {
    var k = favKayit(), kod = k ? kodu(k) : "";
    try { isaretleDom(kod); } catch (e) { /* önemsiz */ }
    try { isaretleProfil(kod); } catch (e) { /* önemsiz */ }
    try { sezonOzet(kod ? k : null); } catch (e) { /* önemsiz */ }
    try { bugunBlok(kod ? k : null); } catch (e) { /* önemsiz */ }
  }

  window.FavoriV1 = { isaretle: isaretle, _kayit: favKayit };
  document.addEventListener("f1-sekme", function () { isaretle(); });
  document.addEventListener("f1-yaris-sonuc", function () { isaretle(); });
})();
