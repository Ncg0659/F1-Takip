/* A3.1 — Sezon hesapları. SAF fonksiyonlar: ağ yok, DOM yok, önbellek yok (Node'da da test edilir).
   Girdi: SezonAnaliz modeli
     { turlar: { <n>: { n, ad, sprintMi, yaris: [satir], sprint: [satir] } }, pilotlar: { id: { k, a } }, takimlar: { id: ad } }
     satir = { p: pilotId, t: takimId, g: grid, s: pozisyon, x: positionText, n: puan, d: status }
   KURALLAR (onaylı A3 planı):
   - Pilot ve takım puanı = ana yarış puanı + sprint puanı (aynı turun toplamına eklenir).
   - Galibiyet / podyum YALNIZCA ana yarıştan; sprint galibiyeti/podyumu ana yarışa karışmaz.
   - Pole YALNIZCA sıralama P1'dir (dışarıdan verilir); grid P1 asla pole sayılmaz.
   - Sıralanmış (classified) bitiş = positionText sayısal (A2 yorum motoruyla aynı kural). */
(function (kok) {
  "use strict";

  function sayi(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function siniflandi(r) { return /^\d+$/.test(String(r.x)); }

  // Veri olan turlar (ana yarış ya da sprint satırı), artan
  function turListesi(model) {
    return Object.keys(model.turlar || {}).map(Number).sort(function (a, b) { return a - b; }).filter(function (n) {
      var t = model.turlar[n];
      return (t.yaris && t.yaris.length) || (t.sprint && t.sprint.length);
    });
  }

  // Ortak: kimlik alanına göre (p: pilot, t: takım) tur tur kümülatif puan
  function gelisim(model, alan) {
    var turlar = turListesi(model), seri = {}, i, id;
    function al(id) { return seri[id] || (seri[id] = { id: id, toplam: [], yaris: [], sprint: [], yerler: {} }); }
    turlar.forEach(function (n) {
      ["yaris", "sprint"].forEach(function (tur) { (model.turlar[n][tur] || []).forEach(function (r) { al(r[alan]); }); });
    });
    turlar.forEach(function (n, k) {
      var yp = {}, sp = {};
      (model.turlar[n].yaris || []).forEach(function (r) {
        yp[r[alan]] = (yp[r[alan]] || 0) + sayi(r.n);
        if (siniflandi(r)) { var s = sayi(r.s); seri[r[alan]].yerler[s] = (seri[r[alan]].yerler[s] || 0) + 1; }
      });
      (model.turlar[n].sprint || []).forEach(function (r) { sp[r[alan]] = (sp[r[alan]] || 0) + sayi(r.n); });
      for (id in seri) {
        var onceki = k ? seri[id].toplam[k - 1] : 0, a = yp[id] || 0, b = sp[id] || 0;
        seri[id].yaris.push(a); seri[id].sprint.push(b); seri[id].toplam.push(onceki + a + b);
      }
    });
    var lider = turlar.map(function (n, k) { var m = 0; for (var d in seri) { if (seri[d].toplam[k] > m) { m = seri[d].toplam[k]; } } return m; });
    return { turlar: turlar, seri: seri, lider: lider };
  }

  function pilotGelisimi(model) { return gelisim(model, "p"); }
  function takimGelisimi(model) { return gelisim(model, "t"); }

  // Sıralama: toplam puan, eşitlikte galibiyet sayısı, sonra 2., 3. ... yer sayısı (ana yarış), son çare kimlik
  function siralama(g) {
    return Object.keys(g.seri).sort(function (a, b) {
      var A = g.seri[a], B = g.seri[b], ta = A.toplam[A.toplam.length - 1] || 0, tb = B.toplam[B.toplam.length - 1] || 0;
      if (ta !== tb) { return tb - ta; }
      for (var y = 1; y <= 30; y++) { var d = (B.yerler[y] || 0) - (A.yerler[y] || 0); if (d) { return d; } }
      return a < b ? -1 : 1;
    });
  }

  function sonPuan(g, id) { var s = g.seri[id]; return s && s.toplam.length ? s.toplam[s.toplam.length - 1] : 0; }

  // Galibiyet / podyum / pole (pole: { <tur>: pilotKodu } — YALNIZCA sıralama P1; null ise pole hesaplanmaz)
  function galibiyetPodyumPole(model, poleKodlari) {
    var cikti = {}, kodId = {}, id;
    for (id in (model.pilotlar || {})) { kodId[model.pilotlar[id].k] = id; }
    function al(id) { return cikti[id] || (cikti[id] = { galibiyet: 0, podyum: 0, pole: 0 }); }
    turListesi(model).forEach(function (n) {
      (model.turlar[n].yaris || []).forEach(function (r) {
        if (!siniflandi(r)) { return; }
        var s = sayi(r.s);
        if (s === 1) { al(r.p).galibiyet++; }
        if (s >= 1 && s <= 3) { al(r.p).podyum++; }
      });
    });
    if (poleKodlari) {
      for (var tur in poleKodlari) {
        var pid = kodId[poleKodlari[tur]];
        if (pid) { al(pid).pole++; }
      }
    }
    return cikti;
  }

  // Bir ölçüte göre en yüksek (eşitlikler birlikte). Sıfır ise boş döner.
  function enCok(wpp, alan, kimlikler) {
    var enB = 0, liste = [];
    kimlikler.forEach(function (id) { var v = wpp[id] ? wpp[id][alan] : 0; if (v > enB) { enB = v; } });
    if (!enB) { return { deger: 0, kimlikler: [] }; }
    kimlikler.forEach(function (id) { if ((wpp[id] ? wpp[id][alan] : 0) === enB) { liste.push(id); } });
    return { deger: enB, kimlikler: liste };
  }

  function ozet(model, g, sira, wpp, poleVar) {
    var lider = sira[0] || null, ikinci = sira[1] || null;
    return {
      lider: lider ? { id: lider, puan: sonPuan(g, lider), fark: ikinci ? sonPuan(g, lider) - sonPuan(g, ikinci) : null } : null,
      galibiyet: enCok(wpp, "galibiyet", sira),
      podyum: enCok(wpp, "podyum", sira),
      pole: poleVar ? enCok(wpp, "pole", sira) : null,
      turSayisi: turListesi(model).length,
      sprintSayisi: turListesi(model).filter(function (n) { return (model.turlar[n].sprint || []).length; }).length
    };
  }

  // Resmî sıralamayla karşılaştırma. Fark varsa YALNIZCA farkı raporlar; neden tahmin edilmez, veri değiştirilmez.
  // resmi: [{ id, puan }]  (pilot için driverId, takım için ad)
  function dogrula(g, resmi, ad) {
    var farklar = [], gorulen = {};
    (resmi || []).forEach(function (r) {
      var anahtar = ad ? ad(r.id) : r.id;
      gorulen[anahtar] = true;
      var hesap = g.seri[anahtar] ? sonPuan(g, anahtar) : 0;
      if (Math.abs(hesap - sayi(r.puan)) > 1e-9) { farklar.push({ id: r.id, hesap: hesap, resmi: sayi(r.puan) }); }
    });
    Object.keys(g.seri).forEach(function (id) {
      if (!gorulen[id] && sonPuan(g, id) !== 0 && (resmi || []).length) { farklar.push({ id: id, hesap: sonPuan(g, id), resmi: null }); }
    });
    return { karsilastirildi: (resmi || []).length > 0, uyumlu: farklar.length === 0, farklar: farklar };
  }

  var API = {
    turListesi: turListesi, pilotGelisimi: pilotGelisimi, takimGelisimi: takimGelisimi, siralama: siralama, sonPuan: sonPuan,
    galibiyetPodyumPole: galibiyetPodyumPole, enCok: enCok, ozet: ozet, dogrula: dogrula, siniflandi: siniflandi
  };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
  if (kok) { kok.SezonHesap = API; }
})(typeof window !== "undefined" ? window : null);
