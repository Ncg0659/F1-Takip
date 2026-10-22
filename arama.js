/* A4.4 — Global Arama / Hızlı Git: SAF KATMAN (DOM yok, ağ yok, depolama yok; Node'da test edilir).
   - normalize(): Türkçe karakter + büyük/küçük harf + aksan duyarsız ("Şampiyona" = "sampiyona" = "SAMPİYONA").
   - indeksKur(girdi): mevcut katmanlardan verilen düz veriden arama kayıtları üretir (pilot, takım, yarış, pist, terim, bölüm).
   - ara(indeks, sorgu, limit): kendi basit skorlaması (harici kütüphane yok).
   Skor katmanları (kategori bonusu en çok 4; tam eşleşme 100 hiçbir katmana yenilmez):
     tam eşleşme 100 · baştan eşleşme 80 · kelime başı eşleşme 60 · Türkçe ek toleransı (kök kelime başı) 55 · çok kelimeli (tüm kelimeler tutuyor) 50 · içeriyor 40
   Yan alanlar (takım adı, şehir, anahtar kelime) −5 ceza alır; ana alan ve KOD alanı (örn. pilot kodu "ANT") ceza almaz.
   Eşit skorda kategori sırası: pilot, takım, yarış, pist, bölüm, terim. */
(function (kok) {
  "use strict";

  var KAT_SIRA = { pilot: 0, takim: 1, yaris: 2, pist: 3, bolum: 4, terim: 5 };
  var KAT_BONUS = { pilot: 4, takim: 3, yaris: 2, pist: 2, bolum: 1, terim: 0 };
  var KAT_AD = { pilot: "PİLOT", takim: "TAKIM", yaris: "YARIŞ", pist: "PİST", bolum: "BÖLÜM", terim: "TERİM" };

  function normalize(s) {
    if (s == null) { return ""; }
    s = String(s).replace(/İ/g, "i").replace(/I/g, "i").replace(/ı/g, "i");
    s = s.toLowerCase();
    try { s = s.normalize("NFD").replace(/[̀-ͯ]/g, ""); } catch (e) { /* eski tarayıcı: aksan kaldırılmaz */ }
    s = s.replace(/ß/g, "ss").replace(/ø/g, "o").replace(/đ/g, "d").replace(/ł/g, "l");
    return s.replace(/[^a-z0-9]+/g, " ").trim();
  }

  function kelimeler(n) { return n ? n.split(" ") : []; }

  // Tek alan için skor (0 = eşleşmedi). f: normalize edilmiş alan, q: normalize edilmiş sorgu.
  function alanSkoru(f, q) {
    if (!f || !q) { return 0; }
    if (f === q) { return 100; }
    if (f.indexOf(q) === 0) { return 80; }
    var k = kelimeler(f), i;
    for (i = 0; i < k.length; i++) { if (k[i].indexOf(q) === 0) { return 60; } }
    // sorgu birden çok kelime ise: her kelime bu alanda bir kelimenin başıyla eşleşiyorsa
    var qk = kelimeler(q);
    if (qk.length > 1 && qk.every(function (t) { return k.some(function (w) { return w.indexOf(t) === 0; }); })) { return 50; }
    // Türkçe ek toleransı: sorgu sesli harfle bitiyorsa ("sampiyona") kökü ("sampiyon") kelime başı olarak da kabul et ("sampiyonlar", "sampiyonluk")
    if (q.length >= 6 && /[aeiou]$/.test(q) && qk.length === 1) {
      var kok = q.slice(0, -1);
      for (i = 0; i < k.length; i++) { if (k[i].indexOf(kok) === 0) { return 55; } }
    }
    if (q.length >= 3 && f.indexOf(q) >= 0) { return 40; }
    return 0;
  }

  // Bir kaydın skoru. kayit.alanlar: [{m: normalize metin, y: "ana"|"kod"|"yan"}]
  function kayitSkoru(kayit, q) {
    var en = 0, i, a, s;
    for (i = 0; i < kayit.alanlar.length; i++) {
      a = kayit.alanlar[i];
      s = alanSkoru(a.m, q);
      if (s && a.y === "yan") { s -= 5; }
      if (s > en) { en = s; }
    }
    if (!en) {
      // çok kelimeli sorgu: kelimeler farklı alanlara dağılmış olabilir ("kimi mercedes")
      var qk = kelimeler(q);
      if (qk.length > 1) {
        var hepsi = qk.every(function (t) { return kayit.alanlar.some(function (a) { return kelimeler(a.m).some(function (w) { return w.indexOf(t) === 0; }); }); });
        if (hepsi) { en = 45; }
      }
    }
    return en ? en + (KAT_BONUS[kayit.tur] || 0) : 0;
  }

  function kayit(tur, id, baslik, alt, ekAlanlar, aksiyon, ek) {
    var alanlar = [{ m: normalize(baslik), y: "ana" }];
    (ekAlanlar || []).forEach(function (x) {
      if (x == null || x === "") { return; }
      var y = "yan", m = x;
      if (typeof x === "object") { y = x.y || "yan"; m = x.m; }
      m = normalize(m); if (m) { alanlar.push({ m: m, y: y }); }
    });
    return { tur: tur, id: id, baslik: baslik, alt: alt || "", etiket: KAT_AD[tur], alanlar: alanlar, aksiyon: aksiyon, iliskili: ek || [] };
  }

  // girdi: { pilotlar:[{id,ad,kod,numara,takim}], takimlar:[{id,ad,kisa:[]}], yarislar:[{tur,ad,pist,sehir,ulke,circuitId}],
  //          pistler:[{circuitId,ad,sehir,ulke,kategoriAd,tur?}], terimler:[{k,ad,kisa,kat}], bolumler:[{id,ad,kelimeler:[],alt}] }
  function indeksKur(g) {
    var o = [];
    (g.pilotlar || []).forEach(function (p) {
      var ad = p.ad || "", parcalar = ad.split(/\s+/), soyad = parcalar.length ? parcalar[parcalar.length - 1] : "";
      var alt = [p.takim, p.numara ? "#" + p.numara : null].filter(Boolean).join(" · ");
      o.push(kayit("pilot", p.id, ad, alt, [{ m: p.kod, y: "kod" }, soyad, p.numara ? "#" + p.numara : null, p.numara ? String(p.numara) : null, p.takim && { m: p.takim, y: "yan" }].filter(Boolean),
        { t: "pilot", id: p.id }, [
          { baslik: "Pilot & Pist'te karşılaştır", alt: ad, aksiyon: { t: "karsilastir", id: p.id } },
          { baslik: "Grafikte puan gelişimi", alt: ad, aksiyon: { t: "grafik", id: p.id, hedef: "a3-pilot" } }]));
    });
    (g.takimlar || []).forEach(function (t) {
      o.push(kayit("takim", t.id, t.ad, t.alt || "Takım profili", (t.kisa || []).map(function (k) { return { m: k, y: "ana" }; }), { t: "takim", id: t.id }, [
        { baslik: "Grafikte takım puan gelişimi", alt: t.ad, aksiyon: { t: "grafik", id: t.id, hedef: "a3-takim" } }]));
    });
    (g.yarislar || []).forEach(function (y) {
      var alt = [y.tur ? "Tur " + y.tur : null, [y.sehir, y.ulke].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
      o.push(kayit("yaris", "yaris-" + y.tur, y.ad, alt, [y.pist, y.sehir, y.ulke, y.circuitId && String(y.circuitId).replace(/_/g, " ")], { t: "hafta", tur: y.tur }, [
        { baslik: "Güncel Sezon takviminde göster", alt: y.ad, aksiyon: { t: "sezon", tur: y.tur } }]));
    });
    (g.pistler || []).forEach(function (p) {
      var alt = [[p.sehir, p.ulke].filter(Boolean).join(", "), p.kategoriAd ? p.kategoriAd + " pisti" : null].filter(Boolean).join(" · ");
      o.push(kayit("pist", "pist-" + p.circuitId, p.ad, alt, [p.sehir, p.ulke, p.yarisAd, String(p.circuitId).replace(/_/g, " ")], { t: "pist", circuitId: p.circuitId, ad: p.ad, tur: p.tur || null }, p.tur ? [
        { baslik: "Yarış Haftası'na git", alt: p.yarisAd || p.ad, aksiyon: { t: "hafta", tur: p.tur } }] : []));
    });
    (g.bolumler || []).forEach(function (b) {
      o.push(kayit("bolum", b.id, b.ad, b.alt || "", (b.kelimeler || []), b.aksiyon || { t: "bolum", id: b.id }));
    });
    (g.terimler || []).forEach(function (t) {
      o.push(kayit("terim", t.k, t.ad, t.kisa ? kisalt(t.kisa, 80) : "", [], { t: "terim", k: t.k }));
    });
    o.forEach(function (k, i) { k.sira = i; });
    return o;
  }

  function kisalt(s, n) { s = String(s).replace(/\[\[|\]\]|\*\*/g, ""); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; }

  // Sorgu → sıralı sonuç listesi. Boş sorgu: []. İlk sonucun ilişkili aksiyonları hemen altına eklenir (alt satır).
  function ara(indeks, sorgu, limit) {
    var q = normalize(sorgu), out = [];
    limit = limit || 12;
    if (!q) { return out; }
    var puanli = [];
    indeks.forEach(function (k) { var s = kayitSkoru(k, q); if (s) { puanli.push({ k: k, s: s }); } });
    puanli.sort(function (a, b) {
      if (b.s !== a.s) { return b.s - a.s; }
      var ka = KAT_SIRA[a.k.tur], kb = KAT_SIRA[b.k.tur];
      if (ka !== kb) { return ka - kb; }
      return a.k.sira - b.k.sira;
    });
    puanli.slice(0, limit).forEach(function (p, i) {
      out.push({ tur: p.k.tur, etiket: p.k.etiket, baslik: p.k.baslik, alt: p.k.alt, aksiyon: p.k.aksiyon, skor: p.s, id: p.k.id, alt_satir: false });
      if (i === 0) {
        p.k.iliskili.forEach(function (r) { out.push({ tur: p.k.tur, etiket: p.k.etiket, baslik: r.baslik, alt: r.alt, aksiyon: r.aksiyon, skor: p.s, id: p.k.id, alt_satir: true }); });
      }
    });
    return out;
  }

  var API = { normalize: normalize, alanSkoru: alanSkoru, kayitSkoru: kayitSkoru, indeksKur: indeksKur, ara: ara, KAT_AD: KAT_AD, KAT_SIRA: KAT_SIRA };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
  if (kok) { kok.AramaHesap = API; }
})(typeof window !== "undefined" ? window : null);
