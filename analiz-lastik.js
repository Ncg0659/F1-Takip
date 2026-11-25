/* LASTİK VE YARIŞ STRATEJİSİ (v3.2.0) — eski A3.4b "Lastik stratejisi" bloğunun yerini alır (ikinci sistem DEĞİL; aynı modül, aynı veri katmanı).
   Konum: ANALİZ → Yarış Analizi; Yarışın Hikâyesi'nin altında, Ghost Lap'in üstünde (#ls-strateji). Yalnız tamamlanmış yarış (Jolpica sonucu olan).
   Veri (hepsi mevcut modüller; kendi önbellek / dedupe / yayımlanma gecikmesi kurallarıyla):
     • Sonuç: index.html "f1-yaris-sonuc" olayı (ek istek yok)          • Stint: LastikVeri (OpenF1 stints)
     • Pit: PitVeri (OpenF1 pit; lane_duration ≠ stop_duration)          • Bayrak: RaceControlVeri (Yarışın Hikâyesi ile aynı çağrı → önbellekten)
     • Tempo: LapsVeri (OpenF1 laps) — yalnız kullanıcı "Stint temposu"nu açınca.
   Bölüm GÖRÜNÜR olunca bir kez yüklenir; filtre / karşılaştırma / dokunma ağ isteği üretmez. Hesap: LastikHesap (saf). Yorum/strateji değerlendirmesi yok. */
(function () {
  "use strict";
  var LH = window.LastikHesap, LV = window.LastikVeri, F = window.F1UI;
  if (!LH || !LV || typeof document === "undefined") { return; }
  var ILK = 10;
  var TERIM = [["stint", "Stint"], ["lastik-bilesikleri", "Compound"], ["pit-stop", "Pit lane"], ["undercut", "Undercut"], ["overcut", "Overcut"], ["lastik-asinmasi", "Tyre degradation"]];
  var D = { tur: null, liste: [], durum: "bos", stint: null, pit: null, rc: null, R: null, filtre: "ilk10", secA: null, secB: null, secili: null,
            tempo: null, tempoDurum: "kapali", anim: false, gozlem: null, seq: 0 };

  function esc(x) { return String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }
  function bul(f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } }
  function sezonYili() { return bul(function () { return SEZON; }, new Date().getFullYear()); }
  function favori() { return bul(function () { return localStorage.getItem("f1-favori") || null; }, null); }
  function takvimKaydi(tur) {
    var yil = sezonYili(), liste = bul(function () { var v = window.JolpicaIstemci.oku("takvim-" + yil); return v && v.veri && v.veri.RaceTable && v.veri.RaceTable.Races; }, null);
    if (!liste || !liste.length) { liste = bul(function () { return sezonYarislar; }, null); }
    return (liste || []).filter(function (y) { return Number(y.round) === Number(tur); })[0] || null;
  }
  function azHareket() { return bul(function () { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }, false); }
  function sn(x) { return x == null ? null : x.toFixed(1) + " sn"; }
  function sure(x) { if (x == null) { return null; } var m = Math.floor(x / 60), s = x - m * 60; return m + ":" + (s < 10 ? "0" : "") + s.toFixed(3); }

  function kok() {
    var k = document.getElementById("ls-strateji"); if (k) { return k; }
    var det = document.getElementById("yv-detay"); if (!det || !det.parentNode) { return null; }
    k = document.createElement("section"); k.id = "ls-strateji"; k.className = "ls"; k.setAttribute("aria-labelledby", "ls-b"); k.hidden = true;
    var yh = document.getElementById("yh-hikaye"), gl = document.getElementById("gl-ghost");      // sıra: Yarışın Hikâyesi → Lastik Stratejisi → Ghost Lap
    if (yh && yh.parentNode === det.parentNode) { det.parentNode.insertBefore(k, yh.nextSibling); }
    else { det.parentNode.insertBefore(k, gl && gl.parentNode === det.parentNode ? gl : det); }
    k.addEventListener("click", tikla);
    k.addEventListener("change", degis);
    k.addEventListener("mouseover", function (e) { var b = e.target.closest && e.target.closest(".ls-st"); if (b && matchMedia("(hover:hover)").matches) { secStint(b, true); } });
    return k;
  }

  // ---------- veri ----------
  async function yukle() {
    var tur = D.tur, y = takvimKaydi(tur), seq = D.seq;
    if (!y || !window.HaftaVeri) { D.durum = "yok"; ciz(); return; }
    D.durum = "yukleniyor"; ciz();
    var hafta = bul(function () { return HaftaVeri.haftaKur(y, "f1"); }, null), seans = hafta && hafta.seanslar.filter(function (s) { return s.anahtar === "Race"; })[0];
    var JI = window.JolpicaIstemci, st = null, pit = null, rc = null;
    try {
      // Race Control oturumu zaten çözüldüyse lastik modülüne aktar (ikinci "sessions" isteği yok)
      var ro = bul(function () { return JI.oku("rc-oturum-" + y.season + "-r" + y.round + "-Race"); }, null), lk = "stints-oturum-" + y.season + "-r" + y.round;
      if (ro && ro.veri && ro.veri.session_key && ro.veri.date_end && !bul(function () { return JI.oku(lk); }, null)) { JI.kaydet(lk, { session_key: ro.veri.session_key, meeting_key: ro.veri.meeting_key, ad: ro.veri.ad, date_end: ro.veri.date_end }); }
      st = await LV.yukle(y);
    } catch (e) { st = { durum: "hata" }; }
    if (st && st.durum === "ok" && hafta && seans) {
      try { if (window.RaceControlVeri) { var r = await RaceControlVeri.yukle(hafta, seans); if (r && r.durum === "ok") { rc = r.olaylar; } } } catch (e2) { rc = null; }
      try { if (window.PitVeri) { var p = await PitVeri.yukle(hafta, seans); if (p && p.durum === "ok") { pit = p.kayitlar; } } } catch (e3) { pit = null; }
    }
    if (seq !== D.seq) { return; }
    D.stint = st; D.pit = pit; D.rc = rc; D.durum = st && st.durum === "ok" ? "hazir" : (st ? st.durum : "hata");
    hesapla(); ciz();
  }
  function hesapla() {
    if (D.durum !== "hazir") { D.R = null; return; }
    D.R = LH.strateji({ stintRows: D.stint.rows, sonuc: D.liste, pit: D.pit });
    D.pencere = LH.bayrakPencereleri(D.rc);
    var s = D.R.satirlar.filter(function (x) { return x.stintler.length; }), fv = favori();
    if (!D.secA) { D.secA = s[0] ? s[0].id : null; }
    if (!D.secB) { D.secB = fv && fv !== D.secA && s.some(function (x) { return x.id === fv; }) ? fv : (s[1] ? s[1].id : null); }
  }
  async function tempoYukle() {
    if (D.tempoDurum === "yukleniyor" || D.tempoDurum === "hazir") { return; }
    var y = takvimKaydi(D.tur), hafta = y && bul(function () { return HaftaVeri.haftaKur(y, "f1"); }, null), seans = hafta && hafta.seanslar.filter(function (s) { return s.anahtar === "Race"; })[0];
    if (!window.LapsVeri || !seans) { D.tempoDurum = "yok"; ciz(); return; }
    D.tempoDurum = "yukleniyor"; ciz(); var seq = D.seq, r;
    try { r = await LapsVeri.yukle(hafta, seans); } catch (e) { r = { durum: "hata" }; }
    if (seq !== D.seq) { return; }
    D.tempo = r && r.durum === "ok" ? r.turlar : null; D.tempoDurum = D.tempo ? "hazir" : "yok"; ciz();
  }

  // ---------- çizim ----------
  function gorunen() {
    var s = D.R.satirlar.filter(function (x) { return x.stintler.length; }), fv = favori();
    if (D.filtre === "tumu") { return s; }
    if (D.filtre === "podyum") { return s.filter(function (x) { return x.bitis && x.bitis <= 3; }); }
    if (D.filtre === "favori") { return s.filter(function (x) { return x.id === fv; }); }
    if (D.filtre === "karsilastir") { return [D.secA, D.secB].map(function (id) { return s.filter(function (x) { return x.id === id; })[0]; }).filter(Boolean); }
    return s.slice(0, ILK);
  }
  function filtreHtml() {
    var fv = favori(), varF = fv && D.R.satirlar.some(function (x) { return x.id === fv && x.stintler.length; });
    var b = [["tumu", "TÜMÜ"], ["ilk10", "İLK 10"], ["podyum", "PODYUM"], ["favori", "FAVORİ"], ["karsilastir", "KARŞILAŞTIR"]];
    return "<div class='ls-filtre' role='group' aria-label='Pilot filtresi'>" + b.map(function (x) {
      var dis = x[0] === "favori" && !varF;
      return "<button type='button' class='ls-f' data-ls-f='" + x[0] + "' aria-pressed='" + (D.filtre === x[0]) + "'" + (dis ? " disabled title='Favori pilot seçilmedi ya da verisi yok'" : "") + ">" + x[1] + "</button>";
    }).join("") + "</div>";
  }
  function lejant() {
    var l = D.R.lastikler.map(function (k) { return "<span class='ls-lj'><i class='ls-c-" + k + "'></i>" + esc(LH.ING[k] === "INTERMEDIATE" ? "INTER" : LH.ING[k]) + "</span>"; }).join("");
    var w = {}; (D.pencere || []).forEach(function (p) { w[p.tip] = 1; });
    var b = Object.keys(w).map(function (t) { return "<span class='ls-lj'><i class='ls-band ls-band-" + t + "'></i>" + (t === "RED" ? "KIRMIZI BAYRAK" : t) + "</span>"; }).join("");
    return "<div class='ls-lejant'>" + l + b + "</div>";
  }
  function x(t, N) { return ((t - 1) / N * 100).toFixed(3) + "%"; }
  function w(n, N) { return (n / N * 100).toFixed(3) + "%"; }
  function bantlar(N) {
    return (D.pencere || []).filter(function (p) { return p.basTur != null; }).map(function (p) {
      var bit = p.bitTur != null ? p.bitTur : N;
      return "<i class='ls-band ls-band-" + p.tip + "' style='left:" + x(p.basTur, N) + ";width:" + w(bit - p.basTur + 1, N) + "' aria-hidden='true'></i>";
    }).join("");
  }
  function satirHtml(s, N, fv) {
    var bl = s.stintler.map(function (st, i) {
      if (st.uzun == null) { return ""; }
      var lbl = st.uzun / N * 100 >= 7 ? "<span class='ls-st-e'>" + LH.KISA[st.b.k] + "</span>" : "";
      var sec = D.secili && D.secili.id === s.id && D.secili.i === i;
      return "<button type='button' class='ls-st ls-c-" + st.b.k + (st.pit ? " ls-pitli" : "") + (sec ? " ls-sec" : "") + "' data-ls-id='" + esc(s.id) + "' data-ls-i='" + i + "' style='left:" + x(st.bas, N) + ";width:" + w(st.uzun, N) + "'" +
        " aria-label='" + esc(s.soyad + ": " + LH.ING[st.b.k] + ", tur " + st.bas + "–" + st.bit + ", " + st.uzun + " tur") + "' aria-pressed='" + (sec ? "true" : "false") + "'>" + lbl + "</button>";
    }).join("");
    var son = s.stintler.filter(function (st) { return st.bit != null; }).slice(-1)[0];
    var dnf = s.cekildi && son ? "<span class='ls-dnf' style='left:calc(" + x(son.bit + 1, N) + " + 3px)'>DNF</span>" : "";
    return "<div class='ls-satir" + (s.id === fv ? " ls-fav" : "") + "' data-ls-satir='" + esc(s.id) + "'>" +
      "<span class='ls-ad'><b>" + esc(s.siniflandi && s.bitis ? "P" + s.bitis : (s.cekildi ? "DNF" : s.pt || "–")) + "</b> " + esc(s.kod) + "</span>" +
      "<div class='ls-iz'>" + bl + bantlar(N) + dnf + "</div></div>";
  }
  function eksenHtml(N) {
    var t = [1]; for (var i = 10; i < N - Math.max(3, N * 0.07); i += 10) { t.push(i); } if (N > 1) { t.push(N); }   // son etiketle çakışan ara etiketi atla
    return "<div class='ls-satir ls-eksen' aria-hidden='true'><span class='ls-ad'>TUR</span><div class='ls-iz'>" + t.map(function (n, k) {
      var son = k === t.length - 1;
      return "<span class='ls-tik" + (son ? " ls-tik-son" : "") + "' style='left:" + x(n, N) + (son ? ";transform:translateX(-100%)" : "") + "'>" + n + "</span>";
    }).join("") + "</div></div>";
  }
  function detayHtml() {
    if (!D.secili) { return "<p class='ls-ipucu'>Bir stint bloğuna dokun: lastik, tur aralığı ve pit bilgisi burada görünür.</p>"; }
    var s = D.R.satirlar.filter(function (r) { return r.id === D.secili.id; })[0], st = s && s.stintler[D.secili.i]; if (!st) { return ""; }
    var pit = st.pit ? "Pit: tur " + st.pit.tur + (st.pit.lane != null ? " · pit lane süresi " + sn(st.pit.lane) : "") + (st.pit.durak != null ? " · durağan süre " + sn(st.pit.durak) : "") :
      (D.secili.i === 0 ? "Yarışa bu lastikle başladı." : (D.pit ? "Bu stint için eşleşen pit kaydı yok." : "Pit verisi yok."));
    return "<div class='ls-det'><p class='ls-det-b'><b>" + esc(s.soyad) + "</b> <span class='ls-bil ls-c-" + st.b.k + "'>" + esc(LH.ING[st.b.k]) + "</span></p>" +
      "<p>Tur " + st.bas + "–" + st.bit + " · " + st.uzun + " tur" + (st.yas != null ? " · başlangıç lastik yaşı " + st.yas + " tur" : " · başlangıç yaşı: veri yok") + "</p><p>" + esc(pit) + "</p>" +
      (s.tutarli === false ? "<p class='ls-not'>Bu pilot için OpenF1 stint ve pit kayıtları birbiriyle tam eşleşmiyor; kayıtlar olduğu gibi gösterilir.</p>" : "") + "</div>";
  }
  function kisiHtml(s) {
    if (!s) { return "<div class='ls-k'><p class='ls-yok'>Veri yok</p></div>"; }
    var dz = s.stintler.map(function (st) { return "<span class='ls-bil ls-c-" + st.b.k + "'>" + esc(LH.ING[st.b.k]) + "</span> (" + (st.uzun != null ? st.uzun + " tur" : "?") + ")"; }).join(" → ");
    var pt = s.pitler ? s.pitler.map(function (p) { return p.tur; }) : null;
    var lane = s.pitler ? s.pitler.map(function (p) { return p.lane != null ? sn(p.lane) : "—"; }) : null;
    var dur = s.pitler && s.pitler.some(function (p) { return p.durak != null; }) ? s.pitler.map(function (p) { return p.durak != null ? sn(p.durak) : "—"; }) : null;
    var r = [["Lastik dizilimi", dz], ["Pit stop", s.pitler ? String(s.pitler.length) : "Veri yok"], ["Pit turları", pt && pt.length ? pt.join(", ") : (pt ? "—" : "Veri yok")],
             ["En uzun stint", s.enUzun ? LH.ING[s.enUzun.b.k] + " · " + s.enUzun.uzun + " tur" : "Veri yok"], ["Pit lane süresi", lane && lane.length ? lane.join(" · ") : (lane ? "—" : "Veri yok")]];
    if (dur) { r.push(["Durağan süre", dur.join(" · ")]); }
    r.push(["Start → bitiş", (s.grid ? "P" + s.grid : (s.pitYolu ? "Pit yolu" : "—")) + " → " + (s.siniflandi && s.bitis ? "P" + s.bitis : (s.cekildi ? "DNF (" + s.tur + " tur)" : s.pt || "—"))]);
    return "<div class='ls-k'><p class='ls-k-ad'><b>" + esc(s.soyad) + "</b> <span class='ls-alt'>" + esc(s.takim) + "</span></p><dl>" +
      r.map(function (x) { return "<dt>" + esc(x[0]) + "</dt><dd>" + (x[0] === "Lastik dizilimi" ? x[1] : esc(x[1])) + "</dd>"; }).join("") + "</dl>" +
      (s.tutarli === false ? "<p class='ls-not'>OpenF1 stint ve pit kayıtları bu pilot için tam eşleşmiyor.</p>" : "") + "</div>";
  }
  function tempoHtml(s) {
    if (!s) { return ""; }
    var t = D.tempo ? LH.tempo(D.tempo, s, D.pencere) : null;
    if (!t) { return "<p class='ls-yok'>" + esc(s.soyad) + ": tur zamanı verisi yok.</p>"; }
    return "<table class='ls-tempo'><caption>" + esc(s.soyad) + "</caption><thead><tr><th>Stint</th><th>Temiz tur</th><th>Medyan</th><th>En hızlı</th></tr></thead><tbody>" + t.map(function (r) {
      return "<tr><td><span class='ls-bil ls-c-" + r.stint.b.k + "'>" + LH.KISA[r.stint.b.k] + "</span> " + r.stint.bas + "–" + r.stint.bit + "</td><td>" + r.kullanilan + " / " + r.turSayisi + "</td><td>" + (sure(r.medyan) || "—") + "</td><td>" + (sure(r.enHizli) || "—") + "</td></tr>";
    }).join("") + "</tbody></table>";
  }
  function secOpt(sel) {
    return D.R.satirlar.filter(function (s) { return s.stintler.length; }).map(function (s) { return "<option value='" + esc(s.id) + "'" + (s.id === sel ? " selected" : "") + ">" + esc((s.siniflandi && s.bitis ? "P" + s.bitis + " " : "") + s.soyad) + "</option>"; }).join("");
  }
  function karsilastirHtml() {
    var bul2 = function (id) { return D.R.satirlar.filter(function (s) { return s.id === id; })[0] || null; }, A = bul2(D.secA), B = bul2(D.secB);
    var tem = D.tempoDurum === "hazir" ? "<div class='ls-tempo-k'>" + tempoHtml(A) + tempoHtml(B) + "</div>" :
      D.tempoDurum === "yukleniyor" ? "<p class='ls-yok'>Tur zamanları yükleniyor…</p>" :
      D.tempoDurum === "yok" ? "<p class='ls-yok'>Bu yarış için tur zamanı verisi yok; tempo hesaplanmadı.</p>" :
      "<p><button type='button' class='ls-btn' data-ls-tempo>STİNT TEMPOSUNU GÖSTER</button></p>";
    return "<section class='ls-kars' aria-label='İki pilot strateji karşılaştırması'><div class='ls-secim'><label>Pilot A <select data-ls-sec='A'>" + secOpt(D.secA) + "</select></label>" +
      "<label>Pilot B <select data-ls-sec='B'>" + secOpt(D.secB) + "</select></label></div><div class='ls-kk'>" + kisiHtml(A) + kisiHtml(B) + "</div>" +
      "<h3 class='ls-h3'>Stint temposu</h3>" + tem +
      "<p class='ls-not'>Tempo: geçerli turların medyanı ve en hızlı tur. Hariç: 1. tur, pit giriş/çıkış turları, SC/VSC/kırmızı bayrakla çakışan turlar (pilotun kendi tur zamanına göre) ve sonraki ilk tur, medyandan %10'dan yavaş turlar. En az " + LH.EN_AZ_TEMIZ + " temiz tur yoksa hesaplanmaz. Farklı lastik, yakıt yükü, trafik ve pist koşulları karşılaştırmayı etkiler; tur zamanından aşınma ya da performans sonucu çıkarılmaz.</p></section>";
  }
  function pitTabloHtml(sat) {
    var l = sat.filter(function (s) { return s.pitler && s.pitler.length; });
    if (!D.pit) { return "<p class='ls-yok'>Bu yarış için pit verisi yok.</p>"; }
    if (!l.length) { return "<p class='ls-yok'>Görünen pilotlar için pit kaydı yok.</p>"; }
    var durVar = l.some(function (s) { return s.pitler.some(function (p) { return p.durak != null; }); });
    return "<div class='ls-pit-kap'><table class='ls-pit'><thead><tr><th>Pilot</th><th>Pit</th><th>Tur</th><th>Pit lane</th>" + (durVar ? "<th>Durağan</th>" : "") + "</tr></thead><tbody>" + l.map(function (s) {
      return "<tr><th scope='row'>" + esc(s.kod) + "</th><td>" + s.pitler.length + "</td><td>" + s.pitler.map(function (p) { return p.tur; }).join(", ") + "</td><td>" + s.pitler.map(function (p) { return p.lane != null ? p.lane.toFixed(1) : "—"; }).join(" · ") + "</td>" +
        (durVar ? "<td>" + s.pitler.map(function (p) { return p.durak != null ? p.durak.toFixed(1) : "—"; }).join(" · ") + "</td>" : "") + "</tr>";
    }).join("") + "</tbody></table></div><p class='ls-not'>Pit lane: pit yoluna girişten çıkışa geçen süre (sn). " + (durVar ? "Durağan: aracın pit kutusunda durduğu süre (sn), kaynakta ayrıca bildirildiğinde. " : "Kaynak bu yarış için durağan süreyi ayrıca vermiyor; pit lane süresi lastik değişim süresi değildir. ") + "Süre farkları tek başına hata göstergesi değildir.</p>";
  }
  function ogrenHtml() {
    return "<p class='ls-ogren'><span>İZLERKEN ÖĞREN</span>" + TERIM.map(function (t) { return "<button type='button' class='a2-baglanti' data-terim='" + t[0] + "'>" + t[1] + "</button>"; }).join("") + "</p>";
  }
  function ciz() {
    var k = kok(); if (!k) { return; }
    if (!D.liste.length) { k.hidden = true; k.innerHTML = ""; return; }
    k.hidden = false;
    var bas = "<h2 class='ls-baslik' id='ls-b'>LASTİK STRATEJİSİ</h2><p class='ls-altb'>Yarış boyunca kullanılan lastikler · kaynak: OpenF1 stint ve pit kayıtları</p>";
    if (D.durum === "bos") { k.innerHTML = bas + "<p class='ls-yok'>Bölüm görünür olunca yüklenir.</p>"; return; }
    if (D.durum === "yukleniyor") { k.innerHTML = bas + "<p class='ls-yok' aria-live='polite'>Lastik verisi yükleniyor…</p>"; return; }
    if (D.durum !== "hazir" || !D.R || !D.R.veriVar) {
      var m = D.durum === "yayimlanmadi" || D.durum === "kisit" ? "Lastik verisi henüz yayımlanmadı." : "Bu yarış için lastik ve pit verisi bulunamadı. Diğer analiz bölümleri kullanılabilir.";
      k.innerHTML = bas + "<p class='ls-yok' data-ls-bos>" + esc(m) + "</p>" + ogrenHtml(); return;
    }
    var N = D.R.toplamTur, fv = favori(), sat = gorunen(), oz = LH.stratejiOzet(D.R);
    var h = bas + (oz.length ? "<ul class='ls-oz'>" + oz.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" : "") + filtreHtml() + lejant() +
      "<div class='ls-grafik" + (!D.anim && !azHareket() ? " ls-anim" : "") + "' role='group' aria-label='Lastik stint zaman çizelgesi'>" + sat.map(function (s) { return satirHtml(s, N, fv); }).join("") + eksenHtml(N) + "</div>" +
      (D.pencere && D.pencere.length ? "<p class='ls-not'>SC / VSC / kırmızı bayrak bantları yarışın (liderin) turlarına göre; stint blokları pilotun kendi turlarına göre çizilir.</p>" : "") +
      "<div class='ls-detay' aria-live='polite'>" + detayHtml() + "</div>" +
      (D.filtre === "karsilastir" ? karsilastirHtml() : "") +
      "<details class='ls-pit-d'><summary>PİT STOP ANALİZİ</summary>" + pitTabloHtml(sat) + "</details>" + ogrenHtml();
    k.innerHTML = h; D.anim = true;
  }
  function secStint(b, hover) {
    var id = b.getAttribute("data-ls-id"), i = Number(b.getAttribute("data-ls-i"));
    // dokunma aç/kapa; fareyle üzerine gelinmiş bloğa tıklamak paneli kapatmaz (önce hover seçti, sonra tık kapatmasın)
    if (!hover && D.secili && D.secili.id === id && D.secili.i === i && D.secKaynak === "tik") { D.secili = null; } else { D.secili = { id: id, i: i }; D.secKaynak = hover ? "hover" : "tik"; }
    var dt = kok().querySelector(".ls-detay"); if (dt) { dt.innerHTML = detayHtml(); }
    Array.prototype.forEach.call(kok().querySelectorAll(".ls-st"), function (e) { var on = D.secili && e.getAttribute("data-ls-id") === D.secili.id && Number(e.getAttribute("data-ls-i")) === D.secili.i; e.classList.toggle("ls-sec", !!on); e.setAttribute("aria-pressed", on ? "true" : "false"); });
  }
  function tikla(e) {
    var t = e.target.closest ? e.target : null; if (!t) { return; }
    var st = t.closest(".ls-st"); if (st) { secStint(st, false); return; }
    var f = t.closest("[data-ls-f]"); if (f && !f.disabled) { D.filtre = f.getAttribute("data-ls-f"); ciz(); var y = kok().querySelector("[data-ls-f='" + D.filtre + "']"); if (y) { bul(function () { y.focus(); }); } return; }
    if (t.closest("[data-ls-tempo]")) { tempoYukle(); return; }
    var te = t.closest("[data-terim]"); if (te) { bul(function () { if (window.Ogren && Ogren.ac) { Ogren.ac(te.getAttribute("data-terim")); } }); }   // İzlerken Öğren → mevcut sözlük
  }
  function degis(e) {
    var s = e.target.closest && e.target.closest("[data-ls-sec]"); if (!s) { return; }
    if (s.getAttribute("data-ls-sec") === "A") { D.secA = s.value; } else { D.secB = s.value; }
    ciz();
  }
  function gozle() {
    var k = kok(); if (!k) { return; }
    if (D.gozlem) { D.gozlem.disconnect(); D.gozlem = null; }
    if (D.durum !== "bos") { return; }
    var basla = function () { if (D.durum === "bos" && D.tur != null) { yukle(); } };
    if (!("IntersectionObserver" in window)) { basla(); return; }
    D.gozlem = new IntersectionObserver(function (es) { if (es.some(function (x) { return x.isIntersecting; })) { D.gozlem.disconnect(); D.gozlem = null; basla(); } }, { rootMargin: "0px" });
    D.gozlem.observe(k);
  }
  // Yarışın Hikâyesi pit kartından → bu grafikte o pilot (karşılaştırma modu, A = pilot). Ağ isteği yok (veri yoksa görünür olunca yüklenir).
  function hikayedenGit(id) {
    var k = kok(); if (!k) { return; }
    if (id) { if (id !== D.secA) { D.secB = D.secA; D.secA = id; } D.filtre = "karsilastir"; }
    if (D.durum === "hazir") { ciz(); }
    bul(function () { k.scrollIntoView({ block: "start", behavior: azHareket() ? "auto" : "smooth" }); });
    k.classList.add("yo-vurgu"); setTimeout(function () { k.classList.remove("yo-vurgu"); }, 2200);
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-ls-git]"); if (!b) { return; }
    e.preventDefault(); hikayedenGit(b.getAttribute("data-ls-git"));
  });

  document.addEventListener("f1-yaris-sonuc", function (e) {
    var d = e.detail || {};
    if (String(d.tur) !== String(D.tur)) { D.seq++; D.stint = null; D.pit = null; D.rc = null; D.R = null; D.durum = "bos"; D.secA = null; D.secB = null; D.secili = null; D.tempo = null; D.tempoDurum = "kapali"; D.anim = false; }
    D.tur = d.tur; D.liste = (d.liste || []).filter(function (r) { return r && r.Driver; });
    if (D.durum === "hazir") { hesapla(); }
    ciz(); gozle();
  });
  window.LastikStrateji = { _durum: function () { return D; }, ciz: ciz, git: hikayedenGit };
})();
