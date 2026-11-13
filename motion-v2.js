/* F1 TAKİP — MOTION v2 (v3.0.3; v3.0.6 giriş + nokta güncellemesi). Motion v1'in üstüne, aynı kurallarla çalışan ek hareket katmanı.
   • Ağ çağrısı YOK, polling YOK, requestAnimationFrame döngüsü YOK. Veri/state üretmez; yalnız mevcut DOM'u okuyup .mo2-* sınıfı ekler.
   • Animasyonlar tek seferlik; prefers-reduced-motion açıksa hiçbiri oynamaz (▲▼ rozetleri bilgi olduğu için yine görünür).
   • Hata olursa sessizce atlanır; uygulamanın geri kalanı etkilenmez.
   1) Pist çizimi: pist EKRANDA GÖRÜNÜNCE çizilir (IntersectionObserver); sekmeye her girişte ve uygulamaya geri dönünce yeniden.
      (motion-v1.js pistKontrol bu dosyaya devreder.)
   2) Pistte tek tur atan nokta: çizim bitince path geometrisinden (getPointAtLength) örneklenen Web Animations ile bir tur, sonra söner. Desteklemeyen tarayıcıda atlanır.
   3) Puan grafiği (svg-grafik.js): çizgiler soldan sağa çizilir; yeni veri/seçimde ve sekmeye her girişte; yeniden boyutlandırmada tekrar etmez.
   4) Lastik stint şeridi (analiz-lastik.js): parçalar soldan sağa sırayla dolar.
   5) Puan tablosu ▲▼ (pilot + takım): son görülen sıralama YALNIZ bu cihazda tutulur (localStorage "f1-mo2-sira").
      Yeni yarış sonrası sırası değişen satır eski yerinden kayar ve yanında ▲/▼ rozeti çıkar. İlk kullanımda karşılaştıracak kayıt yoktur.
   6) Giriş: oturumda bir kez ~5.8 sn; 5 kırmızı ışık sırayla yanar (tamamı yanmadan açılmaz), söner, kinetik "F1 TAKİP" yazısı; dokununca atlanır. */
(function () {
  "use strict";
  var D = document, W = window;
  var NS = "http://www.w3.org/2000/svg";
  var PATH = ".bg-hat, .g3-hat, .h-hat, .st-p-hat";
  var TAZE_MS = 900;                       // sekme geçişinden sonra yeniden çizimin "taze" sayıldığı pencere
  var S = { pk: {}, gk: {}, sekmeT: 0 };

  function reduced() { try { return W.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } }
  function sekmeId(el) { var s = el && el.closest ? el.closest("section[id^='sekme-']") : null; return s ? s.id : ""; }
  function gizliMi(el) { var s = el && el.closest ? el.closest("section[id^='sekme-']") : null; return !!(s && s.hidden); }
  function taze() { return performance.now() - S.sekmeT < TAZE_MS; }
  function her(liste, fn) { Array.prototype.forEach.call(liste || [], fn); }

  // a/b ikiz sınıf: aynı öğede animasyonu yeniden başlatır (keyframe adı değişir)
  function tekrar(el, ad) {
    var A = "mo2-" + ad + "-a", B = "mo2-" + ad + "-b", son = el.__mo2 && el.__mo2[ad];
    el.classList.remove(A, B);
    el.classList.add(son === "a" ? B : A);
    (el.__mo2 = el.__mo2 || {})[ad] = son === "a" ? "b" : "a";
  }

  // ---- görünürlük kapısı: öğe ekrana girince bir kez çalıştır ----
  var io = null;
  function gorununce(el, fn) {
    var hedef = (el.ownerSVGElement || el);
    if (!("IntersectionObserver" in W)) { fn(); return; }
    if (!io) {
      io = new IntersectionObserver(function (girdiler) {
        girdiler.forEach(function (g) {
          if (!g.isIntersecting) { return; }
          var t = g.target, f = t.__mo2cb; io.unobserve(t); t.__mo2cb = null;
          if (f && t.isConnected && !D.hidden) { try { f(); } catch (x) { /* önemsiz */ } }
        });
      }, { threshold: 0.2 });
    }
    hedef.__mo2cb = fn; io.observe(hedef);
  }

  // ---------- 1) PİST ÇİZİMİ + 2) TUR ATAN NOKTA ----------
  // Nokta: pist path'inin KENDİ geometrisi boyunca (getPointAtLength, eşit yay aralıklı ~140 örnek) sabit hızla tek tur. Web Animations API (transform + opacity);
  // SMIL/animateMotion kullanılmaz (mobil Safari'de noktanın pistten kopup sabit kalmasının nedeni). Masaüstü ve mobil AYNI süre. rAF döngüsü yok.
  var TUR_MS = 5200;
  function nokta(p, d) {
    var svg = p.ownerSVGElement; if (!svg || !p.isConnected || D.hidden || reduced()) { return; }
    if (typeof p.getTotalLength !== "function" || typeof p.getPointAtLength !== "function") { return; }
    var L = 0; try { L = p.getTotalLength(); } catch (x) { return; }
    if (!(L > 0)) { return; }
    var eski = svg.querySelector(".mo2-nokta"); if (eski && eski.parentNode) { eski.parentNode.removeChild(eski); }   // aynı pistte tek nokta
    var c = D.createElementNS(NS, "circle");
    if (typeof c.animate !== "function") { return; }                  // WAAPI yok → nokta yok (pist çizimi yine çalışır)
    var N = 140, kare = [], i, pt;
    for (i = 0; i <= N; i++) {
      try { pt = p.getPointAtLength(L * i / N); } catch (x) { return; }
      kare.push({ transform: "translate(" + pt.x.toFixed(2) + "px, " + pt.y.toFixed(2) + "px)", opacity: i === 0 || i === N ? 0 : 1, offset: i / N });
    }
    kare[1].opacity = 1; kare[N - 1].opacity = 1;
    c.setAttribute("r", "4.2"); c.setAttribute("cx", "0"); c.setAttribute("cy", "0"); c.setAttribute("class", "mo2-nokta");
    c.style.opacity = "0";
    svg.appendChild(c);
    var a;
    try { a = c.animate(kare, { duration: TUR_MS, easing: "linear", fill: "forwards" }); } catch (x) { if (c.parentNode) { c.parentNode.removeChild(c); } return; }
    var kaldir = function () { if (c.parentNode) { c.parentNode.removeChild(c); } };
    a.onfinish = kaldir; a.oncancel = kaldir;
  }
  function pist(p) {
    if (!p || gizliMi(p) || reduced()) { return; }
    var d = p.getAttribute("d"); if (!d) { return; }
    var slot = sekmeId(p) + "|" + String(p.parentNode && p.parentNode.id || "") + "|" + String(p.getAttribute("class")).split(/\s+/)[0];
    var k = S.pk[slot];
    // aynı pist zaten çizildiyse: yalnız sekme geçişi anında yeniden çizilen (yeni) öğe ya da hâlâ bekleyen öğenin yerine gelen öğe çizilir
    if (k && k.d === d && (k.el === p || (!taze() && !(k.bekliyor && !k.el.isConnected)))) { return; }
    var kayit = { d: d, el: p, bekliyor: true };
    S.pk[slot] = kayit;
    p.setAttribute("pathLength", "1");
    p.classList.add("mo2-p-bekle");                                  // ekrana girene kadar çizgi gizli (alt çizgi görünür kalır)
    gorununce(p, function () {
      kayit.bekliyor = false;
      p.classList.remove("mo2-p-bekle");
      if (W.MotionV1 && W.MotionV1.oyna) { W.MotionV1.oyna(p, "ciz"); }
      var bitti = function (e) {
        if (!/^mo-ciz-/.test(e.animationName || "")) { return; }
        p.removeEventListener("animationend", bitti);
        nokta(p, d);
      };
      p.addEventListener("animationend", bitti);
    });
  }
  function bolumuYenile(sec) {
    if (!sec) { return; }
    S.sekmeT = performance.now();
    Object.keys(S.pk).forEach(function (k) { if (k.indexOf(sec.id + "|") === 0) { delete S.pk[k]; } });
    Object.keys(S.gk).forEach(function (k) { if (k.indexOf(sec.id + "|") === 0) { delete S.gk[k]; } });
  }

  // ---------- 3) PUAN GRAFİĞİ ----------
  function grafik(svg) {
    if (!svg || gizliMi(svg) || reduced()) { return; }
    var yollar = svg.querySelectorAll(".sg-cizgi"); if (!yollar.length) { return; }
    var anahtar = Array.prototype.map.call(yollar, function (y) { return (y.parentNode.getAttribute("data-id") || "") + ":" + y.getAttribute("d"); }).join("|");
    var slot = sekmeId(svg) + "|" + String(svg.parentNode && svg.parentNode.id || "");
    if (S.gk[slot] === anahtar && !taze()) { return; }              // yeniden boyutlandırma vb. → aynı veri, tekrar yok
    S.gk[slot] = anahtar;
    her(yollar, function (y) {
      if (y.hasAttribute("stroke-dasharray")) { y.classList.add("mo2-kesik"); }
      else { y.setAttribute("pathLength", "1"); y.classList.add("mo2-duz"); }
    });
    svg.classList.add("mo2-g-bekle");
    gorununce(svg, function () { svg.classList.remove("mo2-g-bekle"); tekrar(svg, "g"); });
  }

  // ---------- 4) LASTİK ŞERİDİ ----------
  function serit(s) {
    if (!s || gizliMi(s) || reduced()) { return; }
    s.classList.add("mo2-s-bekle");
    gorununce(s, function () { s.classList.remove("mo2-s-bekle"); tekrar(s, "s"); });
  }

  // ---------- 5) PUAN TABLOSU ▲▼ ----------
  var SK = "f1-mo2-sira";
  function oku() { try { return JSON.parse(localStorage.getItem(SK) || "{}") || {}; } catch (e) { return {}; } }
  function yaz(o) { try { localStorage.setItem(SK, JSON.stringify(o)); } catch (e) { /* depolama kapalı → rozet yok */ } }
  function sezonAdi() { try { return String(SEZON); } catch (e) { return String(new Date().getFullYear()); } }   // index.html'deki SEZON (salt okunur)
  // liste: [{id, poz, puan}] (tablo satır sırasıyla aynı)
  function siraIsle(tur, liste, tbody) {
    if (!tbody || !liste || !liste.length || tbody.rows.length !== liste.length) { return; }
    var hepsi = oku(), sezon = sezonAdi(), k = hepsi[tur];
    if (!k || k.sezon !== sezon) { k = { sezon: sezon }; }
    var imza = liste.map(function (x) { return x.id + ":" + x.puan; }).join(","), poz = {};
    liste.forEach(function (x) { poz[x.id] = x.poz; });
    if (!k.simdi || k.simdi.imza !== imza) {                         // yeni sıralama (yeni yarış/düzeltme) → öncekini sakla
      if (k.simdi) { k.onceki = k.simdi; }
      k.simdi = { imza: imza, poz: poz };
      hepsi[tur] = k; yaz(hepsi);
    }
    if (!k.onceki) { return; }
    var kayan = false;
    liste.forEach(function (x, i) {
      var tr = tbody.rows[i], td = tr && tr.cells[0]; if (!td) { return; }
      var eski = td.querySelector(".mo2-rozet"); if (eski) { eski.parentNode.removeChild(eski); }
      tr.removeAttribute("data-mo2-fark");
      var o = k.onceki.poz[x.id]; if (o == null || !x.poz) { return; }
      var fark = Number(o) - Number(x.poz); if (!fark) { return; }
      var r = D.createElement("span");
      r.className = "mo2-rozet " + (fark > 0 ? "mo2-up" : "mo2-down");
      r.textContent = (fark > 0 ? "▲" : "▼") + Math.abs(fark);
      r.title = "Önceki sıralamaya göre " + Math.abs(fark) + " sıra " + (fark > 0 ? "yükseldi" : "düştü");
      r.setAttribute("aria-label", r.title);
      td.appendChild(r);
      tr.setAttribute("data-mo2-fark", String(fark)); kayan = true;
    });
    if (kayan) { kaydir(tbody); }
  }
  function kaydir(tbody) {
    if (!tbody || gizliMi(tbody) || reduced()) { return; }
    gorununce(tbody.closest("table") || tbody, function () {
      her(tbody.querySelectorAll("tr[data-mo2-fark]"), function (tr) {
        var h = tr.offsetHeight; if (!h) { return; }                    // daraltılmış (gizli) satır → animasyon yok
        var fark = Number(tr.getAttribute("data-mo2-fark")) || 0;
        tr.style.setProperty("--mo2-dy", Math.max(-8, Math.min(8, fark)) * h + "px");
        tekrar(tr, "kay");
      });
    });
  }
  function pilotSirasi() {
    var tb = D.getElementById("pilot-govde"), pl;
    try { pl = sezonPilotlar; } catch (e) { return; }                  // index.html'deki üst düzey değişken (salt okunur)
    if (!pl || !pl.length) { return; }
    siraIsle("p", pl.map(function (k) { return { id: k.Driver && k.Driver.driverId, poz: k.position, puan: k.points }; }), tb);
  }

  // ---------- 6) GİRİŞ: START IŞIKLARI + KİNETİK YAZI ----------
  // Oturumda bir kez, toplam ~5.8 sn: 5 kırmızı ışık SIRAYLA yanar (hepsi yanmadan ekran açılmaz) → ışıklar söner → renkli çizgiler + "F1 TAKİP" + kısa kelimeler → ekran açılır.
  // Tamamı CSS animasyonu (gecikmeli, tek seferlik); rAF/loop yok. Dokununca atlanır. prefers-reduced-motion → hiç gösterilmez.
  var INTRO_MS = 5800;
  function isiklar() {
    if (reduced() || !D.body) { return; }
    try { if (sessionStorage.getItem("f1-mo2-isik")) { return; } sessionStorage.setItem("f1-mo2-isik", "1"); } catch (e) { return; }
    var o = D.createElement("div"), kapandi = false;
    o.className = "mo2-isik"; o.setAttribute("aria-hidden", "true");
    o.innerHTML = "<div class='mo2-cizgiler'><i></i><i></i><i></i><i></i></div>" +
      "<div class='mo2-isik-sira'><i></i><i></i><i></i><i></i><i></i></div>" +
      "<div class='mo2-yazi'><div class='mo2-marka'><b>F1</b><span>TAKİP</span></div>" +
      "<div class='mo2-kelime'><span>TAKİP ET</span><span>ANALİZ ET</span><span>YARIŞI YAŞA</span></div></div>";
    function kaldir() { if (o.parentNode) { o.parentNode.removeChild(o); } }
    function kapat() {                                                // dokunuş: hemen kapan
      if (kapandi) { return; } kapandi = true;
      o.classList.add("mo2-isik-son");
      setTimeout(kaldir, 400);
    }
    o.addEventListener("click", kapat);
    o.addEventListener("animationend", function (e) { if (e.target === o && /^mo2-cik/.test(e.animationName)) { kaldir(); } });
    D.body.appendChild(o);
    setTimeout(kaldir, INTRO_MS + 900);                               // güvenlik: animasyon olayı gelmezse ekran kapalı kalmaz
  }

  // ---------- olaylar ----------
  function ekle(n) {
    if (n.matches && n.matches(".sg-svg")) { grafik(n); } else if (n.querySelectorAll) { her(n.querySelectorAll(".sg-svg"), grafik); }
    if (n.matches && n.matches(".a34b-serit")) { serit(n); } else if (n.querySelectorAll) { her(n.querySelectorAll(".a34b-serit"), serit); }
  }
  function mo(liste) {
    if (D.hidden) { return; }
    for (var i = 0; i < liste.length; i++) {
      var r = liste[i];
      try {
        if (r.target && r.target.id === "pilot-govde") { pilotSirasi(); }
        for (var j = 0; j < r.addedNodes.length; j++) { if (r.addedNodes[j].nodeType === 1) { ekle(r.addedNodes[j]); } }
      } catch (e) { /* hareket katmanı hata verirse sessizce atlanır */ }
    }
  }
  // sekme geçişi: motion-v1.js f1-sekme işleyicisi MotionV2.sekme(sec.id) çağırır (sıra garantisi için), sonra pistleri MotionV2.pist'e devreder
  function sekme(secId) {
    try {
      var sec = D.getElementById(secId); if (!sec || sec.hidden) { return; }
      bolumuYenile(sec);
      if (reduced()) { return; }
      her(sec.querySelectorAll(".sg-svg"), grafik);
      her(sec.querySelectorAll("tbody"), function (tb) { if (tb.querySelector("tr[data-mo2-fark]")) { kaydir(tb); } });
    } catch (e) { /* önemsiz */ }
  }
  // uygulamaya geri dönülünce (arka plandan / PWA) görünen sekmenin pisti yeniden çizilir
  D.addEventListener("visibilitychange", function () {
    if (D.hidden || reduced()) { return; }
    try {
      var sec = D.querySelector("section[id^='sekme-']:not([hidden])"); if (!sec) { return; }
      bolumuYenile(sec);
      her(sec.querySelectorAll(PATH), pist);
    } catch (e) { /* önemsiz */ }
  });
  D.addEventListener("f1-takim-siralama", function (e) {
    try {
      var l = e.detail && e.detail.liste; if (!l) { return; }
      siraIsle("t", l.map(function (k) { return { id: k.Constructor && k.Constructor.constructorId, poz: k.position, puan: k.points }; }), D.getElementById("takim-govde"));
    } catch (x) { /* önemsiz */ }
  });

  function baslat() {
    if (W.MutationObserver) { new MutationObserver(mo).observe(D.body, { childList: true, subtree: true }); }
    isiklar();
  }
  if (D.readyState === "loading") { D.addEventListener("DOMContentLoaded", baslat); } else { baslat(); }
  W.MotionV2 = { pist: pist, sekme: sekme, giris: isiklar, _durum: S };
})();
