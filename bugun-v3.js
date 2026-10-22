/* UI v3 — BUGÜN HUB (Faz 3). "F1 Today / Race Control Home": MEVCUT sistemlerin ÖZET katmanı.
   • YENİ fetch / zamanlayıcı / polling / depolama YAZIMI YOK. Yalnız okur: sezonYarislar, sezonPilotlar (BugunKaynak), HaftaVeri (saat tabanlı seans durumu),
     Yarış Günü'nün kanonik durumu (BugunCtx → GunV3.kanonik), FeedCanli.tickerOturum, RaceFeed deposu, SezonTakvim modeli / JolpicaIstemci ÖNBELLEĞİ (sonuç özeti), YorumMotoru, PistSiluetleri.
   • Yeniden çizim tetikleyicileri: f1-sekme, f1-feed-guncel, f1-yaris-sonuc olayları + mevcut saat çubuğunun (#rc-saat) saniyelik güncellemesi (yeni zamanlayıcı değil).
   • MOD seçimi deterministik (modBelirle): A canlı/kritik > C yarış yeni bitti > A aktif hafta sonu > B normal (sıradaki yarış).
   • Her blok savunmalı: veri yoksa blok üretilmez; kullanıcıya ham hata/anahtar çıkmaz. */
(function () {
  "use strict";
  var SA = 3600 * 1000, C_PENCERE = 36 * SA, HAFTA_ONCE = 12 * SA;
  var KRITIK = { RED_FLAG: 1, STOPPED: 1, SAFETY_CAR: 1, VSC: 1, DELAYED: 1, POSTPONED: 1, CANCELLED: 1, RESCHEDULED: 1 };
  var CANLI_K = { LIVE: 1, RESUMED: 1, SAFETY_CAR: 1, VSC: 1, RED_FLAG: 1, STOPPED: 1 };
  var UZATMA = 3 * SA, FEED_AKTIF = { LIVE: 1, RESUMED: 1, RED_FLAG: 1, SESSION_STOPPED: 1 }, FEED_K = { RED_FLAG: 1, STOPPED: 1, SAFETY_CAR: 1, VSC: 1, RESUMED: 1 };
  var S = { html: null, tick: 0, istendi: false, liste: {}, gozlendi: false, model: null };

  function $(id) { return document.getElementById(id); }
  function bul(f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } }
  function esc(x) { return window.F1UI && F1UI.esc ? F1UI.esc(x) : String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }
  function sehir(t) { return bul(function () { return window.SezonTakvim && SezonTakvim.sehirGorunen ? SezonTakvim.sehirGorunen(t) : t; }, t); }
  function tz() { return bul(function () { return HaftaVeri.ANA_TZ; }, "Europe/Istanbul") || "Europe/Istanbul"; }
  function gunSaat(d) { return (bul(function () { return HaftaVeri.kisaGunYaz(d, tz()); }, "") || "").toLocaleUpperCase("tr") + " · " + (bul(function () { return HaftaVeri.saatYaz(d, tz()); }, "") || ""); }
  function saat(d) { return bul(function () { return HaftaVeri.saatYaz(d, tz()); }, "") || ""; }
  function tarihZ(y) { return bul(function () { return window.BugunKaynak().zaman(y).getTime(); }, NaN); }

  // ---------- pist / yer ----------
  function pistAd(y) { return bul(function () { return SezonTakvim.pistGorunen(y); }, "") || ""; }
  function yerHtml(y) {
    var l = (y.Circuit && y.Circuit.Location) || {}, p = pistAd(y), s = sehir(l.locality || "");
    var bayrak = bul(function () { return F1UI.bayrak(l.country); }, "");
    return "<p class='bg-yer'>" + bayrak + "<span>" + esc([s, p].filter(Boolean).join(" · ")) + "</span></p>";
  }
  function pistSvg(y) {
    var id = y.Circuit && y.Circuit.circuitId, PS = window.PistSiluetleri;
    if (!PS || !PS.YOL || !PS.YOL[id]) { return "<div class='bg-pist bg-pist-yok' role='img' aria-label='Pist silueti hazırlanıyor'></div>"; }
    return "<svg class='bg-pist' viewBox='0 0 300 200' role='img' aria-label='Pist silueti (dekoratif çizim)' preserveAspectRatio='xMidYMid meet'><path class='bg-hat-alt' d='" + PS.YOL[id] + "'/><path class='bg-hat' d='" + PS.YOL[id] + "'/></svg>";
  }

  // ---------- MOD HESABI ----------
  function feedNotlari(K, y, hBas) {
    var out = [];
    ["", "-sprint"].forEach(function (ek) {
      var o = bul(function () { return RaceFeed.yukle(K.sezon + "-" + y.round + ek).olaylar; }, []) || [];
      o.forEach(function (e) {
        var ts = Date.parse(e && e.timestamp); if (isNaN(ts) || ts < hBas) { return; }
        var u = bul(function () { return TickerHesap.uygun(e, { maxMetin: 110 }); }, null); if (!u) { return; }
        out.push({ ts: ts, metin: u.metin, id: e.id || (e.category + "|" + ts) });
      });
    });
    out.sort(function (a, b) { return b.ts - a.ts; });
    return out.filter(function (e, i, a) { return a.findIndex(function (x) { return x.id === e.id; }) === i; }).slice(0, 3);
  }

  // Race Feed'in DOĞRULADIĞI seans durumu (HaftaState.feedDurumu, yalnız okur). null = feed yok → saat tabanlı tahmin
  function feedTip(K, y, s, now) {
    if (!s || (s.anahtar !== "Race" && s.anahtar !== "Sprint")) { return null; }
    return bul(function () {
      var o = RaceFeed.yukle(K.sezon + "-" + y.round + (s.anahtar === "Sprint" ? "-sprint" : "")).olaylar || [];
      var fd = HaftaState.feedDurumu(o, { anahtar: s.anahtar, baslangic: s.baslangic, bitis: s.bitis, planliBaslangic: s.baslangic }, now);
      return fd && fd.tip ? fd.tip : null;
    }, null);
  }

  function modBelirle(now) {
    var K = bul(function () { return window.BugunKaynak(); }, null);
    if (!K || !K.yarislar || !K.yarislar.length || !window.HaftaVeri) { return { mod: "bos" }; }
    var y = bul(function () { return K.secYaris(); }, null), h = y ? bul(function () { return HaftaVeri.haftaKur(y, "f1"); }, null) : null;
    var race = h && h.seanslar.filter(function (s) { return s.anahtar === "Race"; })[0];
    if (y && h && race) {
      var ses = h.seanslar, raceBas = race.baslangic.getTime(), raceBit = race.bitis.getTime(), hBas = ses[0].baslangic.getTime();
      var ctx = bul(function () { return window.BugunCtx(y); }, null), kan = bul(function () { return GunV3.kanonik(ctx); }, null);
      var tk = bul(function () { return FeedCanli.tickerOturum(now); }, null);
      var dur = ses.map(function (s) { return bul(function () { return HaftaVeri.seansDurumu(s, h, now); }, "yaklasan"); });
      var iA = dur.indexOf("canli"), aktif = iA >= 0 ? ses[iA] : null, sonraki = null;
      ses.forEach(function (s, i) { if (!sonraki && dur[i] === "yaklasan") { sonraki = s; } });
      var kanCanli = !!(kan && CANLI_K[kan.anahtar] && now < raceBit + (kan.anahtar === "LIVE" ? 0 : UZATMA));   // feed kaynaklı durumlar uzayan yarışta da (sınırlı) geçerli
      var rFd = feedTip(K, y, race, now), aFd = aktif ? feedTip(K, y, aktif, now) : null;
      var feedAktif = !!(FEED_AKTIF[rFd] && now >= raceBas && now < raceBit + UZATMA);
      var sonucVar = now >= raceBas && !!((kan && kan.anahtar === "COMPLETED") || podyum(K, y, true));   // a) kanonik COMPLETED  b) var olan yarış sonucu
      var gercek = !!(FEED_AKTIF[aktif ? aFd : rFd] || (kan && FEED_K[kan.anahtar]));                    // Race Feed doğrulaması
      var canli = !!(tk && tk.durum === "canli") || !!aktif || kanCanli;
      var gecik = !!(tk && (tk.durum === "gecikti" || tk.durum === "ertelendi" || tk.durum === "iptal")) || !!(kan && ({ DELAYED: 1, POSTPONED: 1, CANCELLED: 1, RESCHEDULED: 1 })[kan.anahtar]);
      var mod = null;
      if (sonucVar && now < raceBit + C_PENCERE) { mod = "C"; }
      else if (canli || gecik || feedAktif) { mod = "A"; }
      else if (now >= raceBit && now < raceBit + C_PENCERE) { mod = "C"; }   // c) yalnız FALLBACK: start+120 dk, sonuç/COMPLETED/doğrulanmış uzama yok
      else if (now >= hBas - HAFTA_ONCE && now < raceBit) { mod = "A"; }
      if (mod) { return { mod: mod, K: K, y: y, h: h, ses: ses, dur: dur, kan: kan, tk: tk, aktif: aktif, sonraki: sonraki, canli: canli || feedAktif, gercek: gercek, gecik: gecik, race: race, raceBas: raceBas, hBas: hBas, now: now }; }
    }
    // B: normal — Güncel Sezon'daki onaylı "sıradaki yarış" kuralı (HaftaVeri.varsayilanTur: başlangıç + 6 sa)
    var sir = bul(function () { return HaftaVeri.varsayilanTur(K.yarislar, now); }, null);
    var bitti = !sir || !(tarihZ(sir) + 6 * SA > now);
    return { mod: "B", K: K, y: bitti ? null : sir, bitti: bitti, now: now };
  }

  // ---------- parçalar ----------
  function sureYaz(ms) {
    var f = Math.max(0, Math.floor(ms / 1000)), g = Math.floor(f / 86400); f %= 86400;
    var sa = Math.floor(f / 3600); f %= 3600; var dk = Math.floor(f / 60), sn = f % 60;
    return (g ? g + " gün " : "") + (g || sa ? sa + " sa " : "") + dk + " dk " + (sn < 10 ? "0" : "") + sn + " sn";
  }
  function kutular(bas) {
    var b = [["gun", "GÜN"], ["saat", "SAAT"], ["dk", "DK"], ["sn", "SN"]];
    return "<div class='bg-sayac' data-bas='" + bas + "' role='timer' aria-label='Yarışa kalan süre'>" + b.map(function (x) { return "<div class='bg-kutu'><span class='bg-sayi' data-u='" + x[0] + "'>--</span><span class='bg-birim'>" + x[1] + "</span></div>"; }).join("") + "</div>";
  }
  function kod(ton, yazi) { return "<b class='bg-kod bg-ton-" + esc(ton) + "'>" + esc(yazi) + "</b>"; }
  function cta(hedef, ad, ana, alt) { return "<button type='button' class='bg-btn" + (ana ? " bg-btn-ana" : "") + "' data-git='" + esc(hedef) + "'>" + esc(ad) + (alt ? " <small>" + esc(alt) + "</small>" : "") + " <span aria-hidden='true'>→</span></button>"; }
  function turYazi(y, K) { return "TUR " + esc(y.round) + (K.yarislar.length ? " / " + K.yarislar.length : ""); }
  function sprintMi(h) { return !!(h && h.sprintMi); }

  // ---- MOD A ----
  function htmlA(m) {
    var y = m.y, h = m.h, K = m.K, kan = m.kan, tk = m.tk, ton = "yaklasan", etiket = "UPCOMING";
    if (kan && (KRITIK[kan.anahtar] || CANLI_K[kan.anahtar])) { etiket = String(kan.etiket || "").toLocaleUpperCase("en"); ton = kan.ton; }
    else if (m.aktif || (tk && tk.durum === "canli") || m.canli) { etiket = m.gercek ? "LIVE" : "LIVE TAHMİNİ"; ton = m.gercek ? "live" : "bekle"; }
    else if (kan && kan.anahtar === "RACE_DAY") { etiket = "RACE DAY"; }
    if (m.aktif && m.aktif.anahtar !== "Race" && !(kan && KRITIK[kan.anahtar])) { etiket = m.gercek ? "LIVE" : "LIVE TAHMİNİ"; ton = m.gercek ? "live" : "bekle"; }
    if (kan && !KRITIK[kan.anahtar] && kan.anahtar === "LIVE" && !m.gercek) { etiket = "LIVE TAHMİNİ"; ton = "bekle"; }   // kanonik LIVE yalnız saatten geliyorsa dürüst etiket
    var tahmini = !m.gercek;
    var secili = m.aktif || m.sonraki;
    var ses = "";
    if (secili) {
      ses = "<div class='bg-ses'><span class='bg-ses-et'>" + (m.aktif ? "ŞU AN" : "SIRADAKİ SEANS") + "</span><b class='bg-ses-ad'>" + esc(String(secili.ad).toLocaleUpperCase("tr").replace(/SPRİNT/g, "SPRINT")) + "</b>" +
            "<span class='bg-ses-z'>" + esc(gunSaat(secili.baslangic)) + " <small>TR</small></span>" +
            (m.aktif ? "<span class='bg-ses-sayac" + (tahmini ? " bg-ses-tahmin" : "") + "'>" + (tahmini ? "SAATE GÖRE SÜRÜYOR OLMALI" : "DEVAM EDİYOR") + "</span>" : "<span class='bg-ses-sayac' data-bas='" + secili.baslangic.getTime() + "' data-bicim='s' role='timer'>--</span>") + "</div>";
    }
    // kritik durum: tek satır
    var kr = "";
    if (kan && KRITIK[kan.anahtar]) { kr = String(kan.baslik || "") + (({ RED_FLAG: "Yeniden başlama bekleniyor", STOPPED: "Yeniden başlama bekleniyor" })[kan.anahtar] ? " · Yeniden başlama bekleniyor" : ""); }
    else if (tk && tk.durum && tk.durum !== "canli") { kr = (tk.oturum === "Sprint" ? "Sprint" : "Yarış") + " " + ({ gecikti: "başlangıcı gecikti", ertelendi: "ertelendi", iptal: "iptal edildi" })[tk.durum]; }
    if (!kr && m.canli && !m.aktif && m.now >= m.race.bitis.getTime()) { kr = "Planlı bitiş geçti · yarış sürüyor (Race Feed'e göre)"; }
    var kritik = kr ? "<p class='bg-kritik' role='status'><b>KRİTİK</b><span>" + esc(kr) + "</span></p>" : "";
    var zaman = "<ul class='bg-zaman' aria-label='Seans durumu'>" + m.ses.map(function (s, i) {
      return "<li class='bg-z bg-z-" + esc(m.dur[i]) + "'><span class='bg-z-ad'>" + esc(s.kisa) + "</span><span class='bg-z-sa'>" + esc(saat(s.baslangic)) + "</span></li>";
    }).join("") + "</ul>";
    var hero = "<section class='bg-hero bg-ton-b-" + esc(ton) + "' data-mod='A' data-ton='" + esc(ton) + "'><div class='bg-hero-g'><div class='bg-sol'>" +
      "<p class='bg-ust'>" + kod(ton, etiket) + "<span class='bg-meta'>" + turYazi(y, K) + "</span>" + (sprintMi(h) ? "<span class='bg-sprint'>SPRINT</span>" : "") + "</p>" +
      "<h2 class='bg-ad' lang='en'>" + esc(y.raceName) + "</h2>" + yerHtml(y) + ses + kritik + "</div><div class='bg-sag'>" + pistSvg(y) + "</div></div>" + zaman + "</section>";
    // race feed (yalnız mevcut depoda varsa)
    var fd = feedNotlari(m.K, y, m.hBas), feed = fd.length ? "<section class='bg-blok bg-feed' aria-label='Race Feed'><h3 class='bg-h'>RACE FEED</h3><ul>" + fd.map(function (e) { return "<li><time>" + esc(saat(new Date(e.ts))) + "</time><span>" + esc(e.metin) + "</span></li>"; }).join("") + "</ul></section>" : "";
    // CTA doğru alt moda
    var a = m.aktif || m.sonraki || m.race, hedef = a.anahtar === "Race" ? "gun" : (a.anahtar === "Sprint" && sprintMi(h) ? "sprint" : "hafta");
    if (m.tk && m.tk.oturum === "Race") { hedef = "gun"; } else if (m.tk && m.tk.oturum === "Sprint") { hedef = "sprint"; }
    return hero + feed + "<div class='bg-cta'>" + cta(hedef, "HAFTA SONU'NA GİT", true, hedef === "gun" ? "YARIŞ GÜNÜ" : (hedef === "sprint" ? "SPRINT" : "")) + "</div>";
  }

  // ---- sonuç özeti (yalnız mevcut kaynaklardan: SezonTakvim modeli / JolpicaIstemci önbelleği) ----
  function podyum(K, y, sessiz) {
    var tur = Number(y.round), t = bul(function () { return SezonTakvim._durum.model.turlar[tur]; }, null), p = null, pole = null;
    if (t && t.kazanan) { p = [t.kazanan, t.p2, t.p3]; pole = t.pole || null; }
    else {
      var oku = function (k) { return bul(function () { return JolpicaIstemci.oku("sezon-" + K.sezon + "-" + k).veri.turlar[tur]; }, null) || null; };
      var k1 = oku("sonuc1"); if (k1) { p = [k1, oku("sonuc2"), oku("sonuc3")]; pole = oku("pole"); }
    }
    if (!p) {
      if (!sessiz && !S.istendi && window.SezonTakvim && SezonTakvim.ac) { S.istendi = true; bul(function () { SezonTakvim.ac(); }); }   // MEVCUT sezon yükleyicisi (kendi önbelleğiyle); BUGÜN kendisi istek yapmaz
      return null;
    }
    p = p.filter(Boolean);
    return p.length ? { p: p, pole: pole } : null;
  }
  function yorumCumlesi(y, pd) {
    if (!window.YorumMotoru || !YorumMotoru._uret) { return ""; }
    var tur = Number(y.round), liste = S.liste[tur];
    if (liste && pd && pd.p[0] && liste[0] && liste[0].Driver && pd.p[0].k && liste[0].Driver.code !== pd.p[0].k) { liste = null; }   // kaynaklar çelişirse podyumla tutarlı kalan kaynağı kullan
    if (!liste && pd) {      // tam sonuç satırları henüz yok → eldeki GERÇEK podyum kayıtlarından aynı motorun cümlesi
      liste = pd.p.map(function (r, i) { return { position: String(i + 1), positionText: String(i + 1), grid: r.g, laps: "", status: r.d || "Finished", Time: r.s ? { time: r.s } : undefined, Driver: { code: r.k, givenName: "", familyName: r.a }, Constructor: { name: r.t } }; });
    }
    var o = bul(function () { return YorumMotoru._uret(liste, pd && pd.pole ? pd.pole : null); }, []);
    return o && o[0] ? o[0] : "";
  }
  function modulCipleri(h) {
    var out = [], s = h.seanslar.filter(function (x) { return x.anahtar === "Race"; })[0]; if (!s) { return out; }
    var d = function (mod) { var id = h.sezon + "-" + h.tur + "-" + s.anahtar, e = bul(function () { return window[mod]._durum[id]; }, null); return e && e.durum === "ok" ? e.veri : null; };
    var o = d("SeansOlaylari"), g = d("Gecisler"), p = d("Pitler");
    if (o && o.ozet && o.ozet.kritik > 0) { out.push([o.ozet.kritik, "KRİTİK OLAY"]); }
    if (p && p.ozet && p.ozet.toplam > 0) { out.push([p.ozet.toplam, "PİT"]); }
    if (g && g.ozet && g.ozet.toplam > 0) { out.push([g.ozet.toplam, "GEÇİŞ KAYDI"]); }
    return out;
  }
  // ---- MOD C ----
  function htmlC(m) {
    var y = m.y, h = m.h, K = m.K, pd = podyum(K, y), ton = pd ? "bitti" : "bekle";
    var pod = "";
    if (pd) {
      pod = "<ol class='bg-pod' aria-label='Podyum'>" + pd.p.slice(0, 3).map(function (r, i) {
        return "<li class='bg-pod-s'>" + bul(function () { return F1UI.pozRozet(String(i + 1)); }, "<b>" + (i + 1) + "</b>") + "<span class='bg-pod-p'>" + bul(function () { return F1UI.pilotHucresi(r.k, r.a); }, esc(r.a)) + "</span>" + bul(function () { return F1UI.takimRozeti(r.t); }, "") + "</li>";
      }).join("") + "</ol>";
    }
    var hero = "<section class='bg-hero bg-ton-b-" + ton + "' data-mod='C' data-ton='" + ton + "'><div class='bg-hero-g'><div class='bg-sol'>" +
      "<p class='bg-ust'>" + kod(ton, pd ? "YARIŞ TAMAMLANDI" : "SONUÇLAR BEKLENİYOR") + "<span class='bg-meta'>" + turYazi(y, K) + "</span>" + (sprintMi(h) ? "<span class='bg-sprint'>SPRINT</span>" : "") + "</p>" +
      "<h2 class='bg-ad' lang='en'>" + esc(y.raceName) + "</h2>" + yerHtml(y) + pod + "</div><div class='bg-sag'>" + pistSvg(y) + "</div></div></section>";
    var c = pd ? yorumCumlesi(y, pd) : "", mc = modulCipleri(h);
    var ne = (c || mc.length) ? "<section class='bg-blok bg-ne' aria-label='Ne oldu?'><h3 class='bg-h'>NE OLDU?</h3>" + (c ? "<p class='bg-cumle'>" + esc(c) + "</p>" : "") +
             (mc.length ? "<p class='bg-cipler'>" + mc.map(function (x) { return "<span class='bg-cip'><b>" + esc(x[0]) + "</b> " + esc(x[1]) + "</span>"; }).join("") + "</p>" : "") + "</section>" : "";
    return hero + ne + "<div class='bg-cta'>" + cta("yaris", "YARIŞ ANALİZİNE GİT", true) + "</div>";
  }

  // ---- MOD B ----
  function htmlB(m) {
    var K = m.K, y = m.y, pil = (K.pilotlar || []).slice(0, 3);
    var sip = pil.length ? "<section class='bg-blok bg-sampiyona' aria-label='Şampiyona'><h3 class='bg-h'>ŞAMPİYONA</h3><ol class='bg-std'>" + pil.map(function (r, i) {
      var d = r.Driver || {}, ad = ((d.givenName || "") + " " + (d.familyName || "")).trim(), tk = r.Constructors && r.Constructors[0] ? r.Constructors[0].name : "";
      return "<li>" + bul(function () { return F1UI.pozRozet(String(i + 1)); }, "<b>" + (i + 1) + "</b>") + "<span class='bg-std-p'>" + bul(function () { return F1UI.pilotHucresi(d.code || "", ad); }, esc(ad)) + "</span><span class='bg-std-t'>" + (tk ? bul(function () { return F1UI.takimRozeti(tk); }, "") : "") + "</span><span class='bg-std-pt'>" + esc(r.points) + " <small>PUAN</small></span></li>";
    }).join("") + "</ol></section>" : "";
    if (!y) {
      return "<section class='bg-hero bg-ton-b-bitti' data-mod='B' data-ton='bitti'><div class='bg-hero-g'><div class='bg-sol'><p class='bg-ust'>" + kod("bitti", "SEZON TAMAMLANDI") + "</p><h2 class='bg-ad'>" + esc(K.sezon) + " Sezonu</h2></div></div></section>" + sip +
             "<div class='bg-cta'>" + cta("sezon", "SEZONA GİT", true) + "</div>";
    }
    var h = bul(function () { return HaftaVeri.haftaKur(y, "f1"); }, null), bas = tarihZ(y), ilk = h && h.seanslar[0];
    var tarih = bul(function () { return HaftaVeri.kisaGunYaz(new Date(bas), tz()); }, "");
    var hero = "<section class='bg-hero bg-ton-b-yaklasan' data-mod='B' data-ton='yaklasan'><div class='bg-hero-g'><div class='bg-sol'>" +
      "<p class='bg-ust'>" + kod("yaklasan", "SIRADAKİ YARIŞ") + "<span class='bg-meta'>" + turYazi(y, K) + "</span>" + (sprintMi(h) ? "<span class='bg-sprint'>SPRINT</span>" : "") + "</p>" +
      "<h2 class='bg-ad' lang='en'>" + esc(y.raceName) + "</h2>" + yerHtml(y) +
      "<p class='bg-tarih'>" + esc(String(tarih).toLocaleUpperCase("tr")) + " · " + esc(saat(new Date(bas))) + " <small>TR</small>" + (ilk ? " <span class='bg-tarih-h'>HAFTA SONU: " + esc(gunSaat(ilk.baslangic)) + "</span>" : "") + "</p>" +
      kutular(bas) + "</div><div class='bg-sag'>" + pistSvg(y) + "</div></div></section>";
    return hero + sip + "<div class='bg-cta'>" + cta("sezon", "SEZONA GİT", false) + cta("hafta", "HAFTA SONU'NA GİT", true) + "</div>";
  }

  // ---------- çizim ----------
  function bosHtml() {
    var hata = ($("sonraki") && /Veri alınamadı/.test($("sonraki").textContent || ""));
    return "<section class='bg-hero bg-ton-b-bekle' data-mod='bos' data-ton='bekle'><div class='bg-sol'><p class='bg-ust'>" + kod("bekle", hata ? "VERİ YOK" : "YÜKLENİYOR") + "</p><h2 class='bg-ad'>" + (hata ? "Takvim bilgisi şu an alınamadı" : "Bugünün özeti hazırlanıyor") + "</h2></div></section><div class='bg-cta'>" + cta("sezon", "SEZONA GİT", true) + "</div>";
  }
  function olustur(now) {
    var m; try { m = modBelirle(now); } catch (e) { m = { mod: "hata" }; }
    S.model = m;
    try {
      if (m.mod === "A") { return htmlA(m); }
      if (m.mod === "C") { return htmlC(m); }
      if (m.mod === "B") { return htmlB(m); }
    } catch (e) { if (window.console) { console.warn("[bugun] özet çizilemedi", e); } }
    return bosHtml();
  }
  function sayacYaz() {
    var kok = $("bg-kok"); if (!kok) { return false; }
    var gec = false, now = Date.now();
    Array.prototype.forEach.call(kok.querySelectorAll("[data-bas]"), function (e) {
      var fark = Number(e.getAttribute("data-bas")) - now;
      if (fark <= 0) { gec = true; return; }
      if (e.getAttribute("data-bicim") === "s") { var t = sureYaz(fark); if (e.textContent !== t) { e.textContent = t; } return; }
      var f = Math.floor(fark / 1000), g = Math.floor(f / 86400); f %= 86400; var sa = Math.floor(f / 3600); f %= 3600; var dk = Math.floor(f / 60), sn = f % 60, v = { gun: g, saat: sa, dk: dk, sn: sn };
      Array.prototype.forEach.call(e.querySelectorAll("[data-u]"), function (b) { var u = b.getAttribute("data-u"), t = u === "gun" ? String(v[u]) : (v[u] < 10 ? "0" : "") + v[u]; if (b.textContent !== t) { b.textContent = t; } });
      e.setAttribute("aria-label", "Yarışa kalan süre: " + g + " gün " + sa + " saat " + dk + " dakika");
    });
    return gec;
  }
  function ciz() {
    var kok = $("bg-kok"), sekme = $("sekme-bugun"); if (!kok || !sekme || sekme.hidden) { return; }
    var h = olustur(Date.now());
    if (S.html !== h) { S.html = h; kok.innerHTML = h; }
    sayacYaz();
  }
  function tikSaat() {                    // mevcut saat çubuğunun saniyelik güncellemesi: sayaç her sn, tam yeniden değerlendirme seyrek
    var sekme = $("sekme-bugun"); if (!sekme || sekme.hidden) { return; }
    S.tick++;
    var beklemede = !S.model || S.model.mod === "bos" || S.model.mod === "hata" || (S.model.mod === "C" && /SONUÇLAR BEKLENİYOR/.test(S.html || ""));
    if (beklemede || S.tick % 5 === 0 || sayacYaz()) { ciz(); }
  }
  function saatGozle() {
    if (S.gozlendi) { return; }
    var e = $("rc-saat"); if (!e || !window.MutationObserver) { return; }
    S.gozlendi = true; new MutationObserver(tikSaat).observe(e, { childList: true, characterData: true, subtree: true });
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("#bg-kok [data-git]"); if (!b) { return; }
    var h = b.getAttribute("data-git"); if (typeof window.sekmeAc === "function") { window.sekmeAc(h); }
  });
  document.addEventListener("f1-sekme", function (e) { if (e.detail === "bugun") { S.tick = 0; saatGozle(); ciz(); } });
  document.addEventListener("f1-feed-guncel", function () { ciz(); });
  document.addEventListener("f1-yaris-sonuc", function (e) { try { if (e.detail && e.detail.liste) { S.liste[Number(e.detail.tur)] = e.detail.liste; } } catch (x) { /* önemsiz */ } ciz(); });
  function hazir() { saatGozle(); ciz(); }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", hazir); } else { hazir(); }
  window.BugunV3 = { modBelirle: modBelirle, ciz: ciz, _durum: S };
})();
