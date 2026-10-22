/* A4.1 — Pilot profili ekranı (DetayPanel içinde). Veri: ProfilVeri (mevcut katmanlar). Hesap yok, ağ çağrısı yok (yükleme ProfilVeri.modelAl üzerinden, ortak).
   Profil = hızlı tanıma + KISA sezon özeti; A3'ün derin analizi ve grafikleri tekrar edilmez. Yorum/sebep metni yoktur.
   Kimlik ve sezon (sıra/puan/galibiyet) anında gelir; A3 tabanlı bloklar hazır olunca aynı ekranda dolar (iskelet → veri), profil bekletilmez. */
(function () {
  "use strict";
  var PV = window.ProfilVeri, DP = window.DetayPanel, F = window.F1UI;
  if (!PV || !DP || !F) { return; }
  var ACIK = [];      // { id, node, hata }

  function esc(x) { return F.esc(x); }
  function soz(k) { try { return window.ICERIK && ICERIK.sozluk && ICERIK.sozluk.terimler[k] || null; } catch (e) { return null; } }
  function bilgi(k) { var t = soz(k); return t ? "<button type='button' class='a2-i' data-terim='" + k + "' aria-haspopup='dialog' aria-label='" + esc(t.ad) + " nedir?' title='" + esc(t.ad) + " nedir?'></button>" : ""; }
  function o1(x) { return x == null ? "—" : x.toFixed(1); }
  function net(n) { return n > 0 ? "+" + n : String(n); }
  function dv(x) { return x == null || x === "" ? "—" : esc(x); }

  function metrik(deger, ad, ipucu, ek, sinif) {
    return "<div class='pf-m" + (sinif ? " " + sinif : "") + "'><span class='pf-mv'>" + deger + "</span><span class='pf-ml'>" + esc(ad) + (ipucu ? " " + bilgi(ipucu) : "") + "</span>" + (ek ? "<span class='pf-me'>" + esc(ek) + "</span>" : "") + "</div>";
  }
  function bolum(baslik, ic, ipucu) { return "<section class='dp-bolum pf-b'><h3 class='dp-bolum-baslik'>" + esc(baslik) + (ipucu ? " " + bilgi(ipucu) : "") + "</h3>" + ic + "</section>"; }
  function iskelet(m) { return "<p class='pf-yuk' aria-busy='true'>" + esc(m || "Analiz yükleniyor…") + "</p><div class='pf-isk' aria-hidden='true'><i></i><i></i><i></i></div>"; }

  function kimlikHtml(v) {
    var k = v.kimlik;
    return bolum("Kimlik", "<dl class='pf-kimlik'>" +
      "<div><dt>Pilot kodu</dt><dd>" + (k.kod ? "<span class='kod'>" + esc(k.kod) + "</span>" : "—") + "</dd></div>" +
      "<div><dt>Numara</dt><dd>" + dv(k.numara) + "</dd></div>" +
      "<div><dt>Takım</dt><dd>" + (k.takim ? (PV.takimId && PV.takimId(k.takim) && window.ProfilTakim ? "<button type='button' class='pf-tbtn' data-pf-takim='" + esc(k.takim) + "' aria-label='" + esc(k.takim) + " takım profilini aç' title='Takım profilini aç'>" + F.takimRozeti(k.takim) + "<span class='pf-ok' aria-hidden='true'>›</span></button>" : F.takimRozeti(k.takim)) : "—") + "</dd></div>" +
      "<div><dt>Uyruk</dt><dd>" + dv(k.uyruk) + "</dd></div>" +
      "<div><dt>Yaş</dt><dd>" + dv(k.yas) + "</dd></div></dl>");
  }
  function sezonHtml(v, durum) {
    var s = v.sezon, bek = !v.analizHazir;
    var yuk = durum.hata ? "—" : "<span class='pf-nokta' aria-label='yükleniyor'>…</span>";
    var poleTxt = v.poleHazir ? esc(s.pole) : "—", poleEk = v.analizHazir && !v.poleHazir ? "Pole verisi henüz önbellekte yok" : null;
    return bolum("Güncel sezon", "<div class='pf-izgara pf-sezon'>" +
      metrik(dv(s.sira), "Şampiyona sırası") + metrik(dv(s.puan), "Puan") + metrik(dv(s.galibiyet), "Galibiyet") +
      metrik(bek ? yuk : dv(s.podyum), "Podyum", "podyum") + metrik(bek ? yuk : poleTxt, "Pole", "pole", poleEk) + "</div>");
  }
  function formKutu(f) {
    var s, y, u;
    if (f.durum === "SIN") { s = f.poz <= 3 ? "pod" : (f.poz <= 10 ? "nor" : "dus"); y = "P" + f.poz; u = "P" + f.poz + " · " + f.puan + " puan"; }
    else if (f.durum === "DNF") { s = "dnf"; y = "DNF"; u = "DNF"; } else if (f.durum === "DNS") { s = "dns"; y = "DNS"; u = "DNS"; }
    else if (f.durum === "DSQ") { s = "dsq"; y = "DSQ"; u = "DSQ"; } else if (f.durum === "YOK") { s = "yok"; y = "—"; u = "yarışta yer almadı"; } else { s = "yok"; y = "?"; u = "sınıflandırılamadı"; }
    return "<span class='pf-fi pf-f-" + s + "' title='Tur " + esc(f.tur) + ": " + esc(u) + "'>" + esc(y) + "</span>";
  }
  function perfHtml(v, durum) {
    if (!v.analizHazir) { return bolum("Performans", durum.hata ? hataHtml() : iskelet(), null); }
    var p = v.perf, o = p.ornek;
    var tablo = "<div class='pf-izgara pf-perf'>" + metrik(o1(o.ortStart), "Ort. Start", "ortalama-start") + metrik(o1(o.ortBitis), "Ort. Bitiş", "ortalama-bitis") +
      metrik(o.n ? net(o.net) : "—", "Net Pozisyon", "net-pozisyon") + metrik(esc(p.dnf), "DNF", "dnf") + metrik(esc(p.dns + p.dsq), "DNS / DSQ", "dns-dsq", p.dns + " / " + p.dsq) + "</div>" +
      "<p class='pf-not'>" + o.n + " / " + p.yarisSayisi + " yarış üzerinden (sınıflandırılmış, grid sırası olan yarışlar).</p>";
    var f = (p.form || []).map(formKutu).join("");
    var form = "<div class='pf-form'><span class='pf-ml'>Son 5 form " + bilgi("form") + "</span>" + (f ? "<span class='pf-fl'>" + f + "</span>" : "<span class='pf-soluk'>Henüz ana yarış yok</span>") + "</div>";
    return bolum("Performans", tablo + form);
  }
  function sprintHtml(v, durum) {
    if (!v.analizHazir) { return bolum("Sprint", durum.hata ? hataHtml() : iskelet("Sprint verisi yükleniyor…")); }
    if (!v.sprint) { return ""; }
    if (!v.sprint.mevcut) { return bolum("Sprint", "<p class='pf-soluk'>Bu sezon henüz sprint yarışı yapılmadı.</p>", "sprint"); }
    var d = v.sprint.d || { gp: { puan: 0 }, sprint: { puan: 0, galibiyet: 0, podyum: 0, basladi: 0 }, katki: null };
    return bolum("Sprint", "<div class='pf-izgara pf-sprint'>" + metrik(esc(d.gp.puan), "GP puanı") + metrik(esc(d.sprint.puan), "Sprint puanı", "sprint-puani") +
      metrik(d.katki == null ? "—" : esc(String(d.katki).replace(".", ",")) + "%", "Sprint katkısı", "sprint-katkisi", d.katki == null ? "Toplam puan 0" : null) +
      metrik(esc(d.sprint.galibiyet) + " / " + esc(d.sprint.podyum), "Sprint galibiyet / podyum", null, d.sprint.basladi + " sprint") + "</div>", "sprint");
  }
  function pistHtml(v, durum) {
    if (!v.analizHazir) { return bolum("Pist türü", durum.hata ? hataHtml() : iskelet("Pist türü verisi yükleniyor…")); }
    if (!v.pist) { return ""; }
    var P = v.pist, h = "<div class='pf-izgara pf-pist'>";
    P.siralama.forEach(function (k) {
      var x = P.kat[k], n = P.yarisSayisi[k];
      h += "<div class='pf-m'><span class='pf-ml pf-kat'>" + esc(P.kategoriler[k].ad) + "</span><span class='pf-mv'>" + (x && x.ortPuan != null ? esc(String(x.ortPuan.toFixed(1)).replace(".", ",")) : "—") + "</span>" +
           "<span class='pf-me'>" + (x ? x.yaris + " yarış · ort. puan" : (n ? "Yarışmadı" : "Takvimde yok")) + "</span>" + (x && x.kucuk ? "<span class='pf-kucuk' title='3 yarıştan az'>Küçük örneklem</span>" : "") + "</div>";
    });
    h += "</div>";
    if (P.enYuksek) {
      h += "<p class='pf-not'>En yüksek puan ortalaması: <b>" + P.enYuksek.kategoriler.map(function (k) { return esc(P.kategoriler[k].ad); }).join(", ") + "</b> (" + esc(String(P.enYuksek.deger.toFixed(1)).replace(".", ",")) + ")</p>";
    }
    h += "<p class='pf-not'>Uygulama içi pist sınıflandırması (resmî FIA kategorisi değildir). Yalnızca ana yarışlar.</p>";
    return bolum("Pist türü", h, "pist-turu");
  }
  function bioHtml(v) {
    var b = v.bio; if (!b) { return ""; }
    var I = window.ICERIK_PILOTLAR || {}, s = v.sampiyonluk, h = "<dl class='pf-bio'>";
    h += "<div><dt>F1'e giriş</dt><dd>" + dv(b.giris) + "</dd></div>";
    if (b.takimlar && b.takimlar.length) { h += "<div><dt>Takımlar <span class='pf-soluk'>(" + esc(I.takimKapsami || "2025 sonuna kadar") + ")</span></dt><dd>" + b.takimlar.map(esc).join(" → ") + "</dd></div>"; }
    if (s) { h += "<div><dt>Dünya şampiyonluğu</dt><dd>" + esc(s.sayi) + (s.sayi > 0 && s.yillar && s.yillar.length ? " (" + s.yillar.map(esc).join(", ") + ")" : "") + "</dd></div>"; }
    h += "</dl>";
    if (b.maddeler && b.maddeler.length) { h += "<ul class='pf-maddeler'>" + b.maddeler.map(function (m) { return "<li>" + esc(m) + "</li>"; }).join("") + "</ul>"; }
    h += "<p class='pf-kaynak'>Kaynak: " + esc(I.kaynak || "Formula 1") + (s && s.kaynak === "uygulama" ? "; şampiyonluk sayısı: Şampiyonlar sekmesi verisi" : "") + ".<br>Doğrulama: " + esc(I.dogrulama || "") + "</p>";
    return bolum("Kısa biyografi", h);
  }
  function hataHtml() { return "<p class='pf-hata' role='status'>Analiz verisi şu anda yüklenemedi. <button type='button' class='pf-link' data-pf-tekrar>Tekrar dene</button></p>"; }

  // Bağlamsal bilgi (baglam-ui.js): yalnızca aktif hafta sonunda bu pilotu doğrudan ilgilendiren kritik bilgi (grid/pit lane/resmi ceza); yoksa boş
  function bagl(v) { try { return window.BaglamUI && v.kimlik.kod ? BaglamUI.profil("pilot", v.kimlik.kod) : ""; } catch (e) { return ""; } }
  function icerik(v, durum) {
    return "<div class='pf-govde'>" + bagl(v) + kimlikHtml(v) + sezonHtml(v, durum) + perfHtml(v, durum) + sprintHtml(v, durum) + pistHtml(v, durum) + bioHtml(v) + "</div>";
  }

  function ciz(k) {
    var v = PV.pilot(k.id); if (!v) { return; }
    k.node.innerHTML = icerik(v, k);
    try { if (window.Ogren && Ogren.tara) { Ogren.tara(k.node); } } catch (e) { /* ⓘ olmadan devam */ }
  }
  function analizBaslat(k) {
    k.hata = false;
    PV.modelAl().then(function () { ciz(k); }, function () { k.hata = true; ciz(k); });
  }

  function ac(id, donus) {
    var v0 = PV.pilot(id);
    if (!v0) { return false; }
    var k = { id: id, node: document.createElement("div"), hata: false };
    k.node.className = "pf";
    k.node.addEventListener("click", function (e) { var b = e.target.closest ? e.target.closest("[data-pf-tekrar]") : null; if (b) { analizBaslat(k); ciz(k); return; }
      var tb = e.target.closest ? e.target.closest("[data-pf-takim]") : null; if (tb && window.ProfilTakim) { window.ProfilTakim.ac(tb.getAttribute("data-pf-takim"), tb); } });
    var alt = [v0.kimlik.kod, v0.kimlik.numara ? "#" + v0.kimlik.numara : null, v0.kimlik.takim].filter(Boolean).join(" · ");
    var ok = DP.ac({ id: "pilot-" + id, baslik: v0.kimlik.ad, alt: alt, donus: donus ? function () { return donus; } : null,
      yukle: async function () { ACIK = ACIK.filter(function (x) { return x.node.isConnected || x.id !== id; }); ACIK.push(k); ciz(k); analizBaslat(k); return k.node; } });
    return ok;
  }

  // pole sonradan önbelleğe düşerse açık profil yenilenir
  try { if (window.AnalizMerkezi && AnalizMerkezi.dinle) { AnalizMerkezi.dinle(function (neden) { if (neden === "pole") { PV.yenile(); ACIK.forEach(function (k) { if (k.node.isConnected) { ciz(k); } }); } }); } } catch (e) { /* önemsiz */ }

  window.ProfilPilot = { ac: ac, _acik: function () { return ACIK; } };
})();
