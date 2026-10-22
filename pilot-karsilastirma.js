/* Pilot & Pist → Pilot Karşılaştırma geliştirmesi (SEZON PERFORMANSI + SON 5 FORM).
   Mevcut temel tablo (#kiyas-govde) ve iki açılır liste (#pilot-a, #pilot-b) AYNEN kalır; bu dosya index.html'deki hiçbir fonksiyonu değiştirmez.
   Çalışma şekli: tablo her yeniden yazıldığında (kiyasla) MutationObserver ile haberdar olur, seçili iki pilotu okur ve altına iki blok ekler.
   VERİ (yeni data layer YOK): A3.1 SezonAnaliz modeli (ortak önbellek) + A3.2 hesabı (SezonHesapA32) + pole YALNIZCA mevcut önbellekten (ağ çağrısı yok)
   + mevcut standings (sezonPilotlar; yalnızca doğrulama ve takım rozeti). Önbellek sıcaksa (Grafik / Güncel Sezon açılmışsa) yeni ağ çağrısı 0'dır;
   soğuksa aynı ortak uçlar bir kez çağrılır ve sonuç diğer sekmelerle paylaşılır. Yeni uç, yeni istemci, yeni tercih anahtarı YOKTUR.
   Hesap kuralları A3.2 ile BİREBİR aynıdır (yeni/farklı hesap yazılmadı). */
(function () {
  "use strict";
  var F = window.F1UI, H = window.SezonHesap, HA = window.SezonHesapA32, SA = window.SezonAnaliz;
  if (!F || !H || !HA || !SA) { return; }   // eksik parça: mevcut karşılaştırma aynen çalışır
  var sec, tb, pa, pb;

  var D = { durum: "bos", model: null, g: null, h: null, wpp: null, poleKod: null, pole: null, sonuc: null, yukleniyor: false };
  var kap = null, planli = false;

  function esc(x) { return F.esc ? F.esc(x) : String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }
  function sezonYili() { try { return typeof SEZON !== "undefined" ? SEZON : new Date().getFullYear(); } catch (e) { return new Date().getFullYear(); } }
  function standings() { try { return typeof sezonPilotlar !== "undefined" ? sezonPilotlar : []; } catch (e) { return []; } }
  function favori() { try { return localStorage.getItem("f1-favori") || ""; } catch (e) { return ""; } }
  function soz(k) { try { return window.ICERIK && ICERIK.sozluk && ICERIK.sozluk.terimler[k] || null; } catch (e) { return null; } }
  function bilgi(k) { var t = soz(k); return t ? "<button type='button' class='a2-i' data-terim='" + k + "' aria-haspopup='dialog' aria-label='" + esc(t.ad) + " nedir?' title='" + esc(t.ad) + " nedir?'></button>" : ""; }

  // ---- iki pilotun okunması (mevcut açılır listeler: değer = standings dizisindeki sıra) ----
  function secili() {
    var s = standings(), a = s[Number(pa.value)], b = s[Number(pb.value)];
    return a && b ? [a, b] : null;
  }
  function id(k) { return k.Driver.driverId; }
  function takimAdi(k) { return k.Constructors && k.Constructors.length ? k.Constructors[k.Constructors.length - 1].name : "-"; }

  // Aynı pilot iki tarafta seçilemesin: diğer listede seçili pilotun seçeneği devre dışı
  function esitle() {
    [[pa, pb], [pb, pa]].forEach(function (c) {
      Array.prototype.forEach.call(c[0].options, function (o) { o.disabled = (o.value === c[1].value); });
    });
  }

  // ---- hesap ----
  function hesapla() {
    D.g = H.pilotGelisimi(D.model);
    D.h = HA.hesapla(D.model, 5);
    D.wpp = H.galibiyetPodyumPole(D.model, D.poleKod);
  }
  function bilgiP(pid) {
    return D.h.pilot[pid] || { id: pid, yarisSayisi: D.h.yarisSayisi, dnf: 0, dns: 0, dsq: 0, diger: 0, haric: { grid0: 0, yok: D.h.yarisSayisi },
                               ornek: { n: 0, ortStart: null, ortBitis: null, net: 0 }, form: [], form5Puan: 0 };
  }
  function w(pid) { return D.wpp[pid] || { galibiyet: 0, podyum: 0, pole: 0 }; }

  // ---- biçim ----
  function net(n) { return n > 0 ? "+" + n : String(n); }
  function o1(x) { return x == null ? "—" : x.toFixed(1); }
  function kod(k) { return k.Driver.code || (k.Driver.familyName || "").slice(0, 3).toUpperCase(); }

  // Metrik satırı: a, b sayı ya da null; yon "yuksek" | "dusuk" (hangisi daha iyi); fmt değer biçimi; alt [altA, altB] örneklem satırı; bar: çubuk göster
  function satir(ad, ipucu, a, b, o) {
    o = o || {};
    var fmt = o.fmt || function (x) { return String(x); };
    var iyi = null;
    if (a != null && b != null && a !== b) { iyi = (o.yon === "dusuk" ? a < b : a > b) ? 0 : 1; }
    var maks = 0; [a, b].forEach(function (x) { if (x != null && Math.abs(x) > maks) { maks = Math.abs(x); } });
    function hucre(v, i, alt) {
      var e = o.ek && o.ek[i];
      var bar = "";
      if (o.bar && v != null && maks > 0) { bar = "<span class='pk-bar' aria-hidden='true'><i class='" + (v < 0 ? "pk-eksi" : "pk-arti") + "' style='width:" + Math.round(Math.abs(v) / maks * 100) + "%'></i></span>"; }
      return "<div class='pk-h pk-h" + (i ? "b" : "a") + (iyi === i ? " pk-iyi" : "") + "' role='cell'>" +
        "<span class='pk-ik'>" + esc(o.kodlar[i]) + "</span><span class='pk-v'>" + (v == null ? "—" : esc(fmt(v))) + (iyi === i ? "<span class='pk-gizli'> (daha iyi)</span>" : "") + "</span>" +
        (alt && alt[i] ? "<span class='pk-ornek'" + (o.baslik && o.baslik[i] ? " title='" + esc(o.baslik[i]) + "'" : "") + ">" + esc(alt[i]) + "</span>" : "") +
        (e ? "<span class='pk-ornek'>" + esc(e) + "</span>" : "") + bar + "</div>";
    }
    return "<div class='pk-r' role='row'>" + hucre(a, 0, o.alt) + "<div class='pk-m' role='rowheader'>" + esc(ad) + (ipucu ? " " + bilgi(ipucu) : "") + "</div>" + hucre(b, 1, o.alt) + "</div>";
  }

  // ---- 1) SEZON PERFORMANSI ----
  function performans(A, B) {
    var ia = id(A), ib = id(B), a = bilgiP(ia), b = bilgiP(ib), wa = w(ia), wb = w(ib), kd = [kod(A), kod(B)];
    var poleHazir = D.pole === true;
    var puanA = D.g.seri[ia] ? H.sonPuan(D.g, ia) : 0, puanB = D.g.seri[ib] ? H.sonPuan(D.g, ib) : 0;
    var ort = [a.ornek.n + " / " + a.yarisSayisi + " yarış üzerinden", b.ornek.n + " / " + b.yarisSayisi + " yarış üzerinden"];
    var netAlt = [a.ornek.n + " sınıflandırılmış yarış", b.ornek.n + " sınıflandırılmış yarış"];
    function hariç(x) {
      var p = [];
      if (x.dnf) { p.push(x.dnf + " DNF"); } if (x.dns) { p.push(x.dns + " DNS"); } if (x.dsq) { p.push(x.dsq + " DSQ"); } if (x.diger) { p.push(x.diger + " diğer sonuç"); }
      if (x.haric.grid0) { p.push(x.haric.grid0 + " pit çıkışı (grid 0)"); } if (x.haric.yok) { p.push(x.haric.yok + " yarışmadı"); }
      return p.length ? "Örneklem dışı: " + p.join(", ") : "Tüm yarışlar örneklemde";
    }
    var bs = [hariç(a), hariç(b)];
    var o = { kodlar: kd };
    var h = "<div class='pk-tablo' role='table' aria-label='Sezon performansı karşılaştırması'>" +
      "<div class='pk-r pk-bas' role='row'><div class='pk-h pk-ha' role='columnheader'>" + baslikHucre(A) + "</div><div class='pk-m' role='columnheader'></div><div class='pk-h pk-hb' role='columnheader'>" + baslikHucre(B) + "</div></div>";
    h += satir("Puan", "", puanA, puanB, { kodlar: kd, yon: "yuksek", bar: true });
    h += satir("Galibiyet", "", wa.galibiyet, wb.galibiyet, { kodlar: kd, yon: "yuksek", bar: true });
    h += satir("Podyum", "podyum", wa.podyum, wb.podyum, { kodlar: kd, yon: "yuksek", bar: true });
    h += poleHazir ? satir("Pole", "pole", wa.pole, wb.pole, { kodlar: kd, yon: "yuksek", bar: true })
                   : satir("Pole", "pole", null, null, { kodlar: kd, alt: ["Pole verisi henüz önbellekte yok", "Pole verisi henüz önbellekte yok"] });
    h += satir("Ort. Start", "ortalama-start", a.ornek.ortStart, b.ornek.ortStart, { kodlar: kd, yon: "dusuk", fmt: o1, alt: ort, baslik: bs });
    h += satir("Ort. Bitiş", "ortalama-bitis", a.ornek.ortBitis, b.ornek.ortBitis, { kodlar: kd, yon: "dusuk", fmt: o1, alt: ort, baslik: bs });
    h += satir("Net Pozisyon", "net-pozisyon", a.ornek.n ? a.ornek.net : null, b.ornek.n ? b.ornek.net : null, { kodlar: kd, yon: "yuksek", fmt: net, alt: netAlt, baslik: bs, bar: true });
    h += satir("DNF", "dnf", a.dnf, b.dnf, { kodlar: kd, yon: "dusuk" });
    h += satir("DNS", "dns-dsq", a.dns, b.dns, { kodlar: kd, yon: "dusuk" });
    h += satir("DSQ", "dns-dsq", a.dsq, b.dsq, { kodlar: kd, yon: "dusuk" });
    return h + "</div>";
  }
  function baslikHucre(k) {
    var fav = favori() && favori() === id(k);
    return "<span class='pk-bk'>" + esc(kod(k)) + "</span><span class='pk-bad'>" + (fav ? "<span class='pk-fav' title='Favori pilot' aria-label='Favori pilot'>★</span> " : "") + esc(k.Driver.familyName) + "</span>" + F.takimRozeti(takimAdi(k));
  }
  function uyuşmazlik(A, B) {
    var f = [];
    [A, B].forEach(function (k) { var hesap = D.g.seri[id(k)] ? H.sonPuan(D.g, id(k)) : 0; if (Math.abs(hesap - Number(k.points)) > 1e-9) { f.push(k.Driver.familyName + ": hesaplanan " + hesap + ", resmî " + k.points); } });
    return f.length ? "<p class='pk-uyari' role='status'>" + (window.Ogren && Ogren.isle ? Ogren.isle("Hesaplanan toplam ile resmi sıralama arasında fark var [[puan-dogrulama]]") : "Hesaplanan toplam ile resmi sıralama arasında fark var") + " <span class='pk-soluk'>(" + esc(f.join("; ")) + ")</span></p>" : "";
  }

  // ---- 2) SON 5 FORM (kompakt) ----
  function formKutu(f, model) {
    var ad = model.turlar[f.tur] ? model.turlar[f.tur].ad : "", bas = "Tur " + f.tur + (ad ? " · " + ad : "") + ": ", s, y, u;
    if (f.durum === "SIN") { s = f.poz <= 3 ? "pod" : (f.poz <= 10 ? "nor" : "dus"); y = "P" + f.poz; u = "P" + f.poz + " · " + f.puan + " puan"; }
    else if (f.durum === "DNF") { s = "dnf"; y = "DNF"; u = "DNF (yarışı bitiremedi)"; }
    else if (f.durum === "DNS") { s = "dns"; y = "DNS"; u = "DNS (yarışa başlamadı)"; }
    else if (f.durum === "DSQ") { s = "dsq"; y = "DSQ"; u = "DSQ (diskalifiye)"; }
    else if (f.durum === "YOK") { s = "yok"; y = "—"; u = "yarışta yer almadı"; }
    else { s = "yok"; y = "?"; u = "sonuç sınıflandırılamadı"; }
    return { html: "<span class='pk-fi pk-f-" + s + "' title='" + esc(bas + u) + "'>" + esc(y) + "</span>", metin: "Tur " + f.tur + " " + u };
  }
  function formSatiri(k) {
    var a = bilgiP(id(k)), ks = a.form.map(function (f) { return formKutu(f, D.model); });
    return "<div class='pk-fs' role='listitem'><span class='pk-fk'>" + esc(kod(k)) + "</span>" +
      (ks.length ? "<span class='pk-fl' aria-label='" + esc(k.Driver.familyName + ", son " + ks.length + " ana yarış, eskiden yeniye: " + ks.map(function (x) { return x.metin; }).join("; ")) + "'>" +
        ks.map(function (x) { return x.html; }).join("<span class='pk-ay' aria-hidden='true'> · </span>") + "</span>" : "<span class='pk-soluk'>Henüz ana yarış yok</span>") + "</div>";
  }
  function formBlok(A, B) {
    var t = D.h.formTurlari;
    return "<h2>Son 5 form " + bilgi("form") + "</h2>" +
      "<p class='not'>Son 5 ana yarıştaki bitiş sırası" + (t.length ? " (T" + t[0] + " → T" + t[t.length - 1] + ", eskiden yeniye)" : "") + ". Sonuçlar olduğu gibi gösterilir; sebep yorumu yapılmaz.</p>" +
      "<div class='pk-form' role='list'>" + formSatiri(A) + formSatiri(B) + "</div>";
  }

  // ---- çizim ----
  function ciz() {
    planli = false;
    if (D.durum === "hazir" && D.pole !== true) { poleGuncelle(); }
    if (!kap) { return; }
    var s = secili();
    esitle();
    if (!s) { kap.innerHTML = ""; return; }
    var h = "";
    if (D.durum === "hazir" && D.h) {
      h = "<h2>Sezon performansı</h2>" +
        "<p class='not'>Puan, ana yarış ve sprint puanlarının toplamıdır; galibiyet ve podyum yalnızca ana yarıştan sayılır. Ortalama Start, Ortalama Bitiş ve Net Pozisyon yalnızca sınıflandırılmış, grid sırası olan ana yarışlardan hesaplanır; örneklem her değerin altında yazar. Daha iyi değer hafifçe vurgulanır.</p>" +
        uyuşmazlik(s[0], s[1]) + performans(s[0], s[1]) + formBlok(s[0], s[1]);
    }
    else if (D.durum === "hata") {
      h = "<h2>Sezon performansı</h2><p class='pk-uyari' role='alert'>Sezon performansı yüklenemedi. Yukarıdaki temel bilgiler etkilenmez. <button type='button' class='pk-link' data-pk-tekrar>Tekrar dene</button></p>";
    }
    else { h = "<h2>Sezon performansı</h2><p class='not' aria-busy='true'>Sezon sonuçları yükleniyor…</p>"; }
    kap.innerHTML = h;
  }
  function planla() { if (planli) { return; } planli = true; Promise.resolve().then(ciz); }

  // ---- veri ----
  // POLE: yalnızca MEVCUT önbellekten okunur (A3.1'in yüklediği S.poleKod ya da A2 SezonVeri'nin yazdığı önbellek kaydı).
  // Sırf pole için hiçbir ağ çağrısı başlatılmaz; veri yoksa "—" gösterilir ve veri sonradan önbelleğe düşerse yeniden çizilir.
  function poleOnbellek() {
    if (!D.model || !D.h) { return null; }
    var AMS = window.AnalizMerkezi && AnalizMerkezi._durum;
    if (AMS && AMS.pole === true && AMS.poleKod) { return AMS.poleKod; }
    var JI = window.JolpicaIstemci; if (!JI || !JI.oku) { return null; }
    var yil = sezonYili(), harita = {}, eksik = 0, toplu = null;
    try { toplu = JI.oku("sezon-" + yil + "-pole"); } catch (e) { toplu = null; }
    D.h.turlar.forEach(function (n) {
      var p = toplu && toplu.veri && toplu.veri.turlar && toplu.veri.turlar[n];
      if (!p) { try { var t = JI.oku("sezon-" + yil + "-pole-r" + n); p = t && t.veri && t.veri.pole; } catch (e) { p = null; } }
      if (p && p.k) { harita[n] = p.k; } else { eksik++; }
    });
    return eksik === 0 && D.h.turlar.length ? harita : null;
  }
  function poleGuncelle() {
    var h = poleOnbellek();
    if (h) { D.poleKod = h; D.pole = true; } else { D.poleKod = null; D.pole = null; }
    if (D.model) { D.wpp = H.galibiyetPodyumPole(D.model, D.poleKod); }
  }
  async function yukle() {
    if (D.yukleniyor || D.durum === "hazir") { return; }
    D.yukleniyor = true; D.durum = "yukleniyor"; planla();
    try {
      var r = await SA.yukle(sezonYili());
      D.sonuc = r; D.model = r.model; hesapla(); poleGuncelle();
      D.durum = "hazir"; planla();
    } catch (e) { D.durum = "hata"; planla(); }
    D.yukleniyor = false;
  }
  function gorunur() { return !sec.hidden && standings().length > 0 && pa.options.length > 1; }
  function dene() { if (gorunur() && (D.durum === "bos")) { yukle(); } }

  // ---- kurulum ----
  function baslat() {
    sec = document.getElementById("sekme-profil"); tb = document.getElementById("kiyas-govde");
    pa = document.getElementById("pilot-a"); pb = document.getElementById("pilot-b");
    if (!sec || !tb || !pa || !pb) { return; }
    var kapTablo = tb.closest ? tb.closest(".kap") : tb.parentNode;
    if (!kapTablo || !kapTablo.parentNode) { return; }
    var baslik = document.createElement("h2"); baslik.className = "pk-temel"; baslik.textContent = "Temel bilgi";
    kapTablo.parentNode.insertBefore(baslik, kapTablo);
    kap = document.createElement("div"); kap.id = "pk-ek"; kap.className = "pk";
    kapTablo.parentNode.insertBefore(kap, kapTablo.nextSibling);
    // mevcut karşılaştırma tablosu her yeniden yazıldığında (kiyasla) yeni bloklar da güncellenir
    new MutationObserver(function () { dene(); planla(); }).observe(tb, { childList: true });
    new MutationObserver(function () { dene(); }).observe(sec, { attributes: true, attributeFilter: ["hidden"] });
    [pa, pb].forEach(function (s) { s.addEventListener("change", function () { esitle(); planla(); }); });
    kap.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("button") : null; if (!b) { return; }
      if (b.classList.contains("a2-baglanti") && b.hasAttribute("data-terim")) { try { if (window.Ogren && Ogren.ac) { Ogren.ac(b.getAttribute("data-terim")); } } catch (x) { /* düz metin */ } return; }
      if (b.hasAttribute("data-pk-tekrar")) { D.durum = "bos"; dene(); }
    });
    try { if (window.AnalizMerkezi && AnalizMerkezi.dinle) { AnalizMerkezi.dinle(function (neden) { if (neden === "pole" && D.durum === "hazir") { poleGuncelle(); planla(); } }); } } catch (e) { /* önemsiz */ }
    dene(); planla();
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", baslat); } else { baslat(); }

  window.PilotKarsilastirma = { durum: function () { return D.durum; }, _durum: D };
})();
