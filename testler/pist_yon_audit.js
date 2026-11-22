// Pist yönü denetimi (geliştirici aracı; siteye yüklenmez).
// Her pist için uygulamadaki çizgiyi KAYNAK GeoJSON'a (bacinger/f1-circuits, MIT; testler/pist-kaynak/) benzerlik dönüşümüyle oturtur:
//   - ayna (yansıma) var mı, şekil bozulmuş mu (artık hata), kuzeye göre kaç derece döndürülmüş.
// Durum:
//   PASS       → şekil kaynakla birebir, ayna yok ve yön KUZEY-YUKARI (coğrafi kaynakla aynı yön; doğrulanabilir referans)
//   FIXED      → bu denetimde ayna/bozulma bulunup düzeltilen pist (düzeltme sonrası tekrar ölçülür)
//   UNVERIFIED → şekil kaynakla birebir ve ayna yok, ama görünüm için DÖNDÜRÜLMÜŞ (YON); resmî F1 yayın haritası yönüyle
//                karşılaştırılacak erişilebilir güvenilir kaynak yok → yön "doğrulandı" denmez.
// Çalıştır: node testler/pist_yon_audit.js  (çıktı: JSON satırları + özet; hata varsa çıkış kodu 1)
"use strict";
const fs = require("fs"), path = require("path");
const P = require(path.join(__dirname, "..", "pist-siluetleri.js"));
const pts = d => { const n = d.match(/-?\d+(\.\d+)?/g).map(Number), o = []; for (let i = 0; i < n.length; i += 2) { o.push([n[i], n[i + 1]]); } return o; };
function kaynak(id) {
  const g = JSON.parse(fs.readFileSync(path.join(__dirname, "pist-kaynak", id + ".geojson"), "utf8"));
  const f = g.features ? g.features[0] : g, c = f.geometry.type === "LineString" ? f.geometry.coordinates : f.geometry.coordinates[0];
  const lat0 = c.reduce((s, p) => s + p[1], 0) / c.length * Math.PI / 180;
  return c.map(p => [p[0] * Math.cos(lat0), -p[1]]);              // eş-dikdörtgen izdüşüm, ekran Y'si aşağı (kuzey yukarı)
}
// En iyi benzerlik dönüşümü (Umeyama): q ≈ s·R·p + t. Yansımalı ve yansımasız ikisi de denenir.
function oturt(p, q) {
  const n = p.length, mp = [0, 0], mq = [0, 0];
  p.forEach(a => { mp[0] += a[0] / n; mp[1] += a[1] / n; }); q.forEach(a => { mq[0] += a[0] / n; mq[1] += a[1] / n; });
  let a = 0, b = 0, c = 0, d = 0, vp = 0, vq = 0;
  for (let i = 0; i < n; i++) {
    const x = p[i][0] - mp[0], y = p[i][1] - mp[1], u = q[i][0] - mq[0], v = q[i][1] - mq[1];
    a += x * u; b += x * v; c += y * u; d += y * v; vp += x * x + y * y; vq += u * u + v * v;
  }
  const sonuc = ayna => {
    // yansımasız: açı = atan2(b - c, a + d); yansımalı (x→-x sonrası): açı = atan2(b + c, d - a)
    const th = ayna ? Math.atan2(-b - c, -a + d) : Math.atan2(b - c, a + d);
    const kv = ayna ? Math.hypot(-a + d, b + c) : Math.hypot(a + d, b - c), s = kv / vp;
    const art = Math.sqrt(Math.max(0, (vq - kv * kv / vp) / n)) / Math.sqrt(vq / n);   // normalize artık (0 = birebir)
    return { ayna, aci: th * 180 / Math.PI, s, art };
  };
  const r0 = sonuc(false), r1 = sonuc(true);
  return r0.art <= r1.art ? r0 : r1;
}
const satir = [], ozet = { PASS: 0, FIXED: 0, UNVERIFIED: 0, HATA: 0 };
for (const k of Object.keys(P.YOL)) {
  const kay = P.KAYNAK[k], src = kaynak(kay.sourceId), app = pts(P.YOL[k]);
  let durum, not;
  if (src.length !== app.length) { durum = "HATA"; not = "nokta sayısı farklı " + src.length + "≠" + app.length; }
  else {
    const r = oturt(src, app), yon = P.YON[k] || 0;
    let aci = ((r.aci % 360) + 540) % 360 - 180;                    // -180..180
    const yonFark = Math.abs((((aci - yon) % 360) + 540) % 360 - 180);
    if (r.ayna || r.art > 0.002 || yonFark > 0.5) { durum = "HATA"; not = "ayna=" + r.ayna + " artık=" + r.art.toFixed(4) + " ölçülen açı=" + aci.toFixed(1) + " YON=" + yon; }
    else if (!yon) { durum = "PASS"; not = "kaynakla birebir, ayna yok, kuzey-yukarı (artık " + r.art.toFixed(5) + ")"; }
    else { durum = "UNVERIFIED"; not = "kaynakla birebir, ayna yok; görünüm için " + yon + "° döndürülmüş — resmî yayın haritası yönü karşılaştırılamadı"; }
    satir.push({ pist: k, kaynak: kay.sourceId, durum, olculenAci: +aci.toFixed(2), yon, artik: +r.art.toFixed(5), not });
    ozet[durum]++; continue;
  }
  satir.push({ pist: k, kaynak: kay.sourceId, durum, not }); ozet[durum]++;
}
satir.forEach(s => console.log(JSON.stringify(s)));
console.log("ÖZET " + JSON.stringify(ozet));
process.exit(ozet.HATA ? 1 : 0);
