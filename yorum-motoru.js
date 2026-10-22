/* A2.1 — "Ne oldu?" yorum motoru.
   Kural: HAM VERİ → KISA TÜRKÇE AÇIKLAMA. Yorum, neden tahmini, performans değerlendirmesi YOK.
   Her cümle yalnızca Jolpica sonuç satırlarındaki (ve pole için Sıralama P1) ölçülebilir bilgiden üretilir;
   veri eksikse o cümle hiç üretilmez. Pole (Sıralama P1) ile start P1 (yarışın grid sütunu) karıştırılmaz.
   Çağrı: index.html'deki iki yerden tek satırlık kanca: YorumMotoru.sonuc(Results[], { hedef, tur }).
   Kanca başarısız olursa mevcut sonuç ekranı etkilenmez (hata yutulur).
   Yerel kontrol: "Yorum: Açık / Kapalı" (localStorage f1-ogren-v1-yorum). Global öğrenme moduna (A2.2) bağlı DEĞİL. */
(function () {
  var ANAHTAR = "f1-ogren-v1-yorum";
  var HEDEFLER = {
    yaris: { govde: "sonuc-govde", kutu: "a2-yorum-yaris" },
    gun:   { govde: "gun-sonuc-govde", kutu: "a2-yorum-gun" }
  };
  var DURUM_TR = {
    "Accident": "Kaza", "Collision": "Çarpışma", "Collision damage": "Çarpışma hasarı", "Engine": "Motor", "Gearbox": "Şanzıman",
    "Transmission": "Aktarma organları", "Clutch": "Debriyaj", "Hydraulics": "Hidrolik", "Electrical": "Elektrik", "Brakes": "Fren",
    "Suspension": "Süspansiyon", "Overheating": "Aşırı ısınma", "Mechanical": "Mekanik", "Retired": "Çekildi", "Disqualified": "Diskalifiye",
    "Spun off": "Pistten çıktı", "Power Unit": "Güç ünitesi", "Power loss": "Güç kaybı", "Puncture": "Patlak lastik", "Wheel": "Tekerlek",
    "Did not start": "Başlamadı", "Withdrew": "Çekildi", "Fuel pressure": "Yakıt basıncı", "Water leak": "Su sızıntısı",
    "Oil leak": "Yağ sızıntısı", "Lapped": "Çekildi, tur geride", "Damage": "Hasar", "Out of fuel": "Yakıt bitti", "Driveshaft": "Aktarma mili", "Steering": "Direksiyon"
  };
  var jeton = { yaris: 0, gun: 0 };

  function esc(x) { return window.F1UI ? window.F1UI.esc(x) : String(x); }
  function modOku() { try { return localStorage.getItem(ANAHTAR) === "kapali" ? "kapali" : "acik"; } catch (e) { return "acik"; } }
  function modYaz(m) { try { localStorage.setItem(ANAHTAR, m); } catch (e) { /* önemsiz */ } }

  // Sınıflandırılmış bitiriş = sıra metni sayı (R/W/D/E... değil). "Lapped" durumu emekli pilotlarda da görülebildiği için durum yazısına güvenilmez.
  function bitirdiMi(x) { return /^\d+$/.test(x.metin); }
  function basladiMi(x) { return !/^(Did not start|Withdrew)$/i.test(x.durum) && x.metin !== "W"; }
  function durumTr(d) { return DURUM_TR[d] || d; }

  function satir(r) {
    var d = r.Driver || {};
    return {
      pos: Number(r.position), metin: String(r.positionText != null ? r.positionText : r.position), tur: Number(r.laps), grid: r.grid === "" || r.grid == null ? NaN : Number(r.grid),
      kod: d.code || "", ad: d.familyName || "", takim: r.Constructor ? r.Constructor.name : "",
      durum: r.status || "", sure: r.Time && r.Time.time ? r.Time.time : "",
      hizli: r.FastestLap && String(r.FastestLap.rank) === "1" ? { sure: r.FastestLap.Time && r.FastestLap.Time.time, tur: r.FastestLap.lap } : null
    };
  }
  function startYaz(g) { return g === 0 ? "pit çıkışından" : g + ". sıradan"; }

  // "+20.442" veya "+1:02.345" -> saniye (sayı); diğer biçimlerde null
  function farkSaniye(s) {
    var m = /^\+(?:(\d+):)?(\d+(?:\.\d+)?)$/.exec(String(s || "").trim());
    if (!m) { return null; }
    return (m[1] ? Number(m[1]) * 60 : 0) + Number(m[2]);
  }
  function saniyeYaz(sn) {
    if (sn >= 60) { var dk = Math.floor(sn / 60); return dk + " dakika " + (sn - dk * 60).toFixed(1) + " saniye"; }
    return sn.toFixed(1) + " saniye";
  }

  // Ham Results satırları (+ varsa pole: { k, a, t }) -> cümle listesi. Saf fonksiyon (test edilebilir).
  function uret(liste, pole) {
    var out = [];
    if (!liste || !liste.length) { return out; }
    var s = liste.map(satir).filter(function (x) { return !isNaN(x.pos); });
    var kaz = s.filter(function (x) { return x.pos === 1; })[0];
    if (!kaz || !kaz.ad) { return out; }

    // 1) Kazanan / pole (pole ≠ start P1)
    var c1 = [];
    var poleSatir = pole ? s.filter(function (x) { return x.kod === pole.k; })[0] : null;
    if (pole && pole.k === kaz.kod) {
      if (kaz.grid === 1) { c1.push(kaz.ad + " pole'dan başlayıp yarışı kazandı."); }
      else {
        c1.push(kaz.ad + " pole pozisyonunu aldı ve yarışı kazandı.");
        if (!isNaN(kaz.grid)) { c1.push("Yarışa " + startYaz(kaz.grid) + " başladı."); }
      }
    } else if (pole) {
      var poleAd = poleSatir ? poleSatir.ad : (pole.a || pole.k);
      c1.push("Pole pozisyonunu " + poleAd + " aldı; yarışı " + kaz.ad + " kazandı.");
      if (poleSatir) {
        var basla = basladiMi(poleSatir) && !isNaN(poleSatir.grid) ? poleAd + " yarışa " + (poleSatir.grid === 1 ? "pole'dan (1. sıradan)" : startYaz(poleSatir.grid)) + " başladı" : null;
        var bitis = bitirdiMi(poleSatir) ? (poleSatir.pos + ". bitirdi") :
          (!basladiMi(poleSatir) ? "yarışa başlayamadı" : "yarışı tamamlayamadı (" + durumTr(poleSatir.durum) + ")");
        c1.push(basla ? basla + " ve " + bitis + "." : poleAd + " " + bitis + ".");
      }
    } else {
      c1.push("Yarışı " + kaz.ad + " kazandı.");
      if (!isNaN(kaz.grid) && kaz.grid > 1) { c1.push("Yarışa " + startYaz(kaz.grid) + " başladı."); }
    }
    out.push(c1.join(" "));

    // 2) Kazanma farkı (yalnızca ikinci pilotun süre farkı sayı olarak verilmişse)
    var p2 = s.filter(function (x) { return x.pos === 2; })[0];
    var fark = p2 ? farkSaniye(p2.sure) : null;
    if (fark !== null) { out.push("Yarışı " + saniyeYaz(fark) + " farkla kazandı."); }

    // 3) Yarışa başlayamayanlar, diskalifiyeler, yarışı tamamlayamayanlar
    var dns = s.filter(function (x) { return !basladiMi(x); });
    if (dns.length) { out.push(dns.map(function (x) { return x.ad; }).join(", ") + (dns.length > 1 ? " yarışa başlayamadı." : " yarışa başlayamadı.")); }
    var dq = s.filter(function (x) { return x.metin === "D"; });
    if (dq.length) { out.push(dq.length + " pilot diskalifiye edildi: " + dq.map(function (x) { return x.ad; }).join(", ") + "."); }
    var dnf = s.filter(function (x) { return !bitirdiMi(x) && basladiMi(x) && x.metin !== "D"; });
    if (dnf.length) {
      var ilk = dnf.slice(0, 4).map(function (x) { return x.ad + " (" + durumTr(x.durum) + ")"; }).join(", ");
      out.push(dnf.length + " pilot yarışı tamamlayamadı: " + ilk + (dnf.length > 4 ? " ve " + (dnf.length - 4) + " pilot daha" : "") + ".");
    }

    // 4) Tur geride bitirenler (tamamladığı tur sayısı kazananınkinden az olan sınıflandırılmış pilotlar)
    var geride = isNaN(kaz.tur) ? [] : s.filter(function (x) { return bitirdiMi(x) && !isNaN(x.tur) && x.tur < kaz.tur; });
    if (geride.length) { out.push(geride.length + " pilot en az bir tur geride bitirdi."); }

    // 5) En çok yer kazanan (start sırası biliniyorsa, pit çıkışı hariç; en az 3 yer)
    var en = null;
    s.forEach(function (x) {
      if (!bitirdiMi(x) || isNaN(x.grid) || x.grid < 1) { return; }
      var kazanc = x.grid - x.pos;
      if (kazanc >= 3 && (!en || kazanc > en.k)) { en = { x: x, k: kazanc }; }
    });
    if (en) { out.push("En çok yer kazanan pilot " + en.x.ad + ": " + startYaz(en.x.grid) + " başlayıp " + en.x.pos + ". bitirdi (+" + en.k + ")."); }

    // 6) Podyumda aynı takımdan birden fazla pilot
    var takimlar = {};
    s.filter(function (x) { return x.pos >= 1 && x.pos <= 3 && x.takim; }).forEach(function (x) { takimlar[x.takim] = (takimlar[x.takim] || 0) + 1; });
    Object.keys(takimlar).forEach(function (t) { if (takimlar[t] >= 2) { out.push("Podyumda " + takimlar[t] + " " + t + " pilotu var."); } });

    // 7) En hızlı tur
    var hz = s.filter(function (x) { return x.hizli && x.hizli.sure; })[0];
    if (hz) { out.push("En hızlı tur: " + hz.ad + ", " + hz.hizli.sure + (hz.hizli.tur ? " (tur " + hz.hizli.tur + ")" : "") + "."); }

    return out.slice(0, 5);
  }

  function kutuBul(hedef) {
    var h = HEDEFLER[hedef];
    var govde = document.getElementById(h.govde);
    if (!govde) { return null; }
    var kutu = document.getElementById(h.kutu);
    if (!kutu) {
      var kap = govde.closest ? govde.closest(".kap") : null;
      if (!kap || !kap.parentNode) { return null; }
      kutu = document.createElement("div");
      kutu.id = h.kutu; kutu.className = "ym";
      kap.parentNode.insertBefore(kutu, kap.nextSibling);
      kutu.addEventListener("click", function (e) {
        var b = e.target.closest ? e.target.closest("button") : null;
        if (!b) { return; }
        if (b.hasAttribute("data-mod")) {
          modYaz(b.getAttribute("data-mod"));
          Object.keys(HEDEFLER).forEach(function (k) { var o = document.getElementById(HEDEFLER[k].kutu); if (o && o._cumleler) { ciz(o, o._cumleler); } });
        } else if (b.classList.contains("ym-ac")) {
          var ic = kutu.querySelector(".ym-liste");
          var acik = b.getAttribute("aria-expanded") === "true";
          b.setAttribute("aria-expanded", acik ? "false" : "true");
          if (ic) { ic.hidden = acik; }
          var ok = b.querySelector(".ym-ok"); if (ok) { ok.textContent = acik ? "▸" : "▾"; }
          var ozet = kutu.querySelector(".ym-ozet"); if (ozet) { ozet.hidden = !acik; }
        }
      });
    }
    return kutu;
  }

  function ciz(kutu, cumleler) {
    kutu._cumleler = cumleler;
    if (!cumleler || !cumleler.length) { kutu.innerHTML = ""; kutu.hidden = true; return; }
    kutu.hidden = false;
    var mod = modOku();
    var kontrol = "<span class='ym-mod'>Yorum: <button type='button' data-mod='acik' aria-pressed='" + (mod === "acik") + "' class='" + (mod === "acik" ? "aktif" : "") + "'>Açık</button>" +
                  "<button type='button' data-mod='kapali' aria-pressed='" + (mod === "kapali") + "' class='" + (mod === "kapali" ? "aktif" : "") + "'>Kapalı</button></span>";
    if (mod === "kapali") { kutu.innerHTML = "<div class='ym-ust'>" + kontrol + "</div>"; return; }
    kutu.innerHTML = "<div class='ym-ust'><button type='button' class='ym-ac' aria-expanded='false'><span class='ym-ok'>▸</span> <b>Ne oldu?</b>" +
      " <span class='ym-ozet'>" + esc(cumleler[0]) + "</span></button>" + kontrol + "</div>" +
      "<ul class='ym-liste' hidden>" + cumleler.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul>";
  }

  // Kanca girişi. Her koşulda sessiz: hata mevcut sonuç ekranını etkilemez.
  // Bölüm gizliyken (veri arka planda yüklendiyse) ağ çağrısı yapılmaz; kullanıcı sekmeyi açınca işlenir.
  var BOLUM = { yaris: "sekme-yaris", gun: "sekme-gun" };
  var bekleyen = { yaris: null, gun: null };
  function gorunurMu(hedef) { var el = document.getElementById(BOLUM[hedef]); return !!el && !el.hidden; }

  function isle(hedef) {
    try {
      var b = bekleyen[hedef];
      if (!b || b.basladi || !gorunurMu(hedef)) { return; }
      var kutu = kutuBul(hedef);
      if (!kutu) { return; }
      b.basladi = true;
      var sezon = (typeof SEZON !== "undefined") ? SEZON : new Date().getFullYear();
      var poleIs = (window.SezonVeri && b.tur != null) ? window.SezonVeri.poleAl(sezon, b.tur).catch(function () { return null; }) : Promise.resolve(null);
      poleIs.then(function (pole) {
        if (b.jeton !== jeton[hedef]) { return; }      // yarış değişti: eski sonuç çizilmez
        ciz(kutu, uret(b.liste, pole));
      }).catch(function () { /* sessiz */ });
    } catch (e) { /* sessiz */ }
  }

  function sonuc(liste, bag) {
    try {
      var hedef = bag && bag.hedef;
      if (!HEDEFLER[hedef] || !liste || !liste.length) { return; }
      var kutu = kutuBul(hedef);
      if (!kutu) { return; }
      jeton[hedef]++;
      kutu.innerHTML = ""; kutu._cumleler = null; kutu.hidden = true;
      bekleyen[hedef] = { liste: liste, tur: bag.tur, jeton: jeton[hedef], basladi: false };
      isle(hedef);
    } catch (e) { /* sessiz */ }
  }

  // Sekme açılınca (tıklama) bekleyen sonuç varsa işle
  try { document.addEventListener("click", function () { Object.keys(HEDEFLER).forEach(isle); }); } catch (e) { /* sessiz */ }

  window.YorumMotoru = { sonuc: sonuc, _uret: uret, _farkSaniye: farkSaniye };
})();
