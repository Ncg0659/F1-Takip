/* A2.2 — "İzlerken öğren" arayüzü: ⓘ ipuçları, "Bu ne demek?" sözlüğü, lastik rehberi, açıklama modu.
   İçerik: icerik-sozluk.js ve icerik-lastik.js (yalnızca veri). Bu dosya içerik bilmez; terim eklemek buraya dokunmayı gerektirmez.
   Dokunmaz: Yarış Haftası, Sprint (taranmaz), OpenF1, Race Feed, Jolpica, mevcut render fonksiyonları. Hiçbir ağ çağrısı yapmaz.
   Açıklama modu (f1-ogren-v1-mod; varsayılan "sadece"): "acik" = ⓘ + "Ne oldu?" yorumları · "sadece" = yalnızca ⓘ · "kapali" = ⓘ ve yorum gizli (sözlük düğmesi kalır).
   Mod, <html data-a2-ogren="..."> özniteliği ve CSS ile uygulanır; yorum motoru koduna dokunulmaz.
   Eksik içerik/dosya durumunda sessizce çalışır (düz metin). */
(function () {
  var C = window.ICERIK || {};
  var SZ = C.sozluk || { terimler: {}, kategoriler: [], baslikEsler: {}, yorumEsler: [] };
  var LS = C.lastik || null;
  var ANAHTAR_MOD = "f1-ogren-v1-mod", ANAHTAR_GORULEN = "f1-ogren-v1-gorulen";
  var MODLAR = [["acik", "Açık"], ["sadece", "Sadece ⓘ"], ["kapali", "Kapalı"]];
  var TARANAN = ["sekme-yaris", "sekme-gun", "sekme-sezon", "sekme-profil"]; // Yarış Haftası ve Sprint BİLİNÇLİ olarak taranmaz (A1 sürekli yeniden çizer)
  var LASTIK_TERIMLERI = { "lastik-bilesikleri": 1, "ara-lastik": 1, "yagmur-lastigi": 1, "stint": 1, "pit-stop": 1, "lastik-asinmasi": 1, "durus-sayisi": 1, "isinma": 1 };
  var gorulen = null, yigin = [], acanEl = null, dlg = null, planli = false;

  function esc(x) { return window.F1UI && F1UI.esc ? F1UI.esc(x) : String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function terim(k) { return Object.prototype.hasOwnProperty.call(SZ.terimler, k) ? SZ.terimler[k] : null; }
  function tl(s) { return String(s).toLocaleLowerCase("tr-TR"); }

  // ---- depolama (hepsi try/catch) ----
  function modOku() { try { var m = localStorage.getItem(ANAHTAR_MOD); return MODLAR.some(function (x) { return x[0] === m; }) ? m : "sadece"; } catch (e) { return "sadece"; } }
  function modYaz(m) {
    try { localStorage.setItem(ANAHTAR_MOD, m); } catch (e) { /* önemsiz */ }
    modUygula(m);
  }
  function modUygula(m) {
    document.documentElement.setAttribute("data-a2-ogren", m);
    var e = document.getElementById("a2-mod-dugme"); if (e) { e.textContent = "Açıklama: " + modAd(m); }
    document.querySelectorAll(".a2-mod-sec").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-mod") === m)); b.className = "a2-mod-sec" + (b.getAttribute("data-mod") === m ? " aktif" : ""); });
  }
  function modAd(m) { var x = MODLAR.filter(function (y) { return y[0] === m; })[0]; return x ? x[1] : m; }
  function gorulenOku() {
    if (gorulen) { return gorulen; }
    try { var a = JSON.parse(localStorage.getItem(ANAHTAR_GORULEN)); gorulen = Array.isArray(a) ? a : []; } catch (e) { gorulen = []; }
    return gorulen;
  }
  function gorulduYaz(k) {
    var g = gorulenOku(); if (g.indexOf(k) >= 0) { return; }
    g.push(k); try { localStorage.setItem(ANAHTAR_GORULEN, JSON.stringify(g)); } catch (e) { /* önemsiz */ }
    document.querySelectorAll(".a2-i[data-terim='" + k + "']").forEach(function (el) { el.classList.add("a2-gorulen"); });
  }

  // ---- metin işleme: yalnızca [[terim]] ve **kalın**; her şey önce kaçışlanır ----
  function isle(metin) {
    return esc(metin).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\[\[([a-z0-9-]+)\]\]/g, function (_, k) {
      var t = terim(k);
      return t ? "<button type='button' class='a2-baglanti' data-terim='" + k + "'>" + esc(t.ad) + "</button>" : esc(k);
    });
  }

  // ---- ⓘ ----
  function ikonHtml(k) {
    var t = terim(k); if (!t) { return null; }
    var b = document.createElement("button");
    b.type = "button"; b.className = "a2-i" + (gorulenOku().indexOf(k) >= 0 ? " a2-gorulen" : "");
    b.setAttribute("data-terim", k); b.setAttribute("aria-haspopup", "dialog");
    b.setAttribute("aria-label", t.ad + " nedir?"); b.title = t.ad + " nedir?";
    return b;
  }
  function ekle(hedef, k) {
    if (!hedef || hedef.querySelector(":scope > .a2-i[data-terim='" + k + "']")) { return; }
    var b = ikonHtml(k); if (b) { hedef.appendChild(b); }
  }

  function tara(kok) {
    if (!kok) { return; }
    var thler = kok.querySelectorAll("th");
    for (var i = 0; i < thler.length; i++) {
      var th = thler[i], anahtar = th.getAttribute("data-a2k");
      if (anahtar === null) {
        var m = SZ.baslikEsler[th.textContent.trim()];
        anahtar = m && terim(m) ? m : "";
        th.setAttribute("data-a2k", anahtar);
      }
      if (anahtar) { ekle(th, anahtar); }
    }
  }

  function kartEtiketleri() {
    var kok = document.getElementById("a2-takvim"); if (!kok) { return; }
    var harita = { "PODYUM": "podyum", "POLE": "pole", "SPRINT KAZANANI": "sprint" };
    kok.querySelectorAll(".st-et").forEach(function (el) {
      var t = Array.prototype.filter.call(el.childNodes, function (n) { return n.nodeType === 3; }).map(function (n) { return n.nodeValue; }).join("").trim();
      var k = harita[t];
      if (k && terim(k)) { ekle(el, k); }
    });
  }

  function yorumIsaretle() {
    document.querySelectorAll(".ym-liste").forEach(function (kutu) {
      var yapildi = {};
      kutu.querySelectorAll(".a2-i").forEach(function (e) { yapildi[e.getAttribute("data-terim")] = true; });
      SZ.yorumEsler.forEach(function (es) {
        var kalip = es[0], k = es[1];
        if (yapildi[k] || !terim(k)) { return; }
        var yurut = document.createTreeWalker(kutu, NodeFilter.SHOW_TEXT, null), dugum;
        while ((dugum = yurut.nextNode())) {
          var i = tl(dugum.nodeValue).indexOf(kalip);
          if (i < 0) { continue; }
          var son = dugum.splitText(i + kalip.length);   // kalıp sonuna kadar kesilir
          var b = ikonHtml(k); if (b) { son.parentNode.insertBefore(b, son); yapildi[k] = true; }
          break;
        }
      });
    });
  }

  function lastikSatirlari() {
    var sat = document.querySelector("[data-lastik-rehberi]");
    if (sat && !sat.firstChild) { sat.className = "a2-lastik-satir"; sat.innerHTML = "<button type='button' class='a2-baglanti a2-lastik' data-lastik=''>" + (window.F1UI ? F1UI.ikon("tyre", 14) : "") + "Lastik rehberi</button>"; }
    var yag = document.querySelector("[data-lastik-yagmur]");
    if (yag) {
      if (!yag.firstChild) { yag.className = "a2-lastik-satir"; yag.innerHTML = "<button type='button' class='a2-baglanti a2-lastik' data-lastik='islak'>" + (window.F1UI ? F1UI.ikon("rain", 14) : "") + "Yağmur riskinde hangi lastik?</button>"; }
      yag.hidden = !document.querySelector("#yk-durumlar .dr.yagmur");   // mevcut RAIN RISK rozeti görünürken (yalnızca okunur)
    }
  }

  function taraHepsi() {
    planli = false;
    try {
      TARANAN.forEach(function (id) { tara(document.getElementById(id)); });
      kartEtiketleri(); yorumIsaretle(); lastikSatirlari();
    } catch (e) { /* sessiz: ekran etkilenmez */ }
  }
  function planla() { if (!planli) { planli = true; Promise.resolve().then(taraHepsi); } }

  // ---- açılır pencere (tek <dialog>; terim / sözlük / lastik görünümleri) ----
  function pencere() {
    if (dlg) { return dlg; }
    dlg = document.createElement("dialog");
    dlg.id = "a2-dlg"; dlg.className = "a2-dlg"; dlg.setAttribute("aria-labelledby", "a2-dlg-baslik");
    dlg.innerHTML = "<div class='a2-dlg-ust'><button type='button' class='a2-geri' hidden>‹ Geri</button><h2 id='a2-dlg-baslik'></h2><button type='button' class='a2-kapat' aria-label='Kapat'>✕</button></div><div class='a2-dlg-govde' tabindex='-1'></div>";
    document.body.appendChild(dlg);
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg) { kapat(); return; }
      var b = e.target.closest ? e.target.closest("button") : null; if (!b) { return; }
      if (b.classList.contains("a2-kapat")) { kapat(); }
      else if (b.classList.contains("a2-geri")) { geri(); }
      else if (b.hasAttribute("data-terim")) { goster({ t: "terim", k: b.getAttribute("data-terim") }); }
      else if (b.hasAttribute("data-mod")) { modYaz(b.getAttribute("data-mod")); }
      else if (b.hasAttribute("data-lastik")) { goster({ t: "lastik", k: b.getAttribute("data-lastik") }); }
      else if (b.classList.contains("a2-daha")) { var u = dlg.querySelector(".a2-uzun"); if (u) { u.hidden = !u.hidden; b.textContent = u.hidden ? "Daha fazla" : "Daha az"; b.setAttribute("aria-expanded", String(!u.hidden)); } }
      else if (b.hasAttribute("data-sozluk")) { goster({ t: "sozluk" }); }
    });
    dlg.addEventListener("close", function () { yigin = []; if (acanEl && document.contains(acanEl)) { try { acanEl.focus(); } catch (e) { /* önemsiz */ } } acanEl = null; });
    return dlg;
  }

  function terimGorunum(k) {
    var t = terim(k);
    if (!t) { return { baslik: "Terim bulunamadı", html: "<p>Bu terim sözlükte yok.</p>" }; }
    gorulduYaz(k);
    var kat = (SZ.kategoriler.filter(function (x) { return x[0] === t.kat; })[0] || [0, ""])[1];
    var h = "<p class='a2-kisa'>" + isle(t.kisa) + "</p>";
    if (t.neden) { h += "<p class='a2-neden'><b>Neden önemli?</b> " + isle(t.neden) + "</p>"; }
    if (t.uzun) { h += "<button type='button' class='a2-daha' aria-expanded='false'>Daha fazla</button><p class='a2-uzun' hidden>" + isle(t.uzun) + "</p>"; }
    if (LASTIK_TERIMLERI[k] && LS) { h += "<p><button type='button' class='a2-baglanti a2-lastik' data-lastik=''>Lastik rehberini aç</button></p>"; }
    if (t.iliskili && t.iliskili.length) {
      var chips = t.iliskili.filter(terim).map(function (r) { return "<button type='button' class='a2-chip' data-terim='" + r + "'>" + esc(terim(r).ad) + "</button>"; }).join("");
      if (chips) { h += "<div class='a2-iliskili'><span class='a2-et'>İlişkili terimler</span><div>" + chips + "</div></div>"; }
    }
    var meta = [esc(kat)];
    if (t.en && String(t.en).toLowerCase() !== String(t.ad).toLowerCase()) { meta.unshift("<span class='a2-en'>" + esc(t.en) + "</span>"); }
    if (t.donem) { meta.push("<span class='a2-donem'>" + esc(t.donem) + " sezonu</span>"); }
    if (t.kaynak) {
      var alan = ""; try { alan = new URL(t.kaynak).hostname.replace(/^www\./, ""); } catch (e) { alan = "kaynak"; }
      meta.push("Kaynak: <a href='" + esc(t.kaynak) + "' target='_blank' rel='noopener noreferrer'>" + esc(alan) + "</a>" + (t.dogrulama === "ikincil" ? " (ikincil kaynak)" : ""));
    }
    h += "<p class='a2-meta'>" + meta.join(" · ") + "</p>";
    return { baslik: t.ad, html: h };
  }

  function sozlukGorunum(sorgu) {
    var q = tl(sorgu || "");
    var modlar = MODLAR.map(function (m) { return "<button type='button' class='a2-mod-sec' data-mod='" + m[0] + "' aria-pressed='false'>" + esc(m[1]) + "</button>"; }).join("");
    var h = "<div class='a2-mod'><span class='a2-et'>Açıklama modu</span><div role='group' aria-label='Açıklama modu'>" + modlar + "</div>" +
            "<p class='a2-mod-not'><b>Açık:</b> ⓘ işaretleri ve “Ne oldu?” yorumları. <b>Sadece ⓘ:</b> yalnızca ⓘ işaretleri. <b>Kapalı:</b> hiçbiri; bu düğme yine de çalışır.</p></div>" +
            "<input type='search' class='a2-ara' placeholder='Terim ara (örn. pole, undercut)' aria-label='Terim ara' value='" + esc(sorgu || "") + "'>";
    var say = 0;
    SZ.kategoriler.forEach(function (kt) {
      var liste = Object.keys(SZ.terimler).filter(function (k) {
        var t = SZ.terimler[k]; return t.kat === kt[0] && (!q || tl(t.ad).indexOf(q) >= 0 || tl(t.kisa).indexOf(q) >= 0);
      });
      if (!liste.length) { return; }
      say += liste.length;
      h += "<div class='a2-kat'><span class='a2-et'>" + esc(kt[1]) + "</span><div>" + liste.map(function (k) { return "<button type='button' class='a2-chip' data-terim='" + k + "'>" + esc(SZ.terimler[k].ad) + "</button>"; }).join("") + "</div></div>";
    });
    if (!say) { h += "<p class='a2-bos'>Bu aramayla eşleşen terim yok.</p>"; }
    if (LS) { h += "<p><button type='button' class='a2-baglanti a2-lastik' data-lastik=''>Lastik rehberini aç</button></p>"; }
    return { baslik: "Bu ne demek?", html: h };
  }

  function lastikGorunum() {
    if (!LS) { return { baslik: "Lastik rehberi", html: "<p>Lastik rehberi içeriği yüklenemedi.</p>" }; }
    var h = LS.kartlar.map(function (k) {
      var g = "";
      if (k.gorsel) {
        g = "<div class='a2-bilesikler'>" + k.gorsel.map(function (b) {
          function cubuk(ad, n) { var s = ""; for (var i = 1; i <= 3; i++) { s += "<i class='" + (i <= n ? "dolu" : "") + "'></i>"; } return "<span class='a2-cubuk'><small>" + ad + "</small>" + s + "</span>"; }
          return "<div class='a2-bilesik'><span class='a2-halka' style='--hc:" + esc(b.renk) + "'></span><b>" + esc(b.ad) + "</b>" + cubuk("Tutuş", b.tutus) + cubuk("Dayanım", b.dayanim) + "</div>";
        }).join("") + "</div>";
      }
      return "<section class='a2-lk' id='a2-lk-" + esc(k.id) + "'><h3>" + esc(k.baslik) + (k.donem ? " <span class='a2-donem'>" + esc(k.donem) + "</span>" : "") + "</h3><p>" + isle(k.metin) + "</p>" + g + "</section>";
    }).join("");
    var alan = ""; try { alan = new URL(LS.kaynak).hostname.replace(/^www\./, ""); } catch (e) { alan = "kaynak"; }
    h += "<p class='a2-meta'>Genel açıklamadır; belirli bir pilotun hangi lastikle koştuğunu göstermez. Kaynak: <a href='" + esc(LS.kaynak) + "' target='_blank' rel='noopener noreferrer'>" + esc(alan) + "</a></p>";
    return { baslik: LS.baslik, html: h };
  }

  function goster(v, geriDonus) {
    var d = pencere();
    if (!geriDonus) { yigin.push(v); }
    var g = v.t === "terim" ? terimGorunum(v.k) : v.t === "lastik" ? lastikGorunum() : sozlukGorunum(v.q);
    d.querySelector("#a2-dlg-baslik").textContent = g.baslik;
    var govde = d.querySelector(".a2-dlg-govde"); govde.innerHTML = g.html; govde.scrollTop = 0;
    d.querySelector(".a2-geri").hidden = yigin.length < 2;
    if (v.t === "sozluk") {
      modUygula(modOku());
      var ara = govde.querySelector(".a2-ara");
      if (ara) { ara.addEventListener("input", function () { var pos = ara.selectionStart; yigin[yigin.length - 1].q = ara.value; goster(yigin[yigin.length - 1], true); var yeni = dlg.querySelector(".a2-ara"); if (yeni) { yeni.focus(); try { yeni.setSelectionRange(pos, pos); } catch (e) { /* önemsiz */ } } }); }
    }
    if (v.t === "lastik" && v.k) { var hedef = d.querySelector("#a2-lk-" + v.k); if (hedef && hedef.scrollIntoView) { hedef.scrollIntoView({ block: "start" }); } }
    if (!d.open) {
      acanEl = document.activeElement;
      try { d.showModal(); } catch (e) { d.setAttribute("open", ""); }
    }
    if (v.t !== "sozluk") { govde.focus(); }
  }
  function geri() { if (yigin.length > 1) { yigin.pop(); goster(yigin[yigin.length - 1], true); } }
  function kapat() { if (dlg && dlg.open) { try { dlg.close(); } catch (e) { dlg.removeAttribute("open"); } } }

  // ---- genel tıklama: ⓘ, [data-terim], lastik bağlantıları ----
  function tikla(e) {
    var b = e.target.closest ? e.target.closest("button") : null;
    if (!b || (dlg && dlg.contains(b))) { return; }
    if (b.classList.contains("a2-i") && b.hasAttribute("data-terim")) { e.preventDefault(); e.stopPropagation(); yigin = []; goster({ t: "terim", k: b.getAttribute("data-terim") }); }
    else if (b.classList.contains("a2-lastik") && b.hasAttribute("data-lastik")) { yigin = []; goster({ t: "lastik", k: b.getAttribute("data-lastik") }); }
    else if (b.id === "a2-sozluk-dugme") { yigin = []; goster({ t: "sozluk" }); }
    else if (b.id === "a2-mod-dugme") { var i = MODLAR.findIndex(function (x) { return x[0] === modOku(); }); modYaz(MODLAR[(i + 1) % MODLAR.length][0]); }
  }

  function ustBar() {
    if (document.getElementById("a2-sozluk-dugme")) { return; }
    var sag = document.querySelector("#rc-bar .rc-sag"), kap = document.createElement("span");
    kap.className = "a2-ustbar";
    kap.innerHTML = "<button type='button' id='a2-mod-dugme' class='a2-mod-dugme' title='Açıklama modunu değiştir'></button><button type='button' id='a2-sozluk-dugme' class='a2-sozluk-dugme' title='Terim sözlüğü'>ⓘ Bu ne demek?</button>";
    if (sag) { sag.insertBefore(kap, sag.firstChild); }
    else { var nav = document.querySelector("body > nav"); if (nav) { nav.parentNode.insertBefore(kap, nav); } else { document.body.insertBefore(kap, document.body.firstChild); } }
    modUygula(modOku());
  }

  function baslat() {
    try {
      modUygula(modOku());
      ustBar();
      document.addEventListener("click", tikla, true);   // yakalama aşaması: ⓘ içindeki başlıklar/yorum düğmeleri tıklamayı yutmasın
      if (window.MutationObserver) {
        var mo = new MutationObserver(planla);
        ["sekme-yaris", "sekme-gun", "sekme-sezon", "sekme-profil"].forEach(function (id) { var el = document.getElementById(id); if (el) { mo.observe(el, { childList: true, subtree: true }); } });
      }
      taraHepsi();
    } catch (e) { /* sessiz */ }
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", baslat); } else { baslat(); }

  window.Ogren = { isle: isle, tara: tara, mod: modOku, modYaz: modYaz, ac: function (k) { yigin = []; goster({ t: "terim", k: k }); }, sozluk: function () { yigin = []; goster({ t: "sozluk" }); }, lastik: function (k) { yigin = []; goster({ t: "lastik", k: k || "" }); }, kapat: kapat };
})();
