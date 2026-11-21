"use strict";
const fs = require("fs"), K = require("./kalibrasyon_lib.js"), L = K.L, TM = K.TM;
const ds = JSON.parse(fs.readFileSync(__dirname + "/veri-f1db-2020-2026.json", "utf8"));
(async () => {
  const taban = K.kopya(K.ESKI.AGIRLIK), tabanT = K.kopya(K.ESKI.SICAKLIK);
  const { tv } = L.veriKatmani(ds), SEZ = [2023, 2024, 2025, 2026], out = { yontem: "ileri-zincir: 2024<-2023 | 2025<-2023-24 | 2026<-2023-25", taban: taban, tabanT: tabanT, mod: {} };
  for (const mod of ["PRE_WEEKEND", "POST_QUALIFYING"]) {
    const T = await L.calistir(ds, { tv: tv, sezonlar: SEZ, modlar: [mod], ozellikleriTut: true });
    const adaylar = mod === "POST_QUALIFYING" ? K.postAdaylar(taban[mod]) : K.preAdaylar(taban[mod]);
    const eski = { mod: mod, agirlik: taban[mod], sicaklik: tabanT };
    const R = { adayN: adaylar.length, foldlar: [], yarisN: {} };
    SEZ.forEach(s => { R.yarisN[s] = T.filter(t => t.season === s).length; });
    const degerle = (cfg, yar) => { const uni = K.uniOlc(yar), x = K.skorlar(K.calistirCfg(cfg, yar), uni); return { J: K.J(x), ...x.m, skill: { bw: x.sBW, ll: x.sLL, bp: x.sBP, bq: x.sBQ } }; };
    for (const f of K.FOLDLAR) {
      const tr = T.filter(t => f.train.indexOf(t.season) >= 0), va = T.filter(t => t.season === f.val);
      const sira = K.sec(mod, adaylar, tr, taban[mod]), en = sira[0], cfg = { mod: mod, agirlik: en.agirlik, sicaklik: en.sicaklik };
      R.foldlar.push({ val: f.val, trainYaris: tr.length, valYaris: va.length, secilen: { ad: en.ad, agirlik: en.agirlik, sicaklik: en.sicaklik, egitimJ: en.egitimJ },
        ilk3: sira.slice(0, 3).map(x => [x.ad, +x.egitimJ.toFixed(4)]), egitimdeEski: degerle(eski, tr).J, validEski: degerle(eski, va), validYeni: degerle(cfg, va) });
    }
    // son model: 2023-2025 eğitimiyle seçilen (fold 2026) ; sezon bazlı rapor
    const son = R.foldlar[2].secilen, sonCfg = { mod: mod, agirlik: son.agirlik, sicaklik: son.sicaklik };
    R.son = son; R.sezon = {};
    [2024, 2025, 2026].forEach(s => { const va = T.filter(t => t.season === s); R.sezon[s] = { eski: degerle(eski, va), yeni: degerle(sonCfg, va) }; });
    const va3 = T.filter(t => t.season >= 2024); R.havuz = { eski: degerle(eski, va3), yeni: degerle(sonCfg, va3) };
    // bazlar (aynı küme)
    const ids = t => t.suruculer.map(s => s.driver), grid = L.gridTablosu(ds, [2020, 2021, 2022, 2023]);
    const bz = (fn) => L.olc(va3.map(t => Object.assign(fn(t), { gercek: t.gercek })));
    R.baz = mod === "PRE_WEEKEND" ? { puanOrantili: bz(t => L.bazPre(ds, t.season, t.round, ids(t))) } : { gridHarmonik: bz(t => L.bazPost(ds, t.season, t.round, ids(t))), gridEmpirik: bz(t => L.bazGridEmp(ds, t.season, t.round, ids(t), grid)) };
    // aday ızgarası (POST için grid duyarlılığı: tüm 2024-26 üzerinde, sıcaklık eğitim seçimiyle)
    if (mod === "POST_QUALIFYING") { R.gridDuyarlilik = adaylar.map(a => { const sr = K.sec(mod, [a], T.filter(t => t.season <= 2025 && t.season >= 2023), taban[mod])[0]; const c = { mod: mod, agirlik: sr.agirlik, sicaklik: sr.sicaklik }; return { ad: a.ad, grid: a.grid, egitimJ: sr.egitimJ, s24: degerle(c, T.filter(t => t.season === 2024)).J, s25: degerle(c, T.filter(t => t.season === 2025)).J, s26: degerle(c, T.filter(t => t.season === 2026)).J }; }); }
    // güven + kalibrasyon (son model, 2024-26)
    const pr = va3.map(t => { const o = TM.AGIRLIK[mod], oS = K.kopya(TM.PARAM.SICAKLIK[mod]); TM.AGIRLIK[mod] = son.agirlik; Object.assign(TM.PARAM.SICAKLIK[mod], son.sicaklik); try { const p = TM.racePredict(t.ozellikler); return { gercek: t.gercek, suruculer: p.suruculer.map(s => ({ driver: s.driver, win: s.winProbability, pod: s.podiumProbability, pts: s.pointsProbability, conf: s.confidence, sev: s.confidenceSeviye })) }; } finally { TM.AGIRLIK[mod] = o; Object.assign(TM.PARAM.SICAKLIK[mod], oS); } });
    R.guven = L.guvenGruplari(pr);
    const ms = pr.map(t => Object.assign(L.motorSatir(t), { gercek: t.gercek }));
    R.kalibrasyonYeni = { win: L.kovalar(ms, "win", [0, 0.1, 0.2, 0.3, 0.4, 1.0001]), podium: L.kovalar(ms, "pod", [0, 0.2, 0.4, 0.6, 0.8, 1.0001]) };
    out.mod[mod] = R;
  }
  fs.writeFileSync(__dirname + "/kalibrasyon_sonuc_v2.json", JSON.stringify(out, null, 1)); console.log("tamam");
})();
