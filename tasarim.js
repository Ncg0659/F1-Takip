/* F1 Takip - görsel katman (sadece görünüm).
   Bu dosya veri çekmez, Race Feed motoruna / Jolpica'ya / hava durumuna dokunmaz.
   İçindekiler:
     1. IKONLAR            : satır içi SVG ikon seti
     2. TAKIM_TEMALARI     : takım renk blokları (MERKEZİ TANIM - renkleri sadece buradan değiştir)
     3. KATEGORI           : Race Feed kategori -> ikon + renk
     4. Yardımcılar        : takimRozeti, pozRozet, farkRozeti, bayrak, olaySatiri
     5. susle()            : menü / başlık ikonları ve üst bar (sayfa açılınca bir kez çalışır)
*/
(function () {
  "use strict";

  // ---------- 1. IKONLAR (24x24, çizgi ikon). Her değer "|" ile ayrılmış path listesi ----------
  var IKONLAR = {
    trophy: "M8 21h8|M12 17v4|M7 4h10v5a5 5 0 0 1-10 0V4z|M17 5h3v2a3 3 0 0 1-3 3|M7 5H4v2a3 3 0 0 0 3 3",
    calendar: "M4 6h16v14H4z|M4 10h16|M8 3v4|M16 3v4",
    flag: "M5 21V4|M5 4h11l-2 4 2 4H5",
    helmet: "M3 16a9 9 0 0 1 18 0v2H3z|M3 16h8|M11 9h10",
    pin: "M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z|M12 8.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
    chart: "M3 3v18h18|M7 15l4-5 3 3 5-7",
    checker: "M5 21V3|M5 4h14v10H5|M9.7 4v10|M14.3 4v10|M5 9h14",
    stopwatch: "M10 2h4|M12 14l3-3|M12 6a8 8 0 1 0 0 16 8 8 0 0 0 0-16z",
    layers: "M12 3l9 5-9 5-9-5 9-5z|M3 13l9 5 9-5",
    moon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z",
    sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z|M12 2v2|M12 20v2|M4.9 4.9l1.4 1.4|M17.7 17.7l1.4 1.4|M2 12h2|M20 12h2|M4.9 19.1l1.4-1.4|M17.7 6.3l1.4-1.4",
    radio: "M4.9 19.1a10 10 0 0 1 0-14.2|M19.1 4.9a10 10 0 0 1 0 14.2|M8 16a5 5 0 0 1 0-8|M16 8a5 5 0 0 1 0 8|M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z",
    rain: "M7 15a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 8a3.5 3.5 0 0 1 0 7|M8 19v2|M12 18v3|M16 19v2",
    cloud: "M7 18a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 11a3.5 3.5 0 0 1 0 7H7z",
    zap: "M13 2L4 14h7l-1 8 9-12h-7l1-8z",
    thermo: "M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z",
    droplet: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z",
    wind: "M3 9h11a3 3 0 1 0-3-3|M3 15h15a3 3 0 1 1-3 3|M3 12h8",
    track: "M4 15c0-4 3-6 6-6h4a5 5 0 0 1 0 8H8a4 4 0 0 1-4-2z",
    wrench: "M14.5 6.5a4 4 0 1 1 3 3L8 19a2.1 2.1 0 0 1-3-3l9.5-9.5z",
    tyre: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z|M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
    grid: "M3 3h7v7H3z|M14 3h7v7h-7z|M3 14h7v7H3z|M14 14h7v7h-7z",
    arrowup: "M12 19V5|M5 12l7-7 7 7",
    check: "M5 12.5l4.5 4.5L19 7",
    arrowdown: "M12 5v14|M19 12l-7 7-7-7",
    minus: "M6 12h12",
    rotate: "M21 12a9 9 0 1 1-3-6.7L21 8|M21 3v5h-5",
    alert: "M12 3l10 18H2L12 3z|M12 10v5|M12 18v.5",
    alertcircle: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z|M12 8v5|M12 16v.5",
    car: "M5 16l1.5-5a2 2 0 0 1 2-1.5h7a2 2 0 0 1 2 1.5L19 16|M3 16h18v3H3z|M7 19v1.5|M17 19v1.5",
    search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z|M21 21l-5-5",
    activity: "M3 12h4l3-8 4 16 3-8h4",
    list: "M8 6h13|M8 12h13|M8 18h13|M3 6h.5|M3 12h.5|M3 18h.5",
    gauge: "M4 18a9 9 0 1 1 16 0|M12 14l4-5"
  };

  function ikon(ad, boyut) {
    var d = IKONLAR[ad] || IKONLAR.flag;
    var yol = d.split("|").map(function (p) { return "<path d='" + p + "'/>"; }).join("");
    var b = boyut ? " style='width:" + boyut + "px;height:" + boyut + "px'" : "";
    return "<svg class='ik' viewBox='0 0 24 24' aria-hidden='true'" + b + ">" + yol + "</svg>";
  }

  function esc(x) {
    return String(x == null ? "" : x).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---------- 2. TAKIM_TEMALARI (merkezi tanım) ----------
  // key, displayName, background, text, border, accent + eslesme (Jolpica takım adını bulmak için)
  var TAKIM_TEMALARI = {
    ferrari:     { key: "ferrari",     displayName: "FERRARI",      background: "#c40500", text: "#ffe600", border: "#ff4a3d", accent: "#ffe600", eslesme: /ferrari/i },
    mclaren:     { key: "mclaren",     displayName: "MCLAREN",      background: "#ff8000", text: "#0b0b0b", border: "#ffa347", accent: "#0b0b0b", eslesme: /mclaren/i },
    mercedes:    { key: "mercedes",    displayName: "MERCEDES",     background: "#12171c", text: "#27f4d2", border: "#2a6b61", accent: "#27f4d2", eslesme: /mercedes/i },
    redbull:     { key: "redbull",     displayName: "RED BULL",     background: "#0f1f5c", text: "#ffffff", border: "#2d44a8", accent: "#e30b17", eslesme: /red bull/i },
    astonmartin: { key: "astonmartin", displayName: "ASTON MARTIN", background: "#06503f", text: "#c9f7e5", border: "#1f8a70", accent: "#6cd3bf", eslesme: /aston/i },
    williams:    { key: "williams",    displayName: "WILLIAMS",     background: "#0a58d0", text: "#ffffff", border: "#4a8bff", accent: "#7ad0ff", eslesme: /williams/i },
    alpine:      { key: "alpine",      displayName: "ALPINE",       background: "#0a6fc2", text: "#ffffff", border: "#3f9be0", accent: "#ff87bc", eslesme: /alpine/i },
    haas:        { key: "haas",        displayName: "HAAS",         background: "#e4e7eb", text: "#12151a", border: "#b6bcc4", accent: "#da291c", eslesme: /haas/i },
    racingbulls: { key: "racingbulls", displayName: "RACING BULLS", background: "#1a2a78", text: "#ffffff", border: "#4a62d0", accent: "#8fb0ff", eslesme: /racing bulls|^rb\b|\brb f1|alphatauri|toro rosso/i },
    audi:        { key: "audi",        displayName: "AUDI",         background: "#0c0f0c", text: "#c9f23a", border: "#47570f", accent: "#c9f23a", eslesme: /audi|sauber/i },
    cadillac:    { key: "cadillac",    displayName: "CADILLAC",     background: "#101215", text: "#f1f3f5", border: "#4b5159", accent: "#b9a26a", eslesme: /cadillac/i }
  };
  var TAKIM_NOTR = { key: "diger", displayName: "", background: "#2a3646", text: "#e6ebf2", border: "#415169", accent: "#8a9db3" };

  function takimTemasi(ad) {
    var s = String(ad || "");
    for (var k in TAKIM_TEMALARI) {
      if (TAKIM_TEMALARI[k].eslesme.test(s)) { return TAKIM_TEMALARI[k]; }
    }
    return null;
  }

  function takimRozeti(ad) {
    if (!ad || ad === "-") { return "<span class='takim takim-yok'>-</span>"; }
    var t = takimTemasi(ad) || TAKIM_NOTR;
    var isim = t.displayName || String(ad).toUpperCase();
    var uz = isim.length > 14 ? " takim-cok-uzun" : (isim.length > 10 ? " takim-uzun" : "");
    return "<span class='takim v3-team-badge" + uz + "' title='" + esc(ad) + "' style='--tb:" + t.background + ";--tt:" + t.text +
           ";--tbr:" + t.border + ";--ta:" + t.accent + "'>" + esc(isim) + "</span>";
  }

  // ---------- 3. KATEGORI (Race Feed) ----------
  var KATEGORI = {
    POSITION:      { ikon: "arrowup",     renk: "#4da3ff" },
    RESULT:        { ikon: "trophy",      renk: "#e8c15a" },
    RESTART:       { ikon: "rotate",      renk: "#34d399" },
    START:         { ikon: "flag",        renk: "#34d399" },
    TECHNICAL:     { ikon: "wrench",      renk: "#f59e0b" },
    INCIDENT:      { ikon: "alert",       renk: "#f87171" },
    SAFETY_CAR:    { ikon: "car",         renk: "#fbbf24" },
    VSC:           { ikon: "car",         renk: "#fbbf24" },
    RED_FLAG:      { ikon: "flag",        renk: "#ef2b2d" },
    RACE_STATUS:   { ikon: "stopwatch",   renk: "#9fb0c3" },
    WEATHER:       { ikon: "rain",        renk: "#38bdf8" },
    PENALTY:       { ikon: "alertcircle", renk: "#fb923c" },
    INVESTIGATION: { ikon: "search",      renk: "#c084fc" },
    PIT:           { ikon: "tyre",        renk: "#a78bfa" },
    TYRE:          { ikon: "tyre",        renk: "#a78bfa" },
    STRATEGY:      { ikon: "chart",       renk: "#9fb0c3" },
    RADIO:         { ikon: "radio",       renk: "#9fb0c3" }
  };
  var KATEGORI_NOTR = { ikon: "activity", renk: "#9fb0c3" };

  // ---------- 4. Yardımcılar ----------
  function pozRozet(metin) {
    var n = parseInt(metin, 10);
    var sinif = "poz";
    if (String(n) === String(metin).trim() && n >= 1 && n <= 3) { sinif += " poz-" + n; }
    else if (isNaN(Number(metin))) { sinif += " poz-dnf"; }
    return "<span class='" + sinif + " v3-position-badge'>" + esc(metin) + "</span>";
  }

  // start: gridden başlama sırası (0 = pit), bitis: bitiş sırası (sayı)
  function farkRozeti(start, bitis) {
    start = Number(start); bitis = Number(bitis);
    if (!(start > 0)) { return "<span class='fark pit'>PIT</span>"; }
    if (isNaN(bitis)) { return "<span class='fark nt'>" + ikon("minus", 12) + "</span>"; }
    var d = start - bitis;
    if (d > 0) { return "<span class='fark art'>" + ikon("arrowup", 12) + d + "</span>"; }
    if (d < 0) { return "<span class='fark azl'>" + ikon("arrowdown", 12) + (-d) + "</span>"; }
    return "<span class='fark nt'>" + ikon("minus", 12) + "</span>";
  }

  function pilotHucresi(kod, ad) {
    return "<span class='pilot'>" + (kod ? "<span class='kod v3-driver-code'>" + esc(kod) + "</span>" : "") + esc(ad) + "</span>";
  }

  var ULKE = {
    "Australia": "au", "China": "cn", "Japan": "jp", "Bahrain": "bh", "Saudi Arabia": "sa", "USA": "us", "United States": "us",
    "Italy": "it", "Monaco": "mc", "Spain": "es", "Canada": "ca", "Austria": "at", "UK": "gb", "United Kingdom": "gb",
    "Belgium": "be", "Hungary": "hu", "Netherlands": "nl", "Azerbaijan": "az", "Singapore": "sg", "Mexico": "mx", "Brazil": "br",
    "UAE": "ae", "United Arab Emirates": "ae", "Qatar": "qa", "Malaysia": "my", "Portugal": "pt", "Turkey": "tr", "Germany": "de",
    "France": "fr", "Russia": "ru", "South Korea": "kr", "Korea": "kr", "India": "in", "Argentina": "ar", "Morocco": "ma",
    "Sweden": "se", "Switzerland": "ch", "Finland": "fi", "Vietnam": "vn", "Indonesia": "id"
  };
  // Bayrak küçük bir görsel olarak flagcdn.com'dan gelir; yüklenemezse ülke kodu yazısı kalır.
  function bayrak(ulke) {
    var k = ULKE[ulke];
    if (!k) { return "<span class='bayrak bayrak-yok'>" + ikon("flag", 16) + "</span>"; }
    return "<span class='bayrak'><span class='bayrak-kod'>" + k.toUpperCase() + "</span>" +
           "<img src='https://flagcdn.com/w40/" + k + ".png' alt='" + esc(ulke) + "' loading='lazy' onerror='this.remove()'></span>";
  }

  // Race Feed olayı -> zaman çizelgesi kartı. takimlar: bu olaydaki pilotların takım adları (index.html hesaplar)
  function olaySatiri(o, takimlar) {
    var k = KATEGORI[o.category] || KATEGORI_NOTR;
    var saat = new Date(o.timestamp).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    var rozetler = "";
    if (o.translationFallback) { rozetler += "<span class='rozet'>EN</span>"; }
    if (o.status === "unconfirmed") { rozetler += "<span class='rozet'>Doğrulanmadı</span>"; }
    var tk = (takimlar || []).map(takimRozeti).join("");
    return "<div class='tl-oge" + (o.priority === "high" ? " yuksek" : "") + "' style='--kc:" + k.renk + "'>" +
             "<div class='tl-ust'><span class='tl-saat'>" + saat + "</span><span class='tl-nokta'>·</span>" +
               "<span class='tl-kat'>" + ikon(k.ikon, 14) + esc(o.category) + "</span>" + rozetler + "</div>" +
             "<div class='tl-metin'>" + esc(o.textTr) + "</div>" +
             "<div class='tl-alt'>" + tk + "<a href='" + esc(o.sourceUrl) + "' target='_blank' rel='noopener'>" + esc(o.sourceName) + "</a></div>" +
           "</div>";
  }

  // ---------- 5. susle(): statik menü ve başlıklara ikon ekler ----------
  var MENU_IKON = {
    "btn-sampiyonlar": "trophy", "btn-sezon": "calendar", "btn-profil": "helmet", "btn-grafik": "chart",
    "btn-yarisgrup": "checker", "btn-diger": "layers"
  };
  var BASLIK_IKON = {
    "pilotlar puan durumu": "trophy", "takımlar puan durumu": "layers", "takvim": "calendar", "sezonun pistleri": "track",
    "şampiyonluk hesaplayıcı": "gauge", "sonuçlar ve pozisyon değişimi": "trophy", "pit stoplar": "tyre", "tur süreleri": "stopwatch",
    "pist hava durumu": "rain", "yarış notları": "radio", "sonuçlar": "trophy", "pilotlar": "helmet", "takımlar": "layers"
  };

  function susle() {
    // Üst bar (Race Control)
    var nav = document.querySelector("body > nav");
    if (nav && !document.getElementById("rc-bar")) {
      var bar = document.createElement("div");
      bar.id = "rc-bar"; bar.className = "rc-bar";
      bar.innerHTML = "<div class='rc-sol'><span class='rc-logo'>F1</span><span class='rc-ad'>TAKİP</span><span class='rc-ayrac'></span>" +
                      "<span class='rc-alt'>RACE CONTROL</span></div>" +
                      "<div class='rc-sag'><span class='rc-nokta'></span><span id='rc-saat'>--:--:--</span><span class='rc-yerel'>LOCAL</span></div>";
      nav.parentNode.insertBefore(bar, nav);
      var saatYaz = function () { var e = document.getElementById("rc-saat"); if (e) { e.textContent = new Date().toLocaleTimeString("tr-TR"); } };
      saatYaz(); setInterval(saatYaz, 1000);
    }
    // Yarış adları İngilizce: büyük harfe çevirirken Türkçe i/İ kuralı uygulanmasın
    var gb = document.getElementById("gun-baslik"); if (gb) { gb.setAttribute("lang", "en"); }
    // Menü ikonları (düğme metni ve id'ler aynı kalır; sekmeAc sadece className'i değiştirir)
    Object.keys(MENU_IKON).forEach(function (id) {
      var b = document.getElementById(id);
      if (!b || b.querySelector(".ik")) { return; }
      var yazi = b.textContent;
      b.setAttribute("aria-label", yazi); b.title = yazi;
      b.innerHTML = ikon(MENU_IKON[id], 16) + "<span class='nav-ad'>" + yazi + "</span>";
    });
    var tb = document.getElementById("btn-tema");
    if (tb && !tb.querySelector(".ik")) {
      tb.innerHTML = "<span class='tema-ik tema-ay'>" + ikon("moon", 16) + "</span><span class='tema-ik tema-gunes'>" + ikon("sun", 16) + "</span><span class='nav-ad'>Koyu / Açık</span>";
    }
    // Bölüm başlıkları
    var hler = document.querySelectorAll("h2");
    for (var i = 0; i < hler.length; i++) {
      var h = hler[i];
      if (h.querySelector(".ik")) { continue; }
      var anahtar = h.textContent.trim().toLocaleLowerCase("tr-TR");
      h.insertAdjacentHTML("afterbegin", ikon(BASLIK_IKON[anahtar] || "flag", 16));
    }
    // Düğmelere küçük ikon
    var fy = document.getElementById("feed-yenile"), gy = document.getElementById("gun-yenile");
    if (fy && !fy.querySelector(".ik")) { fy.insertAdjacentHTML("afterbegin", ikon("rotate", 14)); }
    if (gy && !gy.querySelector(".ik")) { gy.insertAdjacentHTML("afterbegin", ikon("rotate", 14)); }
  }

  window.F1UI = {
    ikon: ikon, esc: esc, TAKIM_TEMALARI: TAKIM_TEMALARI, takimTemasi: takimTemasi, takimRozeti: takimRozeti,
    KATEGORI: KATEGORI, pozRozet: pozRozet, farkRozeti: farkRozeti, pilotHucresi: pilotHucresi, bayrak: bayrak,
    olaySatiri: olaySatiri, susle: susle
  };

  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", susle); } else { susle(); }
})();
