/* A3.4a — Pist türüne göre pilot ve takım performansı. SAF fonksiyonlar: ağ yok, DOM yok.
   Girdi: A3.1 modeli + { <tur>: circuitId } haritası (takvimden) + pist sınıflandırması (pist-siniflandirma.js).
   KURALLAR:
   - Yalnızca ANA YARIŞ sonuçları (sprint ve sprint puanı hariç). Puan = o yarışlarda alınan ana yarış puanı.
   - Her tur tek bir ana kategoriye girer; sınıflandırması olmayan / circuitId'si bilinmeyen tur HİÇBİR kategoriye girmez ve ayrıca listelenir.
   - Pilot başına metrikler A3.3 (hesapla().pilot[id].gp) kurallarıyla BİREBİR aynıdır; A3.3 de durum ve ortalama kurallarını A3.2'den alır:
     yarış sayısı = başlanan yarış (DNS hariç), Ort. Bitiş = sınıflandırılmış ∧ grid>0 örneklemi, DNF/DNS/DSQ A3.2 durum kuralı.
   - Kategori başına ortalama puan = kategori puanı / o kategoride başlanan yarış sayısı (0 yarış ise null).
   - Pilot driverId (p) ile izlenir; takım değişikliği pilotun kategori istatistiğini bölmez.
   - Takım: satırın kendi takım kimliği (t) kullanılır (takım değiştiren pilotun puanı o turdaki takımına yazılır). Takım yarış sayısı =
     takımın o kategoride en az bir (DNS olmayan) satırı olan tur sayısı; ortalama = takım puanı / bu tur sayısı.
   - "En yüksek puan ortalaması": yarışı olan kategoriler arasında en yüksek puan/yarış; eşitlik varsa hepsi listelenir (yorum/sebep yok).
   - Sınıflandırma dosyasındaki EK pist tanımları (takvimde olmayan) hiçbir hesaba girmez: yalnızca takvimden gelen tur → circuitId eşleşmesi kullanılır. */
(function (kok) {
  "use strict";
  var isNode = typeof module !== "undefined" && module.exports;
  var HA = isNode ? require("./sezon-hesap-a32.js") : (kok && kok.SezonHesapA32);
  var H33 = isNode ? require("./sezon-hesap-a33.js") : (kok && kok.SezonHesapA33);
  var PS = isNode ? require("./pist-siniflandirma.js") : (kok && kok.PIST_SINIFLANDIRMA);
  var KUCUK = 3;     // bir kategori bu sayıdan az yarış içeriyorsa "küçük örneklem"

  function sayi(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function yuvarla1(x) { return Math.round(x * 10) / 10; }

  function altModel(model, turlar) {
    var t = {};
    turlar.forEach(function (n) { var s = model.turlar[n]; t[n] = { n: s.n, ad: s.ad, sprintMi: false, yaris: s.yaris, sprint: [] }; });
    return { sezon: model.sezon, turlar: t, pilotlar: model.pilotlar, takimlar: model.takimlar };
  }

  function hesapla(model, turPist, sinif) {
    sinif = sinif || PS;
    var harita = sinif.harita(), SIRA = sinif.SIRA;
    var turlar = HA.yarisTurlari(model), kat = {}, sinifsiz = [], turKat = {};
    SIRA.forEach(function (k) { kat[k] = []; });
    turlar.forEach(function (n) {
      var pid = turPist ? turPist[n] : null, p = pid ? harita[pid] : null;
      if (p) { kat[p.kategori].push(n); turKat[n] = p.kategori; }
      else { turKat[n] = null; sinifsiz.push({ tur: n, ad: model.turlar[n].ad, pistId: pid || null }); }
    });
    var cikti = { siralama: SIRA, tur: turKat, turlar: kat, sinifsiz: sinifsiz, yarisSayisi: {}, pilot: {}, takim: {}, kucuk: KUCUK };
    SIRA.forEach(function (k) { cikti.yarisSayisi[k] = kat[k].length; });

    SIRA.forEach(function (k) {
      if (!kat[k].length) { return; }
      var sm = altModel(model, kat[k]), h = H33.hesapla(sm), id;
      for (id in h.pilot) {
        var g = h.pilot[id].gp;
        if (!g.basladi && !g.dns && !g.dnf && !g.dsq && !g.puan && !g.diger) { continue; }   // bu kategoride hiç satırı yok
        var P = cikti.pilot[id] || (cikti.pilot[id] = {});
        P[k] = { yaris: g.basladi, puan: g.puan, ortPuan: g.basladi ? yuvarla1(g.puan / g.basladi) : null, ortBitis: g.ortBitis, n: g.n,
                 galibiyet: g.galibiyet, podyum: g.podyum, dnf: g.dnf, dns: g.dns, dsq: g.dsq, diger: g.diger, kucuk: g.basladi < KUCUK };
      }
      // takım: satırın takımı; tekil tur başına en fazla bir kez sayılan yarış
      kat[k].forEach(function (n) {
        var gor = {};
        model.turlar[n].yaris.forEach(function (r) {
          var T = cikti.takim[r.t] || (cikti.takim[r.t] = {});
          var Tk = T[k] || (T[k] = { puan: 0, yaris: 0, ortPuan: null, galibiyet: 0, podyum: 0, kucuk: true });
          var d = HA.durum(r);
          Tk.puan += sayi(r.n);
          if (d === "SIN") { var s = sayi(r.s); if (s === 1) { Tk.galibiyet++; } if (s >= 1 && s <= 3) { Tk.podyum++; } }
          if (d !== "DNS" && !gor[r.t]) { gor[r.t] = true; Tk.yaris++; }
        });
      });
    });
    Object.keys(cikti.takim).forEach(function (t) {
      SIRA.forEach(function (k) {
        var x = cikti.takim[t][k]; if (!x) { return; }
        x.ortPuan = x.yaris ? yuvarla1(x.puan / x.yaris) : null; x.kucuk = x.yaris < KUCUK;
      });
    });
    return cikti;
  }

  // En yüksek puan ortalaması: yarışı olan kategoriler içinde en yüksek puan/yarış (yalnızca ölçülebilir veri). Tek kategori varsa karşılaştırma yoktur.
  function enYuksekOrtalama(kategoriler, siralama) {
    var liste = siralama.filter(function (k) { return kategoriler[k] && kategoriler[k].yaris > 0 && kategoriler[k].ortPuan != null; });
    if (liste.length < 2) { return null; }
    var en = Math.max.apply(null, liste.map(function (k) { return kategoriler[k].ortPuan; }));
    var kazan = liste.filter(function (k) { return kategoriler[k].ortPuan === en; });
    return { deger: en, kategoriler: kazan, kucuk: kazan.some(function (k) { return kategoriler[k].kucuk; }), karsilastirilan: liste.length };
  }

  var API = { hesapla: hesapla, enYuksekOrtalama: enYuksekOrtalama, KUCUK: KUCUK };
  if (isNode) { module.exports = API; }
  if (kok && HA && H33 && PS) { kok.SezonHesapA34 = API; }
})(typeof window !== "undefined" ? window : null);
