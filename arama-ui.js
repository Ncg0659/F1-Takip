/* A4.4 — Global Arama / Hızlı Git: ARAYÜZ + veri bağdaştırıcıları + aksiyon yönlendirmeleri.
   Saf hesap: arama.js (AramaHesap). Bu dosya YENİ API ÇAĞRISI YAPMAZ, YENİ depolama anahtarı yazmaz, hiçbir mevcut sistemi DEĞİŞTİRMEZ.
   Veri (hepsi bellekte hazır olan mevcut katmanlardan, açılışta okunur): standings (sezonPilotlar), takım listesi (ProfilVeri.takimlar), takvim (sezonYarislar →
   YarisHaftasi._durum.yarislar → yalnızca YEREL önbellek JolpicaIstemci.oku), pist sınıflandırması (PIST_SINIFLANDIRMA), sözlük (ICERIK.sozluk), sabit bölüm listesi.
   Veri yoksa o kategori boş kalır (sorgu için ağ çağrısı yapılmaz); yarış/pist/terim/bölüm statik veriyle her durumda aranabilir.
   Gelecek: pist aksiyonu AramaMerkezi.kaydet("pist", fn) ile değiştirilir (A5 Pist Profili); başka modüle bağımlılık yoktur. */
(function () {
  "use strict";
  var AH = window.AramaHesap;
  if (!AH) { return; }
  var C = { dlg: null, input: null, liste: null, durum: null, btn: null, indeks: [], sonuc: [], aktif: -1, opener: null, sorgu: "", gidiyor: false, kayitli: {} };

  var SEZON_ID = { sampiyonlar: 1, sezon: 1, profil: 1, grafik: 1, hafta: 1, sprint: 1, gun: 1, yaris: 1, diger: 1 };
  // Statik şehir/ülke ve Türkçe takma adlar (pist kimliği → [şehir, ülke, ...takma ad])
  var YER = {
    monaco: ["Monte Carlo", "Monako", "monaco"], marina_bay: ["Singapur", "Singapur", "singapore"], baku: ["Bakü", "Azerbaycan", "baku"], vegas: ["Las Vegas", "ABD", "nevada"],
    jeddah: ["Cidde", "Suudi Arabistan", "jeddah"], monza: ["Monza", "İtalya"], spa: ["Spa", "Belçika", "stavelot"], silverstone: ["Silverstone", "Birleşik Krallık", "ingiltere", "britanya", "great britain"],
    red_bull_ring: ["Spielberg", "Avusturya"], losail: ["Lusail", "Katar", "qatar"], suzuka: ["Suzuka", "Japonya", "japan"], hungaroring: ["Mogyoród", "Macaristan", "budapeşte", "hungary"],
    zandvoort: ["Zandvoort", "Hollanda", "netherlands"], bahrain: ["Sakhir", "Bahreyn", "bahrain"], miami: ["Miami", "ABD", "florida"], imola: ["Imola", "İtalya", "emilia romagna"],
    yas_marina: ["Abu Dabi", "BAE", "abu dhabi", "yas adası"], catalunya: ["Barselona", "İspanya", "montmelo", "barcelona", "spain"], interlagos: ["São Paulo", "Brezilya", "sao paulo", "brazil"],
    americas: ["Austin", "ABD", "texas", "cota"], rodriguez: ["Meksika Şehri", "Meksika", "mexico city"], shanghai: ["Şanghay", "Çin", "china"], albert_park: ["Melbourne", "Avustralya", "australia"],
    villeneuve: ["Montreal", "Kanada", "canada"], sepang: ["Kuala Lumpur", "Malezya", "malaysia"], madring: ["Madrid", "İspanya", "madring"]
  };
  // Bilinen kısa takım adları (constructorId → kısa adlar); yoksa addan türetilir
  var KISA = { red_bull: ["Red Bull", "RBR"], ferrari: ["Ferrari", "Scuderia"], mercedes: ["Merc", "AMG"], mclaren: ["Mac"], aston_martin: ["Aston", "AMR"], alpine: ["Alp"],
    haas: ["Haas"], williams: ["Will"], rb: ["Racing Bulls", "VCARB", "Visa Cash App"], sauber: ["Kick Sauber", "Sauber"], audi: ["Audi"], cadillac: ["Cadillac"] };

  function esc(x) { return window.F1UI && F1UI.esc ? F1UI.esc(x) : String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }
  function bul(f, d) { try { return f(); } catch (e) { return d; } }

  // ---------- veri okuma (hepsi salt okunur, ağsız) ----------
  function standings() { return bul(function () { return typeof sezonPilotlar !== "undefined" ? sezonPilotlar : []; }, []); }
  function takvim() {
    var a = bul(function () { return typeof sezonYarislar !== "undefined" ? sezonYarislar : []; }, []);
    if (a && a.length) { return a; }
    a = bul(function () { return window.YarisHaftasi && YarisHaftasi._durum && YarisHaftasi._durum.yarislar; }, null);
    if (a && a.length) { return a; }
    var yil = bul(function () { return typeof SEZON !== "undefined" ? SEZON : new Date().getFullYear(); }, new Date().getFullYear());
    var c = bul(function () { return window.JolpicaIstemci && JolpicaIstemci.oku("takvim-" + yil); }, null);
    var v = c && (c.veri || c.v || c);
    var r = v && v.RaceTable && v.RaceTable.Races;
    return r && r.length ? r : [];
  }
  function pilotlar() {
    var st = standings(), o = [];
    if (st.length) {
      st.forEach(function (k) {
        var d = k.Driver || {}, t = k.Constructors && k.Constructors.length ? k.Constructors[k.Constructors.length - 1].name : null;
        o.push({ id: d.driverId, ad: ((d.givenName || "") + " " + (d.familyName || "")).trim(), kod: d.code || null, numara: d.permanentNumber || null, takim: t });
      });
      return o;
    }
    var m = bul(function () { var s = AnalizMerkezi._durum; return s && s.durum === "hazir" ? s.model : null; }, null);
    if (m && m.pilotlar) { Object.keys(m.pilotlar).forEach(function (id) { o.push({ id: id, ad: m.pilotlar[id].a, kod: m.pilotlar[id].k, numara: null, takim: null }); }); }
    return o;
  }
  function takimlar() {
    var l = bul(function () { return window.ProfilVeri ? ProfilVeri.takimlar() : []; }, []);
    return l.map(function (t) {
      var kisa = (KISA[t.id] || []).slice(), ad = t.ad || "";
      var sade = ad.replace(/\b(F1 Team|Formula 1 Team|Racing|Team|Scuderia|Motorsport)\b/gi, "").replace(/\s+/g, " ").trim();
      if (sade && sade !== ad) { kisa.push(sade); }
      return { id: t.id, ad: ad, kisa: kisa };
    });
  }
  function pistKategori(id) { return bul(function () { var k = PIST_SINIFLANDIRMA.kategoriOf(id); return k ? PIST_SINIFLANDIRMA.KATEGORILER[k].ad : null; }, null); }
  function yarislarVePistler() {
    var tv = takvim(), yarislar = [], pistler = [], goruldu = {};
    tv.forEach(function (y) {
      var c = y.Circuit || {}, l = c.Location || {}, yer = YER[c.circuitId] || [];
      var ek = yer.slice(2);
      yarislar.push({ tur: Number(y.round), ad: y.raceName, pist: c.circuitName, sehir: l.locality, ulke: l.country, circuitId: c.circuitId, ek: ek, tr: [yer[0], yer[1]] });
      goruldu[c.circuitId] = true;
      pistler.push({ circuitId: c.circuitId, ad: c.circuitName, sehir: yer[0] || l.locality, ulke: yer[1] || l.country, yarisAd: y.raceName, tur: Number(y.round), kategoriAd: pistKategori(c.circuitId), ek: ek.concat([l.locality, l.country]) });
    });
    var liste = bul(function () { return PIST_SINIFLANDIRMA.PISTLER; }, []);
    liste.forEach(function (p) {
      if (goruldu[p.circuitId]) { return; }
      var yer = YER[p.circuitId] || [];
      pistler.push({ circuitId: p.circuitId, ad: p.ad, sehir: yer[0], ulke: yer[1], yarisAd: null, tur: null, kategoriAd: pistKategori(p.circuitId), ek: yer.slice(2) });
    });
    // takvimdeki yarışlara Türkçe şehir/ülke ve takma adları yan alan olarak ekle
    yarislar.forEach(function (y) { y.sehir2 = (y.tr || []).filter(Boolean).concat(y.ek || []); });
    return { yarislar: yarislar, pistler: pistler };
  }
  function terimler() {
    var T = bul(function () { return ICERIK.sozluk.terimler; }, {}), o = [];
    Object.keys(T).forEach(function (k) { o.push({ k: k, ad: T[k].ad, kisa: T[k].kisa, kat: T[k].kat }); });
    return o;
  }
  function sprintVar() { var b = document.getElementById("btn-sprint"); return !!(b && !b.hidden); }
  function bolumler() {
    var L = [
      { id: "hafta", ad: "Yarış Haftası", alt: "Hafta sonu programı ve seans sonuçları", kelimeler: ["hafta sonu", "seans", "program", "antrenman", "sıralama", "yarış günü programı", "fp1", "grid"] },
      { id: "sezon", ad: "Güncel Sezon", alt: "Takvim, pilot ve takım puan durumu", kelimeler: ["takvim", "puan durumu", "sezon", "standings", "sıralama"] },
      { id: "profil", ad: "Pilot & Pist", alt: "Pilot karşılaştırma ve sezonun pistleri", kelimeler: ["karşılaştırma", "pistler", "pilot karşılaştır"] },
      { id: "grafik", ad: "Grafik", alt: "Puan gelişimi, form, pist türü analizleri", kelimeler: ["grafik sekmesi", "analiz", "puan gelişimi", "form", "çizgi", "sprint analizi", "pist türü"] },
      { id: "lastik", ad: "Lastik Rehberi", alt: "Lastik bileşikleri ve strateji terimleri", kelimeler: ["lastik", "bileşik", "soft", "medium", "hard", "yumuşak", "sert", "ara lastik", "yağmur lastiği"], aksiyon: { t: "lastik" } },
      { id: "lastikstrateji", ad: "Yarış Analizi · Lastik stratejisi", alt: "Yarış Analizi sekmesinde lastik stratejisi", kelimeler: ["lastik", "strateji", "stint", "pit stop"], aksiyon: { t: "lastikstrateji" } },
      { id: "yaris", ad: "Yarış Analizi", alt: "Tur süreleri, pit stoplar, yarış sonucu", kelimeler: ["tur süreleri", "pit stop", "yarış sonucu", "analiz"] },
      { id: "gun", ad: "Yarış Günü", alt: "Canlı yarış günü takibi", kelimeler: ["canlı", "yarış günü", "takip"] },
      { id: "sampiyonlar", ad: "Şampiyonlar", alt: "1950'den bugüne dünya şampiyonları", kelimeler: ["dünya şampiyonları", "tarihçe", "1950", "şampiyonluk"] },
      { id: "diger", ad: "Diğer Seriler", alt: "F2 ve F3", kelimeler: ["f2", "f3", "formula 2", "formula 3"] },
      { id: "sozluk", ad: "Sözlük · Bu ne demek?", alt: "Terimlerin kısa açıklamaları", kelimeler: ["sözlük", "terim", "açıklama", "bu ne demek", "öğren"], aksiyon: { t: "sozluk" } },
      { id: "tema", ad: "Tema değiştir", alt: "Açık / koyu görünüm", kelimeler: ["tema", "koyu", "açık", "karanlık", "görünüm"], aksiyon: { t: "tema" } },
      { id: "favori", ad: "Favori pilot seç", alt: "Karşılaştırma ve hesaplayıcıda başlangıç pilotu", kelimeler: ["favori", "favori pilot"], aksiyon: { t: "favori" } }
    ];
    if (sprintVar()) { L.splice(1, 0, { id: "sprint", ad: "Sprint", alt: "Sprint hafta sonu sonuçları", kelimeler: ["sprint yarışı", "sq", "sprint sıralaması"] }); }
    return L;
  }
  var HIZLI = ["hafta", "sezon", "profil", "grafik", "lastik"];

  function indeksOlustur() {
    var yp = yarislarVePistler();
    var g = {
      pilotlar: pilotlar(), takimlar: takimlar(),
      yarislar: yp.yarislar.map(function (y) { return { tur: y.tur, ad: y.ad, pist: y.pist, sehir: y.sehir, ulke: y.ulke, circuitId: y.circuitId, ek: y.sehir2 }; }),
      pistler: yp.pistler, terimler: terimler(), bolumler: bolumler()
    };
    // yarış / pist yan alanları: Türkçe şehir/ülke + takma adlar
    var idx = AH.indeksKur(g);
    idx.forEach(function (k) {
      if (k.tur === "yaris" || k.tur === "pist") {
        var kaynak = (k.tur === "yaris" ? g.yarislar : g.pistler).filter(function (x) { return (k.tur === "yaris" ? "yaris-" + x.tur : "pist-" + x.circuitId) === k.id; })[0];
        (kaynak && kaynak.ek || []).forEach(function (e) { var m = AH.normalize(e); if (m) { k.alanlar.push({ m: m, y: "yan" }); } });
      }
    });
    C.veriNotu = !g.pilotlar.length;
    return idx;
  }

  // ---------- aksiyonlar ----------
  function bekleDOM(fn, ms, hazir) {
    var bas = Date.now();
    (function dene() { var r = bul(fn, null); if (r) { hazir(r); return; } if (Date.now() - bas < ms) { setTimeout(dene, 200); } })();
  }
  function vurgula(el) {
    if (!el) { return; }
    try { el.scrollIntoView({ block: "center" }); } catch (e) { /* önemsiz */ }
    el.classList.add("ar-vurgu"); setTimeout(function () { el.classList.remove("ar-vurgu"); }, 2200);
  }
  function sekme(ad) { if (typeof window.sekmeAc === "function") { try { window.sekmeAc(ad); return true; } catch (e) { /* devam */ } } var b = document.getElementById("btn-" + ad); if (b) { b.click(); return true; } return false; }
  function panelleriKapat() { bul(function () { if (window.DetayPanel && DetayPanel.kapat) { DetayPanel.kapat(); } }); bul(function () { if (window.Ogren && Ogren.kapat) { Ogren.kapat(); } }); }

  var ISLEYICI = {
    pilot: function (a) { if (window.ProfilPilot) { ProfilPilot.ac(a.id, C.opener); } },
    takim: function (a) { if (window.ProfilTakim) { ProfilTakim.ac(a.id, C.opener); } },
    terim: function (a) { if (window.Ogren) { Ogren.ac(a.k); } },
    lastik: function () { if (window.Ogren) { Ogren.lastik(); } },
    sozluk: function () { if (window.Ogren) { Ogren.sozluk(); } },
    tema: function () { var b = document.getElementById("btn-tema"); if (b) { b.click(); } },
    favori: function () { if (window.NavV3 && NavV3.favAc && NavV3.favAc()) { return; } var s = document.getElementById("favori-sec"); if (s) { try { s.scrollIntoView({ block: "center" }); } catch (e) { /* önemsiz */ } s.focus(); } },
    bolum: function (a) { if (SEZON_ID[a.id]) { sekme(a.id); } },
    lastikstrateji: function () { sekme("yaris"); bekleDOM(function () { return document.getElementById("a34b-lastik"); }, 6000, vurgula); },
    hafta: function (a) {
      sekme("hafta");
      if (a.tur == null) { return; }
      bekleDOM(function () {
        var s = document.querySelector("#sekme-hafta select[data-act='sec']"), Y = window.YarisHaftasi && YarisHaftasi._durum;
        return s && Y && Y.yarislar && Y.yarislar.length ? s : null;
      }, 8000, function (s) {
        if (String(s.value) !== String(a.tur)) { s.value = String(a.tur); s.dispatchEvent(new Event("change", { bubbles: true })); }
      });
    },
    sezon: function (a) {
      sekme("sezon");
      bekleDOM(function () { return document.querySelector("#a2-takvim article[data-tur='" + a.tur + "']"); }, 9000, vurgula);
    },
    pist: function (a) {
      sekme("profil");
      bekleDOM(function () {
        var h = AH.normalize(a.ad), satir = Array.prototype.filter.call(document.querySelectorAll("#pist-govde tr"), function (tr) { var td = tr.cells && tr.cells[0]; return td && AH.normalize(td.textContent) === h; })[0];
        return satir || null;
      }, 9000, vurgula);
    },
    karsilastir: function (a) {
      sekme("profil");
      bekleDOM(function () {
        var i = standings().findIndex(function (k) { return k.Driver && k.Driver.driverId === a.id; }), s = document.getElementById("pilot-a");
        return i >= 0 && s && s.options.length > i ? { s: s, i: i } : null;
      }, 9000, function (r) { r.s.value = String(r.i); r.s.dispatchEvent(new Event("change", { bubbles: true })); vurgula(r.s); });
    },
    grafik: function (a) {
      sekme("grafik");
      bekleDOM(function () { return document.getElementById(a.hedef); }, 9000, function (el) { try { el.scrollIntoView({ block: "start" }); } catch (e) { /* önemsiz */ } });
    }
  };

  function yonlendir(a) {
    var ozel = C.kayitli[a.t];
    if (ozel) { try { if (ozel(a) !== false) { return; } } catch (e) { /* varsayılana düş */ } }
    var f = ISLEYICI[a.t]; if (f) { f(a); }
  }
  var MODAL = { pilot: 1, takim: 1, terim: 1, lastik: 1, sozluk: 1 };

  // ---------- arayüz ----------
  var IK = {
    pilot: "<circle cx='12' cy='8' r='3.2'/><path d='M5.5 19c.8-3.4 3.4-5 6.5-5s5.7 1.6 6.5 5'/>",
    takim: "<path d='M12 3l7 3v5.5c0 4.2-2.8 7.4-7 9-4.2-1.6-7-4.8-7-9V6z'/>",
    yaris: "<path d='M6 21V4M6 5h11l-2 3.5 2 3.5H6'/>",
    pist: "<path d='M5 16c0-5 4-3 6-6s-1-6 3-6 6 3 4 7-6 3-6 7-7 4-7-2z'/>",
    bolum: "<rect x='4' y='4' width='7' height='7' rx='1.5'/><rect x='13' y='4' width='7' height='7' rx='1.5'/><rect x='4' y='13' width='7' height='7' rx='1.5'/><rect x='13' y='13' width='7' height='7' rx='1.5'/>",
    terim: "<path d='M5 4.5h8a3 3 0 013 3V20H8a3 3 0 01-3-3zM16 7.5h3V20h-3'/>",
    ara: "<circle cx='11' cy='11' r='6.5'/><path d='M16 16l4.5 4.5'/>"
  };
  function svg(k, w) { return "<svg viewBox='0 0 24 24' width='" + (w || 18) + "' height='" + (w || 18) + "' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true' focusable='false'>" + IK[k] + "</svg>"; }

  function kur() {
    if (C.dlg) { return; }
    var d = document.createElement("dialog");
    d.id = "ar-palet"; d.className = "ar-palet"; d.setAttribute("aria-label", "Hızlı ara");
    d.innerHTML = "<div class='ar-ic'>" +
      "<div class='ar-ust'><span class='ar-ara-ikon'>" + svg("ara", 20) + "</span>" +
      "<input type='text' id='ar-girdi' class='ar-girdi' role='combobox' aria-expanded='true' aria-controls='ar-liste' aria-autocomplete='list' aria-label='Pilot, takım, yarış, pist, terim veya bölüm ara' placeholder='Pilot, takım, yarış, pist, terim veya bölüm ara' autocomplete='off' autocapitalize='off' spellcheck='false' enterkeyhint='go'>" +
      "<button type='button' class='ar-kapat' id='ar-kapat' aria-label='Aramayı kapat'>Esc</button></div>" +
      "<ul class='ar-liste' id='ar-liste' role='listbox' aria-label='Arama sonuçları'></ul>" +
      "<div class='ar-alt' id='ar-ipucu' aria-hidden='true'><span><kbd>↑</kbd><kbd>↓</kbd> gezin</span><span><kbd>Enter</kbd> aç</span><span><kbd>Esc</kbd> kapat</span></div>" +
      "<div class='ar-durum' id='ar-durum' role='status' aria-live='polite'></div></div>";
    document.body.appendChild(d);
    C.dlg = d; C.input = d.querySelector("#ar-girdi"); C.liste = d.querySelector("#ar-liste"); C.durum = d.querySelector("#ar-durum");
    C.input.addEventListener("input", function () { C.sorgu = C.input.value; ciz(); });
    C.input.addEventListener("keydown", tus);
    d.querySelector("#ar-kapat").addEventListener("click", kapat);
    d.addEventListener("click", function (e) { if (e.target === d) { kapat(); } });
    d.addEventListener("keydown", function (e) {   // odak tuzağı: Tab/Shift+Tab palet içinde döner (tarayıcı arayüzüne kaçmaz)
      if (e.key !== "Tab") { return; }
      var f = Array.prototype.filter.call(d.querySelectorAll("input, button"), function (x) { return !x.disabled && x.offsetParent !== null; });
      if (!f.length) { return; }
      var ilk = f[0], son = f[f.length - 1];
      if (e.shiftKey && document.activeElement === ilk) { e.preventDefault(); son.focus(); }
      else if (!e.shiftKey && document.activeElement === son) { e.preventDefault(); ilk.focus(); }
    });
    d.addEventListener("cancel", function () { /* Esc: tarayıcı kapatır; close olayı odak dönüşünü yapar */ });
    d.addEventListener("close", kapandi);
    C.liste.addEventListener("click", function (e) { var li = e.target.closest ? e.target.closest("[data-i]") : null; if (li) { sec(Number(li.getAttribute("data-i"))); } });
    C.liste.addEventListener("mousemove", function (e) { var li = e.target.closest ? e.target.closest("[data-i]") : null; if (li) { var i = Number(li.getAttribute("data-i")); if (i !== C.aktif) { aktifYap(i, false); } } });
  }

  function satirHtml(s, i) {
    var ust = s.alt_satir ? "↳ " : "";
    return "<li role='option' id='ar-o-" + i + "' class='ar-o" + (s.alt_satir ? " ar-iliski" : "") + (i === C.aktif ? " aktif" : "") + "' data-i='" + i + "' data-tur='" + esc(s.tur) + "' aria-selected='" + (i === C.aktif) + "'>" +
      "<span class='ar-ik'>" + svg(s.tur) + "</span><span class='ar-tx'><span class='ar-bas'>" + ust + esc(s.baslik) + "</span>" +
      "<span class='ar-meta'><b class='ar-et'>" + esc(s.etiket) + "</b>" + (s.alt ? " · " + esc(s.alt) : "") + "</span></span></li>";
  }

  function ciz() {
    var q = C.sorgu.trim(), liste = [], bos = "";
    if (!q) {
      var b = C.indeks.filter(function (k) { return k.tur === "bolum"; });
      HIZLI.forEach(function (id) {
        var k = b.filter(function (x) { return x.id === id; })[0]; if (k) { liste.push({ tur: "bolum", etiket: "BÖLÜM", baslik: k.baslik, alt: k.alt, aksiyon: k.aksiyon, alt_satir: false }); }
      });
      bos = "<li class='ar-grup' role='presentation'>Hızlı erişim</li>";
    } else { liste = AH.ara(C.indeks, q, 10); }
    C.sonuc = liste; C.aktif = liste.length ? 0 : -1;
    var h = bos + liste.map(satirHtml).join("");
    if (!liste.length) {
      h = "<li class='ar-yok' role='presentation'>“" + esc(q) + "” için sonuç yok.<span>Pilot, takım, yarış, pist, terim veya bölüm adı deneyin.</span></li>";
    }
    if (C.veriNotu) { h += "<li class='ar-not' role='presentation'>Pilot ve takım listesi, Güncel Sezon verisi yüklenince eklenir.</li>"; }
    C.liste.innerHTML = h;
    C.input.setAttribute("aria-activedescendant", C.aktif >= 0 ? "ar-o-" + C.aktif : "");
    C.durum.textContent = !q ? "" : (liste.length ? liste.length + " sonuç" : "Sonuç yok");
  }

  function aktifYap(i, kaydir) {
    if (!C.sonuc.length) { return; }
    var n = C.sonuc.length; i = (i + n) % n;
    var eski = C.liste.querySelector(".ar-o.aktif"); if (eski) { eski.classList.remove("aktif"); eski.setAttribute("aria-selected", "false"); }
    C.aktif = i;
    var el = C.liste.querySelector("#ar-o-" + i);
    if (el) { el.classList.add("aktif"); el.setAttribute("aria-selected", "true"); if (kaydir !== false && el.scrollIntoView) { try { el.scrollIntoView({ block: "nearest" }); } catch (e) { /* önemsiz */ } } }
    C.input.setAttribute("aria-activedescendant", "ar-o-" + i);
  }

  function tus(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); aktifYap(C.aktif + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); aktifYap(C.aktif - 1); }
    else if (e.key === "Home" && C.sonuc.length && !C.input.value) { e.preventDefault(); aktifYap(0); }
    else if (e.key === "End" && C.sonuc.length && !C.input.value) { e.preventDefault(); aktifYap(C.sonuc.length - 1); }
    else if (e.key === "Enter") { e.preventDefault(); if (e.isComposing) { return; } sec(C.aktif); }
  }

  function sec(i) {
    var s = C.sonuc[i]; if (!s || !s.aksiyon) { return; }
    C.gidiyor = true;
    var a = s.aksiyon;
    kapat();
    // odak açan düğmeye döner; panel/pencere açılışları buradan geri dönüş noktası alır
    focus(C.opener);
    if (!MODAL[a.t]) { panelleriKapat(); }
    C.gidiyor = false;
    yonlendir(a);
  }

  function focus(el) { if (el && document.contains(el)) { try { el.focus({ preventScroll: true }); } catch (e) { /* önemsiz */ } } }

  function ac() {
    kur();
    if (C.dlg.open) { C.input.focus(); return; }
    var a = document.activeElement;
    C.opener = a && a !== document.body && a.closest && a.closest("dialog[open]") ? a : (C.btn || a);
    C.indeks = indeksOlustur();
    C.sorgu = ""; C.input.value = "";
    C.input.placeholder = bul(function () { return window.matchMedia("(max-width:480px)").matches; }, false) ? "Pilot, takım, pist, terim…" : "Pilot, takım, yarış, pist, terim veya bölüm ara";
    try { C.dlg.showModal(); } catch (e) { C.dlg.setAttribute("open", ""); }
    ciz();
    C.input.focus();
  }
  function kapat() { if (C.dlg && C.dlg.open) { try { C.dlg.close(); } catch (e) { C.dlg.removeAttribute("open"); kapandi(); } } }
  function kapandi() { if (!C.gidiyor) { focus(C.opener); } }

  function btnKur() {
    if (document.getElementById("btn-ara")) { return true; }
    var sag = document.querySelector("#rc-bar .rc-sag"), nav = document.querySelector("body > nav");
    if (!sag && !nav) { return false; }
    var b = document.createElement("button");
    b.type = "button"; b.id = "btn-ara"; b.className = "ar-btn"; b.setAttribute("aria-haspopup", "dialog"); b.setAttribute("aria-label", "Ara: pilot, takım, yarış, pist, terim, bölüm"); b.title = "Ara (Ctrl/⌘ + K)";
    b.innerHTML = svg("ara", 18) + "<span class='ar-btn-ad'>Ara</span>";
    b.addEventListener("click", ac);
    if (sag) { var nokta = sag.querySelector(".rc-nokta"); sag.insertBefore(b, nokta || sag.firstChild); sag.classList.add("ar-sag"); }   // üst global header (Race Control çubuğu)
    else { nav.appendChild(b); }                                                                           // yedek: üst çubuk yoksa menüde
    C.btn = b;
    return true;
  }
  function btnDene(n) { if (!btnKur() && n < 40) { setTimeout(function () { btnDene(n + 1); }, 100); } }

  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      if (C.dlg && C.dlg.open) { kapat(); } else { ac(); }
    }
  });
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", function () { btnDene(0); }); } else { btnDene(0); }

  window.AramaMerkezi = {
    ac: ac, kapat: kapat,
    kaydet: function (tur, fn) { if (typeof fn === "function") { C.kayitli[tur] = fn; } else { delete C.kayitli[tur]; } },  // A5: kaydet("pist", function (a) { ...; return true; })
    indeksAl: indeksOlustur, _durum: C
  };
})();
