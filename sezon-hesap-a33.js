/* A3.3 — Sprint vs Ana Yarış hesabı. SAF fonksiyonlar: ağ yok, DOM yok, önbellek yok (Node'da da test edilir).
   Girdi: A3.1 SezonAnaliz modeli (yaris[] ve sprint[] satırları ayrı). YENİ ağ çağrısı gerektirmez.
   Durum kuralı (SIN/DNF/DNS/DSQ) ve ana yarış ortalama bitişi A3.2 hesabından (sezon-hesap-a32.js) BİREBİR alınır.
   KURALLAR:
   - Toplam puan = ana yarış puanı + sprint puanı (A3.1 şampiyona grafiğiyle aynı). A3.3 yalnızca bu toplamı ikiye AYIRIR.
   - Sprint puanı ana yarış puanına, sprint galibiyeti/podyumu ana yarış galibiyetine/podyumuna KARIŞMAZ.
   - Ana yarış Ort. Bitiş: A3.2 örneklemi (sınıflandırılmış ∧ grid > 0). Sprint Ort. Bitiş: yalnızca sınıflandırılmış (sayısal positionText) sprint sonuçları;
     DNF/DNS/DSQ dahil değildir.
   - "Yarış / sprint sayısı" = pilotun gerçekten başladığı yarış sayısı (DNS satırı sayılmaz; DNF ve DSQ başlamış sayılır).
   - Sprint katkısı = sprint puanı / toplam puan (yüzde, 1 ondalık). Toplam 0 ise null ("—").
   - Pilot driverId (p) ile izlenir; takım değişikliği sezonu bölmez. */
(function (kok) {
  "use strict";
  var HA = (typeof module !== "undefined" && module.exports) ? require("./sezon-hesap-a32.js") : (kok && kok.SezonHesapA32);

  function sayi(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  function bosKisim() { return { puan: 0, basladi: 0, galibiyet: 0, podyum: 0, n: 0, bitisToplam: 0, ortBitis: null, dnf: 0, dns: 0, dsq: 0, diger: 0 }; }

  // Bir yarış/sprint satırını kısma işle (puan, başlangıç sayısı, durum sayaçları; sınıflandırılmışsa galibiyet/podyum)
  function isle(k, r) {
    var d = HA.durum(r);
    k.puan += sayi(r.n);
    if (d !== "DNS") { k.basladi++; }
    if (d === "SIN") {
      var s = sayi(r.s);
      if (s === 1) { k.galibiyet++; }
      if (s >= 1 && s <= 3) { k.podyum++; }
    }
    else if (d === "DNF") { k.dnf++; }
    else if (d === "DNS") { k.dns++; }
    else if (d === "DSQ") { k.dsq++; }
    else { k.diger++; }
    return d;
  }

  function katki(sprintPuan, toplam) { return toplam > 0 ? Math.round(sprintPuan / toplam * 1000) / 10 : null; }

  function hesapla(model) {
    var turlar = HA.yarisTurlari(model), sprintTurlari = [], P = {}, id;
    Object.keys(model.turlar || {}).map(Number).sort(function (a, b) { return a - b; }).forEach(function (n) {
      var t = model.turlar[n]; if (t && t.sprint && t.sprint.length) { sprintTurlari.push(n); }
    });
    var h32 = HA.hesapla(model, 5);
    function al(i) { return P[i] || (P[i] = { id: i, gp: bosKisim(), sprint: bosKisim(), toplam: 0, katki: null }); }
    turlar.forEach(function (n) {
      var gorulen = {};
      model.turlar[n].yaris.forEach(function (r) { if (gorulen[r.p]) { return; } gorulen[r.p] = true; isle(al(r.p).gp, r); });
    });
    sprintTurlari.forEach(function (n) {
      var gorulen = {};
      model.turlar[n].sprint.forEach(function (r) {
        if (gorulen[r.p]) { return; } gorulen[r.p] = true;
        var s = al(r.p).sprint, d = isle(s, r);
        if (d === "SIN" && sayi(r.s) > 0) { s.n++; s.bitisToplam += sayi(r.s); }     // sprint ortalaması: yalnızca sınıflandırılmış sonuçlar
      });
    });
    for (id in (model.pilotlar || {})) { al(id); }
    Object.keys(P).forEach(function (i) {
      var p = P[i], o32 = h32.pilot[i];
      p.gp.n = o32 ? o32.ornek.n : 0;                      // ana yarış örneklemi: A3.2 kuralı (sınıflandırılmış ∧ grid > 0)
      p.gp.ortBitis = o32 ? o32.ornek.ortBitis : null;     // A3.2 ile birebir aynı değer
      p.sprint.ortBitis = p.sprint.n ? p.sprint.bitisToplam / p.sprint.n : null;
      p.toplam = p.gp.puan + p.sprint.puan;
      p.katki = katki(p.sprint.puan, p.toplam);
    });
    return { gpTurSayisi: turlar.length, sprintTurSayisi: sprintTurlari.length, pilot: P };
  }

  var API = { hesapla: hesapla, katki: katki };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
  if (kok && HA) { kok.SezonHesapA33 = API; }     // A3.2 hesabı yoksa dışa açılmaz; arayüz kendini kapatır (A3.1 aynen çalışır)
})(typeof window !== "undefined" ? window : null);
