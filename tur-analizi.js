/* OPENF1 A7.2 — "Tur Analizi" arayüzü (tamamlanmış seans kartlarının altında, kullanıcı açınca tarihsel laps yüklenir).
   Yeni zamanlayıcı/polling yok. Yalnızca özet satırları çizilir (ham turlar DOM'a basılmaz). Yorum/nedensellik yok. */
(function () {
  "use strict";
  var LH = window.LapsHesap, LV = window.LapsVeri;
  var ST = {};
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function kimlik(h, s) { return h.sezon + "-" + h.tur + "-" + s.anahtar; }
  function durum(id) { return ST[id] || (ST[id] = { acik: false, tumu: false, durum: null, veri: null, ozetler: null }); }
  var QSEANS = { Qualifying: 1, SprintQualifying: 1, SprintShootout: 1 };

  function satir(p, isimler, sira) {
    var im = isimler && isimler[p.driverNumber], ad = im && im.kod ? im.kod : "#" + p.driverNumber, e = p.enHizli;
    var ust = "<span class='ta-no'>" + sira + "</span><b class='ta-pilot'>" + esc(ad) + "</b>" + (im && im.takim ? " <small class='ta-takim'>" + esc(im.takim) + "</small>" : "") +
      "<span class='ta-sure'>" + (e ? LH.sureYaz(e.lapDuration) : "—") + "</span>";
    var alt = e ? "<span>S1 " + LH.sektorYaz(e.sector1) + "</span><span>S2 " + LH.sektorYaz(e.sector2) + "</span><span>S3 " + LH.sektorYaz(e.sector3) + "</span>" +
      "<span>Speed trap " + LH.hizYaz(p.maxStSpeed) + "</span><span>" + p.sureliTur + " süreli tur</span>"
      : "<span>Süreli tur yok</span><span>Speed trap " + LH.hizYaz(p.maxStSpeed) + "</span>";
    return "<li class='ta-sat'><div class='ta-ust'>" + ust + "</div><div class='ta-alt'>" + alt + "</div></li>";
  }
  function govde(id, h, s) {
    var d = durum(id);
    if (d.durum === "yukleniyor") { return "<p class='ta-not'>Yükleniyor…</p>"; }
    if (d.durum && d.durum !== "ok") {
      return "<p class='ta-not'>" + esc(LH.durumMesaji(d.durum)) + "</p>" + (d.durum === "hata" || d.durum === "kisit" ? "<button class='ta-btn' data-ta-act='tekrar' type='button'>Yeniden dene</button>" : "");
    }
    if (!d.veri) { return ""; }
    var p = d.ozetler, liste = d.tumu ? p : p.slice(0, 3);
    return "<p class='ta-not'>En hızlı turlara göre sıralı · S1/S2/S3 en hızlı turun sektörleri" + (QSEANS[s.anahtar] ? " · Q/SQ etap (Q1/Q2/Q3) ayrımı yapılmaz" : "") + "</p>" +
      "<ol class='ta-liste'>" + liste.map(function (x, i) { return satir(x, d.veri.isimler, i + 1); }).join("") + "</ol>" +
      (p.length > 3 ? "<button class='ta-btn' data-ta-act='tumu' type='button' aria-expanded='" + d.tumu + "'>" + (d.tumu ? "İlk 3 pilotu göster" : "Tüm pilotları göster (" + p.length + ")") + "</button>" : "") +
      "<p class='ta-kaynak'>Kaynak: OpenF1 / Laps</p>";
  }
  function blok(id, h, s) {
    var d = durum(id);
    return "<button class='ta-ac' data-ta-act='ac' type='button' aria-expanded='" + d.acik + "'>" + (d.acik ? "Tur Analizi ▴" : "Tur Analizi ▾") + "</button>" + (d.acik ? "<div class='ta-govde'>" + govde(id, h, s) + "</div>" : "");
  }
  function html(h, s, d, st) {
    if (!LH || !LV) { return ""; }
    if (d !== "tamamlandi" && d !== "bitti") { return ""; }
    if (st && (st.durum === "POSTPONED" || st.durum === "CANCELLED")) { return ""; }
    var id = kimlik(h, s);
    return "<div class='ta' data-ta='" + esc(id) + "' data-seans='" + esc(s.anahtar) + "'>" + blok(id, h, s) + "</div>";
  }
  function bulHS(kutu) {
    var S = window.YarisHaftasi && window.YarisHaftasi._durum, h = S && S.hafta; if (kutu.closest && kutu.closest("#sekme-gun") && window.A7Hafta) { h = window.A7Hafta() || h; } else if (kutu.closest && kutu.closest("#sekme-yaris") && window.A7HaftaYaris) { h = window.A7HaftaYaris() || h; } if (!h) { return null; }
    var s = (h.seanslar || []).filter(function (x) { return x.anahtar === kutu.getAttribute("data-seans"); })[0];
    return s ? { h: h, s: s } : null;
  }
  async function yukle(kutu, id, hs) {
    var d = durum(id); d.durum = "yukleniyor"; kutu.innerHTML = blok(id, hs.h, hs.s);
    var sonuc;
    try { sonuc = await LV.yukle(hs.h, hs.s); } catch (e) { sonuc = { durum: "hata" }; }
    d.durum = sonuc.durum;
    if (sonuc.durum === "ok") { d.veri = { isimler: sonuc.isimler, ozet: sonuc.ozet }; d.ozetler = LH.pilotOzetleri(sonuc.turlar); } else { d.veri = null; d.ozetler = null; }   // ham turlar UI durumunda tutulmaz
    var yeni = document.querySelector("[data-ta='" + id + "']") || kutu;
    yeni.innerHTML = blok(id, hs.h, hs.s);
  }
  document.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest("[data-ta-act]"); if (!el) { return; }
    var kutu = el.closest("[data-ta]"); if (!kutu) { return; }
    var hs = bulHS(kutu); if (!hs) { return; }
    var id = kutu.getAttribute("data-ta"), d = durum(id), a = el.getAttribute("data-ta-act");
    if (a === "ac") {
      d.acik = !d.acik;
      if (d.acik && !d.veri && d.durum !== "yukleniyor" && (!d.durum || d.durum === "ok")) { yukle(kutu, id, hs); } else { kutu.innerHTML = blok(id, hs.h, hs.s); }
    } else if (a === "tumu") { d.tumu = !d.tumu; kutu.innerHTML = blok(id, hs.h, hs.s); }
    else if (a === "tekrar") { yukle(kutu, id, hs); }
  });
  window.TurAnalizi = { html: html, _durum: ST };
})();
