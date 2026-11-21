// OPENF1 A7.2 — saf katman birim testleri. Fixture SENTETİK (gerçek Singapur laps verisine erişilemedi).
const L = require("/home/claude/f1-takip/laps-veri.js");
let ok = 0, bad = 0;
function t(ad, c, ek) { if (c) { ok++; console.log("PASS " + ad); } else { bad++; console.log("FAIL " + ad + " | " + (ek || "")); } }
const lap = (dn, ln, dur, o) => Object.assign({ session_key: 1, meeting_key: 9, driver_number: dn, lap_number: ln, lap_duration: dur, duration_sector_1: 28.4, duration_sector_2: 30.1, duration_sector_3: dur ? +(dur - 58.5).toFixed(3) : null,
  i1_speed: 300, i2_speed: 280, st_speed: 297, is_pit_out_lap: false, segments_sector_1: [2048, 2049], segments_sector_2: [2048], segments_sector_3: [2051], date_start: "2026-10-09T08:35:00.000000+00:00" }, o || {});
const rows = [lap(1, 1, 95.2, { is_pit_out_lap: true }), lap(1, 2, 91.156), lap(1, 3, 91.9, { st_speed: 301 }), lap(1, 4, null), lap(2, 1, 92.5), lap(2, 2, 90.0, { st_speed: null }), lap(3, 1, null)];
const N = L.normalize(rows, { sessionKey: 1, meetingKey: 9 });
t("L1 normalize: tüm satırlar, alanlar eşlendi", N.turlar.length === 7 && N.turlar[1].lapDuration === 91.156 && N.turlar[1].sector1 === 28.4 && N.turlar[1].i1Speed === 300 && N.turlar[1].segmentsSector1.length === 2 && N.turlar[1].dateStart.startsWith("2026-10-09T08:35:00"));
t("L2 lapDuration null kalır (uydurma yok)", N.turlar.find((x) => x.driverNumber === 1 && x.lapNumber === 4).lapDuration === null);
const eksik = L.normalize([{ session_key: 1, driver_number: 5, lap_number: 1, lap_duration: 90.1 }], { sessionKey: 1 }).turlar[0];
t("L3 sektör/hız/segment eksik → null", eksik.sector1 === null && eksik.sector3 === null && eksik.i1Speed === null && eksik.stSpeed === null && eksik.segmentsSector2 === null && eksik.dateStart === null && eksik.isPitOutLap === false);
const P = L.pilotOzetleri(N.turlar), p1 = P.find((x) => x.driverNumber === 1), p2 = P.find((x) => x.driverNumber === 2), p3 = P.find((x) => x.driverNumber === 3);
t("L4 pit-out tur en hızlı/süreli sayısına girmez", p1.sureliTur === 2 && p1.enHizli.lapNumber === 2 && p1.toplamTur === 4, JSON.stringify(p1));
t("L5 en hızlı tur hesabı (min süre)", p1.enHizli.lapDuration === 91.156 && p2.enHizli.lapDuration === 90.0 && L.sureYaz(91.156) === "1:31.156");
t("L6 geçerli(süreli) tur sayısı", p2.sureliTur === 2 && p3.sureliTur === 0);
t("L7 sadece süresiz turu olan pilot: enHizli null, sonda", p3.enHizli === null && P[P.length - 1].driverNumber === 3 && P[0].driverNumber === 2);
t("L8 speed trap eksik: tüm turlarda yoksa null; varsa max", p2.maxStSpeed === 297 && L.normalize([lap(7, 1, 90, { st_speed: null })]).turlar.length === 1 && L.pilotOzetleri(L.normalize([lap(7, 1, 90, { st_speed: null })]).turlar)[0].maxStSpeed === null && p1.maxStSpeed === 301);
const D = L.normalize([lap(1, 2, null), lap(1, 2, 91.0), lap(1, 2, 92.0)], { sessionKey: 1 });
t("L9 yinelenen tur tek; süreli olan tercih edilir", D.turlar.length === 1 && D.turlar[0].lapDuration === 91.0 && D.tekrar === 2, JSON.stringify(D));
t("L10 yanlış session_key izolasyonu", L.normalize([lap(1, 1, 90, { session_key: 2 }), lap(1, 2, 91)], { sessionKey: 1 }).turlar.length === 1);
t("L11 başka meeting (round) karışmaz", L.normalize([lap(1, 1, 90, { meeting_key: 10 })], { sessionKey: 1, meetingKey: 9 }).turlar.length === 0);
t("L12 bozuk girdi güvenli", L.normalize(null).turlar.length === 0 && L.normalize([null, { lap_number: 1 }, "x"]).atilan === 3);
t("L13 biçim: sektör/hız/süre", L.sektorYaz(28.412) === "28.412" && L.sektorYaz(null) === "—" && L.hizYaz(297.4) === "297 km/s" && L.hizYaz(null) === "—" && L.sureYaz(59.9) === "59.900" && L.sureYaz(60.05) === "1:00.050");
const sk = L.sikistir(N.turlar), ac = L.ac(sk, 1);
t("L14 sıkıştır/aç: alanlar korunur, segment atılır", ac.length === 7 && ac[1].lapDuration === 91.156 && ac[1].segmentsSector1 === null && ac[0].isPitOutLap === true && ac[1].dateStart === N.turlar[1].dateStart);
const buyuk = []; for (let d = 1; d <= 22; d++) for (let l = 1; l <= 60; l++) buyuk.push(lap(d, l, 90 + (l % 7) * 0.1 + d * 0.01, { segments_sector_1: [2048, 2049, 2048, 2051, 2048, 2049, 2048, 2049], segments_sector_2: Array(8).fill(2048), segments_sector_3: Array(8).fill(2048) }));
const bn = L.normalize(buyuk, { sessionKey: 1 }).turlar, ham = JSON.stringify(buyuk).length, sik = JSON.stringify(L.sikistir(bn)).length;
t("L15 boyut: 22×60 tur sıkıştırılmış < 200 KB ve ham JSON'dan çok küçük", sik < 200000 && sik < ham / 3, ham + " -> " + sik);
t("L16 ozet: pilot/toplam/süreli + en hızlı", (() => { const o = L.ozet(N.turlar); return o.pilotSayisi === 3 && o.toplamTur === 7 && o.enHizliTur.driverNumber === 2 && o.enHizliTur.lapDuration === 90; })());
t("L17 mesajlar ayrı", L.durumMesaji("bos") === "Tur verisi henüz yayımlanmadı." && L.durumMesaji("hata") === "OpenF1 tur verisine şu anda ulaşılamıyor." && L.durumMesaji("ok") === "");
// A7.2b — segments_sector_*: Race/Sprint'te yok (normal), Q/FP'de varsa korunur
const yarisHam = [lap(1, 1, 91, { segments_sector_1: undefined, segments_sector_2: undefined, segments_sector_3: undefined }), lap(1, 2, 90.5, { segments_sector_1: null, segments_sector_2: [], segments_sector_3: undefined })];
const yarisN = L.normalize(yarisHam, { sessionKey: 1 }), yarisP = L.pilotOzetleri(yarisN.turlar);
t("L18 Race + segments yok → normal: tur atılmaz, hata/uyarı yok, özet tam, segmentVarMi=false", yarisN.turlar.length === 2 && yarisN.atilan === 0 && yarisN.turlar[0].segmentsSector1 === null && yarisN.turlar[0].segmentsSector3 === null && L.segmentVarMi(yarisN.turlar) === false && yarisP[0].enHizli.lapDuration === 90.5 && yarisP[0].sureliTur === 2);
const qN = L.normalize([lap(1, 2, 91.156), lap(2, 2, 90.0)], { sessionKey: 1 });
t("L19 Q/FP + segments var → korunur ve segmentVarMi=true", qN.turlar[0].segmentsSector1.length === 2 && qN.turlar[0].segmentsSector2[0] === 2048 && qN.turlar[0].segmentsSector3[0] === 2051 && L.segmentVarMi(qN.turlar) === true);
console.log("\nboyut: ham " + ham + " B, sıkıştırılmış " + sik + " B (22 pilot × 60 tur)");
console.log(ok + "/" + (ok + bad)); process.exit(bad ? 1 : 0);
