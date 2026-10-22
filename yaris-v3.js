/* UI v3 — Yarış Analizi / POST-RACE ANALYSIS sunum katmanı.
   YALNIZ sunum: fetch, zamanlayıcı, polling, yeni hesap YOK. Veri: index.html'in mevcut yüklemesinin "f1-yaris-sonuc" olayı (Jolpica sonuçları) +
   A7 modüllerinin BELLEKTEKİ (yüklenmişse) durumu. A7 modülleri aynen kullanılır; lazy-load modülün KENDİ düğmesiyle tetiklenir.
   Girdi: window.YarisCtx() (index.html; seçili yarış kaydı + hafta + Race seansı). Hiçbir causal yorum üretilmez. */
(function () {
  var V3 = window.V3, esc = V3.esc;
  var Y = { tur: null, liste: null, aktif: "sonuc", sekImza: "", panelK: "", pistId: null, sessiz: false };
  var A7 = [["olay", "OLAYLAR", "SeansOlaylari", "so"], ["tur", "TURLAR", "TurAnalizi", "ta"], ["gecis", "GEÇİŞ", "Gecisler", "gc"], ["pit", "PİT", "Pitler", "pt"], ["hava", "HAVA", "SeansHava", "sh"]];
  var HER_ZAMAN = { tur: 1, pit: 1 };     // eski tur grafiği / Jolpica pit tablosu bu sekmelerde yaşar: A7 boş olsa da sekme kalır
  function $(id) { return document.getElementById(id); }

  // ---- hero ----
  function pist(c) {
    var kap = $("yv-pist"); if (!kap) { return; }
    var id = c.h && c.h.pistId; if (Y.pistId === id) { return; }
    Y.pistId = id; kap.innerHTML = "";
    var PS = window.PistSiluetleri;
    kap.hidden = !(PS && PS.YOL && PS.YOL[id]);
    if (!kap.hidden) { kap.innerHTML = "<svg class='g3-svg' viewBox='0 0 300 200' role='img' aria-label='Pist silueti (dekoratif çizim)' preserveAspectRatio='xMidYMid meet'><path class='g3-hat-alt' d='" + PS.YOL[id] + "'/><path class='g3-hat' d='" + PS.YOL[id] + "'/></svg>"; }
  }
  function pistAd(y) {       // ortak helper (sezon-takvim.js); yoksa ham anahtar sızmasın diye şehir
    var st = window.SezonTakvim;
    try { if (st && st.pistGorunen) { return st.pistGorunen(y) || ""; } } catch (e) {}
    return (y.Circuit.Location && y.Circuit.Location.locality) || "";
  }
  function ad(r) { return (r.Driver.givenName || "") + " " + (r.Driver.familyName || ""); }
  function hero(c) {
    var y = c.y, lok = y.Circuit.Location, L = Y.liste, w = L && L[0], tarih = "";
    try { tarih = new Date(y.date + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }); } catch (e) {}
    $("yv-tur").innerHTML = "TUR " + esc(y.round) + (c.toplam >= Number(y.round) ? " <small>/ " + c.toplam + "</small>" : "") + (c.h && c.h.sprintMi ? " <span class='yv-sprint'>SPRINT</span>" : "");
    $("yv-durum").innerHTML = L ? "<span class='dr bitti'>FINISHED</span>" : "";
    $("yv-yer").innerHTML = window.F1UI.bayrak(lok.country) + "<div><b>" + esc(y.raceName) + "</b><span class='alt'>" + esc(pistAd(y)) + " · " + esc(((window.SezonTakvim && SezonTakvim.sehirGorunen) ? SezonTakvim.sehirGorunen(lok.locality) : lok.locality) + ", " + lok.country) + "</span></div>";
    var m = "<span>" + esc(tarih) + "</span>";
    if (w) { m += "<span><i>KAZANAN</i> <b>" + esc(ad(w)) + "</b>" + (w.Constructor ? " · " + esc(w.Constructor.name) : "") + "</span>"; }
    if (L && L.length >= 3) { m += "<span><i>PODYUM</i> " + L.slice(0, 3).map(function (r) { return esc(r.Driver.familyName); }).join(", ") + "</span>"; }
    $("yv-meta").innerHTML = m;
    pist(c);
  }
  function heroTemizle() { ["yv-tur", "yv-durum", "yv-yer", "yv-meta", "yv-cipler"].forEach(function (i) { var e = $(i); if (e) { e.innerHTML = ""; e.removeAttribute("data-imza"); } }); Y.pistId = null; var p = $("yv-pist"); if (p) { p.innerHTML = ""; } }

  // ---- özet çipleri: YALNIZ gerçek / yüklenmiş veri; veri yoksa çip yok; zorla fetch yok ----
  function modDurum(mod, h, s) {
    var m = window[mod], id = h.sezon + "-" + h.tur + "-" + s.anahtar, d = m && m._durum && m._durum[id];
    return d && d.durum === "ok" ? d : null;
  }
  function derece(x) { return Math.round(x) + "°C"; }
  function cipler(c) {
    var out = [], L = Y.liste || [];
    L.slice(0, 3).forEach(function (r) { if (/^\d+$/.test(String(r.positionText)) && r.Driver && r.Driver.code) { out.push(V3.cip("P" + r.positionText, r.Driver.code, "p")); } });
    var hz = L.filter(function (r) { return r.FastestLap && String(r.FastestLap.rank) === "1"; })[0];
    if (hz && hz.Driver && hz.Driver.code) { out.push(V3.cip("EN HIZLI TUR", hz.Driver.code, "p")); }
    if (c.h && c.s) {
      var h = c.h, s = c.s;
      var o = modDurum("SeansOlaylari", h, s);
      if (o && o.veri && o.veri.ozet && o.veri.ozet.kritik > 0) { out.push(V3.cip(o.veri.ozet.kritik, "KRİTİK OLAY")); }
      var g = modDurum("Gecisler", h, s);
      if (g && g.veri && g.veri.ozet && g.veri.ozet.toplam > 0) { out.push(V3.cip(g.veri.ozet.toplam, "GEÇİŞ KAYDI")); }
      var p = modDurum("Pitler", h, s);
      if (p && p.veri && p.veri.ozet && p.veri.ozet.toplam > 0) { out.push(V3.cip(p.veri.ozet.toplam, "PİT")); }
      var w = modDurum("SeansHava", h, s), wo = w && (w.ozet || (w.veri && w.veri.ozet));
      if (wo && wo.hava && wo.hava.min != null) { out.push(V3.cip(wo.hava.min === wo.hava.max ? derece(wo.hava.min) : derece(wo.hava.min) + "–" + derece(wo.hava.max), "HAVA")); }
      if (wo && wo.yagis && wo.yagis.goruldu) { out.push(V3.cip("YAĞIŞ", "KAYDI VAR")); }
    }
    return out;
  }
  function cipYaz(c) {
    var kap = $("yv-cipler"); if (!kap) { return; }
    var h = Y.liste ? V3.cipSerit(cipler(c), "Yarış özeti") : "";
    if (kap.getAttribute("data-imza") !== h) { kap.setAttribute("data-imza", h); kap.innerHTML = h; }   // imza dizgesiyle karşılaştır: innerHTML serileştirmesi farklı → döngü olmaz
  }

  // ---- "Ne oldu?" (mevcut YorumMotoru kutusu) ana özet alanına taşınır; metin/mantık aynen ----
  function nedenTasi() {
    var k = $("a2-yorum-yaris"), hedef = $("yv-neden");
    if (k && hedef && k.parentNode !== hedef) { hedef.appendChild(k); }
  }

  // ---- ayrıntı sekmeleri (tek seçili) ----
  function a7Liste(c) {
    var out = [];
    if (!c.h || !c.s) { return out; }
    A7.forEach(function (m) {
      var mod = window[m[2]], x = "";
      if (mod) { try { x = mod.html(c.h, c.s, "tamamlandi", null); } catch (e) { x = ""; } }
      if (x || HER_ZAMAN[m[0]]) { out.push({ k: m[0], ad: m[1], on: m[3], html: x }); }
    });
    return out;
  }
  function panelGoster(liste) {
    var sonuc = Y.aktif === "sonuc", ap = $("yv-a7-panel");
    $("yv-sonuc-panel").hidden = !sonuc;
    ap.hidden = sonuc || !ap.innerHTML;
    $("yv-pit-ek").hidden = Y.aktif !== "pit";
    $("yv-tur-ek").hidden = Y.aktif !== "tur";
    if (sonuc) { ap.innerHTML = ""; Y.panelK = ""; }
  }
  function sekmeler(c) {
    var bar = $("yv-sek"); if (!bar) { return; }
    var liste = a7Liste(c);
    if (!Y.liste || !liste.length) {
      bar.innerHTML = ""; Y.sekImza = ""; if (Y.aktif !== "sonuc") { Y.aktif = "sonuc"; } panelGoster(liste); return;
    }
    if (Y.aktif !== "sonuc" && !liste.some(function (x) { return x.k === Y.aktif; })) { Y.aktif = "sonuc"; }
    var yeni = liste.map(function (x) { return x.k; }).join(",") + "|" + Y.aktif;
    if (Y.sekImza !== yeni) {
      Y.sekImza = yeni;
      bar.innerHTML = V3.sekmeler([{ k: "sonuc", ad: "SONUÇ" }].concat(liste), Y.aktif, "ysek", "Yarış analizi ayrıntıları");
    }
    if (Y.aktif !== "sonuc" && Y.panelK !== Y.aktif) {       // modül kutusu yalnız sekme değişince kurulur (modülün kendi durumu ezilmez)
      var m = liste.filter(function (x) { return x.k === Y.aktif; })[0], ap = $("yv-a7-panel");
      Y.panelK = Y.aktif; ap.innerHTML = m.html || "";
      var b = m.html ? ap.querySelector("[data-" + m.on + "-act='ac']") : null;
      if (b && !Y.sessiz && b.getAttribute("aria-expanded") === "false") { b.click(); }   // sessiz: "Lastik stratejisini gör" bağlantısı OpenF1 isteği başlatmaz
    }
    panelGoster(liste);
  }

  function sekDegis() { var c = window.YarisCtx && window.YarisCtx(); if (c && Y.liste) { sekmeler(c); } }   // sekme değişiminde hero yeniden çizilmez (bayrak görseli yeniden istenmez)
  function render() {
    var c = window.YarisCtx && window.YarisCtx(); if (!c) { return; }
    if (!Y.liste) { heroTemizle(); sekmeler(c); return; }
    hero(c); cipYaz(c); nedenTasi(); sekmeler(c);
  }

  document.addEventListener("f1-yaris-sonuc", function (e) {
    var d = e.detail || {};
    if (String(Y.tur) !== String(d.tur)) { Y.aktif = "sonuc"; Y.panelK = ""; Y.sekImza = ""; }
    Y.tur = d.tur; Y.liste = d.liste || null; render();
  });
  document.addEventListener("change", function (e) {          // yarış değişirken eski yarışın özeti kalmaz (mevcut seçici olayı dinlenir)
    if (e.target && e.target.id === "yaris-sec") { Y.liste = null; Y.aktif = "sonuc"; Y.panelK = ""; Y.sekImza = ""; heroTemizle(); var s = $("yv-sek"); if (s) { s.innerHTML = ""; } panelGoster([]); }
  });
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-act='ysek']");
    if (!t || !$("sekme-yaris") || !$("sekme-yaris").contains(t)) { return; }
    var k = t.getAttribute("data-v"); if (k === Y.aktif) { return; }
    Y.aktif = k; Y.sekImza = ""; Y.panelK = ""; sekDegis();
  });
  // "Yarışı Kaçırdıysan" → "Lastik stratejisini gör": lastik bloğu TURLAR sekmesinde yaşar; bağlantı önce o sekmeyi açar (A7 modülünü otomatik YÜKLEMEZ), kaydırmayı mevcut A6 işleyicisi yapar
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("button[data-yo='lastik']");
    if (!t || !Y.liste || !$("sekme-yaris") || !$("sekme-yaris").contains(t)) { return; }
    if (Y.aktif !== "tur") { Y.aktif = "tur"; Y.sekImza = ""; Y.panelK = ""; Y.sessiz = true; try { sekDegis(); } finally { Y.sessiz = false; } }
  }, true);
  // A7 verisi sonradan yüklenince yalnız çip şeridi tazelenir (zamanlayıcı yok; çip kutusu gözlenen alanın DIŞINDA → döngü yok)
  function gozlemKur() {
    var hedef = $("yv-detay"); if (!hedef || !window.MutationObserver) { return; }
    new MutationObserver(function () { var c = window.YarisCtx && window.YarisCtx(); if (c && Y.liste) { cipYaz(c); } }).observe(hedef, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-expanded"] });
    var pn = $("yv-sonuc-panel");
    if (pn) { new MutationObserver(nedenTasi).observe(pn, { childList: true }); }
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", gozlemKur); } else { gozlemKur(); }

  window.YarisV3 = { render: render, _durum: Y };
})();
