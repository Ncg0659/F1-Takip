/* OPENF1 A7.3 — "Geçişler" arayüzü (yalnızca tamamlanmış Sprint/Race kartı, kullanıcı açınca tarihsel overtakes yüklenir). Polling/zamanlayıcı yok; yorum yok. */
(function () {
  "use strict";
  var OH = window.OvertakesHesap, OV = window.OvertakesVeri, ST = {};
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function kimlik(h, s) { return h.sezon + "-" + h.tur + "-" + s.anahtar; }
  function durum(id) { return ST[id] || (ST[id] = { acik: false, tumu: false, durum: null, veri: null }); }
  function ad(im, no) { var i = im && im[no]; return no == null ? "?" : (i && i.kod ? i.kod : "#" + no); }
  function tamAd(im, no) { var i = im && im[no]; return i && i.ad ? " " + esc(i.ad) : ""; }
  function saat(ms) { try { return new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(ms)); } catch (e) { return ""; } }
  function gecisSatir(e, im) {
    var zaman = e.lapNumber != null ? "Tur " + e.lapNumber : saat(e.ms);
    return "<li class='gc-sat'><span class='gc-zaman'>" + esc(zaman) + "</span><span class='gc-metin'><b>" + esc(ad(im, e.overtakingDriverNumber)) + " → " + esc(ad(im, e.overtakenDriverNumber)) + "</b>" +
      (e.position != null ? " <span>P" + e.position + "'e yükseldi</span>" : "") + "</span></li>";
  }
  function govde(id, h, s) {
    var d = durum(id);
    if (d.durum === "yukleniyor") { return "<p class='gc-not'>Yükleniyor…</p>"; }
    if (d.durum && d.durum !== "ok") { return "<p class='gc-not'>" + esc(OH.durumMesaji(d.durum)) + "</p>" + (d.durum === "hata" || d.durum === "kisit" ? "<button class='gc-btn' data-gc-act='tekrar' type='button'>Yeniden dene</button>" : ""); }
    if (!d.veri) { return ""; }
    var v = d.veri, im = v.isimler, oz = v.ozet;
    var ilk = oz.enCokGecis.map(function (p, i) {
      return "<li class='gc-pilot'><span class='gc-no'>" + (i + 1) + "</span><b>" + esc(ad(im, p.driverNumber)) + "</b>" + tamAd(im, p.driverNumber) + " <span class='gc-say'>— " + p.yapilan + " geçiş kaydı" + (p.yapilanGecis ? " · " + p.yapilanGecis + " geçilme kaydı" : "") + "</span></li>";
    }).join("");
    var liste = d.tumu ? d.gecisler : oz.sonGecisler;
    return "<p class='gc-toplam'>Toplam: <b>" + oz.toplam + "</b> geçiş kaydı</p>" +
      (ilk ? "<p class='gc-bas'>En çok geçiş kaydı</p><ol class='gc-liste'>" + ilk + "</ol>" : "") +
      "<p class='gc-bas'>" + (d.tumu ? "Tüm geçişler (kronolojik)" : "Son geçişler") + "</p><ul class='gc-liste'>" + liste.map(function (e) { return gecisSatir(e, im); }).join("") + "</ul>" +
      (oz.toplam > oz.sonGecisler.length ? "<button class='gc-btn' data-gc-act='tumu' type='button' aria-expanded='" + d.tumu + "'>" + (d.tumu ? "Yalnızca son geçişleri göster" : "Tüm geçişleri göster (" + oz.toplam + ")") + "</button>" : "") +
      "<p class='gc-not'>OpenF1 kayıtlarına göre; pit ve ceza kaynaklı sıra değişimlerini de içerebilir, eksik olabilir.</p><p class='gc-kaynak'>Kaynak: OpenF1 / Overtakes</p>";
  }
  function blok(id, h, s) {
    var d = durum(id);
    return "<button class='gc-ac' data-gc-act='ac' type='button' aria-expanded='" + d.acik + "'>" + (d.acik ? "Geçişler ▴" : "Geçişler ▾") + "</button>" + (d.acik ? "<div class='gc-govde'>" + govde(id, h, s) + "</div>" : "");
  }
  function html(h, s, dd, st) {
    if (!OH || !OV || !OH.SEANSLAR[s.anahtar]) { return ""; }
    if (dd !== "tamamlandi" && dd !== "bitti") { return ""; }
    if (st && (st.durum === "POSTPONED" || st.durum === "CANCELLED")) { return ""; }
    var id = kimlik(h, s);
    return "<div class='gc' data-gc='" + esc(id) + "' data-seans='" + esc(s.anahtar) + "'>" + blok(id, h, s) + "</div>";
  }
  function bulHS(kutu) {
    var S = window.YarisHaftasi && window.YarisHaftasi._durum, h = S && S.hafta; if (kutu.closest && kutu.closest("#sekme-gun") && window.A7Hafta) { h = window.A7Hafta() || h; } else if (kutu.closest && kutu.closest("#sekme-yaris") && window.A7HaftaYaris) { h = window.A7HaftaYaris() || h; } if (!h) { return null; }
    var s = (h.seanslar || []).filter(function (x) { return x.anahtar === kutu.getAttribute("data-seans"); })[0];
    return s ? { h: h, s: s } : null;
  }
  async function yukle(kutu, id, hs) {
    var d = durum(id); d.durum = "yukleniyor"; kutu.innerHTML = blok(id, hs.h, hs.s);
    var sonuc; try { sonuc = await OV.yukle(hs.h, hs.s); } catch (e) { sonuc = { durum: "hata" }; }
    d.durum = sonuc.durum; d.veri = sonuc.durum === "ok" ? { isimler: sonuc.isimler, ozet: sonuc.ozet } : null; d.gecisler = sonuc.durum === "ok" ? sonuc.gecisler : null;
    var yeni = document.querySelector("[data-gc='" + id + "']") || kutu; yeni.innerHTML = blok(id, hs.h, hs.s);
  }
  document.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest("[data-gc-act]"); if (!el) { return; }
    var kutu = el.closest("[data-gc]"); if (!kutu) { return; }
    var hs = bulHS(kutu); if (!hs) { return; }
    var id = kutu.getAttribute("data-gc"), d = durum(id), a = el.getAttribute("data-gc-act");
    if (a === "ac") { d.acik = !d.acik; if (d.acik && !d.veri && d.durum !== "yukleniyor" && (!d.durum || d.durum === "ok")) { yukle(kutu, id, hs); } else { kutu.innerHTML = blok(id, hs.h, hs.s); } }
    else if (a === "tumu") { d.tumu = !d.tumu; kutu.innerHTML = blok(id, hs.h, hs.s); }
    else if (a === "tekrar") { yukle(kutu, id, hs); }
  });
  window.Gecisler = { html: html, _durum: ST };
})();
