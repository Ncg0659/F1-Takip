/* PREDICTION UI v1 — Tahmin Motoru çıktısının GÖRÜNÜMÜ. Yeni model / ağırlık / veri kaynağı YOK.
   • BUGÜN: kısa "YARIŞ TAHMİNİ" kartı (ilk 3) → #tp-bugun.   ANALİZ/GRAFİK: ayrıntılı panel + şampiyonluk bloğu → #tp-analiz.
   • Veri: TahminVeri (feature set) → TahminMotoru (racePredict / championshipPredict). Çıktı AYNEN gösterilir; reasons[] yeniden yazılmaz.
   • Mod: PRE_WEEKEND → "HAFTA SONU ÖNCESİ"; qualifying bitince POST_QUALIFYING → "SIRALAMA SONRASI" (veri yoksa yarış öncesine düşer).
     Yarış başladıktan sonra tahmin SABİT (pre-race): yeniden hesaplanmaz, mod değişmez, canlı sonuç kullanılmaz.
   • İstek azaltma: tek ortak sezon havuzu (sezon başına bir kez), qualifying eski sezonlarda tembel, pit/takvim/telemetri istenmez, tamamlanmış sezonlar yerel arşivden.
   • Yeni polling / zamanlayıcı YOK: yeniden değerlendirme f1-sekme olayı + mevcut saat çubuğu (#rc-saat) gözlemcisiyle yapılır; ağ yalnız gerektiğinde ve kısıtlı.
   • Jolpica istekleri paylaşılan JolpicaIstemci kuyruğunu BLOKLAMASIN diye kendi sıralı kuyruğundan geçer (429'da kısa yeniden deneme).
   • Veri yoksa kart/panel çizilmez. Telemetri OpenF1 yükünü artırmasın diye kullanıcı arayüzü örneğinde bağlı değildir (güven buna göre hesaplanır). */
(function () {
  "use strict";
  var BASE = "https://api.jolpi.ca/ergast/f1/";
  var PRE = "PRE_WEEKEND", POST = "POST_QUALIFYING";
  var MOD_ETIKET = { PRE_WEEKEND: "HAFTA SONU ÖNCESİ", POST_QUALIFYING: "SIRALAMA SONRASI" };
  var GUVEN_ETIKET = { HIGH: "YÜKSEK", MEDIUM: "ORTA", LOW: "DÜŞÜK" };
  var GUVEN_YOK = "Güven seviyesi için yeterli geçmiş veri yok";   // motor UNRELIABLE döndürürse seviye gösterilmez
  var NOT = "Tahminler mevcut verilere dayalı olasılıklardır; sonuç garantisi değildir.";
  var GUVEN_NOT = "Güven, mevcut veri kapsamını gösterir.";
  var BEKLE_YUKSELT = 5 * 60 * 1000, BEKLE_HATA = 2 * 60 * 1000, ACILIS_TIK = 6, SEYREK_TIK = 5;
  var S = { sonuc: {}, deneme: {}, devam: {}, acik: {}, html: { bugun: null, analiz: null }, tick: 0, gozlendi: false, tv: null, kuyruk: Promise.resolve(), hava: {}, sayac: { istek: 0, liste: [] } };

  function $(id) { return document.getElementById(id); }
  function bul(f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } }
  function esc(x) { return window.F1UI && F1UI.esc ? F1UI.esc(x) : String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }
  function pct(p) { return (typeof p !== "number" || !isFinite(p)) ? "—" : (p > 0 && p < 0.005 ? "<1%" : Math.round(p * 100) + "%"); }

  // ---------- ağ: kendi sıralı kuyruğu ----------
  function bekle(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function ham(yol) {
    for (var d = 0; d < 3; d++) {
      try {
        S.sayac.istek++; S.sayac.liste.push(yol);
        var r = await fetch(BASE + yol);
        if (r.status === 429) { await bekle(1500 * (d + 1)); continue; }
        if (!r.ok) { return { tur: r.status === 404 ? "bos" : "hata", veri: null }; }
        var j = await r.json();
        return { tur: "ok", veri: j && j.MRData ? j.MRData : null };
      } catch (e) { return { tur: "hata", veri: null }; }
    }
    return { tur: "hata", veri: null };
  }
  function cek(yol) { var is = S.kuyruk.then(function () { return ham(yol); }); S.kuyruk = is.catch(function () {}); return is; }
  function havaMemo(kayit, anahtar) {
    var HV = window.HaftaVeri, SHV = window.SeansHavaVeri; if (!HV || !SHV) { return Promise.resolve(null); }
    var id = kayit && kayit.season + "-" + kayit.round + "-" + anahtar; if (S.hava[id]) { return S.hava[id]; }
    var hafta = HV.haftaKur(kayit, "f1"), seans = hafta.seanslar.filter(function (s) { return s.anahtar === anahtar; })[0];
    var p = seans ? SHV.yukle(hafta, seans) : Promise.resolve({ durum: "oturum-yok" });
    S.hava[id] = p; p.then(function (r) { if (!r || r.durum !== "ok") { delete S.hava[id]; } }, function () { delete S.hava[id]; });
    return p;
  }
  var ARSIV_ONEK = "f1-tahmin-arsiv-v1:";
  var ARSIV = {
    oku: function (k) { try { var h = localStorage.getItem(ARSIV_ONEK + k); return h ? JSON.parse(h) : null; } catch (e) { return null; } },
    yaz: function (k, v) { try { localStorage.setItem(ARSIV_ONEK + k, JSON.stringify(v)); } catch (e) { /* dolu/engelli: arşivsiz devam */ } }
  };
  function takvimKaynagi(y) {
    var K = bul(function () { return window.BugunKaynak(); }, null);
    return K && Number(K.sezon) === Number(y) && K.yarislar && K.yarislar.length ? { RaceTable: { Races: K.yarislar } } : null;
  }
  function sprintPaylasilan(y) {
    var JI = window.JolpicaIstemci; if (!JI || !JI.oku) { return null; }
    try { var k = JI.oku("sezon-" + y + "-a3-sprint"); return k && k.veri ? k.veri : null; } catch (e) { return null; }
  }
  function veriKatmani() {
    if (S.tv) { return S.tv; }
    var TV = window.TahminVeri; if (!TV || !TV.kur) { return null; }
    S.tv = TV.kur({ jolpica: cek, telemetri: null, hava: havaMemo, pistler: window.ICERIK_PISTLER && ICERIK_PISTLER.pistler, siniflandirma: window.PIST_SINIFLANDIRMA, gecmisHava: false,
                    pit: false,                 // motor pit'i kullanmıyor → istek yok
                    takvim: takvimKaynagi,      // güncel sezon takvimi uygulamanın zaten yüklediği listeden (istek yok)
                    sprintOnbellek: sprintPaylasilan,   // A3 sezon analizinin sprint önbelleği varsa aynen kullanılır (aynı kaynak/önbellek)
                    arsiv: ARSIV });            // tamamlanmış sezonlar + güncel sezonun işlenmiş turları (yerel, yalnız başarılı/boş olmayan veri)
    return S.tv;
  }

  // ---------- hedef yarış + mod ----------
  function pilotlar(K) {
    var out = [];
    (K.pilotlar || []).forEach(function (r) {
      var d = r && r.Driver; if (!d || !d.driverId) { return; }
      out.push({ id: d.driverId, kod: d.code || "", ad: d.familyName || d.driverId });
    });
    return out;
  }
  function hedefBul(now, bugunMu) {
    var K = bul(function () { return window.BugunKaynak(); }, null);
    if (!K || !K.yarislar || !K.yarislar.length || !K.pilotlar || !K.pilotlar.length || !window.BugunV3 || !window.HaftaVeri) { return null; }
    var m = bul(function () { return BugunV3.modBelirle(now); }, null); if (!m) { return null; }
    var y = null;
    if (m.mod === "A" || m.mod === "B") { y = m.y; }
    else if (m.mod === "C") {
      if (bugunMu) { return { gizle: "C" }; }                       // tamamlanan yarışın özeti gösterilirken yeni tahmin kartı çizilmez
      var sira = Number(m.y && m.y.round);
      y = K.yarislar.filter(function (r) { return Number(r.round) > sira; })[0] || null;
    }
    if (!y) { return null; }
    var h = (m.mod === "A" || m.mod === "B") && m.h && m.y === y ? m.h : bul(function () { return HaftaVeri.haftaKur(y, "f1"); }, null); if (!h) { return null; }
    var race = h.seanslar.filter(function (s) { return s.anahtar === "Race"; })[0], q = h.seanslar.filter(function (s) { return s.anahtar === "Qualifying"; })[0];
    return { K: K, y: y, season: Number(K.sezon), round: Number(y.round), toplam: K.yarislar.length, ad: y.raceName || "",
             basladi: !!(race && now >= race.baslangic.getTime()), kualiBitti: !!(q && now >= q.bitis.getTime()) };
  }
  function anahtar(t) { return t.season + "-" + t.round; }

  // ---------- hesap (motor çıktısı AYNEN saklanır) ----------
  async function hesapla(t, mod) {
    var tv = veriKatmani(), TM = window.TahminMotoru; if (!tv || !TM) { return { durum: "hata" }; }
    var liste = pilotlar(t.K);
    var f = await Promise.all(liste.map(function (p) { return tv.ozellik({ season: t.season, round: t.round, driver: p.id, mode: mod }); }));
    var ok = f.filter(function (x) { return x && x.durum === "ok"; });
    if (!ok.length) { return { durum: f.some(function (x) { return x && x.durum === "hata"; }) ? "hata" : "bos" }; }
    var pred = TM.racePredict(ok); if (!pred || pred.durum !== "ok") { return { durum: "bos" }; }
    var kalanSprint = bul(function () { return t.K.yarislar.filter(function (r) { return Number(r.round) >= t.round; }).filter(function (r) { return HaftaVeri.haftaKur(r, "f1").sprintMi; }).length; }, 0) || 0;
    var sprintO = { sprintDataComplete: false };                                              // gerçek sprint verisi (veri katmanı); alınamazsa tam değil → matematiksel eleme yapılmaz
    try { var so = await tv.sprintOzeti({ season: t.season, round: t.round }); if (so && so.durum !== "gecersiz") { sprintO = so; } } catch (e) { /* tam değil */ }
    var champ = bul(function () { return TM.championshipPredict(ok, { toplamYaris: t.toplam, kalanSprint: kalanSprint, sprint: sprintO }); }, null);
    return { durum: "ok", mod: mod, pred: pred, champ: champ && champ.durum === "ok" ? champ : null, pilotlar: liste };
  }
  async function yukle(t, acil) {
    var key = anahtar(t), st = S.sonuc[key], now = Date.now(), ist = t.kualiBitti ? POST : PRE;
    if (S.devam[key]) { return; }
    if (st) {
      if (t.basladi || st.mod === POST || ist === PRE || st.mod === ist) { return; }           // sabit (pre-race) veya zaten en iyi mod
      if (now - (S.deneme[key] || 0) < BEKLE_YUKSELT) { return; }                              // POST'a geçiş denemesi seyrek
    } else if (S.deneme[key] && now - S.deneme[key] < BEKLE_HATA) { return; }
    if (!acil && S.tick < ACILIS_TIK) { return; }                                              // BUGÜN açılışında diğer yüklemelerin önüne geçme
    S.devam[key] = 1; S.deneme[key] = now;
    try {
      var r = await hesapla(t, ist);
      if (r.durum !== "ok" && ist === POST && !st) { r = await hesapla(t, PRE); }              // qualifying verisi henüz yok → yarış öncesi
      if (r.durum === "ok" && !(S.sonuc[key] && t.basladi)) { r.ts = now; S.sonuc[key] = r; }
    } catch (e) { /* başarısız sonuç saklanmaz */ }
    finally { delete S.devam[key]; ciz(); }
  }

  // ---------- görünüm ----------
  function genelGuven(pred) {
    var TM = window.TahminMotoru, g = (TM && TM.PARAM && TM.PARAM.GUVEN) || { HIGH: 0.75, MEDIUM: 0.5 };
    if (pred.genelGuven && pred.genelGuven.seviye) { return pred.genelGuven.seviye; }   // güven v3: yarış-düzeyi (HIGH/MEDIUM/LOW/UNRELIABLE)
    var l = pred.suruculer.slice(0, 3), o = l.reduce(function (a, s) { return a + (s.confidence || 0); }, 0) / (l.length || 1);
    return o >= g.HIGH ? "HIGH" : (o >= g.MEDIUM ? "MEDIUM" : "LOW");
  }
  function pilotBilgi(st, id) { var l = st.pilotlar || []; for (var i = 0; i < l.length; i++) { if (l[i].id === id) { return l[i]; } } return { id: id, kod: "", ad: id }; }
  function pilotHtml(p) { return bul(function () { return F1UI.pilotHucresi(p.kod, p.ad); }, esc(p.ad)); }
  function pozHtml(n) { return bul(function () { return F1UI.pozRozet(String(n)); }, "<b>" + n + "</b>"); }
  function bar(p, maks) { var w = maks > 0 ? Math.max(0, Math.min(100, Math.round(p / maks * 100))) : 0; return "<i class='tp-bar' aria-hidden='true'><b style='width:" + w + "%'></b></i>"; }
  function modEtiket(st, t) {
    return "<span class='tp-mod' data-mod='" + esc(st.mod) + "'>" + esc(MOD_ETIKET[st.mod] || st.mod) + "</span>" +
           (t.basladi ? "<span class='tp-sabit' title='Yarış başladı; tahmin yarış öncesi verilerle sabit'>YARIŞ ÖNCESİ · SABİT</span>" : "");
  }
  function guvenHtml(sev) {
    if (!GUVEN_ETIKET[sev]) { return "<p class='tp-guven' data-guven='UNRELIABLE'><b class='tp-g-d tp-g-yok'>" + esc(GUVEN_YOK) + "</b></p>"; }
    return "<p class='tp-guven' data-guven='" + esc(sev) + "'><span class='tp-g-et'>Güven:</span> <b class='tp-g-d'>" + esc(GUVEN_ETIKET[sev] || sev) + "</b><small>" + esc(GUVEN_NOT) + "</small></p>";
  }

  function kartHtml(t, st) {
    var l = st.pred.suruculer.slice(0, 3); if (!l.length) { return ""; }
    var maks = l[0].winProbability;
    var li = l.map(function (s, i) {
      var p = pilotBilgi(st, s.driver);
      return "<li data-driver='" + esc(s.driver) + "'>" + pozHtml(i + 1) + "<span class='bg-std-p tp-p'>" + pilotHtml(p) + bar(s.winProbability, maks) + "</span><span class='tp-y'>" + pct(s.winProbability) + "</span></li>";
    }).join("");
    return "<section class='tp-kart' id='tp-kart' data-mod='" + esc(st.mod) + "' aria-label='Yarış tahmini'>" +
      "<p class='tp-ust'><b class='tp-baslik'>YARIŞ TAHMİNİ</b>" + modEtiket(st, t) + "</p>" +
      "<ol class='bg-std tp-top' aria-label='Kazanma olasılığı, ilk üç'>" + li + "</ol>" +
      guvenHtml(genelGuven(st.pred)) +
      "<div class='tp-cta'><button type='button' class='bg-btn tp-btn' data-tp-git='analiz'>DETAYLI TAHMİN <span aria-hidden='true'>→</span></button></div>" +
      "<p class='tp-not'>" + esc(NOT) + "</p></section>";
  }

  function nedenHtml(s) {
    var r = (s.reasons || []).slice(0, 5);
    var gh = GUVEN_ETIKET[s.confidenceSeviye] ? "<p class='tp-d-g' data-guven='" + esc(s.confidenceSeviye) + "'>Güven: <b>" + esc(GUVEN_ETIKET[s.confidenceSeviye]) + "</b></p>" : "<p class='tp-d-g' data-guven='UNRELIABLE'>" + esc(GUVEN_YOK) + "</p>";
    return gh +
      (r.length ? "<ul class='tp-nd'>" + r.map(function (x) { return "<li data-yon='" + esc(x.yon) + "'><span class='tp-yon' aria-hidden='true'>" + (x.yon === "+" ? "+" : "−") + "</span>" + esc(x.metin) + "</li>"; }).join("") + "</ul>" : "<p class='tp-bos'>Belirgin faktör yok.</p>");
  }
  function panelHtml(t, st) {
    var l = st.pred.suruculer, mw = l[0].winProbability, mp = Math.max.apply(null, l.map(function (s) { return s.podiumProbability; })), mq = Math.max.apply(null, l.map(function (s) { return s.pointsProbability; }));
    var satir = l.map(function (s) {
      var p = pilotBilgi(st, s.driver), ac = !!S.acik[s.driver], nid = "tp-n-" + s.driver;
      return "<tr class='tp-sat' data-driver='" + esc(s.driver) + "'><td class='tp-c-p'><button type='button' class='tp-ac' data-tp-ac='" + esc(s.driver) + "' aria-expanded='" + (ac ? "true" : "false") + "' aria-controls='" + esc(nid) + "'><span class='tp-ok' aria-hidden='true'></span>" + pilotHtml(p) + "</button></td>" +
        "<td class='tp-c-y'><span class='tp-y'>" + pct(s.winProbability) + "</span>" + bar(s.winProbability, mw) + "</td>" +
        "<td class='tp-c-y'><span class='tp-y'>" + pct(s.podiumProbability) + "</span>" + bar(s.podiumProbability, mp) + "</td>" +
        "<td class='tp-c-y'><span class='tp-y'>" + pct(s.pointsProbability) + "</span>" + bar(s.pointsProbability, mq) + "</td></tr>" +
        "<tr class='tp-neden' id='" + esc(nid) + "'" + (ac ? "" : " hidden") + "><td colspan='4'>" + nedenHtml(s) + "</td></tr>";
    }).join("");
    var tablo = "<table class='tp-tablo'><caption class='bg-sr'>Pilot bazında olasılıklar</caption><thead><tr><th scope='col'>Pilot</th><th scope='col'>Kazanma %</th><th scope='col'>Podyum %</th><th scope='col'>Puan %</th></tr></thead><tbody>" + satir + "</tbody></table>";
    return "<section class='tp-panel' id='tp-panel' data-mod='" + esc(st.mod) + "' aria-label='Yarış tahmini ayrıntısı'>" +
      "<p class='tp-ust'><b class='tp-baslik'>YARIŞ TAHMİNİ</b>" + modEtiket(st, t) + "<span class='tp-meta'>TUR " + esc(t.round) + " / " + esc(t.toplam) + "</span></p>" +
      "<h2 class='tp-ad' lang='en'>" + esc(t.ad) + "</h2>" + guvenHtml(genelGuven(st.pred)) + tablo + sampiyonHtml(st) +
      "<p class='tp-not'>" + esc(NOT) + "</p></section>";
  }
  function sampiyonHtml(st) {
    var c = st.champ; if (!c || !c.suruculer) { return ""; }
    var gecerli = c.suruculer.filter(function (s) { return typeof s.championshipProbability === "number"; }), ilk = gecerli.filter(function (s) { return s.championshipProbability > 0; }).slice(0, 5);
    if (!ilk.length) { return ""; }
    var maks = ilk[0].championshipProbability, elenen = gecerli.filter(function (s) { return s.elendi; }).length;
    var li = ilk.map(function (s, i) {
      var p = pilotBilgi(st, s.driver);
      return "<li data-driver='" + esc(s.driver) + "'>" + pozHtml(i + 1) + "<span class='bg-std-p tp-p'>" + pilotHtml(p) + bar(s.championshipProbability, maks) + "</span><span class='tp-y'>" + pct(s.championshipProbability) + "</span></li>";
    }).join("");
    return "<section class='tp-ch' id='tp-ch' aria-label='Şampiyonluk tahmini'><h3 class='tp-h'>ŞAMPİYONLUK TAHMİNİ</h3>" +
      "<ol class='bg-std tp-top'>" + li + "</ol>" +
      (elenen ? "<p class='tp-alt'>Matematiksel olarak şampiyonluk dışında: " + elenen + " pilot</p>" : "") + "</section>";   // şampiyonlukta güven seviyesi gösterilmez (yalnız olasılık)
  }

  function yaz(kap, anah, html) { if (!kap) { return; } if (S.html[anah] !== html) { S.html[anah] = html; kap.innerHTML = html; } }
  function ciz() {
    var kb = $("tp-bugun"), ka = $("tp-analiz"), sb = $("sekme-bugun"), sg = $("sekme-grafik"), now = Date.now();
    try {
      if (kb && sb && !sb.hidden) {
        var t = hedefBul(now, true), st = t && !t.gizle ? S.sonuc[anahtar(t)] : null;
        yaz(kb, "bugun", st ? kartHtml(t, st) : "");
      }
      if (ka && sg && !sg.hidden) {
        var t2 = hedefBul(now, false), st2 = t2 ? S.sonuc[anahtar(t2)] : null;
        yaz(ka, "analiz", st2 ? panelHtml(t2, st2) : "");
      }
    } catch (e) { if (window.console) { console.warn("[tahmin] çizilemedi", e); } }
  }
  function tetikle(acil) {
    var sb = $("sekme-bugun"), sg = $("sekme-grafik"), g = (sb && !sb.hidden) || (sg && !sg.hidden); if (!g) { return; }
    var t = hedefBul(Date.now(), !(sg && !sg.hidden));
    if (t && t.gizle) { return; }
    if (!t && sg && !sg.hidden) { return; }
    if (t) { yukle(t, !!acil); }
  }

  document.addEventListener("f1-sekme", function (e) {
    if (e.detail !== "bugun" && e.detail !== "grafik") { return; }
    saatGozle(); ciz(); tetikle(e.detail === "grafik");
  });
  document.addEventListener("click", function (e) {
    var go = e.target.closest && e.target.closest("[data-tp-git]");
    if (go) { if (typeof window.sekmeAc === "function") { window.sekmeAc("grafik"); var p = $("tp-panel"); if (p && p.scrollIntoView) { p.scrollIntoView({ block: "start" }); } } return; }
    var b = e.target.closest && e.target.closest("[data-tp-ac]"); if (!b) { return; }
    var id = b.getAttribute("data-tp-ac"); S.acik[id] = !S.acik[id];
    var sat = $("tp-n-" + id); if (sat) { sat.hidden = !S.acik[id]; } b.setAttribute("aria-expanded", S.acik[id] ? "true" : "false");
    S.html.analiz = bul(function () { var t2 = hedefBul(Date.now(), false); return panelHtml(t2, S.sonuc[anahtar(t2)]); }, null);   // DOM yerinde güncellendi; odak kaybolmasın diye yeniden yazılmaz
  });
  function tik() {
    S.tick++;
    if (S.tick % SEYREK_TIK === 0) { tetikle(false); ciz(); }
  }
  function saatGozle() {
    if (S.gozlendi) { return; }
    var e = $("rc-saat"); if (!e || !window.MutationObserver) { return; }
    S.gozlendi = true; new MutationObserver(tik).observe(e, { childList: true, characterData: true, subtree: true });
  }
  function hazir() { saatGozle(); }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", hazir); } else { hazir(); }
  window.TahminUI = { hedefBul: hedefBul, tetikle: tetikle, ciz: ciz, MOD_ETIKET: MOD_ETIKET, GUVEN_ETIKET: GUVEN_ETIKET, NOT: NOT, _durum: S };
})();
