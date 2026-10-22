/* A3.4b — Lastik stratejisi: SAF çözümleme fonksiyonları (ağ yok, DOM yok; Node'da da test edilir).
   Girdi: OpenF1 /stints satırları { driver_number, stint_number, compound, lap_start, lap_end, tyre_age_at_start }.
   KURALLAR: yalnızca ölçülebilir bilgi (stint sayısı, bileşik sırası, stint uzunluğu, başlangıç lastik yaşı). Sebep/strateji yorumu YOK.
   - Stint uzunluğu = lap_end − lap_start + 1; lap_end boşsa (son stint) yarışın en büyük lap_end değeri kullanılır, o da yoksa uzunluk bilinmez (null).
   - Bileşik: SOFT, MEDIUM, HARD, INTERMEDIATE, WET; tanınmayan/boş değer "bilinmiyor" (uydurma yok).
   - Aynı pilot için aynı stint_number tekrarlanırsa son satır geçerli; driver_number veya lap_start olmayan satır atılır.
   - Ana yarış oturumu: session_name "Race" ∧ session_type "Race". "Sprint" oturumu (session_type de "Race" olabilir) ASLA seçilmez. */
(function (kok) {
  "use strict";
  var BILESIK = {
    SOFT: { k: "soft", ad: "Yumuşak" }, MEDIUM: { k: "medium", ad: "Orta" }, HARD: { k: "hard", ad: "Sert" },
    INTERMEDIATE: { k: "inter", ad: "Ara lastik" }, WET: { k: "wet", ad: "Yağmur" }
  };
  var BILINMIYOR = { k: "bilinmiyor", ad: "Bilinmiyor" };
  var CANLI_PENCERE_MS = 30 * 60 * 1000;      // OpenF1: seans bitişinden 30 dk sonrasına kadar "canlı" (ücretli) pencere

  function sayi(v) { return typeof v === "number" && isFinite(v) ? v : (typeof v === "string" && v.trim() !== "" && isFinite(Number(v)) ? Number(v) : null); }
  function norm(x) { return String(x == null ? "" : x).trim().toLowerCase(); }
  function bilesik(c) { return BILESIK[String(c == null ? "" : c).trim().toUpperCase()] || BILINMIYOR; }

  function stintleriCoz(rows) {
    var uyari = [], gec = {}, enBuyuk = 0;
    (rows || []).forEach(function (r) { var e = r ? sayi(r.lap_end) : null; if (e != null && e > enBuyuk) { enBuyuk = e; } });
    (rows || []).forEach(function (r, i) {
      if (!r || r.driver_number == null) { uyari.push("driver_number yok (#" + i + ")"); return; }
      var bas = sayi(r.lap_start); if (bas == null) { uyari.push("lap_start yok (#" + i + ")"); return; }
      var no = String(r.driver_number), sn = sayi(r.stint_number);
      var t = gec[no] || (gec[no] = {});
      var anahtar = sn != null ? sn : "i" + i;
      if (t[anahtar]) { uyari.push("tekrarlanan stint #" + no + "/" + anahtar); }
      var bit = sayi(r.lap_end), yas = sayi(r.tyre_age_at_start), son = bit != null ? bit : (enBuyuk >= bas ? enBuyuk : null);
      t[anahtar] = { n: sn, b: bilesik(r.compound), bas: bas, bit: bit != null ? bit : son, tur: son != null && son >= bas ? son - bas + 1 : null, yas: yas != null && yas > 0 ? yas : 0, bitisEksik: bit == null };
    });
    var pilot = {};
    Object.keys(gec).forEach(function (no) {
      pilot[no] = Object.keys(gec[no]).map(function (k) { return gec[no][k]; }).sort(function (a, b) { return (a.n == null ? 1e9 : a.n) - (b.n == null ? 1e9 : b.n) || a.bas - b.bas; });
    });
    return { pilot: pilot, enBuyukTur: enBuyuk || null, uyari: uyari };
  }

  function ozet(stintler) {
    return { sayi: stintler.length, sira: stintler.map(function (s) { return s.b.ad; }) };
  }

  // Pit karşılaştırma: OpenF1'e göre pit turu = bir stintin son turu (son stint hariç). Jolpica turları verilirse karşılaştırılır; hiçbiri diğerini düzeltmez.
  function pitKarsilastir(stintler, jolpicaTurlar) {
    var openf1 = stintler.slice(0, -1).map(function (s) { return s.bit; }).filter(function (x) { return x != null; });
    if (!jolpicaTurlar) { return { openf1: openf1, jolpica: null, fark: null }; }
    var jt = jolpicaTurlar.slice().sort(function (a, b) { return a - b; }), fark = jt.length !== openf1.length;
    if (!fark) { for (var i = 0; i < jt.length; i++) { if (Math.abs(jt[i] - openf1[i]) > 1) { fark = true; break; } } }
    return { openf1: openf1, jolpica: jt, fark: fark };
  }

  // Yarış oturumunu seç. Dönüş: oturum | null. yarisBaslangicMs: Jolpica yarış başlangıcı (yanlış hafta sonu koruması ±12 saat).
  function yarisOturumuSec(oturumlar, yarisBaslangicMs) {
    var liste = (oturumlar || []).filter(function (o) { return o && norm(o.session_name) === "race" && norm(o.session_type) === "race"; });
    if (!liste.length) {   // yedek: adı "Sprint" içermeyen "Race" türü oturum
      liste = (oturumlar || []).filter(function (o) { return o && norm(o.session_type) === "race" && !/sprint/.test(norm(o.session_name)); });
    }
    liste = liste.filter(function (o) { return !yarisBaslangicMs || !isFinite(Date.parse(o.date_start)) || Math.abs(Date.parse(o.date_start) - yarisBaslangicMs) <= 12 * 3600 * 1000; });
    liste.sort(function (a, b) { return Math.abs(Date.parse(a.date_start) - yarisBaslangicMs) - Math.abs(Date.parse(b.date_start) - yarisBaslangicMs); });
    return liste[0] || null;
  }

  // Tarihsel (ücretsiz) pencere: bitişten 30 dk sonra. date_end bilinmiyorsa başlangıçtan 3 saat sonra kabul edilir.
  function yayimlandiMi(dateEnd, yarisBaslangicMs, simdi) {
    var bit = Date.parse(dateEnd);
    var e = isFinite(bit) ? bit : (yarisBaslangicMs || 0) + 2 * 3600 * 1000;
    return simdi >= e + CANLI_PENCERE_MS;
  }

  var API = { stintleriCoz: stintleriCoz, ozet: ozet, pitKarsilastir: pitKarsilastir, yarisOturumuSec: yarisOturumuSec, yayimlandiMi: yayimlandiMi, bilesik: bilesik, BILESIK: BILESIK, CANLI_PENCERE_MS: CANLI_PENCERE_MS };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
  if (kok) { kok.LastikHesap = API; }
})(typeof window !== "undefined" ? window : null);
