/* A3.3 — SPRINT vs ANA YARIŞ. Seçili pilotun puanını ana yarış ve sprint olarak ikiye ayırır; sprint katkısını gösterir.
   VERİ: yalnızca A3.1'in zaten yüklediği model (AnalizMerkezi._durum). YENİ AĞ ÇAĞRISI YOKTUR; yeni tercih anahtarı YOKTUR
   (varsayılan: favori pilot, yoksa şampiyonluk lideri; seçim yalnızca bellekte). Hesap: sezon-hesap-a33.js (saf).
   ENTEGRASYON: A3.1 olay kancası (AnalizMerkezi.dinle); A3.1/A3.2 bölümlerini yeniden yazmaz, #a32-dnf'in (yoksa #a3-takim'in) altına bölüm ekler. */
(function () {
  "use strict";
  var AM = window.AnalizMerkezi, H3 = window.SezonHesapA33, F = window.F1UI;
  if (!AM || !AM.dinle || !H3) { return; }
  var S = AM._durum;
  var C = { model: null, h: null, sec: null, tum: false };
  var planli = false, bagli = false;

  function esc(x) { return F && F.esc ? F.esc(x) : String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }
  function kok() { return document.getElementById("a3-merkez"); }
  function soz(k) { try { return window.ICERIK && ICERIK.sozluk && ICERIK.sozluk.terimler[k] || null; } catch (e) { return null; } }
  function bilgi(k) { var t = soz(k); return t ? "<button type='button' class='a2-i' data-terim='" + k + "' aria-haspopup='dialog' aria-label='" + esc(t.ad) + " nedir?' title='" + esc(t.ad) + " nedir?'></button>" : ""; }
  function favori() { try { return localStorage.getItem("f1-favori") || ""; } catch (e) { return ""; } }
  function ad(id) { var p = S.model.pilotlar[id]; return p ? p.a : id; }
  function kod(id) { var p = S.model.pilotlar[id]; return p ? p.k : id; }
  function yuzde(x) { return x == null ? "—" : x.toFixed(1).replace(".", ",") + "%"; }
  function ort(x) { return x == null ? "—" : x.toFixed(1); }

  function hesap() {
    if (C.model !== S.model) { C.model = S.model; C.h = H3.hesapla(S.model); }
  }
  function liste() { return (S.sira || []).filter(function (id) { return C.h.pilot[id]; }); }
  function aktif(l) {
    if (C.sec && l.indexOf(C.sec) >= 0) { return C.sec; }
    var f = favori();
    return (f && l.indexOf(f) >= 0) ? f : l[0];
  }
  function ikincil(k) {
    var p = [];
    p.push(k.dnf + " DNF"); p.push(k.dns + " DNS"); p.push(k.dsq + " DSQ");
    return p.join(" · ");
  }
  function blok(baslik, k, ornekMetni, bos) {
    var h = "<div class='a33-blok'><h3>" + baslik + "</h3>";
    if (bos) { return h + "<p class='a3-bos'>" + esc(bos) + "</p></div>"; }
    h += "<dl class='a33-say'>" +
      "<div><dt>" + (baslik.indexOf("SPRINT") === 0 ? "Sprint" : "Yarış") + "</dt><dd>" + k.basladi + "</dd></div>" +
      "<div><dt>Puan</dt><dd>" + k.puan + "</dd></div>" +
      "<div><dt>Galibiyet</dt><dd>" + k.galibiyet + "</dd></div>" +
      "<div><dt>Podyum " + bilgi("podyum") + "</dt><dd>" + k.podyum + "</dd></div>" +
      "<div><dt>Ort. Bitiş " + bilgi("ortalama-bitis") + "</dt><dd>" + ort(k.ortBitis) + "</dd></div></dl>" +
      "<p class='a33-alt'>" + esc(ornekMetni) + "</p>" +
      "<p class='a33-alt'>" + esc(ikincil(k)) + " " + bilgi("dns-dsq") + "</p></div>";
    return h;
  }
  function secici(l, sec) {
    return "<label class='a33-sec'><span>Pilot</span><select data-a33-pilot aria-label='Pilot seç'>" +
      l.map(function (id) { return "<option value='" + esc(id) + "'" + (id === sec ? " selected" : "") + ">" + esc(ad(id)) + "</option>"; }).join("") + "</select></label>";
  }
  function tablo(l) {
    return "<details class='a33-tum'" + (C.tum ? " open" : "") + "><summary>Tam tabloyu göster</summary>" +
      "<div class='a33-kay'><table><thead><tr><th>Pilot</th><th>GP Puan</th><th>Sprint Puan</th><th>Toplam</th><th>Sprint Katkısı</th></tr></thead><tbody>" +
      l.map(function (id) {
        var p = C.h.pilot[id];
        return "<tr data-a33-satir='" + esc(id) + "'><td>" + esc(ad(id)) + "</td><td>" + p.gp.puan + "</td><td>" + p.sprint.puan + "</td><td>" + p.toplam + "</td><td>" + yuzde(p.katki) + "</td></tr>";
      }).join("") + "</tbody></table></div></details>";
  }
  function govde() {
    hesap();
    var l = liste(), h = C.h;
    var bas = "<h2>Sprint vs Ana Yarış</h2>";
    if (!l.length) { return bas + "<p class='a3-bos'>Gösterilecek pilot yok.</p>"; }
    var sec = aktif(l), p = h.pilot[sec];
    var sprintYok = !h.sprintTurSayisi, gp = p.gp, sp = p.sprint;
    var gpOrnek = gp.n + " / " + h.gpTurSayisi + " yarış üzerinden";
    var spOrnek = sprintYok ? "" : (sp.n ? sp.n + " sınıflandırılmış sprint üzerinden" : "Sınıflandırılmış sprint yok");
    var spBos = sprintYok ? "Bu sezon henüz sprint yarışı yapılmadı." : (sp.basladi + sp.dns === 0 ? "Bu pilot sprint yarışmadı." : null);
    var katki = p.katki;
    return bas +
      "<p class='a3-not'>Toplam puan ana yarış ve sprint puanlarının toplamıdır; galibiyet ve podyum her bölümde ayrı sayılır. Sprint Ort. Bitiş yalnızca sınıflandırılmış sprint sonuçlarından hesaplanır.</p>" +
      secici(l, sec) +
      "<div class='a33-kart' data-a33-kart='" + esc(sec) + "'>" +
        "<div class='a33-toplam'><span class='a33-et'>TOPLAM</span><b>" + p.toplam + " puan</b><span class='a33-alt'>" + esc(ad(sec)) + " · " + p.gp.puan + " ana yarış + " + p.sprint.puan + " sprint</span></div>" +
        "<div class='a33-iki'>" + blok("ANA YARIŞ", gp, gpOrnek, null) + blok("SPRINT", sp, spOrnek, spBos) + "</div>" +
        "<div class='a33-katki' data-a33-katki><span class='a33-et'>SPRINT KATKISI " + bilgi("sprint-katkisi") + "</span><b>" + yuzde(katki) + "</b>" +
          "<span class='a33-alt'>" + (katki == null ? "Toplam puan 0 olduğu için oran hesaplanmaz" : sp.puan + " / " + p.toplam + " puan") + "</span>" +
          (katki == null ? "" : "<span class='a33-cubuk' aria-hidden='true'><i style='width:" + Math.min(100, katki) + "%'></i></span>") + "</div>" +
      "</div>" + tablo(l);
  }
  function yenile() {
    planli = false;
    var k = kok();
    if (!k || S.durum !== "hazir" || !S.model || !k.querySelector("#a3-pilot")) { return; }
    var el = k.querySelector("#a33-sprint");
    if (!el) {
      var ref = k.querySelector("#a32-dnf") || k.querySelector("#a3-takim"); if (!ref) { return; }
      el = document.createElement("section"); el.id = "a33-sprint"; el.className = "a3-kart a33-bolum"; el.setAttribute("data-a33", "1");
      ref.parentNode.insertBefore(el, ref.nextSibling);
    }
    var odak = document.activeElement && document.activeElement.hasAttribute && document.activeElement.hasAttribute("data-a33-pilot");
    el.innerHTML = govde();
    if (odak) { var s = el.querySelector("[data-a33-pilot]"); if (s) { s.focus(); } }
  }
  function planla() { if (planli) { return; } planli = true; Promise.resolve().then(yenile); }

  function olaylar(k) {
    if (bagli) { return; } bagli = true;
    k.addEventListener("change", function (e) {
      var s = e.target; if (!s || !s.hasAttribute || !s.hasAttribute("data-a33-pilot")) { return; }
      C.sec = s.value; planla();
    });
    k.addEventListener("toggle", function (e) { if (e.target && e.target.classList && e.target.classList.contains("a33-tum")) { C.tum = e.target.open; } }, true);
  }
  function baslat() {
    var k = kok(); if (!k) { return; }
    olaylar(k);
    AM.dinle(function () { planla(); });
    if (AM.durum() === "hazir") { planla(); }
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", baslat); } else { baslat(); }
})();
