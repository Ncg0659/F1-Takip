/* A2.3 — Detay Paneli'nin ilk kullanımı: Güncel Sezon yarış kartı "Detay" düğmesi.
   sezon-takvim.js'e DOKUNMAZ: #a2-takvim üzerinde yakalama fazında "Detay" tıklamasını alır, paneli açar ve olayı durdurur
   (eski satır içi aç/kapa çalışmaz). DetayPanel yoksa bu dosya hiçbir şey yapmaz ve eski satır içi Detay aynen çalışır. */
(function () {
  var F = window.F1UI, JI = window.JolpicaIstemci, HV = window.HaftaVeri;
  var OMUR = 24 * 3600 * 1000;
  function esc(x) { return F ? F.esc(x) : String(x); }
  function sezonYili() { try { return typeof SEZON !== "undefined" ? SEZON : new Date().getFullYear(); } catch (e) { return new Date().getFullYear(); } }
  function durum() { return window.SezonTakvim && SezonTakvim._durum ? SezonTakvim._durum : {}; }
  function kod(k) { return "<span class='st-k'>" + esc(k) + "</span>"; }
  function kisi(p) { return p ? { html: kod(p.k) + " " + esc(p.a) + " <small class='st-soluk'>" + esc(p.t) + "</small>" } : "—"; }

  function tarihYaz(y) {
    try { return new Date(y.date + "T" + (y.time || "12:00:00Z")).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: (HV && HV.ANA_TZ) || "Europe/Istanbul" }); } catch (e) { return y.date; }
  }

  // Kullanıcı tıklamasıyla yapılan TEK çağrı: arka plandaki toplu yüklemelerin kuyruğunda beklemesin diye doğrudan fetch;
  // önbellek anahtarı/biçimi JolpicaIstemci ile ortak (sezon-<yıl>-detay-r<tur>, 24 saat).
  async function tamSonuc(tur) {
    var sezon = sezonYili(), anahtar = "sezon-" + sezon + "-detay-r" + tur;
    var kayit = JI.oku(anahtar), veri = kayit && Date.now() - kayit.t < OMUR ? kayit.veri : null;
    if (!veri) {
      var cevap = await fetch("https://api.jolpi.ca/ergast/f1/" + sezon + "/" + tur + "/results/?limit=30");
      if (!cevap.ok) { throw new Error("sunucu cevabı: " + cevap.status); }
      veri = (await cevap.json()).MRData;
      var kt = veri && veri.RaceTable && veri.RaceTable.Races && veri.RaceTable.Races[0];
      if (kt && kt.Results && kt.Results.length) { JI.kaydet(anahtar, veri); }
    }
    var yarislar = veri && veri.RaceTable && veri.RaceTable.Races;
    var liste = yarislar && yarislar[0] && yarislar[0].Results;
    if (!liste || !liste.length) { throw new Error("sonuç yok"); }
    return {
      tablo: {
        baslik: ["Poz", "Pilot", "Takım", "Start", "Değişim", "Puan"],
        satirlar: liste.map(function (x) {
          var g = Number(x.grid);
          return [{ html: F.pozRozet(x.positionText) }, { html: F.pilotHucresi(x.Driver.code, x.Driver.givenName + " " + x.Driver.familyName) }, { html: F.takimRozeti(x.Constructor.name) },
                  g > 0 ? g : "Pit", { html: F.farkRozeti(x.grid, x.position) }, x.points != null ? x.points : "—"];
        })
      }
    };
  }

  function yarisAnalizineGit(tur) {
    try {
      if (window.DetayPanel) { DetayPanel.kapat(); }
      if (typeof window.sekmeAc === "function") { window.sekmeAc("yaris"); }
      var sec = document.getElementById("yaris-sec");
      if (sec && Array.prototype.some.call(sec.options, function (o) { return o.value === String(tur); })) { sec.value = String(tur); sec.dispatchEvent(new Event("change")); }
    } catch (e) { /* önemsiz */ }
  }

  function ac(tur) {
    var m = durum().model; if (!m) { return false; }
    var y = (m.yarislar || []).filter(function (x) { return Number(x.round) === tur; })[0];
    var t = m.turlar && m.turlar[tur];
    if (!y || !t || !t.kazanan) { return false; }
    return DetayPanel.ac({
      id: "yaris-" + tur, baslik: y.raceName, lang: "en", alt: "Tur " + tur + " · " + tarihYaz(y),
      donus: function () { return document.querySelector("#a2-takvim .st-detay[data-tur='" + tur + "']"); },
      yukle: async function () {
        var ozet = [["Kazanan", kisi(t.kazanan) ]];
        if (t.kazanan.s) { ozet.push(["Süre", t.kazanan.s]); }
        if (t.p2) { ozet.push(["2.", kisi(t.p2)]); }
        if (t.p3) { ozet.push(["3.", kisi(t.p3)]); }
        if (t.pole) { ozet.push(["Pole", kisi(t.pole)]); }
        if (t.sprint) { ozet.push(["Sprint kazananı", kisi(t.sprint)]); }
        return { bolumler: [
          { baslik: "Özet", satirlar: ozet },
          { baslik: "Tüm sonuç", tembel: function () { return tamSonuc(tur); } },
          { eylemler: [{ ad: "Yarış Analizi'nde aç", tikla: function () { yarisAnalizineGit(tur); } }] }
        ] };
      }
    });
  }

  function baslat() {
    var kap = document.getElementById("a2-takvim");
    if (!kap || !window.DetayPanel || !F || !JI) { return; }                  // eksik parça: eski satır içi Detay çalışır
    document.documentElement.classList.add("dp-var");
    kap.addEventListener("click", function (e) {
      var d = e.target.closest ? e.target.closest(".st-detay") : null;
      if (!d) { return; }
      var tur = Number(d.getAttribute("data-tur"));
      var acildi = false;
      try { acildi = ac(tur); } catch (x) { acildi = false; }
      if (acildi) { d.setAttribute("aria-haspopup", "dialog"); e.stopImmediatePropagation(); e.preventDefault(); }
    }, true);
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", baslat); } else { baslat(); }
})();
