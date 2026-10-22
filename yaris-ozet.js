/* A6 — "YARIŞI KAÇIRDIYSAN" kartı (Yarış → Yarış analizi; yarış seçici ile sonuç tablosu arasında). Yalnızca ARAYÜZ; hesap yaris-ozet-hesap.js'tedir.
   AĞ: bu dosya HİÇ fetch yapmaz, zamanlayıcı/polling kurmaz, yeni localStorage anahtarı yazmaz. Veri:
     • yarış sonucu: index.html'in mevcut yüklemesinin "f1-yaris-sonuc" olayı (A3.4b ile aynı olay),
     • pole: JolpicaIstemci önbelleği (yalnızca okuma; A2.1'in mevcut pole çağrısı doldurur — dolunca kart bir kez yenilenir),
     • şampiyona: bellekteki sezonPilotlar (yalnızca seçili yarış son tamamlanmış yarışsa),
     • lastik / Race Feed bağlantıları: yalnızca mevcut bloklara kaydırır; OpenF1 isteği başlatmaz, bloğu açmaz.
   Kart yalnızca tamamlanmış ana yarışta görünür; yarış değişirken ya da veri yoksa gizlenir. A2.1 "Ne oldu?" kutusuna dokunulmaz. */
(function () {
  "use strict";
  var H = window.YarisOzetHesap, F = window.F1UI;
  if (!H || !F) { return; }

  var D = { tur: null, liste: null, poleVar: false, gozlenen: null, gozlem: null };
  var IKON = { kazanan: "trophy", podyum: "list", yukselen: "arrowup", gerileyen: "arrowdown", disi: "alert", pole: "stopwatch", sampiyona: "chart" };

  function bul(f, d) { try { return f(); } catch (e) { return d; } }
  function esc(x) { return F.esc(x); }
  function sezon() { return bul(function () { return typeof SEZON !== "undefined" ? SEZON : new Date().getFullYear(); }, new Date().getFullYear()); }

  // ---------- veri okuma (salt okunur, ağsız) ----------
  function takvim() {
    var a = bul(function () { return typeof sezonYarislar !== "undefined" ? sezonYarislar : []; }, []);
    if (a && a.length) { return a; }
    a = bul(function () { return window.YarisHaftasi && YarisHaftasi._durum && YarisHaftasi._durum.yarislar; }, null);
    if (a && a.length) { return a; }
    var c = bul(function () { return window.JolpicaIstemci && JolpicaIstemci.oku("takvim-" + sezon()); }, null);
    var r = c && c.veri && c.veri.RaceTable && c.veri.RaceTable.Races;
    return r && r.length ? r : [];
  }
  function yarisKaydi(tur, tk) { return (tk || []).filter(function (y) { return Number(y.round) === Number(tur); })[0] || null; }
  function baslangic(y) { var t = y ? Date.parse(y.date + "T" + (y.time || "12:00:00Z")) : NaN; return isNaN(t) ? null : t; }

  function poleOku(tur) {
    var y = sezon(), JI = window.JolpicaIstemci; if (!JI) { return null; }
    var toplu = bul(function () { return JI.oku("sezon-" + y + "-pole"); }, null);
    if (toplu && toplu.veri && toplu.veri.turlar && toplu.veri.turlar[tur]) { return toplu.veri.turlar[tur]; }
    var tek = bul(function () { return JI.oku("sezon-" + y + "-pole-r" + tur); }, null);
    return tek && tek.veri && tek.veri.pole ? tek.veri.pole : null;
  }

  // Lastik bağlantısı: blok var VE A3.4b'nin mevcut yayımlanma kuralına göre veri alınabilir (ağsız; oturum bitişi önbellekteyse o kullanılır)
  function lastikUygun(tur, y) {
    if (!document.getElementById("a34b-lastik") || !window.LastikHesap || !y) { return false; }
    var bas = baslangic(y); if (bas == null) { return false; }
    var o = bul(function () { return JolpicaIstemci.oku("stints-oturum-" + sezon() + "-r" + tur); }, null);
    var bit = o && o.veri ? o.veri.date_end : null;
    return bul(function () { return LastikHesap.yayimlandiMi(bit, bas, Date.now()); }, false);
  }
  // Race Feed bağlantısı: son tamamlanmış yarış ∧ Yarış Günü'nün gösterdiği yarış ∧ o yarışın kayıtlı akışında gerçekten olay var
  function feedUygun(tur, son) {
    if (son == null || Number(tur) !== Number(son)) { return false; }
    var gy = bul(function () { return gunYarisiSec(); }, null);
    if (!gy || Number(gy.round) !== Number(tur)) { return false; }
    var r = bul(function () { return RaceFeed.yukle(sezon() + "-" + tur); }, null);
    return !!(r && r.olaylar && r.olaylar.length);
  }

  // ---------- çizim ----------
  function kart() {
    var k = document.getElementById("yo-kart");
    if (k) { return k; }
    var cap = document.getElementById("yaris-durum");
    if (!cap || !cap.parentNode) { return null; }
    k = document.createElement("section");
    k.id = "yo-kart"; k.className = "yo"; k.hidden = true; k.setAttribute("aria-labelledby", "yo-baslik");
    cap.parentNode.insertBefore(k, cap.nextSibling);          // yarış seçici → [bu kart] → sonuç tablosu
    k.addEventListener("click", tikla);
    return k;
  }
  function gizle(k) { if (k && !k.hidden) { k.hidden = true; } if (k) { k.innerHTML = ""; } D.poleVar = false; if (window.YarisOzetV2) { bul(function () { window.YarisOzetV2.temizle(); }); } }

  function parca(p) {
    if (typeof p === "string") { return esc(p); }
    return "<span class='pilot yo-pilot'><span class='yo-ad'>" + esc(p.ad) + "</span><span class='kod v3-driver-code'>" + esc(p.kod) + "</span></span>";   // soyad + mevcut pilot kod rozeti
  }
  function satirHtml(s) {
    return "<li class='yo-s yo-" + s.anahtar + "'><span class='yo-et'>" + F.ikon(IKON[s.anahtar] || "flag", 14) + "<span>" + esc(s.etiket) + "</span></span>" +
      "<span class='yo-d'>" + s.parcalar.map(parca).join("") + "</span>" + (s.alt ? "<span class='yo-alt'>" + esc(s.alt) + "</span>" : "") + "</li>";
  }

  function render() {
    var k = kart(); if (!k) { return; }
    if (D.tur == null || !D.liste) { gizle(k); return; }
    var tk = takvim(), y = yarisKaydi(D.tur, tk), bas = baslangic(y);
    if (bas != null && !(bas + 3 * 3600 * 1000 < Date.now())) { gizle(k); return; }       // tamamlanmamış yarış: kart yok
    var son = H.sonBitenTur(tk, Date.now());
    var girdi = {
      tur: D.tur, liste: D.liste, pole: poleOku(D.tur),
      standings: bul(function () { return typeof sezonPilotlar !== "undefined" ? sezonPilotlar : null; }, null),
      sonTur: son != null && Number(D.tur) === son,
      lastik: lastikUygun(D.tur, y), feed: feedUygun(D.tur, son)
    };
    var o = H.ozet(girdi);
    if (o.durum !== "ok") { gizle(k); return; }
    D.poleVar = !!girdi.pole;
    k.innerHTML = "<h2 id='yo-baslik' class='yo-baslik'>" + F.ikon("flag", 16) + "YARIŞI KAÇIRDIYSAN</h2>" +
      "<ul class='yo-liste'>" + o.satirlar.map(satirHtml).join("") + "</ul>" +
      (o.aksiyonlar.length ? "<div class='yo-aks'>" + o.aksiyonlar.map(function (a) { return "<button type='button' class='yo-btn' data-yo='" + esc(a.id) + "'>" + esc(a.ad) + "</button>"; }).join("") + "</div>" : "");
    k.setAttribute("data-tur", String(D.tur));
    k.hidden = false;
    if (window.YarisOzetV2) { bul(function () { window.YarisOzetV2.baglan(k, D.tur, y); }); }      // v2: isteğe bağlı, ağsız zenginleştirme (hata A6'yı etkilemez)
  }

  // ---------- bağlantılar (yalnızca kaydırma; ağ yok) ----------
  function azHareket() { return bul(function () { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }, false); }
  function lastigeGit() {
    var d = document.getElementById("a34b-lastik"); if (!d) { return; }            // bloğu AÇMAZ → OpenF1 isteği tetiklenmez
    bul(function () { d.scrollIntoView({ block: "start", behavior: azHareket() ? "auto" : "smooth" }); });
    d.classList.add("yo-vurgu");
    var s = d.querySelector("summary"); if (s) { bul(function () { s.focus({ preventScroll: true }); }); }
    setTimeout(function () { d.classList.remove("yo-vurgu"); }, 2200);
  }
  function akisaGit() {
    if (typeof window.sekmeAc === "function") { try { window.sekmeAc("gun"); } catch (e) { var b = document.getElementById("btn-yarisgrup"); if (b) { b.click(); } } }
    var dene = 0;
    (function kaydir() {                                         // Yarış Günü çizilince Race Feed'e kaydır (ticker ile aynı kalıp)
      var n = document.getElementById("gun-notlar"), s = document.getElementById("sekme-gun");
      if (n && s && !s.hidden) { bul(function () { n.scrollIntoView({ block: "start" }); }); return; }
      if (dene++ < 10) { setTimeout(kaydir, 120); }
    })();
  }
  function tikla(e) {
    var b = e.target && e.target.closest ? e.target.closest("button[data-yo]") : null;
    if (!b) { return; }
    if (b.getAttribute("data-yo") === "lastik") { lastigeGit(); } else if (b.getAttribute("data-yo") === "feed") { akisaGit(); }
  }

  // ---------- olaylar ----------
  // A2.1'in pole çağrısı kart çizildikten sonra bitebilir: o kutunun içeriği değişince (olay güdümlü, zamanlayıcı yok) pole artık önbellekteyse bir kez yenile
  function ne_oldu_izle() {
    var kutu = document.getElementById("a2-yorum-yaris");
    if (!kutu || D.gozlenen === kutu || !window.MutationObserver) { return; }
    if (D.gozlem) { D.gozlem.disconnect(); }
    D.gozlenen = kutu;
    D.gozlem = new MutationObserver(function () {
      if (D.tur != null && D.liste && !D.poleVar && poleOku(D.tur)) { render(); }
    });
    D.gozlem.observe(kutu, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
  }

  document.addEventListener("f1-yaris-sonuc", function (e) {
    var d = e.detail || {};
    D.tur = d.tur; D.liste = d.liste || null; D.poleVar = false;
    render(); ne_oldu_izle();
  });
  function secimiDinle() {
    var s = document.getElementById("yaris-sec");
    if (!s || s._yo) { return; }
    s._yo = true;
    s.addEventListener("change", function () { D.tur = null; D.liste = null; gizle(document.getElementById("yo-kart")); });   // yarış değişirken eski yarışın özeti kalmaz
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", secimiDinle); } else { secimiDinle(); }
  document.addEventListener("f1-yaris-sonuc", secimiDinle);

  window.YarisOzet = { render: render, _durum: D };
})();
