/* GHOST LAP + LOCATION REPLAY v1 — Yarış analizi (ANALİZ) içinde, "Tur süreleri" altında açılır panel.
   VERİ: telemetry-data.js (OpenF1 geçmiş uç noktaları; tek kaynak). TEMBEL: panel açılsa bile iki pilot seçilmeden OpenF1 isteği yok.
   Aynı session/driver/lap tekrar çekilmez (TelemetriVeri önbelleği). Replay sırasında ağ yok. Yeni polling yok; animasyon yalnız oynatırken requestAnimationFrame.
   Yalnız ölçülmüş veri: lap/sektör süresi, hız, gaz, fren, vites, rpm, x/y. Yorum, tahmin, yaklaşık konum, fren sıcaklığı/lastik enerjisi/ERS vb. YOK. */
(function () {
  "use strict";
  var TV = window.TelemetriVeri, GH = window.GhostHesap, PS = window.PistSiluetleri, F = window.F1UI;
  if (!TV || !GH) { return; }
  var G = { tur: null, liste: [], kayit: null, anahtar: "Race", A: "", B: "", lapA: "fastest", lapB: "fastest", oturum: null, turlar: { A: null, B: null },
            sonuc: null, durum: "bos", sekme: "delta", seq: 0, donusum: {}, rp: { poz: 0, hiz: 1, oynuyor: false, son: null, raf: 0 } };
  var NO = { istek: 0 };   // test için: replay sırasında istek sayımı TV._sayac üzerinden izlenir

  function esc(x) { return F && F.esc ? F.esc(x) : String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }
  function sezonYili() { try { return typeof SEZON !== "undefined" ? SEZON : new Date().getFullYear(); } catch (e) { return new Date().getFullYear(); } }
  function takvimKaydi(tur) {
    var liste = null;
    try { var v = window.JolpicaIstemci.oku("takvim-" + sezonYili()); liste = v && v.veri && v.veri.RaceTable && v.veri.RaceTable.Races; } catch (e) { liste = null; }
    if (!liste || !liste.length) { try { liste = sezonYarislar; } catch (e2) { liste = null; } }
    return (liste || []).filter(function (y) { return Number(y.round) === Number(tur); })[0] || null;
  }
  function favori() { try { return localStorage.getItem("f1-favori") || ""; } catch (e) { return ""; } }
  function kok() { return document.getElementById("gl-ghost"); }
  function govde() { var k = kok(); return k ? k.querySelector(".gl-ic") : null; }
  // OpenF1 driver_number = araç numarası: Jolpica sonuç satırında "number" (yoksa Driver.permanentNumber); ikisi de yoksa pilot eşleştirilemez → listeye alınmaz
  function numara(r) { var n = r && r.number != null ? r.number : (r && r.Driver ? r.Driver.permanentNumber : null); return n == null || n === "" ? null : String(n); }
  function pilot(no) { return G.liste.filter(function (r) { return numara(r) === String(no); })[0] || null; }
  function kod(no) { var r = pilot(no); return r && r.Driver ? (r.Driver.code || r.Driver.familyName) : "#" + no; }

  // ---------- panel ----------
  function kur() {
    if (kok()) { return true; }
    var ek = document.getElementById("yv-tur-ek"), ust = ek ? ek.parentNode : document.getElementById("yv-detay");
    if (!ust) { return false; }
    var d = document.createElement("details");
    d.id = "gl-ghost"; d.className = "gl";
    d.innerHTML = "<summary>GHOST LAP</summary><div class='gl-ic'></div>";
    if (ek && ek.nextSibling) { ust.insertBefore(d, ek.nextSibling); } else { ust.appendChild(d); }
    d.addEventListener("toggle", function () { if (d.open) { ciz(); } else { duraklat(); } });
    d.addEventListener("change", function (e) { var t = e.target; if (!t || !t.getAttribute) { return; } var a = t.getAttribute("data-gl"); if (a) { secim(a, t.value); } else if (t.hasAttribute("data-gl-kaydir")) { kaydir(Number(t.value)); } });
    d.addEventListener("input", function (e) { var t = e.target; if (t && t.hasAttribute && t.hasAttribute("data-gl-kaydir")) { kaydir(Number(t.value)); } });
    d.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("button") : null; if (!b) { return; }
      var s = b.getAttribute("data-gl-sek"), r = b.getAttribute("data-gl-rp"), h = b.getAttribute("data-gl-hiz");
      if (s) { G.sekme = s; duraklat(); ciz(); }
      else if (r === "oynat") { if (G.rp.oynuyor) { duraklat(); } else { oynat(); } }
      else if (r === "basa") { duraklat(); kaydir(0); }
      else if (h) { G.rp.hiz = Number(h); guncelleKontrol(); }
      else if (b.getAttribute("data-gl-tekrar") != null) { yukle(true); }
    });
    return true;
  }

  function secenekPilot(sec) {
    var fav = favori(), l = G.liste.slice(), isim = function (r) { return (r.Driver.code || "") + " · " + (r.Driver.familyName || ""); };
    l.sort(function (a, b) { var fa = a.Driver.driverId === fav ? 0 : 1, fb = b.Driver.driverId === fav ? 0 : 1; return fa - fb; });   // favori öne; otomatik seçim YOK
    return "<option value=''>Pilot seç</option>" + l.map(function (r) {
      return "<option value='" + esc(numara(r)) + "'" + (numara(r) === String(sec) ? " selected" : "") + ">" + (r.Driver.driverId === fav ? "★ " : "") + esc(isim(r)) + "</option>";
    }).join("");
  }
  function secenekTur(turlar, sec) {
    var o = "<option value='fastest'" + (sec === "fastest" ? " selected" : "") + ">En hızlı tur</option>";
    (turlar || []).filter(function (t) { return t.duration != null && t.duration > 0; }).forEach(function (t) {
      o += "<option value='" + t.lap + "'" + (String(sec) === String(t.lap) ? " selected" : "") + ">Tur " + t.lap + " · " + GH.sureBic(t.duration) + (t.pitOut ? " (pit çıkışı)" : "") + "</option>";
    });
    return o;
  }
  function oturumSecenek() {
    var o = [["Race", "Yarış"], ["Qualifying", "Sıralama"]];
    if (G.kayit && G.kayit.Sprint) { o.push(["Sprint", "Sprint"]); }
    return o.map(function (x) { return "<option value='" + x[0] + "'" + (x[0] === G.anahtar ? " selected" : "") + ">" + x[1] + "</option>"; }).join("");
  }
  function kontroller() {
    return "<div class='gl-form'>" +
      "<label class='gl-alan gl-tam'><span>Oturum</span><select data-gl='oturum' aria-label='Oturum seç'>" + oturumSecenek() + "</select></label>" +
      "<label class='gl-alan'><span class='gl-a'>Pilot A</span><select data-gl='A' aria-label='Pilot A'>" + secenekPilot(G.A) + "</select></label>" +
      "<label class='gl-alan'><span class='gl-b'>Pilot B</span><select data-gl='B' aria-label='Pilot B'>" + secenekPilot(G.B) + "</select></label>" +
      (G.turlar.A ? "<label class='gl-alan'><span>Tur A</span><select data-gl='lapA' aria-label='Pilot A turu'>" + secenekTur(G.turlar.A, G.lapA) + "</select></label>" : "") +
      (G.turlar.B ? "<label class='gl-alan'><span>Tur B</span><select data-gl='lapB' aria-label='Pilot B turu'>" + secenekTur(G.turlar.B, G.lapB) + "</select></label>" : "") +
      "</div>";
  }
  function mesaj(m, tekrar) { return "<p class='gl-mesaj' role='status'>" + esc(m) + "</p>" + (tekrar ? "<p><button type='button' class='gl-btn' data-gl-tekrar>Tekrar dene</button></p>" : ""); }

  // ---------- seçim / yükleme ----------
  function secim(ne, v) {
    duraklat();
    if (ne === "oturum") { G.anahtar = v; G.oturum = null; G.turlar = { A: null, B: null }; G.lapA = G.lapB = "fastest"; G.sonuc = null; G.durum = "bos"; }
    else if (ne === "A" || ne === "B") { G[ne] = v; G.turlar[ne] = null; G["lap" + ne] = "fastest"; G.sonuc = null; G.durum = "bos"; }
    else if (ne === "lapA" || ne === "lapB") { G[ne] = v; }
    G.rp.poz = 0;
    if (G.A && G.B && G.A !== G.B) { yukle(false); } else { G.durum = G.A && G.B ? "ayni" : "bos"; ciz(); }
  }

  function turSec(oturum, no, lap, turlar) {
    if (lap === "fastest") { return TV.enHizliTurTelemetri(oturum, no); }
    return TV.turTelemetri(oturum, no, Number(lap)).then(function (t) { return t.durum === "ok" ? { durum: "ok", tur: t.tur, telemetri: t } : { durum: t.durum }; });
  }
  async function yukle(zorla) {
    var k = kok(); if (!k || !k.open) { return; }
    if (!G.A || !G.B || G.A === G.B) { ciz(); return; }
    var seq = ++G.seq, kayit = G.kayit;
    if (!kayit) { G.durum = "veri-yok"; ciz(); return; }
    G.durum = "yukleniyor"; ciz();
    try {
      if (!G.oturum || zorla) {
        var o = await TV.oturumBul(kayit, G.anahtar);
        if (seq !== G.seq) { return; }
        if (o.durum !== "ok") { G.durum = o.durum === "yayimlanmadi" || o.durum === "kisit" ? "yayimlanmadi" : (o.durum === "hata" ? "hata" : "oturum-yok"); G.sonuc = null; ciz(); return; }
        G.oturum = o.oturum;
      }
      var ta = await TV.turlar(G.oturum, Number(G.A)), tb = await TV.turlar(G.oturum, Number(G.B));
      if (seq !== G.seq) { return; }
      G.turlar.A = ta.durum === "ok" ? ta.turlar : []; G.turlar.B = tb.durum === "ok" ? tb.turlar : [];
      var ra = await turSec(G.oturum, Number(G.A), G.lapA), rb = await turSec(G.oturum, Number(G.B), G.lapB);
      if (seq !== G.seq) { return; }
      if (ra.durum !== "ok" || rb.durum !== "ok") { G.sonuc = null; G.durum = (ra.durum === "hata" || rb.durum === "hata") ? "hata" : "veri-yok"; ciz(); return; }
      var s = GH.karsilastir(ra, rb);
      if (s.durum !== "ok") { G.sonuc = null; G.durum = "gecersiz"; ciz(); return; }
      s.ra = ra; s.rb = rb; G.sonuc = s; G.durum = "ok"; G.rp.poz = 0;
    } catch (e) { if (seq !== G.seq) { return; } G.sonuc = null; G.durum = "hata"; }
    ciz();
  }

  // ---------- grafik (SVG; yalnız gerçek noktalar, kopuk/null noktada çizgi kesilir) ----------
  var RA = "#e10600", RB = "#2f7de1";
  function cizgi(pts, x, y, cls) {
    var d = "", acik = false;
    pts.forEach(function (p) { var vx = x(p), vy = y(p); if (vx == null || vy == null) { acik = false; return; } d += (acik ? "L" : "M") + vx.toFixed(1) + " " + vy.toFixed(1) + " "; acik = true; });
    return d ? "<path d='" + d + "' class='" + cls + "' fill='none'/>" : "";
  }
  function panelSvg(basX, basY, gen, yuk, aralik, etiket, seriler, sifirCizgi) {
    var mn = aralik[0], mx = aralik[1], span = mx - mn || 1;
    var yf = function (v) { return v == null ? null : basY + yuk - (v - mn) / span * yuk; }, xf = function (s) { return s == null ? null : basX + s * gen; };
    var o = "<rect x='" + basX + "' y='" + basY + "' width='" + gen + "' height='" + yuk + "' class='gl-cerceve'/>";
    if (sifirCizgi && mn < 0 && mx > 0) { o += "<line x1='" + basX + "' x2='" + (basX + gen) + "' y1='" + yf(0).toFixed(1) + "' y2='" + yf(0).toFixed(1) + "' class='gl-sifir'/>"; }
    seriler.forEach(function (sr) { o += cizgi(sr.pts, function (p) { return xf(p.s); }, function (p) { return yf(p.v); }, sr.cls); });
    o += "<text x='" + (basX - 4) + "' y='" + (basY + 8) + "' class='gl-eks' text-anchor='end'>" + etiket[1] + "</text><text x='" + (basX - 4) + "' y='" + (basY + yuk) + "' class='gl-eks' text-anchor='end'>" + etiket[0] + "</text>";
    return o;
  }
  function aralik(pts, alt, ust) {
    var mn = Infinity, mx = -Infinity; pts.forEach(function (p) { if (p.v != null) { mn = Math.min(mn, p.v); mx = Math.max(mx, p.v); } });
    if (!isFinite(mn)) { return null; }
    if (alt != null) { mn = Math.min(mn, alt); } if (ust != null) { mx = Math.max(mx, ust); }
    if (mx === mn) { mx = mn + 1; }
    return [mn, mx];
  }
  function seriV(prog, alan) { return prog.noktalar.map(function (p) { return { s: p.s, v: p[alan] }; }); }
  function xEkseni(basX, gen, y) {
    return [0, 0.25, 0.5, 0.75, 1].map(function (f) { return "<text x='" + (basX + f * gen) + "' y='" + y + "' class='gl-eks' text-anchor='" + (f === 1 ? "end" : "middle") + "'>" + Math.round(f * 100) + "%</text>"; }).join("");
  }
  function grafik(s) {
    var W = 600, bx = 44, gen = W - bx - 8, a = s.a.prog, b = s.b.prog, ic, etiket;
    if (G.sekme === "delta") {
      var dp = s.delta.noktalar.map(function (p) { return { s: p.s, v: p.delta }; });
      if (s.delta.neden) { return "<p class='gl-mesaj'>Delta üretilemedi: telemetri örnekleri eksik (kapsam yetersiz). Veri olmayan bölge tahmin edilmez.</p>"; }
      var ar = aralik(dp, 0, 0); if (!ar) { return "<p class='gl-mesaj'>Delta için yeterli veri yok.</p>"; }
      var pad = Math.max(0.05, (ar[1] - ar[0]) * 0.1); ar = [ar[0] - pad, ar[1] + pad];
      ic = panelSvg(bx, 10, gen, 200, ar, [GH.bic(ar[0], 2), GH.bic(ar[1], 2)], [{ pts: dp, cls: "gl-l-d" }], true) + xEkseni(bx, gen, 226);
      return "<svg class='gl-svg' viewBox='0 0 600 236' role='img' aria-label='Delta grafiği: B eksi A, saniye' data-gl-grafik='delta'>" + ic + "</svg>";
    }
    if (G.sekme === "hiz") {
      var pa = seriV(a, "speed"), pb = seriV(b, "speed"), ah = aralik(pa.concat(pb), 0, null);
      if (!ah) { return "<p class='gl-mesaj'>Hız verisi yok.</p>"; }
      ic = panelSvg(bx, 10, gen, 200, ah, [Math.round(ah[0]) + "", Math.round(ah[1]) + ""], [{ pts: pa, cls: "gl-l-a" }, { pts: pb, cls: "gl-l-b" }], false) + xEkseni(bx, gen, 226);
      return "<svg class='gl-svg' viewBox='0 0 600 236' role='img' aria-label='Hız grafiği, km/s' data-gl-grafik='hiz'>" + ic + "</svg>";
    }
    var ta = seriV(a, "throttle"), tb = seriV(b, "throttle"), ba = seriV(a, "brake"), bb = seriV(b, "brake");
    if (!aralik(ta.concat(tb, ba, bb), 0, 100)) { return "<p class='gl-mesaj'>Gaz/fren verisi yok.</p>"; }
    ic = panelSvg(bx, 10, gen, 110, [0, 100], ["0", "100"], [{ pts: ta, cls: "gl-l-a" }, { pts: tb, cls: "gl-l-b" }], false) +
         panelSvg(bx, 136, gen, 70, [0, 100], ["0", "100"], [{ pts: ba, cls: "gl-l-a" }, { pts: bb, cls: "gl-l-b" }], false) +
         "<text x='" + (bx + 4) + "' y='24' class='gl-pbaslik'>Gaz %</text><text x='" + (bx + 4) + "' y='150' class='gl-pbaslik'>Fren</text>" + xEkseni(bx, gen, 226);
    return "<svg class='gl-svg' viewBox='0 0 600 236' role='img' aria-label='Gaz ve fren grafiği' data-gl-grafik='gaz'>" + ic + "</svg>";
  }
  function maks(prog, alan) { var m = null; prog.noktalar.forEach(function (p) { if (p[alan] != null && (m === null || p[alan] > m)) { m = p[alan]; } }); return m; }

  function ozet(s) {
    var A = "<span class='gl-a'>" + esc(kod(G.A)) + "</span>", B = "<span class='gl-b'>" + esc(kod(G.B)) + "</span>";
    var ba = (G.lapA === "fastest" ? "EN HIZLI TUR" : "TUR " + s.a.lap), bb = (G.lapB === "fastest" ? "EN HIZLI TUR" : "TUR " + s.b.lap);
    var baslik = ba === bb ? ba : "A: " + ba + " · B: " + bb;
    var sat = function (ad, x, y, f) { return "<tr><th scope='row'>" + ad + "</th><td>" + x + "</td><td>" + y + "</td><td>" + f + "</td></tr>"; };
    var t = sat("Tur süresi", GH.sureBic(s.a.sure), GH.sureBic(s.b.sure), s.turFarki == null ? "—" : GH.bic(s.turFarki));
    s.sektorler.forEach(function (k) { t += sat(k.ad, GH.sureBic(k.a), GH.sureBic(k.b), k.fark == null ? "—" : GH.bic(k.fark)); });
    var mA = maks(s.a.prog, "speed"), mB = maks(s.b.prog, "speed");
    t += sat("Maks. hız (km/s)", mA == null ? "—" : mA, mB == null ? "—" : mB, mA == null || mB == null ? "—" : GH.bic(mB - mA, 0));
    return "<h3 class='gl-baslik' data-gl-baslik>" + baslik + "</h3>" +
      "<p class='gl-tur'>" + A + " tur " + s.a.lap + (s.a.pitOut ? " (pit çıkışı)" : "") + " · " + B + " tur " + s.b.lap + (s.b.pitOut ? " (pit çıkışı)" : "") + "</p>" +
      "<div class='gl-delta' data-gl-delta-son>" + (s.delta.son == null ? "Delta: —" : "Tur sonu delta: <b>" + GH.bic(s.delta.son) + " s</b>") + "</div>" +
      "<p class='gl-not'>Delta = B − A (A referans; + işareti B'nin A'nın gerisinde olduğunu gösterir). Tur başında 0.</p>" +
      "<div class='gl-kap'><table class='gl-tablo'><thead><tr><th></th><th>" + A + "</th><th>" + B + "</th><th>Fark</th></tr></thead><tbody>" + t + "</tbody></table></div>";
  }

  // ---------- LOCATION REPLAY ----------
  function replayAlani(s) {
    var sa = GH.konumSeri(s.ra.telemetri.ornekler), sb = GH.konumSeri(s.rb.telemetri.ornekler);
    var baslik = "<h3 class='gl-baslik'>LOCATION REPLAY</h3>";
    if (!sa.length && !sb.length) { return baslik + "<p class='gl-mesaj' data-gl-replay-yok>Bu turlar için OpenF1 konum verisi yok; replay gösterilmiyor.</p>"; }
    var id = G.kayit && G.kayit.Circuit && G.kayit.Circuit.circuitId, yol = PS && PS.YOL && id ? PS.YOL[id] : null;
    if (!yol) { return baslik + "<p class='gl-mesaj' data-gl-replay-yok>Bu pist için yerel pist çizimi yok; replay gösterilmiyor.</p>"; }
    var kay = G.oturum.season + "/" + G.oturum.session_key + "/" + id, T = G.donusum[kay];
    if (!T) {
      var bulut = (sa.length >= sb.length ? sa : sb);
      T = GH.pistDonusumu(yol, bulut);
      if (T.durum === "ok") { G.donusum[kay] = T; }
    }
    if (T.durum !== "ok") { return baslik + "<p class='gl-mesaj' data-gl-replay-yok>Konum verisi pist çizimiyle eşleştirilemedi; replay gösterilmiyor.</p>"; }
    s._rp = { sa: sa, sb: sb, T: T, toplam: Math.max((s.a.sure || 0) * 1000, (s.b.sure || 0) * 1000, sa.length ? sa[sa.length - 1].t : 0, sb.length ? sb[sb.length - 1].t : 0) };
    return baslik +
      "<div class='gl-pist'><svg class='gl-pist-svg' viewBox='0 0 300 200' role='img' aria-label='Pist üzerinde iki pilotun gerçek OpenF1 konumları' preserveAspectRatio='xMidYMid meet' data-gl-pist>" +
      "<path class='gl-hat-alt' d='" + yol + "'/><path class='gl-hat' d='" + yol + "'/>" +
      "<g data-gl-isaret='A' class='gl-isaret gl-isa' hidden><circle r='5'/><text y='-8' text-anchor='middle'>A</text></g>" +
      "<g data-gl-isaret='B' class='gl-isaret gl-isb' hidden><circle r='5'/><text y='-8' text-anchor='middle'>B</text></g></svg></div>" +
      "<div class='gl-rp'><div class='gl-rp-1'>" +
      "<button type='button' class='gl-btn' data-gl-rp='basa' aria-label='Başa dön'>⏮ Başa dön</button>" +
      "<button type='button' class='gl-btn gl-oynat' data-gl-rp='oynat' aria-pressed='false'>▶ Oynat</button>" +
      [0.5, 1, 2].map(function (h) { return "<button type='button' class='gl-btn gl-hiz' data-gl-hiz='" + h + "' aria-pressed='" + (G.rp.hiz === h) + "'>" + h + "×</button>"; }).join("") +
      "</div><div class='gl-rp-2'><input type='range' class='gl-kaydir' data-gl-kaydir min='0' max='" + Math.round(s._rp.toplam) + "' step='10' value='0' aria-label='Zaman çizgisi'><output class='gl-sure' data-gl-sure>0.0 / " + (s._rp.toplam / 1000).toFixed(1) + " s</output></div></div>" +
      "<p class='gl-not'>Konumlar OpenF1 x/y ölçümleridir; pist çizgisine yapıştırılmaz. Çizim ölçeği/dönüşü yalnız görsel hizalamadır. Turu biten pilot son ölçülen konumunda kalır.</p>";
  }
  function replayCiz() {
    var s = G.sonuc, k = kok(); if (!s || !s._rp || !k) { return; }
    var R = s._rp, poz = G.rp.poz;
    [["A", R.sa], ["B", R.sb]].forEach(function (x) {
      var g = k.querySelector("[data-gl-isaret='" + x[0] + "']"); if (!g) { return; }
      var p = GH.konumZaman(x[1], poz);
      if (p.durum === "yok" || p.durum === "bosluk") { g.setAttribute("hidden", ""); return; }
      var u = GH.uygula(R.T, p.x, p.y);
      g.removeAttribute("hidden"); g.setAttribute("transform", "translate(" + u.x.toFixed(2) + " " + u.y.toFixed(2) + ")");
      g.setAttribute("data-durum", p.durum);
    });
    var sure = k.querySelector("[data-gl-sure]"); if (sure) { sure.textContent = (poz / 1000).toFixed(1) + " / " + (R.toplam / 1000).toFixed(1) + " s"; }
    var kay = k.querySelector("[data-gl-kaydir]"); if (kay && Number(kay.value) !== Math.round(poz)) { kay.value = Math.round(poz); }
  }
  function guncelleKontrol() {
    var k = kok(); if (!k) { return; }
    var o = k.querySelector("[data-gl-rp='oynat']"); if (o) { o.textContent = G.rp.oynuyor ? "⏸ Duraklat" : "▶ Oynat"; o.setAttribute("aria-pressed", G.rp.oynuyor ? "true" : "false"); }
    Array.prototype.forEach.call(k.querySelectorAll("[data-gl-hiz]"), function (b) { b.setAttribute("aria-pressed", String(Number(b.getAttribute("data-gl-hiz")) === G.rp.hiz)); });
  }
  function kaydir(ms) {
    var s = G.sonuc; if (!s || !s._rp) { return; }
    G.rp.poz = Math.max(0, Math.min(s._rp.toplam, ms)); replayCiz();
  }
  function adim(dt) {   // dt: gerçek ms; hız çarpanı uygulanır
    var s = G.sonuc; if (!s || !s._rp) { return; }
    G.rp.poz = Math.min(s._rp.toplam, G.rp.poz + dt * G.rp.hiz);
    replayCiz();
    if (G.rp.poz >= s._rp.toplam) { duraklat(); }
  }
  function raf(ts) {
    if (!G.rp.oynuyor) { return; }
    if (G.rp.son != null) { adim(Math.min(250, ts - G.rp.son)); }
    G.rp.son = ts;
    if (G.rp.oynuyor) { G.rp.raf = requestAnimationFrame(raf); }
  }
  function oynat() {
    var s = G.sonuc; if (!s || !s._rp) { return; }
    if (G.rp.poz >= s._rp.toplam) { G.rp.poz = 0; }
    G.rp.oynuyor = true; G.rp.son = null; guncelleKontrol(); G.rp.raf = requestAnimationFrame(raf);
  }
  function duraklat() {
    if (G.rp.raf) { try { cancelAnimationFrame(G.rp.raf); } catch (e) { /* yok */ } }
    G.rp.oynuyor = false; G.rp.raf = 0; G.rp.son = null; guncelleKontrol();
  }

  // ---------- çizim ----------
  function ciz() {
    var g = govde(); if (!g) { return; }
    var k = kok(); if (!k.open) { return; }
    var m = "";
    if (!G.liste.length) { g.innerHTML = mesaj("Bu yarışın pilot listesi henüz yok."); return; }
    var ust = "<p class='gl-bilgi'>İki pilotun aynı oturumdaki turlarını OpenF1 ölçümleriyle karşılaştırır. Pilot seçilene kadar veri çekilmez.</p>" + kontroller();
    if (G.durum === "bos") { m = mesaj("Pilot A ve Pilot B seç."); }
    else if (G.durum === "ayni") { m = mesaj("İki farklı pilot seç."); }
    else if (G.durum === "yukleniyor") { m = mesaj("Yükleniyor…"); }
    else if (G.durum === "yayimlanmadi") { m = mesaj("Veri henüz yayımlanmadı."); }
    else if (G.durum === "oturum-yok") { m = mesaj("Bu oturum için OpenF1 kaydı bulunamadı."); }
    else if (G.durum === "gecersiz") { m = mesaj("Bu iki tur karşılaştırılamıyor (farklı oturum ya da aynı tur)."); }
    else if (G.durum === "veri-yok") { m = mesaj("Seçilen turlar için telemetri verisi yok."); }
    else if (G.durum === "hata") { m = mesaj("Telemetri şu an alınamadı.", true); }
    else if (G.durum === "ok" && G.sonuc) {
      var s = G.sonuc;
      m = ozet(s) +
        "<div class='gl-sekme' role='group' aria-label='Grafik'>" + [["delta", "Delta"], ["hiz", "Hız"], ["gaz", "Gaz / Fren"]].map(function (x) { return "<button type='button' class='gl-btn' data-gl-sek='" + x[0] + "' aria-pressed='" + (G.sekme === x[0]) + "'>" + x[1] + "</button>"; }).join("") + "</div>" +
        "<div class='gl-lej'><span class='gl-a'>— " + esc(kod(G.A)) + " (A)</span><span class='gl-b'>- - " + esc(kod(G.B)) + " (B)</span></div>" +
        grafik(s) + "<div class='gl-replay' data-gl-replay>" + replayAlani(s) + "</div>";
    }
    var a = document.activeElement, odak = a && a.getAttribute ? a.getAttribute("data-gl") : null;
    g.innerHTML = ust + m;
    if (odak) { var el = g.querySelector("[data-gl='" + odak + "']"); if (el) { el.focus(); } }
    if (G.sonuc && G.sonuc._rp) { replayCiz(); guncelleKontrol(); }
  }

  // ---------- giriş: mevcut yarış seçimi olayı (ek ağ çağrısı yok) ----------
  document.addEventListener("f1-yaris-sonuc", function (e) {
    if (!kur()) { return; }
    var d = e.detail || {};
    if (String(d.tur) !== String(G.tur)) {
      G.seq++; duraklat();
      G.A = ""; G.B = ""; G.oturum = null; G.turlar = { A: null, B: null }; G.lapA = G.lapB = "fastest"; G.sonuc = null; G.durum = "bos"; G.anahtar = "Race"; G.rp.poz = 0;
    }
    G.tur = d.tur; G.liste = (d.liste || []).filter(function (r) { return r && r.Driver && numara(r) != null; });
    G.kayit = takvimKaydi(d.tur);
    ciz();
  });

  window.GhostLap = { _durum: G, _adim: adim, _kaydir: kaydir, _oynat: oynat, _duraklat: duraklat, _istek: NO };
})();
