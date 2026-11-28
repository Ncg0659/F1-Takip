// HAVA v4 — saf hesap denetimi (geliştirici aracı; siteye yüklenmez). nav_v4_hafta_test.py çağırır.
// 1) Rüzgâr oku: her pist için kaynak GeoJSON (bacinger/f1-circuits) çizime benzerlik dönüşümüyle oturtulur; coğrafi kuzey vektörü
//    çizime taşınır ve HavaV4Hesap.kuzeyAci ile karşılaştırılır (≤ 0.5°). Geliş yönü 0/90/200° için ok açısı = kuzey + geliş + 180.
// 2) kosul / seansTahmini / yon8 sınırları. Çıktı: "PASS ..." / "FAIL ..." satırları.
"use strict";
const fs = require("fs"), path = require("path");
const P = require(path.join(__dirname, "..", "pist-siluetleri.js"));
const H = require(path.join(__dirname, "..", "hava-v4-hesap.js"));
let ok = 0, top = 0;
function k(ad, kosul, ek) { top++; if (kosul) { ok++; console.log("PASS " + ad); } else { console.log("FAIL " + ad + (ek !== undefined ? " | " + JSON.stringify(ek) : "")); } }
const pts = d => { const n = d.match(/-?\d+(\.\d+)?/g).map(Number), o = []; for (let i = 0; i < n.length; i += 2) { o.push([n[i], n[i + 1]]); } return o; };
function kaynak(id) {
  const g = JSON.parse(fs.readFileSync(path.join(__dirname, "pist-kaynak", id + ".geojson"), "utf8"));
  const f = g.features ? g.features[0] : g, c = f.geometry.type === "LineString" ? f.geometry.coordinates : f.geometry.coordinates[0];
  const lat0 = c.reduce((s, p) => s + p[1], 0) / c.length * Math.PI / 180;
  return c.map(p => [p[0] * Math.cos(lat0), -p[1]]);
}
function oturt(p, q) {      // yansımasız benzerlik: q ≈ s·R(θ)·p + t → θ (derece, ekran koordinatı: y aşağı → saat yönü)
  const n = p.length, mp = [0, 0], mq = [0, 0];
  p.forEach(a => { mp[0] += a[0] / n; mp[1] += a[1] / n; }); q.forEach(a => { mq[0] += a[0] / n; mq[1] += a[1] / n; });
  let a = 0, b = 0, c = 0, d = 0;
  for (let i = 0; i < n; i++) { const x = p[i][0] - mp[0], y = p[i][1] - mp[1], u = q[i][0] - mq[0], v = q[i][1] - mq[1]; a += x * u; b += x * v; c += y * u; d += y * v; }
  return Math.atan2(b - c, a + d);
}
const fark = (x, y) => Math.abs((((x - y) % 360) + 540) % 360 - 180);
let enCok = 0, sayi = 0;
for (const id of Object.keys(P.YOL)) {
  const src = kaynak(P.KAYNAK[id].sourceId), app = pts(P.YOL[id]);
  const th = oturt(src, app);
  const kn = [Math.sin(th) * 1, -Math.cos(th) * 1];                 // R(θ)·(0,-1): coğrafi kuzeyin çizimdeki yönü
  const olculen = ((Math.atan2(kn[0], -kn[1]) * 180 / Math.PI) + 360) % 360;   // yukarıdan saat yönünde açı
  const f = fark(olculen, H.kuzeyAci(id, P.YON, P.YOL)); enCok = Math.max(enCok, f); sayi++;
  if (f > 0.5) { k("R " + id + " kuzey açısı kaynakla uyuşmalı", false, { olculen, hesap: H.kuzeyAci(id, P.YON, P.YOL) }); }
}
k("R1 " + sayi + " pistin tamamında çizimdeki coğrafi kuzey kaynakla uyuşuyor (en büyük fark " + enCok.toFixed(3) + "°)", sayi >= 25 && enCok <= 0.5, enCok);
k("R2 losail: kuzeyden esen rüzgâr (0°) çizimde kuzeyin tersine (güneye) akar", fark(H.ruzgarAci("losail", 0, P.YON, P.YOL), H.kuzeyAci("losail", P.YON, P.YOL) + 180) < 1e-9);
k("R3 marina_bay (kuzey-yukarı): 90° (doğudan) → ok batıya, ekran açısı 270°", H.ruzgarAci("marina_bay", 90, P.YON, P.YOL) === 270);
k("R4 çizimi olmayan pist → ok yok (null)", H.ruzgarAci("yok_pist", 90, P.YON, P.YOL) === null && H.kuzeyAci("", P.YON, P.YOL) === null);
k("R5 geliş yönü yoksa ok yok", H.ruzgarAci("losail", null, P.YON, P.YOL) === null);
k("K1 WMO 0 gündüz açık / gece ay", H.kosul(0, true).tip === "acik" && H.kosul(0, false).tip === "gece");
k("K2 WMO 61 yağmur, 81 sağanak, 95 fırtına, 45 sis, 3 kapalı", H.kosul(61).tip === "yagmur" && H.kosul(81).tip === "saganak" && H.kosul(95).tip === "firtina" && H.kosul(45).tip === "sis" && H.kosul(3).tip === "kapali");
k("K3 bilinmeyen / boş kod → null (uydurma yok)", H.kosul(42) === null && H.kosul(null) === null);
const hr = { time: ["2026-11-28T17:00", "2026-11-28T18:00"], temperature_2m: [25.1, 24.6], relative_humidity_2m: [60, 140], precipitation_probability: [10, 20], weather_code: [1, 2], wind_speed_10m: [12, -3], wind_direction_10m: [10, 200], is_day: [1, 0] };
const t = H.seansTahmini(hr, Date.parse("2026-11-28T18:00:00Z"));
k("T1 seans saati satırı (18:00Z) seçilir", t && t.sicaklik === 24.6 && t.yagisOl === 20 && t.kod === 2 && t.ruzgarYon === 200 && t.gunduz === false, t);
k("T2 geçersiz değerler null (nem 140, rüzgâr -3)", t && t.nem === null && t.ruzgar === null, t);
k("T3 dakika içeren başlangıç saat başına yuvarlanır (18:30 → 18:00)", (H.seansTahmini(hr, Date.parse("2026-11-28T18:30:00Z")) || {}).sicaklik === 24.6);
k("T4 kapsam dışı saat → null", H.seansTahmini(hr, Date.parse("2026-11-29T16:00:00Z")) === null);
k("Y1 yon8: 0 K, 45 KD, 200 G, 337 KB", H.yon8(0).kisa === "K" && H.yon8(45).kisa === "KD" && H.yon8(200).kisa === "G" && H.yon8(337).kisa === "KB");
k("Y2 m/s → km/sa (3.2 → 11.52)", Math.abs(H.msKmh(3.2) - 11.52) < 1e-9 && H.msKmh(null) === null);
console.log("TOPLAM " + ok + "/" + top);
process.exit(ok === top ? 0 : 1);
