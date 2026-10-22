/* A4.3 — "BİLMEN GEREKEN 5 ŞEY" (Yarış Haftası, yarış öncesi bağlam kartı). YENİ API ÇAĞRISI YOK, yeni tercih anahtarı YOK, yeni hesap sistemi YOK.
   İki katman:
   1) BilmenHesap.uret(girdi) — SAF fonksiyon (DOM/ağ yok; Node'da test edilir). Sabit öncelik sırasıyla (rastgelelik yok) 5 madde üretir.
   2) DOM katmanı — A1'in #sekme-hafta kapsayıcısına DOKUNMAZ; kendi kardeş kapsayıcısını (#a43-bilmen) kullanır, A1 yeniden çizince MutationObserver ile tazelenir.
   Veri yalnızca MEVCUT katmanlardan okunur (pasif): standings (sezonPilotlar), A3 modeli (bellekte varsa; yoksa yerel önbellekten AĞSIZ kurulur; SezonAnaliz.yukle() ASLA çağrılmaz; güncel olmayan model → son yarış/son 5 maddesi üretilmez), A3.2 (SezonHesapA32), A3.4a sınıflandırması,
   A1 takvim/seans (HaftaVeri/YarisHaftasi). Hazır olmayan veri → sıradaki alternatif madde. Yorum/tahmin/sebep metni yoktur: ham veri → kısa bağlam. */
(function (kok) {
  "use strict";

  // ---------- 1) SAF KATMAN ----------
  // Sabit öncelik sırası (kullanıcı onaylı): 1-5 ana maddeler, 6-12 alternatif havuz
  var SIRA = ["sampiyona", "sonyaris", "son5", "sprint", "pist", "galibiyet", "pole", "takvim", "kalan", "saat", "sprintsayisi", "yer", "kalanyaris"];
  var ETIKET = { sampiyona: "Şampiyona", sonyaris: "Son yarış", son5: "Son 5", sprint: "Sprint", pist: "Pist", galibiyet: "Galibiyet", pole: "Pole",
                 takvim: "Takvim", kalan: "Zaman", saat: "Yarış saati", sprintsayisi: "Sprint sayısı", yer: "Yer", kalanyaris: "Sezon sonu" };
  var IKON = { sampiyona: "trophy", sonyaris: "flag", son5: "chart", sprint: "zap", pist: "pin", galibiyet: "trophy", pole: "flag",
               takvim: "calendar", kalan: "calendar", saat: "stopwatch", sprintsayisi: "zap", yer: "pin", kalanyaris: "flag" };
  var TERIM = { sampiyona: "puan-sistemi", sprint: "sprint", pist: "pist-turu", pole: "pole", sprintsayisi: "sprint" };

  function listele(a) { return a.length <= 1 ? (a[0] || "") : a.slice(0, -1).join(", ") + " ve " + a[a.length - 1]; }
  function enCok(liste, alan) {   // [{ad, <alan>}] → { deger, adlar } (eşitlikler birlikte, giriş sırasıyla); en büyük değer 0 ise null
    var en = 0; liste.forEach(function (x) { if (x[alan] > en) { en = x[alan]; } });
    if (!en) { return null; }
    return { deger: en, adlar: liste.filter(function (x) { return x[alan] === en; }).map(function (x) { return x.ad; }) };
  }

  var KUR = {
    sampiyona: function (g) {
      var s = g.siralama; if (!s || s.length < 2) { return null; }
      var a = s[0], b = s[1], fark = a.puan - b.puan;
      if (!isFinite(fark)) { return null; }
      if (fark === 0) { return { metin: a.ad + " ve " + b.ad + " şampiyona liderliğinde eşit puanda." }; }
      return { metin: "Şampiyona lideri " + a.ad + ", ikinci " + b.ad + ". Aradaki fark " + fark + " puan." };
    },
    sonyaris: function (g) {
      var y = g.sonYaris; if (!y || !y.ad || !y.kazanan) { return null; }
      return { metin: "Son Grand Prix: " + y.ad + ". Kazanan: " + y.kazanan + "." };
    },
    son5: function (g) {
      var f = g.son5; if (!f || !f.adlar || !f.adlar.length || !(f.puan > 0)) { return null; }
      var n = f.tur || 5, on = "Son " + n + " Grand Prix'de ";
      return { metin: f.adlar.length === 1 ? on + "en çok puanı " + f.adlar[0] + " topladı: " + f.puan + " puan."
                                          : on + "en çok puanda eşitlik var: " + listele(f.adlar) + ", " + f.puan + " puan." };
    },
    sprint: function (g) {
      if (!g.sprint || !g.sprint.var) { return null; }       // Sprint olmayan hafta sonunda olumsuz madde yazılmaz; sıradaki alternatif gelir
      return { metin: "Bu hafta sonu Sprint formatı var." + (g.sprint.saat ? " Sprint: " + g.sprint.saat + " (TR saati)." : "") };
    },
    pist: function (g) {
      if (!g.pistKat || !g.pistKatAd) { return null; }
      return { metin: g.yarisAd + ", uygulama içi pist sınıflandırmasında " + g.pistKatAd + " pistidir." };
    },
    galibiyet: function (g) {
      var e = g.siralama ? enCok(g.siralama, "galibiyet") : null; if (!e) { return null; }
      return { metin: "Bu sezon en çok Grand Prix kazanan: " + listele(e.adlar) + " (" + e.deger + " galibiyet" + (e.adlar.length > 1 ? " ile eşit" : "") + ")." };
    },
    pole: function (g) {
      var e = g.pole ? enCok(g.pole, "sayi") : null; if (!e) { return null; }
      return { metin: "Bu sezon en çok pole alan: " + listele(e.adlar) + " (" + e.deger + " pole" + (e.adlar.length > 1 ? " ile eşit" : "") + ")." };
    },
    takvim: function (g) {
      if (!g.tur || !g.turSayisi) { return null; }
      return { metin: "Bu, sezonun " + g.tur + ". yarışı (takvimde " + g.turSayisi + " yarış var)." };
    },
    kalan: function (g) {
      if (g.gunKalan == null || g.gunKalan < 0) { return null; }
      return { metin: g.gunKalan === 0 ? "Yarış bugün." : "Yarışa " + g.gunKalan + " gün var." };
    },
    saat: function (g) {
      if (!g.yarisZaman) { return null; }
      return { metin: "Yarış: " + g.yarisZaman + " (Türkiye saati)." };
    },
    sprintsayisi: function (g) {
      if (!(g.sezonSprint > 0)) { return null; }
      return { metin: "Bu sezon takvimde " + g.sezonSprint + " Sprint hafta sonu var." };
    },
    kalanyaris: function (g) {
      if (!g.tur || !g.turSayisi || g.turSayisi < g.tur) { return null; }
      var k = g.turSayisi - g.tur;
      return { metin: k === 0 ? "Bu, sezonun son yarışı." : "Bu yarıştan sonra sezonda " + k + " yarış kalıyor." };
    },
    yer: function (g) {
      if (!g.pistAdi) { return null; }
      return { metin: "Pist: " + g.pistAdi + (g.yer ? ", " + g.yer : "") + (g.ulke ? " (" + g.ulke + ")" : "") + "." };
    }
  };

  // girdi → en çok 5 madde (her zaman aynı öncelik; veri yoksa sıradaki kullanılır)
  function uret(g) {
    var cikti = [];
    for (var i = 0; i < SIRA.length && cikti.length < 5; i++) {
      var k = SIRA[i], r = null;
      try { r = KUR[k](g || {}); } catch (e) { r = null; }
      if (r && r.metin) { cikti.push({ anahtar: k, etiket: ETIKET[k], ikon: IKON[k], terim: TERIM[k] || null, metin: r.metin, alt: r.alt || null }); }
    }
    return cikti;
  }
  var API = { uret: uret, SIRA: SIRA, ETIKET: ETIKET };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
  if (kok) { kok.BilmenHesap = API; }
  if (!kok || typeof document === "undefined") { return; }

  // ---------- 2) DOM KATMANI ----------
  var V = kok.HaftaVeri, YH = kok.YarisHaftasi, F = kok.F1UI;
  if (!V || !YH || !YH._durum || !F) { return; }
  var ANA = V.ANA_TZ, SA = kok.SezonHesapA32, PS = kok.PIST_SINIFLANDIRMA;
  var son = null;

  function standings() { try { return typeof sezonPilotlar !== "undefined" && sezonPilotlar.length ? sezonPilotlar : null; } catch (e) { return null; } }   // üst düzey let değişkeni (salt okunur)
  var MEMO = { imza: null, model: null };
  function onbellekModel(yarislar) {      // PASİF: yalnızca localStorage okur, ağ çağrısı ve SezonAnaliz.yukle() YOK
    var SA3 = kok.SezonAnaliz, JI = kok.JolpicaIstemci;
    if (!SA3 || !SA3._ic || !SA3._ic.modelKur || !JI || !JI.oku) { return null; }
    var yil = yarislar.length ? Number(yarislar[0].season) : new Date().getFullYear();
    var r = JI.oku("sezon-" + yil + "-a3-sonuc"), sp = JI.oku("sezon-" + yil + "-a3-sprint");
    if (!r || !r.veri || !Array.isArray(r.veri.satir)) { return null; }
    var imza = (r.t || 0) + "|" + (sp ? sp.t || 0 : 0) + "|" + yarislar.length;
    if (MEMO.imza === imza) { return MEMO.model; }
    var m = null;
    try { m = SA3._ic.modelKur(yil, r.veri, sp && sp.veri && Array.isArray(sp.veri.satir) ? sp.veri : null, yarislar); } catch (e) { m = null; }
    MEMO.imza = imza; MEMO.model = m; return m;
  }
  function modelAl(yarislar) {  // PASİF: bellekte hazır model; yoksa yerel önbellekten ağsız kurulur; yeni yükleme başlatılmaz
    var pv = kok.ProfilVeri && ProfilVeri._durum && ProfilVeri._durum.model; if (pv) { return pv; }
    var am = kok.AnalizMerkezi && AnalizMerkezi._durum; if (am && am.durum === "hazir" && am.model) { return am.model; }
    var pk = kok.PilotKarsilastirma && PilotKarsilastirma._durum; if (pk && pk.durum === "hazir" && pk.model) { return pk.model; }
    return onbellekModel(yarislar);
  }
  function yarisBitisMs(y) {
    var sure = 2 * 3600 * 1000;
    try { sure = kok.SERI_AYARLARI.f1.seanslar.Race.sureDk * 60000; } catch (e) { /* varsayılan */ }
    return new Date(y.date + "T" + (y.time || "12:00:00Z")).getTime() + sure;
  }
  function soyad(st) { return st && st.Driver ? st.Driver.familyName : null; }
  function adModel(m, id) {
    var st = (standings() || []).filter(function (k) { return k.Driver && k.Driver.driverId === id; })[0];
    if (st) { return soyad(st); }
    var p = m && m.pilotlar && m.pilotlar[id]; return p && p.a ? String(p.a).trim().split(/\s+/).slice(-1)[0] : id;
  }
  function gunSay(a, b) {      // "dd.mm.yyyy" (tr-TR gün anahtarı) → takvim günü farkı
    function p(s) { var x = String(s).split("."); return Date.UTC(Number(x[2]), Number(x[1]) - 1, Number(x[0])); }
    return Math.round((p(b) - p(a)) / 86400000);
  }

  function girdiKur(S) {
    var h = S.hafta, g = { yarisAd: h.ad, tur: h.tur, turSayisi: S.yarislar.length, pistAdi: h.pistAdi, yer: h.yer, ulke: h.ulke };
    var yarisSeans = h.seanslar.filter(function (s) { return s.anahtar === "Race"; })[0];
    if (yarisSeans) {
      var bugun = V.gunAnahtari(new Date(), ANA), hedef = V.gunAnahtari(yarisSeans.baslangic, ANA);
      if (bugun && hedef) { g.gunKalan = gunSay(bugun, hedef); }
      g.yarisZaman = V.gunYaz(yarisSeans.baslangic, ANA) + ", " + V.saatYaz(yarisSeans.baslangic, ANA);
    }
    var sp = h.seanslar.filter(function (s) { return s.anahtar === "Sprint"; })[0];
    g.sprint = { var: !!h.sprintMi, saat: sp ? String(V.gunYaz(sp.baslangic, ANA)).split(" ").pop() + " " + V.saatYaz(sp.baslangic, ANA) : null };   // "Cumartesi 12:00" (A1 saat dönüşümü)
    g.sezonSprint = S.yarislar.filter(function (y) { return y.Sprint && y.Sprint.date; }).length;
    var kat = PS && PS.kategoriOf ? PS.kategoriOf(h.pistId) : null;
    if (kat) { g.pistKat = kat; g.pistKatAd = PS.KATEGORILER[kat].ad; }
    var st = standings();
    if (st) {
      g.siralama = st.slice().sort(function (a, b) { return Number(a.position) - Number(b.position); }).map(function (k) {
        return { ad: soyad(k), puan: Number(k.points), galibiyet: Number(k.wins) };
      });
    }
    var m = modelAl(S.yarislar);
    if (m) {
      // GÜNCEL OLMAYAN VERİ KORUMASI: "son yarış" = takvime göre bitmiş en son ana yarış. Model o turu içermiyorsa madde ÜRETİLMEZ
      // (eski bir yarış "son yarış" diye gösterilmez); alternatif havuz tamamlar.
      var simdi = Date.now();
      var bitenler = S.yarislar.filter(function (y) { return yarisBitisMs(y) <= simdi; }).map(function (y) { return Number(y.round); }).sort(function (a, b) { return a - b; });
      var tur = bitenler.length ? bitenler[bitenler.length - 1] : null;
      var turV = tur != null && m.turlar[tur] && m.turlar[tur].yaris && m.turlar[tur].yaris.length;
      if (turV) {
        var kz = m.turlar[tur].yaris.filter(function (r) { return /^\d+$/.test(String(r.x)) && Number(r.s) === 1; })[0];
        var kayit = S.yarislar.filter(function (y) { return Number(y.round) === tur; })[0];
        g.sonYaris = kz ? { ad: m.turlar[tur].ad || (kayit && kayit.raceName) || ("Tur " + tur), kazanan: adModel(m, kz.p) } : null;
      }
      if (SA && turV) {
        var h32 = null; try { h32 = SA.hesapla(m, 5); } catch (e) { h32 = null; }
        var beklenen = bitenler.slice(-5);                 // son 5 = takvime göre bitmiş son 5 ana yarış; model aynı turları içermiyorsa hesap yapılmaz
        if (h32 && h32.pilot && JSON.stringify(h32.formTurlari || []) === JSON.stringify(beklenen)) {
          var liste = Object.keys(h32.pilot).map(function (id) { return { id: id, puan: h32.pilot[id].form5Puan }; });
          var en = 0; liste.forEach(function (x) { if (x.puan > en) { en = x.puan; } });
          g.son5 = { puan: en, tur: beklenen.length, adlar: liste.filter(function (x) { return en > 0 && x.puan === en; }).map(function (x) { return adModel(m, x.id); }) };
        }
      }
      var am = kok.AnalizMerkezi && AnalizMerkezi._durum;
      if (am && am.pole === true && am.poleKod) {       // pole yalnızca halihazırda önbellekte hazırsa
        var say = {}, kodAd = {};
        Object.keys(m.pilotlar).forEach(function (id) { kodAd[m.pilotlar[id].k] = id; });
        Object.keys(am.poleKod).forEach(function (t) { var id = kodAd[am.poleKod[t]]; if (id) { say[id] = (say[id] || 0) + 1; } });
        g.pole = Object.keys(say).map(function (id) { return { ad: adModel(m, id), sayi: say[id] }; });
      }
    }
    return g;
  }

  function uygulanabilir(S) {       // yalnızca SIRADAKİ yarış veya DEVAM EDEN hafta sonu; bitmiş/seçilmiş geçmiş yarışta gizli
    if (!S.hafta || !S.yarislar.length || S.aktifSayfa !== "hafta") { return false; }
    var v = V.varsayilanTur(S.yarislar); if (!v || Number(v.round) !== Number(S.tur) || S.hafta.tur !== Number(S.tur)) { return false; }
    var r = S.hafta.seanslar.filter(function (s) { return s.anahtar === "Race"; })[0]; if (!r) { return false; }
    var d = V.seansDurumu(r, S.hafta);
    return d === "yaklasan" || d === "canli";
  }

  function esc(x) { return F.esc(x); }
  function html(maddeler) {
    return "<h2 class='bm-baslik' id='bm-b'>Bilmen gereken 5 şey</h2><ol class='bm-liste'>" + maddeler.map(function (m, i) {
      var bilgi = m.terim && kok.ICERIK && ICERIK.sozluk && ICERIK.sozluk.terimler[m.terim]
        ? " <button type='button' class='a2-i' data-terim='" + esc(m.terim) + "' aria-haspopup='dialog' aria-label='" + esc(ICERIK.sozluk.terimler[m.terim].ad) + " nedir?' title='" + esc(ICERIK.sozluk.terimler[m.terim].ad) + " nedir?'></button>" : "";
      return "<li class='bm-m' data-bm='" + esc(m.anahtar) + "'><details class='bm-d'><summary class='bm-s'><span class='bm-no' aria-hidden='true'>" + String(i + 1).padStart(2, "0") + "</span><span class='bm-ik' aria-hidden='true'>" + F.ikon(m.ikon, 18) + "</span>" +
        "<div class='bm-ic'><span class='bm-et'>" + esc(m.etiket) + "</span><span class='bm-tx'>" + esc(m.metin) + bilgi + "</span></div></summary>" + (m.alt ? "<span class='bm-alt'>" + esc(m.alt) + "</span>" : "") + "</details></li>";
    }).join("") + "</ol>";
  }

  function ciz() {
    var el = document.getElementById("a43-bilmen"), a = document.getElementById("sekme-hafta"); if (!el || !a) { return; }
    var S = YH._durum, goster = false, h = "";
    if (!a.hidden && uygulanabilir(S)) {
      var maddeler = uret(girdiKur(S));
      if (maddeler.length) { h = html(maddeler); goster = true; }
    }
    el.hidden = !goster;
    if (h !== son) {
      el.innerHTML = h; son = h;
      try { if (goster && kok.Ogren && Ogren.tara) { Ogren.tara(el); } } catch (e) { /* ⓘ olmadan devam */ }
    }
  }
  var bekliyor = false;
  function planla() { if (bekliyor) { return; } bekliyor = true; Promise.resolve().then(function () { bekliyor = false; try { ciz(); } catch (e) { /* kart hatası A1'i etkilemez */ } }); }

  function baslat() {
    var a = document.getElementById("sekme-hafta"); if (!a) { return; }
    new MutationObserver(planla).observe(a, { childList: true, attributes: true, attributeFilter: ["hidden"] });   // A1 yeniden çizince / sekme değişince
    document.addEventListener("f1-takim-siralama", planla);                                                          // standings geldi
    try { if (kok.AnalizMerkezi && AnalizMerkezi.dinle) { AnalizMerkezi.dinle(planla); } } catch (e) { /* önemsiz */ }  // A3 modeli / pole hazır
    planla();
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", baslat); } else { baslat(); }
  kok.HaftaBilmen = { yenile: planla };
})(typeof window !== "undefined" ? window : null);
