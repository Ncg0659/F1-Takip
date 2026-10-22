/* A4.5 — Live Ticker / üst canlı akış. YENİ API ÇAĞRISI YOK, yeni fetch YOK, yeni localStorage anahtarı YOK, yeni çeviri/yorum motoru YOK.
   İki katman:
   1) TickerHesap (saf; DOM/ağ/depolama yok; Node'da test edilir): Race Feed olaylarından ticker'a girecek kritik olayları seçer.
   2) DOM katmanı: canlılık = MEVCUT seans sistemi (HaftaVeri.haftaKur + HaftaVeri.seansDurumu === "canli"; yalnızca Sprint ve Race);
      olaylar = MEVCUT Race Feed'in kayıtlı akışı (RaceFeed.yukle(raceKey).olaylar; metin = motorun kendi Türkçe çevirisi textTr).
   Race Feed sorgusu canlı Sprint/Race süresince sekmeden bağımsız sürer (feed-canli.js, tek sahip); ticker YALNIZCA kayıtlı akışı okur.
   Güncelleme sinyali: "f1-feed-guncel" olayı (her poll sonunda) + hafif yerel zamanlayıcı (ağsız; olay yaşı ve oturum bitişi için).
   Ticker, hiçbir mevcut dosyayı değiştirmeden başlığın (#rc-bar) hemen altına eklenir. */
(function (kok) {
  "use strict";

  // ---------- 1) SAF KATMAN ----------
  var KRITIK = { SAFETY_CAR: 1, VSC: 1, RED_FLAG: 1, RESTART: 1, PENALTY: 1, INVESTIGATION: 1, TECHNICAL: 1, WEATHER: 1, PIT: 1, POSITION: 1, RESULT: 1 };
  // Çevirisi bulunamayıp ham (İngilizce) metne düşen olaylar için yalnızca sabit etiketi olan kategoriler; diğer yedek (EN) olaylar ticker'a girmez
  var SABIT = { SAFETY_CAR: "Safety Car", VSC: "Sanal Safety Car (VSC)", RED_FLAG: "Kırmızı bayrak", RESTART: "Yarış yeniden başladı" };
  // Sebep/yorum/tahmin içeren ifadeler ticker'a alınmaz (ham olay → kısa bilgi)
  var YORUM = /favori|avantaj|yanlış|kazandırabilir|bekleniyor|muhtemel|olabilir|belki|sanırım|bence|iyi (?:görünüyor|olabilir)|güçlü görünüyor/i;
  var TOP3 = /(^|[^\dA-Za-z])P[123](?!\d)/;
  var VARSAYILAN = { yasMs: 15 * 60000, max: 5, tekrarMs: 30000, metinTekrarMs: 5 * 60000, surucusuzMs: 2 * 60000, maxMetin: 110 };

  function norm(s) {
    s = String(s == null ? "" : s).replace(/İ/g, "i").replace(/I/g, "i").replace(/ı/g, "i").toLowerCase();
    try { s = s.normalize("NFD").replace(/[̀-ͯ]/g, ""); } catch (e) { /* aksan kalır */ }
    return s.replace(/[^a-z0-9]+/g, " ").trim();
  }
  function kisalt(s, n) { s = String(s).replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; }
  function tsMs(o) { var t = new Date(o && o.timestamp).getTime(); return isNaN(t) ? null : t; }

  // Bir olay ticker'a uygun mu? Uygunsa {metin}, değilse null. (Zaman/oturum denetimi ayrıdır.)
  function uygun(o, ayar) {
    if (!o || !KRITIK[o.category]) { return null; }
    if (o.status === "unconfirmed") { return null; }                       // "belirsiz" ifadeli / doğrulanmamış olay gösterilmez
    var metin;
    if (o.translationFallback) { metin = SABIT[o.category] || null; }      // ham İngilizce metin gösterilmez
    else { metin = o.textTr ? String(o.textTr) : (SABIT[o.category] || null); }
    if (!metin) { return null; }
    if (YORUM.test(metin)) { return null; }
    if (o.category === "POSITION" && !TOP3.test(metin)) { return null; }  // yalnızca ilk 3'ü ilgilendiren pozisyon değişimleri "önemli" sayılır
    return { metin: kisalt(metin, ayar.maxMetin) };
  }

  // Yinelenenleri azalt (zaman sırasıyla gelir): (a) aynı kategori+pilotlar 30 sn içinde; (b) aynı metin 5 dk içinde;
  // (c) pilotsuz Safety Car/VSC/Kırmızı bayrak/Yeniden başlama aynı kategori 2 dk içinde
  function tekrarAzalt(liste, ayar) {
    var out = [];
    liste.forEach(function (e) {
      var kopya = out.some(function (x) {
        var fark = Math.abs(e.ts - x.ts);
        if (fark < ayar.tekrarMs && e.parmak === x.parmak) { return true; }
        if (fark < ayar.metinTekrarMs && e.nm === x.nm) { return true; }
        if (fark < ayar.surucusuzMs && !e.surucu && !x.surucu && e.kat === x.kat && SABIT[e.kat]) { return true; }
        return false;
      });
      if (!kopya) { out.push(e); }
    });
    return out;
  }

  // olaylar: RaceFeed olay dizisi. ctx: { bas: oturum başlangıcı (ms), simdi (ms), [yasMs, max, ...] }
  // Dönüş: { gorunen: [{id, ts, kat, metin}] (yeniden eskiye), oturumOlaySayisi, elenen }
  function sec(olaylar, ctx) {
    var a = {}, k;
    for (k in VARSAYILAN) { a[k] = ctx && ctx[k] != null ? ctx[k] : VARSAYILAN[k]; }
    var simdi = ctx.simdi, bas = ctx.bas, oturum = 0, adaylar = [];
    (olaylar || []).forEach(function (o) {
      var ts = tsMs(o);
      if (ts == null || ts < bas || ts > simdi + 60000) { return; }        // oturum penceresi dışı (eski yarış / başka oturum / gelecek) → yok
      oturum++;
      if (simdi - ts > a.yasMs) { return; }                                // çok eski
      var u = uygun(o, a); if (!u) { return; }
      adaylar.push({ id: o.id || (o.category + "|" + ts), ts: ts, kat: o.category, metin: u.metin, nm: norm(u.metin),
                     parmak: o.fingerprint || (o.category + "|" + (o.drivers || []).slice().sort().join(",")), surucu: !!(o.drivers && o.drivers.length) });
    });
    adaylar.sort(function (x, y) { return x.ts - y.ts; });
    var tekil = tekrarAzalt(adaylar, a);
    tekil.sort(function (x, y) { return y.ts - x.ts; });
    return { gorunen: tekil.slice(0, a.max).map(function (e) { return { id: e.id, ts: e.ts, kat: e.kat, metin: e.metin }; }), oturumOlaySayisi: oturum, elenen: adaylar.length - tekil.length };
  }

  function yasYaz(ms) { var sn = Math.max(0, Math.floor(ms / 1000)); if (sn < 60) { return "az önce"; } return Math.floor(sn / 60) + " dk"; }

  var API = { sec: sec, uygun: uygun, tekrarAzalt: tekrarAzalt, yasYaz: yasYaz, norm: norm, KRITIK: KRITIK, SABIT: SABIT, VARSAYILAN: VARSAYILAN };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
  if (!kok) { return; }
  kok.TickerHesap = API;

  // ---------- 2) DOM KATMANI ----------
  var S = { el: null, btn: null, akis: null, sr: null, bildirilen: null, anahtar: null, model: null, zaman: null, obs: null, ro: null, planli: false };
  var ARALIK_MS = 20000;

  function bul(f, d) { try { return f(); } catch (e) { return d; } }
  function esc(x) { return String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }

  // Canlılık: tek tanım FeedCanli.canli() (mevcut A1 seans sistemi; yalnızca Sprint ve Race). Race Feed sorgusunun sahibi de odur.
  // Program override (ertelendi / gecikti / yeni saat / iptal) ve COMPLETED önceliği FeedCanli.tickerOturum'dadır; eski tanım yedek.
  function canliOturum(simdi) {
    if (!kok.FeedCanli) { return null; }
    if (FeedCanli.tickerOturum) { return bul(function () { return FeedCanli.tickerOturum(simdi); }, null); }
    return bul(function () { return FeedCanli.canli(simdi); }, null);
  }
    function durumSatiri(m) { var t = (m.oturum === "Sprint" ? "SPRINT" : "YARIŞ") + " — " + (m.durum === "gecikti" ? "BAŞLANGIÇ GECİKTİ" : (m.durum === "ertelendi" ? "ERTELENDİ" : "İPTAL EDİLDİ")); return t + (m.durum !== "iptal" && !(m.durum === "gecikti" && m.yeniSaat) ? " · Yeni saat bekleniyor" : ""); }
  function durumHtml(m) { var t = durumSatiri(m), i = t.indexOf(" · "); return i < 0 ? esc(t) : esc(t.slice(0, i)) + "<span class='tk-pr2'>" + esc(t.slice(i)) + "</span>"; }   // yeni saat zaten kesinse "yeni saat bekleniyor" denmez

  // Akış, canlı oturumda sekmeden bağımsız sürer (FeedCanli); yine de son poll çok eskiyse (gizli tarayıcı sekmesi vb.) "bekleniyor" denmez
  function akisAktif() { return bul(function () { var d = FeedCanli.durum(); return !d.hata && d.sonZaman != null; }, false); }

  // Etiket doğruluğu (BUGÜN hero ile AYNI kural; yeni state motoru yok): yalnız Race Feed'in DOĞRULADIĞI durum düz LIVE / gerçek state; saat tabanlı → "LIVE TAHMİNİ"
  var FEED_LIVE = { LIVE: 1, RESUMED: 1, RED_FLAG: 1, SESSION_STOPPED: 1 };
  function etiketHesapla(o, olaylar, simdi) {
    var fd = bul(function () {
      return HaftaState.feedDurumu(olaylar || [], { anahtar: o.oturum, baslangic: new Date(o.bas), bitis: new Date(o.bit), planliBaslangic: new Date(o.bas) }, simdi);
    }, null), tip = fd && fd.tip ? fd.tip : null;
    if (o.oturum === "Race" && fd) {                      // Sprint'te hero yalnız LIVE/LIVE TAHMİNİ der → burada da
      if (tip === "RED_FLAG") { return { ad: "RED FLAG", ton: "kirmizi" }; }
      if (tip === "SESSION_STOPPED") { return { ad: "STOPPED", ton: "bekle" }; }
      if (fd.chip === "SAFETY CAR" || fd.chip === "VSC") { return { ad: fd.chip, ton: "bekle" }; }
      if (tip === "RESUMED") { return { ad: "RESUMED", ton: "live" }; }
    }
    return FEED_LIVE[tip] ? { ad: "LIVE", ton: "live" } : { ad: "LIVE TAHMİNİ", ton: "tahmin" };
  }

  function modelKur() {
    var simdi = Date.now(), o = canliOturum(simdi);
    if (!o) { return null; }
    if (o.durum && o.durum !== "canli") { return { oturum: o.oturum, tur: o.tur, ad: o.ad, anahtar: o.raceKey, olaylar: [], oturumOlay: 0, akis: false, hata: false, simdi: simdi, durum: o.durum, yeniSaat: !!o.yeniSaat }; }
    var ol = bul(function () { return kok.RaceFeed ? RaceFeed.yukle(o.raceKey).olaylar : []; }, []);
    var r = sec(ol, { bas: o.bas, simdi: simdi });
    var et = etiketHesapla(o, ol, simdi);
    return { etiket: et.ad, ton: et.ton, oturum: o.oturum, tur: o.tur, ad: o.ad, anahtar: o.raceKey, olaylar: r.gorunen, oturumOlay: r.oturumOlaySayisi, akis: akisAktif(), hata: bul(function () { return FeedCanli.durum().hata; }, false), simdi: simdi };
  }

  function kur() {
    if (S.el) { return true; }
    var bar = document.getElementById("rc-bar"), nav = document.querySelector("body > nav");
    if (!bar && !nav) { return false; }
    var d = document.createElement("div");
    d.id = "a45-ticker"; d.className = "tk"; d.hidden = true;
    d.innerHTML = "<button type='button' class='tk-btn' id='a45-git'>" +
      "<span class='tk-live' id='a45-live' data-ton='live'><i class='tk-nokta' aria-hidden='true'></i><span id='a45-et'>LIVE</span></span><span class='tk-oturum' id='a45-oturum'></span>" +
      "<span class='tk-akis' id='a45-akis'></span><span class='tk-git' aria-hidden='true'><span class='tk-git-ad'>Yarış Günü </span>→</span></button>" +
      "<span class='tk-sr' id='a45-sr' role='status' aria-live='polite' aria-atomic='true'></span>";
    if (bar) { bar.parentNode.insertBefore(d, bar.nextSibling); } else { nav.parentNode.insertBefore(d, nav); }
    S.el = d; S.btn = d.querySelector("#a45-git"); S.akis = d.querySelector("#a45-akis"); S.sr = d.querySelector("#a45-sr"); S.oturum = d.querySelector("#a45-oturum"); S.live = d.querySelector("#a45-live"); S.et = d.querySelector("#a45-et");
    S.btn.addEventListener("click", git);
    if (kok.ResizeObserver) { S.ro = new ResizeObserver(function () { sigdir(); }); S.ro.observe(d); }
    return true;
  }

  function git() {
    if (typeof kok.sekmeAc === "function") { try { kok.sekmeAc("gun"); } catch (e) { var b = document.getElementById("btn-yarisgrup"); if (b) { b.click(); } } }
    var dene = 0;
    (function kaydir() {                                   // Yarış Günü render edilince Race Feed'e (en yeni olay en üstte) kaydır
      var n = document.getElementById("gun-notlar");
      if (n && !document.getElementById("sekme-gun").hidden) { try { n.scrollIntoView({ block: "start" }); } catch (e) { /* önemsiz */ } return; }
      if (dene++ < 10) { setTimeout(kaydir, 120); }
    })();
  }

  function durumMetni(m) {
    if (m.hata && m.oturumOlay === 0) { return "Canlı akışa şu an ulaşılamıyor"; }
    if (m.oturumOlay === 0) { return "Canlı akış bekleniyor…"; }
    return "Son 15 dakikada kritik gelişme yok";
  }

  function ciz(m) {
    if (!kur()) { return; }
    if (!m) { if (!S.el.hidden) { S.el.hidden = true; } S.anahtar = null; S.bildirilen = null; S.model = null; S.sr.textContent = ""; return; }
    // oturum değişti → sıfırla
    if (S.anahtar !== m.anahtar) { S.anahtar = m.anahtar; S.bildirilen = null; S.sr.textContent = ""; }
    S.model = m;
    var h = "", prg = !!(m.durum && m.durum !== "canli");
    if (S.el.classList.contains("tk-prog") !== prg) { S.el.classList.toggle("tk-prog", prg); }
    if (prg) { h = "<span class='tk-pr'>" + durumHtml(m) + "</span>"; }
    else if (m.olaylar.length) {
      h = m.olaylar.map(function (e, i) {
        var kt = bul(function () { return F1UI.KATEGORI[e.kat].renk; }, null);
        return "<span class='tk-o" + (i === 0 ? " tk-yeni" : "") + "' data-id='" + esc(e.id) + "'" + (kt ? " style='--kc:" + esc(kt) + "'" : "") + "><i class='tk-kn' aria-hidden='true'></i><b class='tk-yas'>" +
          esc(yasYaz(m.simdi - e.ts)) + "</b> <span class='tk-m'>" + esc(e.metin) + "</span></span>";
      }).join("");
    } else { h = "<span class='tk-bos'>" + esc(durumMetni(m)) + "</span>"; }
    var imza = h + "|" + m.oturum;
    if (S.akis.getAttribute("data-imza") !== imza) { S.akis.innerHTML = h; S.akis.setAttribute("data-imza", imza); }
    var et = m.etiket || "LIVE", ton = m.ton || "live";
    if (S.et && S.et.textContent !== et) { S.et.textContent = et; }
    if (S.live && S.live.getAttribute("data-ton") !== ton) { S.live.setAttribute("data-ton", ton); }
    S.oturum.textContent = m.oturum === "Sprint" ? "SPRINT" : "YARIŞ";
    if (prg) { S.btn.setAttribute("aria-label", durumSatiri(m) + ". Yarış Günü'nü aç"); }
    else S.btn.setAttribute("aria-label", et + " " + (m.oturum === "Sprint" ? "Sprint" : "yarış") + ": " + (m.olaylar.length ? m.olaylar[0].metin : durumMetni(m)) + ". Yarış Günü'nde Race Feed'i aç");
    if (S.el.hidden) { S.el.hidden = false; }
    sigdir();
    // ekran okuyucu: yalnızca YENİ kritik olay geldiğinde (ilk çizim sessiz)
    var ids = m.olaylar.map(function (e) { return e.id; });
    if (S.bildirilen == null) { S.bildirilen = {}; ids.forEach(function (i) { S.bildirilen[i] = 1; }); }
    else {
      var yeni = m.olaylar.filter(function (e) { return !S.bildirilen[e.id]; });
      if (yeni.length) { yeni.forEach(function (e) { S.bildirilen[e.id] = 1; }); S.sr.textContent = "Canlı: " + yeni[0].metin; }
    }
  }

  // Masaüstünde sığan kadar olay gösterilir (en yeni önce); mobilde yalnızca en yeni olay (CSS) — taşan olay kesilmez, tamamen çıkarılır
  function sigdir() {
    if (!S.akis) { return; }
    var oge = S.akis.querySelectorAll(".tk-o"); if (!oge.length) { return; }
    Array.prototype.forEach.call(oge, function (e) { e.hidden = false; });
    var i;
    for (i = oge.length - 1; i > 0 && S.akis.scrollWidth > S.akis.clientWidth + 1; i--) { oge[i].hidden = true; }
  }

  function guncelle() {
    S.planli = false;
    try { ciz(modelKur()); } catch (e) { /* ticker hata verirse sessizce gizli kalır; mevcut sistem etkilenmez */ bul(function () { if (S.el) { S.el.hidden = true; } }); }
  }
  function planla() { if (S.planli) { return; } S.planli = true; Promise.resolve().then(guncelle); }

  function baslat() {
    if (S.zaman) { return; }
    var bardan = 0;
    (function dene() { if (!kur() && bardan++ < 40) { setTimeout(dene, 100); } else { planla(); } })();
    S.zaman = setInterval(guncelle, ARALIK_MS);                         // yalnızca yerel yeniden değerlendirme (ağsız): canlılık başlangıcı/bitişi ve olay yaşı
    document.addEventListener("f1-feed-guncel", planla);               // Race Feed store güncellenince (FeedCanli/feedPoll yayınlar); DOM gözlemine bağımlılık yok
    document.addEventListener("visibilitychange", function () { if (!document.hidden) { planla(); } });
  }

  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", baslat); } else { baslat(); }
  kok.TickerMerkezi = { yenile: guncelle, modelKur: modelKur, canliOturum: canliOturum, _durum: S };
})(typeof window !== "undefined" ? window : null);
