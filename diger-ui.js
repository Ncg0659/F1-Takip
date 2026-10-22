/* FINAL UI — Diğer Seriler (F2/F3/Formula E) sunum katmanı. Veri kaynağı değişmez (diger-seriler.js); HİÇ fetch/zamanlayıcı yok.
   • Seri başlığı: ad, sezon durumu rozeti (metinden), lider, ilk 3, kalan turlar özeti (metinde varsa)
   • Takım hücrelerine rozet: renk YALNIZCA gerçek takım kimliği güvenle bilinen F1 takımlarında (F1UI.takimRozeti); diğerleri nötr — rastgele renk yok
   • Pilot/takım listesi ilk 3 + "Tümünü göster (N)" (ui-final.js daraltKur). Mevcut #seri-bilgi (durum/güncelleme) ve kaynak notu olduğu gibi kalır. */
(function () {
  "use strict";
  var F = window.F1UI;
  function bul(f, d) { try { return f(); } catch (e) { return d; } }
  function esc(x) { return F && F.esc ? F.esc(x) : String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }
  function ik(a, b) { return F && F.ikon ? F.ikon(a, b) : ""; }

  function seri() {
    var k = bul(function () { return seciliSeri; }, null), L = window.DIGER_SERILER || [];
    return L.filter(function (x) { return x.kod === k; })[0] || null;
  }
  function durumRozeti(d) {
    if (/^\s*Sezon bitti/i.test(d)) { return { ad: "SEZON BİTTİ", s: "bitti" }; }
    if (/^\s*Sezon sürüyor/i.test(d)) { return { ad: "SEZON DEVAM EDİYOR", s: "surer" }; }
    return null;
  }
  function kalanTurlar(d) { var m = /Takvimde kalan turlar:[^.]*\./i.exec(d); return m ? m[0].replace(/^Takvimde /i, "").replace(/\.$/, "") : ""; }
  // Statik takım renk tablosu (çalışma zamanında ağ yok). Renk yalnızca kaynağı doğrulanmış takımlar için; kaynak yorumda.
  // Not: kaynaklar renk AİLESİNİ doğrular (ör. "sarı-siyah"); tam hex tonu bu ailede seçilmiş yaklaşık değerdir.
  var TAKIM_RENKLERI = {
    "Invicta Racing":   { c: "#f2b800", e: /invicta/i },                // invictaracing.com: marka/yarış rengi sarı + siyah
    "Campos Racing":    { c: "#cb200f", e: /campos/i },                 // teamcolorcodes.com: kırmızı #CB200F, altın, siyah, gri
    "MP Motorsport":    { c: "#ff6a13", e: /^mp motorsport/i },         // gpfans.com (MP livery): turuncu
    "Prema Racing":     { c: "#d40d12", e: /prema/i },                  // diariomotor.com (Prema livery): kırmızı
    "DAMS Lucas Oil":   { c: "#00a3e0", e: /dams/i },                   // damslucasoil.com resmî logo: cyan mavi
    "Porsche":          { c: "#7a4fb5", e: /porsche/i },                // fiaformulae.com S11 liveries: "Purple Sky Metallic"
    "Andretti":         { c: "#c8102e", e: /andretti/i },               // fiaformulae.com: kırmızı-beyaz-mavi
    "Jaguar":           { c: "#b8902f", e: /jaguar/i },                 // fiaformulae.com: siyah-beyaz-altın
    "Nissan e.Dams":    { c: "#e0558a", e: /nissan/i },                 // fiaformulae.com: "cherry blossom" (kiraz çiçeği pembesi)
    "Mahindra":         { c: "#d71920", e: /mahindra/i }                // fiaformulae.com: metalik kırmızı, gümüş, karbon siyahı
  };
  // Doğrulanamayanlar (ART, Hitech, Trident, Rodin, Van Amersfoort, AIX) tabloda yok → nötr rozet.
  function renkBul(ad) { for (var k in TAKIM_RENKLERI) { if (TAKIM_RENKLERI[k].e.test(ad)) { return TAKIM_RENKLERI[k].c; } } return null; }
  function rozetTakim(ad) {
    var c = renkBul(String(ad));
    if (c) { return "<span class='dt-rozet' title='" + esc(ad) + "' style='--dc:" + c + "'>" + esc(ad) + "</span>"; }
    return F && F.takimRozeti ? F.takimRozeti(ad) : esc(ad);
  }

  function ozetCiz() {
    var s = seri(), kap = document.getElementById("ui-seri-ozet");
    var bilgi = document.getElementById("seri-bilgi"); if (!s || !bilgi) { return; }
    if (!kap) { kap = document.createElement("section"); kap.id = "ui-seri-ozet"; kap.className = "ui-so"; bilgi.parentNode.insertBefore(kap, bilgi); }
    var r = durumRozeti(s.durum || ""), kalan = kalanTurlar(s.durum || "");
    var ilk3 = (s.pilotlar || []).slice(0, 3).map(function (p, i) {
      return "<li class='ui-so-p ui-so-p" + (i + 1) + "'><b class='ui-so-sira'>" + esc(p[0]) + "</b><span class='ui-so-ad'>" + esc(p[1]) + "<small>" + rozetTakim(p[2]) + "</small></span><span class='ui-so-puan'>" + esc(p[3]) + " <i>puan</i></span></li>";
    }).join("");
    kap.innerHTML = "<header class='ui-so-bas'><h2 class='ui-so-baslik'>" + ik("trophy", 18) + esc(s.ad) + "</h2>" + (r ? "<span class='ui-rozet ui-rozet-" + r.s + "'>" + (r.s === "surer" ? "<i class='ui-nokta' aria-hidden='true'></i>" : ik("check", 11)) + r.ad + "</span>" : "") + "</header>" +
      "<ol class='ui-so-liste' aria-label='İlk 3 pilot'>" + ilk3 + "</ol>" +
      (kalan ? "<p class='ui-so-kalan'>" + ik("flag", 14) + "<span>" + esc(kalan) + "</span></p>" : "") +
      "<p class='ui-so-tarih'>" + ik("calendar", 13) + "Son güncelleme: " + esc(s.guncelleme || "—") + "</p>";
  }

  function takimRozetle(tbId, sutun) {
    var tb = document.getElementById(tbId); if (!tb) { return; }
    Array.prototype.forEach.call(tb.querySelectorAll("tr"), function (tr) {
      var td = tr.children[sutun]; if (!td || td.getAttribute("data-ui-r")) { return; }
      td.setAttribute("data-ui-r", "1"); td.innerHTML = rozetTakim(td.textContent.trim());
    });
  }
  function duzenle() { ozetCiz(); takimRozetle("seri-pilot-govde", 2); takimRozetle("seri-takim-govde", 1); }

  function baslat() {
    var pb = document.getElementById("seri-pilot-govde"); if (!pb) { return; }
    if (window.UIFinal && UIFinal.daraltKur) {
      UIFinal.daraltKur({ govde: "seri-pilot-govde", ilk: 3, cok: "Tüm pilotları göster", az: "Listeyi daralt" });
      UIFinal.daraltKur({ govde: "seri-takim-govde", ilk: 3, cok: "Tüm takımları göster", az: "Listeyi daralt" });
    }
    if (window.MutationObserver) { new MutationObserver(duzenle).observe(pb, { childList: true }); }
    duzenle();
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", baslat); } else { baslat(); }
})();
