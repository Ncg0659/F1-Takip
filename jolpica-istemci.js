/* Yarış Haftası için bağımsız Jolpica istemcisi.
   index.html'deki jsonAl() fonksiyonuna dokunmaz. Tek sıralı kuyruk + 429 yeniden deneme + localStorage önbelleği.
   Önbellek anahtarı öneki: f1-hafta-v1- */
(function () {
  var TABAN = "https://api.jolpi.ca/ergast/";
  var ONEK = "f1-hafta-v1-";
  var ARALIK_MS = 400;
  var kuyruk = Promise.resolve();
  var sonCagri = 0;

  function bekle(ms) { return new Promise(function (c) { setTimeout(c, ms); }); }

  function oku(anahtar) {
    try { var h = localStorage.getItem(ONEK + anahtar); return h ? JSON.parse(h) : null; } catch (e) { return null; }
  }
  function yaz(anahtar, deger) {
    try { localStorage.setItem(ONEK + anahtar, JSON.stringify(deger)); } catch (e) { /* dolu/engelli: önbelleksiz devam */ }
  }

  async function ham(yol) {
    for (var deneme = 0; deneme < 4; deneme++) {
      var fark = Date.now() - sonCagri;
      if (fark < ARALIK_MS) { await bekle(ARALIK_MS - fark); }
      sonCagri = Date.now();
      var cevap;
      try { cevap = await fetch(TABAN + yol); }
      catch (e) { if (deneme === 3) { throw new Error(yol + " -> ağ hatası"); } await bekle(1500 * (deneme + 1)); continue; }
      if (cevap.status === 429) { await bekle(2000 * (deneme + 1)); continue; }
      if (!cevap.ok) { throw new Error(yol + " -> sunucu cevabı: " + cevap.status); }
      return (await cevap.json()).MRData;
    }
    throw new Error(yol + " -> istek sınırı (429)");
  }

  // Tüm çağrılar tek kuyruktan geçer
  function sirali(yol) {
    var is = kuyruk.then(function () { return ham(yol); });
    kuyruk = is.catch(function () {});
    return is;
  }

  // opsiyon: { onbellek: "anahtar", omurMs: sayı (yoksa kalıcı) }
  // Hata olursa ve önbellek varsa eski veri { veri, eski: true } olarak döner.
  async function al(yol, opsiyon) {
    var o = opsiyon || {};
    var kayit = o.onbellek ? oku(o.onbellek) : null;
    if (kayit && (!o.omurMs || Date.now() - kayit.t < o.omurMs)) { return { veri: kayit.veri, eski: false, onbellekten: true }; }
    try {
      var veri = await sirali(yol);
      if (o.onbellek && (!o.kaydetKosul || o.kaydetKosul(veri))) { yaz(o.onbellek, { t: Date.now(), veri: veri }); }
      return { veri: veri, eski: false, onbellekten: false };
    } catch (hata) {
      if (kayit) { return { veri: kayit.veri, eski: true, onbellekten: true }; }
      throw hata;
    }
  }

  function kaydet(anahtar, veri) { yaz(anahtar, { t: Date.now(), veri: veri }); }

  window.JolpicaIstemci = { al: al, kaydet: kaydet, oku: oku, yaz: yaz, ONEK: ONEK };
})();
