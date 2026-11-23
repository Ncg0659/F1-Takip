// Gerçek fixture'ı (2025 Hollanda GP) YarisHikaye.kur girdisine çevirir. Node ve tarayıcı testleri aynı girdiyi kullanır.
const fs = require("fs"), path = require("path");
const K = require("../../race-control.js"), SD = require("../../sampiyonluk-durum.js");
function yukle(opt) {
  opt = opt || {};
  const O = JSON.parse(fs.readFileSync(path.join(__dirname, "openf1_9920_kompakt.json"), "utf8"));
  const J = JSON.parse(fs.readFileSync(path.join(__dirname, "jolpica_2025_15.json"), "utf8"));
  const t0 = Date.parse(O.t0), iso = s => new Date(t0 + s * 1000).toISOString();
  const rcRaw = O.rc.map(r => ({ date: iso(r[0]), lap_number: r[1], category: r[2], flag: r[3], scope: r[4], driver_number: r[5], message: r[6], session_key: O.session_key }));
  const rc = K.normalize(rcRaw, { sessionKey: O.session_key }).olaylar;
  const turBas = {}; O.tur_bas.forEach(x => { turBas[x[0]] = t0 + x[1] * 1000; });
  const g = {
    sonuc: J.results.Results, pole: J.qualifying_p1.Driver.driverId, rc,
    pit: O.pit.map(p => ({ driver_number: p[1], lap_number: p[2], date: iso(p[0]) })),
    stint: O.st.map(s => ({ driver_number: s[0], stint_number: s[1], lap_start: s[2], lap_end: s[3], compound: s[4] })),
    pozisyon: O.pos.map(p => ({ date: iso(p[0]), driver_number: p[1], position: p[2] })), turBas,
    samp: { once: SD.hesapla({ sezon: "2025", pilotlar: J.standings_14.DriverStandings, puanTuru: 14, yarislar: J.races }),
            sonra: SD.hesapla({ sezon: "2025", pilotlar: J.standings_15.DriverStandings, puanTuru: 15, yarislar: J.races }) },
    favori: opt.favori || null
  };
  return { g, O, J, rcRaw };
}
module.exports = { yukle };
if (require.main === module) {
  const H = require("../../yaris-hikaye.js"); const { g } = yukle({ favori: process.argv[2] });
  const r = H.kur(g); console.log("olay:", r.olaylar.length, "sınırlı:", r.sinirli, JSON.stringify(r.kaynak));
  r.olaylar.forEach(o => console.log(("TUR " + o.tur + (o.turBit ? "–" + o.turBit : "")).padEnd(10), o.tip.padEnd(11), o.fav ? "★" : " ", o.baslik, "|", o.aciklama, o.satirlar ? JSON.stringify(o.satirlar) : ""));
}
