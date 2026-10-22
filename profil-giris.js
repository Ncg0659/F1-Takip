/* A4.1 — Profil giriş noktaları. Mevcut hiçbir tıklama davranışı değiştirilmez (olay durdurulmaz, preventDefault çağrılmaz).
   1) Ana erişilebilir giriş: Pilot & Pist → her pilot seçicisinin yanında "Profil" düğmesi.
   2) Güvenli alanlarda pilot kodu/adı tıklaması (delegated): Pilot & Pist, Grafik, Güncel Sezon, Yarış Analizi, Detay Paneli.
      DOKUNULMAYANLAR: düğme, bağlantı, açılır liste/seçenek, input, summary, etiket, ⓘ/terim düğmeleri, panel kontrolleri, gezinme, diyaloglar
      ve Yarış Haftası/Yarış Günü/Sprint sekmeleri. */
(function () {
  "use strict";
  var PP = window.ProfilPilot, PV = window.ProfilVeri;
  if (!PP || !PV) { return; }
  var GUVENLI = "#sekme-profil, #sekme-grafik, #sekme-sezon, #sekme-yaris, #dp-panel";
  var YASAK = "button, a, select, option, input, textarea, summary, label, nav, dialog:not(#dp-panel), [data-terim], [data-dp], [role='button'], [contenteditable]";
  var HEDEF = ".pilot, .a32-kod, .pk-bk, .st-k";

  function koduOku(el) {
    var kod = el.querySelector && el.querySelector(".kod");
    var t = (kod ? kod.textContent : el.textContent) || "";
    t = t.trim();
    return /^[A-Za-z]{3}$/.test(t) ? t.toUpperCase() : null;
  }

  function secimdenAc(sel, btn) {
    var i = Number(sel.value), l = window.sezonPilotlar || (function () { try { return sezonPilotlar; } catch (e) { return []; } })();
    var k = l && l[i]; if (!k) { return; }
    PP.ac(k.Driver.driverId, btn);
  }

  // A4.2: Pilot & Pist → "Takım profilleri" (ana erişilebilir giriş). Liste dinamik: mevcut constructor sıralamasındaki tüm takımlar.
  function takimSirasi() {
    var kok = document.getElementById("sekme-profil"), PT = window.ProfilTakim, F = window.F1UI; if (!kok || !PT || !F) { return; }
    var liste = PV.takimlar ? PV.takimlar() : []; if (!liste.length) { return; }
    var kap = document.getElementById("pf-takimlar");
    if (!kap) {
      var hedef = kok.querySelector(".kap"); if (!hedef) { return; }
      kap = document.createElement("div"); kap.id = "pf-takimlar"; kap.className = "pf-takimlar";
      hedef.parentNode.insertBefore(kap, hedef);
    }
    kap.innerHTML = "<span class='pf-tbaslik' id='pf-tb'>Takım profilleri</span><span class='pf-tlist' role='group' aria-labelledby='pf-tb'>" +
      liste.map(function (x) { return "<button type='button' class='pf-tchip' data-pf-tid='" + F.esc(x.id) + "' aria-label='" + F.esc(x.ad) + " takım profilini aç'>" + F.takimRozeti(x.ad) + "</button>"; }).join("") + "</span>";
    Array.prototype.forEach.call(kap.querySelectorAll("[data-pf-tid]"), function (b) { b.addEventListener("click", function () { PT.ac(b.getAttribute("data-pf-tid"), b); }); });
  }

  document.addEventListener("f1-takim-siralama", function () { if (document.readyState !== "loading") { takimSirasi(); } });   // olay DOM hazır olmadan gelirse baslat() zaten çizer

  function baslat() {
    ["pilot-a", "pilot-b"].forEach(function (id) {
      var sel = document.getElementById(id); if (!sel || !sel.parentNode) { return; }
      if (sel.nextElementSibling && sel.nextElementSibling.hasAttribute("data-pf-profil")) { return; }
      var b = document.createElement("button"); b.type = "button"; b.className = "pf-btn"; b.setAttribute("data-pf-profil", id);
      b.textContent = "Profil"; b.setAttribute("aria-label", (id === "pilot-a" ? "Birinci" : "İkinci") + " pilotun profilini aç");
      sel.parentNode.insertBefore(b, sel.nextSibling);
      b.addEventListener("click", function () { secimdenAc(sel, b); });
    });
    takimSirasi();
    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) { return; }
      var t = e.target; if (!t || !t.closest) { return; }
      if (t.closest(YASAK)) { return; }
      if (!t.closest(GUVENLI)) { return; }
      var tk = t.closest(".takim:not(.takim-yok)");
      if (tk && window.ProfilTakim) {                                    // A4.2: takım rozeti → takım profili (aynı güvenli alan kuralları)
        var sec0 = window.getSelection && String(window.getSelection()); if (sec0) { return; }
        var tid = PV.takimId(tk.getAttribute("title") || tk.textContent); if (tid) { window.ProfilTakim.ac(tid, tk); }
        return;
      }
      var h = t.closest(HEDEF); if (!h) { return; }
      var sec = window.getSelection && String(window.getSelection()); if (sec) { return; }       // metin seçiliyorsa tıklama sayılmaz
      var id = PV.kodId(koduOku(h)); if (!id) { return; }
      PP.ac(id, h);
    });
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", baslat); } else { baslat(); }
})();
