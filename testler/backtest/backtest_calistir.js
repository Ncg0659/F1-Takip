// Gerçek (F1DB) verisiyle backtest. Kullanım: node backtest_calistir.js [çıktı.json]   (F1_UYG ile uygulama klasörü değiştirilebilir)
"use strict";
const fs = require("fs"), L = require("./backtest-lib.js");
const ds = JSON.parse(fs.readFileSync(__dirname + "/veri-f1db-2020-2026.json", "utf8"));
const SEZONLAR = [2024, 2025, 2026], MODLAR = ["PRE_WEEKEND", "POST_QUALIFYING"];
(async () => {
  const t0 = Date.now(), { tv, taklit } = L.veriKatmani(ds);
  const T = await L.calistir(ds, { tv: tv, sezonlar: SEZONLAR, modlar: MODLAR });
  const grid = L.gridTablosu(ds, [2020, 2021, 2022, 2023]), R = { meta: { kaynak: ds.kaynak, sezonlar: SEZONLAR, uretim: new Date().toISOString().slice(0, 10), istek: taklit.log.length, saniye: (Date.now() - t0) / 1000 }, sonuc: {} };
  for (const mod of MODLAR) {
    const kume = T.filter(t => t.mode === mod), ilk = (f) => kume.filter(f);
    const grupla = (liste) => {
      const motor = liste.map(t => Object.assign(L.motorSatir(t), { gercek: t.gercek }));
      const ids = (t) => t.suruculer.map(s => s.driver);
      const baz = {}, uni = liste.map(t => Object.assign(L.uniform(ids(t)), { gercek: t.gercek }));
      if (mod === "PRE_WEEKEND") { baz.puanOrantili = liste.map(t => Object.assign(L.bazPre(ds, t.season, t.round, ids(t)), { gercek: t.gercek })); }
      else { baz.gridHarmonik = liste.map(t => Object.assign(L.bazPost(ds, t.season, t.round, ids(t)), { gercek: t.gercek })); baz.gridEmpirik = liste.map(t => Object.assign(L.bazGridEmp(ds, t.season, t.round, ids(t), grid), { gercek: t.gercek })); }
      const o = { motor: L.olc(motor), uniform: L.olc(uni) }; Object.keys(baz).forEach(k => { o[k] = L.olc(baz[k]); });
      o.beceri = {}; Object.keys(o).forEach(k => { if (k !== "uniform" && k !== "beceri") { o.beceri[k] = L.beceriSkoru(o[k].brierWin, o.uniform.brierWin); } });
      return { o: o, motor: motor, baz: baz };
    };
    const tum = grupla(kume), sez = {};
    SEZONLAR.forEach(s => { const l = ilk(t => t.season === s); if (l.length) { sez[s] = grupla(l).o; } });
    R.sonuc[mod] = { toplam: tum.o, sezon: sez,
      kalibrasyon: { win: L.kovalar(tum.motor, "win", [0, 0.1, 0.2, 0.3, 0.4, 1.0001]), winBaseline: Object.fromEntries(Object.keys(tum.baz).map(k => [k, L.kovalar(tum.baz[k], "win", [0, 0.1, 0.2, 0.3, 0.4, 1.0001])])),
                     podium: L.kovalar(tum.motor, "pod", [0, 0.2, 0.4, 0.6, 0.8, 1.0001]), points: L.kovalar(tum.motor, "pts", [0, 0.2, 0.4, 0.6, 0.8, 1.0001]) },
      guven: L.guvenGruplari(kume), atlananPilot: kume.reduce((a, t) => a + t.atlanan.length, 0), nedenMaks: Math.max.apply(null, kume.map(t => Math.max.apply(null, t.suruculer.map(s => s.nedenSayisi)))) };
  }
  R.sampiyonluk = await L.sampiyonlukOlc(ds, tv, [2024, 2025], [0.25, 0.5, 0.75]);
  fs.writeFileSync(process.argv[2] || (__dirname + "/backtest_sonuc_v1.json"), JSON.stringify(R, null, 1));
  console.log("tamam", R.meta);
})();
