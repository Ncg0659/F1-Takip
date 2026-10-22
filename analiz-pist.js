/* A3.4a — PİST TÜRÜ PERFORMANSI (Grafik sekmesi). Pilot ve takım performansını UYGULAMA İÇİ pist sınıflandırmasına göre gösterir
   (resmî FIA kategorisi değildir). VERİ: A3.1 modeli (AnalizMerkezi._durum) + takvimin MEVCUT önbelleği (round → circuitId; aynı takvim kaydı
   A1/A2/A3.1 ile ortak). YENİ AĞ ÇAĞRISI YOKTUR, OpenF1 KULLANILMAZ, yeni tercih anahtarı YOKTUR (seçim yalnızca bellekte; varsayılan favori
   pilot, yoksa lider). Hesap: sezon-hesap-a34.js (saf; kurallar A3.2/A3.3 ile aynı). Yorum yalnızca ölçülebilir veriden gelir; sebep/performans yorumu yok. */
(function () {
  "use strict";
  var AM = window.AnalizMerkezi, H4 = window.SezonHesapA34, PS = window.PIST_SINIFLANDIRMA, F = window.F1UI;
  if (!AM || !AM.dinle || !H4 || !PS) { return; }
  var S = AM._durum;
  var C = { model: null, imza: "", h: null, takvim: null, mod: "pilot", pilot: null, takim: null };
  var planli = false, bagli = false;

  function esc(x) { return F && F.esc ? F.esc(x) : String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }
  function kok() { return document.getElementById("a3-merkez"); }
  function soz(k) { try { return window.ICERIK && ICERIK.sozluk && ICERIK.sozluk.terimler[k] || null; } catch (e) { return null; } }
  function bilgi(k) { var t = soz(k); return t ? "<button type='button' class='a2-i' data-terim='" + k + "' aria-haspopup='dialog' aria-label='" + esc(t.ad) + " nedir?' title='" + esc(t.ad) + " nedir?'></button>" : ""; }
  function favori() { try { return localStorage.getItem("f1-favori") || ""; } catch (e) { return ""; } }
  function sezonYili() { try { return typeof SEZON !== "undefined" ? SEZON : new Date().getFullYear(); } catch (e) { return new Date().getFullYear(); } }
  function ad(id) { var p = S.model.pilotlar[id]; return p ? p.a : id; }
  function takimAd(id) { return S.model.takimlar[id] || id; }
  function o1(x) { return x == null ? "—" : x.toFixed(1); }

  // takvim: önce ortak önbellek kaydı (ağ yok), olmazsa eski sekmenin takvim değişkeni (salt okunur)
  function takvimOku() {
    var yarislar = null;
    try {
      var k = window.JolpicaIstemci && JolpicaIstemci.oku("takvim-" + sezonYili()), v = k && k.veri;
      yarislar = v && ((v.RaceTable && v.RaceTable.Races) || v.Races || (Array.isArray(v) ? v : null));
    } catch (e) { yarislar = null; }
    if (!yarislar || !yarislar.length) { try { if (typeof sezonYarislar !== "undefined" && sezonYarislar.length) { yarislar = sezonYarislar; } } catch (e2) { /* yok */ } }
    var h = {}; C.takvimAd = {};
    (yarislar || []).forEach(function (y) { if (y && y.Circuit && y.Circuit.circuitId) { h[Number(y.round)] = y.Circuit.circuitId; C.takvimAd[Number(y.round)] = y.raceName || ""; } });
    return h;
  }
  function hesap() {
    var tp = takvimOku(), imza = Object.keys(tp).length + ":" + JSON.stringify(tp).length;
    if (C.model !== S.model || C.imza !== imza) { C.model = S.model; C.imza = imza; C.takvim = tp; C.h = H4.hesapla(S.model, tp); }
  }

  function pilotListesi() { return (S.sira || []).filter(function (id) { return C.h.pilot[id]; }); }
  function takimListesi() { return (S.siraT || []).filter(function (id) { return C.h.takim[id]; }); }
  function aktif(liste, sec) {
    if (sec && liste.indexOf(sec) >= 0) { return sec; }
    return liste[0];
  }
  function varsayilanPilot(l) { var f = favori(); return (f && l.indexOf(f) >= 0) ? f : l[0]; }

  // ---- parçalar ----
  function kucukEtiket(kucuk) { return kucuk ? "<span class='a34-kucuk' title='3 yarıştan az: sonuç güçlü bir bulgu olarak okunmamalı'>Küçük örneklem</span>" : ""; }
  function pilotKart(kk, v) {
    var K = PS.KATEGORILER[kk], n = C.h.yarisSayisi[kk];
    var bas = "<h3>" + esc(K.ad.toLocaleUpperCase("tr-TR")) + "</h3>";
    if (!n) { return "<div class='a34-kart a34-bos' data-a34-kat='" + kk + "'>" + bas + "<p class='a34-alt'>Bu sezon bu türde yarış yok</p></div>"; }
    if (!v) { return "<div class='a34-kart a34-bos' data-a34-kat='" + kk + "'>" + bas + "<p class='a34-alt'>Bu pilot bu türde yarışmadı (" + n + " yarış yapıldı)</p></div>"; }
    var ornek = v.n !== v.yaris ? "<p class='a34-alt a34-ornek'>" + v.n + " / " + v.yaris + " yarış üzerinden</p>" : "";
    return "<div class='a34-kart' data-a34-kat='" + kk + "'>" + bas +
      "<dl class='a34-say'><div><dt>Yarış</dt><dd>" + v.yaris + "</dd></div><div><dt>Puan</dt><dd>" + v.puan + "</dd></div>" +
      "<div><dt>Ort. bitiş</dt><dd>" + o1(v.ortBitis) + "</dd></div></dl>" + ornek +
      "<p class='a34-alt'>" + o1(v.ortPuan) + " puan/yarış · " + v.galibiyet + " gal. · " + v.podyum + " pod. · " + v.dnf + " DNF" + (v.dns ? " · " + v.dns + " DNS" : "") + (v.dsq ? " · " + v.dsq + " DSQ" : "") + "</p>" +
      kucukEtiket(v.kucuk) + "</div>";
  }
  function takimKart(kk, v) {
    var K = PS.KATEGORILER[kk], n = C.h.yarisSayisi[kk];
    var bas = "<h3>" + esc(K.ad.toLocaleUpperCase("tr-TR")) + "</h3>";
    if (!n) { return "<div class='a34-kart a34-bos' data-a34-kat='" + kk + "'>" + bas + "<p class='a34-alt'>Bu sezon bu türde yarış yok</p></div>"; }
    if (!v) { return "<div class='a34-kart a34-bos' data-a34-kat='" + kk + "'>" + bas + "<p class='a34-alt'>Bu takım bu türde yarışmadı</p></div>"; }
    return "<div class='a34-kart' data-a34-kat='" + kk + "'>" + bas +
      "<dl class='a34-say'><div><dt>Yarış</dt><dd>" + v.yaris + "</dd></div><div><dt>Takım puanı</dt><dd>" + v.puan + "</dd></div>" +
      "<div><dt>Ort. puan</dt><dd>" + o1(v.ortPuan) + "</dd></div></dl>" +
      "<p class='a34-alt'>" + v.galibiyet + " galibiyet · " + v.podyum + " podyum (takımın iki pilotu toplamı)</p>" + kucukEtiket(v.kucuk) + "</div>";
  }
  function barlar(kategoriler, birim) {
    var maks = 0; C.h.siralama.forEach(function (k) { var v = kategoriler[k]; if (v && v.ortPuan != null && v.ortPuan > maks) { maks = v.ortPuan; } });
    var g = H4.enYuksekOrtalama(kategoriler, C.h.siralama), kaz = g ? g.kategoriler : [];
    return "<div class='a34-barlar' role='list' aria-label='Pist türüne göre puan/yarış'>" + C.h.siralama.map(function (k) {
      var v = kategoriler[k], y = v && v.ortPuan != null;
      return "<div class='a34-bar" + (kaz.indexOf(k) >= 0 ? " a34-eniyi" : "") + "' role='listitem'><span class='a34-bad'>" + esc(PS.KATEGORILER[k].ad) + "</span>" +
        "<span class='a34-cu' aria-hidden='true'>" + (y && maks > 0 ? "<i style='width:" + Math.round(v.ortPuan / maks * 100) + "%'></i>" : "") + "</span>" +
        "<span class='a34-bd'>" + (y ? o1(v.ortPuan) + " " + birim : "—") + (v && v.kucuk ? " <small>(küçük örneklem)</small>" : "") + "</span></div>";
    }).join("") + "</div>";
  }
  function enYuksekKart(kategoriler, birim) {
    var g = H4.enYuksekOrtalama(kategoriler, C.h.siralama);
    if (!g) { return "<p class='a34-alt'>Puan ortalaması karşılaştırması için en az iki türde yarış gerekir.</p>"; }
    var adlar = g.kategoriler.map(function (k) { return PS.KATEGORILER[k].ad; }).join(" ve ");
    return "<div class='a34-en' data-a34-en><span class='a34-et'>EN YÜKSEK PUAN ORTALAMASI</span>" +
      "<b>En yüksek ortalama puan: " + esc(adlar) + " pistler" + (g.kategoriler.length > 1 ? " (eşit)" : "") + " — " + o1(g.deger) + " " + birim + "</b>" +
      "<span class='a34-alt'>Yalnızca sayısal karşılaştırma; sebep yorumu yapılmaz.</span>" + kucukEtiket(g.kucuk) + "</div>";
  }
  // Tablo: YALNIZCA seçili sezonun takvimindeki yarışlar (tur → circuitId). Sınıflandırma dosyasındaki takvimde olmayan ek pistler görünmez.
  function siniflama() {
    var h = C.h, turlar = {}, satir = "", sf = "";
    Object.keys(C.takvim).forEach(function (n) { turlar[n] = true; });
    Object.keys(S.model.turlar).forEach(function (n) { if (S.model.turlar[n].yaris.length) { turlar[n] = true; } });
    var liste = Object.keys(turlar).map(Number).sort(function (a, b) { return a - b; }), yapilan = 0, harita = PS.harita();
    var gruplar = {}; h.siralama.forEach(function (k) { gruplar[k] = []; });
    liste.forEach(function (n) {
      var pid = C.takvim[n], p = pid ? harita[pid] : null, yapildi = h.tur[n] !== undefined;
      if (yapildi) { yapilan++; }
      var ad = (S.model.turlar[n] && S.model.turlar[n].ad) || C.takvimAd[n] || ("Tur " + n);
      var ad2 = esc(ad) + (yapildi ? "" : " <span class='a34-yok'>(henüz yarışılmadı)</span>");
      if (p) { gruplar[p.kategori].push("<tr" + (yapildi ? "" : " class='a34-gel'") + "><td>" + n + "</td><td>" + ad2 + "</td><td>" + esc(PS.KATEGORILER[p.kategori].ad) + (p.tartisma ? " <span class='a34-tart' title='Tartışmalı sınıflandırma'>⚑</span>" : "") + "</td><td>" + esc(p.gerekce) + "</td></tr>"); }
      else { sf += "<tr class='a34-sf'><td>" + n + "</td><td>" + ad2 + "</td><td>Sınıflandırılmamış</td><td>" + (pid ? "Pist (" + esc(pid) + ") sınıflandırma tablosunda yok" : "Takvimde bu tur için pist bilgisi yok") + "; istatistiğe girmez.</td></tr>"; }
    });
    h.siralama.forEach(function (k) { satir += gruplar[k].join(""); });
    satir += sf;
    var tanim = h.siralama.map(function (k) { return "<li><b>" + esc(PS.KATEGORILER[k].ad) + ":</b> " + esc(PS.KATEGORILER[k].tanim) + "</li>"; }).join("");
    return "<details class='a34-sinif'" + (C.sinifAcik ? " open" : "") + "><summary>Pist sınıflandırmasını göster</summary>" +
      "<p class='a34-alt'>Uygulama içi pist sınıflandırması; resmî FIA kategorisi değildir. Her pist yalnızca bir ana kategoriye girer. ⚑ = tek kategoriye oturması tartışmalı; gerekçe yazılıdır.</p>" +
      "<p class='a34-alt' data-a34-takvim>Sezon takviminde " + liste.length + " yarış var; " + yapilan + " tanesi yapıldı ve istatistiğe girdi. Tabloda yalnızca bu takvimdeki pistler görünür.</p><ul class='a34-tanim'>" + tanim + "</ul>" +
      "<div class='a34-kay'><table><thead><tr><th>Tur</th><th>Yarış</th><th>Kategori</th><th>Gerekçe</th></tr></thead><tbody>" + satir + "</tbody></table></div></details>";
  }
  function secici(mod, liste, sec) {
    var opts = liste.map(function (id) { return "<option value='" + esc(id) + "'" + (id === sec ? " selected" : "") + ">" + esc(mod === "pilot" ? ad(id) : takimAd(id)) + "</option>"; }).join("");
    return "<div class='a34-kontrol'><div class='a34-mod' role='group' aria-label='Görünüm'>" +
      "<button type='button' data-a34-mod='pilot' aria-pressed='" + (mod === "pilot") + "'>Pilot</button>" +
      "<button type='button' data-a34-mod='takim' aria-pressed='" + (mod === "takim") + "'>Takım</button></div>" +
      "<label class='a34-sec'><span>" + (mod === "pilot" ? "Pilot" : "Takım") + "</span><select data-a34-sec aria-label='" + (mod === "pilot" ? "Pilot seç" : "Takım seç") + "'>" + opts + "</select></label></div>";
  }

  function govde() {
    hesap();
    var h = C.h, bas = "<h2>Pist türü performansı " + bilgi("pist-turu") + "</h2>" +
      "<p class='a3-not'>Uygulama içi pist sınıflandırması (resmî FIA kategorisi değildir). Yalnızca ana yarış sonuçları; sprint hariç. Puan, o türdeki yarışlarda alınan ana yarış puanıdır.</p>";
    if (!Object.keys(C.takvim).length) { return bas + "<p class='a3-bos'>Takvimdeki pist bilgisi henüz yok; pist türü analizi gösterilemiyor.</p>"; }
    var pl = pilotListesi(), tl = takimListesi();
    if (!pl.length) { return bas + "<p class='a3-bos'>Sınıflandırılmış pistlerde yarışılmış sonuç yok.</p>"; }
    if (C.mod === "takim" && !tl.length) { C.mod = "pilot"; }
    var ic;
    if (C.mod === "pilot") {
      var sec = (C.pilot && pl.indexOf(C.pilot) >= 0) ? C.pilot : varsayilanPilot(pl), v = h.pilot[sec];
      ic = secici("pilot", pl, sec) +
        "<div class='a34-izgara' data-a34-pilot='" + esc(sec) + "'>" + h.siralama.map(function (k) { return pilotKart(k, v[k]); }).join("") + "</div>" +
        "<h3 class='a34-alth'>Puan/yarış karşılaştırması</h3>" + barlar(v, "puan/yarış") + enYuksekKart(v, "puan/yarış");
    } else {
      var st = aktif(tl, C.takim), tv = h.takim[st];
      ic = secici("takim", tl, st) +
        "<div class='a34-izgara' data-a34-takim='" + esc(st) + "'>" + h.siralama.map(function (k) { return takimKart(k, tv[k]); }).join("") + "</div>" +
        "<h3 class='a34-alth'>Takım puanı/yarış karşılaştırması</h3>" + barlar(tv, "puan/yarış") + enYuksekKart(tv, "puan/yarış");
    }
    var not = h.sinifsiz.length ? "<p class='a34-uyari' role='status'>" + h.sinifsiz.length + " yarış sınıflandırılamadı ve istatistiğe girmiyor: " + esc(h.sinifsiz.map(function (s) { return "Tur " + s.tur + " " + S.model.turlar[s.tur].ad; }).join("; ")) + ".</p>" : "";
    return bas + ic + not + siniflama();
  }
  function yenile() {
    planli = false;
    var k = kok();
    if (!k || S.durum !== "hazir" || !S.model || !k.querySelector("#a3-pilot")) { return; }
    var el = k.querySelector("#a34-pist");
    if (!el) {
      var ref = k.querySelector("#a33-sprint") || k.querySelector("#a32-dnf") || k.querySelector("#a3-takim"); if (!ref) { return; }
      el = document.createElement("section"); el.id = "a34-pist"; el.className = "a3-kart a34-bolum"; el.setAttribute("data-a34", "1");
      ref.parentNode.insertBefore(el, ref.nextSibling);
    }
    var a = document.activeElement, odak = a && a.hasAttribute ? (a.hasAttribute("data-a34-sec") ? "sec" : a.hasAttribute("data-a34-mod") ? "mod:" + a.getAttribute("data-a34-mod") : "") : "";
    el.innerHTML = govde();
    if (odak) { var s = odak === "sec" ? el.querySelector("[data-a34-sec]") : el.querySelector("[data-a34-mod='" + odak.slice(4) + "']"); if (s) { s.focus(); } }
  }
  function planla() { if (planli) { return; } planli = true; Promise.resolve().then(yenile); }

  function olaylar(k) {
    if (bagli) { return; } bagli = true;
    k.addEventListener("change", function (e) {
      var s = e.target; if (!s || !s.hasAttribute || !s.hasAttribute("data-a34-sec")) { return; }
      if (C.mod === "pilot") { C.pilot = s.value; } else { C.takim = s.value; } planla();
    });
    k.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("button[data-a34-mod]") : null; if (!b) { return; }
      C.mod = b.getAttribute("data-a34-mod"); planla();
    });
    k.addEventListener("toggle", function (e) { if (e.target && e.target.classList && e.target.classList.contains("a34-sinif")) { C.sinifAcik = e.target.open; } }, true);
  }
  function baslat() {
    var k = kok(); if (!k) { return; }
    olaylar(k);
    AM.dinle(function () { planla(); });
    if (AM.durum() === "hazir") { planla(); }
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", baslat); } else { baslat(); }
})();
