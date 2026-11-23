/* KAYNAK DURUMU — Jolpica (takvim / sonuç / puan) erişilemezken uygulama sonsuz "YÜKLENİYOR"da kalmasın (3.0.10).
   • Jolpica'ya giden her fetch'e ~10 sn zaman aşımı (mevcut fetch/önbellek mimarisi değişmez; yalnız api.jolpi.ca adresleri).
   • Zaman aşımı / ağ hatası / 5xx → durum "erisilemez"; ardından 20 sn boyunca yeni Jolpica istekleri BEKLEMEDEN hata verir
     (kuyruktaki her istek ayrı ayrı 10 sn beklemesin). Başarılı bir yanıt durumu "tamam"a döndürür.
   • YENİDEN DENE: kısa devreyi sıfırlar ve "f1-kaynak-yeniden" olayını yayar; ekranlar kendi yükleyicisini yeniden başlatır (sayfa yenilenmez).
     Deneme sürerken tekrar tıklamak yeni istek üretmez.
   • Kullanıcıya teknik hata (HTTP / CORS / timeout) metni gösterilmez. Eski veri güncelmiş gibi gösterilmez.
   • Yeni veri kaynağı yok; OpenF1 / Open-Meteo / Bluesky istekleri etkilenmez. */
(function (kok) {
  "use strict";
  var ZAMAN_ASIMI_MS = 10000, KISA_DEVRE_MS = 20000, DENEME_EN_COK_MS = 12000;
  var HEDEF = /^https?:\/\/api\.jolpi\.ca\//;
  var S = { durum: "bilinmiyor", sonHata: 0, kapaliBitis: 0, deneniyor: false, denemeT: 0, istek: 0, yeniden: 0 };
  var asil = kok.fetch ? kok.fetch.bind(kok) : null;

  function yay() {
    try { document.dispatchEvent(new CustomEvent("f1-kaynak-durum", { detail: { durum: S.durum, deneniyor: S.deneniyor } })); } catch (e) { /* önemsiz */ }
    kartlariGuncelle();
  }
  function ayarla(d) {
    var eski = S.durum, eskiD = S.deneniyor;
    S.durum = d;
    if (d === "erisilemez") { S.sonHata = Date.now(); S.kapaliBitis = Date.now() + KISA_DEVRE_MS; }
    else { S.kapaliBitis = 0; }
    S.deneniyor = false;
    if (eski !== d || eskiD) { yay(); }
  }
  function kaynakHatasi(mesaj) { var e = new Error(mesaj); e.name = "KaynakErisilemez"; e.kaynak = true; return e; }

  function sarili(girdi, ayar) {
    var url = typeof girdi === "string" ? girdi : (girdi && girdi.url) || "";
    if (!HEDEF.test(url)) { return asil(girdi, ayar); }
    S.istek++;
    if (S.kapaliBitis && Date.now() < S.kapaliBitis && !S.deneniyor) { return Promise.reject(kaynakHatasi("kısa devre")); }
    var ac = typeof AbortController === "function" ? new AbortController() : null, a = ayar ? Object.assign({}, ayar) : {};
    var dis = a.signal;
    if (ac) {
      if (dis) { if (dis.aborted) { ac.abort(); } else { dis.addEventListener("abort", function () { ac.abort(); }); } }
      a.signal = ac.signal;
    }
    var bitti = false, zaman;
    var zamanAsimi = new Promise(function (_, red) {
      zaman = setTimeout(function () { if (bitti) { return; } bitti = true; if (ac) { try { ac.abort(); } catch (e) { /* önemsiz */ } } ayarla("erisilemez"); red(kaynakHatasi("zaman aşımı")); }, ZAMAN_ASIMI_MS);
    });
    var istek = asil(girdi, a).then(function (r) {
      if (bitti) { return r; }
      bitti = true; clearTimeout(zaman);
      if (r && r.status >= 500) { ayarla("erisilemez"); } else { ayarla("tamam"); }
      return r;
    }, function (e) {
      if (bitti) { throw kaynakHatasi("zaman aşımı"); }
      bitti = true; clearTimeout(zaman);
      if (dis && dis.aborted) { throw e; }                       // çağıranın kendi iptali: kaynak hatası sayılmaz
      ayarla("erisilemez"); throw kaynakHatasi("ağ hatası");
    });
    return Promise.race([istek, zamanAsimi]);
  }
  if (asil) { kok.fetch = sarili; }

  function yenidenDene() {
    if (S.deneniyor && Date.now() - S.denemeT < DENEME_EN_COK_MS) { return false; }   // art arda tıklama: yeni istek yok
    S.deneniyor = true; S.denemeT = Date.now(); S.kapaliBitis = 0; S.yeniden++;
    yay();
    try { document.dispatchEvent(new CustomEvent("f1-kaynak-yeniden")); } catch (e) { /* önemsiz */ }
    setTimeout(function () { if (S.deneniyor && Date.now() - S.denemeT >= DENEME_EN_COK_MS - 50) { S.deneniyor = false; yay(); } }, DENEME_EN_COK_MS);
    return true;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }
  // Sade kart (teknik metin yok). ek: ekran başına kısa not (isteğe bağlı).
  function kart(ek) {
    return "<section class='kaynak-hata' role='alert' data-kaynak-kart>" +
      "<p class='kaynak-hata-b'>VERİ KAYNAĞINA ULAŞILAMIYOR</p>" +
      "<p class='kaynak-hata-a'>Formula 1 verileri şu anda alınamıyor. Biraz sonra tekrar deneyebilirsin." + (ek ? " " + esc(ek) : "") + "</p>" +
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
  function hataMi(e) { return !!(e && (e.kaynak || e.name === "KaynakErisilemez")) || S.durum === "erisilemez"; }
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
    durum: function () { return S.durum; }, erisilemez: function () { return S.durum === "erisilemez"; }, deneniyor: function () { return S.deneniyor; },
    yenidenDene: yenidenDene, kart: kart, hataMi: hataMi, sonGuncelleme: sonGuncelleme,
    _durum: S, ZAMAN_ASIMI_MS: ZAMAN_ASIMI_MS
  };
})(window);
