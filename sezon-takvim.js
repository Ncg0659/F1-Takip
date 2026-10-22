/* A2.1 — Güncel Sezon takvim kartları.
   Veri: SezonVeri (sezon-veri.js). Kendi kapsayıcısı: #a2-takvim. Eski takvim tablosu (#a2-eski-takvim) silinmez:
   kartlar başarıyla çizilirse #sekme-sezon[data-a2="1"] ile gizlenir, çizilemezse görünür kalır (otomatik yedek).
   index.html'deki hiçbir fonksiyonu çağırmaz/değiştirmez; yalnızca #btn-sezon düğmesine ek bir dinleyici ekler. */
(function () {
  var F = window.F1UI, HV = window.HaftaVeri, SV = window.SezonVeri;
  var ANAHTAR_FILTRE = "f1-ogren-v1-takvim-filtre";
  var FILTRELER = [["hepsi", "Tümü"], ["biten", "Biten"], ["gelecek", "Gelecek"], ["sprint", "Sprint"]];
  var S = { model: null, filtre: "gelecek", yukleniyor: false, sayac: null, bekleme: null };

  function esc(x) { return F ? F.esc(x) : String(x); }
  function sezonYili() { try { return typeof SEZON !== "undefined" ? SEZON : new Date().getFullYear(); } catch (e) { return new Date().getFullYear(); } }
  function tz() { return HV.ANA_TZ || "Europe/Istanbul"; }
  function zaman(d, t) { return new Date(d + "T" + (t || "12:00:00Z")); }

  // Kayıtlı (kullanıcının seçtiği) filtre varsa o korunur; sıfırdan açılışta varsayılan "Gelecek"
  function filtreOku() { try { var f = localStorage.getItem(ANAHTAR_FILTRE); return FILTRELER.some(function (x) { return x[0] === f; }) ? f : "gelecek"; } catch (e) { return "gelecek"; } }
  function filtreYaz(f) { try { localStorage.setItem(ANAHTAR_FILTRE, f); } catch (e) { /* önemsiz */ } }

  function tarihYaz(y) {
    return zaman(y.date, y.time).toLocaleDateString("tr-TR", { day: "numeric", month: "long", timeZone: tz() });
  }
  function durumu(y, simdi, siradakiTur, tur) {
    var bas = zaman(y.date, y.time).getTime();
    if (Number(y.round) === siradakiTur) { return "siradaki"; }
    if (bas + 6 * 3600 * 1000 > simdi) { return "gelecek"; }
    return tur && tur.kazanan ? "biten" : "bekleniyor";
  }

  // ---- Sunum katmanı (yalnızca HTML üretimi; veri/davranış değişmez) ----
  var IK = {
    podyum: "M3 21h18|M9 21V11h6v10|M3 21v-6h6|M15 21v-8h6v8",
    sag: "M9 6l6 6-6 6",
    check: "M5 12.5l4.5 4.5L19 7"
  };
  function ik(ad, boyut) {
    if (IK[ad]) {
      return "<svg class='ik' viewBox='0 0 24 24' aria-hidden='true' style='width:" + boyut + "px;height:" + boyut + "px'>" +
             IK[ad].split("|").map(function (d) { return "<path d='" + d + "'/>"; }).join("") + "</svg>";
    }
    return F.ikon(ad, boyut);
  }
  function kod(k) { return "<span class='st-k'>" + esc(k) + "</span>"; }

  // A5.1: pist adı ayrı, güvenli bir düğme (Pist Profili hazırsa); kart/Detay/diğer tıklamalar değişmez
  // Görünen pist adı (yalnız sunum): fixture/kaynak ham anahtar (ör. "marina_bay") verirse insan okunur ad kullanılır
  function pistGorunen(y) {
    var c = y.Circuit || {}, ad = c.circuitName || "", id = c.circuitId || "";
    var sn = window.PIST_SINIFLANDIRMA && window.PIST_SINIFLANDIRMA.harita ? window.PIST_SINIFLANDIRMA.harita()[id] : null;
    if (ad && ad !== id && !/^[a-z0-9]+(_[a-z0-9]+)*$/.test(ad)) { return ad; }
    if (sn && sn.ad) { return sn.ad; }
    var yer = c.Location && c.Location.locality ? c.Location.locality : "";
    return ad ? ad.replace(/_/g, " ").replace(/(^|\s)([a-zçğıöşü])/g, function (m, a, b) { return a + b.toUpperCase(); }) : yer;
  }
  function sehirGorunen(t) {     // şehir/yer alanı ham anahtar (ör. "marina_bay") ise insan okunur yazılır; normal değer aynen döner (yalnız sunum)
    t = String(t == null ? "" : t);
    return /^[a-z0-9]+(_[a-z0-9]+)*$/.test(t) ? t.replace(/_/g, " ").replace(/(^|\s)([a-zçğıöşü])/g, function (m, a, b) { return a + b.toUpperCase(); }) : t;
  }
  function pistAdi(y, ad) {
    var id = y.Circuit && y.Circuit.circuitId;
    return window.ProfilPist && id ? "<button type='button' class='st-pist' data-pist='" + esc(id) + "' aria-label='" + esc(ad) + " pist profilini aç'>" + esc(ad) + "</button>" : esc(ad);
  }
  function ustBaslik(y, sprintMi, bitti) {
    var yer = y.Circuit && y.Circuit.Location ? y.Circuit.Location : {};
    var pist = pistGorunen(y) || sehirGorunen(yer.locality) || "";
    return "<header class='st-bas'><span class='st-no'>" + esc(y.round) + "</span>" +
           "<div class='st-ad'><div class='st-gp' lang='en'>" + ik("checker", 16) + "<b>" + esc(y.raceName) + "</b></div>" +
           "<div class='st-meta'><span>" + ik("pin", 12) + pistAdi(y, pist) + "</span><span>" + ik("calendar", 12) + esc(tarihYaz(y)) + "</span></div></div>" +
           "<span class='st-rozetler'>" + (sprintMi ? "<span class='st-sprint'>SPRINT</span>" : "") + (bitti ? "<span class='st-bitti'>" + ik("check", 11) + "BİTTİ</span>" : "") + "</span></header>";
  }

  function istOge(ikonAd, etiket, deger) {
    return "<div class='st-oge st-oge-" + ikonAd + "'><span class='st-et'>" + ik(ikonAd, 12) + etiket + "</span><span class='st-deg'>" + deger + "</span></div>";
  }

  function biten(y, t, sprintMi) {
    var k = t.kazanan;
    var h = ustBaslik(y, sprintMi, true);
    var oge = [];
    oge.push(istOge("trophy", "KAZANAN", kod(k.k) + "<b class='st-kaz-ad'>" + esc(k.a) + "</b>" + F.takimRozeti(k.t)));
    if (t.p2 || t.p3) {
      oge.push(istOge("podyum", "PODYUM", (t.p2 ? "<span class='st-pod'><i>2.</i>" + kod(t.p2.k) + "</span>" : "") + (t.p3 ? "<span class='st-pod'><i>3.</i>" + kod(t.p3.k) + "</span>" : "")));
    }
    if (t.pole) { oge.push(istOge("stopwatch", "POLE", kod(t.pole.k))); }
    if (t.sprint) { oge.push(istOge("zap", "SPRINT KAZANANI", kod(t.sprint.k))); }
    h += "<section class='st-blok st-ist'>" + oge.join("") + "</section>";
    var det = [];
    det.push("<li><b>1.</b> " + esc(k.a) + " (" + esc(k.t) + ")" + (k.s ? " — " + esc(k.s) : "") + (k.g ? " · start " + (Number(k.g) > 0 ? esc(k.g) + ". sıra" : "pit çıkışı") : "") + "</li>");
    if (t.p2) { det.push("<li><b>2.</b> " + esc(t.p2.a) + " (" + esc(t.p2.t) + ")" + (t.p2.s ? " — " + esc(t.p2.s) : "") + "</li>"); }
    if (t.p3) { det.push("<li><b>3.</b> " + esc(t.p3.a) + " (" + esc(t.p3.t) + ")" + (t.p3.s ? " — " + esc(t.p3.s) : "") + "</li>"); }
    if (t.pole) { det.push("<li><b>Pole:</b> " + esc(t.pole.a) + " (" + esc(t.pole.t) + ")</li>"); }
    if (t.sprint) { det.push("<li><b>Sprint kazananı:</b> " + esc(t.sprint.a) + " (" + esc(t.sprint.t) + ")</li>"); }
    var id = "st-det-" + y.round;
    h += "<footer class='st-blok st-alt-bolum'><button type='button' class='st-detay' aria-expanded='false' aria-controls='" + id + "' data-tur='" + esc(y.round) + "'>Detay" + ik("sag", 14) + "</button>" +
         "<ul class='st-detay-ic' id='" + id + "' hidden>" + det.join("") + "</ul></footer>";
    return h;
  }

  function gelecekKart(y, sprintMi) {
    var bas = zaman(y.date, y.time);
    return ustBaslik(y, sprintMi) + "<section class='st-blok st-gel'><span class='st-et'>" + ik("stopwatch", 12) + "YARIŞ</span><span class='st-deg'>" +
           esc(HV.kisaGunYaz(bas, tz())) + " · " + esc(HV.saatYaz(bas, tz())) + " <small>TR</small></span></section>";
  }

  // ---- UI STYLE PASS v2 / Aşama 1: "Sıradaki Yarış" COTA PROTOTİPİ (yalnız sunum; veri/sayaç hesabı/seçim mantığı değişmez) ----
  // Tüm pistler aynı component'i kullanır. Silüet/bayrak/bölge tabloları pist-siluetleri.js'tedir (sabit veri; ağ yok).
  var PS = window.PistSiluetleri || { YOL: {}, bayrak: function () { return ""; }, BOLGE: {} };
  function bayrak(ulke) { var f = PS.bayrak(ulke); return f ? "<span class='st-p-bayrak' aria-hidden='true'>" + f + "</span>" : ""; }
  function pistSvg(id) {
    if (!PS.YOL[id]) { return "<div class='st-p-yedek' role='img' aria-label='Pist silueti hazırlanıyor'><span>Pist silueti hazırlanıyor</span></div>"; }
    return "<svg class='st-p-pist' viewBox='0 0 300 200' role='img' aria-label='Pist silueti (dekoratif çizim)' preserveAspectRatio='xMidYMid meet'>" +
           "<path class='st-p-hat-alt' d='" + PS.YOL[id] + "'/><path class='st-p-hat' d='" + PS.YOL[id] + "'/></svg>";
  }
  function sayacKutulari() {
    var b = [["gun", "GÜN"], ["saat", "SAAT"], ["dk", "DK"], ["sn", "SN"]];
    return b.map(function (x) { return "<div class='st-p-kutu st-p-kutu-" + x[0] + "'><span class='st-p-sayi' data-u='" + x[0] + "'>--</span><span class='st-p-birim'>" + x[1] + "</span></div>"; }).join("");
  }
  function siradakiPrototip(y, sprintMi, simdi) {
    var hafta = HV.haftaKur(y), yer = y.Circuit && y.Circuit.Location ? y.Circuit.Location : {};
    var toplam = S.model && S.model.yarislar ? S.model.yarislar.length : 0;
    var pistAd = pistGorunen(y);
    var konum = [yer.locality, pistAd].filter(Boolean);
    var basladi = zaman(y.date, y.time).getTime() <= simdi;
    // Seans kartları (mini takvim grid). Durum yalnız mevcut saf kuraldan (HV.seansDurumu) okunur; yeni durum mantığı yok.
    var satirlar = hafta.seanslar.map(function (s) {
      var dur = "yaklasan";
      try { dur = HV.seansDurumu(s, hafta, simdi) || "yaklasan"; } catch (e) { dur = "yaklasan"; }
      var g = String(HV.kisaGunYaz(s.baslangic, tz()) || "").split(/\s+/), gun = g.length === 3 ? g[0] + " " + g[1] + " · " + g[2] : g.join(" ");
      return "<li class='st-p-ss st-ss-" + esc(dur) + "'><span class='st-p-ssg'>" + esc(gun.toLocaleUpperCase("tr")) + (dur === "canli" ? "<b class='st-p-canli'>LIVE</b>" : "") + "</span>" +
             "<span class='st-p-sad'>" + esc(String(s.ad).toLocaleUpperCase("tr").replace(/SPRİNT/g, "SPRINT")) + "</span><span class='st-p-sz'>" + esc(HV.saatYaz(s.baslangic, tz())) + "</span></li>";
    }).join("");
    return "<div class='st-p-ust'><div class='st-p-sol'>" +
             "<p class='st-p-meta'><b class='st-p-sir'>SIRADAKİ</b><span> · TUR " + esc(y.round) + (toplam ? " / " + toplam : "") + "</span>" + (sprintMi ? "<span class='st-p-sprint'>SPRINT</span>" : "") + "</p>" +
             "<h3 class='st-p-ad' lang='en'>" + esc(y.raceName) + "</h3>" +
             "<p class='st-p-yer'>" + bayrak(yer.country) + "<span>" + (yer.locality ? esc(sehirGorunen(yer.locality)) + (pistAd ? " · " : "") : "") + (pistAd ? pistAdi(y, pistAd) : "") + "</span></p>" +
             "<div class='st-p-sayac' id='a2-sayac' data-bas='" + zaman(y.date, y.time).getTime() + "' role='timer' aria-label='Yarışa kalan süre'>" + (basladi ? "Yarış günü" : sayacKutulari()) + "</div>" +
           "</div><div class='st-p-sag'>" + pistSvg(y.Circuit && y.Circuit.circuitId) + "</div></div>" +
           "<section class='st-p-seans'><h4 class='st-p-bas'>SEANS PROGRAMI</h4><ul class='st-p-liste'>" + satirlar + "</ul><p class='st-p-not'>Saatler Türkiye saatiyle.</p></section>" +
           "<footer class='st-p-alt'><button type='button' class='st-git st-p-git' data-git='hafta'>Yarış Haftası'na git" + ik("sag", 14) + "</button></footer>";
  }

  function siradakiKart(y, sprintMi, simdi) {
    var hafta = HV.haftaKur(y);
    var satirlar = hafta.seanslar.map(function (s) {
      return "<li><span>" + esc(s.ad) + "</span><b>" + esc(HV.kisaGunYaz(s.baslangic, tz())) + " · " + esc(HV.saatYaz(s.baslangic, tz())) + "</b></li>";
    }).join("");
    var basladi = zaman(y.date, y.time).getTime() <= simdi;
    return "<span class='st-etiket'>SIRADAKİ</span>" + ustBaslik(y, sprintMi) +
           "<section class='st-blok st-say'><span class='st-et'>" + ik("stopwatch", 12) + "YARIŞA KALAN</span>" +
           "<div class='st-sayac' id='a2-sayac' data-bas='" + zaman(y.date, y.time).getTime() + "'>" + (basladi ? "Yarış günü" : "") + "</div></section>" +
           "<section class='st-blok'><span class='st-et'>" + ik("calendar", 12) + "SEANS PROGRAMI</span><ul class='st-seans'>" + satirlar + "</ul><div class='st-not'>Saatler Türkiye saatiyle.</div></section>" +
           "<footer class='st-blok st-alt-bolum'><button type='button' class='st-git' data-git='hafta'>Yarış Haftası'na git" + ik("sag", 14) + "</button></footer>";
  }

  function kartCiz(y, durum, t, simdi) {
    var sprintMi = !!(y.Sprint && y.Sprint.date);
    var govde, sinif = "st-kart st-" + durum;
    if (durum === "siradaki") { sinif += " st-p-kart"; govde = siradakiPrototip(y, sprintMi, simdi); }
    else if (durum === "biten") { govde = biten(y, t, sprintMi); }
    else if (durum === "bekleniyor") { govde = ustBaslik(y, sprintMi) + "<section class='st-blok st-gel'><span class='st-et'>" + ik("stopwatch", 12) + "SONUÇ</span><span class='st-deg st-soluk'>Sonuç bekleniyor</span></section>"; }
    else { govde = gelecekKart(y, sprintMi); }
    return "<article class='" + sinif + "' data-tur='" + esc(y.round) + "'>" + govde + "</article>";
  }

  function ozet(m, simdi) {
    var biten = 0, sprint = 0;
    m.yarislar.forEach(function (y) {
      if (zaman(y.date, y.time).getTime() + 6 * 3600 * 1000 <= simdi) { biten++; }
      if (y.Sprint && y.Sprint.date) { sprint++; }
    });
    return biten + " / " + m.yarislar.length + " yarış tamamlandı · " + sprint + " sprint haftası";
  }

  // ======== UI STYLE PASS v2 / Aşama 2 — Sezon Takvimi v2 (yalnız sunum; veri/seçim mantığı mevcut model + mevcut Yarış Haftası seçimi) ========
  var AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  var AY_UZUN = ["OCAK", "ŞUBAT", "MART", "NİSAN", "MAYIS", "HAZİRAN", "TEMMUZ", "AĞUSTOS", "EYLÜL", "EKİM", "KASIM", "ARALIK"];
  var V2 = { goster: "tumu", bolge: "tumu", tip: "tumu" };
  var V2_GRUPLAR = [
    ["goster", "GÖSTER", [["tumu", "Tümü"], ["gelecek", "Gelecek"], ["gecmis", "Geçmiş"]]],
    ["bolge", "BÖLGE", [["tumu", "Tümü"], ["avrupa", "Avrupa"], ["amerikalar", "Amerikalar"], ["asya", "Asya"], ["ortadogu", "Orta Doğu"], ["okyanusya", "Okyanusya"]]],
    ["tip", "PİST TİPİ", [["tumu", "Tümü"], ["sokak", "Sokak"], ["kalici", "Kalıcı"]]]
  ];
  var KISA_AD = { "UK": "Great Britain", "UAE": "Abu Dhabi" };
  function yerelTarih(d) { var p = d.toLocaleDateString("en-CA", { timeZone: tz() }).split("-"); return { y: Number(p[0]), a: Number(p[1]), g: Number(p[2]) }; }
  // "6–8 Mar" (hafta sonu: ilk seanstan yarışa; ay değişirse "30 Eki–1 Kas"); Türkiye saatine göre
  function tarihAralik(y) {
    var yar = yerelTarih(zaman(y.date, y.time)), ilk = yar;
    try { var h = HV.haftaKur(y); if (h.seanslar.length) { ilk = yerelTarih(h.seanslar[0].baslangic); } } catch (e) { ilk = yar; }
    if (ilk.a === yar.a && ilk.g === yar.g) { return yar.g + " " + AYLAR[yar.a - 1]; }
    return ilk.a === yar.a ? ilk.g + "–" + yar.g + " " + AYLAR[yar.a - 1] : ilk.g + " " + AYLAR[ilk.a - 1] + "–" + yar.g + " " + AYLAR[yar.a - 1];
  }
  function kisaAd(y, tumu) {
    var yer = y.Circuit && y.Circuit.Location ? y.Circuit.Location : {}, ulke = yer.country || "";
    var say = tumu.filter(function (x) { return x.Circuit && x.Circuit.Location && x.Circuit.Location.country === ulke; }).length;
    var sade = String(y.raceName || "").replace(/\s*Grand Prix.*$/i, "");
    if (say > 1) { return (yer.locality && /^[A-ZÇĞİÖŞÜ]/.test(yer.locality)) ? yer.locality : sade; }
    return KISA_AD[ulke] || ulke || sade;
  }
  function pistTipi(y) {
    var id = y.Circuit && y.Circuit.circuitId, k = window.PIST_SINIFLANDIRMA && window.PIST_SINIFLANDIRMA.kategoriOf ? window.PIST_SINIFLANDIRMA.kategoriOf(id) : null;
    return k ? (k === "sokak" ? "sokak" : "kalici") : null;       // mevcut sınıflandırma; tabloda olmayan pist ikisine de girmez
  }
  function v2Gecer(b) {
    var y = b.y;
    if (V2.goster === "gelecek" && !(b.d === "gelecek" || b.d === "siradaki")) { return false; }
    if (V2.goster === "gecmis" && !(b.d === "biten" || b.d === "bekleniyor")) { return false; }
    if (V2.bolge !== "tumu" && PS.BOLGE[y.Circuit && y.Circuit.Location && y.Circuit.Location.country] !== V2.bolge) { return false; }
    if (V2.tip !== "tumu" && pistTipi(y) !== V2.tip) { return false; }
    return true;
  }
  function v2Kart(b, tumu) {
    var y = b.y, ad = kisaAd(y, tumu), tr = tarihAralik(y), sprint = !!(y.Sprint && y.Sprint.date), kaz = b.t && b.t.kazanan ? b.t.kazanan.k : "";
    var gecmis = b.d === "biten" || b.d === "bekleniyor", sinif = "st-ay-kart st-ay-" + (b.d === "siradaki" ? "siradaki" : gecmis ? "gecmis" : "gelecek");
    return "<li><button type='button' class='" + sinif + "' data-ay-tur='" + esc(y.round) + "' aria-label='" + esc("Tur " + y.round + ", " + ad + ", " + tr + (sprint ? ", sprint haftası" : "") + (b.d === "siradaki" ? ", sıradaki yarış" : "") + " — Yarış Haftası'nda aç") + "'>" +
           "<span class='st-ay-ust'><span class='st-ay-ad'>" + esc(ad) + "</span>" + (b.d === "siradaki" ? "<i class='st-ay-nokta' aria-hidden='true'></i>" : "") + "</span>" +
           "<span class='st-ay-alt'><span class='st-ay-tarih'>" + esc(tr) + "</span>" + (sprint ? "<span class='st-ay-spr'>SPR</span>" : "") + (gecmis && kaz ? "<span class='st-ay-kaz'>" + esc(kaz) + "</span>" : "") + "</span></button></li>";
  }
  function v2Html(bilgi) {
    var tumu = bilgi.map(function (b) { return b.y; });
    var filtre = V2_GRUPLAR.map(function (g) {
      return "<div class='st-v2-grup'><span class='st-v2-et'>" + g[1] + "</span><div class='st-v2-cipler' role='group' aria-label='" + g[1] + "'>" + g[2].map(function (c) {
        var akt = V2[g[0]] === c[0];
        return "<button type='button' class='st-v2-cip" + (akt ? " aktif" : "") + "' data-v2='" + g[0] + ":" + c[0] + "' aria-pressed='" + akt + "'>" + c[1] + "</button>";
      }).join("") + "</div></div>";
    }).join("");
    var secili = bilgi.filter(v2Gecer), aylar = {}, sira = [];
    secili.forEach(function (b) { var a = yerelTarih(zaman(b.y.date, b.y.time)).a; if (!aylar[a]) { aylar[a] = []; sira.push(a); } aylar[a].push(b); });
    sira.sort(function (x, y) { return x - y; });
    var kolonlar = sira.map(function (a) {
      return "<section class='st-ay' data-ay='" + a + "'><h4 class='st-ay-bas'>" + AY_UZUN[a - 1] + "</h4><ul class='st-ay-liste'>" + aylar[a].map(function (b) { return v2Kart(b, tumu); }).join("") + "</ul></section>";
    }).join("");
    return "<div class='st-v2-filtre'>" + filtre + "</div>" +
           (secili.length ? "<div class='st-ay-sar'><div class='st-ay-izgara'>" + kolonlar + "</div></div>" : "<p class='st-not'>Bu filtreye uyan yarış yok.</p>") +
           "<p class='st-v2-not'>" + secili.length + " / " + bilgi.length + " yarış · tarihler Türkiye saatiyle · karta dokununca Yarış Haftası açılır</p>";
  }
  // Mevcut Yarış Haftası seçimini kullanır (yeni yönlendirme yok): sekmeyi açar, mevcut tur seçicisini ilgili tura getirir
  function haftayaGit(tur) {
    if (typeof window.sekmeAc === "function") { try { window.sekmeAc("hafta"); } catch (x) { return; } }
    var dene = 0;
    (function sec() {
      var el = document.querySelector("#sekme-hafta select[data-act='sec']");
      if (el) { if (String(el.value) !== String(tur)) { el.value = String(tur); el.dispatchEvent(new Event("change", { bubbles: true })); } return; }
      if (dene++ < 25) { setTimeout(sec, 120); }
    })();
  }
  function bilgiHesapla() {
    var m = S.model, simdi = Date.now();
    var sir = HV.varsayilanTur(m.yarislar, simdi);
    var siradakiTur = sir && zaman(sir.date, sir.time).getTime() + 6 * 3600 * 1000 > simdi ? Number(sir.round) : -1;
    return { simdi: simdi, bilgi: m.yarislar.map(function (y) { var t = m.turlar[Number(y.round)]; return { y: y, d: durumu(y, simdi, siradakiTur, t), t: t }; }) };
  }
  function v2Yenile() {
    var k = document.getElementById("st-v2-kap"); if (!k || !S.model) { return; }
    k.innerHTML = v2Html(bilgiHesapla().bilgi);
  }

  function ciz() {
    var kap = document.getElementById("a2-takvim");
    var m = S.model;
    if (!kap || !m) { return; }
    var simdi = Date.now();
    var sir = HV.varsayilanTur(m.yarislar, simdi);
    var siradakiTur = sir && zaman(sir.date, sir.time).getTime() + 6 * 3600 * 1000 > simdi ? Number(sir.round) : -1;
    var bilgi = m.yarislar.map(function (y) {
      var t = m.turlar[Number(y.round)];
      return { y: y, d: durumu(y, simdi, siradakiTur, t), t: t };
    });
    var secili = bilgi.filter(function (b) {
      if (S.filtre === "biten") { return b.d === "biten" || b.d === "bekleniyor"; }
      if (S.filtre === "gelecek") { return b.d === "gelecek" || b.d === "siradaki"; }
      if (S.filtre === "sprint") { return !!(b.y.Sprint && b.y.Sprint.date); }
      return true;
    });
    var cipler = FILTRELER.map(function (f) {
      return "<button type='button' class='st-cip" + (f[0] === S.filtre ? " aktif" : "") + "' data-filtre='" + f[0] + "' aria-pressed='" + (f[0] === S.filtre) + "'>" + f[1] + "</button>";
    }).join("");
    var uyari = m.hatalar.length ? "<p class='st-not'>Bazı sonuç bilgileri alınamadı; sayfa yeniden açılınca tekrar denenecek.</p>" : "";
    var hero = bilgi.filter(function (b) { return b.d === "siradaki"; })[0];
    var liste = secili.filter(function (b) { return b.d !== "siradaki"; });
    var onceki = document.getElementById("st-liste-ac"), listeAcik = !!(onceki && onceki.open);     // varsayılan KAPALI; yeniden çizimde kullanıcının seçimi korunur
    kap.innerHTML = (hero ? kartCiz(hero.y, hero.d, hero.t, simdi) : "") +
      "<div id='st-v2-kap' class='st-v2'>" + v2Html(bilgi) + "</div>" +
      "<details class='st-liste-kap' id='st-liste-ac'" + (listeAcik ? " open" : "") + "><summary class='st-liste-bas'><span>Ayrıntılı yarışlar</span></summary>" +
      "<div class='st-bar'><div class='st-cipler' role='group' aria-label='Takvim filtresi'>" + cipler + "</div><span class='st-ozet'>" + esc(ozet(m, simdi)) + "</span></div>" + uyari +
      "<div class='st-izgara'>" + (liste.length ? liste.map(function (b) { return kartCiz(b.y, b.d, b.t, simdi); }).join("") : "<p class='st-not'>Bu filtreye uyan yarış yok.</p>") + "</div></details>";
    document.getElementById("sekme-sezon").setAttribute("data-a2", "1");
    sayacBaslat();
  }

  function sayacBaslat() {
    clearInterval(S.sayac);
    var el = document.getElementById("a2-sayac");
    if (!el) { return; }
    function guncelle() {
      var e = document.getElementById("a2-sayac");
      if (!e) { clearInterval(S.sayac); return; }
      var sezon = document.getElementById("sekme-sezon");
      if (sezon && sezon.hidden) { return; }
      var fark = Math.floor((Number(e.getAttribute("data-bas")) - Date.now()) / 1000);
      if (fark < 0) { e.textContent = "Yarış günü"; return; }
      var gun = Math.floor(fark / 86400); fark %= 86400;
      var saat = Math.floor(fark / 3600); fark %= 3600;
      var dk = Math.floor(fark / 60), sn = fark % 60, kutu = e.querySelectorAll("[data-u]");
      if (kutu.length === 4) {                                   // prototip: 4 ayrı sayaç kutusu (aynı hesap, farklı gösterim)
        var v = { gun: gun, saat: saat, dk: dk, sn: sn };
        for (var i = 0; i < 4; i++) { var u = kutu[i].getAttribute("data-u"), t = (u === "gun" ? String(v[u]) : (v[u] < 10 ? "0" : "") + v[u]); if (kutu[i].textContent !== t) { kutu[i].textContent = t; } }
        e.setAttribute("aria-label", "Yarışa kalan süre: " + gun + " gün " + saat + " saat " + dk + " dakika");
        return;
      }
      e.textContent = gun + " gün " + saat + " sa " + dk + " dk " + sn + " sn";
    }
    guncelle();
    S.sayac = setInterval(guncelle, 1000);
  }

  function olaylar() {
    var kap = document.getElementById("a2-takvim");
    try {                                                        // arama sonucu kartı vurgularken (ar-vurgu) kapalı accordion'u aç
      new MutationObserver(function (ml) {
        ml.forEach(function (r) {
          var t = r.target, d = t.closest ? t.closest("details.st-liste-kap") : null;
          if (d && !d.open && t.classList.contains("ar-vurgu")) { d.open = true; try { t.scrollIntoView({ block: "center" }); } catch (x) { /* önemsiz */ } }
        });
      }).observe(kap, { attributes: true, attributeFilter: ["class"], subtree: true });
    } catch (x) { /* eski tarayıcı: accordion elle açılır */ }
    kap.addEventListener("click", function (e) {
      var d = e.target.closest ? e.target.closest("button") : null;
      if (!d) { return; }
      if (d.hasAttribute("data-v2")) { var kv = d.getAttribute("data-v2").split(":"); V2[kv[0]] = kv[1]; v2Yenile(); return; }
      if (d.hasAttribute("data-ay-tur")) { haftayaGit(d.getAttribute("data-ay-tur")); return; }
      if (d.hasAttribute("data-filtre")) { S.filtre = d.getAttribute("data-filtre"); filtreYaz(S.filtre); ciz(); return; }
      if (d.classList.contains("st-detay")) {
        var kutu = document.getElementById(d.getAttribute("aria-controls"));
        var acik = d.getAttribute("aria-expanded") === "true";
        d.setAttribute("aria-expanded", acik ? "false" : "true");
        if (kutu) { kutu.hidden = acik; }
        return;
      }
      if (d.getAttribute("data-git") === "hafta" && typeof window.sekmeAc === "function") { try { window.sekmeAc("hafta"); } catch (x) { /* önemsiz */ } }
    });
  }

  // Eski bölüm (puan tabloları) yüklenirken ek ağ yükü bindirmemek için standings bitince başlar (en çok 8 sn bekler)
  function eskiYuklemeyiBekle() {
    return new Promise(function (coz) {
      var n = 0;
      (function dene() {
        var t = document.querySelector("#takim-govde td.sezon");
        if (t || n++ > 26) { coz(); } else { setTimeout(dene, 300); }
      })();
    });
  }

  async function yukle() {
    if (S.yukleniyor) { return; }
    S.yukleniyor = true;
    var kap = document.getElementById("a2-takvim");
    try {
      if (!S.model && kap) { kap.innerHTML = "<p class='st-not'>Takvim kartları yükleniyor…</p>"; }
      await eskiYuklemeyiBekle();
      S.model = await SV.yukle(sezonYili());
      ciz();
    } catch (h) {
      // Yedek: eski takvim tablosu görünür kalır
      if (!S.model) { document.getElementById("sekme-sezon").removeAttribute("data-a2"); if (kap) { kap.innerHTML = ""; } }
    } finally { S.yukleniyor = false; }
  }

  function ac() { try { if (S.model) { ciz(); } yukle(); } catch (e) { /* kartlar olmadan devam */ } }

  function baslat() {
    var kap = document.getElementById("a2-takvim");
    var btn = document.getElementById("btn-sezon");
    if (!kap || !btn || !F || !HV || !SV) { return; }       // eksik dosya: eski takvim görünür kalır
    S.filtre = filtreOku();
    olaylar();
    btn.addEventListener("click", ac);
    // v3.0.0: yeni nav (varsayılan) açılışı BUGÜN; SEZON sekmesine geçişte eski #btn-sezon tıklaması olmaz → takvim kartları ilk açılışta (yalnız henüz yüklenmediyse) bu olayla kurulur. Yeni fetch/zamanlayıcı yok.
    document.addEventListener("f1-sekme", function (e) { if (e.detail === "sezon" && !S.model && !S.yukleniyor) { ac(); } });
    var sezon = document.getElementById("sekme-sezon");
    if (sezon && !sezon.hidden) { ac(); }
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", baslat); } else { baslat(); }
  window.SezonTakvim = { ac: ac, _durum: S, pistGorunen: pistGorunen, sehirGorunen: sehirGorunen };   // ortak insan okunur pist adı (Yarış Analizi hero da kullanır)
})();
