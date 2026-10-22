/* A6 — "YARIŞI KAÇIRDIYSAN" kartı: SAF HESAP KATMANI (DOM yok, ağ yok, depolama yok; Node'da test edilir).
   HAM VERİ → KISA ÖZET. Yorum, neden, tahmin, sıfat yoktur (yalnızca: P1, +8 sıra, DNF, "pole sahibi P3 oldu", "şampiyona lideri X").
   Yeni grid/net pozisyon mantığı YAZILMAZ: tek yarış, A3.2'nin (SezonHesapA32) mini modeli olarak ona verilir; durum (SIN/DNF/DNS/DSQ),
   örneklem (SIN ∧ grid>0 ∧ bitiş>0) ve net (= grid − bitiş) A3.2'den gelir. Pit çıkışı (grid 0) ve DNF/DNS/DSQ net hesabına girmez.
   Girdi (hepsi bellekte/önbellekte hazır veri; bu dosya hiçbir şey çağırmaz):
     { tur, liste: Jolpica Results[], pole: {k,a}|null, standings: Jolpica DriverStandings[]|null, sonTur: bool,
       lastik: bool (A3.4b bloğu uygun), feed: bool (Race Feed bağlantısı uygun) }
   Çıktı: { durum: "ok"|"yok", satirlar: [{ anahtar, etiket, parcalar, metin, alt? }], aksiyonlar: [{ id, ad }], metin }
     parcalar: string | { kod, ad } (pilot; arayüz mevcut pilot rozetiyle çizer). metin: düz metin (test/erişilebilirlik). */
(function (kok) {
  "use strict";

  var MAKS_SATIR = 6;           // kart en çok 6 satır (kazanan, podyum, yükselen, yarış dışı, pole, şampiyona); gerileyen yalnızca yer varsa
  var GERILEYEN_ESIK = 3;       // "en çok gerileyen" yalnızca anlamlıysa: en az 3 sıra net kayıp
  var DISI_GOSTER = 4;          // yarış dışı satırında en çok bu kadar isim; fazlası "+N"
  var ISIM_ESIT = 2;            // eşitlikte en çok iki isim; fazlası "+N"

  function A32() { return kok && kok.SezonHesapA32 ? kok.SezonHesapA32 : (typeof require !== "undefined" ? require("./sezon-hesap-a32.js") : null); }
  function sayi(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  function pilotOzet(r) {
    var d = r.Driver || {}, soyad = d.familyName || "", kod = d.code || soyad.slice(0, 3).toUpperCase();
    return { id: d.driverId, kod: kod, ad: soyad || kod, tam: ((d.givenName || "") + " " + soyad).trim() };
  }
  function pRef(p) { return { kod: p.kod, ad: p.ad }; }
  function duz(parcalar) { return parcalar.map(function (x) { return typeof x === "string" ? x : x.ad + " [" + x.kod + "]"; }).join(""); }
  function satir(anahtar, etiket, parcalar, alt) { var s = { anahtar: anahtar, etiket: etiket, parcalar: parcalar, metin: etiket + ": " + duz(parcalar) }; if (alt) { s.alt = alt; } return s; }

  // Pilot listesi: " · " ya da ", " ile birleştir; sınırı aşarsa "+N"
  function liste(pilotlar, ayrac, sinir) {
    var gor = pilotlar.slice(0, sinir), p = [];
    gor.forEach(function (x, i) { if (i) { p.push(ayrac); } p.push(pRef(x)); });
    if (pilotlar.length > sinir) { p.push(" +" + (pilotlar.length - sinir)); }
    return p;
  }

  function miniModel(liste_) {
    var rows = [], pil = {};
    liste_.forEach(function (r) {
      var o = pilotOzet(r); if (!o.id) { return; }
      pil[o.id] = o;
      rows.push({ p: o.id, t: r.Constructor ? r.Constructor.constructorId : "", g: r.grid, s: r.position, x: r.positionText, n: r.points, d: r.status });
    });
    var pilotlar = {}; Object.keys(pil).forEach(function (i) { pilotlar[i] = { k: pil[i].kod, a: pil[i].tam }; });
    return { model: { turlar: { 1: { n: 1, sprintMi: false, yaris: rows, sprint: [] } }, pilotlar: pilotlar, takimlar: {} }, rows: rows, pil: pil };
  }

  function ozet(g) {
    var bos = { durum: "yok", satirlar: [], aksiyonlar: [], metin: "" };
    var A = A32();
    if (!g || !A || !Array.isArray(g.liste) || !g.liste.length) { return bos; }
    var mm = miniModel(g.liste), rows = mm.rows, pil = mm.pil;
    if (!rows.length) { return bos; }
    var siniflandirilmis = rows.filter(function (r) { return A.durum(r) === "SIN"; });
    var p1 = siniflandirilmis.filter(function (r) { return sayi(r.s) === 1; })[0];
    if (!p1) { return bos; }                                       // kazanan yoksa (sonuç işlenmemiş) kart hiç çıkmaz

    var S = [];
    // 1 + 2: kazanan ve podyum (yalnızca sınıflandırılmış P1–P3; DSQ A3.2 durumuyla dışarıda)
    S.push(satir("kazanan", "Kazanan", [pRef(pil[p1.p]), " yarışı kazandı"]));
    var podyum = siniflandirilmis.filter(function (r) { var s = sayi(r.s); return s >= 1 && s <= 3; })
      .sort(function (a, b) { return sayi(a.s) - sayi(b.s); }).map(function (r) { return pil[r.p]; });
    S.push(satir("podyum", "Podyum", liste(podyum, " · ", 3)));

    // 3 (+ opsiyonel gerileyen): A3.2 hesapla → ornek.net ; sıralama A3.2 siraNet
    var h = A.hesapla(mm.model), ids = rows.map(function (r) { return r.p; }), sira = A.siraNet(h, ids);
    var yuk = null, ger = null;
    if (sira.length) {
      var en = h.pilot[sira[0]].ornek.net, son = h.pilot[sira[sira.length - 1]].ornek.net;
      if (en >= 1) {
        var yl = sira.filter(function (i) { return h.pilot[i].ornek.net === en; }).map(function (i) { return pil[i]; });
        yuk = satir("yukselen", "En çok yükselen", liste(yl, ", ", ISIM_ESIT).concat([", +" + en + " sıra"]));
      }
      if (son <= -GERILEYEN_ESIK) {
        var gl = sira.filter(function (i) { return h.pilot[i].ornek.net === son; }).map(function (i) { return pil[i]; });
        ger = satir("gerileyen", "En çok gerileyen", liste(gl, ", ", ISIM_ESIT).concat([", −" + (-son) + " sıra"]));
      }
    }
    if (yuk) { S.push(yuk); }

    // 4: yarış dışı (DNF/DNS/DSQ; neden belirtilmez; DIGER sayılmaz)
    var tur = { DNF: [], DNS: [], DSQ: [] };
    rows.forEach(function (r) { var d = A.durum(r); if (tur[d]) { tur[d].push(pil[r.p]); } });
    var disi = tur.DNF.concat(tur.DNS, tur.DSQ), disiSatir = null;
    if (disi.length) {
      var sirali = rows.filter(function (r) { return tur.DNF.concat(tur.DNS, tur.DSQ).some(function (p) { return p.id === r.p; }); }).map(function (r) { return pil[r.p]; });
      var ilk = disi.length + " pilot finiş göremedi: ";
      var alt = null, turSayisi = ["DNF", "DNS", "DSQ"].filter(function (k) { return tur[k].length; });
      if (turSayisi.length > 1 || tur.DNS.length || tur.DSQ.length) {
        alt = turSayisi.map(function (k) { return k + ": " + tur[k].map(function (p) { return p.ad; }).join(", "); }).join(" · ");
      }
      disiSatir = satir("disi", "Yarış dışı", [ilk].concat(liste(sirali, ", ", DISI_GOSTER), ["."]), alt);
      S.push(disiSatir);
    }

    // 5: pole → yarış sonucu (pole sahibi yalnızca sıralama P1; grid P1 pole sayılmaz)
    if (g.pole && (g.pole.k || g.pole.a)) {
      var pr = null;
      rows.forEach(function (r) {
        if (pr) { return; }
        var o = pil[r.p];
        if ((g.pole.k && o.kod === g.pole.k) || (!g.pole.k && g.pole.a && o.tam === g.pole.a)) { pr = r; }
      });
      if (pr) {
        var d = A.durum(pr), po = pil[pr.p], ps = null;
        if (d === "SIN") { ps = satir("pole", "Pole", [pRef(po), " · Yarış sonucu: P" + sayi(pr.s)]); }
        else if (d === "DNF" || d === "DNS" || d === "DSQ") { ps = satir("pole", "Pole", [pRef(po), " · Yarış sonucu: " + d]); }
        if (ps) { S.push(ps); }
      }
    }

    // 6: güncel şampiyona tablosu — yalnızca seçili yarış sezonun son tamamlanmış yarışıysa (sonTur) ve tablo hazırsa
    if (g.sonTur && Array.isArray(g.standings) && g.standings.length >= 2) {
      var a = g.standings[0], b = g.standings[1];
      if (a && b && a.Driver && b.Driver && isFinite(Number(a.points)) && isFinite(Number(b.points))) {
        var A1 = pilotOzet(a), B1 = pilotOzet(b), fark = Number(a.points) - Number(b.points);
        S.push(satir("sampiyona", "Güncel şampiyona tablosu", [pRef(A1), " lider. ", pRef(B1), " ile fark " + fark + " puan"]));
      }
    }

    // gerileyen: yalnızca anlamlıysa VE kart 6 satırı aşmıyorsa (yükselenin hemen altına)
    if (ger && S.length < MAKS_SATIR) {
      var yi = -1; S.forEach(function (s, i) { if (s.anahtar === "yukselen") { yi = i; } });
      if (yi < 0) { yi = S.map(function (s) { return s.anahtar; }).indexOf("podyum"); }
      S.splice(yi + 1, 0, ger);
    }

    var aks = [];
    if (g.lastik) { aks.push({ id: "lastik", ad: "Lastik stratejisini gör →" }); }
    if (g.feed) { aks.push({ id: "feed", ad: "Yarış akışını gör →" }); }
    return { durum: "ok", tur: g.tur, satirlar: S, aksiyonlar: aks, metin: S.map(function (s) { return s.metin + (s.alt ? " (" + s.alt + ")" : ""); }).join(" | ") };
  }

  // Seçili tur, takvimdeki son TAMAMLANMIŞ yarış mı? (başlangıç + 3 sa geçmişse tamamlanmış; sezon-veri.js ve Yarış Analizi seçicisiyle aynı kural)
  function sonBitenTur(takvim, simdi) {
    var en = null;
    (takvim || []).forEach(function (y) {
      var t = Date.parse(y.date + "T" + (y.time || "12:00:00Z"));
      if (isNaN(t) || !(t + 3 * 3600 * 1000 < simdi)) { return; }
      if (en == null || Number(y.round) > en) { en = Number(y.round); }
    });
    return en;
  }

  var API = { ozet: ozet, sonBitenTur: sonBitenTur, MAKS_SATIR: MAKS_SATIR, GERILEYEN_ESIK: GERILEYEN_ESIK };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
  if (kok) { kok.YarisOzetHesap = API; }
})(typeof window !== "undefined" ? window : null);
