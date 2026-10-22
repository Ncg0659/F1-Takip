/* OPENF1 A7.4 — "Pit Stoplar" arayüzü (yalnızca tamamlanmış Sprint/Race kartı, kullanıcı açınca tarihsel pit yüklenir). Polling/zamanlayıcı yok; strateji yorumu yok.
   Etiketler: "Stop" = stop_duration (pit kutusunda durulan süre), "Pit lane" = lane_duration (pit lane'de geçen toplam süre). Birbirine karıştırılmaz. */
(function () {
  "use strict";
  var PH = window.PitHesap, PV = window.PitVeri, ST = {};
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function kimlik(h, s) { return h.sezon + "-" + h.tur + "-" + s.anahtar; }
  function durum(id) { return ST[id] || (ST[id] = { acik: false, tumu: false, durum: null, veri: null, kayitlar: null }); }
  function ad(im, no) { var i = im && im[no]; return no == null ? "?" : (i && i.kod ? i.kod : "#" + no); }
  function tamAd(im, no) { var i = im && im[no]; return i && i.ad ? " " + esc(i.ad) : ""; }
  function saat(ms) { try { return new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(ms)); } catch (e) { return ""; } }
  function pitSatir(e, im) {
    var zaman = e.lapNumber != null ? "Tur " + e.lapNumber : saat(e.ms);
    var stop = PH.stopYaz(e.stopDuration), lane = PH.laneYaz(e.laneDuration);
    return "<li class='pt-sat'><span class='pt-zaman'>" + esc(zaman) + "</span><span class='pt-metin'><b>" + esc(ad(im, e.driverNumber)) + "</b>" +
      "<span class='pt-det'>Stop: " + (stop ? esc(stop) : "<i>Stop süresi yok</i>") + "</span><span class='pt-det'>Pit lane: " + (lane ? esc(lane) : "<i>Pit lane süresi yok</i>") + "</span></span></li>";
  }
  function govde(id, h, s) {
    var d = durum(id);
    if (d.durum === "yukleniyor") { return "<p class='pt-not'>Yükleniyor…</p>"; }
    if (d.durum && d.durum !== "ok") { return "<p class='pt-not'>" + esc(PH.durumMesaji(d.durum)) + "</p>" + (d.durum === "hata" || d.durum === "kisit" ? "<button class='pt-btn' data-pt-act='tekrar' type='button'>Yeniden dene</button>" : ""); }
    if (!d.veri) { return ""; }
    var im = d.veri.isimler, oz = d.veri.ozet;
    var kisa = oz.enKisa.map(function (p, i) {
      return "<li class='pt-pilot'><span class='pt-no'>" + (i + 1) + "</span><b>" + esc(ad(im, p.driverNumber)) + "</b>" + tamAd(im, p.driverNumber) + " <span class='pt-say'>— " + esc(PH.stopYaz(p.stopDuration)) + "</span></li>";
    }).join("");
    var liste = d.tumu ? d.kayitlar : oz.sonPitler;
    return "<p class='pt-toplam'>Toplam: <b>" + oz.toplam + "</b> pit kaydı</p>" +
      (kisa ? "<p class='pt-bas'>En kısa stop süresi</p><ol class='pt-liste'>" + kisa + "</ol>" : "<p class='pt-not'>Stop süresi verisi yok (OpenF1 stop süresini yalnızca 2024 ABD GP'den itibaren sağlar).</p>") +
      "<p class='pt-bas'>" + (d.tumu ? "Tüm pit stoplar (kronolojik)" : "Son pit stoplar") + "</p><ul class='pt-liste'>" + liste.map(function (e) { return pitSatir(e, im); }).join("") + "</ul>" +
      (oz.toplam > oz.sonPitler.length ? "<button class='pt-btn' data-pt-act='tumu' type='button' aria-expanded='" + d.tumu + "'>" + (d.tumu ? "Yalnızca son pit stopları göster" : "Tüm pit stopları göster (" + oz.toplam + ")") + "</button>" : "") +
      "<p class='pt-not'>Stop = pit kutusunda durulan süre; Pit lane = pit lane'de geçen toplam süre. OpenF1 kayıtlarına göre, eksik olabilir.</p><p class='pt-kaynak'>Kaynak: OpenF1 / Pit</p>";
  }
  function blok(id, h, s) {
    var d = durum(id);
    return "<button class='pt-ac' data-pt-act='ac' type='button' aria-expanded='" + d.acik + "'>" + (d.acik ? "Pit Stoplar ▴" : "Pit Stoplar ▾") + "</button>" + (d.acik ? "<div class='pt-govde'>" + govde(id, h, s) + "</div>" : "");
  }
  function html(h, s, dd, st) {
    if (!PH || !PV || !PH.SEANSLAR[s.anahtar]) { return ""; }
    if (dd !== "tamamlandi" && dd !== "bitti") { return ""; }
    if (st && (st.durum === "POSTPONED" || st.durum === "CANCELLED")) { return ""; }
    var id = kimlik(h, s);
    return "<div class='pt' data-pt='" + esc(id) + "' data-seans='" + esc(s.anahtar) + "'>" + blok(id, h, s) + "</div>";
  }
  function bulHS(kutu) {
    var S = window.YarisHaftasi && window.YarisHaftasi._durum, h = S && S.hafta; if (kutu.closest && kutu.closest("#sekme-gun") && window.A7Hafta) { h = window.A7Hafta() || h; } else if (kutu.closest && kutu.closest("#sekme-yaris") && window.A7HaftaYaris) { h = window.A7HaftaYaris() || h; } if (!h) { return null; }
    var s = (h.seanslar || []).filter(function (x) { return x.anahtar === kutu.getAttribute("data-seans"); })[0];
    return s ? { h: h, s: s } : null;
  }
  async function yukle(kutu, id, hs) {
    var d = durum(id); d.durum = "yukleniyor"; kutu.innerHTML = blok(id, hs.h, hs.s);
    var sonuc; try { sonuc = await PV.yukle(hs.h, hs.s); } catch (e) { sonuc = { durum: "hata" }; }
    d.durum = sonuc.durum; d.veri = sonuc.durum === "ok" ? { isimler: sonuc.isimler, ozet: sonuc.ozet } : null; d.kayitlar = sonuc.durum === "ok" ? sonuc.kayitlar : null;
    var yeni = document.querySelector("[data-pt='" + id + "']") || kutu; yeni.innerHTML = blok(id, hs.h, hs.s);
  }
  document.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest("[data-pt-act]"); if (!el) { return; }
    var kutu = el.closest("[data-pt]"); if (!kutu) { return; }
    var hs = bulHS(kutu); if (!hs) { return; }
    var id = kutu.getAttribute("data-pt"), d = durum(id), a = el.getAttribute("data-pt-act");
    if (a === "ac") { d.acik = !d.acik; if (d.acik && !d.veri && d.durum !== "yukleniyor" && (!d.durum || d.durum === "ok")) { yukle(kutu, id, hs); } else { kutu.innerHTML = blok(id, hs.h, hs.s); } }
    else if (a === "tumu") { d.tumu = !d.tumu; kutu.innerHTML = blok(id, hs.h, hs.s); }
    else if (a === "tekrar") { yukle(kutu, id, hs); }
  });
  window.Pitler = { html: html, _durum: ST };
})();
