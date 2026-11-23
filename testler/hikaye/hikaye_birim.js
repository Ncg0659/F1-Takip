// Yarışın Hikâyesi v1 — saf katman birim testleri (Node). Çıktı: JSON [{ad, ok, ek}]
const H = require("../../yaris-hikaye.js"), RC = require("../../race-control.js"), SD = require("../../sampiyonluk-durum.js");
const { yukle } = require("./fixture.js");
const S = [];
const k = (ad, ok, ek) => S.push({ ad, ok: !!ok, ek: ek === undefined ? "" : ek });
const anahtar = o => o.tip + "|" + o.tur + "|" + o.pilotlar.slice().sort().join(",") + "|" + o.baslik;

// ---- 1) GERÇEK fixture: 2025 Hollanda GP ----
const { g } = yukle();
const r = H.kur(g), O = r.olaylar, tip = t => O.filter(o => o.tip === t);
k("F1 olay sayısı okunur aralıkta (8–20)", O.length >= 8 && O.length <= 20, O.length);
k("F2 ilk kart START (tur 1), son kartlar BİTİŞ + ŞAMPİYONLUK", O[0].tip === "START" && O[0].tur === 1 && O[O.length - 2].tip === "FINISH" && O[O.length - 1].tip === "SAMPIYONLUK");
k("F3 olaylar tur sırasına göre (artan)", O.every((o, i) => i === 0 || o.tur >= O[i - 1].tur));
k("F4 START: pole = sıralama P1 (Piastri), grid ilk 3, ilk tur sonu lider", O[0].baslik === "Piastri ilk turu önde tamamladı" && O[0].satirlar.includes("Pole: Piastri") && O[0].satirlar.includes("Grid ilk 3: Piastri · Norris · Verstappen"), O[0]);
const sc = tip("SC").map(o => o.tur + "-" + o.turBit), vsc = tip("VSC").map(o => o.tur + "-" + o.turBit);
k("F5 race_control: 3 SC (23–26, 53–57, 65–68) + 1 VSC (31–32), açıklamalı", JSON.stringify(sc) === JSON.stringify(["23-26", "53-57", "65-68"]) && JSON.stringify(vsc) === JSON.stringify(["31-32"]) && tip("SC").every(o => /sollama yapılmaz/.test(o.aciklama)), { sc, vsc });
const p23 = tip("PIT").filter(o => o.tur === 23)[0];
k("F6 pit: tur 23 tek grup kartı (SC sırasında), lider/podyum pitleri satırlarda", p23 && /pilot pite girdi \(güvenlik aracı sırasında\)/.test(p23.baslik) && p23.satirlar[0] === "Piastri P1'den pit yaptı, piste P1 döndü. MEDIUM → HARD" && p23.satirlar.length <= 4, p23);
k("F7 her pit için ayrı kart yok (pit kartı ≤ 4)", tip("PIT").length <= 4, tip("PIT").length);
const dnf = tip("DNF").map(o => o.pilotlar[0] + "@" + o.tur);
k("F8 DNF: Hamilton (tur 23), Leclerc (53), Norris (65; sınıflandırıldı ama çekildi) — sebep yazılmaz", JSON.stringify(dnf) === JSON.stringify(["hamilton@23", "leclerc@53", "norris@65"]) && tip("DNF").every(o => !/kaza|çarp|şasi|arıza|collision|accident|chassis/i.test(o.baslik + o.aciklama)), dnf);
const poz = O.filter(o => ["LIDER", "PODYUM", "ILK10", "BUYUK"].includes(o.tip));
k("F9 pozisyon olayları var ve en çok 8", poz.length >= 1 && poz.length <= H.EN_COK_POZ, poz.length);
k("F10 podyum değişimi tur 65: Hadjar podyuma girdi (P4 → P3)", poz.some(o => o.tur === 65 && o.tip === "PODYUM" && /Hadjar podyuma girdi \(P4 → P3\)/.test(o.aciklama + (o.satirlar || []).join())));
k("F11 her pozisyon değişimi eşiği geçiyor (P1/podyum/ilk 10 sınırı ya da ≥3 sıra)", poz.every(o => (o.satirlar || [o.aciklama]).every(t => { const m = /P(\d+) → P(\d+)/.exec(t); if (!m) { return o.tip === "LIDER"; } const a = +m[1], b = +m[2]; return (a > 3) !== (b > 3) || (a > 10) !== (b > 10) || Math.abs(a - b) >= 3 || b === 1; })));
k("F12 son turun resmî (cezalı) sonucu pozisyon olayı üretmez (FİNİŞ anlatır)", !poz.some(o => o.tur === 72));
k("F13 duplicate kart yok", new Set(O.map(anahtar)).size === O.length);
const fin = tip("FINISH")[0];
k("F14 BİTİŞ: kazanan, podyum, gridden en çok yükselen, pit yolundan başlayan", fin.baslik === "Piastri kazandı" && fin.satirlar.includes("Podyum: Piastri · Verstappen · Hadjar") && fin.satirlar.some(s => /^Gridden en çok yükselen: Stroll \(P19 → P7, \+12\)$/.test(s)) && fin.satirlar.includes("Bearman pit yolundan başlayıp P6 bitirdi"), fin.satirlar);
const sm = tip("SAMPIYONLUK")[0];
k("F15 şampiyonluk: puan durumundan (tur 14 → 15) fark 9 → 34, aday sayısı azaldı", sm.baslik === "Şampiyonada fark açıldı" && sm.satirlar[0] === "Piastri – Norris: 9 → 34 puan." && /Şampiyonluk şansı olan pilot sayısı \d+ → \d+\./.test(sm.satirlar[1] || ""), sm.satirlar);
const YASAK = /undercut|overcut|strateji|sayesinde|nedeniyle|yüzünden|kazandırdı|momentum|psikoloj|aşınma|degradasyon/i;
k("F16 yorum/sebep dili yok", !O.some(o => YASAK.test(o.baslik + o.aciklama + (o.satirlar || []).join(" "))));
k("F17 lastik bilgisi yalnız eşleşen stintten (MEDIUM → HARD)", p23.satirlar.every(s => /(SOFT|MEDIUM|HARD|INTERMEDIATE|WET) → (SOFT|MEDIUM|HARD|INTERMEDIATE|WET)/.test(s)));
k("F18 deterministik: aynı girdi → aynı çıktı", JSON.stringify(H.kur(yukle().g)) === JSON.stringify(r));
// favori: yeni olay türü üretmez; yalnız mevcut kartlar işaretlenir (pit önceliği hariç: favori pilotun piti zaten bir pit olayıdır)
const rf = H.kur(yukle({ favori: "hadjar" }).g);
k("F19 favori (Hadjar): işaretli kartlar var, pit dışı olay sayısı değişmedi", rf.olaylar.some(o => o.fav) && rf.olaylar.filter(o => o.tip !== "PIT").length === O.filter(o => o.tip !== "PIT").length && O.every(o => !o.fav), rf.olaylar.filter(o => o.fav).map(o => o.tip + o.tur));

// ---- 2) Eksik veri: OpenF1 yok → START + BİTİŞ + DNF + şampiyonluk; sınırlı ----
const g2 = Object.assign({}, g, { rc: null, pit: null, stint: null, pozisyon: null, turBas: null });
const r2 = H.kur(g2);
k("M1 OpenF1 yok: sınırlı=true, START/BİTİŞ/ŞAMPİYONLUK var, bayrak/pit/pozisyon yok", r2.sinirli && r2.olaylar[0].tip === "START" && r2.olaylar.some(o => o.tip === "FINISH") && r2.olaylar.some(o => o.tip === "SAMPIYONLUK") && !r2.olaylar.some(o => ["SC", "VSC", "PIT", "LIDER", "PODYUM", "ILK10", "BUYUK"].includes(o.tip)), r2.olaylar.map(o => o.tip));
k("M2 OpenF1 yok: START 'Yarış başladı' (ilk tur lideri uydurulmaz)", r2.olaylar[0].baslik === "Yarış başladı");
k("M3 boş sonuç → olay yok, hata yok", H.kur({}).olaylar.length === 0 && H.kur({ sonuc: [] }).sinirli === true);
k("M4 position var, tur başlangıcı yok → pozisyon olayı üretilmez", !H.kur(Object.assign({}, g, { turBas: null })).olaylar.some(o => ["LIDER", "PODYUM", "ILK10", "BUYUK"].includes(o.tip)));

// ---- 3) Sentetik: eşik, liderlik, birleştirme, kırmızı bayrak, şampiyonluk ----
const D = (id, kod, no, grid, pos, laps, st) => ({ number: String(no), position: String(pos), positionText: String(pos), grid: String(grid), laps: String(laps), status: st || "Finished", Driver: { driverId: id, code: kod, familyName: id[0].toUpperCase() + id.slice(1) }, Constructor: { name: "T" } });
const son = [D("ana", "ANA", 1, 1, 1, 5), D("bob", "BOB", 2, 2, 2, 5), D("cem", "CEM", 3, 3, 3, 5), D("dan", "DAN", 4, 11, 4, 5), D("ege", "EGE", 5, 14, 13, 5), D("fil", "FIL", 6, 5, 14, 5)];
for (let i = 7; i <= 16; i++) { son.push(D("p" + i, "P" + i, i, i <= 13 ? (i === 11 || i === 14 ? 4 : i) : i, i + 2, 5)); }
const T0 = Date.parse("2026-01-01T12:00:00Z"), tb = { 1: T0, 2: T0 + 100e3, 3: T0 + 200e3, 4: T0 + 300e3, 5: T0 + 400e3 };
const P = (t, dn, p) => ({ date: new Date(T0 + t * 1000).toISOString(), driver_number: dn, position: p });
const pos = [P(-1, 1, 1), P(-1, 2, 2), P(-1, 3, 3), P(-1, 4, 11), P(-1, 5, 14), P(-1, 6, 5),
  P(150, 2, 1), P(150, 1, 2),            // tur 2: BOB liderliğe geçer
  P(250, 4, 10), P(250, 7, 11),          // tur 3: DAN ilk 10'a (P11 → P10)
  P(260, 5, 13), P(260, 8, 14),          // tur 3: EGE P14 → P13 (önemsiz)
  P(350, 6, 9)];                          // tur 4: FIL P5 → P9 (≥3 geriledi; podyum dışı)
const r3 = H.kur({ sonuc: son, pozisyon: pos, turBas: tb });
const t3 = r3.olaylar.map(o => o.tip + "@" + o.tur);
k("S1 P1 değişimi kartı (tur 2: Bob liderliğe geçti)", r3.olaylar.some(o => o.tip === "LIDER" && o.tur === 2 && o.baslik === "Bob liderliğe geçti" && /P2'den P1'e/.test(o.aciklama)), t3);
k("S2 ilk 10'a giriş kartı (P11 → P10)", r3.olaylar.some(o => o.tip === "ILK10" && o.tur === 3 && /Dan ilk 10'a girdi \(P11 → P10\)/.test(o.aciklama + (o.satirlar || []).join())));
k("S3 küçük değişim (P14 → P13) gösterilmez", !r3.olaylar.some(o => /Ege/.test(o.aciklama + (o.satirlar || []).join())));
k("S4 tek turda ≥3 sıra kaybı kartı (P5 → P9)", r3.olaylar.some(o => o.tip === "BUYUK" && /Fil bir turda 4 sıra geriledi \(P5 → P9\)/.test(o.aciklama)));
// birleştirme: lider pit yapıp liderliği bırakırsa ayrı LİDERLİK kartı yok; pit kartına "liderliğe geçti" satırı eklenir
const pos4 = pos.slice(0, 6).concat([P(150, 2, 1), P(150, 1, 2)]);
const r4 = H.kur({ sonuc: son, pozisyon: pos4, turBas: tb, pit: [{ driver_number: 1, lap_number: 2 }] });
const pk = r4.olaylar.filter(o => o.tip === "PIT");
k("S5 lider pit + liderlik değişimi tek kartta (duplicate yok)", !r4.olaylar.some(o => o.tip === "LIDER") && pk.length === 1 && (pk[0].satirlar || []).some(s => s === "Bob liderliğe geçti."), r4.olaylar.map(o => o.tip + "@" + o.tur + ":" + JSON.stringify(o.satirlar || o.aciklama)));
// kırmızı bayrak + açık "RESUMED"
const rcR = RC.normalize([
  { date: "2026-01-01T12:05:00Z", lap_number: 2, category: "Flag", flag: "RED", message: "RED FLAG" },
  { date: "2026-01-01T12:30:00Z", lap_number: 2, category: "Other", message: "RACE WILL RESUME AT 12:40" },
  { date: "2026-01-01T12:40:00Z", lap_number: 3, category: "SessionStatus", message: "SESSION RESUMED" }], {}).olaylar;
const r5 = H.kur({ sonuc: son, rc: rcR });
k("S6 KIRMIZI BAYRAK kartı + açıkça bildirilen yeniden başlama kartı (ayrı)", r5.olaylar.some(o => o.tip === "RED" && o.tur === 2 && /durduruldu/.test(o.aciklama)) && r5.olaylar.some(o => o.tip === "RESUMED" && o.tur === 3), r5.olaylar.map(o => o.tip + "@" + o.tur));
k("S7 'yeniden başlayacak' duyurusu RESUMED sayılmaz (RESTART ANNOUNCED ≠ RESUMED)", r5.olaylar.filter(o => o.tip === "RESUMED").length === 1);
// şampiyonluk: belli oldu / liderlik değişti / fark kapandı — tek kaynak sampiyonluk-durum.js
const ST = (a, b) => [{ points: String(a), Driver: { driverId: "ana", code: "ANA", givenName: "Kimi", familyName: "Ana" } }, { points: String(b), Driver: { driverId: "bob", code: "BOB", givenName: "Bob", familyName: "Bob" } }];
const yar = [1, 2, 3, 4].map(n => ({ round: String(n) }));
const SH = (a, b, t) => SD.hesapla({ sezon: "2026", pilotlar: ST(a, b), puanTuru: t, yarislar: yar });
const c1 = H.kur({ sonuc: son, samp: { once: SH(100, 60, 2), sonra: SH(125, 60, 3) } }).olaylar.filter(o => o.tip === "SAMPIYONLUK")[0];
k("C1 şampiyon belli oldu → 'Kimi Ana 2026 Dünya Şampiyonu' (premium ton)", c1 && c1.baslik === "Kimi Ana 2026 Dünya Şampiyonu" && c1.ton === "sampiyon", c1);
const ST2 = (a, b) => [{ points: String(b), Driver: { driverId: "bob", code: "BOB", givenName: "Bob", familyName: "Bob" } }, { points: String(a), Driver: { driverId: "ana", code: "ANA", givenName: "Ana", familyName: "Ana" } }];
const c2 = H.kur({ sonuc: son, samp: { once: SH(100, 90, 2), sonra: SD.hesapla({ sezon: "2026", pilotlar: ST2(100, 115), puanTuru: 3, yarislar: yar }) } }).olaylar.filter(o => o.tip === "SAMPIYONLUK")[0];
k("C2 liderlik değişti → 'Şampiyonada liderlik değişti' (Ana → Bob)", c2 && c2.baslik === "Şampiyonada liderlik değişti" && /Ana → Bob/.test(c2.satirlar[0]), c2);
const c3 = H.kur({ sonuc: son, samp: { once: SH(100, 70, 1), sonra: SH(110, 95, 2) } }).olaylar.filter(o => o.tip === "SAMPIYONLUK")[0];
k("C3 fark kapandı (30 → 15)", c3 && c3.baslik === "Şampiyonada fark kapandı" && /30 → 15 puan/.test(c3.satirlar[0]), c3);
k("C4 puan durumu yoksa şampiyonluk kartı yok (uydurma yok)", !H.kur({ sonuc: son }).olaylar.some(o => o.tip === "SAMPIYONLUK"));
k("C5 Türkçe ek: P1'den · P3'ten · P6'dan · P10'dan · P20'den", ["P1'den", "P3'ten", "P6'dan", "P10'dan", "P20'den"].join() === [1, 3, 6, 10, 20].map(H._pdan).join());
console.log(JSON.stringify(S));
