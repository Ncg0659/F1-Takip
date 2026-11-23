/* YARIŞIN HİKÂYESİ v1 — arayüz + tembel veri katmanı (3.1.0). Hesap: yaris-hikaye.js (saf).
   Konum: ANALİZ → Yarış Analizi; yarış özetinin altında, Ghost Lap'in üstünde (#yh-hikaye).
   Giriş: index.html'in mevcut "f1-yaris-sonuc" olayı (Jolpica sonuçları; ek istek yok) → START / FİNİŞ / DNF hemen çizilir.
   OpenF1 historical veriler (race_control, pit, stints, position, kazananın laps'i) yalnız bölüm GÖRÜNÜR olunca, bir kez ve sırayla:
     • RaceControlVeri / PitVeri / LastikVeri: mevcut modüller (kendi önbellek, dedupe, yayımlanma gecikmesi, hız sınırı kuralları).
     • position + laps(kazanan): aynı OpenF1 kuyruğu (OpenF1Veri.sirali); sonuç sezon+tur anahtarıyla kalıcı önbellekte (bitmiş yarış değişmez).
     • Pole ve şampiyonluk (önce/sonra puan durumu): Jolpica (SezonVeri.poleAl, JolpicaIstemci önbelleği) + sampiyonluk-durum.js.
   Kaydırma sırasında istek yok; aynı yarış tekrar açılınca önbellekten. Ham hata gösterilmez; console'a debug yazılmaz. */
(function () {
  "use strict";
  var H = window.YarisHikaye; if (!H || typeof document === "undefined") { return; }
  var ETIKET = { START: "START", SC: "SC", VSC: "VSC", RED: "KIRMIZI BAYRAK", RESUMED: "YENİDEN BAŞLADI", PIT: "PİT", LIDER: "LİDERLİK", PODYUM: "PODYUM",
                 ILK10: "İLK 10", BUYUK: "POZİSYON", DNF: "DNF", FINISH: "BİTİŞ", SAMPIYONLUK: "ŞAMPİYONLUK" };
  var TERIM = { SC: "safety-car", VSC: "vsc", RED: "kirmizi-bayrak" };
  var S = { tur: null, liste: null, veri: null, durum: "bos", seq: 0, gozlem: null, istek: 0 };
  var BELLEK = {};                                       // sezon-tur → yüklenen veri (oturum içi; tekrar açılınca ağ yok)

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }
  function bul(f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } }
  function sezonYili() { return bul(function () { return SEZON; }, new Date().getFullYear()); }
  function favori() { return bul(function () { return localStorage.getItem("f1-favori") || null; }, null); }
  function takvim() { return bul(function () { return sezonYarislar; }, []) || []; }
  function kayit(tur) { return takvim().filter(function (y) { return Number(y.round) === Number(tur); })[0] || null; }
  function kok() {
    var k = document.getElementById("yh-hikaye"); if (k) { return k; }
    var det = document.getElementById("yv-detay"); if (!det || !det.parentNode) { return null; }
    k = document.createElement("section"); k.id = "yh-hikaye"; k.className = "yh"; k.setAttribute("aria-labelledby", "yh-b");
    var gl = document.getElementById("gl-ghost");
    det.parentNode.insertBefore(k, gl && gl.parentNode === det.parentNode ? gl : det);
    return k;
  }

  // ---------- veri (tembel) ----------
  async function openf1(hafta, seans, y) {
    var RC = window.RaceControlVeri, PV = window.PitVeri, LV = window.LastikVeri, OF = window.OpenF1Veri, JI = window.JolpicaIstemci;
    var o = { rc: null, pit: null, stint: null, pozisyon: null, turBas: null };
    if (!RC || !OF || !JI) { return o; }
    var rc = await RC.yukle(hafta, seans);
    if (!rc || rc.durum !== "ok") { return o; }                         // yayımlanmadı / oturum yok / hata → ayrıntı yok (sınırlı)
    o.rc = rc.olaylar;
    if (PV) { var p = await PV.yukle(hafta, seans); if (p && p.durum === "ok") { o.pit = p.kayitlar; } }
    if (LV) {
      // aynı yarış oturumu için ikinci "sessions" isteği olmasın: Race Control'ün zaten çözdüğü oturum, lastik modülünün oturum önbelleğine aktarılır
      var ro = bul(function () { return JI.oku("rc-oturum-" + y.season + "-r" + y.round + "-Race"); }, null), lk = "stints-oturum-" + y.season + "-r" + y.round;
      if (ro && ro.veri && ro.veri.session_key && ro.veri.date_end && !bul(function () { return JI.oku(lk); }, null)) { JI.kaydet(lk, { session_key: ro.veri.session_key, meeting_key: ro.veri.meeting_key, ad: ro.veri.ad, date_end: ro.veri.date_end }); }
      var l = await LV.yukle(y); if (l && l.durum === "ok") { o.stint = l.rows; }
    }
    var sk = rc.oturum && rc.oturum.anahtar, ak = "yh-poz-" + y.season + "-r" + y.round;
    if (!sk) { return o; }
    var on = JI.oku(ak);
    if (on && on.veri && on.veri.s === sk && on.veri.pos && on.veri.tb) { o.pozisyon = on.veri.pos.map(function (r) { return { t: on.veri.t0 + r[0], dn: r[1], p: r[2] }; }); o.turBas = on.veri.tb; return o; }
    var kaz = (S.liste || []).filter(function (r) { return String(r.position) === "1"; })[0], no = kaz && kaz.number;
    if (!no) { return o; }
    S.istek++; var ps = await OF.sirali("position?session_key=" + sk);
    if (!ps || ps.tur !== "ok" || !Array.isArray(ps.veri) || !ps.veri.length) { return o; }
    S.istek++; var lp = await OF.sirali("laps?session_key=" + sk + "&driver_number=" + no);
    if (!lp || lp.tur !== "ok" || !Array.isArray(lp.veri) || !lp.veri.length) { return o; }
    var t0 = Date.parse(ps.veri[0].date) || 0, tb = {};
    lp.veri.forEach(function (r) { var t = Date.parse(r.date_start); if (isFinite(t) && r.lap_number != null) { tb[r.lap_number] = t; } });
    var pos = ps.veri.map(function (r) { return [Date.parse(r.date) - t0, r.driver_number, r.position]; }).filter(function (r) { return isFinite(r[0]); });
    JI.kaydet(ak, { s: sk, t0: t0, pos: pos, tb: tb });
    o.pozisyon = pos.map(function (r) { return { t: t0 + r[0], dn: r[1], p: r[2] }; }); o.turBas = tb;
    return o;
  }
  async function jolpicaEk(y) {
    var JI = window.JolpicaIstemci, SDm = window.SampiyonlukDurumu, SV = window.SezonVeri, o = { pole: null, samp: null };
    if (SV && SV.poleAl) { var p = await bul(function () { return SV.poleAl(Number(y.season), Number(y.round)); }, null); if (p && p.k) { o.pole = p.k; } }
    if (JI && SDm) {
      var t = Number(y.round), yil = y.season, std = async function (n) {
        if (n < 1) { return null; }
        var c = await JI.al("f1/" + yil + "/" + n + "/driverstandings/", { onbellek: "yh-std-" + yil + "-r" + n, kaydetKosul: function (v) { return v && v.StandingsTable && v.StandingsTable.StandingsLists && v.StandingsTable.StandingsLists.length; } });
        var l = c && c.veri && c.veri.StandingsTable && c.veri.StandingsTable.StandingsLists[0];
        return l && Number(l.round) === n ? l.DriverStandings : null;
      };
      var sonra = await std(t), once = await std(t - 1), yar = takvim();
      if (sonra) { o.samp = { sonra: SDm.hesapla({ sezon: yil, pilotlar: sonra, puanTuru: t, yarislar: yar }), once: once ? SDm.hesapla({ sezon: yil, pilotlar: once, puanTuru: t - 1, yarislar: yar }) : null }; }
    }
    return o;
  }
  async function yukle() {
    var tur = S.tur, y = kayit(tur), seq = S.seq, anahtar = sezonYili() + "-" + tur;
    if (!y || !window.HaftaVeri) { S.durum = "sinirli"; ciz(); return; }
    if (BELLEK[anahtar]) { S.veri = BELLEK[anahtar]; S.durum = "hazir"; ciz(); return; }
    S.durum = "yukleniyor"; ciz();
    var hafta = bul(function () { return HaftaVeri.haftaKur(y, "f1"); }, null), seans = hafta && hafta.seanslar.filter(function (s) { return s.anahtar === "Race"; })[0];
    var v = { rc: null, pit: null, stint: null, pozisyon: null, turBas: null, pole: null, samp: null };
    try { if (hafta && seans) { Object.assign(v, await openf1(hafta, seans, y)); } } catch (e) { /* ayrıntı yok: sınırlı gösterilir */ }
    try { Object.assign(v, await jolpicaEk(y)); } catch (e2) { /* pole / şampiyonluk bağlamı yok */ }
    if (seq !== S.seq) { return; }                                     // arada başka yarış seçildi
    BELLEK[anahtar] = v; S.veri = v; S.durum = "hazir"; ciz();
  }

  // ---------- çizim ----------
  function kartHtml(o) {
    var tur = "TUR " + o.tur + (o.turBit ? "–" + o.turBit : "");
    var te = TERIM[o.tip] ? " <button type='button' class='a2-baglanti yh-terim' data-terim='" + TERIM[o.tip] + "'>Nedir?</button>" : "";
    return "<li class='yh-o' data-tip='" + esc(o.tip) + "'" + (o.fav ? " data-yh-fav='1'" : "") + (o.ton ? " data-ton='" + esc(o.ton) + "'" : "") + ">" +
      "<p class='yh-ust'><span class='yh-tur'>" + esc(tur) + "</span><span class='yh-tip'>" + esc(ETIKET[o.tip] || o.tip) + "</span></p>" +
      "<p class='yh-b'>" + esc(o.baslik) + "</p>" +
      (o.aciklama ? "<p class='yh-a'>" + esc(o.aciklama) + te + "</p>" : (te ? "<p class='yh-a'>" + te + "</p>" : "")) +
      (o.satirlar && o.satirlar.length ? "<ul class='yh-s'>" + o.satirlar.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ul>" : "") + "</li>";
  }
  function ciz() {
    var k = kok(); if (!k) { return; }
    if (!S.liste || !S.liste.length) { k.hidden = true; k.innerHTML = ""; return; }
    k.hidden = false;
    var v = S.veri || {}, r;
    try { r = H.kur({ sonuc: S.liste, pole: v.pole, rc: v.rc, pit: v.pit, stint: v.stint, pozisyon: v.pozisyon, turBas: v.turBas, samp: v.samp, favori: favori() }); }
    catch (e) { r = { olaylar: [], sinirli: true }; }
    var not = S.durum === "yukleniyor" ? "<p class='yh-not' aria-live='polite'>Olay verisi yükleniyor…</p>" :
              (S.durum === "hazir" || S.durum === "sinirli") && r.sinirli ? "<p class='yh-not' data-yh-sinirli>Bu yarış için ayrıntılı olay verisi sınırlı.</p>" : "";
    var h = "<h2 class='yh-baslik' id='yh-b'>YARIŞIN HİKÂYESİ</h2><p class='yh-alt'>Doğrulanmış olaylar, yarış sırasına göre. Pozisyonlar tur sonu kayıtlarıdır.</p>" + not +
      "<ol class='yh-akis' data-durum='" + esc(S.durum) + "' data-n='" + r.olaylar.length + "'>" + r.olaylar.map(kartHtml).join("") + "</ol>";
    if (k.innerHTML !== h) { k.innerHTML = h; }
  }
  function gozle() {
    var k = kok(); if (!k) { return; }
    if (S.gozlem) { S.gozlem.disconnect(); S.gozlem = null; }
    if (S.durum !== "bos") { return; }
    var basla = function () { if (S.durum === "bos" && S.tur != null) { yukle(); } };
    if (!("IntersectionObserver" in window)) { basla(); return; }
    S.gozlem = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { S.gozlem.disconnect(); S.gozlem = null; basla(); } }, { rootMargin: "200px 0px" });
    S.gozlem.observe(k);
  }

  document.addEventListener("f1-yaris-sonuc", function (e) {
    var d = e.detail || {};
    if (String(d.tur) !== String(S.tur)) { S.seq++; S.veri = null; S.durum = "bos"; }
    S.tur = d.tur; S.liste = (d.liste || []).filter(function (r) { return r && r.Driver; });
    var an = sezonYili() + "-" + S.tur; if (BELLEK[an]) { S.veri = BELLEK[an]; S.durum = "hazir"; }
    ciz(); gozle();
  });
  document.addEventListener("f1-favori", function () { if (S.liste) { ciz(); } });
  window.YarisHikayeUI = { _durum: function () { return S; }, ciz: ciz, yukle: yukle };
})();
