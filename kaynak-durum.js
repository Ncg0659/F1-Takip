/* KAYNAK DURUMU + MERKEZİ JOLPICA KUYRUĞU (3.0.10 → 3.3.0)
   Uygulamadaki TÜM api.jolpi.ca istekleri (index.html jsonAl, JolpicaIstemci, detay paneli, tahmin ekranı…) bu sarmalayıcıdan geçer; çağıran modüller değişmez.
   • Tek kuyruk: istek başlangıçları arasında en az 350 ms (≈2,9 istek/sn; resmî sınır 4/sn), aynı anda en çok 2 istek. Son 1 saatte 300'ü aşan
     istek sayısında aralık 1 sn'ye çıkar (resmî sınır 500/saat). Sayaç cihazda tutulur (yeniden açılışlar da sayılır).
   • Aynı adres için eşzamanlı istekler TEK ağ isteğinde birleşir; dolu (boş olmayan) 200 yanıtları 15 sn boyunca ekranlar arasında paylaşılır.
     Boş yanıt (sonuç henüz yayımlanmadı) paylaşılmaz/önbelleğe girmez → sonuç gelince hemen görülür.
   • Hata türleri ayrı: "429" (istek sınırı) · "zaman-asimi" · "baglanti" (ağ/CORS) · "sunucu" (5xx). Gerçekten boş veri hata DEĞİLDİR (çağıran ekran yönetir).
   • 429: Retry-After okunabiliyorsa ona uyulur (en çok 60 sn), yoksa 2 → 4 → 8 sn artan bekleme; bekleme süresince kuyruğun tamamı durur. En çok 3 yeniden deneme.
     Ağ/CORS hatası (sınır aşımında sunucu CORS başlığı göndermeyebilir): çevrimiçiyken 2 yeniden deneme (3 → 6 sn). Zaman aşımı: yeniden deneme YOK (sonsuz bekleme olmasın).
   • Denemeler bitince durum "erisilemez" (429'da "yogun"); 20 sn kısa devre (kuyruktaki her istek ayrı ayrı beklemesin).
     Otomatik kurtarma: sekme görünürken en çok 2 kez (10 dk içinde) kendiliğinden YENİDEN DENE; sonra yalnız elle. Sonsuz retry yok.
   • YENİDEN DENE: kısa devreyi sıfırlar ve "f1-kaynak-yeniden" olayını yayar; ekranlar kendi yükleyicisini yeniden başlatır (sayfa yenilenmez).
   • Kullanıcıya teknik hata (HTTP / CORS / timeout) metni gösterilmez. Eski veri güncelmiş gibi gösterilmez.
   • OpenF1 / Open-Meteo / Bluesky istekleri etkilenmez. */
(function (kok) {
  "use strict";
  var ZAMAN_ASIMI_MS = 10000, KISA_DEVRE_MS = 20000, DENEME_EN_COK_MS = 12000;
  var ARALIK_MS = 350, ARALIK_YAVAS_MS = 1000, ESZAMANLI = 2, SAAT_ESIK = 300, PAYLAS_MS = 15000;
  var R429_EN_COK = 3, AG_EN_COK = 2, RETRY_AFTER_TAVAN_MS = 60000;
  var OTO_EN_COK = 2, OTO_PENCERE_MS = 10 * 60000, OTO_GECIKME_MS = 25000;
  var SAYAC_ANAHTAR = "f1-jolpica-saat-v1";
  var HEDEF = /^https?:\/\/api\.jolpi\.ca\//;
  var S = { durum: "bilinmiyor", tur: null, sonHata: 0, kapaliBitis: 0, deneniyor: false, denemeT: 0, istek: 0, yeniden: 0,
            ag: 0, birlesen: 0, paylasilan: 0, r429: 0, yenidenDeneme: 0, bekleBitis: 0, aktif: 0, sonBaslangic: 0, oto: [], otoZaman: null };
  var asil = kok.fetch ? kok.fetch.bind(kok) : null;
  var bekleyen = [], ucusta = {}, paylas = {};
  kok.__jolpicaZaman = [];                                 // ölçüm: istek başlangıç zamanları (yalnız sayı/zaman; içerik yok)

  function yay() {
    try { document.dispatchEvent(new CustomEvent("f1-kaynak-durum", { detail: { durum: S.durum, tur: S.tur, deneniyor: S.deneniyor } })); } catch (e) { /* önemsiz */ }
    kartlariGuncelle();
  }
  function ayarla(d, tur) {
    var eski = S.durum, eskiD = S.deneniyor, eskiT = S.tur;
    S.durum = d; S.tur = d === "tamam" ? null : (tur || S.tur);
    if (d === "erisilemez" || d === "yogun") { S.sonHata = Date.now(); S.kapaliBitis = Date.now() + KISA_DEVRE_MS; otoPlanla(); }
    else { S.kapaliBitis = 0; }
    S.deneniyor = false;
    if (eski !== d || eskiD || eskiT !== S.tur) { yay(); }
  }
  function kaynakHatasi(mesaj, tur) { var e = new Error(mesaj); e.name = "KaynakErisilemez"; e.kaynak = true; e.tur = tur || null; return e; }
  function bekle(ms) { return new Promise(function (c) { setTimeout(c, Math.max(0, ms)); }); }

  // ---------- Saatlik sayaç (cihazda) ----------
  function sayacOku() {
    try { var a = JSON.parse(localStorage.getItem(SAYAC_ANAHTAR) || "[]"); var s = Date.now() - 3600000; return Array.isArray(a) ? a.filter(function (t) { return t > s; }) : []; } catch (e) { return []; }
  }
  var saatlik = sayacOku();
  function sayacEkle(t) {
    saatlik.push(t); var s = t - 3600000; while (saatlik.length && saatlik[0] <= s) { saatlik.shift(); }
    try { localStorage.setItem(SAYAC_ANAHTAR, JSON.stringify(saatlik.slice(-600))); } catch (e) { /* dolu/engelli: yalnız bellekte */ }
  }
  function aralik() { return saatlik.length > SAAT_ESIK ? ARALIK_YAVAS_MS : ARALIK_MS; }

  // ---------- Kuyruk ----------
  function pompala() {
    if (!bekleyen.length) { return; }
    var n = Date.now();
    if (S.aktif >= ESZAMANLI) { return; }
    var gecikme = Math.max(S.bekleBitis - n, S.sonBaslangic + aralik() - n);
    if (gecikme > 0) { if (!pompala.z) { pompala.z = setTimeout(function () { pompala.z = null; pompala(); }, gecikme); } return; }
    var is = bekleyen.shift();
    S.aktif++; S.sonBaslangic = n; sayacEkle(n); kok.__jolpicaZaman.push(n); S.ag++;
    is.basla();
    if (bekleyen.length) { pompala(); }
  }
  function sira() {                                        // sıra gelince çözülen söz; çözülünce bir yuva (slot) ayrılmıştır
    return new Promise(function (c) { bekleyen.push({ basla: c }); pompala(); });
  }
  function birak() { S.aktif = Math.max(0, S.aktif - 1); pompala(); }

  // Tek ağ denemesi (zaman aşımı dahil). Dönüş: { r } ya da { hata, tur }
  function dene(girdi, ayar) {
    var ac = typeof AbortController === "function" ? new AbortController() : null, a = ayar ? Object.assign({}, ayar) : {};
    var dis = a.signal;
    if (ac) {
      if (dis) { if (dis.aborted) { ac.abort(); } else { dis.addEventListener("abort", function () { ac.abort(); }); } }
      a.signal = ac.signal;
    }
    return new Promise(function (coz) {
      var bitti = false;
      var zaman = setTimeout(function () { if (bitti) { return; } bitti = true; if (ac) { try { ac.abort(); } catch (e) { /* önemsiz */ } } coz({ tur: "zaman-asimi" }); }, ZAMAN_ASIMI_MS);
      asil(girdi, a).then(function (r) { if (bitti) { return; } bitti = true; clearTimeout(zaman); coz({ r: r }); },
        function (e) { if (bitti) { return; } bitti = true; clearTimeout(zaman); coz({ tur: dis && dis.aborted ? "iptal" : "baglanti", e: e }); });
    });
  }
  function retryAfter(r) {
    var h = null; try { h = r.headers && r.headers.get("Retry-After"); } catch (e) { h = null; }   // CORS ile açılmamışsa okunamaz → null
    if (!h) { return null; }
    var sn = Number(h); if (!isNaN(sn)) { return Math.min(RETRY_AFTER_TAVAN_MS, Math.max(0, sn * 1000)); }
    var t = Date.parse(h); return isNaN(t) ? null : Math.min(RETRY_AFTER_TAVAN_MS, Math.max(0, t - Date.now()));
  }
  function cevrimdisi() { try { return kok.navigator && kok.navigator.onLine === false; } catch (e) { return false; } }

  async function calistir(girdi, ayar) {
    var n429 = 0, nAg = 0;
    for (;;) {
      // Başka bir istek denemelerini bitirip kısa devreyi açtıysa sıradaki/bekleyen istekler de beklemeden hata verir (her biri ayrı ayrı 14 sn beklemesin)
      if (S.kapaliBitis && Date.now() < S.kapaliBitis && !S.deneniyor) { throw kaynakHatasi("kısa devre", S.tur); }
      await sira();
      if (S.kapaliBitis && Date.now() < S.kapaliBitis && !S.deneniyor) { birak(); throw kaynakHatasi("kısa devre", S.tur); }
      var s = await dene(girdi, ayar);
      birak();
      if (s.r && s.r.status === 429) {
        S.r429++;
        var ra = retryAfter(s.r), bek = ra != null ? ra : 2000 * Math.pow(2, n429);
        S.bekleBitis = Math.max(S.bekleBitis, Date.now() + bek);       // bekleme süresince kuyruk durur
        if (n429 < R429_EN_COK) { n429++; S.yenidenDeneme++; await bekle(bek); continue; }
        ayarla("yogun", "429"); throw kaynakHatasi("istek sınırı", "429");
      }
      if (s.r) {
        if (s.r.status >= 500) { ayarla("erisilemez", "sunucu"); } else { ayarla("tamam"); }
        return s.r;
      }
      if (s.tur === "iptal") { throw s.e || kaynakHatasi("iptal", "iptal"); }       // çağıranın kendi iptali: kaynak hatası sayılmaz
      if (s.tur === "baglanti" && !cevrimdisi() && nAg < AG_EN_COK) {
        nAg++; S.yenidenDeneme++; var b2 = 3000 * nAg; S.bekleBitis = Math.max(S.bekleBitis, Date.now() + b2); await bekle(b2); continue;
      }
      ayarla("erisilemez", s.tur); throw kaynakHatasi(s.tur === "zaman-asimi" ? "zaman aşımı" : "ağ hatası", s.tur);
    }
  }

  function bosMu(metin) { return /"(Races|StandingsLists|DriverTable|ConstructorTable)"\s*:\s*\[\s*\]/.test(metin) || /"total"\s*:\s*"0"/.test(metin); }
  function yanitYap(k) { return new Response(k.govde, { status: k.status, statusText: k.statusText, headers: { "Content-Type": k.tip || "application/json" } }); }

  function sarili(girdi, ayar) {
    var url = typeof girdi === "string" ? girdi : (girdi && girdi.url) || "";
    if (!HEDEF.test(url)) { return asil(girdi, ayar); }
    S.istek++;
    if (S.kapaliBitis && Date.now() < S.kapaliBitis && !S.deneniyor) { return Promise.reject(kaynakHatasi("kısa devre", S.tur)); }
    var yontem = ((ayar && ayar.method) || (girdi && girdi.method) || "GET").toUpperCase();
    var ortak = yontem === "GET" && !(ayar && ayar.signal);            // kendi iptali olan istek ayrı yürür
    if (!ortak) { return calistir(girdi, ayar); }
    var k = paylas[url];
    if (k && Date.now() - k.t < PAYLAS_MS) { S.paylasilan++; return Promise.resolve(yanitYap(k)); }
    if (ucusta[url]) { S.birlesen++; return ucusta[url].then(function (r) { return r.clone(); }); }
    var p = calistir(girdi, ayar).then(function (r) {
      if (r.status === 200) {
        r.clone().text().then(function (g) { if (!bosMu(g)) { paylas[url] = { t: Date.now(), govde: g, status: r.status, statusText: r.statusText, tip: r.headers.get("Content-Type") }; } }, function () { /* önemsiz */ });
      }
      return r;
    });
    ucusta[url] = p;
    var temizle = function () { if (ucusta[url] === p) { delete ucusta[url]; } };
    p.then(temizle, temizle);
    return p.then(function (r) { return r.clone(); });
  }
  if (asil) { kok.fetch = sarili; }

  // ---------- Otomatik kurtarma (sınırlı) ----------
  function gorunur() { try { return document.visibilityState !== "hidden"; } catch (e) { return true; } }
  function otoPlanla() {
    if (S.otoZaman) { return; }
    var n = Date.now(); S.oto = S.oto.filter(function (t) { return n - t < OTO_PENCERE_MS; });
    if (S.oto.length >= OTO_EN_COK) { return; }                          // hak bitti: yalnız elle YENİDEN DENE
    var gec = Math.max(OTO_GECIKME_MS, S.bekleBitis - n + 1000);
    S.otoZaman = setTimeout(function otoTik() {
      S.otoZaman = null;
      if (S.durum !== "erisilemez" && S.durum !== "yogun") { return; }   // bu arada düzeldi
      if (!gorunur()) { document.addEventListener("visibilitychange", function g() { if (gorunur()) { document.removeEventListener("visibilitychange", g); otoTik(); } }); return; }
      S.oto.push(Date.now()); yenidenDene();
    }, gec);
  }

  function yenidenDene() {
    if (S.deneniyor && Date.now() - S.denemeT < DENEME_EN_COK_MS) { return false; }   // art arda tıklama: yeni istek yok
    S.deneniyor = true; S.denemeT = Date.now(); S.kapaliBitis = 0; S.yeniden++;
    yay();
    try { document.dispatchEvent(new CustomEvent("f1-kaynak-yeniden")); } catch (e) { /* önemsiz */ }
    setTimeout(function () { if (S.deneniyor && Date.now() - S.denemeT >= DENEME_EN_COK_MS - 50) { S.deneniyor = false; yay(); } }, DENEME_EN_COK_MS);
    return true;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }
  // Sade kart (teknik metin yok). Hata türüne göre kısa açıklama. ek: ekran başına kısa not (isteğe bağlı).
  function kartMetni() {
    if (S.tur === "429") { return { b: "VERİ KAYNAĞI ŞU AN YOĞUN", a: "Formula 1 veri kaynağı kısa süreliğine istek kabul etmiyor. Birazdan kendiliğinden yeniden denenecek." }; }
    if (S.tur === "baglanti" && cevrimdisi()) { return { b: "İNTERNET BAĞLANTISI YOK", a: "Bağlantı gelince YENİDEN DENE'ye dokunabilirsin." }; }
    return { b: "VERİ KAYNAĞINA ULAŞILAMIYOR", a: "Formula 1 verileri şu anda alınamıyor. Biraz sonra tekrar deneyebilirsin." };
  }
  function kart(ek) {
    var m = kartMetni();
    return "<section class='kaynak-hata' role='alert' data-kaynak-kart data-kaynak-tur='" + esc(S.tur || "") + "'>" +
      "<p class='kaynak-hata-b'>" + m.b + "</p>" +
      "<p class='kaynak-hata-a'>" + m.a + (ek ? " " + esc(ek) : "") + "</p>" +
      "<button type='button' class='kaynak-hata-d' data-kaynak-yeniden" + (S.deneniyor ? " disabled aria-busy='true'" : "") + ">" + (S.deneniyor ? "DENENİYOR…" : "YENİDEN DENE") + "</button></section>";
  }
  function kartlariGuncelle() {
    try {
      var l = document.querySelectorAll("[data-kaynak-yeniden]");
      for (var i = 0; i < l.length; i++) {
        l[i].disabled = !!S.deneniyor; l[i].textContent = S.deneniyor ? "DENENİYOR…" : "YENİDEN DENE";
        if (S.deneniyor) { l[i].setAttribute("aria-busy", "true"); } else { l[i].removeAttribute("aria-busy"); }
      }
    } catch (e) { /* önemsiz */ }
  }
  // Bir hatanın kaynak erişim hatası olup olmadığı (ekranlar teknik metin yerine kartı seçsin diye)
  function hataMi(e) { return !!(e && (e.kaynak || e.name === "KaynakErisilemez")) || S.durum === "erisilemez" || S.durum === "yogun"; }
  function sonGuncelleme(t) {
    if (!t) { return ""; }
    try { return new Date(t).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; }
  }

  if (typeof document !== "undefined") {
    document.addEventListener("click", function (e) {
      var b = e.target && e.target.closest && e.target.closest("[data-kaynak-yeniden]");
      if (!b) { return; }
      e.preventDefault(); yenidenDene();
    });
  }
  kok.KaynakDurum = {
    durum: function () { return S.durum; }, tur: function () { return S.tur; },
    erisilemez: function () { return S.durum === "erisilemez" || S.durum === "yogun"; }, deneniyor: function () { return S.deneniyor; },
    yenidenDene: yenidenDene, kart: kart, hataMi: hataMi, sonGuncelleme: sonGuncelleme,
    istatistik: function () { return { cagri: S.istek, ag: S.ag, birlesen: S.birlesen, paylasilan: S.paylasilan, r429: S.r429, yenidenDeneme: S.yenidenDeneme, sonSaat: saatlik.length, bekleyen: bekleyen.length }; },
    _durum: S, ZAMAN_ASIMI_MS: ZAMAN_ASIMI_MS
  };
})(window);
