/* GHOST LAP + LOCATION REPLAY v1 — SAF HESAP (ağ/depolama/zamanlayıcı/DOM YOK). Girdi: telemetry-data.js'in gerçek tur örnekleri.
   Kurallar: eksik alan null; veri olmayan bölge tahmin edilmez (kopuk bölge → null); interpolasyon yalnız iki GERÇEK örnek arasında, doğrusal ve deterministik.
   Delta = B − A (A referans). Konum: yalnız gerçek x/y; pist dönüşümü yalnız GÖRSEL benzerlik (öteleme+ölçek+döndürme[+ayna]) — noktalar pist çizgisine yapıştırılmaz. */
(function (kok) {
  "use strict";
  var ARA_MAKS = 1000;        // ms — iki gerçek örnek arası bundan büyükse o aralık "kopuk": mesafe/delta tahmin edilmez
  var MIN_SEG = 5;            // boşluk sonrası delta'nın yeniden başlaması için gereken en az GERÇEK ardışık örnek
  var KAPSAM_MIN = 0.9;       // örnek aralığı / tur süresi bundan düşükse delta üretilmez
  var KONUM_ARA_MAKS = 1500;  // ms — konum örnekleri arası bundan büyükse replay'de işaretçi gizlenir (tahmin yok)
  var HATA_MAKS = 0.03;       // pist dönüşümü kabul eşiği (bbox köşegenine göre RMS; iki yönlü: konum→çizgi ve çizgi→konum)

  function sayi(v) { return typeof v === "number" && isFinite(v) ? v : null; }

  // ---------- Mesafe / ilerleme: gerçek hız örneklerinin trapez integrali (tahmin yok) ----------
  // SEGMENTLER: ardışık iki GERÇEK örnek arası ≤ ARA_MAKS ms ve ikisinde de hız varsa aynı segment; aksi halde boşluk (köprülenmez, örnek üretilmez).
  // İlk segment (ilk örnekten başlıyorsa) tur BAŞINA bağlanır → d (m, ilk gerçek örnekten itibaren). Son segment (son örnekte bitiyorsa) tur SONUNA bağlanır → r (m, son gerçek örneğe kalan mesafe).
  // Ara segmentler ortak mesafe eksenine bağlanamaz → d/r null (delta yok). Boşluk yoksa tek segment: d ve r ikisi de tanımlı (eski davranış).
  // Dönüş: noktalar [{t, s, d, r, speed, throttle, brake, gear, rpm, x, y, kopukOnce}], kapsam, toplam (baş segment sonu, m), tek (boşluksuz mu), kopukVar
  function ilerleme(ornekler, turSuresiSn, dRef) {
    var o = (ornekler || []).filter(function (r) { return r && sayi(r.t) != null; }).sort(function (a, b) { return a.t - b.t; });
    var pts = [], segs = [], cur = null, i;
    for (i = 0; i < o.length; i++) {
      var r = o[i], hizli = sayi(r.speed) != null, kp = false;
      if (i > 0 && (!hizli || sayi(o[i - 1].speed) == null || r.t - o[i - 1].t > ARA_MAKS)) { kp = true; }
      if (!hizli) { cur = null; } else if (cur === null || kp) { cur = []; segs.push(cur); }
      if (hizli) { cur.push(i); }
      pts.push({ t: r.t, d: null, r: null, s: null, speed: sayi(r.speed), throttle: sayi(r.throttle), brake: sayi(r.brake), gear: sayi(r.gear), rpm: sayi(r.rpm), x: sayi(r.x), y: sayi(r.y), kopukOnce: kp });
    }
    var kopuk = pts.some(function (p) { return p.kopukOnce; }) || segs.length > 1 || (segs.length === 1 && segs[0].length !== pts.length);
    var cum = function (seg) {
      var c = [0], k;
      for (k = 1; k < seg.length; k++) { var p0 = o[seg[k - 1]], p1 = o[seg[k]]; c.push(c[k - 1] + (p0.speed + p1.speed) / 2 / 3.6 * ((p1.t - p0.t) / 1000)); }
      return c;
    };
    var tek = segs.length === 1 && segs[0].length === pts.length, toplam = null;
    if (segs.length && segs[0][0] === 0) {          // baş segment
      var c0 = cum(segs[0]); segs[0].forEach(function (ix, k) { pts[ix].d = c0[k]; }); toplam = c0[c0.length - 1];
    }
    var son = segs.length ? segs[segs.length - 1] : null;
    if (son && son[son.length - 1] === pts.length - 1 && (tek || son.length >= MIN_SEG)) {   // son segment (yeterli gerçek örnek)
      var c1 = cum(son), tot1 = c1[c1.length - 1]; son.forEach(function (ix, k) { pts[ix].r = tot1 - c1[k]; });
    }
    if (tek) { pts.forEach(function (q) { q.s = (q.d != null && toplam > 0) ? q.d / toplam : null; }); }
    else if (dRef > 0) { pts.forEach(function (q) { var v = q.d != null ? q.d / dRef : (q.r != null ? 1 - q.r / dRef : null); q.s = (v != null && v >= -1e-9 && v <= 1 + 1e-9) ? v : null; }); }
    var aralik = pts.length > 1 ? (pts[pts.length - 1].t - pts[0].t) : 0;
    var kapsam = (turSuresiSn != null && turSuresiSn > 0) ? aralik / (turSuresiSn * 1000) : null;
    return { noktalar: pts, kapsam: kapsam, toplam: toplam, tek: tek, segmentSayisi: segs.length, kopukVar: kopuk };
  }

  // anahtara (s: oran | d,r: metre) göre zaman arama fonksiyonu: yalnız iki GERÇEK örnek arasında doğrusal; aralık dışı → null
  function arama(noktalar, anahtar) {
    var g = noktalar.filter(function (p) { return p[anahtar] != null; }).sort(function (a, b) { return a[anahtar] - b[anahtar]; });
    return function (v) {
      if (!g.length || v < g[0][anahtar] - 1e-9 || v > g[g.length - 1][anahtar] + 1e-9) { return null; }
      var lo = 0, hi = g.length - 1;
      while (lo < hi) { var m = (lo + hi) >> 1; if (g[m][anahtar] < v) { lo = m + 1; } else { hi = m; } }
      var b = g[lo], a = g[lo - 1];
      if (!a || b[anahtar] === v) { return b.t; }
      var f = (v - a[anahtar]) / (b[anahtar] - a[anahtar]);
      return a.t + (b.t - a.t) * f;
    };
  }
  function zamanS(noktalar, s) { return arama(noktalar, "s")(s); }

  // ---------- Delta (B − A, saniye) ----------
  // Baş bölge: mutlak mesafe (ilk gerçek örnekten itibaren); her iki turun İLK gerçek örneği referans → delta tam 0 (ilk örnekten önceki süre tahmin edilmez).
  // Boşluk sonrası bölge: tur SONUNA kalan mesafe (son gerçek örneklerden geriye) ile eşlenir; zamanlar tur başından gerçek zamandır (mutlak B − A).
  // Boşluğun içi ve ara segmentler null; boşluk köprülenmez, interpolasyon yalnız iki gerçek örnek arasındadır. Chart'ta her bölge ayrı çizgi.
  function deltaHesap(A, B) {
    var a = A.noktalar, b = B.noktalar, out = [];
    if (A.kapsam == null || B.kapsam == null || A.kapsam < KAPSAM_MIN || B.kapsam < KAPSAM_MIN || !a.length || !b.length || a[0].d == null || b[0].d == null) { return { noktalar: [], son: null, neden: "telemetri-eksik" }; }
    var a0 = a[0].t, b0 = b[0].t, son = null, bd = arama(b, "d"), br = arama(b, "r");
    for (var i = 0; i < a.length; i++) {
      var p = a[i], dl = null, bolge = null;
      if (p.d != null) { var tb = bd(p.d); if (tb != null) { dl = ((tb - b0) - (p.t - a0)) / 1000; bolge = "bas"; } }
      if (dl == null && p.r != null) { var tr = br(p.r); if (tr != null) { dl = (tr - p.t) / 1000; bolge = "son"; } }
      if (i === 0) { dl = 0; bolge = "bas"; }
      out.push({ s: p.s, t: p.t, delta: dl, bolge: bolge });
      if (dl != null) { son = dl; }
    }
    return { noktalar: out, son: son, neden: null, ilkOrnekMs: { a: a0, b: b0 } };
  }

  // ---------- İki turu karşılaştır ----------
  // a, b: { tur:{lap,duration,s1,s2,s3,pitOut}, telemetri:{session,driver,ornekler,konumVar} }
  function karsilastir(a, b) {
    if (!a || !b || !a.telemetri || !b.telemetri) { return { durum: "gecersiz" }; }
    if (a.telemetri.session !== b.telemetri.session) { return { durum: "gecersiz", neden: "farkli-oturum" }; }
    if (a.telemetri.driver === b.telemetri.driver && a.tur.lap === b.tur.lap) { return { durum: "gecersiz", neden: "ayni-tur" }; }
    var PA = ilerleme(a.telemetri.ornekler, a.tur.duration), PB = ilerleme(b.telemetri.ornekler, b.tur.duration);
    if (!PA.tek && PB.tek) { PA = ilerleme(a.telemetri.ornekler, a.tur.duration, PB.toplam); }     // boşluklu turun s ekseni: boşluksuz turun ölçülen mesafesine göre
    else if (PA.tek && !PB.tek) { PB = ilerleme(b.telemetri.ornekler, b.tur.duration, PA.toplam); }
    var dl = deltaHesap(PA, PB);
    function fark(x, y) { return (x == null || y == null) ? null : y - x; }
    var sek = [["S1", "s1"], ["S2", "s2"], ["S3", "s3"]].map(function (k) {
      var x = a.tur[k[1]] == null ? null : a.tur[k[1]], y = b.tur[k[1]] == null ? null : b.tur[k[1]];
      return { ad: k[0], a: x, b: y, fark: fark(x, y) };
    });
    return { durum: "ok", session: a.telemetri.session,
      a: { driver: a.telemetri.driver, lap: a.tur.lap, sure: a.tur.duration == null ? null : a.tur.duration, pitOut: a.tur.pitOut, prog: PA },
      b: { driver: b.telemetri.driver, lap: b.tur.lap, sure: b.tur.duration == null ? null : b.tur.duration, pitOut: b.tur.pitOut, prog: PB },
      turFarki: fark(a.tur.duration, b.tur.duration), sektorler: sek, delta: dl };
  }

  // ---------- Location replay: gerçek zaman damgası; yalnız x/y olan GERÇEK örnekler ----------
  function konumSeri(ornekler) {
    return (ornekler || []).filter(function (r) { return r && sayi(r.t) != null && sayi(r.x) != null && sayi(r.y) != null; })
      .map(function (r) { return { t: r.t, x: r.x, y: r.y }; }).sort(function (p, q) { return p.t - q.t; });
  }
  // t (ms, tur başından). Dönüş: {durum: "yok"|"canli"|"bitti"|"bosluk", x, y}
  function konumZaman(seri, t) {
    if (!seri || !seri.length) { return { durum: "yok", x: null, y: null }; }
    var son = seri[seri.length - 1];
    if (t < seri[0].t) { return { durum: "yok", x: null, y: null }; }
    if (t >= son.t) { return { durum: "bitti", x: son.x, y: son.y }; }       // tur biten pilot son gerçek konumunda kalır
    var lo = 0, hi = seri.length - 1;
    while (lo < hi) { var m = (lo + hi) >> 1; if (seri[m].t <= t) { lo = m + 1; } else { hi = m; } }
    var b = seri[lo], a = seri[lo - 1];
    if (b.t - a.t > KONUM_ARA_MAKS) { return { durum: "bosluk", x: null, y: null }; }
    var f = (t - a.t) / (b.t - a.t);
    return { durum: "canli", x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }

  // Replay serisi: varsa OpenF1 location örneklerinin KENDİ zaman damgaları (telemetri.konumHam); yoksa car_data'ya eşlenmiş örnekler (eski davranış).
  // Art arda AYNI (x,y) tekrarları (kısa süreli bayat yayın; ≤ TEKRAR_MAKS ms) tek örneğe iner: ilk ölçüm kalır. Daha uzun aynı-konum dizisi (gerçek duruş) korunur. Değer üretilmez.
  var TEKRAR_MAKS = 600;
  function replaySeri(telemetri) {
    var ham = telemetri && telemetri.konumHam && telemetri.konumHam.length ? konumSeri(telemetri.konumHam) : konumSeri(telemetri && telemetri.ornekler);
    var out = [], i = 0;
    while (i < ham.length) {
      var j = i;
      while (j + 1 < ham.length && ham[j + 1].x === ham[i].x && ham[j + 1].y === ham[i].y) { j++; }
      out.push(ham[i]);
      if (j > i && ham[j].t - ham[i].t > TEKRAR_MAKS) { out.push(ham[j]); }     // gerçek duruş: başı ve sonu korunur
      i = j + 1;
    }
    return out;
  }
  // Akıcı oynatım: GERÇEK örneklerin hepsinden, kendi zamanlarında geçen Hermite (Catmull-Rom) eğrisi. Örnek aralığı > KONUM_ARA_MAKS ise "bosluk" (tahmin yok);
  // boşluk komşusu / uç örneklerde teğet doğrusal eğime düşer. Durum sözleşmesi konumZaman ile aynı.
  function konumYumusak(seri, t) {
    if (!seri || !seri.length) { return { durum: "yok", x: null, y: null }; }
    var son = seri[seri.length - 1];
    if (t < seri[0].t) { return { durum: "yok", x: null, y: null }; }
    if (t >= son.t) { return { durum: "bitti", x: son.x, y: son.y }; }
    var lo = 0, hi = seri.length - 1;
    while (lo < hi) { var m = (lo + hi) >> 1; if (seri[m].t <= t) { lo = m + 1; } else { hi = m; } }
    var b = seri[lo], a = seri[lo - 1], dt = b.t - a.t;
    if (dt > KONUM_ARA_MAKS) { return { durum: "bosluk", x: null, y: null }; }
    if (!(dt > 0)) { return { durum: "canli", x: b.x, y: b.y }; }
    var o = seri[lo - 2], s2 = seri[lo + 1];
    function teget(p, q, r) {   // q'daki hız (birim/ms): komşular arası sonlu fark; komşu yok ya da boşluk ötesindeyse segment eğimi
      if (!p || !r || q.t - p.t > KONUM_ARA_MAKS || r.t - q.t > KONUM_ARA_MAKS || !(r.t - p.t > 0)) { return null; }
      return { x: (r.x - p.x) / (r.t - p.t), y: (r.y - p.y) / (r.t - p.t) };
    }
    var dog = { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt };
    var ma = teget(o, a, b) || dog, mb = teget(a, b, s2) || dog;
    var u = (t - a.t) / dt, u2 = u * u, u3 = u2 * u;
    var h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
    return { durum: "canli", x: h00 * a.x + h10 * dt * ma.x + h01 * b.x + h11 * dt * mb.x, y: h00 * a.y + h10 * dt * ma.y + h01 * b.y + h11 * dt * mb.y };
  }

  // ---------- Pist dönüşümü (yalnız görsel benzerlik) ----------
  function yolNoktalari(d) {
    var n = String(d || "").match(/-?\d+(?:\.\d+)?/g) || [], p = [];
    for (var i = 0; i + 1 < n.length; i += 2) { p.push({ x: Number(n[i]), y: Number(n[i + 1]) }); }
    return p;
  }
  function yenidenOrnekle(p, N) {   // kapalı çokgen, yay uzunluğuna göre eşit aralık
    var q = p.concat([p[0]]), L = [0], i;
    for (i = 1; i < q.length; i++) { L.push(L[i - 1] + Math.hypot(q[i].x - q[i - 1].x, q[i].y - q[i - 1].y)); }
    var T = L[L.length - 1], out = [], j = 1;
    if (!(T > 0)) { return null; }
    for (i = 0; i < N; i++) {
      var s = T * i / N;
      while (j < L.length - 1 && L[j] < s) { j++; }
      var f = L[j] === L[j - 1] ? 0 : (s - L[j - 1]) / (L[j] - L[j - 1]);
      out.push({ x: q[j - 1].x + (q[j].x - q[j - 1].x) * f, y: q[j - 1].y + (q[j].y - q[j - 1].y) * f });
    }
    return out;
  }
  function orta(p) { var x = 0, y = 0; p.forEach(function (a) { x += a.x; y += a.y; }); return { x: x / p.length, y: y / p.length }; }
  // Q'yu P'ye taşıyan en iyi (ölçek+döndürme+öteleme): kapalı form (karmaşık sayı). Dönüş {zr, zi, tx, ty, hata2}
  function procrustes(Q, P) {
    var cq = orta(Q), cp = orta(P), nr = 0, ni = 0, den = 0, i;
    for (i = 0; i < Q.length; i++) {
      var qx = Q[i].x - cq.x, qy = Q[i].y - cq.y, px = P[i].x - cp.x, py = P[i].y - cp.y;
      nr += qx * px + qy * py; ni += qx * py - qy * px; den += qx * qx + qy * qy;
    }
    if (!(den > 0)) { return null; }
    var zr = nr / den, zi = ni / den, h = 0;
    for (i = 0; i < Q.length; i++) {
      var ax = Q[i].x - cq.x, ay = Q[i].y - cq.y, mx = zr * ax - zi * ay, my = zr * ay + zi * ax, ex = (P[i].x - cp.x) - mx, ey = (P[i].y - cp.y) - my;
      h += ex * ex + ey * ey;
    }
    return { zr: zr, zi: zi, tx: cp.x - (zr * cq.x - zi * cq.y), ty: cp.y - (zr * cq.y + zi * cq.x), hata2: h };
  }
  function uygula(T, x, y) {   // T: {ayna, zr, zi, tx, ty}
    var yy = T.ayna ? -y : y;
    return { x: T.zr * x - T.zi * yy + T.tx, y: T.zr * yy + T.zi * x + T.ty };
  }
  function enYakinMesafe(P, x, y) {   // noktadan kapalı çokgene en kısa uzaklık
    var en = Infinity;
    for (var i = 0; i < P.length; i++) {
      var a = P[i], b = P[(i + 1) % P.length], dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy, f = L > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / L)) : 0;
      var d = Math.hypot(x - (a.x + dx * f), y - (a.y + dy * f));
      if (d < en) { en = d; }
    }
    return en;
  }
  // pistDonusumu(yolD, konumlar[{x,y}]) → {durum:"ok", ayna, zr, zi, tx, ty, olcek, aci, hata} | {durum:"uygun-degil"|"veri-yok", hata}
  function pistDonusumu(yolD, konumlar) {
    var P = yolNoktalari(yolD), Q = (konumlar || []).filter(function (k) { return k && sayi(k.x) != null && sayi(k.y) != null; });
    if (P.length < 8 || Q.length < 40) { return { durum: "veri-yok" }; }
    var N = 96, Pr = yenidenOrnekle(P, N), minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    P.forEach(function (p) { minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x); miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y); });
    var kosegen = Math.hypot(maxx - minx, maxy - miny);
    var en = null;
    [false, true].forEach(function (ayna) {
      var Qm = Q.map(function (k) { return { x: k.x, y: ayna ? -k.y : k.y }; }), Qr = yenidenOrnekle(Qm, N);
      if (!Qr || !Pr) { return; }
      [false, true].forEach(function (ters) {
        var Qd = ters ? Qr.slice().reverse() : Qr;
        for (var k = 0; k < N; k++) {
          var Qs = Qd.slice(k).concat(Qd.slice(0, k)), r = procrustes(Qs, Pr);
          if (r && (en === null || r.hata2 < en.hata2)) { en = { hata2: r.hata2, ayna: ayna, ters: ters, kay: k, qm: Qm }; }
        }
      });
    });
    if (!en) { return { durum: "veri-yok" }; }
    // İnce ayar: tüm gerçek noktalarla en-yakın-nokta iterasyonu (yalnız genel dönüşüm parametreleri; noktalar yapıştırılmaz)
    var Qm = en.qm, Qr0 = yenidenOrnekle(Qm, N), Qd0 = en.ters ? Qr0.slice().reverse() : Qr0, Qs0 = Qd0.slice(en.kay).concat(Qd0.slice(0, en.kay)), T = procrustes(Qs0, Pr);
    var cur = { ayna: en.ayna, zr: 0, zi: 0, tx: 0, ty: 0 }, i, it;
    // T Qs0 (yeniden örneklenmiş) için; ham noktaya uyarlamak için aynı dönüşümü ham Qm'ye uygula
    cur.zr = T.zr; cur.zi = T.zi; cur.tx = T.tx; cur.ty = T.ty;
    for (it = 0; it < 6; it++) {
      var pair = [], tq = [];
      for (i = 0; i < Qm.length; i += Math.max(1, Math.floor(Qm.length / 200))) {
        var u = uygula(cur, Q[i].x, Q[i].y), bestd = Infinity, bi = 0;
        for (var j = 0; j < Pr.length; j++) { var dd = Math.hypot(u.x - Pr[j].x, u.y - Pr[j].y); if (dd < bestd) { bestd = dd; bi = j; } }
        tq.push({ x: cur.ayna ? Q[i].x : Q[i].x, y: cur.ayna ? -Q[i].y : Q[i].y }); pair.push(Pr[bi]);
      }
      var r2 = procrustes(tq, pair); if (!r2) { break; }
      cur.zr = r2.zr; cur.zi = r2.zi; cur.tx = r2.tx; cur.ty = r2.ty;
    }
    var h2 = 0, n = 0;
    for (i = 0; i < Q.length; i += Math.max(1, Math.floor(Q.length / 300))) { var w = uygula(cur, Q[i].x, Q[i].y), dm = enYakinMesafe(P, w.x, w.y); h2 += dm * dm; n++; }
    var hata = Math.sqrt(h2 / n) / kosegen;
    // ters yön: çizginin her noktasına en yakın dönüştürülmüş konum (ölçek çökmesi / kısmi örtüşme engeli)
    var W = [], st = Math.max(1, Math.floor(Q.length / 300)), h3 = 0;
    for (i = 0; i < Q.length; i += st) { W.push(uygula(cur, Q[i].x, Q[i].y)); }
    Pr.forEach(function (pp) { var e = Infinity; W.forEach(function (w) { var dd = Math.hypot(w.x - pp.x, w.y - pp.y); if (dd < e) { e = dd; } }); h3 += e * e; });
    hata = Math.max(hata, Math.sqrt(h3 / Pr.length) / kosegen);
    var olcek = Math.hypot(cur.zr, cur.zi);
    if (!(hata <= HATA_MAKS) || !(olcek > 0)) { return { durum: "uygun-degil", hata: hata }; }
    return { durum: "ok", ayna: cur.ayna, zr: cur.zr, zi: cur.zi, tx: cur.tx, ty: cur.ty, olcek: olcek, aci: Math.atan2(cur.zi, cur.zr) * 180 / Math.PI, hata: hata };
  }

  function bic(s, ond) { if (s == null) { return "—"; } var v = Math.abs(s).toFixed(ond == null ? 3 : ond); return (s > 0 ? "+" : (s < 0 ? "−" : "±")) + v; }
  function sureBic(sn) { if (sn == null) { return "—"; } var m = Math.floor(sn / 60), s = sn - m * 60; return (m ? m + ":" : "") + (m ? (s < 10 ? "0" : "") : "") + s.toFixed(3); }

  var API = { ilerleme: ilerleme, zamanS: zamanS, deltaHesap: deltaHesap, karsilastir: karsilastir, konumSeri: konumSeri, konumZaman: konumZaman,
              replaySeri: replaySeri, konumYumusak: konumYumusak, yolNoktalari: yolNoktalari, pistDonusumu: pistDonusumu, uygula: uygula, bic: bic, sureBic: sureBic,
              ARA_MAKS: ARA_MAKS, KAPSAM_MIN: KAPSAM_MIN, KONUM_ARA_MAKS: KONUM_ARA_MAKS, HATA_MAKS: HATA_MAKS };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
  if (kok) { kok.GhostHesap = API; }
})(typeof window !== "undefined" ? window : null);
