/* A3.2 — Form ve pozisyon analizi (Grafik sekmesi, Sezon Analiz Merkezi'nin devamı).
   Bölümler: Son 5 yarış formu · Start → Bitiş (tek kompakt tablo) · Pole → Galibiyet · DNF/DNS/DSQ.
   VERİ: yalnızca A3.1'in zaten yüklediği model (AnalizMerkezi._durum) ve A2 SezonVeri'den gelen pole haritası. YENİ AĞ ÇAĞRISI YOKTUR.
   HESAP: sezon-hesap-a32.js (saf). GÖRSEL: HTML/CSS çubuk ve kutular (Chart.js yok, CDN yok).
   ENTEGRASYON: A3.1'in olay kancasına (AnalizMerkezi.dinle) abone olur; A3.1 bölümlerini yeniden yazmaz, yalnızca yanlarına yeni bölümler ekler.
   Pilot seçimi A3.1 ile ORTAKTIR (AnalizMerkezi.secim / secimYaz; aynı tercih anahtarı). Yeni tercih anahtarı yoktur.
   A3.1 yoksa ya da bozuksa bu dosya hiçbir şey yapmaz. */
(function () {
  "use strict";
  var AM = window.AnalizMerkezi, HA = window.SezonHesapA32, F = window.F1UI;
  if (!AM || !AM.dinle || !AM.secim || !AM.secimYaz || !HA) { return; }
  var S = AM._durum;
  var C = { model: null, poleKod: undefined, h: null, p: null, sonTakim: {} };
  var AC = { net: false, pole: false, dnf: false };          // "Tümünü göster" durumu (yalnızca bellekte; kalıcı tercih değil)
  var ILK = { net: 10, pole: 8, dnf: 10 };
  var odak = false, planli = false, bagli = false;

  function esc(x) { return F && F.esc ? F.esc(x) : String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }
  function kok() { return document.getElementById("a3-merkez"); }
  function soz(k) { try { return window.ICERIK && ICERIK.sozluk && ICERIK.sozluk.terimler[k] || null; } catch (e) { return null; } }
  // A2'nin ⓘ düğmesiyle aynı işaretleme: tıklamayı A2'nin belge düzeyindeki dinleyicisi sözlük penceresine bağlar
  function bilgi(k) { var t = soz(k); return t ? "<button type='button' class='a2-i' data-terim='" + k + "' aria-haspopup='dialog' aria-label='" + esc(t.ad) + " nedir?' title='" + esc(t.ad) + " nedir?'></button>" : ""; }

  function kod(id) { var p = S.model.pilotlar[id]; return p ? p.k : id; }
  function soyad(id) { var p = S.model.pilotlar[id]; return p ? p.a.split(" ").slice(-1)[0] : id; }
  function takimAd(tid) { return S.model.takimlar[tid] || tid; }
  function takimKey(tid) { var t = F && F.takimTemasi ? F.takimTemasi(takimAd(tid)) : null; return t ? t.key : "diger"; }
  function renk(id) { return "var(--a3-c-" + takimKey(C.sonTakim[id]) + ")"; }
  function rozet(id) { return F && F.takimRozeti && C.sonTakim[id] ? F.takimRozeti(takimAd(C.sonTakim[id])) : ""; }

  // ---- hesap (model/pole değişince bir kez) ----
  function hesap() {
    if (C.model === S.model && C.poleKod === S.poleKod && C.h) { return C; }
    C.model = S.model; C.poleKod = S.poleKod;
    C.h = HA.hesapla(S.model, 5);
    C.p = HA.poleDonusumu(S.model, S.poleKod || null);
    C.sonTakim = {};
    HA.yarisTurlari(S.model).concat(Object.keys(S.model.turlar).map(Number)).sort(function (a, b) { return a - b; }).forEach(function (n) {
      var t = S.model.turlar[n]; if (!t) { return; }
      ["yaris", "sprint"].forEach(function (a) { (t[a] || []).forEach(function (r) { C.sonTakim[r.p] = r.t; }); });
    });
    return C;
  }
  function bilgiPilot(id) {
    return C.h.pilot[id] || { id: id, yarisSayisi: C.h.yarisSayisi, katildi: 0, sin: 0, dnf: 0, dns: 0, dsq: 0, diger: 0, haric: { grid0: 0, yok: C.h.yarisSayisi },
                              ornek: { n: 0, ortStart: null, ortBitis: null, net: 0 }, form: [], form5Puan: 0 };
  }

  // ---- biçim ----
  function net(n) { return n > 0 ? "+" + n : String(n); }
  function o1(x) { return x == null ? "—" : x.toFixed(1); }
  function yuzde(w, n) { return n > 0 ? "%" + (Math.round(w / n * 1000) / 10) : "—"; }
  function adlar(ids) { var a = ids.slice(0, 3).map(function (id) { return esc(soyad(id)); }).join(" · "); return a + (ids.length > 3 ? " +" + (ids.length - 3) : ""); }
  function ornekMetni(a) { return a.ornek.n + " / " + a.yarisSayisi; }
  function haricMetni(a) {
    var p = [];
    if (a.dnf) { p.push(a.dnf + " DNF"); } if (a.dns) { p.push(a.dns + " DNS"); } if (a.dsq) { p.push(a.dsq + " DSQ"); }
    if (a.diger) { p.push(a.diger + " diğer sonuç"); } if (a.haric.grid0) { p.push(a.haric.grid0 + " pit çıkışı (grid 0)"); } if (a.haric.yok) { p.push(a.haric.yok + " yarışmadı"); }
    return p.length ? "Örneklem dışı: " + p.join(", ") : "Tüm yarışlar örneklemde";
  }
  function pilotBas(id) { return "<header class='a32-bas'><span class='a32-kod'>" + esc(kod(id)) + "</span><span class='a32-ad'>" + esc(soyad(id)) + "</span>" + rozet(id) + "</header>"; }

  // ---- seçici (A3.1 ile ortak seçim) ----
  function secici() {
    var sec = AM.secim(), dolu = sec.length >= AM.maksSecim;
    var chips = sec.map(function (id) {
      return "<span class='a3-chip' style='--c:" + renk(id) + "'><span class='a32-chip-ad'><i class='a3-nokta'></i>" + esc(kod(id)) + "</span>" +
             "<button type='button' class='a3-chip-x' data-a32-cikar data-id='" + esc(id) + "' aria-label='" + esc(soyad(id)) + " kartlardan çıkar'>×</button></span>";
    }).join("");
    var kalan = S.sira.filter(function (id) { return sec.indexOf(id) < 0; });
    var secenek = "<option value=''>" + (dolu ? "En çok " + AM.maksSecim + " seçim" : "+ Pilot ekle") + "</option>" +
      kalan.map(function (id) { return "<option value='" + esc(id) + "'>" + esc(kod(id) + " · " + soyad(id)) + "</option>"; }).join("");
    return "<div class='a3-chipler'>" + chips + "<select class='a3-ekle' data-a32-ekle aria-label='Pilot ekle'" + (dolu ? " disabled" : "") + ">" + secenek + "</select></div>";
  }

  // ---- 1) SON 5 FORM ----
  function kutu(f) {
    var yarisAd = S.model.turlar[f.tur] ? S.model.turlar[f.tur].ad : "";
    var bas = "Tur " + f.tur + (yarisAd ? " · " + yarisAd : "") + ": ", sinif, yaz, uzun, yuk = 0;
    if (f.durum === "SIN") {
      sinif = f.poz <= 3 ? "pod" : (f.poz <= 10 ? "nor" : "dus"); yaz = "P" + f.poz; uzun = "P" + f.poz + " · " + f.puan + " puan";
      yuk = Math.max(8, Math.round((22 - Math.min(f.poz, 22)) / 21 * 100));
    }
    else if (f.durum === "DNF") { sinif = "dnf"; yaz = "DNF"; uzun = "DNF (yarışı bitiremedi)"; }
    else if (f.durum === "DNS") { sinif = "dns"; yaz = "DNS"; uzun = "DNS (yarışa başlamadı)"; }
    else if (f.durum === "DSQ") { sinif = "dsq"; yaz = "DSQ"; uzun = "DSQ (diskalifiye)"; }
    else if (f.durum === "YOK") { sinif = "yok"; yaz = "—"; uzun = "yarışta yer almadı"; }
    else { sinif = "yok"; yaz = "?"; uzun = "sonuç sınıflandırılamadı"; }
    return { html: "<li class='a32-k a32-k-" + sinif + "' title='" + esc(bas + uzun) + "'><span class='a32-kt'>T" + f.tur + "</span><b class='a32-kd'>" + esc(yaz) + "</b>" +
                   "<span class='a32-bar' aria-hidden='true'><i style='height:" + yuk + "%'></i></span></li>", metin: "Tur " + f.tur + " " + uzun };
  }
  function formKart(id) {
    var a = bilgiPilot(id), ks = a.form.map(kutu);
    var gövde = ks.length
      ? "<ol class='a32-kutular' aria-label='Son " + ks.length + " ana yarış, eskiden yeniye: " + esc(ks.map(function (k) { return k.metin; }).join("; ")) + "'>" + ks.map(function (k) { return k.html; }).join("") + "</ol>" +
        "<p class='a32-alt'>Bu " + ks.length + " yarışta ana yarış puanı: <b>" + a.form5Puan + "</b></p>"
      : "<p class='a3-bos'>Henüz ana yarış yok.</p>";
    return "<article class='a32-kart' style='--c:" + renk(id) + "' data-a32-pilot='" + esc(id) + "'>" + pilotBas(id) + gövde + "</article>";
  }
  // Tek cümle özet: son N Grand Prix'de en çok puanı toplayan (tüm pilotlar; seçimden bağımsız). Veri yoksa gösterilmez.
  function formCumlesi() {
    var h = C.h, n = h && h.formTurlari ? h.formTurlari.length : 0; if (!h || !h.pilot || n < 2) { return ""; }
    var l = Object.keys(h.pilot).map(function (id) { return { id: id, p: Number(h.pilot[id].form5Puan) || 0 }; }).sort(function (x, y) { return y.p - x.p; });
    if (!l.length || l[0].p <= 0) { return ""; }
    var en = l.filter(function (x) { return x.p === l[0].p; }).map(function (x) { return soyad(x.id); });
    var ikinci = l.filter(function (x) { return x.p < l[0].p; })[0];
    return "Son " + n + " Grand Prix'de en çok puanı " + (en.length === 1 ? en[0] + " topladı" : en.join(" ve ") + " topladı (eşit)") + ": " + l[0].p + " puan (sprint hariç)" +
      (ikinci && en.length === 1 ? "; ardından " + soyad(ikinci.id) + " " + ikinci.p + " puan." : ".");
  }
  function formBolum() {
    var sec = AM.secim(), fc = formCumlesi();
    return "<h2>Son 5 yarış formu " + bilgi("form") + "</h2>" + (fc ? "<p class='a3-cumle'>" + esc(fc) + "</p>" : "") +
      "<p class='a3-not'>Her pilotun son 5 ana yarıştaki bitiş sırası (soldan sağa: eskiden yeniye). Sonuçlar olduğu gibi gösterilir, sebep yorumu yapılmaz. Yüksek çubuk = öndeki sıra. Pilot seçimi puan grafiğiyle ortaktır.</p>" +
      secici() + (sec.length ? "<div class='a32-liste'>" + sec.map(formKart).join("") + "</div>" : "<p class='a3-bos'>Kart görmek için en az bir pilot seçin.</p>");
  }

  // ---- 2) START → BİTİŞ — tek kompakt karşılaştırma (seçili pilotlar). Sezon net pozisyon sıralaması kaldırıldı (performans ölçüsü değildi). ----
  function sfSatir(id, secili) {
    var a = bilgiPilot(id), o = a.ornek;
    var cls = o.n ? (o.net > 0 ? "a32-up" : (o.net < 0 ? "a32-down" : "")) : "";
    return "<tr" + (secili ? " class='a32-sf-sec' style='--c:" + renk(id) + "'" : "") + " data-a32-pilot='" + esc(id) + "'><th scope='row'><span class='a32-sf-k'>" + esc(kod(id)) + "</span> <span class='a3-soluk a32-sf-a'>" + esc(soyad(id)) + "</span></th>" +
      "<td>" + o1(o.ortStart) + "</td><td>" + o1(o.ortBitis) + "</td><td class='a32-net-d " + cls + "'>" + (o.n ? net(o.net) : "—") + "</td><td title='" + esc(haricMetni(a)) + "'>" + esc(ornekMetni(a)) + "</td></tr>";
  }
  function sfTablo(ids, secili) {
    return "<div class='a3-tablo-kap'><table class='a3-tablo a32-sf'><thead><tr><th scope='col'>Pilot</th><th scope='col'>Ort. start " + bilgi("ortalama-start") + "</th><th scope='col'>Ort. bitiş " + bilgi("ortalama-bitis") + "</th><th scope='col'>Fark " + bilgi("net-pozisyon") + "</th><th scope='col'>Yarış</th></tr></thead><tbody>" +
      ids.map(function (id) { return sfSatir(id, secili); }).join("") + "</tbody></table></div>";
  }
  function sfBolum() {
    var sec = AM.secim();
    return "<h2>Start → Bitiş</h2>" +
      "<p class='a3-not'>Ana yarışta ortalama başlangıç ve bitiş sırası; fark = start − bitiş (sezon toplamı). Yalnızca sınıflandırılmış bitirilen yarışlar sayılır (sprint, DNF, DNS, DSQ, pit çıkışı hariç). Sayılar sonucu gösterir, sebebini söylemez.</p>" +
      (sec.length ? sfTablo(sec, true) : "<p class='a3-bos'>Karşılaştırma için yukarıdan pilot seçin.</p>") +
      "<details class='a3-detay'><summary>Tüm pilotlar (tablo)</summary>" + sfTablo(S.sira, false) + "</details>";
  }

  // ---- 3) POLE → GALİBİYET (ve ayrı ölçü: P1 start → galibiyet) ----
  function oran(baslik, ipucuK, sayi, galibiyet, yok, durum, birim) {
    var ust = "<span>" + baslik + " " + bilgi(ipucuK) + "</span>";
    if (durum) { return "<div class='a32-oran'><div class='a32-oran-bas'>" + ust + "<b>—</b></div><p class='a32-oran-alt'>" + esc(durum) + "</p></div>"; }
    if (!sayi) { return "<div class='a32-oran'><div class='a32-oran-bas'>" + ust + "<b>—</b></div><p class='a32-oran-alt'>" + esc(yok) + "</p></div>"; }
    var y = Math.round(galibiyet / sayi * 1000) / 10;
    return "<div class='a32-oran'><div class='a32-oran-bas'>" + ust + "<b>%" + y + "</b></div>" +
      "<div class='a32-prog' role='img' aria-label='" + sayi + " için " + galibiyet + " galibiyet, " + yuzde(galibiyet, sayi) + "'><i style='width:" + y + "%'></i></div>" +
      "<p class='a32-oran-alt'>" + sayi + " " + birim + " · " + galibiyet + " galibiyet</p></div>";
  }
  function poleKart(id) {
    var d = C.p.pilot[id], poleDurum = S.pole === true ? "" : (S.pole === null ? "Pole verisi yükleniyor" : "Pole verisi alınamadı");
    var notlar = [];
    if (S.pole === true && d.poleP1Degil) { notlar.push("Pole sahibiydi ama P1'den başlamadığı yarış: " + d.poleP1Degil + " (pole sayısına girer, P1 start sayısına girmez)"); }
    if (S.pole === true && d.p1PoleDegil) { notlar.push("P1'den başladı ama pole sahibi değildi: " + d.p1PoleDegil + " yarış (yalnızca P1 start sayısına girer)"); }
    return "<article class='a32-kart' style='--c:" + renk(id) + "' data-a32-pilot='" + esc(id) + "'>" + pilotBas(id) +
      oran("Pole → galibiyet", "pole-donusumu", d.pole, d.poleGalibiyet, "Pole yok", poleDurum, "pole") +
      oran("P1 start → galibiyet", "pole-donusumu", d.p1Start, d.p1Galibiyet, "P1'den başlamadı", "", "P1 start") +
      (notlar.length ? "<p class='a32-oran-not'>" + notlar.map(esc).join("<br>") + "</p>" : "") + "</article>";
  }
  function poleBolum() {
    var ids = S.sira.filter(function (id) { var d = C.p.pilot[id]; return d && (d.pole > 0 || d.p1Start > 0); });
    ids = ids.map(function (id, i) { return { id: id, i: i }; }).sort(function (a, b) {
      var A = C.p.pilot[a.id], B = C.p.pilot[b.id];
      return (B.pole - A.pole) || (B.p1Start - A.p1Start) || (a.i - b.i);
    }).map(function (x) { return x.id; });
    var goster = AC.pole ? ids : ids.slice(0, ILK.pole);
    var durum = S.pole === null ? "<p class='a3-uyari' role='status'>Pole verisi yükleniyor; yalnızca P1 start gösteriliyor.</p>"
      : (S.pole === false ? "<p class='a3-uyari' role='status'>Pole verisi alınamadı; yalnızca P1 start gösteriliyor. <button type='button" + "' class='a3-link' data-a3-pole-yeniden>Tekrar dene</button></p>" : "");
    var ayr = S.pole === true && C.p.ayrisan.length
      ? "<p class='a3-not'>Pole sahibi ile grid P1'in farklı olduğu yarışlar: " + C.p.ayrisan.map(function (x) { return "Tur " + x.tur + " (pole " + esc(x.pole ? kod(x.pole) : "?") + ", P1 start " + esc(x.grid1 ? kod(x.grid1) : "?") + ")"; }).join(", ") + ".</p>" : "";
    return "<h2>Pole → Galibiyet " + bilgi("pole-donusumu") + "</h2>" +
      "<p class='a3-not'>İki ayrı ölçü: <b>Pole</b> sıralamada en hızlı olmaktır; <b>P1 start</b> yarışa gridin ilk sırasından çıkmaktır. Grid cezası olduğunda ikisi farklı pilotlar olabilir, bu yüzden ayrı hesaplanır. Yalnızca ana yarışı yapılmış turlar sayılır.</p>" +
      durum + ayr +
      (goster.length ? "<div class='a32-liste'>" + goster.map(poleKart).join("") + "</div>" : "<p class='a3-bos'>Henüz kayıt yok.</p>") +
      (ids.length > ILK.pole ? "<button type='button' class='a3-link' data-a32-tum='pole' aria-expanded='" + AC.pole + "'>" + (AC.pole ? "İlk " + ILK.pole + " pilotu göster" : "Tümünü göster (" + ids.length + ")") + "</button>" : "");
  }

  // ---- 4) DNF / DNS / DSQ ----
  function dnfBolum() {
    var tp = HA.toplamDurum(C.h);
    var ids = S.sira.filter(function (id) { var a = C.h.pilot[id]; return a && (a.dnf || a.dns || a.dsq); });
    ids = ids.map(function (id, i) { return { id: id, i: i }; }).sort(function (a, b) {
      var A = C.h.pilot[a.id], B = C.h.pilot[b.id]; return ((B.dnf + B.dns + B.dsq) - (A.dnf + A.dns + A.dsq)) || (a.i - b.i);
    }).map(function (x) { return x.id; });
    var maks = 1; ids.forEach(function (id) { var a = C.h.pilot[id], t = a.dnf + a.dns + a.dsq; if (t > maks) { maks = t; } });
    var goster = AC.dnf ? ids : ids.slice(0, ILK.dnf);
    function sayac(ad, n, sinif, k) { return "<span class='a32-sayac " + sinif + (n ? "" : " sifir") + "'>" + ad + " " + (k ? bilgi(k) : "") + "<b>" + n + "</b></span>"; }
    var satirlar = goster.map(function (id) {
      var a = C.h.pilot[id], t = a.dnf + a.dns + a.dsq;
      return "<li class='a32-dr' style='--c:" + renk(id) + "' aria-label='" + esc(soyad(id) + ": " + a.dnf + " DNF, " + a.dns + " DNS, " + a.dsq + " DSQ") + "'>" +
        "<span class='a32-dk'><span class='a32-nk'>" + esc(kod(id)) + "</span><span class='a32-na'>" + esc(soyad(id)) + "</span></span>" +
        "<span class='a32-say'>" + sayac("DNF", a.dnf, "dnf", "") + sayac("DNS", a.dns, "dns", "") + sayac("DSQ", a.dsq, "dsq", "") + "</span>" +
        "<span class='a32-dbar' aria-hidden='true'><i style='width:" + Math.round(t / maks * 100) + "%'></i></span></li>";
    }).join("");
    return "<h2>DNF · DNS · DSQ " + bilgi("dnf") + "</h2>" +
      "<p class='a3-not'>Pilot bazında üç durum ayrı sayılır. Nedenler (teknik arıza, kaza vb.) ayrılmaz ve tahmin edilmez. Bu yarışlar Ortalama Start, Ortalama Bitiş ve Net Pozisyon hesabına girmez. DNF: yarışı bitiremedi; DNS: başlayamadı; DSQ: diskalifiye " + bilgi("dns-dsq") + "</p>" +
      "<p class='a32-toplam'>Sezon toplamı (" + C.h.yarisSayisi + " yarış): <b>" + tp.dnf + "</b> DNF · <b>" + tp.dns + "</b> DNS · <b>" + tp.dsq + "</b> DSQ" + (tp.diger ? " · " + tp.diger + " diğer sonuç" : "") + "</p>" +
      (ids.length ? "<ul class='a32-dnf'>" + satirlar + "</ul>" : "<p class='a3-bos'>Henüz DNF, DNS veya DSQ kaydı yok.</p>") +
      (ids.length > ILK.dnf ? "<button type='button' class='a3-link' data-a32-tum='dnf' aria-expanded='" + AC.dnf + "'>" + (AC.dnf ? "İlk " + ILK.dnf + " pilotu göster" : "Tümünü göster (" + ids.length + ")") + "</button>" : "");
  }

  // ---- özet kartı ----
  function takimR(ids) {
    var gor = {}, h = [];
    (ids || []).slice(0, 3).forEach(function (id) { var t = C.sonTakim[id]; if (t && !gor[t]) { gor[t] = 1; h.push(rozet(id)); } });
    return h.length ? "<span class='a3-oz-takim'>" + h.join(" ") + "</span>" : "";
  }
  function ozetKarti(k) {   // "EN ÇOK POZİSYON KAZANAN" kaldırıldı (net pozisyon performans ölçüsü değil); eski kalıntıyı temizle
    var kap = k.querySelector("[data-a3-ozet]"); if (!kap) { return; }
    var eski = kap.querySelector("[data-a32-oz]"); if (eski && eski.parentNode) { eski.parentNode.removeChild(eski); }
    kap.classList.remove("a32-5");
  }

  // ---- yerleştirme ----
  function bolum(k, id, oncekiId) {
    var el = k.querySelector("#" + id);
    if (!el) {
      var ref = k.querySelector("#" + oncekiId); if (!ref) { return null; }
      el = document.createElement("section"); el.id = id; el.className = "a3-kart a32-bolum"; el.setAttribute("data-a32", "1");
      ref.parentNode.insertBefore(el, ref.nextSibling);
    }
    return el;
  }
  function yenile() {
    planli = false;
    var k = kok();
    if (!k || S.durum !== "hazir" || !S.model || !k.querySelector("#a3-pilot")) { return; }
    hesap();
    var form = bolum(k, "a32-form", "a3-pilot"), sf = bolum(k, "a32-sf", "a32-form"), pole = bolum(k, "a32-pole", "a3-wpp"), dnf = bolum(k, "a32-dnf", "a3-takim");
    if (form) { form.innerHTML = formBolum(); }
    if (sf) { sf.innerHTML = sfBolum(); }
    if (pole) { pole.innerHTML = poleBolum(); }
    if (dnf) { dnf.innerHTML = dnfBolum(); }
    ozetKarti(k);
    if (odak) {
      odak = false;
      var s = k.querySelector("#a32-form [data-a32-ekle]"); if (s && !s.disabled) { s.focus(); }
    }
  }
  function planla() { if (planli) { return; } planli = true; Promise.resolve().then(yenile); }

  // ---- etkileşim ----
  function olaylar(k) {
    if (bagli) { return; } bagli = true;
    k.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("button") : null; if (!b) { return; }
      if (b.hasAttribute("data-a32-cikar")) {
        var id = b.getAttribute("data-id"); odak = true;
        AM.secimYaz(AM.secim().filter(function (x) { return x !== id; })); return;
      }
      if (b.hasAttribute("data-a32-tum")) { var g = b.getAttribute("data-a32-tum"); AC[g] = !AC[g]; planla(); }
    });
    k.addEventListener("change", function (e) {
      var s = e.target; if (!s || !s.hasAttribute || !s.hasAttribute("data-a32-ekle")) { return; }
      var id = s.value; if (!id || AM.secim().indexOf(id) >= 0) { return; }
      odak = true; AM.secimYaz(AM.secim().concat([id]));
    });
  }

  function baslat() {
    var k = kok(); if (!k) { return; }
    olaylar(k);
    AM.dinle(function () { planla(); });
    if (AM.durum() === "hazir") { planla(); }
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", baslat); } else { baslat(); }
})();
