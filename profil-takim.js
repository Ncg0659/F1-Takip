/* A4.2 — Takım profili ekranı (DetayPanel içinde). Veri: ProfilVeri.takim (mevcut katmanlar). Hesap yok, ağ çağrısı yok (yükleme ProfilVeri.modelAl üzerinden, ortak).
   Profil = hızlı tanıma + KISA sezon özeti; A3'ün grafikleri tekrar edilmez. Yorum/sebep metni yoktur. Statik kayıt yoksa o bloklar gizlenir, profil yine açılır. */
(function () {
  "use strict";
  var PV = window.ProfilVeri, DP = window.DetayPanel, F = window.F1UI;
  if (!PV || !PV.takim || !DP || !F) { return; }
  var ACIK = [];

  function esc(x) { return F.esc(x); }
  function soz(k) { try { return window.ICERIK && ICERIK.sozluk && ICERIK.sozluk.terimler[k] || null; } catch (e) { return null; } }
  function bilgi(k) { var t = soz(k); return t ? "<button type='button' class='a2-i' data-terim='" + k + "' aria-haspopup='dialog' aria-label='" + esc(t.ad) + " nedir?' title='" + esc(t.ad) + " nedir?'></button>" : ""; }
  function dv(x) { return x == null || x === "" ? "—" : esc(x); }
  function ond(x) { return String(x.toFixed(1)).replace(".", ","); }
  function metrik(deger, ad, ipucu, ek) {
    return "<div class='pf-m'><span class='pf-mv'>" + deger + "</span><span class='pf-ml'>" + esc(ad) + (ipucu ? " " + bilgi(ipucu) : "") + "</span>" + (ek ? "<span class='pf-me'>" + esc(ek) + "</span>" : "") + "</div>";
  }
  function bolum(baslik, ic, ipucu) { return "<section class='dp-bolum pf-b'><h3 class='dp-bolum-baslik'>" + esc(baslik) + (ipucu ? " " + bilgi(ipucu) : "") + "</h3>" + ic + "</section>"; }
  function iskelet(m) { return "<p class='pf-yuk' aria-busy='true'>" + esc(m || "Analiz yükleniyor…") + "</p><div class='pf-isk' aria-hidden='true'><i></i><i></i><i></i></div>"; }
  function hataHtml() { return "<p class='pf-hata' role='status'>Analiz verisi şu anda yüklenemedi. <button type='button' class='pf-link' data-pf-tekrar>Tekrar dene</button></p>"; }
  function satir(ad, deger, ipucu) { return deger ? "<div><dt>" + esc(ad) + (ipucu ? " " + bilgi(ipucu) : "") + "</dt><dd>" + deger + "</dd></div>" : ""; }

  function liderlikHtml(l) {
    if (!l || !l.length) { return ""; }
    if (l.length === 1 && /^team principal$/i.test(l[0].rol)) { return satir("Takım Patronu", esc(l[0].ad), "team-principal"); }
    return satir("Takım Liderliği", "<ul class='pf-lider'>" + l.map(function (x) { return "<li>" + esc(x.ad) + " — " + esc(x.rol) + "</li>"; }).join("") + "</ul>", "team-principal");
  }
  function kimlikHtml(v) {
    var k = v.kimlik, b = v.bio;
    var pil = k.pilotlar.length ? "<span class='pf-pil'>" + k.pilotlar.map(function (p) {
      return "<button type='button' class='pf-pbtn' data-pf-pilot='" + esc(p.id) + "'>" + (p.kod ? "<span class='kod'>" + esc(p.kod) + "</span> " : "") + esc(p.ad) + "</button>";
    }).join("") + "</span>" : null;
    var uy = k.uyruk || k.uyrukUlke;
    return bolum("Temel bilgi", "<dl class='pf-kimlik pf-tk'>" +
      satir("Takım", F.takimRozeti(k.ad)) + satir("Takım uyruğu", uy ? esc(uy) : null) + satir("Merkez", k.merkez ? esc(k.merkez) + (k.merkezNot ? "<br><span class='pf-soluk'>" + esc(k.merkezNot) + "</span>" : "") : null) + liderlikHtml(k.liderlik) + satir("Güç Ünitesi", k.powerUnit ? esc(k.powerUnit) : null, "power-unit") +
      satir("Mevcut pilotlar", pil) + "</dl>");
  }
  function sezonHtml(v, durum) {
    var s = v.sezon, bek = !v.analizHazir;
    var yuk = durum.hata ? "—" : "<span class='pf-nokta' aria-label='yükleniyor'>…</span>";
    var poleEk = v.analizHazir && !v.poleHazir ? "Pole verisi henüz önbellekte yok" : null;
    var h = "<div class='pf-izgara pf-sezon'>" + metrik(dv(s.sira), "Constructor sırası", "takimlar-sampiyonasi") + metrik(dv(s.puan), "Puan") + metrik(dv(s.galibiyet), "Galibiyet") +
      metrik(bek ? yuk : dv(s.podyum), "Podyum", "podyum") + metrik(bek ? yuk : (v.poleHazir ? dv(s.pole) : "—"), "Pole", "pole", poleEk) + "</div>";
    var d = v.dogrulama;
    if (d && !d.uyumlu) {
      var ad = { sira: "sıra", puan: "puan", galibiyet: "galibiyet" };
      h += "<p class='pf-not pf-uyari' role='note'>Uygulamanın hesapladığı değer resmî tablodan farklı: " + d.farklar.map(function (x) { return esc(ad[x.alan]) + " " + esc(x.hesap) + " (resmî " + esc(x.resmi) + ")"; }).join("; ") + ". Resmî değer gösteriliyor; hiçbir değer kendiliğinden değiştirilmedi.</p>";
    } else if (!v.resmi && v.analizHazir) {
      h += "<p class='pf-not'>Resmî constructor tablosu henüz yüklenmedi; sıra, puan ve galibiyet uygulamanın hesabından alındı.</p>";
    }
    h += "<p class='pf-not'>Podyum ve pole takımın iki pilotunun toplamıdır; podyum yalnızca ana yarıştır.</p>";
    return bolum("Güncel sezon", h);
  }
  function katkiHtml(v, durum) {
    if (!v.analizHazir) { return bolum("Pilot katkısı", durum.hata ? hataHtml() : iskelet("Pilot katkısı yükleniyor…")); }
    if (!v.katki || !v.katki.length) { return bolum("Pilot katkısı", "<p class='pf-soluk'>Bu takım için henüz yarış sonucu yok.</p>"); }
    var top = v.katki.reduce(function (t, x) { return t + x.toplam; }, 0);
    var h = "<p class='pf-tp'>" + esc(v.kimlik.ad) + " — <b>" + esc(top) + " puan</b></p><div class='pf-katki'>";
    v.katki.forEach(function (x) {
      h += "<div class='pf-kp'><button type='button' class='pf-pbtn pf-kad' data-pf-pilot='" + esc(x.id) + "'>" + (x.kod ? "<span class='kod'>" + esc(x.kod) + "</span> " : "") + esc(x.ad) + "</button>" +
        "<span class='pf-kd'><b>" + esc(x.toplam) + "</b> toplam</span><span class='pf-kd'>" + esc(x.gp) + " GP</span><span class='pf-kd'>" + esc(x.sprint) + " Sprint</span>" +
        (!x.mevcut ? "<span class='pf-etiket'>Şu an bu takımda değil</span>" : "") + (x.digerTakim ? "<span class='pf-etiket'>Sezon içinde takım değiştirdi</span>" : "") + "</div>";
    });
    h += "</div>";
    if (v.katki.some(function (x) { return x.digerTakim; })) { h += "<p class='pf-not'>Takım değiştiren pilotun puanı, her turda hangi takım adına yarıştıysa o takıma yazılır; yukarıda yalnızca bu takım adına alınan puanlar vardır.</p>"; }
    return bolum("Pilot katkısı", h);
  }
  function sparkline(toplam) {
    if (!toplam || toplam.length < 2) { return ""; }
    var W = 120, Hh = 28, mx = Math.max.apply(null, toplam) || 1, n = toplam.length;
    var pts = toplam.map(function (t, i) { return (i * (W - 2) / (n - 1) + 1).toFixed(1) + "," + (Hh - 2 - (t / mx) * (Hh - 4)).toFixed(1); }).join(" ");
    return "<svg class='pf-spark' viewBox='0 0 " + W + " " + Hh + "' width='" + W + "' height='" + Hh + "' role='img' aria-label='Sezon boyu kümülatif takım puanı'><polyline points='" + pts + "' fill='none' stroke='currentColor' stroke-width='1.6' stroke-linejoin='round' stroke-linecap='round'/></svg>";
  }
  function gelisimHtml(v, durum) {
    if (!v.analizHazir) { return bolum("Puan gelişimi", durum.hata ? hataHtml() : iskelet("Puan gelişimi yükleniyor…")); }
    var g = v.gelisim; if (!g || !g.toplam.length) { return ""; }
    var a = g.sonTurlar[0], b = g.sonTurlar[g.sonTurlar.length - 1];
    var h = "<div class='pf-gel'><div class='pf-m'><span class='pf-mv'>" + (g.sonPuan >= 0 ? "+" : "") + esc(g.sonPuan) + " puan</span><span class='pf-ml'>Son " + esc(g.sonTurSayisi) + " tur</span><span class='pf-me'>Tur " + esc(a) + (a !== b ? "–" + esc(b) : "") + "</span></div>" +
      sparkline(g.toplam) + "</div><p class='pf-not'><button type='button' class='pf-link' data-pf-grafik>Grafikte incele ›</button></p>";
    return bolum("Puan gelişimi", h);
  }
  function pistHtml(v, durum) {
    if (!v.analizHazir) { return bolum("Pist türü", durum.hata ? hataHtml() : iskelet("Pist türü verisi yükleniyor…")); }
    if (!v.pist) { return ""; }
    var P = v.pist, e = P.enYuksek;
    var kisa = P.siralama.map(function (k) { var x = P.kat[k]; return esc(P.kategoriler[k].ad) + " " + (x && x.ortPuan != null ? ond(x.ortPuan) : "—"); }).join(" · ");
    var h = e ? "<p class='pf-pist-ust'>En yüksek puan ortalaması:<br><b>" + e.kategoriler.map(function (k) { return esc(P.kategoriler[k].ad); }).join(", ") + " — " + ond(e.deger) + " puan/yarış</b></p>"
              : "<p class='pf-soluk'>Karşılaştırmak için yeterli pist türü verisi yok.</p>";
    h += "<p class='pf-pist-alt'>" + kisa + "</p><p class='pf-not'>Uygulama içi pist sınıflandırması (resmî FIA kategorisi değildir). Yalnızca ana yarışlar; değerler yarış başına takım puanıdır.</p>";
    return bolum("Pist türü", h, "pist-turu");
  }
  function tarihHtml(v) {
    var b = v.bio; if (!b) { return ""; }
    var I = window.ICERIK_TAKIMLAR || {}, s = b.sampiyonluk, h = "<dl class='pf-bio'>";
    if (b.kurulus) { h += "<div><dt>Kuruluş / F1'e giriş</dt><dd>" + esc(b.kurulus) + "</dd></div>"; }
    if (b.oncekiIsim && b.oncekiIsim.length) { h += "<div><dt>Önceki adlar</dt><dd>" + b.oncekiIsim.map(esc).join(" → ") + "</dd></div>"; }
    if (s) { h += "<div><dt>Constructors' şampiyonluğu <span class='pf-soluk'>(" + esc(I.sampiyonlukKapsami || "2025 sonu itibarıyla") + ")</span></dt><dd>" + esc(s.constructors) + (s.constructors > 0 && s.yillar && s.yillar.length ? " (" + s.yillar.map(esc).join(", ") + ")" : "") + "</dd></div>"; }
    h += "</dl>";
    if (b.tarihce && b.tarihce.length) { h += "<ul class='pf-maddeler'>" + b.tarihce.slice(0, 5).map(function (m) { return "<li>" + esc(m) + "</li>"; }).join("") + "</ul>"; }
    h += "<p class='pf-kaynak'>Kaynak: " + esc(I.kaynak || "Formula 1") + ".<br>Doğrulama: " + esc(I.dogrulama || "") + "</p>";
    return bolum("Kısa tarihçe", h);
  }
  function bagl(v) { try { return window.BaglamUI ? BaglamUI.profil("takim", v.kimlik.ad) : ""; } catch (e) { return ""; } }   // aktif hafta sonu: resmi ceza / teknik güncelleme / kesin karar
  function icerik(v, durum) { return "<div class='pf-govde'>" + bagl(v) + kimlikHtml(v) + sezonHtml(v, durum) + katkiHtml(v, durum) + gelisimHtml(v, durum) + pistHtml(v, durum) + tarihHtml(v) + "</div>"; }

  function ciz(k) {
    var v = PV.takim(k.id); if (!v) { return; }
    k.node.innerHTML = icerik(v, k);
    try { if (window.Ogren && Ogren.tara) { Ogren.tara(k.node); } } catch (e) { /* ⓘ olmadan devam */ }
  }
  function analizBaslat(k) { k.hata = false; PV.modelAl().then(function () { ciz(k); }, function () { k.hata = true; ciz(k); }); }

  function grafigeGit() {
    DP.kapat();
    var b = document.getElementById("btn-grafik"); if (b) { b.click(); }
    setTimeout(function () { var el = document.getElementById("a3-takim"); if (el && el.scrollIntoView) { try { el.scrollIntoView({ block: "start" }); } catch (e) { /* önemsiz */ } } }, 600);
  }

  function ac(id, donus) {
    id = PV.takimId(id) || id;
    var v0 = PV.takim(id);
    if (!v0) { return false; }
    var k = { id: id, node: document.createElement("div"), hata: false };
    k.node.className = "pf pf-takim";
    k.node.addEventListener("click", function (e) {
      var t = e.target; if (!t || !t.closest) { return; }
      if (t.closest("[data-pf-tekrar]")) { analizBaslat(k); ciz(k); return; }
      var p = t.closest("[data-pf-pilot]"); if (p && window.ProfilPilot) { window.ProfilPilot.ac(p.getAttribute("data-pf-pilot"), p); return; }
      if (t.closest("[data-pf-grafik]")) { grafigeGit(); }
    });
    var pl = v0.kimlik.pilotlar.map(function (p) { return p.kod || p.ad; }).join(" · ");
    return DP.ac({ id: "takim-" + id, baslik: v0.kimlik.ad, alt: pl, donus: donus ? function () { return donus; } : null,
      yukle: async function () { ACIK = ACIK.filter(function (x) { return x.node.isConnected || x.id !== id; }); ACIK.push(k); ciz(k); analizBaslat(k); return k.node; } });
  }

  try { if (window.AnalizMerkezi && AnalizMerkezi.dinle) { AnalizMerkezi.dinle(function (neden) { if (neden === "pole") { PV.yenile(); ACIK.forEach(function (k) { if (k.node.isConnected) { ciz(k); } }); } }); } } catch (e) { /* önemsiz */ }
  window.ProfilTakim = { ac: ac, _acik: function () { return ACIK; } };
})();
