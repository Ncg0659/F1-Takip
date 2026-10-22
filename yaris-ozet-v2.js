/* YARIŞI KAÇIRDIYSAN v2 — A6 kartının altına eklenen İSTEĞE BAĞLI zenginleştirme (arayüz + kontrollü yükleyici). Hesap: yaris-ozet-v2-hesap.js.
   AĞ KURALLARI: kart çizilirken HİÇ ağ isteği yok — yalnızca mevcut önbelleklerden (rc-/laps-/ovt-/pit-/hv-) salt okunur *Veri.oku().
   Eksik katmanlar yalnızca kullanıcı "Detayları göster"e basınca, mevcut historical modüllerin public yukle() API'sıyla, SIRAYLA (paralel değil) yüklenir;
   modüllerin kendi önbellek/dedupe/yayım-gecikmesi kuralları geçerlidir. Zamanlayıcı/polling yok. Katman yoksa/hazır değilse ilgili madde gizlenir; A6 sonucu her durumda görünür. */
(function () {
  "use strict";
  var H = window.YarisOzetV2Hesap, F = window.F1UI;
  if (!H || !F) { return; }
  var KATMAN = [["rc", "RaceControlVeri"], ["laps", "LapsVeri"], ["ovt", "OvertakesVeri"], ["pit", "PitVeri"], ["hava", "SeansHavaVeri"]];
  var IKON = { akis: "flag", hareket: "arrowup", pit: "stopwatch", hava: "chart" };
  var S = { tur: null, hs: null, veri: {}, hata: false, acik: false, yukleniyor: false, denendi: false, jeton: 0 };

  function bul(f, d) { try { return f(); } catch (e) { return d; } }
  function esc(x) { return F.esc(x); }

  function hsKur(y) {
    var HV = window.HaftaVeri; if (!HV || !HV.haftaKur || !y) { return null; }
    var h = bul(function () { return HV.haftaKur(y, "f1"); }, null); if (!h) { return null; }
    var s = (h.seanslar || []).filter(function (x) { return x.anahtar === "Race"; })[0];
    return s ? { h: h, s: s } : null;
  }
  function modul(ad) { return window[ad] || null; }

  // Önbellekten salt okunur (ağsız)
  function onbellektenOku() {
    if (!S.hs) { return; }
    KATMAN.forEach(function (k) {
      if (S.veri[k[0]]) { return; }
      var M = modul(k[1]); if (!M || !M.oku) { return; }
      var r = bul(function () { return M.oku(S.hs.h, S.hs.s); }, null);
      if (r && r.durum === "ok") { S.veri[k[0]] = r; }
    });
  }
  function eksikVar() { return KATMAN.some(function (k) { return !S.veri[k[0]] && modul(k[1]) && modul(k[1]).yukle; }); }

  // ---------- çizim ----------
  function kartHtml(c) {
    return "<li class='yo2-k yo2-" + esc(c.anahtar) + "'><span class='yo2-et'>" + F.ikon(IKON[c.anahtar] || "flag", 14) + "<span>" + esc(c.etiket) + "</span></span>" +
      "<span class='yo2-d'>" + c.satirlar.map(function (x) { return "<span class='yo2-sat'>" + esc(x) + "</span>"; }).join("") + "</span>" +
      (c.not ? "<span class='yo2-alt'>" + esc(c.not) + "</span>" : "") + "</li>";
  }
  function bolum(baslik, ic) { return ic ? "<section class='yo2-b'><h3 class='yo2-bb'>" + esc(baslik) + "</h3>" + ic + "</section>" : ""; }
  function liste(a) { return a && a.length ? "<ul class='yo2-ul'>" + a.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>" : ""; }

  function detayHtml(o) {
    var d = o.detay, b = "";
    if (d.olaylar && (d.olaylar.satirlar.length || d.olaylar.sari)) {
      var l = d.olaylar.satirlar.map(function (s) { return "<span class='yo2-saat'>" + esc(s.saat) + "</span> " + esc(s.ikon) + " " + esc(s.baslik) + (s.metin ? " — " + esc(s.metin) : ""); });
      if (d.olaylar.fazla) { l.push(esc("+" + d.olaylar.fazla + " kritik kayıt daha")); }
      if (d.olaylar.sari) { l.push(esc(d.olaylar.sari + " sarı bayrak kaydı")); }
      b += bolum("Kritik olaylar", liste(l));
    }
    if (d.gecis) {
      var g = ["Toplam: " + d.gecis.toplam + " geçiş kaydı"].map(esc);
      d.gecis.pilotlar.slice(0, 3).forEach(function (p) { g.push(esc(p.kod + " için " + p.yapilan + " geçiş kaydı")); });
      d.gecis.son.forEach(function (s) { g.push(esc("Son kayıtlar: " + s.metin + (s.pozisyon != null ? " (P" + s.pozisyon + ")" : ""))); });
      b += bolum("Geçiş kayıtları", liste(g) + "<p class='yo2-not'>OpenF1 kayıtları pit/ceza kaynaklı sıra değişimlerini de içerebilir.</p>");
    }
    if (d.pit) {
      var p = [esc("Toplam: " + d.pit.toplam + " pit kaydı"), esc("Pilot başına: " + d.pit.pilotlar.join(" · "))];
      d.pit.enKisa.forEach(function (x) { p.push(esc("Kısa stop kaydı: " + x.kod + " " + x.stop)); });
      if (d.pit.enUzunLane) { p.push(esc("En uzun pit lane süresi: " + d.pit.enUzunLane.kod + " " + d.pit.enUzunLane.lane + " (tur " + d.pit.enUzunLane.tur + ")")); }
      if (d.pit.stopSuresiYok) { p.push(esc(d.pit.stopSuresiYok + " kayıtta stop süresi yok")); }
      b += bolum("Pit özeti", liste(p));
    }
    if (d.hava) {
      var h = [];
      if (d.hava.baslangic) { h.push(esc("Başlangıç: " + d.hava.baslangic.metin)); }
      if (d.hava.bitis) { h.push(esc("Bitiş: " + d.hava.bitis.metin)); }
      d.hava.boyunca.forEach(function (x) { h.push(esc(x)); });
      b += bolum("Hava özeti", liste(h) + "<p class='yo2-not'>Seans içi OpenF1 ölçümleri; hafta tahmini değildir.</p>");
    }
    if (d.tur) {
      var t = d.tur.ilk3.map(function (x, i) { return esc((i + 1) + ". " + x.kod + " " + x.sure + " (tur " + x.tur + ")"); });
      b += bolum("Tur özeti", liste(t) + "<p class='yo2-not'>" + esc(d.tur.sureliTur + " süreli tur kaydı") + "</p>");
    }
    return b;
  }

  function govdeHtml() {
    var o = H.ozet(S.veri), h = "";
    if (o.hizliTur) { h += "<p class='yo2-hizli'>" + F.ikon("stopwatch", 14) + "<span>" + esc("En hızlı tur kaydı: " + o.hizliTur.kod + " " + o.hizliTur.sure + " (tur " + o.hizliTur.tur + ")") + "</span></p>"; }
    if (o.kartlar.length) { h += "<ul class='yo2-liste'>" + o.kartlar.map(kartHtml).join("") + "</ul>"; }
    var det = S.acik ? detayHtml(o) : "", aks = "";
    if (S.acik) {
      if (S.yukleniyor) { det += "<p class='yo2-not' role='status'>OpenF1 kayıtları yükleniyor…</p>"; }
      else if (!o.var && !det) { det += "<p class='yo2-not'>" + (S.hata ? "OpenF1 seans verilerine şu anda ulaşılamıyor." : "Seans verileri henüz yayımlanmadı.") + "</p>"; }
    }
    if (S.acik && det) { h += "<div class='yo2-detay'>" + det + "</div>"; }
    if (o.var || eksikVar() || S.acik) {
      aks = "<div class='yo2-aks'><button type='button' class='yo2-btn' data-yo2-act='" + (S.acik ? "kapat" : "ac") + "' aria-expanded='" + S.acik + "'>" + (S.acik ? "Detayları gizle" : "Detayları göster") + "</button></div>";
    }
    return h + aks;
  }
  function yenile() {
    var kutu = document.getElementById("yo-v2"); if (!kutu) { return; }
    kutu.innerHTML = govdeHtml(); kutu.hidden = !kutu.innerHTML;
  }

  // A6 render() sonunda çağrılır; y = seçili yarışın takvim kaydı
  function baglan(k, tur, y) {
    if (!k) { return; }
    if (S.tur !== tur) { S = { tur: tur, hs: hsKur(y), veri: {}, hata: false, acik: false, yukleniyor: false, denendi: false, jeton: S.jeton + 1 }; }
    else if (!S.hs) { S.hs = hsKur(y); }
    var kutu = document.getElementById("yo-v2");
    if (!kutu) { kutu = document.createElement("div"); kutu.id = "yo-v2"; kutu.className = "yo2"; }
    if (kutu.parentNode !== k) { k.appendChild(kutu); }
    onbellektenOku();
    yenile();
  }
  function temizle() { var kutu = document.getElementById("yo-v2"); if (kutu && kutu.parentNode) { kutu.parentNode.removeChild(kutu); } S.tur = null; S.jeton++; }

  // ---------- kontrollü yükleme (yalnız "Detayları göster" tıklanınca; sıralı) ----------
  async function yukle() {
    if (S.yukleniyor || S.denendi || !S.hs) { return; }
    var jeton = S.jeton; S.yukleniyor = true; yenile();
    for (var i = 0; i < KATMAN.length; i++) {
      var ad = KATMAN[i][0], M = modul(KATMAN[i][1]);
      if (S.veri[ad] || !M || !M.yukle) { continue; }
      var r; try { r = await M.yukle(S.hs.h, S.hs.s); } catch (e) { r = null; }
      if (jeton !== S.jeton) { return; }                              // yarış değişti: sonucu uygulama
      if (r && r.durum === "ok") { S.veri[ad] = r; yenile(); }        // geldikçe zenginleşir
      else if (!r || r.durum === "hata" || r.durum === "kisit") { S.hata = true; }
    }
    if (jeton !== S.jeton) { return; }
    S.yukleniyor = false; S.denendi = true; yenile();
  }
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest("[data-yo2-act]") : null; if (!b) { return; }
    var a = b.getAttribute("data-yo2-act");
    if (a === "ac") { S.acik = true; onbellektenOku(); yenile(); if (eksikVar()) { yukle(); } }
    else if (a === "kapat") { S.acik = false; yenile(); }
  });

  window.YarisOzetV2 = { baglan: baglan, temizle: temizle, _durum: function () { return S; } };
})();
