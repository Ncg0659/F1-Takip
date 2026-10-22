/* A3.2 — Form ve pozisyon hesapları. SAF fonksiyonlar: ağ yok, DOM yok, önbellek yok (Node'da da test edilir).
   Girdi: A3.1 SezonAnaliz modeli (sezon-analiz-veri.js) — YENİ ağ çağrısı gerektirmez.
     { turlar: { <n>: { n, ad, sprintMi, yaris: [satir], sprint: [satir] } }, pilotlar: { id: { k, a } }, takimlar: { id: ad } }
     satir = { p: pilotId, t: takimId, g: grid, s: pozisyon, x: positionText, n: puan, d: status }
   Pilot her yerde driverId (p) ile izlenir; takım değiştiren pilotun sezonu bölünmez.

   DURUM KURALI (A2 yorum motoruyla ve A3.1 ile aynı, onaylı kural):
     positionText sayısal            → SIN  (sınıflandırılmış; "Lapped" dahil)
     "D" ya da status "Disqualified"  → DSQ
     "W" ya da status "Did not start" → DNS
     "R"                              → DNF
     diğer (E, F, N, boş …)           → DIGER (üç sayaca girmez, ayrıca sayılır)
   Neden (teknik/kaza) ayrımı YAPILMAZ; status metninden sebep tahmin edilmez.

   ÖRNEKLEM (Ortalama Start / Ortalama Bitiş / Net Pozisyon):
     yalnızca ANA YARIŞ (sprint hariç) ∧ durum SIN ∧ grid > 0 (grid 0 = pit çıkışı/grid yok → dışarıda) ∧ bitiş sırası > 0.
     DNF / DNS / DSQ / DIGER örneklem dışıdır ve performans ortalamalarına girmez. Net = grid − bitiş. */
(function (kok) {
  "use strict";

  function sayi(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  function durum(r) {
    var x = String(r.x == null ? "" : r.x).trim().toUpperCase(), d = String(r.d || "").trim().toLowerCase();
    if (/^\d+$/.test(x)) { return "SIN"; }
    if (x === "D" || d === "disqualified") { return "DSQ"; }
    if (x === "W" || d === "did not start") { return "DNS"; }
    if (x === "R") { return "DNF"; }
    return "DIGER";
  }
  function kazandi(r) { return durum(r) === "SIN" && sayi(r.s) === 1; }

  // Ana yarış satırı olan turlar, artan
  function yarisTurlari(model) {
    return Object.keys((model && model.turlar) || {}).map(Number).sort(function (a, b) { return a - b; }).filter(function (n) {
      var t = model.turlar[n]; return t && t.yaris && t.yaris.length;
    });
  }

  function bosPilot(id, turSayisi) {
    return { id: id, yarisSayisi: turSayisi, katildi: 0, sin: 0, dnf: 0, dns: 0, dsq: 0, diger: 0,
             haric: { grid0: 0, yok: turSayisi },
             ornek: { n: 0, start: 0, bitis: 0, net: 0, ortStart: null, ortBitis: null },
             form: [], form5Puan: 0, satir: {} };
  }

  // Tüm pilotlar için: sayaçlar, örneklem, son 5 form
  function hesapla(model, formUzunluk) {
    var turlar = yarisTurlari(model), son = turlar.slice(-(formUzunluk || 5)), P = {}, id;
    function al(i) { return P[i] || (P[i] = bosPilot(i, turlar.length)); }
    turlar.forEach(function (n) {
      var gorulen = {};
      model.turlar[n].yaris.forEach(function (r) {
        if (gorulen[r.p]) { return; }                      // aynı yarışta aynı pilottan ikinci satır sayılmaz
        gorulen[r.p] = true;
        var a = al(r.p), d = durum(r);
        a.satir[n] = r; a.katildi++;
        if (d === "SIN") {
          a.sin++;
          var g = sayi(r.g), s = sayi(r.s);
          if (g > 0 && s > 0) { a.ornek.n++; a.ornek.start += g; a.ornek.bitis += s; a.ornek.net += g - s; }
          else { a.haric.grid0++; }
        }
        else if (d === "DNF") { a.dnf++; }
        else if (d === "DNS") { a.dns++; }
        else if (d === "DSQ") { a.dsq++; }
        else { a.diger++; }
      });
    });
    for (id in (model.pilotlar || {})) { al(id); }          // yalnızca sprint satırı olan pilotlar da listede olsun
    Object.keys(P).forEach(function (i) {
      var a = P[i], o = a.ornek;
      a.haric.yok = turlar.length - a.katildi;
      if (o.n) { o.ortStart = o.start / o.n; o.ortBitis = o.bitis / o.n; }
      a.form = son.map(function (n) {
        var r = a.satir[n], sp = 0;
        ((model.turlar[n].sprint) || []).forEach(function (x) { if (x.p === i) { sp += sayi(x.n); } });
        if (!r) { return { tur: n, durum: "YOK", poz: null, grid: null, puan: 0, sprint: sp }; }
        var d = durum(r);
        return { tur: n, durum: d, poz: d === "SIN" ? sayi(r.s) : null, grid: sayi(r.g), puan: sayi(r.n), sprint: sp };
      });
      a.form5Puan = a.form.reduce(function (t, x) { return t + x.puan; }, 0);
    });
    return { turlar: turlar, yarisSayisi: turlar.length, formTurlari: son, pilot: P };
  }

  // Net pozisyona göre sıralama (yalnızca örneklemi olan pilotlar). Eşitlikte örneklem büyüğü, sonra verilen sıra.
  function siraNet(h, kimlikler) {
    var ids = kimlikler.filter(function (id) { return h.pilot[id] && h.pilot[id].ornek.n > 0; });
    return ids.map(function (id, i) { return { id: id, i: i }; }).sort(function (a, b) {
      var A = h.pilot[a.id].ornek, B = h.pilot[b.id].ornek;
      if (A.net !== B.net) { return B.net - A.net; }
      if (A.n !== B.n) { return B.n - A.n; }
      return a.i - b.i;
    }).map(function (x) { return x.id; });
  }

  // Sezon özeti kartı: en çok net pozisyon kazanan (sezon TOPLAMI; tek yarıştaki en büyük kazanç değil). Eşitlikler birlikte.
  function enCokNet(h, kimlikler) {
    var s = siraNet(h, kimlikler);
    if (!s.length) { return { deger: 0, kimlikler: [], n: 0, yarisSayisi: h.yarisSayisi }; }
    var en = h.pilot[s[0]].ornek.net, liste = s.filter(function (id) { return h.pilot[id].ornek.net === en; });
    return { deger: en, kimlikler: liste, n: h.pilot[liste[0]].ornek.n, yarisSayisi: h.yarisSayisi };
  }

  // Pole → galibiyet ve P1 start → galibiyet: iki AYRI ölçü.
  //   pole     = sıralama P1 (poleKodlari: { <tur>: pilotKodu }, A2 SezonVeri'den). Grid P1 asla pole sayılmaz.
  //   p1Start  = yarışa grid'in 1. sırasından çıkış (grid cezası varsa pole sahibinden farklı olabilir).
  //   Galibiyet = ana yarışta sınıflandırılmış P1. Yalnızca ana yarışı yapılmış turlar sayılır.
  function poleDonusumu(model, poleKodlari) {
    var turlar = yarisTurlari(model), P = {}, kodId = {}, ayrisan = [], id;
    for (id in (model.pilotlar || {})) { kodId[model.pilotlar[id].k] = id; }
    function al(i) { return P[i] || (P[i] = { id: i, pole: 0, poleGalibiyet: 0, poleP1Degil: 0, p1Start: 0, p1Galibiyet: 0, p1PoleDegil: 0 }); }
    turlar.forEach(function (n) {
      var satirlar = model.turlar[n].yaris, poleId = poleKodlari && poleKodlari[n] ? (kodId[poleKodlari[n]] || null) : null, g1 = null;
      satirlar.forEach(function (r) {
        if (sayi(r.g) !== 1) { return; }
        if (!g1) { g1 = r.p; }
        var a = al(r.p); a.p1Start++;
        if (kazandi(r)) { a.p1Galibiyet++; }
        if (poleId && r.p !== poleId) { a.p1PoleDegil++; }
      });
      if (poleId) {
        var a2 = al(poleId), pr = null;
        satirlar.forEach(function (r) { if (!pr && r.p === poleId) { pr = r; } });
        a2.pole++;
        if (pr && kazandi(pr)) { a2.poleGalibiyet++; }
        if (!pr || sayi(pr.g) !== 1) { a2.poleP1Degil++; }
        if (g1 !== poleId) { ayrisan.push({ tur: n, pole: poleId, grid1: g1 }); }
      }
    });
    return { poleVar: !!poleKodlari, pilot: P, ayrisan: ayrisan };
  }

  function toplamDurum(h) {
    var t = { dnf: 0, dns: 0, dsq: 0, diger: 0 };
    Object.keys(h.pilot).forEach(function (i) { var a = h.pilot[i]; t.dnf += a.dnf; t.dns += a.dns; t.dsq += a.dsq; t.diger += a.diger; });
    return t;
  }

  var API = { durum: durum, yarisTurlari: yarisTurlari, hesapla: hesapla, siraNet: siraNet, enCokNet: enCokNet, poleDonusumu: poleDonusumu, toplamDurum: toplamDurum };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
  if (kok) { kok.SezonHesapA32 = API; }
})(typeof window !== "undefined" ? window : null);
