/* OPENF1 A7.5 — "Seans Hava Koşulları" arayüzü (tamamlanmış HER seans kartı, kullanıcı açınca tarihsel weather yüklenir). Polling/zamanlayıcı yok; nedensel yorum yok.
   Seans içi OpenF1 ÖLÇÜMLERİdir (gerçekleşen) — mevcut Open-Meteo hafta/canlı hava kartından ayrıdır ve onu DEĞİŞTİRMEZ. Rüzgâr tek birim: m/s. */
(function () {
  "use strict";
  var H = window.SeansHavaHesap, V = window.SeansHavaVeri, ST = {};
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function kimlik(h, s) { return h.sezon + "-" + h.tur + "-" + s.anahtar; }
  function durum(id) { return ST[id] || (ST[id] = { acik: false, durum: null, ozet: null }); }
  function saat(ms) { try { return new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(ms)); } catch (e) { return ""; } }
  function olcum(baslik, o) {
    if (!o) { return ""; }
    var s = [];
    if (o.airTemperature != null) { s.push("Hava " + H.derece(o.airTemperature)); }
    if (o.trackTemperature != null) { s.push("Pist " + H.derece(o.trackTemperature)); }
    if (o.humidity != null) { s.push("Nem " + H.yuzde(o.humidity)); }
    if (o.pressure != null) { s.push("Basınç " + o.pressure.toFixed(1) + " mbar"); }
    if (o.windSpeed != null) { s.push("Rüzgâr " + H.ruzgar(o.windSpeed) + (o.windDirection != null ? " · " + H.yonYaz(o.windDirection) : "")); }
    else if (o.windDirection != null) { s.push("Rüzgâr yönü " + H.yonYaz(o.windDirection)); }
    if (o.rainfall != null) { s.push("Yağış: " + H.yagisYaz(o.rainfall)); }
    return "<div class='sh-olcum'><p class='sh-bas'>" + esc(baslik) + " <small>" + esc(saat(o.ms)) + "</small></p><ul class='sh-liste'>" + s.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>";
  }
  function aralik(a, f) { return a ? (a.min === a.max ? f(a.min) : f(a.min) + " – " + f(a.max)) : null; }
  function govde(id) {
    var d = durum(id);
    if (d.durum === "yukleniyor") { return "<p class='sh-not'>Yükleniyor…</p>"; }
    if (d.durum && d.durum !== "ok") { return "<p class='sh-not'>" + esc(H.durumMesaji(d.durum)) + "</p>" + (d.durum === "hata" || d.durum === "kisit" ? "<button class='sh-btn' data-sh-act='tekrar' type='button'>Yeniden dene</button>" : ""); }
    if (!d.ozet) { return ""; }
    var o = d.ozet, ayni = o.baslangic && o.bitis && o.baslangic.ms === o.bitis.ms, ek = [];
    var h = aralik(o.hava, H.derece), p = aralik(o.pist, H.derece);
    if (h) { ek.push("Hava " + h); } if (p) { ek.push("Pist " + p); } if (o.maxRuzgar != null) { ek.push("En yüksek rüzgâr " + H.ruzgar(o.maxRuzgar)); }
    var yg = o.yagis.olcumVar ? (o.yagis.goruldu ? "Yağış kaydı var (" + o.yagis.yagisliKayit + " / " + o.yagis.kayit + " ölçüm)" : "Yağış kaydı yok (" + o.yagis.kayit + " ölçüm)") : null;
    return "<p class='sh-not'>Seans içi OpenF1 ölçümleri (gerçekleşen). Hafta tahmini (Open-Meteo) değildir.</p>" +
      (ayni ? olcum("Ölçüm", o.baslangic) : olcum("Başlangıç", o.baslangic) + olcum("Bitiş", o.bitis)) +
      ((ek.length || yg) ? "<div class='sh-olcum'><p class='sh-bas'>Seans boyunca</p><ul class='sh-liste'>" + ek.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + (yg ? "<li>" + esc(yg) + "</li>" : "") + "</ul></div>" : "") +
      "<p class='sh-kaynak'>Kaynak: OpenF1 / Weather</p>";
  }
  function blok(id) {
    var d = durum(id);
    return "<button class='sh-ac' data-sh-act='ac' type='button' aria-expanded='" + d.acik + "'>" + (d.acik ? "Seans Hava Koşulları ▴" : "Seans Hava Koşulları ▾") + "</button>" + (d.acik ? "<div class='sh-govde'>" + govde(id) + "</div>" : "");
  }
  function html(h, s, dd, st) {
    if (!H || !V || !H.SEANSLAR[s.anahtar]) { return ""; }
    if (dd !== "tamamlandi" && dd !== "bitti") { return ""; }
    if (st && (st.durum === "POSTPONED" || st.durum === "CANCELLED")) { return ""; }
    var id = kimlik(h, s);
    return "<div class='sh' data-sh='" + esc(id) + "' data-seans='" + esc(s.anahtar) + "'>" + blok(id) + "</div>";
  }
  function bulHS(kutu) {
    var S = window.YarisHaftasi && window.YarisHaftasi._durum, h = S && S.hafta; if (kutu.closest && kutu.closest("#sekme-gun") && window.A7Hafta) { h = window.A7Hafta() || h; } else if (kutu.closest && kutu.closest("#sekme-yaris") && window.A7HaftaYaris) { h = window.A7HaftaYaris() || h; } if (!h) { return null; }
    var s = (h.seanslar || []).filter(function (x) { return x.anahtar === kutu.getAttribute("data-seans"); })[0];
    return s ? { h: h, s: s } : null;
  }
  async function yukle(kutu, id, hs) {
    var d = durum(id); d.durum = "yukleniyor"; kutu.innerHTML = blok(id);
    var sonuc; try { sonuc = await V.yukle(hs.h, hs.s); } catch (e) { sonuc = { durum: "hata" }; }
    d.durum = sonuc.durum; d.ozet = sonuc.durum === "ok" ? sonuc.ozet : null;
    var yeni = document.querySelector("[data-sh='" + id + "']") || kutu; yeni.innerHTML = blok(id);
  }
  document.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest("[data-sh-act]"); if (!el) { return; }
    var kutu = el.closest("[data-sh]"); if (!kutu) { return; }
    var hs = bulHS(kutu); if (!hs) { return; }
    var id = kutu.getAttribute("data-sh"), d = durum(id), a = el.getAttribute("data-sh-act");
    if (a === "ac") { d.acik = !d.acik; if (d.acik && !d.ozet && d.durum !== "yukleniyor" && (!d.durum || d.durum === "ok")) { yukle(kutu, id, hs); } else { kutu.innerHTML = blok(id); } }
    else if (a === "tekrar") { yukle(kutu, id, hs); }
  });
  window.SeansHava = { html: html, _durum: ST };
})();
