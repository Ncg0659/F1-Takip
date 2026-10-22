/* OPENF1 A7.1 — "Seans Olayları" arayüzü (yalnızca TAMAMLANMIŞ seans kartlarının altında, kullanıcı açınca tarihsel Race Control yüklenir).
   Yeni zamanlayıcı/polling yok; blok kendi kutusunu yeniden çizer (hafta kartlarının tamamını değil). Durum bellekte tutulur → hafta yeniden çizilince açık kalır. */
(function () {
  "use strict";
  var RC = window.RaceControl, RV = window.RaceControlVeri;
  var ST = {};                                    // anahtar → { acik, tumu, durum, veri }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function kimlik(h, s) { return h.sezon + "-" + h.tur + "-" + s.anahtar; }
  function durum(id) { return ST[id] || (ST[id] = { acik: false, tumu: false, durum: null, veri: null }); }

  function satirHtml(e, ctx) {
    var r = RC.satir(e, ctx);
    var saat = "<time class='so-saat'>" + esc(r.saat || "") + (r.yerel ? "<small>pist " + esc(r.yerel) + "</small>" : "") + "</time>";
    return "<li class='so-sat so-" + esc(r.siddet) + "' data-tip='" + esc(r.tip) + "'>" + saat + "<span class='so-ikon' aria-hidden='true'>" + r.ikon + "</span>" +
      "<span class='so-metin'><b>" + esc(r.baslik) + "</b>" + (r.metin ? " <span>" + esc(r.metin) + "</span>" : "") + (r.ham ? "<small class='so-ham'>" + esc(r.ham) + "</small>" : "") + "</span></li>";
  }
  function govde(id, h, s) {
    var d = durum(id), ctx = { pistTz: h.pistTz, seansAd: s.ad };
    if (d.durum === "yukleniyor") { return "<p class='so-not'>Yükleniyor…</p>"; }
    if (d.durum && d.durum !== "ok") {
      var m = RC.durumMesaji(d.durum);
      return "<p class='so-not'>" + esc(m) + "</p>" + (d.durum === "hata" || d.durum === "kisit" ? "<button class='so-btn' data-so-act='tekrar' type='button'>Yeniden dene</button>" : "");
    }
    if (!d.veri) { return ""; }
    var tum = RC.listelenen(d.veri.olaylar), liste = d.tumu ? tum : RC.kritikler(d.veri.olaylar, 5);
    return "<ul class='so-liste'>" + liste.map(function (e) { return satirHtml(e, ctx); }).join("") + "</ul>" +
      (tum.length > liste.length || d.tumu ? "<button class='so-btn' data-so-act='tumu' type='button' aria-expanded='" + d.tumu + "'>" + (d.tumu ? "Önemlileri göster" : "Tüm olayları göster (" + tum.length + ")") + "</button>" : "") +
      "<p class='so-kaynak'>Kaynak: OpenF1 / Race Control</p>";
  }
  function blok(id, h, s) {
    var d = durum(id);
    return "<button class='so-ac' data-so-act='ac' type='button' aria-expanded='" + d.acik + "'>" + (d.acik ? "Seans Olayları ▴" : "Seans Olayları ▾") + "</button>" +
      (d.acik ? "<div class='so-govde'>" + govde(id, h, s) + "</div>" : "");
  }
  // hafta-ui.js seansKarti içinde çağrılır: yalnızca tamamlanmış seans için kutu döner
  function html(h, s, d, st) {
    if (!RC || !RV) { return ""; }
    if (d !== "tamamlandi" && d !== "bitti") { return ""; }
    if (st && (st.durum === "POSTPONED" || st.durum === "CANCELLED")) { return ""; }
    var id = kimlik(h, s);
    return "<div class='so' data-so='" + esc(id) + "' data-seans='" + esc(s.anahtar) + "'>" + blok(id, h, s) + "</div>";
  }
  function bulHS(kutu) {
    var S = window.YarisHaftasi && window.YarisHaftasi._durum, h = S && S.hafta; if (kutu.closest && kutu.closest("#sekme-gun") && window.A7Hafta) { h = window.A7Hafta() || h; } else if (kutu.closest && kutu.closest("#sekme-yaris") && window.A7HaftaYaris) { h = window.A7HaftaYaris() || h; } if (!h) { return null; }
    var s = (h.seanslar || []).filter(function (x) { return x.anahtar === kutu.getAttribute("data-seans"); })[0];
    return s ? { h: h, s: s } : null;
  }
  async function yukle(kutu, id, hs) {
    var d = durum(id); d.durum = "yukleniyor"; kutu.innerHTML = blok(id, hs.h, hs.s);
    var sonuc;
    try { sonuc = await RV.yukle(hs.h, hs.s); } catch (e) { sonuc = { durum: "hata" }; }
    d.durum = sonuc.durum; d.veri = sonuc.durum === "ok" ? sonuc : null;
    var yeni = document.querySelector("[data-so='" + id + "']") || kutu;       // arada yeniden çizildiyse güncel kutu
    yeni.innerHTML = blok(id, hs.h, hs.s);
  }
  document.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest("[data-so-act]"); if (!el) { return; }
    var kutu = el.closest("[data-so]"); if (!kutu) { return; }
    var hs = bulHS(kutu); if (!hs) { return; }
    var id = kutu.getAttribute("data-so"), d = durum(id), a = el.getAttribute("data-so-act");
    if (a === "ac") {
      d.acik = !d.acik;
      if (d.acik && !d.veri && d.durum !== "yukleniyor" && (!d.durum || d.durum === "ok")) { yukle(kutu, id, hs); }
      else { kutu.innerHTML = blok(id, hs.h, hs.s); }
    } else if (a === "tumu") { d.tumu = !d.tumu; kutu.innerHTML = blok(id, hs.h, hs.s); }
    else if (a === "tekrar") { yukle(kutu, id, hs); }
  });
  window.SeansOlaylari = { html: html, _durum: ST };
})();
