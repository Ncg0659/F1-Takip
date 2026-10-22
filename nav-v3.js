/* UI v3 — YENİ NAVİGASYON SHELL (FAZ 1). YALNIZ yönlendirme/vurgu katmanı.
   • Eski sekme-* / btn-* kimlikleri, sekmeAc() ve yan etkileri DEĞİŞMEZ: her düğme mevcut window.sekmeAc(ad)'ı çağırır.
   • Vurgu "f1-sekme" olayından (sekmeAc sonunda yayınlanır) türetilir → arama, ticker, takvim, Yarışı Kaçırdıysan vb. eski çağrılar da vurguyu günceller.
   • Yeni fetch / zamanlayıcı / polling YOK. Shell yalnız html[data-nav="v3"] bayrağıyla görünür (CSS). */
(function () {
  var ANA = { bugun: "bugun", hafta: "haftasonu", sprint: "haftasonu", gun: "haftasonu", yaris: "analiz", grafik: "analiz", profil: "kesfet", sampiyonlar: "kesfet", diger: "kesfet", sezon: "sezon" };
  var CTX = {
    haftasonu: [["hafta", "HAFTA"], ["sprint", "SPRINT"], ["gun", "GÜN"]],
    analiz: [["yaris", "YARIŞ"], ["grafik", "GRAFİK"]],
    kesfet: [["profil", "PİLOT & PİST"], ["sampiyonlar", "ŞAMPİYONLAR"], ["diger", "DİĞER SERİLER"], ["ogren", "ÖĞREN"]]
  };
  var S = { aktif: null, imza: null };
  function $(id) { return document.getElementById(id); }
  function git(ad) { if (typeof window.sekmeAc === "function") { window.sekmeAc(ad); } }
  function sprintVar() { var b = $("btn-sprint"); return !!b && !b.hidden; }

  function haftaSonuHedef() {            // mevcut son alt sekme hafızası; Analiz'e ait "yaris" ya da gizli Sprint → hafta
    var son = "hafta";
    try { if (window.YarisHaftasi && YarisHaftasi.sonAltSekme) { son = YarisHaftasi.sonAltSekme(); } } catch (e) {}
    if (son !== "hafta" && son !== "sprint" && son !== "gun") { son = "hafta"; }
    if (son === "sprint" && !sprintVar()) { son = "hafta"; }
    return son;
  }
  function bugunHedef() {                // güvenli yönlendirici (yeni ekran yok): gun | hafta | sezon
    var h = "sezon";
    try { if (typeof window.BugunHedef === "function") { h = window.BugunHedef() || "sezon"; } } catch (e) {}
    return (h === "gun" || h === "hafta") ? h : "sezon";
  }

  function ctxYaz() {
    var kap = $("ctx-v3"); if (!kap) { return; }
    var ana = S.aktif ? ANA[S.aktif] : null;
    var liste = (ana && CTX[ana] ? CTX[ana] : []).filter(function (x) { return x[0] !== "sprint" || sprintVar(); });
    var imza = ana + "|" + liste.map(function (x) { return x[0]; }).join(",") + "|" + S.aktif;
    if (S.imza === imza) { return; }
    S.imza = imza;
    kap.hidden = !liste.length;
    kap.innerHTML = liste.map(function (x) {
      var a = x[0] === S.aktif;
      return "<button type='button' class='cx-d' id='ctx-" + x[0] + "' data-ctx='" + x[0] + "'" + (a ? " aria-current='page'" : "") + ">" + x[1] + "</button>";
    }).join("");
  }
  function render(ad) {
    S.aktif = ad;
    var ana = ANA[ad] || null;
    ["bugun", "haftasonu", "sezon", "analiz", "kesfet"].forEach(function (k) {
      var b = $("nav-" + k); if (!b) { return; }
      if (k === ana) { b.setAttribute("aria-current", "page"); } else { b.removeAttribute("aria-current"); }
    });
    ctxYaz();
  }
  function gorunen() {
    var b = Object.keys(ANA);
    for (var i = 0; i < b.length; i++) { var e = $("sekme-" + b[i]); if (e && !e.hidden) { return b[i]; } }
    return null;
  }

  document.addEventListener("f1-sekme", function (e) { render(e.detail); });
  document.addEventListener("click", function (e) {
    var n = e.target.closest && e.target.closest("#nav-v3 [data-nav]");
    if (n) {
      var k = n.getAttribute("data-nav");
      if (k === "bugun") { git("bugun"); }
      else if (k === "haftasonu") { git(haftaSonuHedef()); }
      else if (k === "sezon") { git("sezon"); }
      else if (k === "analiz") { git("yaris"); }
      else if (k === "kesfet") { git("profil"); }
      return;
    }
    var c = e.target.closest && e.target.closest("#ctx-v3 [data-ctx]");
    if (!c) { return; }
    var h = c.getAttribute("data-ctx");
    if (h === "ogren") { try { if (window.Ogren && Ogren.sozluk) { Ogren.sozluk(); } } catch (x) {} return; }   // ekran değiştirmez: mevcut sözlük paneli
    git(h);
  });

  // ================= FAZ 2: top bar yerleşimi (yalnız bayrak açıkken; aynı elementler taşınır, kopya YOK) =================
  var Y = { ilk: {}, kuruldu: false, ac: null };
  function v3() { return document.documentElement.getAttribute("data-nav") === "v3"; }
  function mk(tag, id, cls, html) { var e = document.createElement(tag); if (id) { e.id = id; } if (cls) { e.className = cls; } if (html) { e.innerHTML = html; } return e; }
  function kur() {
    var bar = $("rc-bar"), sag = bar && bar.querySelector(".rc-sag"); if (!sag) { return false; }
    if (Y.kuruldu) { return true; }
    var ng = mk("button", "nv-ogren", "nv-tb", "<b class='nv-q' aria-hidden='true'>?</b><span class='nv-tb-ad'>Öğren</span>");
    ng.type = "button"; ng.setAttribute("aria-haspopup", "true"); ng.setAttribute("aria-expanded", "false"); ng.setAttribute("aria-controls", "nv-ogren-pop"); ng.title = "Öğren: açıklama modu ve sözlük";
    var nf = mk("button", "nv-fav", "nv-tb", "<span class='nv-yildiz' aria-hidden='true'>★</span><span class='nv-tb-ad' id='nv-fav-ad'>Favori seç</span>");
    nf.type = "button"; nf.setAttribute("aria-haspopup", "true"); nf.setAttribute("aria-expanded", "false"); nf.setAttribute("aria-controls", "nv-fav-pop"); nf.title = "Favori pilot";
    sag.appendChild(ng); sag.appendChild(nf);
    var po = mk("div", "nv-ogren-pop", "nv-pop", "<p class='nv-pop-b'>ÖĞREN</p>"); po.hidden = true; po.setAttribute("role", "group"); po.setAttribute("aria-label", "Öğren");
    var pf = mk("div", "nv-fav-pop", "nv-pop", "<p class='nv-pop-b'>FAVORİ PİLOT</p>"); pf.hidden = true; pf.setAttribute("role", "group"); pf.setAttribute("aria-label", "Favori pilot");
    bar.appendChild(po); bar.appendChild(pf);
    var sec = $("favori-sec");
    if (sec) {
      sec.addEventListener("change", function () { favYaz(); kapat(); });
      if (window.MutationObserver) { new MutationObserver(favYaz).observe(sec, { childList: true }); }
    }
    if (window.MutationObserver) { new MutationObserver(function () { if (v3()) { uygula(); } }).observe(bar, { childList: true, subtree: true }); }   // .a2-ustbar / #btn-ara geç eklenirse; taşıma + yazım idempotent → döngü yok
    Y.kuruldu = true; return true;
  }
  function favYaz() {
    var s = $("favori-sec"), ad = $("nv-fav-ad"), b = $("nv-fav"); if (!s || !ad || !b) { return; }
    var t = "Favori seç", tam = "Favori pilot seç";
    if (s.value) {
      var k = null; try { k = sezonPilotlar.filter(function (x) { return x.Driver.driverId === s.value; })[0]; } catch (e) {}
      var o = s.options[s.selectedIndex], nm = o ? o.text : "";
      t = (k && k.Driver.code) || (nm.split(" ").pop() || "").slice(0, 3).toUpperCase() || "★"; tam = "Favori pilot: " + nm;
    }
    if (ad.textContent !== t) { ad.textContent = t; } b.classList.toggle("nv-on", !!s.value); b.title = tam; b.setAttribute("aria-label", tam);
  }
  function tasi(el, hedef, once) {                 // idempotent: yalnız yerinde değilse taşı; ilk ebeveyn/kardeş geri dönüş için saklanır
    if (!el || !hedef || el.parentNode === hedef) { return; }
    if (!Y.ilk[el.id || el.className]) { Y.ilk[el.id || el.className] = { p: el.parentNode, n: el.nextSibling }; }
    if (once) { hedef.insertBefore(el, once); } else { hedef.appendChild(el); }
  }
  function geri(el) { var o = el && Y.ilk[el.id || el.className]; if (o && el.parentNode !== o.p) { o.p.insertBefore(el, o.n && o.n.parentNode === o.p ? o.n : null); } }
  function uygula() {
    if (!v3()) { geriAl(); return; }
    if (!kur()) { return; }
    var sag = $("rc-bar").querySelector(".rc-sag");
    tasi($("btn-tema"), sag, sag.querySelector(".rc-nokta"));
    tasi($("favori-sec"), $("nv-fav-pop"));
    var ub = document.querySelector(".a2-ustbar"); if (ub) { tasi(ub, $("nv-ogren-pop")); }
    favYaz();
  }
  function geriAl() {
    kapat();
    geri($("btn-tema")); geri($("favori-sec")); geri(document.querySelector(".a2-ustbar"));
  }
  function kapat() {
    ["ogren", "fav"].forEach(function (k) { var p = $("nv-" + k + "-pop"), b = $("nv-" + k); if (p && !p.hidden) { p.hidden = true; } if (b) { b.setAttribute("aria-expanded", "false"); } });
    Y.ac = null;
  }
  function ac(k) {
    kapat(); var p = $("nv-" + k + "-pop"), b = $("nv-" + k); if (!p || !b) { return false; }
    p.hidden = false; b.setAttribute("aria-expanded", "true"); Y.ac = k; return true;
  }
  function favAc() {                               // arama "Favori pilot seç" → panel açılır, select odaklanır (yalnız v3)
    if (!v3()) { return false; }
    uygula(); if (!ac("fav")) { return false; }
    var f = function () { var s = $("favori-sec"); if (s && !$("nv-fav-pop").hidden) { try { s.focus(); } catch (e) {} } };
    f(); setTimeout(f, 60);                        // tek seferlik: arama penceresinin kapanış olayı odağı açan düğmeye geri verir; ondan sonra select'e odaklan (polling değil)
    return true;
  }
  document.addEventListener("click", function (e) {
    var t = e.target;
    var bt = t.closest && t.closest("#nv-ogren, #nv-fav");
    if (bt) { var k = bt.id === "nv-ogren" ? "ogren" : "fav"; if (Y.ac === k) { kapat(); } else { ac(k); if (k === "fav") { var s = $("favori-sec"); if (s) { try { s.focus(); } catch (x) {} } } } return; }
    if (t.closest && t.closest("#a2-sozluk-dugme")) { kapat(); return; }
    if (Y.ac && !(t.closest && t.closest(".nv-pop"))) { kapat(); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && Y.ac) { var b = $("nv-" + Y.ac); kapat(); if (b) { try { b.focus(); } catch (x) {} } }
  });

  function hazir() {
    var a = gorunen(); if (a) { render(a); }
    var sb = $("btn-sprint");
    if (sb && window.MutationObserver) { new MutationObserver(function () { S.imza = null; ctxYaz(); }).observe(sb, { attributes: true, attributeFilter: ["hidden"] }); }   // Sprint görünürlüğü (ctx kutusu gözlenen alanın dışında → döngü yok)
    if (window.MutationObserver) {
      new MutationObserver(function () { if (v3()) { uygula(); } else if (Y.kuruldu) { geriAl(); } }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-nav"] });   // bayrak çalışma anında değişirse (test/QA) yerleşim uyar
      new MutationObserver(function () { if (v3()) { uygula(); } }).observe(document.body, { childList: true });                                   // #rc-bar geç eklenirse
    }
    uygula();
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", hazir); } else { hazir(); }
  window.NavV3 = { render: render, favAc: favAc, uygula: uygula, _durum: S };
})();
