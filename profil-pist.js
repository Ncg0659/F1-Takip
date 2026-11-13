/* A5.1 — Pist Profili (DetayPanel içinde). Hızlı tanıma rehberi; A3.4a analizinin kopyası değildir.
   Veri: ICERIK_PISTLER (statik, yalnız doğrulanmış alanlar) + PIST_SINIFLANDIRMA (A3.4a) + takvim (Jolpica, bellekte/önbellekte) + önbellekteki sezon sonuçları.
   AĞ: bu dosya HİÇ fetch yapmaz; yalnızca bellek ve JolpicaIstemci.oku (yerel önbellek) okur. Veri yoksa bölüm gizlenir ya da "Sonuç henüz yüklenmedi" der.
   Giriş noktaları: (A) Pilot & Pist → Sezonun Pistleri satırındaki "Profil" düğmesi, (B) Güncel Sezon kartında pist adı düğmesi, (C) A4.4 arama → AramaMerkezi.kaydet("pist").
   Hepsi data-pist="<circuitId>" taşıyan AYRI düğmelerdir; satır/kart/harita bağlantısı/Detay tıklaması değiştirilmez. */
(function () {
  "use strict";
  var PH = window.PistHesap, DP = window.DetayPanel, F = window.F1UI;
  if (!PH || !DP || !F) { return; }

  function esc(x) { return F.esc(x); }
  function bul(f, d) { try { return f(); } catch (e) { return d; } }

  // ---------- veri okuma (salt okunur, ağsız) ----------
  function sezon() { return bul(function () { return typeof SEZON !== "undefined" ? SEZON : new Date().getFullYear(); }, new Date().getFullYear()); }
  function takvim() {
    var a = bul(function () { return typeof sezonYarislar !== "undefined" ? sezonYarislar : []; }, []);
    if (a && a.length) { return a; }
    a = bul(function () { return window.YarisHaftasi && YarisHaftasi._durum && YarisHaftasi._durum.yarislar; }, null);
    if (a && a.length) { return a; }
    var c = bul(function () { return window.JolpicaIstemci && JolpicaIstemci.oku("takvim-" + sezon()); }, null);
    var v = c && (c.veri || c.v || c), r = v && v.RaceTable && v.RaceTable.Races;
    return r && r.length ? r : [];
  }
  function onbellek(anahtar) { var c = bul(function () { return JolpicaIstemci.oku(anahtar); }, null); return c && c.veri ? c.veri : null; }
  function sonuclar(tur) {
    var y = sezon(), p = "sezon-" + y + "-";
    return { s1: onbellek(p + "sonuc1"), s2: onbellek(p + "sonuc2"), s3: onbellek(p + "sonuc3"), sprint: onbellek(p + "sprint"), pole: onbellek(p + "pole"), poleTek: onbellek(p + "pole-r" + tur) };
  }
  function sinif(id) { return bul(function () { return PIST_SINIFLANDIRMA.harita()[id] || null; }, null); }
  function kategoriler() { return bul(function () { return PIST_SINIFLANDIRMA.KATEGORILER; }, null); }

  function modelAl(id) {
    var tk = takvim(), y = PH.yarisBul(tk, id);
    return PH.model({
      id: id, statik: bul(function () { return ICERIK_PISTLER.pistler[id] || null; }, null), sinif: sinif(id), kategoriler: kategoriler(),
      takvim: tk, sonuc: sonuclar(y ? Number(y.round) : 0), simdi: Date.now()
    });
  }

  // ---------- çizim ----------
  function tarihYaz(ms) {
    try { return new Date(ms).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: (window.HaftaVeri && HaftaVeri.ANA_TZ) || "Europe/Istanbul" }); } catch (e) { return ""; }
  }
  function dogrTarih(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? m[3] + "." + m[2] + "." + m[1] : ""; }
  function kod(k) { return k ? "<span class='pp-kod'>" + esc(k.k) + "</span> " + esc(k.a) : ""; }
  function bolum(baslik, ic) { return "<section class='dp-bolum pf-b pp-b'><h3 class='dp-bolum-baslik'>" + esc(baslik) + "</h3>" + ic + "</section>"; }
  function satir(ad, deger) { return deger ? "<div><dt>" + esc(ad) + "</dt><dd>" + deger + "</dd></div>" : ""; }
  function metrik(ad, deger) { return "<div class='pf-m'><span class='pf-mv'>" + esc(deger) + "</span><span class='pf-ml'>" + esc(ad) + "</span></div>"; }

  function sinifRozeti(m) {
    var s2 = m.sinif;
    return s2 && s2.ad ? "<span class='pp-sinifrozet pp-k-" + esc(s2.kategori) + "'>" + esc(s2.ad) + "</span>" : "";
  }
  // FINAL UI: Kimlik bölümü yerine görsel başlık bloğu (pist adı, şehir/ülke, sınıf rozeti); bilgi kaybı yok (Grand Prix adı dahil)
  function kimlikHtml(m) {
    var k = m.kimlik, yer = [k.sehir, k.ulke].filter(Boolean).join(", ");
    return "<header class='pp-baslik" + (m.sinif ? " pp-k-" + esc(m.sinif.kategori) : "") + "'><div class='pp-baslik-ic'><b class='pp-pist-ad'>" + esc(k.ad) + "</b>" +
      (yer ? "<span class='pp-yer'>" + F.ikon("pin", 13) + esc(yer) + "</span>" : "") +
      (k.gpAd ? "<span class='pp-gp' lang='en'>" + F.ikon("flag", 13) + esc(k.gpAd) + "</span>" : "") + "</div>" + sinifRozeti(m) + "</header>";
  }
  function teknikHtml(m) {
    if (!m.teknik.length && !m.rekor) { return ""; }
    var h = "<div class='pf-izgara pp-teknik'>" + m.teknik.map(function (t) { return metrik(t.ad, t.deger); }).join("") + "</div>";
    if (m.rekor) {
      var r = m.rekor;
      h += "<p class='pp-rekor'><span class='pf-ml'>Yarış tur rekoru (F1)</span><b>" + esc(r.sure) + "</b> — " + esc(r.pilot) + " (" + esc(r.yil) + ")" +
        (r.dogrulama ? " <span class='pf-soluk'>Doğrulama: " + esc(dogrTarih(r.dogrulama)) + "</span>" : "") + "</p>";
    }
    return bolum("Teknik bilgi", h);
  }
  function sezonHtml(m) {
    var s = m.sezon; if (!s) { return ""; }
    if (!s.takvimde) { return bolum("Bu sezon", "<p class='pf-soluk'>Bu pist bu sezonun takviminde yer almıyor.</p>"); }
    var h = "<dl class='pf-kimlik pp-kimlik'>" + satir("Tur", esc(s.tur)) + satir("Yarış tarihi", s.tarih != null ? esc(tarihYaz(s.tarih)) : null) +
      satir("Hafta sonu", s.sprintMi ? "Sprint hafta sonu" : "Standart hafta sonu") + "</dl>";
    if (s.durum === "biten") {
      var r = s.sonuc;
      if (r) {
        h += "<dl class='pf-kimlik pp-sonuc'>" + satir("Kazanan", kod(r.kazanan)) +
          satir("Podyum", [r.kazanan, r.p2, r.p3].filter(Boolean).map(function (x) { return "<span class='pp-kod'>" + esc(x.k) + "</span>"; }).join(" ")) +
          satir("Pole", kod(r.pole)) + satir("Sprint kazananı", kod(r.sprint)) + "</dl>";
      } else { h += "<p class='pf-soluk' role='status'>Sonuç henüz yüklenmedi.</p>"; }
    }
    return bolum("Bu sezon", h);
  }
  function sinifHtml(m) {
    var s = m.sinif; if (!s) { return ""; }
    var g = PH.kisaGerekce(s.gerekce);
    return bolum("Uygulama içi pist sınıfı", "<p class='pp-sinif'><b>" + esc(s.ad) + "</b></p>" + (g ? "<p class='pf-not'>" + esc(g) + "</p>" : "") +
      "<p class='pf-not'>Bu sınıflandırma resmî FIA kategorisi değildir.</p>");
  }
  function tarihceHtml(m) {
    if (!m.tarihce.length) { return ""; }
    var st = bul(function () { return ICERIK_PISTLER.pistler[m.id]; }, null);
    return bolum("Kısa tarihçe", "<ul class='pf-maddeler'>" + m.tarihce.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" +
      (st ? "<p class='pf-kaynak'>Kaynak: Formula1.com. Doğrulama: " + esc(dogrTarih(st.dogrulamaTarihi)) + "</p>" : ""));
  }
  function bagl(m) { try { return window.BaglamUI ? BaglamUI.profil("pist", m.id) : ""; } catch (e) { return ""; } }   // aktif hafta sonu bu pistteyse: hava/pist koşulu, pist değişikliği
  function icerik(m) { return "<div class='pf-govde pp-govde'>" + bagl(m) + kimlikHtml(m) + teknikHtml(m) + sezonHtml(m) + tarihceHtml(m) + sinifHtml(m) + "</div>"; }

  function ac(id, donus) {
    var m = id ? modelAl(id) : null;
    if (!m) { return false; }
    var node = document.createElement("div"); node.className = "pf pf-pist";
    var alt = [m.kimlik.sehir, m.kimlik.ulke].filter(Boolean).join(", ");
    return DP.ac({ id: "pist-" + id, baslik: m.kimlik.ad, alt: alt, donus: donus ? function () { return donus; } : null,
      yukle: async function () { var g = modelAl(id) || m; node.innerHTML = icerik(g); return node; } });
  }

  // ---------- MOBİL: satır içi pist profili (akordeon) ----------
  // ≤699 px'te Sezon kartındaki pist adı ve "Sezonun pistleri" kartları profili alttan açılan panel yerine İLGİLİ KARTIN HEMEN ALTINDA açar.
  // Aynı karta/düğmeye tekrar dokununca kapanır; aynı anda tek pist açık kalır. Masaüstü davranışı (DetayPanel) değişmez. Ağ yok.
  var A = null;   // { dugme, kutu, ev }
  function mobil() { return bul(function () { return window.matchMedia("(max-width: 699px)").matches; }, false); }
  function accKapat() {
    if (!A) { return; }
    try {
      if (A.kutu && A.kutu.parentNode) { A.kutu.parentNode.removeChild(A.kutu); }
      if (A.ev) { A.ev.classList.remove("pp-acik"); }
      if (A.dugme) { A.dugme.setAttribute("aria-expanded", "false"); }
    } catch (e) { /* önemsiz */ }
    A = null;
  }
  function accAc(b, id) {
    if (A && A.kutu && !A.kutu.isConnected) { A = null; }                 // liste yeniden çizildiyse eski kayıt geçersiz
    if (A && A.dugme === b) { accKapat(); return true; }
    var m = id ? modelAl(id) : null;
    if (!m) { return false; }
    accKapat();
    var ic = "<div class='pf pf-pist pp-acc-ic'><div class='pp-acc-ust'><b>PİST PROFİLİ</b><button type='button' class='pp-acc-kapat' data-pp-kapat aria-label='Pist profilini kapat'>Kapat ×</button></div>" + icerik(m) + "</div>";
    var tr = b.closest("tr"), kutu, ev;
    if (tr && tr.parentNode) {
      kutu = document.createElement("tr"); kutu.className = "pp-acc " + (tr.className.match(/pp-k-[a-z]+/) || [""])[0]; kutu.setAttribute("data-ui-pk", "1");
      kutu.innerHTML = "<td colspan='" + (tr.cells ? tr.cells.length : 1) + "'>" + ic + "</td>";
      tr.parentNode.insertBefore(kutu, tr.nextSibling); ev = tr;
    } else {
      ev = b.closest("p, li, div") || b;
      if (!ev.parentNode) { return false; }
      kutu = document.createElement("div"); kutu.className = "pp-acc"; kutu.innerHTML = ic;
      ev.parentNode.insertBefore(kutu, ev.nextSibling);
    }
    ev.classList.add("pp-acik"); b.setAttribute("aria-expanded", "true");
    A = { dugme: b, kutu: kutu, ev: ev };
    try { var r = kutu.getBoundingClientRect(); if (r.top > window.innerHeight * 0.6) { ev.scrollIntoView({ block: "start", behavior: "auto" }); } } catch (e) { /* önemsiz */ }
    return true;
  }
  document.addEventListener("f1-sekme", accKapat);                         // başka sekmeye geçilince açık profil kapanır
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && A) { var d = A.dugme; accKapat(); try { d.focus(); } catch (x) { /* önemsiz */ } } });

  // ---------- giriş noktaları ----------
  // (A) ve (B): data-pist düğmeleri. Yalnızca bu düğme; çevresindeki satır/kart/bağlantı tıklamaları değişmez.
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) { return; }
    var t = e.target, b = t && t.closest ? t.closest("button[data-pist]") : null;
    if (t && t.closest && t.closest("[data-pp-kapat]")) { var od = A && A.dugme; accKapat(); if (od) { try { od.focus(); } catch (x) { /* önemsiz */ } } return; }
    if (!b && mobil() && t && t.closest && !t.closest("a, button, select, input, .pp-acc")) {     // mobil: pist kartının kendisine dokunmak = Profil düğmesi
      var satir = t.closest("#pist-govde > tr"); b = satir ? satir.querySelector("button[data-pist]") : null;
    }
    if (!b) { return; }
    if (mobil() && b.closest("#pist-govde, #sekme-sezon") && accAc(b, b.getAttribute("data-pist"))) { return; }
    ac(b.getAttribute("data-pist"), b);
  });

  // (C) A4.4 arama: pist sonucu artık Pist Profili'ni açar; açılamazsa (statik/dinamik veri yok) eski davranışa düşer (false)
  function aramaKaydet() {
    if (!window.AramaMerkezi || !AramaMerkezi.kaydet) { return false; }
    AramaMerkezi.kaydet("pist", function (a) { return ac(a && a.circuitId, null) ? true : false; });
    return true;
  }
  if (!aramaKaydet()) { document.addEventListener("DOMContentLoaded", aramaKaydet); setTimeout(aramaKaydet, 500); }

  window.ProfilPist = { ac: ac, model: modelAl };
})();
