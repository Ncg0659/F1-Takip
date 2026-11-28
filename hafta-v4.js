/* UI v4 — YARIŞ HAFTASI (v4.0 Aşama 3). YALNIZ gizli önizlemede (html[data-v4="1"]) etkin; bayrak yoksa hiçbir şey yapmaz.
   PROGRAM: #sekme-hafta (hafta-ui.js her çizimde içini yeniden yazar → ona dokunulmaz) + hemen ardına eklenen kardeş kap #sekme-hafta-v4
            (data-sekme="hafta"; görünürlüğü #sekme-hafta ile eşlenir): HAVA kartı · kısa YARIŞ TAHMİNİ (#tp-bugun taşınır) · BU HAFTA SONU (#a43-bilmen taşınır).
   CANLI  : #sekme-gun içinde #gun-hava yerine aynı hava bileşeninin kısa hâli (#gun-hava DOM'da kalır; "yağmur riski" rozeti onu okumaya devam eder).
   HAVA   : Open-Meteo saatlik TAHMİN (mevcut kaynak; seans başına Türkiye saatiyle) + OpenF1 seans ÖLÇÜMÜ (SeansHavaVeri; önbellekte varsa
            kendiliğinden, yoksa kullanıcı isteyince — v3 ile aynı tembel kural). Pist sıcaklığı yalnız ölçüm varsa. Rüzgâr oku pist çiziminde
            yalnız çizimin coğrafi yönü bilinen pistlerde (HavaV4Hesap.ruzgarAci); yoksa ok yok, metin var. Veri yoksa değer gösterilmez.
   ETİKET : kullanıcıya görünen ham İngilizce durum etiketleri (UPCOMING, RACE DAY, FINISHED…) Türkçeye çevrilir (yalnız görünen metin; durum anahtarları aynı).
   Ağ: Open-Meteo isteği yalnız PROGRAM/CANLI açıkken ve önbellek 30 dk'dan eskiyse (zamanlayıcı/polling yok, yeni depolama anahtarı yok). */
(function () {
  "use strict";
  var HV = window.HavaV4Hesap;
  var TAZE = 30 * 60 * 1000, ZAMAN_ASIMI = 9000;
  var S = { kuruldu: false, onb: {}, bekleyen: {}, secili: null, imza: {}, olcumIstek: {} };
  var CEVIR = { "UPCOMING": "YAKLAŞIYOR", "RACE DAY": "YARIŞ GÜNÜ", "FINISHED": "TAMAMLANDI", "RESULTS PENDING": "SONUÇ BEKLENİYOR", "POSTPONED": "ERTELENDİ",
                "CANCELLED": "İPTAL EDİLDİ", "DELAYED": "GECİKTİ", "RED FLAG": "KIRMIZI BAYRAK", "STOPPED": "DURDURULDU", "RESUMED": "YENİDEN BAŞLADI",
                "RESCHEDULED": "YENİ SAAT", "RAIN RISK": "YAĞMUR RİSKİ", "COMPLETED": "TAMAMLANDI" };

  function $(id) { return document.getElementById(id); }
  function v4() { return document.documentElement.getAttribute("data-v4") === "1"; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function bul(f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } }
  function mk(tag, id, cls) { var e = document.createElement(tag); if (id) { e.id = id; } if (cls) { e.className = cls; } return e; }
  function tr(ms, o) { try { return new Intl.DateTimeFormat("tr-TR", Object.assign({ timeZone: "Europe/Istanbul" }, o)).format(new Date(ms)); } catch (e) { return ""; } }
  function saatTR(ms) { return tr(ms, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }); }
  function gunTR(ms) { return tr(ms, { day: "numeric", month: "short", weekday: "short" }).toLocaleUpperCase("tr"); }
  function yuvar(x) { return x == null ? null : Math.round(x); }

  // ---------------- kurulum ----------------
  function kur() {
    if (S.kuruldu) { return true; }
    if (!v4()) { return false; }
    var hs = $("sekme-hafta"), gun = $("sekme-gun"); if (!hs || !gun) { return false; }
    var k = mk("section", "sekme-hafta-v4", "hf4"); k.setAttribute("data-sekme", "hafta"); k.setAttribute("aria-label", "Program ekleri"); k.hidden = hs.hidden;
    k.innerHTML = "<section class='hf4-bolum' id='hf4-hava' aria-labelledby='hf4-b-hava'><p class='hf4-b' id='hf4-b-hava'>PİST HAVASI</p><div class='hv4' id='hv4-program'></div></section>" +
                  "<section class='hf4-bolum' id='hf4-tahmin' aria-labelledby='hf4-b-tahmin'><p class='hf4-b' id='hf4-b-tahmin'>YARIŞ TAHMİNİ</p></section>" +
                  "<section class='hf4-bolum' id='hf4-bilmen'></section>";
    hs.parentNode.insertBefore(k, hs.nextSibling);
    var tp = $("tp-bugun"); if (tp) { $("hf4-tahmin").appendChild(tp); }
    var bm = $("a43-bilmen"); if (bm) { $("hf4-bilmen").appendChild(bm); }
    var gh = $("gun-hava"); if (gh) { var c = mk("div", "hv4-canli", "hv4 hv4-kisa"); gh.parentNode.insertBefore(c, gh.nextSibling); }
    S.kuruldu = true;
    gozle();
    return true;
  }
  function esitle() {                                   // #sekme-hafta-v4 görünürlüğü = PROGRAM görünürlüğü
    var hs = $("sekme-hafta"), k = $("sekme-hafta-v4"); if (!hs || !k) { return; }
    if (k.hidden !== hs.hidden) { k.hidden = hs.hidden; }
    var tp = $("tp-bugun"), b = $("hf4-tahmin"); if (b && tp) { b.hidden = !tp.firstElementChild; }
  }

  // ---------------- etiket çevirisi ----------------
  function cevir(kok) {
    if (!kok) { return; }
    Array.prototype.forEach.call(kok.querySelectorAll(".bg-kod, .g3-kod, .dr, #a45-et"), function (e) {
      if (e.children.length) { return; }
      var t = (e.textContent || "").trim(), c = CEVIR[t.toUpperCase()];
      if (c && t !== c) { e.textContent = c; }
    });
  }
  function cevirHepsi() { ["bg-kok", "sekme-gun", "sekme-hafta", "rc-bar"].forEach(function (id) { cevir($(id)); }); var tk = document.querySelector(".tk"); if (tk) { cevir(tk); } }

  // ---------------- hafta / konum ----------------
  function hafta() {                                    // PROGRAM'ın yüklediği hafta; yalnız CANLI açıldıysa Yarış Günü'nün seçtiği yarıştan aynı modelle kurulur
    var h = bul(function () { return YarisHaftasi._durum.hafta; }, null); if (h) { return h; }
    var y = bul(function () { return BugunKaynak().secYaris(); }, null); if (!y) { return null; }
    if (S.yedek && S.yedek.k === y.season + "-" + y.round) { return S.yedek.h; }
    h = bul(function () { return HaftaVeri.haftaKur(y, "f1"); }, null); if (h) { S.yedek = { k: y.season + "-" + y.round, h: h }; }
    return h;
  }
  function konum(h) {
    var y = bul(function () { return YarisHaftasi._durum.yarislar; }, []) || [];
    if (!y.length) { y = bul(function () { return BugunKaynak().yarislar; }, []) || []; }
    var r = y.filter(function (x) { return Number(x.round) === Number(h.tur) && Number(x.season) === Number(h.sezon); })[0];
    var L = r && r.Circuit && r.Circuit.Location; if (!L) { return null; }
    var lat = Number(L.lat), lon = Number(L.long); return isFinite(lat) && isFinite(lon) ? { lat: lat, lon: lon } : null;
  }
  function utcGun(ms) { return new Date(ms).toISOString().slice(0, 10); }

  // ---------------- Open-Meteo (tahmin) ----------------
  // Son başarılı tahmin: yalnız seans saatlerinin satırları (≤ 7 satır, birkaç yüz bayt) cihazda saklanır. Amaç: (1) sayfa yeniden
  // açıldığında 30 dk dolmadan TEKRAR istek atmamak, (2) servis yanıt vermezse son başarılı tahmini "GÜNCEL DEĞİL" uyarısıyla göstermek.
  // Anahtar: f1-hava4-<sezon>-<tur> (yalnız v4 önizlemesi yazar). Ölçüm (OpenF1) burada tutulmaz; eski tahmin asla ÖLÇÜLEN gösterilmez.
  var ILERI_GUN = 15 * 86400000;                                   // Open-Meteo tahmin ufku ~16 gün: daha uzaktaki hafta için istek atılmaz
  function depoAnahtar(h) { return "f1-hava4-" + h.sezon + "-" + h.tur; }
  function depoOku(h) { try { var x = JSON.parse(localStorage.getItem(depoAnahtar(h)) || "null"); return x && x.hourly && Array.isArray(x.hourly.time) && x.alinma ? x : null; } catch (e) { return null; } }
  function depoYaz(h, hourly, alinma) {
    try {
      var saatler = h.seanslar.map(function (s) { return Math.floor(s.baslangic.getTime() / 3600000) * 3600000; }), kisa = {};
      Object.keys(hourly).forEach(function (k) { kisa[k] = []; });
      hourly.time.forEach(function (t, i) {
        if (saatler.indexOf(Date.parse(String(t).replace(/Z?$/, "Z"))) < 0) { return; }
        Object.keys(hourly).forEach(function (k) { if (Array.isArray(hourly[k])) { kisa[k].push(hourly[k][i]); } });
      });
      localStorage.setItem(depoAnahtar(h), JSON.stringify({ alinma: alinma, hourly: kisa }));
    } catch (e) { /* depolama dolu / kapalı: yalnız bellek önbelleği */ }
  }
  function tahminAl(h, zorla) {
    var k = konum(h); if (!k || !h.seanslar || !h.seanslar.length) { return Promise.resolve({ durum: "konum-yok" }); }
    var bas = h.seanslar[0].baslangic.getTime(), son = h.seanslar[h.seanslar.length - 1].baslangic.getTime(), now = Date.now();
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + k.lat + "&longitude=" + k.lon +
      "&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m,is_day" +
      "&timezone=GMT&start_date=" + utcGun(bas) + "&end_date=" + utcGun(son);
    var o = S.onb[url];
    if (o && !zorla && now - o.t < TAZE) { return Promise.resolve(o.v); }
    var d = depoOku(h);
    if (d && !zorla && now - d.alinma < TAZE) { var dv = { durum: "ok", hourly: d.hourly, alinma: d.alinma, depodan: true }; S.onb[url] = { t: d.alinma, v: dv }; return Promise.resolve(dv); }
    if (bas - now > ILERI_GUN) { return Promise.resolve({ durum: "erken" }); }       // tahmin henüz yayımlanmaz: istek yok
    if (S.bekleyen[url]) { return S.bekleyen[url]; }
    var ctl = typeof AbortController === "function" ? new AbortController() : null, tm = null;
    if (ctl) { tm = setTimeout(function () { ctl.abort(); }, ZAMAN_ASIMI); }
    S.bekleyen[url] = fetch(url, ctl ? { signal: ctl.signal } : undefined).then(function (r) {
      if (!r.ok) { throw new Error("HTTP " + r.status); } return r.json();
    }).then(function (j) {
      var v = j && j.hourly && Array.isArray(j.hourly.time) ? { durum: "ok", hourly: j.hourly, alinma: Date.now() } : { durum: "bos" };
      if (v.durum === "ok") { depoYaz(h, j.hourly, v.alinma); }
      S.onb[url] = { t: Date.now(), v: v }; return v;
    }, function () {
      var e = depoOku(h);                                            // servis yok → son başarılı tahmin (varsa) GÜNCEL DEĞİL olarak
      var v = e ? { durum: "eski", hourly: e.hourly, alinma: e.alinma } : { durum: "hata" };
      S.onb[url] = { t: Date.now() - TAZE + 5 * 60 * 1000, v: v };   // hata sonrası 5 dk yeniden deneme yok (istek fırtınası olmasın)
      return v;
    }).then(function (v) { if (tm) { clearTimeout(tm); } delete S.bekleyen[url]; return v; });
    return S.bekleyen[url];
  }

  // ---------------- model: seans başına tahmin + ölçüm ----------------
  function olcumOku(h, s) {
    var r = bul(function () { return SeansHavaVeri.oku(h, s); }, null);
    if (!r || r.durum !== "ok" || !r.ozet || !r.ozet.veriVar) { return null; }
    var o = r.ozet, b = o.baslangic || o.bitis || {};
    return { sicaklik: b.airTemperature != null ? b.airTemperature : null, pist: b.trackTemperature != null ? b.trackTemperature : null,
             nem: b.humidity != null ? b.humidity : null, ruzgar: HV.msKmh(b.windSpeed), ruzgarYon: b.windDirection != null ? b.windDirection : null,
             havaAralik: o.hava, pistAralik: o.pist, yagis: o.yagis && o.yagis.olcumVar ? o.yagis.goruldu : null, ms: b.ms || null };
  }
  function seansDurum(h, s, now) { return bul(function () { return HaftaVeri.seansDurumu(s, h, now); }, null); }
  function model(h, t, now) {
    return h.seanslar.map(function (s) {
      var d = seansDurum(h, s, now), bitti = now >= s.bitis.getTime();
      return { s: s, durum: d, bitti: bitti, canli: d === "canli", tahmin: t && (t.durum === "ok" || t.durum === "eski") ? HV.seansTahmini(t.hourly, s.baslangic.getTime()) : null, olcum: bitti ? olcumOku(h, s) : null };
    });
  }
  function seciliBul(m) {
    if (S.secili) { var x = m.filter(function (r) { return r.s.anahtar === S.secili; })[0]; if (x) { return x; } }
    return m.filter(function (r) { return r.canli; })[0] || m.filter(function (r) { return !r.bitti; })[0] || m[m.length - 1];
  }

  // ---------------- SVG parçaları ----------------
  var IK = {
    gunes: "<circle cx='12' cy='12' r='4.2' class='hv-g'/><path class='hv-g-c' d='M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6'/>",
    ay: "<path class='hv-ay' d='M15.5 3.5a8.5 8.5 0 1 0 5 13.6A7 7 0 0 1 15.5 3.5z'/>",
    bulut: "<path class='hv-b' d='M7 18.5h10.2a4 4 0 0 0 .3-8 5.6 5.6 0 0 0-10.8 1.4A3.4 3.4 0 0 0 7 18.5z'/>",
    gunesBulut: "<circle cx='8' cy='8' r='3.2' class='hv-g'/><path class='hv-g-c' d='M8 1.8v1.5M2 8h1.5M3.7 3.7l1 1M12.3 3.7l-1 1'/><path class='hv-b' d='M9 19.5h9.2a3.6 3.6 0 0 0 .2-7.2 5 5 0 0 0-9.6 1.2A3 3 0 0 0 9 19.5z'/>",
    sis: "<path class='hv-b' d='M7 13h10.2a4 4 0 0 0 .3-8 5.6 5.6 0 0 0-10.8 1.4A3.3 3.3 0 0 0 7 13z'/><path class='hv-sis' d='M4 16.5h16M6 20h12'/>",
    damla: "<path class='hv-b' d='M7 14h10.2a4 4 0 0 0 .3-8 5.6 5.6 0 0 0-10.8 1.4A3.3 3.3 0 0 0 7 14z'/><path class='hv-y' d='M9 17l-1 2.5M13 17l-1 2.5M17 17l-1 2.5'/>",
    yagmur: "<path class='hv-b' d='M7 13h10.2a4 4 0 0 0 .3-8 5.6 5.6 0 0 0-10.8 1.4A3.3 3.3 0 0 0 7 13z'/><path class='hv-y' d='M8 16l-1.5 4M12 16l-1.5 4M16 16l-1.5 4'/>",
    saganak: "<path class='hv-b hv-b-koyu' d='M7 12.5h10.2a4 4 0 0 0 .3-8 5.6 5.6 0 0 0-10.8 1.4A3.3 3.3 0 0 0 7 12.5z'/><path class='hv-y' d='M7 15l-2 5M11 15l-2 5M15 15l-2 5M19 15l-2 5'/>",
    kar: "<path class='hv-b' d='M7 13h10.2a4 4 0 0 0 .3-8 5.6 5.6 0 0 0-10.8 1.4A3.3 3.3 0 0 0 7 13z'/><path class='hv-k' d='M8 17v3M6.5 18.5h3M14 17v3M12.5 18.5h3'/>",
    firtina: "<path class='hv-b hv-b-koyu' d='M7 12.5h10.2a4 4 0 0 0 .3-8 5.6 5.6 0 0 0-10.8 1.4A3.3 3.3 0 0 0 7 12.5z'/><path class='hv-sim' d='M12.5 13.5l-2.5 4h3l-2 4.5'/>"
  };
  var TIP_IK = { acik: "gunes", gece: "ay", azbulut: "gunesBulut", gecebulut: "bulut", parcali: "gunesBulut", kapali: "bulut", sis: "sis", cisenti: "damla", yagmur: "yagmur", saganak: "saganak", kar: "kar", firtina: "firtina" };
  function ikon(k, boy) {
    var a = k ? (IK[TIP_IK[k.tip]] || IK.bulut) : null; if (!a) { return ""; }
    return "<svg class='hv-ik hv-ik-" + esc(k.tip) + "' viewBox='0 0 24 24' width='" + boy + "' height='" + boy + "' fill='none' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round' role='img' aria-label='" + esc(k.ad) + "'>" + a + "</svg>";
  }
  function halka(p) {
    var r = 15, c = 2 * Math.PI * r, d = Math.max(0, Math.min(100, p)) / 100 * c;
    return "<svg class='hv-halka' viewBox='0 0 40 40' width='44' height='44' aria-hidden='true'><circle cx='20' cy='20' r='" + r + "' class='hv-halka-z'/>" +
      "<circle cx='20' cy='20' r='" + r + "' class='hv-halka-d' stroke-dasharray='" + d.toFixed(1) + " " + c.toFixed(1) + "' transform='rotate(-90 20 20)'/></svg>";
  }
  function ruzgarSvg(pistId, gelis, hiz) {
    var PS = window.PistSiluetleri; if (!PS || !HV) { return ""; }
    var aci = HV.ruzgarAci(pistId, gelis, PS.YON, PS.YOL), kz = HV.kuzeyAci(pistId, PS.YON, PS.YOL);
    if (aci == null || kz == null) { return ""; }
    var rad = aci * Math.PI / 180, dx = Math.sin(rad), dy = -Math.cos(rad), cx = 150, cy = 100, L = 78;
    var x1 = cx - dx * L, y1 = cy - dy * L, x2 = cx + dx * L, y2 = cy + dy * L;
    var kr = kz * Math.PI / 180, kx = 30, ky = 36, nx = kx + Math.sin(kr) * 12, ny = ky - Math.cos(kr) * 12;
    var y = HV.yon8(gelis);
    return "<svg class='hv-pist' viewBox='0 0 300 200' role='img' aria-label='Rüzgâr " + esc(y ? y.ad : "") + "dan esiyor; ok rüzgârın estiği yönü pist çizimi üzerinde gösterir'>" +
      "<path class='hv-pist-yol' d='" + PS.YOL[pistId] + "'/>" +
      "<g class='hv-kuzey' aria-hidden='true'><circle cx='" + kx + "' cy='" + ky + "' r='15'/><line x1='" + kx + "' y1='" + ky + "' x2='" + nx.toFixed(1) + "' y2='" + ny.toFixed(1) + "'/><text x='" + (kx + Math.sin(kr) * 24).toFixed(1) + "' y='" + (ky - Math.cos(kr) * 24 + 4).toFixed(1) + "' text-anchor='middle'>K</text></g>" +
      "<defs><marker id='hv-uc-" + esc(pistId) + "' viewBox='0 0 10 10' refX='8' refY='5' markerWidth='5' markerHeight='5' orient='auto-start-reverse'><path d='M0 0L10 5L0 10z' class='hv-uc'/></marker></defs>" +
      "<line class='hv-ok' x1='" + x1.toFixed(1) + "' y1='" + y1.toFixed(1) + "' x2='" + x2.toFixed(1) + "' y2='" + y2.toFixed(1) + "' marker-end='url(#hv-uc-" + esc(pistId) + ")'/></svg>";
  }

  // ---------------- çizim ----------------
  function etiket(r) {
    if (r.olcum) { return "<span class='hv-et hv-et-olcum'>ÖLÇÜLEN</span>"; }
    if (r.tahmin) { return S.servis === "eski" ? "<span class='hv-et hv-et-tahmin hv-et-eski'>TAHMİN · GÜNCEL DEĞİL</span>" : "<span class='hv-et hv-et-tahmin'>TAHMİN</span>"; }
    return "";
  }
  function eskiUyari() {
    if (S.servis !== "eski" || !S.son || !S.son.t || !S.son.t.alinma) { return ""; }
    var a = S.son.t.alinma;
    return "<p class='hv-eski' role='status'><b>Güncel değil.</b> Hava servisine şu an ulaşılamıyor; son başarılı tahmin gösteriliyor (" + esc(gunTR(a) + " " + saatTR(a)) + " TR'de alındı).</p>";
  }
  var SEANS_AD = { FirstPractice: "Antrenman 1", SecondPractice: "Antrenman 2", ThirdPractice: "Antrenman 3", SprintQualifying: "Sprint Sıralaması", Sprint: "Sprint", Qualifying: "Sıralama", Race: "Yarış" };
  function seansAd(s) { return SEANS_AD[s.anahtar] || s.ad || s.kisa || ""; }
  function degerler(r) {                       // ölçüm varsa ölçüm, yoksa tahmin; alan alan (karıştırma yok: kaynak etiketi tek)
    var o = r.olcum, t = r.tahmin;
    if (o) { return { kaynak: "olcum", sicaklik: o.sicaklik, nem: o.nem, ruzgar: o.ruzgar, ruzgarYon: o.ruzgarYon, yagisOl: null, yagis: o.yagis, pist: o.pist, kosul: null, havaAralik: o.havaAralik, pistAralik: o.pistAralik }; }
    if (t) { return { kaynak: "tahmin", sicaklik: t.sicaklik, nem: t.nem, ruzgar: t.ruzgar, ruzgarYon: t.ruzgarYon, yagisOl: t.yagisOl, yagis: null, pist: null, kosul: HV.kosul(t.kod, t.gunduz) }; }
    return null;
  }
  function vitrin(h, r, kisa) {
    var d = degerler(r), s = r.s, zaman = gunTR(s.baslangic.getTime()) + " · " + saatTR(s.baslangic.getTime());
    var bas = "<div class='hv-vit-ust'><p class='hv-ses'><b>" + esc(String(s.ad).toLocaleUpperCase("tr").replace(/SPRİNT/g, "SPRINT")) + "</b><span>" + esc(zaman) + " <small>TR</small></span>" +
      (r.canli ? "<span class='hv-canli'>SEANS SAATİNDE</span>" : "") + "</p>" + etiket(r) + "</div>";
    if (!d) {
      var neden = S.servis === "hata" ? "Tahmin servisine şu an ulaşılamıyor; hava değeri gösterilmiyor." :
        S.servis === "erken" ? "Bu hafta için tahmin henüz yayımlanmadı (Open-Meteo en fazla ~16 gün öncesini tahmin eder)." :
        (r.bitti ? "Bu seans için ölçülen hava verisi yüklenmedi; tahmin de yok." : "Bu seans için henüz hava tahmini yok (tahmin en fazla ~2 hafta öncesinden yayımlanır).");
      return bas + "<p class='hv-yok'>" + esc(neden) + "</p>" + olcumDugme(h, r);
    }
    var y = HV.yon8(d.ruzgarYon), ruz = d.ruzgar != null ? yuvar(d.ruzgar) + " km/sa" : null;
    var sol = "<div class='hv-ana'>" + (d.kosul ? ikon(d.kosul, kisa ? 44 : 64) : (d.kaynak === "olcum" ? "<span class='hv-ik-yok' aria-hidden='true'>°</span>" : "")) +
      "<div class='hv-ana-m'><p class='hv-sic'>" + (d.sicaklik != null ? yuvar(d.sicaklik) + "<span>°C</span>" : "—") + "</p>" +
      "<p class='hv-kos'>" + esc(d.kosul ? d.kosul.ad : (d.kaynak === "olcum" ? "Pistteki hava (OpenF1)" : "")) + "</p>" +
      (d.havaAralik && d.havaAralik.min !== d.havaAralik.max ? "<p class='hv-aralik'>Seans boyunca " + d.havaAralik.min.toFixed(1) + "–" + d.havaAralik.max.toFixed(1) + "°C</p>" : "") + "</div></div>";
    var metrik = [];
    if (d.yagisOl != null) { metrik.push("<div class='hv-m hv-m-yagis'><p class='hv-m-ad'>YAĞIŞ OLASILIĞI</p><p class='hv-m-d'>%" + yuvar(d.yagisOl) + "</p><span class='hv-bar' role='meter' aria-valuemin='0' aria-valuemax='100' aria-valuenow='" + yuvar(d.yagisOl) + "' aria-label='Yağış olasılığı yüzde " + yuvar(d.yagisOl) + "'><i style='width:" + Math.max(0, Math.min(100, d.yagisOl)) + "%'></i></span></div>"); }
    if (d.yagis != null) { metrik.push("<div class='hv-m'><p class='hv-m-ad'>YAĞIŞ (ÖLÇÜM)</p><p class='hv-m-d'>" + (d.yagis ? "Görüldü" : "Yok") + "</p></div>"); }
    if (d.nem != null) { metrik.push("<div class='hv-m hv-m-nem'>" + halka(d.nem) + "<div><p class='hv-m-ad'>NEM</p><p class='hv-m-d'>%" + yuvar(d.nem) + "</p></div></div>"); }
    if (d.pist != null) { metrik.push("<div class='hv-m'><p class='hv-m-ad'>PİST SICAKLIĞI</p><p class='hv-m-d'>" + d.pist.toFixed(1) + "°C</p>" + (d.pistAralik && d.pistAralik.min !== d.pistAralik.max ? "<p class='hv-aralik'>" + d.pistAralik.min.toFixed(1) + "–" + d.pistAralik.max.toFixed(1) + "°C</p>" : "") + "</div>"); }
    var ruzHtml = "";
    if (ruz || y) {
      var svg = d.ruzgarYon != null ? ruzgarSvg(h.pistId, d.ruzgarYon, d.ruzgar) : "";
      ruzHtml = "<div class='hv-ruz'>" + (svg ? svg : "") + "<p class='hv-m-ad'>RÜZGÂR</p><p class='hv-m-d'>" + (ruz || "—") + (y ? " <small>" + esc(y.ad) + "dan</small>" : "") + "</p>" +
        (!svg && d.ruzgarYon != null ? "<p class='hv-not'>Pist çizimi yok; yön yalnız metinle verildi.</p>" : "") + "</div>";
    }
    return bas + "<div class='hv-vit-g'>" + sol + (metrik.length ? "<div class='hv-metrik'>" + metrik.join("") + "</div>" : "") + ruzHtml + "</div>" + olcumDugme(h, r);
  }
  function olcumDugme(h, r) {
    if (!r.bitti || r.olcum || !window.SeansHavaVeri || !(SeansHavaHesap && SeansHavaHesap.SEANSLAR && SeansHavaHesap.SEANSLAR[r.s.anahtar])) { return ""; }
    var d = S.olcumIstek[r.s.anahtar];
    if (d === "yukleniyor") { return "<p class='hv-not'>Ölçülen hava yükleniyor…</p>"; }
    if (d && d !== "ok") { return "<p class='hv-not'>" + esc(bul(function () { return SeansHavaHesap.durumMesaji(d); }, "") || "Ölçülen hava verisi alınamadı.") + "</p>"; }
    return "<button type='button' class='hv-btn' data-hv-olcum='" + esc(r.s.anahtar) + "'>Ölçülen hava verisini getir (OpenF1)</button>";
  }
  function serit(m, sec) {
    return "<div class='hv-serit-ust'><p class='hv-serit-b'>SEANSLARA GÖRE</p><span class='hv-kaydir' aria-hidden='true'>Kaydır <i>→</i></span></div>" +
      "<div class='hv-serit-sar'><ol class='hv-serit' aria-label='Seans bazlı hava (yatay kaydırılabilir)'>" + m.map(function (r) {
      var d = degerler(r), k = d && d.kosul, ac = r === sec;
      return "<li><button type='button' class='hv-sk" + (ac ? " hv-sk-on" : "") + (r.bitti ? " hv-sk-bitti" : "") + "' data-hv-sec='" + esc(r.s.anahtar) + "' aria-pressed='" + (ac ? "true" : "false") + "'>" +
        "<span class='hv-sk-ad' title='" + esc(seansAd(r.s)) + "'>" + esc(seansAd(r.s)) + "</span><span class='hv-sk-z'>" + esc(gunTR(r.s.baslangic.getTime()).split(" ")[0] + " " + saatTR(r.s.baslangic.getTime())) + "</span>" +
        "<span class='hv-sk-ik'>" + (k ? ikon(k, 26) : "<i aria-hidden='true'>—</i>") + "</span>" +
        "<span class='hv-sk-t'>" + (d && d.sicaklik != null ? yuvar(d.sicaklik) + "°" : "—") + "</span>" +
        (d && d.yagisOl != null ? "<span class='hv-sk-y'><i style='width:" + Math.max(0, Math.min(100, d.yagisOl)) + "%'></i></span><span class='hv-sk-yp'>%" + yuvar(d.yagisOl) + "</span>" : "<span class='hv-sk-yp'>" + (d && d.kaynak === "olcum" ? "ölçüm" : "") + "</span>") +
        "<span class='hv-sk-k'>" + (d ? (d.kaynak === "olcum" ? "ÖLÇÜLEN" : (S.servis === "eski" ? "ESKİ TAHMİN" : "TAHMİN")) : "") + "</span></button></li>";
    }).join("") + "</ol></div>";
  }
  // CANLI: tek satırlık kompakt hava (Race Feed öncelikli). Ok için küçük pist çizimi korunur; ölçüm/tahmin etiketi aynı kural.
  function kompakt(h, r) {
    if (!r) { return ""; }
    var d = degerler(r), s = r.s, y = d ? HV.yon8(d.ruzgarYon) : null;
    var bas = "<p class='hk-ust'><b>" + esc(seansAd(s).toLocaleUpperCase("tr")) + "</b> <span>" + esc(saatTR(s.baslangic.getTime())) + " TR</span> " + etiket(r) + "</p>";
    if (!d) {
      var nd = S.servis === "hata" ? "Hava servisine şu an ulaşılamıyor." : (r.bitti ? "Bu seans için ölçülen hava yüklenmedi." : "Bu seans için henüz hava tahmini yok.");
      return "<div class='hv-kompakt'>" + bas + "<p class='hv-yok'>" + esc(nd) + "</p></div>";
    }
    var svg = d.ruzgarYon != null ? ruzgarSvg(h.pistId, d.ruzgarYon, d.ruzgar) : "";
    var parca = [];
    parca.push("<span class='hk-ana'>" + (d.kosul ? ikon(d.kosul, 30) : "") + "<b class='hk-sic'>" + (d.sicaklik != null ? yuvar(d.sicaklik) + "°" : "—") + "</b>" + (d.kosul ? "<small>" + esc(d.kosul.ad) + "</small>" : "") + "</span>");
    if (d.yagisOl != null) { parca.push("<span class='hk-m'><small>YAĞIŞ</small><b>%" + yuvar(d.yagisOl) + "</b><i class='hk-bar'><i style='width:" + Math.max(0, Math.min(100, d.yagisOl)) + "%'></i></i></span>"); }
    if (d.nem != null) { parca.push("<span class='hk-m'><small>NEM</small><b>%" + yuvar(d.nem) + "</b></span>"); }
    if (d.pist != null) { parca.push("<span class='hk-m'><small>PİST</small><b>" + d.pist.toFixed(1) + "°</b></span>"); }
    if (d.ruzgar != null || y) { parca.push("<span class='hk-m hk-ruz'>" + (svg ? "<span class='hk-pist'>" + svg + "</span>" : "") + "<span><small>RÜZGÂR</small><b>" + (d.ruzgar != null ? yuvar(d.ruzgar) + " km/sa" : "—") + (y ? "<em>" + esc(y.ad) + "dan</em>" : "") + "</b></span></span>"); }
    return "<div class='hv-kompakt" + (r.canli ? " hv-vit-canli" : "") + "'>" + bas + eskiUyari() + "<div class='hk-g'>" + parca.join("") + "</div></div>";
  }
  function kaydirmaDurumu(kap) {
    var sr = kap.querySelector(".hv-serit"), sar = kap.querySelector(".hv-serit-sar"); if (!sr || !sar) { return; }
    var tasar = sr.scrollWidth - sr.clientWidth > 4;
    sar.setAttribute("data-tasma", tasar ? "1" : "0");
    sar.setAttribute("data-son", tasar && sr.scrollLeft + sr.clientWidth >= sr.scrollWidth - 4 ? "1" : "0");
    var ust = kap.querySelector(".hv-serit-ust"); if (ust) { ust.setAttribute("data-tasma", tasar ? "1" : "0"); }
  }
  document.addEventListener("scroll", function (e) {                // yatay kaydırma: sona gelince kenar gölgesi / ipucu söner
    var t = e.target; if (!t || !t.classList || !t.classList.contains("hv-serit")) { return; }
    var k = t.closest(".hv4"); if (k) { kaydirmaDurumu(k); }
  }, true);
  window.addEventListener("resize", function () { var k = $("hv4-program"); if (k) { kaydirmaDurumu(k); } });

  function ciz(kapId, kisa) {
    var kap = $(kapId), h = hafta(); if (!kap) { return; }
    if (!h || !h.seanslar || !h.seanslar.length) { yaz(kapId, kap, "<p class='hv-yok'>Hafta programı yüklenince hava bilgisi gösterilir.</p>"); return; }
    var now = Date.now(), t = S.son && S.son.tur === h.tur ? S.son.t : null; S.servis = t ? t.durum : null;
    var m = model(h, t, now), sec = kisa ? (m.filter(function (r) { return r.canli; })[0] || m.filter(function (r) { return !r.bitti; })[0] || m[m.length - 1]) : seciliBul(m);
    var kaynakNot = "<p class='hv-kaynak'><span class='hv-et hv-et-tahmin'>TAHMİN</span> Open-Meteo model tahmini, seans başlangıç saatine göre · <span class='hv-et hv-et-olcum'>ÖLÇÜLEN</span> OpenF1 seans ölçümü (seans bitince yayımlanır)" +
      (t && t.durum === "hata" ? " · <b>Tahmin servisine şu an ulaşılamıyor.</b>" : "") + "</p>";
    var html = kisa ? kompakt(h, sec) : "<div class='hv-vitrin" + (sec && sec.canli ? " hv-vit-canli" : "") + "'>" + eskiUyari() + vitrin(h, sec, false) + "</div>" + serit(m, sec) + kaynakNot;
    yaz(kapId, kap, html);
    if (!kisa) { kaydirmaDurumu(kap); }
  }
  function yaz(id, kap, html) { if (S.imza[id] !== html) { S.imza[id] = html; kap.innerHTML = html; } }
  function yenile(zorla) {
    if (!S.kuruldu) { return; }
    var h = hafta(), hsG = $("sekme-hafta") && !$("sekme-hafta").hidden, gunG = $("sekme-gun") && !$("sekme-gun").hidden;
    if (!hsG && !gunG) { return; }
    if (hsG) { ciz("hv4-program", false); } if (gunG) { ciz("hv4-canli", true); }
    if (!h) { return; }
    tahminAl(h, zorla).then(function (t) { S.son = { tur: h.tur, t: t }; if (hsG) { ciz("hv4-program", false); } if (gunG) { ciz("hv4-canli", true); } });
  }

  var bekliyor = false;
  function planla() { if (bekliyor) { return; } bekliyor = true; Promise.resolve().then(function () { bekliyor = false; yenile(false); }); }   // çoklu değişimi tek çizime indirir

  // ---------------- olaylar ----------------
  function gozle() {
    if (!window.MutationObserver) { return; }
    var hs = $("sekme-hafta");
    if (hs) { new MutationObserver(function () { esitle(); cevir(hs); if (!hs.hidden) { planla(); } }).observe(hs, { attributes: true, attributeFilter: ["hidden"], childList: true, subtree: true }); }
    var gn = $("gun-v3-ozet"); if (gn) { new MutationObserver(function () { if (!$("sekme-gun").hidden) { planla(); } }).observe(gn, { childList: true }); }
    ["bg-kok", "sekme-gun", "rc-bar"].forEach(function (id) { var e = $(id); if (e) { new MutationObserver(function () { cevir(e); }).observe(e, { childList: true, subtree: true, characterData: true }); } });
    var tp = $("tp-bugun"); if (tp) { new MutationObserver(esitle).observe(tp, { childList: true }); }
    var saat = $("rc-saat"), tik = 0;
    if (saat) { new MutationObserver(function () { tik = (tik + 1) % 30; var hazirDegil = !S.son || (hafta() && S.son.tur !== hafta().tur); if (tik === 0 || (hazirDegil && tik % 3 === 0)) { yenile(false); } }).observe(saat, { childList: true, characterData: true, subtree: true }); }   // veri gelene kadar 3 sn'de bir, sonra 30 sn'de bir yeniden çizim (ağ: 30 dk önbellek)
  }
  document.addEventListener("f1-sekme", function (e) {
    if (!v4()) { return; }
    if (!S.kuruldu) { kur(); }
    esitle(); cevirHepsi();
    if (e.detail === "hafta" || e.detail === "sprint" || e.detail === "gun") { yenile(false); }
  });
  document.addEventListener("click", function (e) {
    if (!v4()) { return; }
    var s = e.target.closest && e.target.closest("[data-hv-sec]");
    if (s) { S.secili = s.getAttribute("data-hv-sec"); ciz("hv4-program", false); var b = document.querySelector("[data-hv-sec='" + S.secili + "']"); if (b) { try { b.focus(); } catch (x) {} } return; }
    var o = e.target.closest && e.target.closest("[data-hv-olcum]");
    if (o) {
      var an = o.getAttribute("data-hv-olcum"), h = hafta(), ses = h && h.seanslar.filter(function (x) { return x.anahtar === an; })[0]; if (!ses) { return; }
      S.olcumIstek[an] = "yukleniyor"; ciz("hv4-program", false); ciz("hv4-canli", true);
      SeansHavaVeri.yukle(h, ses).then(function (r) { S.olcumIstek[an] = r && r.durum === "ok" ? "ok" : (r && r.durum) || "hata"; }, function () { S.olcumIstek[an] = "hata"; })
        .then(function () { ciz("hv4-program", false); ciz("hv4-canli", true); });
    }
  });
  document.addEventListener("f1-feed-guncel", function () { if (v4()) { cevirHepsi(); } });
  function hazir() { if (v4()) { kur(); esitle(); cevirHepsi(); } }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", hazir); } else { hazir(); }
  window.HaftaV4 = { kur: kur, yenile: yenile, ciz: ciz, tahminAl: tahminAl, cevir: cevir, CEVIR: CEVIR, _durum: S };
})();
