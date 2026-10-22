/* UI v3 — ortak control-center bileşenleri (yalnız sunum üreten saf HTML üreticileri).
   İlke: ÖZET ÖNCE — DETAY TALEP EDİLİNCE. Durum/veri/fetch/zamanlayıcı YOK; hiçbir DOM'a kendiliğinden dokunmaz.
   Kullanım: window.V3.durum / cip / metrik / sekmeler / neden / acord  (hepsi HTML dizgesi döner). */
(function () {
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  // A) DURUM ŞERİDİ — rozet (HTML, mevcut durum çıktısından) + tek satır metin; ton: live|kirmizi|bekle|bitti|yaklasan
  function durum(rozetHtml, metinHtml, ton) {
    return "<div class='v3-durum v3-d-" + esc(ton || "yaklasan") + "' role='status'>" + (rozetHtml || "") +
      (metinHtml ? "<span class='v3-durum-m'>" + metinHtml + "</span>" : "") + "</div>";
  }
  // B) ÖZET ÇİPİ — kalın/teknik kısım + soluk etiket. ton: "" | "p" (pozisyon) | "durum"
  function cip(kalin, etiket, ton) {
    return "<span class='v3-cip" + (ton ? " v3-cip-" + esc(ton) : "") + "'><b>" + esc(kalin) + "</b>" + (etiket ? " <i>" + esc(etiket) + "</i>" : "") + "</span>";
  }
  function cipSerit(cipler, etiket) {      // data-imza: değişiklik denetimi için (innerHTML serileştirmesi dizgeyle eşleşmez)
    var h = cipler.join("");
    return "<div class='v3-cipler' role='list' aria-label='" + esc(etiket || "Özet") + "' data-imza='" + esc(h) + "'>" + h + "</div>";
  }
  // C) METRİK KAROSU — küçük teknik sayı + label
  function metrik(deger, label) {
    return "<div class='v3-metrik'><b>" + esc(deger) + "</b><span>" + esc(label) + "</span></div>";
  }
  // D) TEK-SEÇİLİ DETAY PANELİ — sekme çubuğu; yalnız aktif olanın içeriği DOM'a konur (çağıran taraf)
  //    liste: [{ k, ad }]; aktif: k; act: data-act değeri
  function sekmeler(liste, aktif, act, etiket) {
    return "<div class='v3-sekmeler' role='tablist' aria-label='" + esc(etiket || "Ayrıntı") + "'>" + liste.map(function (t) {
      var a = t.k === aktif;
      return "<button type='button' role='tab' class='v3-sek" + (a ? " aktif" : "") + "' data-act='" + esc(act) + "' data-v='" + esc(t.k) + "' aria-selected='" + a + "'>" + esc(t.ad) + "</button>";
    }).join("") + "</div>";
  }
  // E) "NEDEN ÖNEMLİ?" MİNİ KARTI — 1–2 satır
  function neden(metin, baslik) {
    if (!metin) { return ""; }
    return "<aside class='v3-neden'><b>" + esc(baslik || "Neden önemli?") + "</b><p>" + esc(metin) + "</p></aside>";
  }
  // F) STANDART ACCORDION / DISCLOSURE — özet satırı görünür, gövde talep edilince
  //    attrs: ek öznitelik dizgesi (örn. "data-act='x'"); icerikHtml güvenilir HTML
  function acord(baslik, icerikHtml, acik, attrs, ozet) {
    return "<details class='v3-acord'" + (acik ? " open" : "") + (attrs ? " " + attrs : "") + "><summary><span class='v3-ab'>" + esc(baslik) + "</span>" +
      (ozet ? "<span class='v3-ao'>" + esc(ozet) + "</span>" : "") + "</summary><div class='v3-ag'>" + icerikHtml + "</div></details>";
  }

  window.V3 = { esc: esc, durum: durum, cip: cip, cipSerit: cipSerit, metrik: metrik, sekmeler: sekmeler, neden: neden, acord: acord };
})();
