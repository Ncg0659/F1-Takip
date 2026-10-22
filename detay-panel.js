/* A2.3 — Y1: yeniden kullanılabilir Detay Paneli altyapısı. Veri çekmez, hiçbir mevcut sisteme dokunmaz.
   Masaüstünde sağ panel, mobilde alttan açılan panel (CSS: detay-panel.css). Yerleşik <dialog> (showModal) kullanır:
   odak tuzağı, Esc ve arka plan engeli tarayıcıdan gelir.

   Kullanım:
     DetayPanel.ac({ id, baslik, alt, lang, yukle: async () => içerik, donus: () => odak dönülecek öğe })
   `yukle` (tembel): panel hemen açılır, içerik gelene kadar "Yükleniyor…" görünür. Hata olursa panel AÇIK kalır,
   hata mesajı + "Tekrar dene" düğmesi gösterilir.
   İçerik biçimleri (hepsi varsayılan olarak kaçışlanır):
     - string                → paragraf
     - DOM Node              → olduğu gibi eklenir
     - { bolumler: [ {baslik, metin, satirlar:[[etiket, deger],…], tablo:{baslik:[…], satirlar:[[hücre,…],…]},
                      tembel: async () => içerik (bölüme özel yükleme + tekrar dene), eylemler:[{ad, tikla}|{ad, ac:{…}}]} ] }
     - Hücre/değer güvenli HTML ise { html: "…" } biçiminde verilir (yalnızca çağıran koddan; kullanıcı verisi için KULLANILMAZ).
   Yığın: en çok 3 seviye (SEVIYE_MAX). Dolu yığında yeni açılış en üst seviyenin yerini alır.
   Esc: bir seviye geri (ilk seviyede kapatır). Panel dışına tıklama: tüm yığını kapatır. Kapanınca odak açan öğeye döner. */
(function () {
  var SEVIYE_MAX = 3;
  var yigin = [];          // { id, baslik, alt, lang, yukle, durum, icerik, hata }
  var acan = null, donusFn = null, dlg = null, belirtec = 0;

  function esc(x) { return window.F1UI ? F1UI.esc(x) : String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }
  function metinHtml(s) { try { if (window.Ogren && Ogren.isle) { return Ogren.isle(String(s)); } } catch (e) { /* düz metin */ } return esc(s); }
  function el(tag, sinif, html) { var e = document.createElement(tag); if (sinif) { e.className = sinif; } if (html != null) { e.innerHTML = html; } return e; }

  function kur() {
    if (dlg) { return dlg; }
    dlg = document.createElement("dialog");
    dlg.id = "dp-panel"; dlg.className = "dp-panel";
    dlg.setAttribute("aria-labelledby", "dp-baslik");
    dlg.innerHTML = "<div class='dp-ic'><header class='dp-bas'>" +
      "<button type='button' class='dp-geri' data-dp='geri' aria-label='Geri' hidden>‹</button>" +
      "<div class='dp-baslik-kutu'><div class='dp-yol' id='dp-yol' hidden></div><h2 id='dp-baslik' class='dp-baslik' tabindex='-1'></h2><div class='dp-alt' id='dp-alt'></div></div>" +
      "<button type='button' class='dp-kapat' data-dp='kapat' aria-label='Kapat'>×</button></header>" +
      "<div class='dp-govde' id='dp-govde' aria-live='polite'></div></div>";
    document.body.appendChild(dlg);
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg) { kapat(); return; }                                  // arka plan (::backdrop) → hepsini kapat
      var b = e.target.closest ? e.target.closest("[data-dp]") : null;
      if (!b) { return; }
      var a = b.getAttribute("data-dp");
      if (a === "kapat") { kapat(); }
      else if (a === "geri") { geri(); }
      else if (a === "tekrar") { tekrar(b); }
    });
    dlg.addEventListener("cancel", function (e) { e.preventDefault(); geri(); });   // Esc: bir seviye geri / ilkinde kapat
    dlg.addEventListener("close", function () { if (yigin.length) { temizle(); } });
    return dlg;
  }

  // ---- içerik üretimi ----
  function tabloHtml(t) {
    var h = "<div class='dp-tablo-kap'><table class='dp-tablo'><thead><tr>" + (t.baslik || []).map(function (b) { return "<th>" + esc(b) + "</th>"; }).join("") + "</tr></thead><tbody>";
    (t.satirlar || []).forEach(function (s) { h += "<tr>" + s.map(function (c) { return "<td>" + (c && typeof c === "object" && "html" in c ? c.html : esc(c)) + "</td>"; }).join("") + "</tr>"; });
    return h + "</tbody></table></div>";
  }
  function degerHtml(v) { return v && typeof v === "object" && "html" in v ? v.html : metinHtml(v); }

  function icerikKur(kap, ic) {
    if (ic == null) { return; }
    if (typeof ic === "string") { kap.appendChild(el("p", "dp-metin", metinHtml(ic))); return; }
    if (ic.nodeType) { kap.appendChild(ic); return; }
    if (ic.bolumler) { ic.bolumler.forEach(function (b) { kap.appendChild(bolumKur(b)); }); } else { kap.appendChild(bolumKur(ic)); }   // tek bölüm kısayolu
  }

  function bolumKur(b) {
    var s = el("section", "dp-bolum");
    if (b.baslik) { s.appendChild(el("h3", "dp-bolum-baslik", esc(b.baslik))); }
    if (b.metin) { s.appendChild(el("p", "dp-metin", metinHtml(b.metin))); }
    if (b.satirlar) { s.appendChild(el("dl", "dp-satirlar", b.satirlar.map(function (r) { return "<div><dt>" + esc(r[0]) + "</dt><dd>" + degerHtml(r[1]) + "</dd></div>"; }).join(""))); }
    if (b.tablo) { s.insertAdjacentHTML("beforeend", tabloHtml(b.tablo)); }
    if (b.eylemler) {
      var ey = el("div", "dp-eylemler");
      b.eylemler.forEach(function (e) {
        var d = el("button", "dp-eylem", esc(e.ad)); d.type = "button";
        d.addEventListener("click", function () { if (e.ac) { ac(e.ac); } else if (typeof e.tikla === "function") { try { e.tikla(); } catch (x) { /* önemsiz */ } } });
        ey.appendChild(d);
      });
      s.appendChild(ey);
    }
    if (typeof b.tembel === "function") { var kut = el("div", "dp-tembel"); s.appendChild(kut); tembelYukle(kut, b.tembel); }
    return s;
  }

  // Bölüme özel tembel yükleme: yükleniyor → içerik | hata + "Tekrar dene" (panel kapanmaz)
  function tembelYukle(kut, fn) {
    var t = ++belirtec; kut._t = t; kut._fn = fn;
    kut.setAttribute("aria-busy", "true");
    kut.innerHTML = "<p class='dp-yuk'>Yükleniyor…</p>";
    Promise.resolve().then(fn).then(function (ic) {
      if (kut._t !== t) { return; }
      kut.innerHTML = ""; kut.removeAttribute("aria-busy"); icerikKur(kut, ic); tara(kut);
    }, function () {
      if (kut._t !== t) { return; }
      kut.removeAttribute("aria-busy");
      kut.innerHTML = "<p class='dp-hata' role='alert'>Bu bölüm şu anda yüklenemedi.</p><button type='button' class='dp-eylem' data-dp='tekrar'>Tekrar dene</button>";
    });
  }
  function tekrar(b) {
    var kut = b.closest(".dp-tembel");
    if (kut && kut._fn) { tembelYukle(kut, kut._fn); return; }
    var f = yigin[yigin.length - 1]; if (f) { yukleFrame(f); }
  }
  function tara(kok) { try { if (window.Ogren && Ogren.tara) { Ogren.tara(kok); } } catch (e) { /* ⓘ olmadan devam */ } }

  // ---- seviye çizimi ----
  function ciz(odak) {
    var f = yigin[yigin.length - 1]; if (!f) { return; }
    var d = kur();
    var bas = d.querySelector("#dp-baslik");
    bas.textContent = f.baslik || ""; if (f.lang) { bas.setAttribute("lang", f.lang); } else { bas.removeAttribute("lang"); }
    d.querySelector("#dp-alt").textContent = f.alt || "";
    var yol = d.querySelector("#dp-yol");
    if (yigin.length > 1) { yol.hidden = false; yol.textContent = yigin.map(function (x) { return x.baslik; }).slice(0, -1).join(" › "); } else { yol.hidden = true; yol.textContent = ""; }
    d.querySelector(".dp-geri").hidden = yigin.length < 2;
    d.setAttribute("data-seviye", String(yigin.length));
    var g = d.querySelector("#dp-govde"); g.innerHTML = ""; g.scrollTop = 0;
    if (f.durum === "hazir") { g.appendChild(f.icerik); tara(f.icerik); }
    else if (f.durum === "hata") { g.innerHTML = "<p class='dp-hata' role='alert'>İçerik şu anda yüklenemedi.</p><button type='button' class='dp-eylem' data-dp='tekrar'>Tekrar dene</button>"; }
    else { g.innerHTML = "<p class='dp-yuk'>Yükleniyor…</p>"; }
    g.setAttribute("aria-busy", f.durum === "yukleniyor" ? "true" : "false");
    if (odak !== false) { bas.focus({ preventScroll: true }); }
  }

  function yukleFrame(f) {
    var t = ++belirtec; f.t = t; f.durum = "yukleniyor"; if (yigin[yigin.length - 1] === f) { ciz(false); }
    Promise.resolve().then(f.yukle || function () { return null; }).then(function (ic) {
      if (f.t !== t) { return; }
      var kap = el("div", "dp-icerik"); icerikKur(kap, ic);
      f.icerik = kap; f.durum = "hazir";
      if (yigin[yigin.length - 1] === f) { ciz(false); }
    }, function () {
      if (f.t !== t) { return; }
      f.durum = "hata"; f.icerik = null;
      if (yigin[yigin.length - 1] === f) { ciz(false); }
    });
  }

  // ---- genel ----
  function ac(o) {
    if (!o || typeof document.createElement("dialog").showModal !== "function") { return false; }
    var d = kur();
    var ust = yigin[yigin.length - 1];
    if (ust && o.id && ust.id === o.id) { return true; }                       // aynı içerik zaten açık
    var f = { id: o.id || "", baslik: o.baslik || "", alt: o.alt || "", lang: o.lang || "", yukle: o.yukle, durum: "yukleniyor", icerik: null };
    if (!yigin.length) {
      acan = document.activeElement; donusFn = typeof o.donus === "function" ? o.donus : null;
      yigin.push(f);
      document.documentElement.classList.add("dp-kilit");
      try { d.showModal(); } catch (e) { yigin = []; document.documentElement.classList.remove("dp-kilit"); return false; }
    } else if (yigin.length >= SEVIYE_MAX) { yigin[yigin.length - 1] = f; }      // en çok 3 seviye: üsttekinin yerini alır
    else { yigin.push(f); }
    ciz(); yukleFrame(f);
    return true;
  }

  function geri() {
    if (yigin.length > 1) { yigin.pop(); belirtec++; ciz(); var f = yigin[yigin.length - 1]; if (f.durum === "yukleniyor" || f.durum === "hata") { yukleFrame(f); } return; }
    kapat();
  }

  function temizle() {
    yigin = []; belirtec++;
    document.documentElement.classList.remove("dp-kilit");
    var hedef = null;
    try { if (acan && acan.isConnected) { hedef = acan; } else if (donusFn) { hedef = donusFn(); } } catch (e) { hedef = null; }
    acan = null; donusFn = null;
    if (hedef && hedef.focus) { try { hedef.focus({ preventScroll: true }); } catch (e) { /* önemsiz */ } }
  }

  function kapat() {
    if (!dlg || !yigin.length) { return; }
    var d = dlg;
    try { if (d.open) { d.close(); } } catch (e) { /* önemsiz */ }
    temizle();      // odak dönüşü close()'dan SONRA: tarayıcı kendi odak geri yüklemesini önce yapar (açan öğe silinmişse body'ye düşer)
  }

  window.DetayPanel = {
    ac: ac, geri: geri, kapat: kapat,
    derinlik: function () { return yigin.length; },
    acikMi: function () { return !!(dlg && dlg.open); },
    SEVIYE_MAX: SEVIYE_MAX
  };
})();
