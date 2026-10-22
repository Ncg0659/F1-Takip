/* A5.1 — Pist Profili: SAF HESAP KATMANI (DOM yok, ağ yok, depolama yok; Node'da test edilir).
   Girdi: statik pist kaydı (ICERIK_PISTLER), A3.4a sınıfı (PIST_SINIFLANDIRMA), takvim (Jolpica yarış kayıtları) ve ÖNBELLEKTEKİ sezon sonuçları.
   Hiçbir şey hesaplanıp uydurulmaz: yeni sınıflandırma, yorum, tahmin yoktur. Eksik alan çıktıda hiç yer almaz (arayüz çizmez).
   Grand Prix adı, tarih, tur numarası, Sprint ve sonuçlar YALNIZCA dinamik veriden gelir. */
(function (kok) {
  "use strict";

  var YARIS_SURESI_MS = 3 * 3600 * 1000;     // sezon-veri.js ile aynı: yarış başlangıcından 3 sa sonra "bitti" sayılır

  function say(n, ond) { return Number(n).toFixed(ond).replace(".", ","); }
  function zaman(y) { var t = Date.parse(y.date + "T" + (y.time || "12:00:00Z")); return isNaN(t) ? null : t; }

  // Takvimde bu pistin yarışı (aynı sezon takvimi). Birden fazla varsa ilk.
  function yarisBul(takvim, id) {
    for (var i = 0; i < (takvim || []).length; i++) { var y = takvim[i]; if (y && y.Circuit && y.Circuit.circuitId === id) { return y; } }
    return null;
  }

  function kayit(r) { return r ? { k: r.k, a: r.a, t: r.t } : null; }
  function turdan(o, tur) { return o && o.turlar && o.turlar[tur] ? o.turlar[tur] : null; }

  // sonuc: { s1, s2, s3, sprint, pole, poleTek }  (hepsi JolpicaIstemci önbelleğinden okunmuş veri; yoksa null)
  function sezonBlogu(y, sonuc, simdi, takvimVar) {
    if (!y) { return takvimVar ? { takvimde: false } : null; }
    var tur = Number(y.round), t0 = zaman(y), sprintMi = !!(y.Sprint && y.Sprint.date);
    var b = { takvimde: true, tur: tur, gpAd: y.raceName || "", tarih: t0, sprintMi: sprintMi, durum: "yaklasan", sonuc: null };
    if (t0 != null && t0 + YARIS_SURESI_MS < simdi) {
      b.durum = "biten";
      var s = sonuc || {}, kaz = turdan(s.s1, tur), p2 = turdan(s.s2, tur), p3 = turdan(s.s3, tur);
      var pole = turdan(s.pole, tur) || (s.poleTek && s.poleTek.pole ? s.poleTek.pole : null);
      var spr = sprintMi ? turdan(s.sprint, tur) : null;
      if (kaz) { b.sonuc = { kazanan: kayit(kaz), p2: kayit(p2), p3: kayit(p3), pole: kayit(pole), sprint: kayit(spr) }; }
    }
    return b;
  }

  function teknik(st) {
    var o = [];
    if (!st) { return o; }
    if (st.uzunlukKm != null) { o.push({ k: "uzunluk", ad: "Pist uzunluğu", deger: say(st.uzunlukKm, 3) + " km" }); }
    if (st.turSayisi != null) { o.push({ k: "tur", ad: "Yarış tur sayısı", deger: String(st.turSayisi) }); }
    if (st.yarisMesafesiKm != null) { o.push({ k: "mesafe", ad: "Yarış mesafesi", deger: say(st.yarisMesafesiKm, 3) + " km" }); }
    if (st.ilkGp != null) { o.push({ k: "ilkgp", ad: "İlk F1 Grand Prix", deger: String(st.ilkGp) }); }
    if (st.virajSayisi != null) { o.push({ k: "viraj", ad: "Viraj sayısı", deger: String(st.virajSayisi) }); }
    if (st.fizikselTur) { o.push({ k: "tip", ad: "Fiziksel pist tipi", deger: st.fizikselTur }); }
    return o;
  }

  // g: { id, statik, sinif (A3.4a kaydı ya da null), kategoriler, takvim, sonuc, simdi, yedekAd }
  function model(g) {
    var id = g.id, st = g.statik || null, y = yarisBul(g.takvim, id);
    var takvimVar = !!(g.takvim && g.takvim.length);
    var C = y && y.Circuit ? y.Circuit : {}, L = C.Location || {};
    var ad = C.circuitName || (g.sinif && g.sinif.ad) || g.yedekAd || null;
    if (!ad && !st && !y) { return null; }                    // tamamen tanınmayan kimlik
    var m = {
      id: id,
      kimlik: { ad: ad || id, sehir: (st && st.sehir) || L.locality || null, ulke: (st && st.ulke) || L.country || null, gpAd: y ? (y.raceName || null) : null },
      teknik: teknik(st),
      rekor: st && st.turRekoru ? { pilot: st.turRekoru.pilot, sure: st.turRekoru.sure, yil: st.turRekoru.yil, dogrulama: st.turRekoru.dogrulama } : null,
      sezon: sezonBlogu(y, g.sonuc, g.simdi == null ? Date.now() : g.simdi, takvimVar),
      sinif: null,
      tarihce: st && st.tarihce ? st.tarihce.slice(0, 5) : [],
      statikVar: !!st
    };
    if (g.sinif && g.kategoriler && g.kategoriler[g.sinif.kategori]) {
      m.sinif = { kategori: g.sinif.kategori, ad: g.kategoriler[g.sinif.kategori].ad, gerekce: g.sinif.gerekce || "", tartisma: !!g.sinif.tartisma };
    }
    return m;
  }

  // Kısa, olgusal gerekçe: A3.4a metninin "TARTIŞMALI:" önekini ayırır, iki cümleden uzunsa ilk cümleyi alır
  function kisaGerekce(s) {
    if (!s) { return ""; }
    s = String(s).replace(/^TARTIŞMALI:\s*/i, "");
    var i = s.indexOf(". ");
    return i > 0 ? s.slice(0, i + 1) : s;
  }

  var API = { model: model, yarisBul: yarisBul, teknik: teknik, kisaGerekce: kisaGerekce, say: say, YARIS_SURESI_MS: YARIS_SURESI_MS };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
  if (kok) { kok.PistHesap = API; }
})(typeof window !== "undefined" ? window : null);
