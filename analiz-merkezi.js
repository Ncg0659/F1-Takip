/* A3.1 — Sezon Analiz Merkezi (Grafik sekmesi). Kapsayıcı: #a3-merkez (#sekme-grafik içinde).
   Bölümler: Sezon özeti · Şampiyona puan gelişimi · Galibiyet/Podyum/Pole · Takım puan gelişimi (A3.1).
   Veri: SezonAnaliz (tam sonuç + sprint, sayfalı) + SezonVeri (A2, yalnızca POLE için; ortak önbellek). Hesap: SezonHesap (saf).
   Grafikler: SvgGrafik (saf SVG, CDN yok).
   ESKİ GRAFİK: #sekme-grafik[data-a3="1"] iken eski puan grafiği gizlenir ve eski yükleyici (grafikHazirla) ÇAĞRILMAZ
   (index.html'deki tek satırlık kanca AnalizMerkezi.eskiyiBekle() sorar). A3 başarısız olursa data-a3 kalkar ve eski grafik yedek olarak çalışır.
   index.html'deki hiçbir fonksiyonu değiştirmez; yalnızca #btn-grafik'e dinleyici ekler, sezonPilotlar / #takim-govde'yi OKUR (doğrulama). */
(function () {
  "use strict";
  var F = window.F1UI, H = window.SezonHesap, SA = window.SezonAnaliz, SG = window.SvgGrafik;
  var K_PILOT = "f1-ogren-v1-a3-pilotlar", K_TAKIM = "f1-ogren-v1-a3-takimlar", K_GORUNUM = "f1-ogren-v1-a3-gorunum", K_METRIK = "f1-ogren-v1-a3-metrik";
  var MAKS_SECIM = 6, VARSAYILAN = 5;
  var S = { durum: "bos", model: null, sonuc: null, g: null, gt: null, sira: [], siraT: [], wpp: {}, poleKod: null, pole: null /* null: yükleniyor, false: yok */,
            sec: { pilot: [], takim: [] }, vurgu: { pilot: null, takim: null }, gorunum: "puan", metrik: "galibiyet", tablo: { pilot: false, takim: false },
            dogrulama: null, yukleniyor: false, poleYukleniyor: false, grafik: {}, dogrulamaZ: null, hata: "" };

  // A3.2 gibi ek bölümler için olay kancası: bildir("ciz" | "ozet" | "pole" | "secim") — dinleyiciler S'yi YALNIZCA OKUR
  var DINLEYICILER = [];
  function bildir(neden) { DINLEYICILER.slice().forEach(function (f) { try { f(neden, S); } catch (e) { /* bir dinleyicinin hatası A3.1'i bozmaz */ } }); }

  function esc(x) { return F ? F.esc(x) : String(x); }
  function sezonYili() { try { return typeof SEZON !== "undefined" ? SEZON : new Date().getFullYear(); } catch (e) { return new Date().getFullYear(); } }
  function kok() { return document.getElementById("a3-merkez"); }
  function bolum() { return document.getElementById("sekme-grafik"); }
  function oku(k, v) { try { var x = JSON.parse(localStorage.getItem(k)); return x == null ? v : x; } catch (e) { return v; } }
  function yaz(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* önemsiz */ } }
  // [[terim]] işaretleri A2 ⓘ sistemiyle işlenir; sistem yoksa düz metin
  function isle(s) { try { if (window.Ogren && Ogren.isle) { return Ogren.isle(s); } } catch (e) { /* düz metin */ } return esc(String(s).replace(/\[\[[^\]]+\]\]/g, "")); }
  function soyad(id) { var p = S.model.pilotlar[id]; return p ? p.a.split(" ").slice(-1)[0] : id; }
  function kod(id) { var p = S.model.pilotlar[id]; return p ? p.k : id; }

  // ---- görsel yardımcılar ----
  function sonTakim(id) {            // pilotun en son göründüğü takım (sezon ortası değişiklik olabilir)
    var turlar = H.turListesi(S.model), t = null;
    turlar.forEach(function (n) { ["yaris", "sprint"].forEach(function (a) { S.model.turlar[n][a].forEach(function (r) { if (r.p === id) { t = r.t; } }); }); });
    return t;
  }
  function renkTakim(tid) {
    var ad = S.model.takimlar[tid] || "", t = F && F.takimTemasi ? F.takimTemasi(ad) : null;
    return "var(--a3-c-" + (t ? t.key : "diger") + ")";
  }
  function takimAd(tid) { return S.model.takimlar[tid] || tid; }
  function sayiYaz(v) { return Math.round(v * 10) / 10; }

  // ---- seçim ----
  function varsayilanSecim(sira, favori) {
    var s = sira.slice(0, VARSAYILAN);
    if (favori && sira.indexOf(favori) >= 0 && s.indexOf(favori) < 0) { s.push(favori); }
    return s;
  }
  function secimleriKur() {
    var favori = ""; try { favori = localStorage.getItem("f1-favori") || ""; } catch (e) { favori = ""; }
    var kp = oku(K_PILOT, null), kt = oku(K_TAKIM, null);
    S.sec.pilot = Array.isArray(kp) ? kp.filter(function (id) { return S.sira.indexOf(id) >= 0; }).slice(0, MAKS_SECIM) : [];
    if (!S.sec.pilot.length) { S.sec.pilot = varsayilanSecim(S.sira, favori); }
    S.sec.takim = Array.isArray(kt) ? kt.filter(function (id) { return S.siraT.indexOf(id) >= 0; }).slice(0, MAKS_SECIM) : [];
    if (!S.sec.takim.length) { S.sec.takim = S.siraT.slice(0, VARSAYILAN); }
    var gv = oku(K_GORUNUM, "puan"); S.gorunum = gv === "fark" ? "fark" : "puan";
    var mt = oku(K_METRIK, "galibiyet"); S.metrik = ["galibiyet", "podyum", "pole"].indexOf(mt) >= 0 ? mt : "galibiyet";
  }

  // ---- seriler ----
  function seriler(grup) {
    var g = grup === "pilot" ? S.g : S.gt, ids = S.sec[grup], gorulen = {}, n = g.turlar.length;
    return ids.map(function (id) {
      var s = g.seri[id]; if (!s) { return null; }
      var tid = grup === "pilot" ? sonTakim(id) : id, kesik = false;
      if (grup === "pilot") { if (gorulen[tid]) { kesik = true; } gorulen[tid] = true; }
      var deger = S.gorunum === "fark" ? s.toplam.map(function (v, i) { return v - g.lider[i]; }) : s.toplam.slice();
      return { id: id, kod: grup === "pilot" ? kod(id) : takimKisa(id), ad: grup === "pilot" ? soyad(id) : takimAd(id), renk: renkTakim(tid), kesik: kesik, deger: deger, toplam: s.toplam, yaris: s.yaris, sprint: s.sprint,
               soluk: !!(S.vurgu[grup] && S.vurgu[grup] !== id), n: n };
    }).filter(Boolean);
  }
  function takimKisa(tid) { var ad = takimAd(tid), t = F && F.takimTemasi ? F.takimTemasi(ad) : null; return t ? t.displayName.slice(0, 3) : String(ad).slice(0, 3).toUpperCase(); }
  function turBasligi(g, i) {
    var n = g.turlar[i], t = S.model.turlar[n];
    return "Tur " + n + " · " + (t ? t.ad : "") + (t && t.sprintMi ? " · sprint hafta sonu" : "");
  }
  function ipucu(grup) {
    return function (i) {
      var g = grup === "pilot" ? S.g : S.gt, ss = seriler(grup).slice().sort(function (a, b) { return b.toplam[i] - a.toplam[i]; });
      var t = S.model.turlar[g.turlar[i]], yarisVar = t && t.yaris.length;
      var h = "<div class='sg-ip-bas'>" + esc(turBasligi(g, i)) + (yarisVar ? "" : " · ana yarış henüz yok") + "</div>";
      ss.forEach(function (s) {
        var ek = "";
        if (s.yaris[i] || s.sprint[i]) { ek = "+" + sayiYaz(s.yaris[i]) + (s.sprint[i] ? " +" + sayiYaz(s.sprint[i]) + " sprint" : ""); }
        var ana = S.gorunum === "fark" ? sayiYaz(s.deger[i]) + " <span class='sg-ip-ek'>(" + sayiYaz(s.toplam[i]) + " puan)</span>" : sayiYaz(s.toplam[i]);
        h += "<div class='sg-ip-satir'><span class='sg-ip-ad'><i class='sg-ip-nokta' style='background:" + s.renk + "'></i><b>" + esc(s.kod) + "</b></span><span><b>" + ana + "</b> <span class='sg-ip-ek'>" + esc(ek) + "</span></span></div>";
      });
      return h;
    };
  }
  function ozetMetni(grup) {
    return function (i) {
      var g = grup === "pilot" ? S.g : S.gt;
      return turBasligi(g, i) + ": " + seriler(grup).slice().sort(function (a, b) { return b.toplam[i] - a.toplam[i]; }).map(function (s) { return s.ad + " " + sayiYaz(s.toplam[i]) + " puan"; }).join(", ");
    };
  }

  // ---- HTML parçaları ----
  function chipler(grup) {
    var g = grup === "pilot" ? S.g : S.gt;
    var chips = seriler(grup).map(function (s) {
      var vur = S.vurgu[grup] === s.id;
      return "<span class='a3-chip" + (vur ? " vurgulu" : "") + "' style='--c:" + s.renk + "'>" +
             "<button type='button' class='a3-chip-ad' data-a3-chip='" + grup + "' data-id='" + esc(s.id) + "' aria-pressed='" + vur + "' title='Vurgula / vurguyu kaldır'><i class='a3-nokta" + (s.kesik ? " kesik" : "") + "'></i>" + esc(grup === "pilot" ? s.kod : s.ad) + "</button>" +
             "<button type='button' class='a3-chip-x' data-a3-cikar='" + grup + "' data-id='" + esc(s.id) + "' aria-label='" + esc(s.ad) + " grafikten çıkar'>×</button></span>";
    }).join("");
    var kalan = (grup === "pilot" ? S.sira : S.siraT).filter(function (id) { return S.sec[grup].indexOf(id) < 0; });
    var dolu = S.sec[grup].length >= MAKS_SECIM;
    var secenek = "<option value=''>" + (dolu ? "En çok " + MAKS_SECIM + " seçim" : (grup === "pilot" ? "+ Pilot ekle" : "+ Takım ekle")) + "</option>" +
      kalan.map(function (id) { return "<option value='" + esc(id) + "'>" + esc(grup === "pilot" ? kod(id) + " · " + soyad(id) : takimAd(id)) + "</option>"; }).join("");
    return "<div class='a3-chipler'>" + chips + "<select class='a3-ekle' data-a3-ekle='" + grup + "' aria-label='" + (grup === "pilot" ? "Pilot ekle" : "Takım ekle") + "'" + (dolu ? " disabled" : "") + ">" + secenek + "</select>" +
           "<button type='button' class='a3-link' data-a3-sifirla='" + grup + "'>İlk " + VARSAYILAN + "</button></div>";
  }
  function tabloHtml(grup) {
    var g = grup === "pilot" ? S.g : S.gt, ss = seriler(grup);
    var h = "<div class='a3-tablo-kap'><table class='a3-tablo'><caption>Kümülatif puan (sprint puanları dahil)</caption><thead><tr><th scope='col'>Tur</th>" +
      ss.map(function (s) { return "<th scope='col'>" + esc(s.kod) + "</th>"; }).join("") + "</tr></thead><tbody>";
    g.turlar.forEach(function (n, i) {
      var t = S.model.turlar[n];
      h += "<tr><th scope='row' title='" + esc(t ? t.ad : "") + "'>" + n + (t && t.sprintMi ? "<sup>S</sup>" : "") + "</th>" + ss.map(function (s) { return "<td>" + sayiYaz(s.toplam[i]) + "</td>"; }).join("") + "</tr>";
    });
    return h + "</tbody></table></div>";
  }
  function kontrolGorunum() {
    return "<div class='a3-segment' role='group' aria-label='Görünüm'>" +
      "<button type='button' data-a3-gorunum='puan' aria-pressed='" + (S.gorunum === "puan") + "'>Puan</button>" +
      "<button type='button' data-a3-gorunum='fark' aria-pressed='" + (S.gorunum === "fark") + "'>Liderle fark</button></div>";
  }
  function cizgiKart(grup, baslik, id, not) {
    return "<section class='a3-kart' id='" + id + "'><h2>" + isle(baslik) + "</h2>" +
      (not ? "<p class='a3-not'>" + isle(not) + "</p>" : "") +
      "<div class='a3-kontrol'>" + (grup === "pilot" ? kontrolGorunum() : "") + "</div>" +
      "<div class='a3-secici' data-a3-secici='" + grup + "'></div>" +
      "<div class='a3-grafik' data-a3-grafik='" + grup + "'></div>" +
      "<button type='button' class='a3-link a3-tablo-dugme' data-a3-tablo='" + grup + "' aria-expanded='false'>Tabloyu göster</button>" +
      "<div class='a3-tablo-yer' data-a3-tabloyer='" + grup + "' hidden></div></section>";
  }

  function ozetKart(etiket, ana, alt, takim) { return "<div class='a3-oz'><span class='a3-oz-et'>" + isle(etiket) + "</span><b class='a3-oz-ana'>" + ana + "</b>" + (takim ? "<span class='a3-oz-takim'>" + takim + "</span>" : "") + "<span class='a3-oz-alt'>" + alt + "</span></div>"; }
  // FINAL UI: pilot adının altında takım rozeti (eşitlikte en çok 3 pilotun, tekrarsız takımları)
  function takimRozetleri(ids) {
    if (!F || !F.takimRozeti) { return ""; }
    var gor = {}, h = [];
    (ids || []).slice(0, 3).forEach(function (id) { var t = sonTakim(id); if (t && !gor[t]) { gor[t] = 1; h.push(F.takimRozeti(takimAd(t))); } });
    return h.join(" ");
  }
  function adlar(ids) {
    var ad = ids.slice(0, 3).map(function (id) { return esc(soyad(id)); }).join(" · ");
    return ad + (ids.length > 3 ? " +" + (ids.length - 3) : "");
  }
  function ozetHtml() {
    var oz = H.ozet(S.model, S.g, S.sira, S.wpp, !!S.poleKod);
    var lider = oz.lider;
    var h = "";
    h += ozetKart("LİDER", lider ? esc(soyad(lider.id)) : "—", lider ? lider.puan + " puan" + (lider.fark != null ? " · 2. ile fark " + lider.fark : "") : "", lider ? takimRozetleri([lider.id]) : "");
    h += ozetKart("EN ÇOK GALİBİYET", oz.galibiyet.kimlikler.length ? adlar(oz.galibiyet.kimlikler) : "—", oz.galibiyet.deger ? oz.galibiyet.deger + " galibiyet" + (oz.galibiyet.kimlikler.length > 1 ? " (eşit)" : "") : "", takimRozetleri(oz.galibiyet.kimlikler));
    h += ozetKart("EN ÇOK [[podyum]]", oz.podyum.kimlikler.length ? adlar(oz.podyum.kimlikler) : "—", oz.podyum.deger ? oz.podyum.deger + " podyum" + (oz.podyum.kimlikler.length > 1 ? " (eşit)" : "") : "", takimRozetleri(oz.podyum.kimlikler));
    var poleAna = S.pole === null ? "…" : (oz.pole && oz.pole.kimlikler.length ? adlar(oz.pole.kimlikler) : "—");
    var poleAlt = S.pole === null ? "Pole verisi yükleniyor" : (S.pole === false ? "Pole verisi alınamadı" : (oz.pole && oz.pole.deger ? oz.pole.deger + " pole" + (oz.pole.kimlikler.length > 1 ? " (eşit)" : "") : ""));
    h += ozetKart("EN ÇOK [[pole]]", poleAna, poleAlt, S.pole && oz.pole ? takimRozetleri(oz.pole.kimlikler) : "");
    return h;
  }
  function baslikAlt() {
    var n = H.turListesi(S.model).filter(function (t) { return S.model.turlar[t].yaris.length; }).length;
    var toplam = S.sonuc && S.sonuc.toplamTur ? " / " + S.sonuc.toplamTur : "";
    var sp = H.ozet(S.model, S.g, S.sira, S.wpp, false).sprintSayisi;
    return esc(sezonYili()) + " · " + n + toplam + " yarış tamamlandı" + (sp ? " · " + sp + " sprint" : "");
  }
  function wppHtml() {
    var m = S.metrik, ad = { galibiyet: "Galibiyet", podyum: "Podyum", pole: "Pole" };
    var sekmeler = ["galibiyet", "podyum", "pole"].map(function (k) {
      return "<button type='button' data-a3-metrik='" + k + "' aria-pressed='" + (m === k) + "'>" + ad[k] + "</button>";
    }).join("");
    return "<section class='a3-kart' id='a3-wpp'><h2>Galibiyet · Podyum · Pole</h2>" +
      "<p class='a3-not'>" + isle("Yalnızca ana yarış sonuçları: sprint galibiyeti ve podyumu bu sayılara karışmaz [[sprint]]. Pole yalnızca sıralama P1'dir [[pole]]; yarışta P1'den başlamak pole sayılmaz.") + "</p>" +
      "<div class='a3-kontrol'><div class='a3-segment' role='group' aria-label='Ölçüt'>" + sekmeler + "</div></div>" +
      "<div class='a3-grafik' data-a3-wppgrafik></div><div class='a3-wpp-not' data-a3-wppnot></div>" +
      "<details class='a3-detay'><summary>Tüm pilotlar (tablo)</summary><div data-a3-wpptablo></div></details></section>";
  }
  function wppIc() {
    var m = S.metrik, kap = kok().querySelector("[data-a3-wppgrafik]"), not = kok().querySelector("[data-a3-wppnot]");
    if (!kap) { return; }
    if (m === "pole" && S.pole === null) { kap.innerHTML = "<p class='a3-bos'>Pole verisi yükleniyor…</p>"; not.innerHTML = ""; }
    else if (m === "pole" && S.pole === false) { kap.innerHTML = "<p class='a3-bos'>Pole verisi alınamadı.</p>"; not.innerHTML = "<button type='button' class='a3-link' data-a3-pole-yeniden>Tekrar dene</button>"; }
    else {
      var sat = S.sira.map(function (id) { return { id: id, deger: S.wpp[id] ? S.wpp[id][m] : 0 }; })
        .filter(function (x) { return x.deger > 0; }).sort(function (a, b) { return b.deger - a.deger || (S.sira.indexOf(a.id) - S.sira.indexOf(b.id)); }).slice(0, 12)
        .map(function (x) { return { kod: kod(x.id), ad: soyad(x.id), deger: x.deger, renk: renkTakim(sonTakim(x.id)) }; });
      if (!sat.length) { kap.innerHTML = "<p class='a3-bos'>Henüz kayıt yok.</p>"; }
      else { if (S.grafik.wpp && S.grafik.wpp.kapat) { S.grafik.wpp.kapat(); } S.grafik.wpp = SG.cubuk(kap, { satirlar: sat, etiket: { galibiyet: "Galibiyet", podyum: "Podyum", pole: "Pole" }[m] + " sayısı" }); }
      not.innerHTML = "";
    }
    var tab = "<div class='a3-tablo-kap'><table class='a3-tablo'><thead><tr><th scope='col'>Pilot</th><th scope='col'>Galibiyet</th><th scope='col'>Podyum</th><th scope='col'>Pole</th></tr></thead><tbody>";
    S.sira.forEach(function (id) {
      var w = S.wpp[id] || { galibiyet: 0, podyum: 0, pole: 0 };
      tab += "<tr><th scope='row'>" + esc(kod(id)) + " <span class='a3-soluk'>" + esc(soyad(id)) + "</span></th><td>" + w.galibiyet + "</td><td>" + w.podyum + "</td><td>" + (S.pole === null ? "…" : (S.pole === false ? "—" : w.pole)) + "</td></tr>";
    });
    kok().querySelector("[data-a3-wpptablo]").innerHTML = tab + "</tbody></table></div>";
  }
  function uyariHtml() {
    var r = S.sonuc, p = [];
    if (!r) { return ""; }
    if (r.eksikTurlar.length) { p.push("Tur " + r.eksikTurlar.join(", ") + " ana yarış sonuçları alınamadı; grafiklerde bu turlar yok."); }
    if (r.hatalar.indexOf("sprint") >= 0) { p.push("Sprint sonuçları alınamadı: sprint puanları toplamlara eklenemedi, toplamlar eksik olabilir."); }
    else if (r.eski) { p.push("Ağ hatası nedeniyle bazı veriler eski önbellekten gösteriliyor."); }
    var h = p.map(function (x) { return "<p class='a3-uyari'>" + esc(x) + "</p>"; }).join("");
    var d = S.dogrulama;
    if (d && d.karsilastirildi && !d.uyumlu) {
      var dt = d.farklar.map(function (x) { return esc(x.ad) + ": hesaplanan " + sayiYaz(x.hesap) + ", resmî " + (x.resmi == null ? "—" : sayiYaz(x.resmi)); }).join("<br>");
      h += "<div class='a3-uyari' role='status'><span>" + isle("Hesaplanan toplam ile resmi sıralama arasında fark var [[puan-dogrulama]]") + "</span> " +
           "<button type='button' class='a3-link' data-a3-yeniden>Yeniden kontrol et</button><details class='a3-detay'><summary>Ayrıntı</summary><p>" + dt + "</p></details></div>";
    }
    return h;
  }

  // ---- ana çizim ----
  function ciz() {
    var k = kok(); if (!k || !S.model) { return; }
    k.innerHTML = "<header class='a3-bas'><h1>Sezon Analiz Merkezi</h1><p class='a3-altbaslik'>" + baslikAlt() + "</p></header>" +
      "<div class='a3-uyarilar' data-a3-uyari aria-live='polite'>" + uyariHtml() + "</div>" +
      "<section class='a3-ozet' aria-label='Sezon özeti' data-a3-ozet>" + ozetHtml() + "</section>" +
      cizgiKart("pilot", "Şampiyona puan gelişimi", "a3-pilot", "Her turun toplamı ana yarış + sprint puanını içerir [[sprint-puani]]. Çizgiye dokunun / üzerine gelin: o turdaki puanlar.") +
      wppHtml() +
      cizgiKart("takim", "Takım puan gelişimi", "a3-takim", "Takım puanı iki pilotun ana yarış ve sprint puanlarının toplamıdır [[takimlar-sampiyonasi]].") +
      "<p class='a3-kaynak'>Kaynak: Jolpica (ücretsiz F1 veri API'si). Puanlar tüm ana yarış ve sprint sonuçlarından hesaplanır.</p>";
    ["pilot", "takim"].forEach(function (g) { cizgiIc(g); });
    wppIc();
    try { if (window.Ogren && Ogren.tara) { Ogren.tara(k); } } catch (e) { /* ⓘ olmadan devam */ }
    bildir("ciz");
  }
  function cizgiIc(grup) {
    var k = kok(), g = grup === "pilot" ? S.g : S.gt;
    var sec = k.querySelector("[data-a3-secici='" + grup + "']"), kap = k.querySelector("[data-a3-grafik='" + grup + "']");
    if (!sec || !kap) { return; }
    sec.innerHTML = chipler(grup);
    var ss = seriler(grup);
    if (!ss.length) { kap.innerHTML = "<p class='a3-bos'>Grafik için en az bir seçim yapın.</p>"; return; }
    var o = { x: g.turlar.map(String), seriler: ss, sifirCizgisi: S.gorunum === "fark" && grup === "pilot", ipucu: ipucu(grup), ozet: ozetMetni(grup),
              etiket: (grup === "pilot" ? "Şampiyona puan gelişimi" : "Takım puan gelişimi") + ": " + ss.map(function (s) { return s.ad; }).join(", ") };
    if (S.grafik[grup] && S.grafik[grup].kapat) { S.grafik[grup].kapat(); }
    S.grafik[grup] = SG.cizgi(kap, o);
    var yer = k.querySelector("[data-a3-tabloyer='" + grup + "']");
    if (S.tablo[grup]) { yer.innerHTML = tabloHtml(grup); yer.hidden = false; }
  }
  function ozetYenile() { var e = kok() && kok().querySelector("[data-a3-ozet]"); if (e) { e.innerHTML = ozetHtml(); try { if (window.Ogren && Ogren.tara) { Ogren.tara(e); } } catch (x) { /* önemsiz */ } bildir("ozet"); } }
  function uyariYenile() { var e = kok() && kok().querySelector("[data-a3-uyari]"); if (e) { e.innerHTML = uyariHtml(); } }

  // ---- hesap ----
  function hesapla() {
    S.g = H.pilotGelisimi(S.model); S.gt = H.takimGelisimi(S.model);
    S.sira = H.siralama(S.g); S.siraT = H.siralama(S.gt);
    S.wpp = H.galibiyetPodyumPole(S.model, S.poleKod);
  }

  // ---- resmî sıralama ile doğrulama (yalnızca OKUR; veri değiştirmez, neden tahmin etmez) ----
  function resmiPilotlar() {
    try {
      if (typeof sezonPilotlar === "undefined" || !sezonPilotlar.length) { return null; }
      return sezonPilotlar.map(function (k) { return { id: k.Driver.driverId, puan: Number(k.points) }; });
    } catch (e) { return null; }
  }
  function resmiTakimlar() {
    try {
      var satirlar = document.querySelectorAll("#takim-govde tr"), liste = [];
      satirlar.forEach(function (tr) {
        var rozet = tr.querySelector(".takim"), td = tr.querySelectorAll("td");
        if (rozet && td.length >= 3) { liste.push({ id: rozet.getAttribute("title") || rozet.textContent, puan: Number(td[2].textContent) }); }
      });
      return liste.length ? liste : null;
    } catch (e) { return null; }
  }
  function dogrula() {
    if (!S.model || S.durum !== "hazir") { return false; }
    var rp = resmiPilotlar(), rt = resmiTakimlar(), farklar = [], karsilastirildi = false;
    if (rp) {
      var d = H.dogrula(S.g, rp); karsilastirildi = true;
      d.farklar.forEach(function (x) { farklar.push({ ad: soyad(x.id) || x.id, hesap: x.hesap, resmi: x.resmi }); });
    }
    if (rt) {
      var ad2id = {}; Object.keys(S.model.takimlar).forEach(function (id) { ad2id[String(S.model.takimlar[id]).toLowerCase()] = id; });
      var dt = H.dogrula(S.gt, rt, function (ad) { return ad2id[String(ad).toLowerCase()] || ad; }); karsilastirildi = true;
      dt.farklar.forEach(function (x) { farklar.push({ ad: takimAd(ad2id[String(x.id).toLowerCase()] || x.id), hesap: x.hesap, resmi: x.resmi }); });
    }
    S.dogrulama = { karsilastirildi: karsilastirildi, uyumlu: farklar.length === 0, farklar: farklar, pilot: !!rp, takim: !!rt };
    uyariYenile();
    return !!(rp && rt);
  }
  function dogrulamaBekle(n) {
    n = n || 0;
    clearTimeout(S.dogrulamaZ);
    if (S.durum !== "hazir" || n > 20) { return; }
    if (dogrula()) { return; }
    S.dogrulamaZ = setTimeout(function () { dogrulamaBekle(n + 1); }, 700);
  }

  // ---- pole (A2 SezonVeri, ortak önbellek) ----
  async function poleYukle() {
    if (S.poleYukleniyor) { return; }
    S.poleYukleniyor = true;
    try {
      if (!window.SezonVeri) { throw new Error("SezonVeri yok"); }
      var m = await SezonVeri.yukle(sezonYili()), harita = {};
      Object.keys(m.turlar).forEach(function (n) { var p = m.turlar[n].pole; if (p && p.k) { harita[n] = p.k; } });
      S.poleKod = harita; S.pole = true;
    } catch (e) { S.poleKod = null; S.pole = false; }
    S.poleYukleniyor = false;
    if (S.model) { S.wpp = H.galibiyetPodyumPole(S.model, S.poleKod); ozetYenile(); wppIc(); bildir("pole"); }
  }

  // ---- yükleme ----
  function eskiyeDon(neden) {
    S.durum = "hata"; S.hata = neden || "";
    var b = bolum(); if (b) { b.removeAttribute("data-a3"); }
    var k = kok();
    if (k) {
      k.innerHTML = "<div class='a3-hata' role='alert'><b>Sezon Analiz Merkezi yüklenemedi.</b> Eski puan grafiği gösteriliyor. " +
        "<button type='button' class='a3-link' data-a3-tekrar>Tekrar dene</button></div>";
    }
    try {
      if (typeof Chart === "undefined") { var d = document.getElementById("grafik-durum"); if (d) { d.textContent = "Eski grafik için Chart.js yüklenemedi (internet bağlantısını kontrol edin)."; } }
      if (typeof sezonPilotlar !== "undefined" && sezonPilotlar.length && typeof grafikHazirla === "function") { grafikHazirla(); }
    } catch (e) { /* eski yükleyici kendi hatasını yönetir */ }
  }
  async function ac(yenile) {
    var k = kok(); if (!k || S.yukleniyor) { return; }
    S.yukleniyor = true;
    var b = bolum(); if (b) { b.setAttribute("data-a3", "1"); }
    if (S.durum !== "hazir") { S.durum = "yukleniyor"; k.innerHTML = "<div class='a3-yuk' aria-busy='true'><h1>Sezon Analiz Merkezi</h1><p>Sezon verileri yükleniyor… <span data-a3-ilerleme></span></p><div class='a3-iskelet'></div></div>"; }
    try {
      var r = await SA.yukle(sezonYili(), { yenile: yenile, ilerle: function (tur, n, top) { var e = k.querySelector("[data-a3-ilerleme]"); if (e) { e.textContent = (tur === "sonuc" ? "Yarış sonuçları" : "Sprint sonuçları") + ": sayfa " + n + "/" + top; } } });
      var degisti = !S.model || H.turListesi(S.model).join() !== H.turListesi(r.model).join() || yenile;
      S.sonuc = r; S.model = r.model;
      hesapla();
      if (S.durum !== "hazir") { secimleriKur(); }
      S.durum = "hazir";
      if (degisti || !k.querySelector(".a3-kart")) { ciz(); } else { uyariYenile(); }
      if (S.pole === null || yenile) { poleYukle(); }
      S.dogrulama = null; dogrulamaBekle(0);
    } catch (e) {
      if (S.model) { S.durum = "hazir"; } else { eskiyeDon(e && e.message); }
    }
    S.yukleniyor = false;
  }

  // ---- etkileşim ----
  function sakla() { yaz(K_PILOT, S.sec.pilot); yaz(K_TAKIM, S.sec.takim); bildir("secim"); }
  // Pilot seçimini dışarıdan (A3.2 form kartı) değiştirme: aynı tercih anahtarı, aynı sınır; puan grafiği de güncellenir
  function secimYaz(ids) {
    if (!S.model || !Array.isArray(ids)) { return; }
    var gorulen = {};
    S.sec.pilot = ids.filter(function (id) { if (gorulen[id] || S.sira.indexOf(id) < 0) { return false; } gorulen[id] = true; return true; }).slice(0, MAKS_SECIM);
    if (S.vurgu.pilot && S.sec.pilot.indexOf(S.vurgu.pilot) < 0) { S.vurgu.pilot = null; }
    sakla(); cizgiIc("pilot");
  }
  function olaylar() {
    var k = kok();
    k.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("button") : null; if (!b) { return; }
      var grup;
      if (b.classList.contains("a2-baglanti") && b.hasAttribute("data-terim")) { try { if (window.Ogren && Ogren.ac) { Ogren.ac(b.getAttribute("data-terim")); } } catch (x) { /* sözlük yoksa düz metin */ } return; }
      if ((grup = b.getAttribute("data-a3-cikar"))) {
        S.sec[grup] = S.sec[grup].filter(function (id) { return id !== b.getAttribute("data-id"); });
        if (S.vurgu[grup] === b.getAttribute("data-id")) { S.vurgu[grup] = null; }
        sakla(); cizgiIc(grup); return;
      }
      if ((grup = b.getAttribute("data-a3-chip"))) { var id = b.getAttribute("data-id"); S.vurgu[grup] = S.vurgu[grup] === id ? null : id; cizgiIc(grup); return; }
      if ((grup = b.getAttribute("data-a3-sifirla"))) {
        var fav = ""; try { fav = localStorage.getItem("f1-favori") || ""; } catch (x) { fav = ""; }
        S.sec[grup] = grup === "pilot" ? varsayilanSecim(S.sira, fav) : S.siraT.slice(0, VARSAYILAN); S.vurgu[grup] = null; sakla(); cizgiIc(grup); return;
      }
      if (b.hasAttribute("data-a3-gorunum")) { S.gorunum = b.getAttribute("data-a3-gorunum") === "fark" ? "fark" : "puan"; yaz(K_GORUNUM, S.gorunum); ["pilot"].forEach(cizgiIc); kok().querySelectorAll("[data-a3-gorunum]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); return; }
      if (b.hasAttribute("data-a3-metrik")) { S.metrik = b.getAttribute("data-a3-metrik"); yaz(K_METRIK, S.metrik); kok().querySelectorAll("[data-a3-metrik]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); wppIc(); return; }
      if ((grup = b.getAttribute("data-a3-tablo"))) {
        S.tablo[grup] = !S.tablo[grup]; var yer = kok().querySelector("[data-a3-tabloyer='" + grup + "']");
        yer.hidden = !S.tablo[grup]; yer.innerHTML = S.tablo[grup] ? tabloHtml(grup) : "";
        b.setAttribute("aria-expanded", String(S.tablo[grup])); b.textContent = S.tablo[grup] ? "Tabloyu gizle" : "Tabloyu göster"; return;
      }
      if (b.hasAttribute("data-a3-pole-yeniden")) { S.pole = null; wppIc(); poleYukle(); return; }
      if (b.hasAttribute("data-a3-yeniden")) { ac(true); return; }
      if (b.hasAttribute("data-a3-tekrar")) { S.durum = "bos"; ac(); }
    });
    k.addEventListener("change", function (e) {
      var s = e.target; var grup = s.getAttribute && s.getAttribute("data-a3-ekle"); if (!grup) { return; }
      var id = s.value; if (!id || S.sec[grup].indexOf(id) >= 0 || S.sec[grup].length >= MAKS_SECIM) { return; }
      S.sec[grup].push(id); sakla(); cizgiIc(grup);
      var yeni = kok().querySelector("[data-a3-ekle='" + grup + "']"); if (yeni && !yeni.disabled) { yeni.focus(); }
    });
  }

  function baslat() {
    var k = kok(), btn = document.getElementById("btn-grafik");
    if (!k || !btn || !F || !H || !SA || !SG || !window.JolpicaIstemci || !window.HaftaVeri) { S.durum = "devre"; return; }   // eksik parça: eski grafik aynen çalışır
    olaylar();
    btn.addEventListener("click", function () { if (S.durum === "bos" || S.durum === "hazir") { ac(); } });
    // v3.0.0: yeni nav'da GRAFİK'e geçiş eski #btn-grafik tıklaması olmadan olur → ilk açılışta (durum "bos") f1-sekme olayıyla kurulur; yeni fetch/zamanlayıcı yok
    document.addEventListener("f1-sekme", function (e) { if (e.detail === "grafik" && S.durum === "bos") { ac(); } });
    var b = bolum(); if (b && !b.hidden) { ac(); }
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", baslat); } else { baslat(); }

  window.AnalizMerkezi = {
    ac: ac,
    // index.html'deki eski yükleyici kancası: A3 çalışıyorsa (bekliyor/yükleniyor/hazır) eski grafiğin 16–23 standings çağrısı atlanır
    eskiyiBekle: function () { return S.durum === "bos" || S.durum === "yukleniyor" || S.durum === "hazir"; },
    durum: function () { return S.durum; },
    dinle: function (f) { if (typeof f === "function") { DINLEYICILER.push(f); } },
    secim: function () { return S.sec.pilot.slice(); },
    secimYaz: secimYaz,
    maksSecim: MAKS_SECIM,
    _durum: S
  };
})();
