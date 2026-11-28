/* UI v4 — AKILLI ANA SAYFA (v4.0 Aşama 2). YALNIZ gizli önizlemede (html[data-v4="1"]) etkin; bayrak yoksa hiçbir şey yapmaz.
   ANA SAYFA = mevcut #sekme-sezon + BUGÜN özeti (#bg-kok) üst durum kartı olarak. Mevcut DOM düğümleri TAŞINIR (kopya yok, kimlikler aynı):
     #av4-durum   : #bg-kok (BUGÜN akıllı durum kartı, 5 durum). Kısa yarış tahmini (#tp-bugun) Aşama 3'te PROGRAM'a taşındı (hafta-v4.js)
     #av4-son     : SON YARIŞ — SezonTakvim'in zaten yüklediği modelden (kazanan/podyum/pole/sprint); yeni istek yok
     #av4-puan    : pilot + takım puan durumu (mevcut tablolar)
     #av4-senaryo : SENARYO — mevcut şampiyonluk hesaplayıcı; SampiyonlukDurumu "belli" iken otomatik gizlenir
     #av4-takvim  : sezon takvimi (#a2-takvim + yedek tablo); takvimin "SIRADAKİ" kartı v4'te gizli (sayaç üst kartta)
     #av4-seriler : SERİLER — F2/F3 için mevcut doğrulanmış veriye (DIGER_SERILER) kısayol kartları. Formula E, F4, F1 Academy gösterilmez.
   Durum (data-av4-mod): canli | hafta | bitti | normal | ara — BugunV3.modBelirle() + üst kartın data-mod/ton'u okunur (yeni hesap yok).
   İçerik önceliği durumla değişir (CSS order). Yeni fetch / zamanlayıcı / depolama YOK; yeniden değerlendirme: f1-sekme, f1-feed-guncel,
   f1-sezon-durumu, #rc-saat gözlemcisi (10 sn'de bir), #a2-takvim / #bg-kok / #hesap-sonuc değişimleri. */
(function () {
  "use strict";
  var S = { kuruldu: false, mod: null, tik: 0, sonImza: null, serImza: null, senaryo: null };
  var BOLUM = [["durum", null], ["son", "SON YARIŞ"], ["puan", null], ["senaryo", "SENARYO"], ["takvim", "TAKVİM"], ["seriler", "SERİLER"]];
  var SERILER = ["f2", "f3"];                       // v4 kapsamı: F2, F3 (doğrulanmış veri). F4 / F1 Academy veri altyapısı hazır olunca.

  function $(id) { return document.getElementById(id); }
  function v4() { return document.documentElement.getAttribute("data-v4") === "1"; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function bul(f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } }
  function mk(tag, id, cls) { var e = document.createElement(tag); if (id) { e.id = id; } if (cls) { e.className = cls; } return e; }

  // ---------- kurulum: düğümleri bölümlere taşı ----------
  function kur() {
    if (S.kuruldu) { return true; }
    if (!v4()) { return false; }
    var sz = $("sekme-sezon"), kok = $("bg-kok"); if (!sz || !kok) { return false; }
    var av = mk("div", "av4", "av4"); av.setAttribute("data-av4-mod", "normal");
    BOLUM.forEach(function (b) {
      var s = mk("section", "av4-" + b[0], "av4-bolum av4-" + b[0]);
      if (b[1]) { var h = mk("p", null, "av4-b"); h.id = "av4-b-" + b[0]; h.textContent = b[1]; s.appendChild(h); s.setAttribute("aria-labelledby", h.id); }
      av.appendChild(s);
    });
    var son = $("sonraki"); sz.insertBefore(av, son ? son.nextSibling : sz.firstChild);
    // durum kartı + kısa tahmin
    $("av4-durum").appendChild(kok);
    $("av4-durum").setAttribute("aria-label", "Durum");
    // puan durumu: iki tablo yan yana (masaüstü)
    var pg = $("pilot-govde"), tg = $("takim-govde");
    [[pg, "av4-puan-p"], [tg, "av4-puan-t"]].forEach(function (x) {
      var kap = x[0] && x[0].closest(".kap"); if (!kap) { return; }
      var h = kap.previousElementSibling, blok = mk("div", x[1], "av4-puan-blok");
      $("av4-puan").appendChild(blok); if (h && h.tagName === "H2") { blok.appendChild(h); } blok.appendChild(kap);
    });
    $("av4-puan").setAttribute("aria-label", "Puan durumu");
    // senaryo
    var hs = sz.querySelector("section.ui-hesap"); if (hs) { $("av4-senaryo").appendChild(hs); }
    // takvim
    var tk = $("a2-takvim"), et = $("a2-eski-takvim"); if (tk) { $("av4-takvim").appendChild(tk); } if (et) { $("av4-takvim").appendChild(et); }
    var ac = mk("button", "av4-takvim-ac", "av4-btn av4-takvim-ac"); ac.type = "button"; ac.setAttribute("aria-expanded", "false"); ac.setAttribute("aria-controls", "a2-takvim");
    ac.innerHTML = "GEÇMİŞ YARIŞLARI DA GÖSTER <span aria-hidden='true'>↓</span>"; $("av4-takvim").appendChild(ac);   // yalnız mobilde görünür (CSS)
    $("av4-takvim").setAttribute("data-kisa", "1");
    // son yarış + seriler (yeni kartlar)
    var sk = mk("div", "av4-son-kart", "av4-kart av4-son-kart"); $("av4-son").appendChild(sk);
    var sr = mk("div", "av4-ser-liste", "av4-ser-liste"); $("av4-seriler").appendChild(sr);
    S.kuruldu = true;
    gozle(); guncelle();
    return true;
  }

  // ---------- durum (5 mod) ----------
  function modBul() {
    var h = document.querySelector("#bg-kok [data-mod]"), dm = h ? h.getAttribute("data-mod") : null, ton = h ? h.getAttribute("data-ton") : null;
    if (dm === "ara") { return "ara"; }
    if (dm === "B" && ton === "bitti") { return "ara"; }               // sezon tamamlandı (sıradaki yarış yok)
    if (dm === "C") { return "bitti"; }
    if (dm === "A") {
      var m = bul(function () { return BugunV3.modBelirle(Date.now()); }, null);
      return m && m.canli ? "canli" : "hafta";
    }
    return "normal";
  }
  function senaryoYaz() {
    var sd = bul(function () { return window.SampiyonlukDurumu && SampiyonlukDurumu.mevcut(); }, null);
    var gizle = !!(sd && sd.durum === "belli");
    var b = $("av4-senaryo"); if (!b) { return; }
    if (S.senaryo !== gizle) { S.senaryo = gizle; b.hidden = gizle; b.setAttribute("data-durum", sd && sd.durum ? sd.durum : "yok"); }
  }
  function kartDuzelt() {                                   // üst kartta v4'e özgü küçük metin uyumu (yalnız etiket; veri aynı)
    Array.prototype.forEach.call(document.querySelectorAll("#bg-kok .bg-btn[data-git='hafta'], #bg-kok .bg-btn[data-git='gun'], #bg-kok .bg-btn[data-git='sprint']"), function (b) {
      var tn = b.firstChild; if (tn && tn.nodeType === 3 && /HAFTA SONU'NA GİT/.test(tn.nodeValue)) { tn.nodeValue = tn.nodeValue.replace("HAFTA SONU'NA GİT", "YARIŞ HAFTASI"); }
      var sm = b.querySelector("small"); if (sm && sm.textContent === "YARIŞ GÜNÜ") { sm.textContent = "CANLI"; }
    });
  }

  // ---------- SON YARIŞ ----------
  function sonYaris() {
    var mdl = bul(function () { return SezonTakvim._durum.model; }, null); if (!mdl || !mdl.turlar) { return null; }
    var son = null;
    Object.keys(mdl.turlar).forEach(function (n) { var t = mdl.turlar[n]; if (t && t.kazanan && (!son || t.tur > son.tur)) { son = t; } });
    if (!son) { return null; }
    var y = (mdl.yarislar || []).filter(function (r) { return Number(r.round) === son.tur; })[0] || null;
    return { t: son, y: y, toplam: (mdl.yarislar || []).length };
  }
  function pilotSat(sira, r) {
    if (!r) { return ""; }
    var poz = bul(function () { return F1UI.pozRozet(String(sira)); }, "<b>" + sira + "</b>");
    var p = bul(function () { return F1UI.pilotHucresi(r.k, r.a); }, esc(r.a));
    var t = bul(function () { return F1UI.takimRozeti(r.t); }, esc(r.t));
    return "<li class='av4-pod-s'>" + poz + "<span class='av4-pod-p'>" + p + "</span><span class='av4-pod-t'>" + t + "</span></li>";
  }
  function sonYaz() {
    var k = $("av4-son-kart"), b = $("av4-son"); if (!k || !b) { return; }
    var d = sonYaris(); if (!d) { b.hidden = true; S.sonImza = null; return; }
    var t = d.t, y = d.y, tarih = y && y.date ? bul(function () { return new Date(y.date + "T12:00:00Z").toLocaleDateString("tr-TR", { day: "numeric", month: "long" }); }, y.date) : "";
    var yer = y && y.Circuit ? (y.Circuit.circuitName || "") : "";
    var ekler = [];
    if (t.pole) { ekler.push("<span class='av4-ek'><b>POLE</b> " + esc(t.pole.k || t.pole.a) + "</span>"); }
    if (t.sprint) { ekler.push("<span class='av4-ek'><b>SPRINT</b> " + esc(t.sprint.k || t.sprint.a) + "</span>"); }
    var h = "<div class='av4-son-ust'><p class='av4-son-meta'><span>TUR " + esc(t.tur) + (d.toplam ? " / " + d.toplam : "") + "</span>" + (tarih ? "<span>" + esc(tarih) + "</span>" : "") + "</p>" +
      "<h3 class='av4-son-ad' lang='en'>" + esc(t.ad || (y && y.raceName) || "") + "</h3>" + (yer ? "<p class='av4-son-yer' lang='en'>" + esc(yer) + "</p>" : "") + "</div>" +
      "<ol class='av4-pod' aria-label='Podyum'>" + pilotSat(1, t.kazanan) + pilotSat(2, t.p2) + pilotSat(3, t.p3) + "</ol>" +
      (ekler.length ? "<p class='av4-ekler'>" + ekler.join("") + "</p>" : "") +
      "<div class='av4-cta'><button type='button' class='av4-btn' data-av4-git='yaris'>YARIŞ ANALİZİ <span aria-hidden='true'>→</span></button></div>";
    if (S.sonImza !== h) { S.sonImza = h; k.innerHTML = h; }
    b.hidden = false;
  }

  // ---------- SERİLER ----------
  function serYaz() {
    var l = $("av4-ser-liste"), b = $("av4-seriler"); if (!l || !b) { return; }
    var veri = (window.DIGER_SERILER || []).filter(function (x) { return SERILER.indexOf(x.kod) >= 0; });
    if (!veri.length) { b.hidden = true; return; }
    var h = veri.map(function (x) {
      var p = x.pilotlar || [], l1 = p[0], l2 = p[1];
      var fark = l1 && l2 && isFinite(l1[3]) && isFinite(l2[3]) ? (l1[3] - l2[3]) : null;
      var tarih = String(x.guncelleme || "").replace(/\s*\(.*\)\s*$/, "");
      return "<button type='button' class='av4-kart av4-ser' data-av4-seri='" + esc(x.kod) + "' aria-label='" + esc(x.ad) + " puan durumunu aç'>" +
        "<span class='av4-ser-ad'>" + esc(x.ad) + "</span>" +
        (l1 ? "<span class='av4-ser-lider'><small>LİDER</small><b>" + esc(l1[1]) + "</b><em>" + esc(l1[2]) + "</em><strong>" + esc(l1[3]) + " <small>PUAN</small></strong></span>" : "") +
        (fark != null ? "<span class='av4-ser-fark'>" + esc(l2[1]) + " " + (fark === 0 ? "ile eşit" : fark + " puan geride") + "</span>" : "") +
        (tarih ? "<span class='av4-ser-tarih'>Son kontrol: " + esc(tarih) + "</span>" : "") +
        "<span class='av4-ser-git' aria-hidden='true'>→</span></button>";
    }).join("");
    if (S.serImza !== h) { S.serImza = h; l.innerHTML = h; }
    b.hidden = false;
  }

  function guncelle() {
    if (!S.kuruldu) { return; }
    var m = modBul();
    if (m !== S.mod) { S.mod = m; $("av4").setAttribute("data-av4-mod", m); }
    kartDuzelt(); senaryoYaz(); sonYaz(); serYaz();
  }

  function gozle() {
    if (!window.MutationObserver) { return; }
    var kok = $("bg-kok"); if (kok) { new MutationObserver(function () { kartDuzelt(); var m = modBul(); if (m !== S.mod) { S.mod = m; $("av4").setAttribute("data-av4-mod", m); } }).observe(kok, { childList: true }); }
    var tk = $("a2-takvim"); if (tk) { new MutationObserver(function () { sonYaz(); }).observe(tk, { childList: true }); }
    var hs = $("hesap-sonuc"); if (hs) { new MutationObserver(function () { senaryoYaz(); }).observe(hs, { childList: true, characterData: true, subtree: true }); }
    var saat = $("rc-saat"); if (saat) { new MutationObserver(function () { S.tik = (S.tik + 1) % 10; if (S.tik === 0) { guncelle(); } }).observe(saat, { childList: true, characterData: true, subtree: true }); }
  }

  document.addEventListener("click", function (e) {
    if (!v4()) { return; }
    var ta = e.target.closest && e.target.closest("#av4-takvim-ac");
    if (ta) { var k = $("av4-takvim"), acik = k.getAttribute("data-kisa") !== "1"; k.setAttribute("data-kisa", acik ? "1" : "0"); ta.setAttribute("aria-expanded", acik ? "false" : "true");
      ta.innerHTML = (acik ? "GEÇMİŞ YARIŞLARI DA GÖSTER <span aria-hidden='true'>↓</span>" : "YALNIZ GELECEK YARIŞLAR <span aria-hidden='true'>↑</span>"); return; }
    var g = e.target.closest && e.target.closest("#av4 [data-av4-git]");
    if (g) { if (typeof window.sekmeAc === "function") { window.sekmeAc(g.getAttribute("data-av4-git")); window.scrollTo(0, 0); } return; }
    var s = e.target.closest && e.target.closest("#av4 [data-av4-seri]");
    if (s) {
      var kod = s.getAttribute("data-av4-seri");
      if (typeof window.sekmeAc === "function") { window.sekmeAc("diger"); }
      var bt = document.querySelector("#seri-dugmeleri button[data-kod='" + kod + "']"); if (bt) { bt.click(); }
      window.scrollTo(0, 0);
    }
  });
  ["f1-sekme", "f1-feed-guncel", "f1-sezon-durumu", "f1-yaris-sonuc"].forEach(function (ad) { document.addEventListener(ad, function () { if (v4()) { if (!S.kuruldu) { kur(); } guncelle(); } }); });
  function hazir() { if (v4()) { kur(); } }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", hazir); } else { hazir(); }
  window.AnaV4 = { kur: kur, guncelle: guncelle, modBul: modBul, _durum: S };
})();
