/* A4.1 — Profil veri bağdaştırıcısı. YENİ HESAP YOK, YENİ API ÇAĞRISI YOK, yeni tercih anahtarı YOK.
   Pilot profili için gerekli parçaları MEVCUT katmanlardan okur ve tek nesnede birleştirir:
   - standings (sezonPilotlar, salt okunur): kimlik + sıra/puan/galibiyet  → 0 çağrı, anında
   - A3.1 modeli (SezonAnaliz.yukle; ortak önbellek): puan, podyum  → önbellek sıcaksa 0 çağrı; soğuksa ortak yükleme BİR kez (Grafik/Pilot & Pist ile paylaşılır)
   - A3.2 (SezonHesapA32), A3.3 (SezonHesapA33), A3.4a (SezonHesapA34): AYNI fonksiyonlar, AYNI girdi → Grafik ile birebir aynı sayılar
   - pole: YALNIZCA mevcut önbellekten (ağ çağrısı yok); veri sonradan gelirse AnalizMerkezi "pole" bildirimiyle yenilenir
   - Şampiyonluk sayısı: önce Şampiyonlar sekmesinin yüklü verisi (sampiyonlar); yoksa doğrulanmış statik yedek (icerik-pilotlar.js)
   Başka bir yükleme sürüyorsa (Grafik/Pilot & Pist) o bitene kadar beklenir; çift soğuk yükleme yapılmaz. */
(function () {
  "use strict";
  var SA = window.SezonAnaliz, H = window.SezonHesap, HA = window.SezonHesapA32, H33 = window.SezonHesapA33, H34 = window.SezonHesapA34, PS = window.PIST_SINIFLANDIRMA;
  if (!SA || !H || !HA) { return; }       // A3 yoksa profil kendini kapatır; mevcut sistem aynen çalışır
  var C = { model: null, an: null, p: null, bekleyen: null };

  var ULKE_TR = { "British": "İngiliz", "Italian": "İtalyan", "Dutch": "Hollandalı", "Monegasque": "Monakolu", "Australian": "Avustralyalı", "Spanish": "İspanyol", "French": "Fransız",
    "German": "Alman", "Finnish": "Fin", "Thai": "Tayland", "Canadian": "Kanadalı", "Mexican": "Meksikalı", "Japanese": "Japon", "Brazilian": "Brezilyalı", "Argentine": "Arjantinli",
    "New Zealander": "Yeni Zelandalı", "Danish": "Danimarkalı", "Chinese": "Çinli", "American": "Amerikalı", "Swedish": "İsveçli", "Austrian": "Avusturyalı", "Polish": "Polonyalı", "Belgian": "Belçikalı", "Swiss": "İsviçreli" };

  function sezonYili() { try { return typeof SEZON !== "undefined" ? SEZON : new Date().getFullYear(); } catch (e) { return new Date().getFullYear(); } }
  function standings() { try { return typeof sezonPilotlar !== "undefined" ? sezonPilotlar : []; } catch (e) { return []; } }
  function takimAdi(k) { return k && k.Constructors && k.Constructors.length ? k.Constructors[k.Constructors.length - 1].name : null; }
  function yas(dob) {
    var d = new Date(dob + "T00:00:00Z"); if (isNaN(d)) { return null; }
    var s = new Date(), a = s.getUTCFullYear() - d.getUTCFullYear();
    if (s.getUTCMonth() < d.getUTCMonth() || (s.getUTCMonth() === d.getUTCMonth() && s.getUTCDate() < d.getUTCDate())) { a--; }
    return a;
  }

  function standing(id) { return standings().filter(function (k) { return k.Driver && k.Driver.driverId === id; })[0] || null; }
  // Pilot kodu → driverId (standings önce; yoksa A3 modeli)
  function kodId(kod) {
    if (!kod) { return null; }
    kod = String(kod).trim().toUpperCase();
    var s = standings().filter(function (k) { return k.Driver && String(k.Driver.code || "").toUpperCase() === kod; });
    if (s.length === 1) { return s[0].Driver.driverId; }
    var m = C.model || amModel(), id;
    if (m) { for (id in m.pilotlar) { if (String(m.pilotlar[id].k).toUpperCase() === kod) { return id; } } }
    return null;
  }

  // ---- A3 modeli: mevcut yüklemelerden biri hazırsa onu al; sürüyorsa bekle; hiçbiri yoksa ortak yükleyiciyi (önbellek-öncelikli) çağır ----
  function amD() { return window.AnalizMerkezi && AnalizMerkezi._durum ? AnalizMerkezi._durum : null; }
  function amModel() { var s = amD(); return s && s.durum === "hazir" && s.model ? s.model : null; }
  function pkD() { return window.PilotKarsilastirma && PilotKarsilastirma._durum ? PilotKarsilastirma._durum : null; }
  function pkModel() { var d = pkD(); return d && d.durum === "hazir" && d.model ? d.model : null; }
  function digeriYukluyor() {
    var s = amD(), d = pkD();
    return !!((s && s.durum === "yukleniyor") || (d && d.durum === "yukleniyor"));
  }
  function bekle(ms) { return new Promise(function (c) { setTimeout(c, ms); }); }

  async function modelAl() {
    if (C.model) { return C.model; }
    var m = amModel() || pkModel();
    if (m) { C.model = m; return m; }
    if (C.bekleyen) { return C.bekleyen; }
    C.bekleyen = (async function () {
      try {
        for (var i = 0; i < 150 && digeriYukluyor(); i++) { await bekle(400); }   // en çok ~60 sn: diğer yükleme bitsin
        m = amModel() || pkModel();
        if (!m) { var r = await SA.yukle(sezonYili()); m = r.model; }
        C.model = m; return m;
      } finally { C.bekleyen = null; }
    })();
    return C.bekleyen;
  }

  // ---- takvim (ağ yok): round → circuitId ----
  function turPist() {
    var yarislar = null, h = {};
    try { var k = window.JolpicaIstemci && JolpicaIstemci.oku("takvim-" + sezonYili()), v = k && k.veri; yarislar = v && ((v.RaceTable && v.RaceTable.Races) || v.Races || (Array.isArray(v) ? v : null)); } catch (e) { yarislar = null; }
    if (!yarislar || !yarislar.length) { try { if (typeof sezonYarislar !== "undefined" && sezonYarislar.length) { yarislar = sezonYarislar; } } catch (e2) { /* yok */ } }
    (yarislar || []).forEach(function (y) { if (y && y.Circuit && y.Circuit.circuitId) { h[Number(y.round)] = y.Circuit.circuitId; } });
    return h;
  }

  // ---- pole: yalnızca mevcut önbellek ----
  function poleOnbellek(turlar) {
    var AMS = amD();
    if (AMS && AMS.pole === true && AMS.poleKod) { return AMS.poleKod; }
    var JI = window.JolpicaIstemci; if (!JI || !JI.oku) { return null; }
    var yil = sezonYili(), harita = {}, eksik = 0, toplu = null;
    try { toplu = JI.oku("sezon-" + yil + "-pole"); } catch (e) { toplu = null; }
    turlar.forEach(function (n) {
      var p = toplu && toplu.veri && toplu.veri.turlar && toplu.veri.turlar[n];
      if (!p) { try { var t = JI.oku("sezon-" + yil + "-pole-r" + n); p = t && t.veri && t.veri.pole; } catch (e) { p = null; } }
      if (p && p.k) { harita[n] = p.k; } else { eksik++; }
    });
    return eksik === 0 && turlar.length ? harita : null;
  }

  // A3 hesapları (model başına bir kez; pole ve takvim sonradan değişebilir → ayrı yenilenir)
  function analiz(model) {
    if (C.an && C.an.model === model) { return C.an; }
    var a = { model: model, g: H.pilotGelisimi(model), h32: HA.hesapla(model, 5), h33: H33 ? H33.hesapla(model) : null, h34: null, gt: H.takimGelisimi(model), tp: null, wpp: null, pole: false, poleKod: null };
    C.an = a; poleVeTakvim(a); return a;
  }
  function poleVeTakvim(a) {
    var pk = poleOnbellek(a.h32.turlar);
    a.poleKod = pk; a.pole = !!pk;
    a.wpp = H.galibiyetPodyumPole(a.model, pk);
    var tp = turPist(), imza = JSON.stringify(tp);
    if (H34 && PS && a.tpImza !== imza) { a.tpImza = imza; a.tp = tp; a.h34 = Object.keys(tp).length ? H34.hesapla(a.model, tp) : null; }
    return a;
  }
  function yenile() { if (C.an) { poleVeTakvim(C.an); } return C.an; }

  // ---- şampiyonluk: önce uygulama verisi (Şampiyonlar sekmesi), sonra statik yedek ----
  function sampiyonluk(st, bio) {
    var ad = st && st.Driver ? (st.Driver.givenName + " " + st.Driver.familyName).trim() : null;
    try {
      var liste = typeof sampiyonlar !== "undefined" ? sampiyonlar : null, yil = typeof BU_YIL !== "undefined" ? BU_YIL : new Date().getFullYear();
      if (ad && liste && liste.length && Number(liste[0].sezon) >= yil) {      // liste tamam (en yeni sezon yüklü)
        var yillar = liste.filter(function (k) { return Number(k.sezon) < yil && String(k.pilot).replace(/\s*\(lider\)\s*$/, "") === ad; }).map(function (k) { return Number(k.sezon); }).sort();
        return { sayi: yillar.length, yillar: yillar, kaynak: "uygulama" };
      }
    } catch (e) { /* statik yedeğe düş */ }
    if (bio && bio.sampiyonluk) { return { sayi: bio.sampiyonluk.sayi, yillar: bio.sampiyonluk.yillar || [], kaynak: "statik" }; }
    return null;
  }

  function bioAl(id) { var I = window.ICERIK_PILOTLAR; return I && I.pilotlar && I.pilotlar[id] ? I.pilotlar[id] : null; }

  // ---- ANA: pilot profili ----
  // Dönüş her zaman hemen gelir; A3 tabanlı bloklar (analiz hazır değilse) null'dır.
  function pilot(id, model) {
    var st = standing(id), m = model || C.model || amModel() || pkModel(), a = m ? analiz(m) : null;
    var mp = m && m.pilotlar && m.pilotlar[id];
    if (!st && !mp) { return null; }
    var bio = bioAl(id);
    var kimlik = {
      ad: st ? (st.Driver.givenName + " " + st.Driver.familyName).trim() : mp.a, kod: st ? (st.Driver.code || null) : mp.k,
      numara: st ? (st.Driver.permanentNumber || null) : null, takim: st ? takimAdi(st) : (m ? takimAdiModel(m, id) : null),
      uyruk: st && st.Driver.nationality ? (ULKE_TR[st.Driver.nationality] || st.Driver.nationality) : null, yas: st && st.Driver.dateOfBirth ? yas(st.Driver.dateOfBirth) : null
    };
    var sezon = { sira: st ? st.position : null, puan: st ? st.points : null, galibiyet: st ? st.wins : null, podyum: null, pole: null };
    var out = { id: id, kimlik: kimlik, sezon: sezon, perf: null, sprint: null, pist: null, bio: bio, sampiyonluk: sampiyonluk(st, bio), analizHazir: !!a, poleHazir: false };
    if (!a) { return out; }
    var w = a.wpp[id] || { galibiyet: 0, podyum: 0, pole: 0 };
    sezon.podyum = w.podyum; out.poleHazir = a.pole; sezon.pole = a.pole ? w.pole : null;
    if (sezon.puan == null && a.g.seri[id]) { sezon.puan = String(H.sonPuan(a.g, id)); }
    var p32 = a.h32.pilot[id];
    out.perf = p32 || { dnf: 0, dns: 0, dsq: 0, yarisSayisi: a.h32.yarisSayisi, ornek: { n: 0, ortStart: null, ortBitis: null, net: 0 }, form: [] };
    out.formTurlari = a.h32.formTurlari;
    if (a.h33) { var p33 = a.h33.pilot[id]; out.sprint = { mevcut: a.h33.sprintTurSayisi > 0, d: p33 || null, gpTur: a.h33.gpTurSayisi, sprintTur: a.h33.sprintTurSayisi }; }
    if (a.h34 && PS) {
      var P = a.h34.pilot[id] || {};
      out.pist = { siralama: PS.SIRA, kat: P, yarisSayisi: a.h34.yarisSayisi, enYuksek: H34.enYuksekOrtalama(P, PS.SIRA), kategoriler: PS.KATEGORILER };
    }
    return out;
  }
  function takimAdiModel(m, id) {
    var son = null, n;
    for (n in m.turlar) { (m.turlar[n].yaris || []).forEach(function (r) { if (r.p === id) { son = r.t; } }); }
    return son && m.takimlar ? (m.takimlar[son] || son) : null;
  }

  // =====================================================================================================
  // A4.2 — TAKIM profili. YENİ API ÇAĞRISI YOK, yeni tercih anahtarı YOK. Aynı A3 hesapları (A3.1 takım serisi, A3.4a takım pist türü) ve ortak model yüklemesi.
  //  - resmî constructor sıralaması: index.html'in zaten çektiği veri (takimlariCiz → "f1-takim-siralama" olayı); sıra/puan/galibiyet RESMÎ değerlerden gösterilir
  //  - hesaplanan sıra/puan/galibiyet ile resmî değer farklıysa SESSİZCE düzeltilmez: resmî değer gösterilir, fark ayrıca bildirilir
  //  - pilot katkısı: modeldeki ana yarış ve sprint satırlarından, o turda takım = r.t olan satırların puanı (takım değiştiren pilotun puanı turdaki takıma yazılır)
  // =====================================================================================================
  var CT = [];       // resmî constructor sıralaması: [{ id, ad, uyrukEn, sira, puan, galibiyet }]
  function ctKaydet(liste) {
    CT = (liste || []).map(function (k) {
      var c = k.Constructor || {};
      return { id: c.constructorId, ad: c.name, uyrukEn: c.nationality || null, sira: Number(k.position), puan: Number(k.points), galibiyet: Number(k.wins) };
    }).filter(function (x) { return x.id; });
  }
  document.addEventListener("f1-takim-siralama", function (e) { try { ctKaydet(e.detail && e.detail.liste); } catch (x) { /* önemsiz */ } });
  function resmiTakim(id) { return CT.filter(function (x) { return x.id === id; })[0] || null; }
  function takimlar() {
    if (CT.length) { return CT.map(function (x) { return { id: x.id, ad: x.ad }; }); }
    var m = C.model || amModel() || pkModel(), o = [];
    if (m && m.takimlar) { Object.keys(m.takimlar).forEach(function (id) { o.push({ id: id, ad: m.takimlar[id] }); }); }
    return o;
  }
  // Rozet metni (takım adı) veya kimlik → constructorId
  function takimId(ad) {
    if (!ad) { return null; }
    var a = String(ad).trim(), l = a.toLowerCase(), i, m = C.model || amModel() || pkModel();
    for (i = 0; i < CT.length; i++) { if (CT[i].id === a || String(CT[i].ad).toLowerCase() === l) { return CT[i].id; } }
    if (m && m.takimlar) { for (var id in m.takimlar) { if (id === a || String(m.takimlar[id]).toLowerCase() === l) { return id; } } }
    return null;
  }
  function takimBio(id) { var I = window.ICERIK_TAKIMLAR; return I && I.takimlar && I.takimlar[id] ? I.takimlar[id] : null; }
  function mevcutPilotlar(id) {
    return standings().filter(function (k) {
      var c = k.Constructors, son = c && c.length ? c[c.length - 1] : null, ct = resmiTakim(id), m = C.model || amModel() || pkModel();
      if (!son) { return false; }
      if (son.constructorId) { return son.constructorId === id; }
      var ad = String(son.name || "").toLowerCase(), hedef = ct ? ct.ad : (m && m.takimlar ? m.takimlar[id] : null);
      return !!hedef && ad === String(hedef).toLowerCase();
    }).map(function (k) { return { id: k.Driver.driverId, kod: k.Driver.code || null, ad: (k.Driver.givenName + " " + k.Driver.familyName).trim(), puan: Number(k.points) }; });
  }
  // Takım pole: pole pilotunun O TURDAKİ satırındaki takım = bu takım (yalnızca mevcut önbellekten; yoksa null)
  function takimPole(m, poleKod, id) {
    if (!poleKod) { return null; }
    var n = 0, tur;
    for (tur in poleKod) {
      var tr = m.turlar[tur], kod = poleKod[tur]; if (!tr) { continue; }
      var satir = (tr.yaris || []).concat(tr.sprint || []).filter(function (r) { var p = m.pilotlar[r.p]; return p && p.k === kod; })[0];
      if (satir && satir.t === id) { n++; }
    }
    return n;
  }
  function katki(m, id) {
    var h = {}, n;
    function al(p) { return h[p] || (h[p] = { id: p, gp: 0, sprint: 0, yarisSayisi: 0 }); }
    Object.keys(m.turlar).forEach(function (n) {
      (m.turlar[n].yaris || []).forEach(function (r) { if (r.t === id) { var x = al(r.p); x.gp += Number(r.n) || 0; x.yarisSayisi++; } });
      (m.turlar[n].sprint || []).forEach(function (r) { if (r.t === id) { al(r.p).sprint += Number(r.n) || 0; } });
    });
    var digerTakim = {};
    Object.keys(m.turlar).forEach(function (n) { (m.turlar[n].yaris || []).forEach(function (r) { if (r.t !== id && h[r.p]) { digerTakim[r.p] = true; } }); });
    return Object.keys(h).map(function (p) {
      var x = h[p], st = standing(p), mp = m.pilotlar[p];
      return { id: p, kod: st ? st.Driver.code : (mp ? mp.k : null), ad: st ? (st.Driver.givenName + " " + st.Driver.familyName).trim() : (mp ? mp.a : p),
               gp: x.gp, sprint: x.sprint, toplam: x.gp + x.sprint, digerTakim: !!digerTakim[p] };
    }).sort(function (a, b) { return b.toplam - a.toplam || (a.ad < b.ad ? -1 : 1); });
  }

  function takim(id, model) {
    var ct = resmiTakim(id), m = model || C.model || amModel() || pkModel(), a = m ? analiz(m) : null;
    var ad = ct ? ct.ad : (m && m.takimlar && m.takimlar[id]) || null;
    if (!ad) { return null; }
    var bio = takimBio(id), hesap = a && a.gt.seri[id] ? a.gt.seri[id] : null;
    var mevcut = mevcutPilotlar(id);
    var kimlik = { id: id, ad: ad, uyruk: ct && ct.uyrukEn ? (ULKE_TR[ct.uyrukEn] || ct.uyrukEn) : null, uyrukUlke: bio ? (bio.uyruk || null) : null,
      merkez: bio ? (bio.merkez || null) : null, merkezNot: bio ? (bio.merkezNot || null) : null, liderlik: bio && bio.liderlik ? bio.liderlik : [], powerUnit: bio ? (bio.powerUnit || null) : null, pilotlar: mevcut };
    var sezon = { sira: ct ? ct.sira : null, puan: ct ? ct.puan : null, galibiyet: ct ? ct.galibiyet : null, podyum: null, pole: null };
    var out = { id: id, kimlik: kimlik, sezon: sezon, katki: null, gelisim: null, pist: null, bio: bio, dogrulama: null, analizHazir: !!a, poleHazir: false, resmi: !!ct };
    if (!a) { return out; }
    var hs = hesap || { toplam: [], yaris: [], sprint: [], yerler: {} }, y = hs.yerler;
    sezon.podyum = (y[1] || 0) + (y[2] || 0) + (y[3] || 0);
    var hp = hs.toplam.length ? hs.toplam[hs.toplam.length - 1] : 0, hg = y[1] || 0;
    var sira = H.siralama(a.gt), hsira = sira.indexOf(id) + 1;
    if (!ct) { sezon.sira = hsira || null; sezon.puan = hp; sezon.galibiyet = hg; }       // resmî sıralama yoksa hesaplanan değer (not düşülür)
    else {
      var f = [];
      if (hsira && hsira !== ct.sira) { f.push({ alan: "sira", hesap: hsira, resmi: ct.sira }); }
      if (hp !== ct.puan) { f.push({ alan: "puan", hesap: hp, resmi: ct.puan }); }
      if (hg !== ct.galibiyet) { f.push({ alan: "galibiyet", hesap: hg, resmi: ct.galibiyet }); }
      out.dogrulama = { karsilastirildi: true, uyumlu: f.length === 0, farklar: f };
    }
    out.poleHazir = a.pole; sezon.pole = a.pole ? takimPole(m, a.poleKod, id) : null;
    out.katki = katki(m, id).map(function (x) { x.mevcut = mevcut.some(function (p) { return p.id === x.id; }); return x; });
    var n = hs.toplam.length, k = Math.min(5, n);
    out.gelisim = { turlar: a.gt.turlar, toplam: hs.toplam, sonTurSayisi: k, sonPuan: n ? hs.toplam[n - 1] - (n > k ? hs.toplam[n - 1 - k] : 0) : 0, sonTurlar: n ? a.gt.turlar.slice(n - k) : [] };
    if (a.h34 && PS) {
      var P = a.h34.takim[id] || {};
      out.pist = { siralama: PS.SIRA, kat: P, yarisSayisi: a.h34.yarisSayisi, enYuksek: H34.enYuksekOrtalama(P, PS.SIRA), kategoriler: PS.KATEGORILER };
    }
    return out;
  }

  window.ProfilVeri = { pilot: pilot, modelAl: modelAl, kodId: kodId, takim: takim, takimId: takimId, takimlar: takimlar, takimBio: takimBio, standing: standing, yenile: yenile, bioAl: bioAl, ULKE_TR: ULKE_TR, _durum: C };
})();
