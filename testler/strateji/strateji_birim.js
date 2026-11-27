// Lastik ve Yarış Stratejisi (v3.2.0) — saf katman birim testleri (Node). Çıktı: JSON [{ad, ok, ek}]
// GERÇEK fixture: 2025 Hollanda GP (OpenF1 session 9920 stint/pit/race_control + Jolpica/F1DB sonuç). Tempo vakaları SENTETİK (açıkça işaretli).
const LH = require("../../lastik-hesap.js"), RC = require("../../race-control.js");
const fs = require("fs"), path = require("path");
const O = JSON.parse(fs.readFileSync(path.join(__dirname, "../hikaye/openf1_9920_kompakt.json"), "utf8"));
const J = JSON.parse(fs.readFileSync(path.join(__dirname, "../hikaye/jolpica_2025_15.json"), "utf8"));
const S = [], k = (ad, ok, ek) => S.push({ ad, ok: !!ok, ek: ek === undefined ? "" : ek });
const t0 = Date.parse(O.t0), iso = s => new Date(t0 + s * 1000).toISOString();
const stintRows = O.st.map(s => ({ driver_number: s[0], stint_number: s[1], lap_start: s[2], lap_end: s[3], compound: s[4], tyre_age_at_start: s[5] }));
const pit = O.pit.map(p => ({ driverNumber: p[1], lapNumber: p[2], laneDuration: p[3], stopDuration: p[4] }));
const sonuc = J.results.Results;
const R = LH.strateji({ stintRows, sonuc, pit });
const sat = id => R.satirlar.filter(s => s.id === id)[0];

// 1) stint uzunlukları ham kayıtla birebir (tamamlanan turla sınırlı)
let fark = [];
R.satirlar.forEach(s => {
  const ham = stintRows.filter(r => String(r.driver_number) === s.no).sort((a, b) => a.stint_number - b.stint_number);
  const bekl = ham.filter(r => r.lap_start <= s.tur).map(r => [r.lap_start, Math.min(r.lap_end, s.tur), r.compound]);
  const ger = s.stintler.map(x => [x.bas, x.bit, LH.ING[x.b.k]]);
  if (JSON.stringify(bekl) !== JSON.stringify(ger)) { fark.push(s.kod + " " + JSON.stringify(bekl) + " ≠ " + JSON.stringify(ger)); }
  s.stintler.forEach(x => { if (x.uzun !== x.bit - x.bas + 1) { fark.push(s.kod + " uzunluk"); } });
});
k("S1 her pilotun stint başlangıç/bitiş/lastik dizisi OpenF1 ham kaydıyla aynı; uzunluk = bitiş − başlangıç + 1", fark.length === 0 && R.satirlar.length === 20, fark.slice(0, 3));
const pia = sat("piastri");
k("S2 Piastri: MEDIUM 1–23 (23 tur) → HARD → HARD, son stint 72. turda biter", pia.stintler.length === 3 && pia.stintler[0].bas === 1 && pia.stintler[0].bit === 23 && pia.stintler[0].uzun === 23 && pia.stintler.map(x => x.b.k).join() === "medium,hard,hard" && pia.stintler[2].bit === 72, pia.stintler.map(x => x.bas + "-" + x.bit));
k("S3 lastik eşlemesi: SOFT/MEDIUM/HARD/INTERMEDIATE/WET doğru; bilinmeyen / boş → BİLİNMİYOR (tahmin yok)",
  ["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET", "HYPERSOFT", null, ""].map(c => LH.bilesik(c).k).join() === "soft,medium,hard,inter,wet,bilinmiyor,bilinmiyor,bilinmiyor", ["SOFT", "HYPERSOFT", null].map(c => LH.bilesik(c).k));
k("S4 sıralama resmî sonuç: P1 Piastri, P2 Verstappen, P3 Hadjar; sınıflandırılmayanlar sonda (tur sayısına göre)", R.satirlar.slice(0, 3).map(s => s.id).join() === "piastri,max_verstappen,hadjar" && R.satirlar.slice(-2).every(s => !s.siniflandi), R.satirlar.map(s => s.kod).join(" "));
// 2) pit eşleme
const eslesen = R.satirlar.reduce((a, s) => a + s.stintler.filter(x => x.pit).length, 0), degisim = R.satirlar.reduce((a, s) => a + Math.max(0, s.stintler.length - 1), 0);
const yanlis = []; R.satirlar.forEach(s => s.stintler.forEach(x => { if (x.pit && !(x.pit.tur === x.bas - 1 || x.pit.tur === x.bas)) { yanlis.push(s.kod); } }));
k("S5 pit eşleme: her pit kaydı yalnız bir stint geçişine, pit turu = yeni stintin bir önceki ya da aynı turu", yanlis.length === 0 && eslesen >= degisim - 2 && eslesen <= pit.length, { eslesen, degisim, pit: pit.length });
k("S6 Piastri pit turları ham pit kaydıyla aynı (23, 53)", JSON.stringify(pia.pitler.map(p => p.tur)) === JSON.stringify(pit.filter(p => p.driverNumber === 81).map(p => p.lapNumber).sort((a, b) => a - b)), pia.pitler);
// 3) DNF
const dnf = R.satirlar.filter(s => s.cekildi);
k("S7 DNF: Hamilton, Leclerc, Norris çekildi olarak işaretli; satır tamamlanan turda biter (sahte uzatma yok)", ["hamilton", "leclerc", "norris"].every(id => dnf.some(s => s.id === id)) && dnf.every(s => s.stintler.every(x => x.bit <= s.tur)), dnf.map(s => s.kod + ":" + s.tur + "/" + (s.stintler.slice(-1)[0] || {}).bit));
// 4) pit lane ≠ durağan
const p1 = pia.pitler[0], ham1 = O.pit.filter(p => p[1] === 81)[0];
k("S8 pit lane süresi ile durağan süre ayrı alanlarda; biri diğerinin yerine geçmez", p1.lane === ham1[3] && p1.durak === ham1[4] && p1.lane !== p1.durak, p1);
const Rd = LH.strateji({ stintRows, sonuc, pit: [{ driverNumber: 81, lapNumber: 23, laneDuration: 21.4, stopDuration: null }] });
k("S9 durağan süre kaynakta yoksa null (pit lane süresi durağan diye gösterilmez)", Rd.satirlar[0].pitler[0].lane === 21.4 && Rd.satirlar[0].pitler[0].durak === null);
const Rp = LH.strateji({ stintRows, sonuc, pit: null });
k("S10 pit verisi yoksa pit sayısı/turu null ('Veri yok'), 0 uydurulmaz", Rp.satirlar.every(s => s.pitler === null && s.pitSayisi === null));
// 5) eksik / bozuk veri (sentetik)
const Rs = LH.strateji({ stintRows: [{ driver_number: 81, stint_number: 1, lap_start: 1, lap_end: 30, compound: "MEDIUM" }, { driver_number: 81, stint_number: 2, lap_start: 31, lap_end: null, compound: "HARD" },
  { driver_number: 1, stint_number: 1, lap_start: 1, lap_end: 80, compound: "HARD" }, { driver_number: 1, stint_number: 2, lap_start: 75, lap_end: 80, compound: "SOFT" }], sonuc, pit: [] });
const s81 = Rs.satirlar.filter(s => s.no === "81")[0], s1 = Rs.satirlar.filter(s => s.no === "1")[0];
k("S11 açık son stint yalnız pilotun Jolpica tur sayısıyla kapanır; tamamlanan turdan sonra başlayan stint atılır (uyarı)", s81.stintler[1].bit === 72 && s1.stintler.length === 1 && s1.stintler[0].bit === 72 && Rs.uyari.length === 1, { s81: s81.stintler.map(x => x.bit), s1: s1.stintler.length, u: Rs.uyari });
k("S12 stint kaydı olmayan pilot: boş satır (stint üretilmez), veriVar=false yalnız hiç kayıt yoksa", Rs.satirlar.filter(s => !s.stintler.length).length === 18 && Rs.veriVar && !LH.strateji({ stintRows: [], sonuc, pit: [] }).veriVar);
// 6) özet
const oz = LH.stratejiOzet(R);
k("S13 strateji özeti en çok 3 deterministik bilgi", oz.length === 3 && oz[0] === "En uzun stint: Bearman, HARD ile 53 tur (tur 1–53)." && oz[1] === "Piastri yarışı 2 lastik değişimiyle kazandı: MEDIUM → HARD → HARD." && oz[2] === "Podyumdaki üç pilot üç farklı lastik dizilimi kullandı.", oz);
k("S14 özette yargı/sebep yok (en iyi, yanlış, undercut, aşınma, hata…)", !oz.some(t => /en iyi|yanlış|doğru strateji|undercut|overcut|aşınma|degradasyon|hata|sayesinde|nedeniyle|puan/i.test(t)));
k("S15 deterministik", JSON.stringify(LH.strateji({ stintRows, sonuc, pit })) === JSON.stringify(R) && JSON.stringify(LH.stratejiOzet(R)) === JSON.stringify(oz));
// 7) bayrak pencereleri (gerçek race_control)
const rcRaw = O.rc.map(r => ({ date: iso(r[0]), lap_number: r[1], category: r[2], flag: r[3], scope: r[4], driver_number: r[5], message: r[6], session_key: O.session_key }));
const W = LH.bayrakPencereleri(RC.normalize(rcRaw, { sessionKey: O.session_key }).olaylar);
k("S16 bayrak pencereleri race_control'den: 3 SC + 1 VSC, tur aralıkları Yarışın Hikâyesi ile aynı (23–26, 31–32, 53–57, 65–68)", W.map(w => w.tip + ":" + w.basTur + "-" + w.bitTur).join() === "SC:23-26,VSC:31-32,SC:53-57,SC:65-68", W.map(w => w.tip + ":" + w.basTur + "-" + w.bitTur));
// 8) tempo (SENTETİK turlar)
const satT = { no: "81", stintler: [{ bas: 1, bit: 12 }, { bas: 13, bit: 20 }] };
const T0 = Date.parse("2026-01-01T12:00:00Z"); let tt = T0; const turlar = [];
for (let n = 1; n <= 20; n++) {
  let d = 90 + (n % 3) * 0.2; if (n === 1) { d = 110; } if (n === 6) { d = null; } if (n === 9) { d = 105; } if (n === 13) { d = 112; }
  turlar.push({ driverNumber: 81, lapNumber: n, lapDuration: d, isPitOutLap: n === 13, dateStart: new Date(tt).toISOString() }); tt += (d || 90) * 1000;
}
const scW = [{ bas: Date.parse(turlar[16].dateStart) + 10000, bit: Date.parse(turlar[17].dateStart) + 5000 }];   // tur 17–18 SC, tur 19 = pencere sonrası ilk tur
const tp = LH.tempo(turlar, satT, scW);
k("S17 tempo hariç: 1. tur, pit giriş (stint sonu) ve çıkış turu, süresiz tur, %10+ yavaş tur ayrı sayılır", tp[0].haric.ilkTur === 1 && tp[0].haric.pit === 1 && tp[0].haric.sure === 1 && tp[0].haric.yavas === 1 && tp[0].kullanilan === 8, tp[0].haric);
k("S18 tempo: medyan ve en hızlı yalnız temiz turlardan", Math.abs(tp[0].medyan - 90.3) < 1e-9 && tp[0].enHizli === 90, [tp[0].medyan, tp[0].enHizli]);
k("S19 SC penceresiyle çakışan turlar ve pencere sonrası ilk tur hariç; temiz tur < 5 → tempo hesaplanmaz (null)", tp[1].haric.bayrak === 3 && tp[1].haric.pit === 1 && tp[1].kullanilan < LH.EN_AZ_TEMIZ && tp[1].medyan === null && tp[1].enHizli === null, tp[1]);
k("S20 tur verisi yoksa tempo null", LH.tempo(null, satT, []) === null && LH.tempo([], satT, []) === null);
// 9) DNS ve tutarsız kayıt (2026 Las Vegas gerçek doğrulamasında görülen durumlar; burada sentetik)
const sDns = JSON.parse(JSON.stringify(sonuc)); const hm = sDns.filter(r => r.Driver.driverId === "hamilton")[0]; hm.positionText = "DNS"; hm.position = ""; hm.laps = "0";
const Rn = LH.strateji({ stintRows, sonuc: sDns, pit }), hmS = Rn.satirlar.filter(x => x.id === "hamilton")[0];
k("S21 DNS (0 tur): kaynakta stint satırı olsa da blok çizilmez", hmS.dns && hmS.stintler.length === 0, hmS.stintler);
const Rt = LH.strateji({ stintRows, sonuc, pit: pit.concat([{ driverNumber: 87, lapNumber: 30, laneDuration: 20, stopDuration: 2 }]) });
const beaT = Rt.satirlar.filter(x => x.id === "bearman")[0], ozT = LH.stratejiOzet(Rt);
k("S22 pit kaydı stint geçişiyle eşleşmeyen pilot 'tutarsız' işaretlenir ve özet maddelerinde kullanılmaz", beaT.tutarli === false && !ozT.some(t => /Bearman/.test(t)) && R.satirlar.every(x => x.tutarli), ozT[0]);
const Re = LH.strateji({ stintRows: [1, 81].flatMap(no => [{ driver_number: no, stint_number: 1, lap_start: 1, lap_end: 30, compound: "SOFT" }, { driver_number: no, stint_number: 2, lap_start: 31, lap_end: 72, compound: "HARD" }]), sonuc, pit: null });
k("S23 eşit uzunlukta en uzun stint birden çok pilotta: tek pilot öne çıkarılmaz, sayı verilir", /^En uzun stint 42 tur; 2 pilot bu uzunlukta stint yaptı \(ör\. Piastri, HARD, tur 31–72\)\.$/.test(LH.stratejiOzet(Re)[0]), LH.stratejiOzet(Re)[0]);
console.log(JSON.stringify(S));
