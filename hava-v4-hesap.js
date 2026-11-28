/* HAVA v4 — SAF HESAP (DOM / ağ / depolama / zamanlayıcı YOK; Node'da test edilir). v4.0 Aşama 3.
   Girdi kaynakları (yeni kaynak yok): Open-Meteo saatlik TAHMİN (model) ve OpenF1 seans ÖLÇÜMÜ özeti (SeansHavaVeri).
   • kosul(kod, gunduz): WMO hava kodu → { tip, ad } (ikon seçimi için). Bilinmeyen kod → null (uydurma yok).
   • seansTahmini(hourly, seansBasMs): seans başlangıç saatinin (UTC, saat başına yuvarlanmış) satırı; alan yoksa null.
   • ruzgarAci(pistId, gelisDerece, YON, YOL): rüzgârın ESTİĞİ yönün pist çizimindeki ekran açısı (derece, yukarıdan saat yönünde).
       Pist çizimleri coğrafi GeoJSON'dan kuzey-yukarı izdüşümle türetilir; görünüm için uygulanan döndürme YON[pist] (derece, saat yönü)
       ve pist_yon_audit bunu kaynakla ölçerek doğrular. Kuzey çizimde YON açısındadır → ekran açısı = YON + geliş + 180.
       Çizimi olmayan pistte null döner (yanıltıcı ok çizilmez).
   • kuzeyAci(pistId, YON, YOL): çizimde coğrafi kuzeyin ekran açısı (pusula işareti için) ya da null.
   • yon8(derece): Türkçe 8 yön ("KD" + "kuzeydoğu"). */
(function (kok) {
  "use strict";
  function sayi(x) { if (x == null || x === "" || typeof x === "boolean") { return null; } var n = Number(x); return isFinite(n) ? n : null; }
  function mod360(x) { return ((x % 360) + 360) % 360; }

  var KOD = [
    [[0], "acik", "Açık"], [[1], "azbulut", "Az bulutlu"], [[2], "parcali", "Parçalı bulutlu"], [[3], "kapali", "Kapalı"],
    [[45, 48], "sis", "Sisli"], [[51, 53, 55, 56, 57], "cisenti", "Çisenti"], [[61, 63, 65, 66, 67], "yagmur", "Yağmurlu"],
    [[71, 73, 75, 77, 85, 86], "kar", "Karlı"], [[80, 81, 82], "saganak", "Sağanak"], [[95, 96, 99], "firtina", "Gök gürültülü fırtına"]
  ];
  function kosul(kod, gunduz) {
    var k = sayi(kod); if (k == null) { return null; }
    for (var i = 0; i < KOD.length; i++) {
      if (KOD[i][0].indexOf(k) >= 0) {
        var tip = KOD[i][1];
        if (gunduz === false && (tip === "acik" || tip === "azbulut")) { tip = tip === "acik" ? "gece" : "gecebulut"; }
        return { tip: tip, ad: KOD[i][2], kod: k };
      }
    }
    return null;
  }

  // hourly: Open-Meteo { time: ["2026-11-28T18:00", ...] (timezone=GMT), temperature_2m: [...], ... }
  function seansTahmini(hourly, basMs) {
    if (!hourly || !Array.isArray(hourly.time) || basMs == null || !isFinite(basMs)) { return null; }
    var hedef = Math.floor(basMs / 3600000) * 3600000, idx = -1;
    for (var i = 0; i < hourly.time.length; i++) {
      var t = Date.parse(String(hourly.time[i]).replace(/Z?$/, "Z"));
      if (t === hedef) { idx = i; break; }
    }
    if (idx < 0) { return null; }
    function al(ad) { var a = hourly[ad]; return Array.isArray(a) ? sayi(a[idx]) : null; }
    var o = { saatMs: hedef, sicaklik: al("temperature_2m"), nem: al("relative_humidity_2m"), yagisOl: al("precipitation_probability"),
              kod: al("weather_code"), ruzgar: al("wind_speed_10m"), ruzgarYon: al("wind_direction_10m"), gunduz: (function () { var g = al("is_day"); return g == null ? null : g === 1; })() };
    if (o.nem != null && (o.nem < 0 || o.nem > 100)) { o.nem = null; }
    if (o.yagisOl != null && (o.yagisOl < 0 || o.yagisOl > 100)) { o.yagisOl = null; }
    if (o.ruzgarYon != null && (o.ruzgarYon < 0 || o.ruzgarYon > 360)) { o.ruzgarYon = null; }
    if (o.ruzgar != null && o.ruzgar < 0) { o.ruzgar = null; }
    var dolu = ["sicaklik", "nem", "yagisOl", "kod", "ruzgar"].some(function (k) { return o[k] != null; });
    return dolu ? o : null;
  }

  function pistVar(pistId, YOL) { return !!(pistId && YOL && YOL[pistId]); }
  function kuzeyAci(pistId, YON, YOL) { if (!pistVar(pistId, YOL)) { return null; } return mod360(sayi(YON && YON[pistId]) || 0); }
  function ruzgarAci(pistId, gelis, YON, YOL) {
    var g = sayi(gelis), k = kuzeyAci(pistId, YON, YOL);
    if (g == null || k == null) { return null; }
    return mod360(k + g + 180);
  }

  var Y8 = [["K", "kuzey"], ["KD", "kuzeydoğu"], ["D", "doğu"], ["GD", "güneydoğu"], ["G", "güney"], ["GB", "güneybatı"], ["B", "batı"], ["KB", "kuzeybatı"]];
  function yon8(d) { var n = sayi(d); if (n == null) { return null; } var i = Math.round(mod360(n) / 45) % 8; return { kisa: Y8[i][0], ad: Y8[i][1] }; }
  function msKmh(x) { var n = sayi(x); return n == null ? null : n * 3.6; }

  var API = { kosul: kosul, seansTahmini: seansTahmini, ruzgarAci: ruzgarAci, kuzeyAci: kuzeyAci, yon8: yon8, msKmh: msKmh, KOD: KOD };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
  if (kok) { kok.HavaV4Hesap = API; }
})(typeof window !== "undefined" ? window : null);
