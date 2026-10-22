/* FINAL UI/UX TURU — yalnızca SUNUM katmanı ("önce özet, isteyene detay"). Veri, API çağrısı, hesap, polling YOKTUR.
   Bu dosya mevcut DOM'u okur/sınıf ekler; hiçbir fetch yapmaz, yeni localStorage anahtarı yazmaz (aç/daralt durumu yalnızca bellekte).
   1) Daralt: tablo listeleri ilk 3 satırla başlar, "Tüm … göster (N)" ile tamamı açılır (N daima gerçek satır sayısından).
      Uygulanan listeler: Güncel Sezon pilot/takım puan durumu, Yarış Günü sonuçları. Satırlar silinmez, yalnızca CSS ile gizlenir
      (tablo yeniden çizilse de çalışır; favori pilot satırı daralmış listede de görünür).
   2) Şampiyonlar: 2026–2015 görünür, 2014 ve öncesi gizli; "Tüm şampiyonları göster" / "Listeyi daralt". Arama sırasında tüm yıllar aranır.
      Henüz tamamlanmamış güncel sezon satırı "SEZON DEVAM EDİYOR" etiketiyle ayrılır (şampiyon gibi görünmez). */
(function () {
  "use strict";
  var F = window.F1UI;
  function bul(f, d) { try { return f(); } catch (e) { return d; } }
  function esc(x) { return F && F.esc ? F.esc(x) : String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }
  function ik(ad, b) { return F && F.ikon ? F.ikon(ad, b) : ""; }

  // ---------- 1) Daralt ----------
  var LISTELER = [
    { govde: "pilot-govde", ilk: 3, cok: "Tüm pilotları göster", az: "Listeyi daralt" },
    { govde: "takim-govde", ilk: 3, cok: "Tüm takımları göster", az: "Listeyi daralt" },
    { govde: "gun-sonuc-govde", ilk: 3, cok: "Tüm sonuçları göster", az: "Listeyi daralt" },
    { govde: "sonuc-govde", ilk: 3, cok: "Tüm sonuçları göster", az: "Listeyi daralt" }
  ];

  function satirSayisi(tb) { return Array.prototype.filter.call(tb.querySelectorAll("tr"), function (r) { return r.children.length > 1 && !r.querySelector("td[colspan]"); }).length; }

  function daraltKur(o) {
    var tb = document.getElementById(o.govde); if (!tb) { return; }
    var kap = tb.closest(".kap"); if (!kap || kap.getAttribute("data-ui-daralt")) { return; }
    kap.setAttribute("data-ui-daralt", o.govde);
    var id = "ui-d-" + o.govde;
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "ui-daralt"; btn.id = id + "-btn"; btn.hidden = true; btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", o.govde);
    kap.parentNode.insertBefore(btn, kap.nextSibling);
    var acik = false;
    function yenile() {
      var n = satirSayisi(tb);
      if (n <= o.ilk) { kap.classList.remove("ui-kisa"); btn.hidden = true; return; }
      kap.classList.toggle("ui-kisa", !acik);
      btn.hidden = false;
      btn.setAttribute("aria-expanded", acik ? "true" : "false");
      btn.innerHTML = ik(acik ? "arrowup" : "arrowdown", 14) + "<span>" + esc(acik ? o.az : o.cok + " (" + n + ")") + "</span>";
    }
    btn.addEventListener("click", function () { acik = !acik; yenile(); });
    if (window.MutationObserver) { new MutationObserver(yenile).observe(tb, { childList: true }); }
    yenile();
  }

  // ---------- 2) Şampiyonlar ----------
  var ILK_YIL = 2015;      // 2026 … 2015 görünür; 2014 ve öncesi gizli
  var S = { tum: false };
  function buYil() { return bul(function () { return typeof BU_YIL !== "undefined" ? BU_YIL : new Date().getFullYear(); }, new Date().getFullYear()); }

  function sampiyonDuzenle() {
    var tb = document.getElementById("govde"), kap = tb && tb.closest(".kap"); if (!tb || !kap) { return; }
    var yil = buYil(), eski = 0, rows = tb.querySelectorAll("tr");
    Array.prototype.forEach.call(rows, function (tr) {
      var td = tr.querySelector("td.sezon"); if (!td) { return; }
      var y = parseInt(td.textContent, 10); if (!isFinite(y)) { return; }
      if (y < ILK_YIL) { tr.classList.add("ui-eski"); eski++; }
      if (y === yil && !tr.classList.contains("ui-canli")) {          // tamamlanmamış sezon: şampiyon değil, "lider"
        tr.classList.add("ui-canli");
        var h = tr.children[1];
        if (h) {
          var ad = h.textContent.replace(/\s*\(lider\)\s*$/i, "").trim();
          h.innerHTML = "<span class='ui-ad'>" + esc(ad) + "</span> <small class='ui-soluk'>lider</small><br><span class='ui-rozet ui-rozet-canli'><i class='ui-nokta' aria-hidden='true'></i>SEZON DEVAM EDİYOR</span>";
        }
      }
    });
    var ara = document.getElementById("ara"), araVar = !!(ara && ara.value.trim());
    kap.classList.toggle("ui-ara", araVar);                           // arama: gizli yıllardaki sonuçlar da bulunur
    kap.classList.toggle("ui-tum", S.tum);
    var btn = document.getElementById("ui-sampiyon-btn");
    if (!btn) {
      btn = document.createElement("button"); btn.type = "button"; btn.id = "ui-sampiyon-btn"; btn.className = "ui-daralt"; btn.hidden = true;
      btn.setAttribute("aria-controls", "govde");
      btn.addEventListener("click", function () { S.tum = !S.tum; sampiyonDuzenle(); });
      kap.parentNode.insertBefore(btn, kap.nextSibling);
    }
    var goster = eski > 0 && !araVar;
    btn.hidden = !goster;
    btn.setAttribute("aria-expanded", S.tum ? "true" : "false");
    btn.innerHTML = ik(S.tum ? "arrowup" : "arrowdown", 14) + "<span>" + (S.tum ? "Listeyi daralt" : "Tüm şampiyonları göster") + "</span>";
  }

  function sampiyonKur() {
    var tb = document.getElementById("govde"); if (!tb) { return; }
    if (window.MutationObserver) { new MutationObserver(sampiyonDuzenle).observe(tb, { childList: true }); }
    var ara = document.getElementById("ara");
    if (ara) { ara.addEventListener("input", function () { setTimeout(sampiyonDuzenle, 0); }); }
    sampiyonDuzenle();
  }

  // ---------- 3) Pist listesi: sınıf rengi + rozet (yalnızca görünüm; sınıf verisi mevcut PIST_SINIFLANDIRMA'dan okunur) ----------
  function pistListeDuzenle() {
    var tb = document.getElementById("pist-govde"); if (!tb) { return; }
    var h = bul(function () { return PIST_SINIFLANDIRMA.harita(); }, {}), K = bul(function () { return PIST_SINIFLANDIRMA.KATEGORILER; }, {});
    Array.prototype.forEach.call(tb.querySelectorAll("tr"), function (tr) {
      if (tr.getAttribute("data-ui-pk")) { return; }
      var b = tr.querySelector("button[data-pist]"), p = b && h[b.getAttribute("data-pist")];
      tr.setAttribute("data-ui-pk", "1"); if (!p) { return; }
      tr.className += " pp-k-" + p.kategori;
      var td = tr.children[0], kt = K[p.kategori];
      if (td && kt) { var gp = tr.children[2] ? tr.children[2].textContent.trim() : ""; td.innerHTML = "<b class='ui-pist-ad'>" + td.innerHTML + "</b><small class='ui-gp'>" + esc(gp) + "</small><span class='pp-sinifrozet'>" + esc(kt.ad) + "</span>"; }
    });
  }
  function pistKur() {
    var tb = document.getElementById("pist-govde"); if (!tb) { return; }
    if (window.MutationObserver) { new MutationObserver(pistListeDuzenle).observe(tb, { childList: true }); }
    pistListeDuzenle();
  }

  // ---------- 4) Pilot karşılaştırma: A/B tarafları, satır ikonları, üstün taraf vurgusu (hesap/veri değişmez; yalnızca sayıları görsel olarak işaretler) ----------
  var KIYAS_IK = { "Sıra": "list", "Puan": "chart", "Galibiyet": "trophy", "Takım": "car", "Numara": "helmet", "Uyruk": "flag", "Yaş": "calendar" };
  function kiyasDuzenle() {
    var tb = document.getElementById("kiyas-govde"); if (!tb) { return; }
    Array.prototype.forEach.call(tb.querySelectorAll("tr"), function (tr) {
      var c = tr.children; if (c.length !== 3 || tr.getAttribute("data-ui-k") === c[0].textContent + c[1].textContent + c[2].textContent) { return; }
      var et = c[0].getAttribute("data-et") || c[0].textContent.trim();
      c[0].setAttribute("data-et", et);
      c[0].innerHTML = ik(KIYAS_IK[et] || "flag", 14) + "<span>" + esc(et) + "</span>";
      var a = parseFloat(c[1].textContent), b = parseFloat(c[2].textContent);
      c[1].className = c[2].className = "ui-kd";
      if (isFinite(a) && isFinite(b) && a !== b && (et === "Sıra" || et === "Puan" || et === "Galibiyet")) {
        var aUstun = et === "Sıra" ? a < b : a > b;
        (aUstun ? c[1] : c[2]).classList.add("ui-ustun");
      }
      tr.setAttribute("data-ui-k", c[0].textContent + c[1].textContent + c[2].textContent);
    });
  }
  function kiyasKur() {
    var tb = document.getElementById("kiyas-govde"), a = document.getElementById("pilot-a"), b = document.getElementById("pilot-b");
    if (!tb || !a || !b || a.closest(".ui-ab")) { return; }
    var w = document.createElement("div"); w.className = "ui-ab";
    a.parentNode.insertBefore(w, a);
    [["A", a, "ui-a"], ["B", b, "ui-b"]].forEach(function (x) {
      var l = document.createElement("label"); l.className = "ui-ab-yan " + x[2];
      l.innerHTML = "<span class='ui-ab-et'>" + x[0] + "</span>"; l.appendChild(x[1]); w.appendChild(l);
    });
    var ta = document.getElementById("baslik-a"), tb2 = document.getElementById("baslik-b");
    if (ta) { ta.className = "ui-th-a"; } if (tb2) { tb2.className = "ui-th-b"; }
    if (window.MutationObserver) { new MutationObserver(kiyasDuzenle).observe(tb, { childList: true }); }
    kiyasDuzenle();
  }

  function baslat() {
    kiyasKur();
    pistKur();
    LISTELER.forEach(daraltKur);
    sampiyonKur();
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", baslat); } else { baslat(); }
  window.UIFinal = { daraltKur: daraltKur, _durum: S };
})();
