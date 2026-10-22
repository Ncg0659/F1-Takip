/* A3.4b — LASTİK STRATEJİSİ (yalnızca Yarış → Yarış analizi). Tek yarış bazlıdır; sezon geneli lastik analizi yoktur.
   Tembel: OpenF1 yalnızca kullanıcı bloğu açınca çağrılır (openf1-stint.js). Yarış sonuçları/pit verisi index.html'in mevcut yüklemesinden
   olayla gelir (f1-yaris-sonuc / f1-yaris-pit) — ek ağ çağrısı yok. Yalnızca ölçülebilir bilgi: stint sayısı, bileşik sırası, stint uzunluğu, başlangıç yaşı.
   Sebep/strateji yorumu yok. Yeni tercih (localStorage) anahtarı yok; "tümünü göster" yalnızca bellekte. */
(function () {
  "use strict";
  var LH = window.LastikHesap, LV = window.LastikVeri, F = window.F1UI;
  if (!LH || !LV) { return; }
  var ILK = 10;
  var D = { tur: null, liste: [], pit: null, sonuc: null, tumu: false, yukleniyor: false };

  function esc(x) { return F && F.esc ? F.esc(x) : String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }
  function sezonYili() { try { return typeof SEZON !== "undefined" ? SEZON : new Date().getFullYear(); } catch (e) { return new Date().getFullYear(); } }
  function takvimKaydi(tur) {
    var yil = sezonYili(), liste = null;
    try { var v = window.JolpicaIstemci.oku("takvim-" + yil); liste = v && v.veri && v.veri.RaceTable && v.veri.RaceTable.Races; } catch (e) { liste = null; }
    if (!liste || !liste.length) { try { liste = sezonYarislar; } catch (e2) { liste = null; } }
    return (liste || []).filter(function (y) { return Number(y.round) === Number(tur); })[0] || null;
  }
  function kok() { return document.getElementById("a34b-lastik"); }
  function govde() { var k = kok(); return k ? k.querySelector(".a34b-ic") : null; }

  function kur() {
    if (kok()) { return true; }
    var h2 = Array.prototype.filter.call(document.querySelectorAll("#sekme-yaris h2"), function (h) { return /Tur süreleri/.test(h.textContent); })[0];
    if (!h2) { return false; }
    var d = document.createElement("details");
    d.id = "a34b-lastik"; d.className = "a34b";
    d.innerHTML = "<summary>Lastik stratejisi</summary><div class='a34b-ic'></div>";
    h2.parentNode.insertBefore(d, h2);
    d.addEventListener("toggle", function () { if (d.open) { yukle(false); } });
    d.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("button[data-a34b]") : null;
      if (!b) { return; }
      if (b.getAttribute("data-a34b") === "tumu") { D.tumu = !D.tumu; ciz(); }
      else if (b.getAttribute("data-a34b") === "tekrar") { yukle(true); }
    });
    return true;
  }

  function mesaj(m) { return "<p class='a34b-mesaj'>" + esc(m) + "</p>"; }
  function rehber() { return "<p class='a34b-rehber'><button type='button' class='a2-baglanti a2-lastik' data-lastik=''>Lastik bileşikleri ne anlama geliyor? → Lastik rehberi</button></p>"; }

  function pitTurlari(driverId) {
    if (!D.pit || !D.pit.length) { return null; }
    return D.pit.filter(function (p) { return p.driverId === driverId; }).map(function (p) { return Number(p.lap); }).filter(function (x) { return isFinite(x); });
  }

  function stintHtml(s) {
    var aralik = s.bit != null ? "Tur " + s.bas + "–" + s.bit : "Tur " + s.bas + "–?";
    var uz = s.tur != null ? s.tur + " tur" : "uzunluk bilinmiyor";
    var yas = s.yas > 0 ? "<span class='a34b-yas'>başlangıç lastik yaşı: " + s.yas + " tur</span>" : "";
    return "<li class='a34b-st'><span class='a34b-bil a34b-" + s.b.k + "'>" + esc(s.b.ad) + "</span><span class='a34b-ar'>" + esc(aralik) + "</span><span class='a34b-uz'>" + esc(uz) + "</span>" + yas + "</li>";
  }
  function seritHtml(stintler) {
    if (!stintler.every(function (s) { return s.tur != null; })) { return ""; }
    var top = stintler.reduce(function (a, s) { return a + s.tur; }, 0);
    return "<div class='a34b-serit' aria-hidden='true'>" + stintler.map(function (s) {
      return "<i class='a34b-" + s.b.k + "' style='flex:" + s.tur + " 1 0' title='" + esc(s.b.ad + " · Tur " + s.bas + "–" + s.bit) + "'></i>";
    }).join("") + "</div>";
  }
  function pilotHtml(satir) {
    var st = satir.stintler, oz = LH.ozet(st);
    var baslik = satir.kod ? F.pilotHucresi(satir.kod, satir.ad) : "<span class='pilot'><span class='kod'>#" + esc(satir.no) + "</span>Eşleşmeyen pilot numarası</span>";
    var takim = satir.takim && F && F.takimRozeti ? F.takimRozeti(satir.takim) : "";
    var pit = pitTurlari(satir.id), pitNot = "", fark = "";
    if (pit) {
      var k = LH.pitKarsilastir(st, pit);
      pitNot = "<p class='a34b-pit'>Pit turları (Jolpica): " + (pit.length ? esc(pit.join(", ")) : "—") + "</p>";
      if (k.fark) { fark = "<p class='a34b-fark'>Veriler arasında fark var</p>"; }
    }
    return "<li class='a34b-p'><div class='a34b-ph'>" + baslik + takim + "</div>" +
      "<p class='a34b-oz'><b>" + oz.sayi + " stint</b> · " + esc(oz.sira.join(" → ")) + "</p>" + seritHtml(st) +
      "<ul class='a34b-sl'>" + st.map(stintHtml).join("") + "</ul>" + pitNot + fark + "</li>";
  }

  function satirlar() {
    var cozum = LH.stintleriCoz(D.sonuc.rows), kullan = {}, out = [];
    D.liste.forEach(function (r) {
      var no = String(r.number);
      if (cozum.pilot[no]) {
        kullan[no] = 1;
        out.push({ no: no, id: r.Driver.driverId, kod: r.Driver.code, ad: r.Driver.givenName + " " + r.Driver.familyName, takim: r.Constructor ? r.Constructor.name : "", stintler: cozum.pilot[no] });
      }
    });
    Object.keys(cozum.pilot).forEach(function (no) { if (!kullan[no]) { out.push({ no: no, id: null, kod: null, ad: "", takim: "", stintler: cozum.pilot[no] }); } });
    return out;
  }

  function ciz() {
    var g = govde(); if (!g) { return; }
    var s = D.sonuc;
    if (D.yukleniyor) { g.innerHTML = mesaj("Yükleniyor…"); return; }
    if (!s) { g.innerHTML = ""; return; }
    if (s.durum === "yayimlanmadi" || s.durum === "kisit") { g.innerHTML = mesaj("Veri henüz yayımlanmadı."); return; }
    if (s.durum !== "ok") {
      g.innerHTML = mesaj("Bu yarış için lastik stratejisi verisi henüz mevcut değil.") + (s.durum === "hata" ? "<p><button type='button' class='a34b-btn' data-a34b='tekrar'>Tekrar dene</button></p>" : "") + rehber();
      return;
    }
    var sat = satirlar(), gor = D.tumu ? sat : sat.slice(0, ILK);
    var eksik = D.liste.length ? D.liste.filter(function (r) { return !sat.some(function (x) { return x.no === String(r.number); }); }).length : 0;
    g.innerHTML = "<p class='a34b-bilgi'>Kaynak: OpenF1 stint kayıtları. Yalnızca ölçülebilir veri: stint sayısı, bileşik sırası, stint uzunluğu.</p>" +
      "<ul class='a34b-liste'>" + gor.map(pilotHtml).join("") + "</ul>" +
      (sat.length > ILK ? "<p><button type='button' class='a34b-btn' data-a34b='tumu' aria-expanded='" + D.tumu + "'>" + (D.tumu ? "İlk 10'u göster" : "Tüm pilotları göster (" + sat.length + ")") + "</button></p>" : "") +
      (eksik ? "<p class='a34b-alt'>" + eksik + " pilot için stint verisi yok.</p>" : "") + rehber();
  }

  async function yukle(zorla) {
    var k = kok(); if (!k || !k.open || !D.tur) { return; }
    if (D.sonuc && !zorla && D.sonuc.tur === D.tur && D.sonuc.durum === "ok") { ciz(); return; }
    var kayit = takvimKaydi(D.tur);
    if (!kayit) { D.sonuc = { durum: "bos", tur: D.tur }; ciz(); return; }
    var tur = D.tur; D.yukleniyor = true; ciz();
    var r;
    try { r = await LV.yukle(kayit); } catch (e) { r = { durum: "hata" }; }
    if (D.tur !== tur) { return; }
    D.yukleniyor = false; r.tur = tur; D.sonuc = r; ciz();
  }

  document.addEventListener("f1-yaris-sonuc", function (e) {
    if (!kur()) { return; }
    var d = e.detail || {};
    if (String(d.tur) !== String(D.tur)) { D.sonuc = null; D.pit = null; D.tumu = false; D.yukleniyor = false; }
    D.tur = d.tur; D.liste = d.liste || [];
    if (kok().open) { yukle(false); } else { ciz(); }
  });
  document.addEventListener("f1-yaris-pit", function (e) {
    var d = e.detail || {};
    if (String(d.tur) === String(D.tur)) { D.pit = d.liste || []; if (D.sonuc && D.sonuc.durum === "ok") { ciz(); } }
  });
})();
