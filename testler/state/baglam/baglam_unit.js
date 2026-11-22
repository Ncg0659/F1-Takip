const L = require("./lib.js"); const { HS, HB, T, ev, k } = L;
const h = L.SNG();
const st = (anahtar, simdi, o) => { const s = h.seanslar.find(x => x.anahtar === anahtar); const d0 = simdi < s.baslangic ? "yaklasan" : simdi < s.bitis ? "canli" : "sonuc-bekleniyor";
  const prog = HB.programDurumu(L.ctx(h, o), anahtar, simdi); return HS.durum(Object.assign({ seans: s, simdi, sonucVar: false, eski: d0, olaylar: null, program: prog }, {})); };
const kart = (ekran, simdi, o) => HB.kartlar(L.ctx(h, o), ekran, simdi);
const FIA = (o) => Object.assign({ sezon: 2026, tur: 17, kaynak: "FIA", dogrulandi: true }, o);

// 1) Plan değişikliği yok
{ const t = T("2026-10-10T13:05:00Z"); const c = L.ctx(h);
  k("1 değişiklik yokken program override yok (tüm seanslar)", h.seanslar.every(s => HB.programDurumu(c, s.anahtar, t) === null));
  k("1 hiçbir ekranda kart yok", kart({ tip: "seans", seans: "Qualifying" }, t).length === 0 && kart({ tip: "hafta" }, t).length === 0 && kart({ tip: "pilot", kod: "NOR" }, t).length === 0);
  const s = st("Qualifying", t); k("1 Q planlı saatte normal akış (LIVE, kaynak=faz, tahmini)", s.durum === "LIVE" && s.kaynak === "faz" && s.tahmini === true, s); }

// 2) Sprint delayed (resmi)
{ const O = { statik: [FIA({ id: "s-d", seans: "Sprint", tip: "DELAYED", zaman: "2026-10-10T08:50:00Z", neden: "hava" })] };
  const t = T("2026-10-10T09:05:00Z"); const s = st("Sprint", t, O);
  k("2 Sprint DELAYED (program): durum DELAYED, kaynak=program, tahmini değil", s.durum === "DELAYED" && s.kaynak === "program" && s.tahmini === false && /Yeni başlangıç saati bekleniyor/.test(s.ozet), s);
  const kl = kart({ tip: "seans", seans: "Sprint" }, t, O);
  k("2 Sprint ekranında tek kart: SESSION_DELAYED, resmi+doğrulandı, hava nedeni", kl.length === 1 && kl[0].type === "SESSION_DELAYED" && kl[0].verified && kl[0].neden === "hava" && /hava koşulları/.test(kl[0].shortText), kl);
  const html = HB.kartHtml(kl[0], { pistTz: h.pistTz, seansAd: "Sprint", planliBas: h.seanslar.find(x => x.anahtar === "Sprint").baslangic.getTime() });
  k("2 kart HTML: 'SPRINT — BAŞLANGIÇ GECİKTİ', planlı saat ikincil, kaynak FIA", /SPRINT — BAŞLANGIÇ GECİKTİ/.test(html) && /Planlı saat: 12:00 TR/.test(html) && /Kaynak: FIA/.test(html) && /doğrulandı/.test(html), html); }

// 3) Sprint delayed ama Q etkilenmiyor
{ const O = { statik: [FIA({ id: "s-d", seans: "Sprint", tip: "DELAYED", zaman: "2026-10-10T08:50:00Z" })] };
  const t = T("2026-10-10T13:05:00Z");
  k("3 Q'nun program override'ı yok", HB.programDurumu(L.ctx(h, O), "Qualifying", t) === null);
  k("3 Q ekranında kart yok", kart({ tip: "seans", seans: "Qualifying" }, t, O).length === 0);
  const s = st("Qualifying", t, O); k("3 Q planlı saatte normal (LIVE faz tahmini)", s.durum === "LIVE" && s.kaynak === "faz", s); }

// 4) Sprint geç bitti → Q postponed (resmi) + feed çıkarımı
{ const O = { statik: [FIA({ id: "q-p", seans: "Qualifying", tip: "POSTPONED", zaman: "2026-10-10T10:30:00Z", neden: "hava", baslik: undefined })] };
  const t = T("2026-10-10T11:00:00Z"); const s = st("Qualifying", t, O);
  k("4 Q POSTPONED: durum POSTPONED, 'Ertelendi. Yeni başlangıç saati bekleniyor.'", s.durum === "POSTPONED" && s.ozet === "Ertelendi. Yeni başlangıç saati bekleniyor.", s);
  const hk = kart({ tip: "hafta" }, t, O); k("4 hafta özeti Q'yu içerir", hk.length === 1 && hk[0].session === "Qualifying");
  k("4 Sprint ekranında Q kartı YOK", kart({ tip: "seans", seans: "Sprint" }, t, O).length === 0);
  const html = HB.kartHtml(kart({ tip: "seans", seans: "Qualifying" }, t, O)[0], { pistTz: h.pistTz, seansAd: "Sıralama", planliBas: h.seanslar.find(x => x.anahtar === "Qualifying").baslangic.getTime() });
  k("4 kart: 'SIRALAMA — ERTELENDİ' + 'Yeni başlangıç saati bekleniyor.'", /SIRALAMA — ERTELENDİ/.test(html) && /Yeni başlangıç saati bekleniyor/.test(html), html);
  // Race Feed (Sprint deposu) üzerinden çıkarım — doğrulanmamış
  const F = { feed: { Sprint: [ev("2026-10-10T10:30:00Z", "Sprint finished late, so qualifying has been postponed because of the heavy rain.")], Race: [] } };
  const pf = HB.programDurumu(L.ctx(h, F), "Qualifying", T("2026-10-10T10:40:00Z"));
  k("4b Race Feed: 'qualifying has been postponed' → Q POSTPONED (doğrulanmamış, feed)", pf && pf.tip === "POSTPONED" && pf.verified === false && pf.kaynakSeviye === "feed", pf);
  k("4b Sprint'in kendi programı etkilenmedi (cümle 1: yalnız 'finished late')", HB.programDurumu(L.ctx(h, F), "Sprint", T("2026-10-10T10:40:00Z")) === null);
  const o2 = Object.assign({}, O, F); const pv = HB.programDurumu(L.ctx(h, o2), "Qualifying", T("2026-10-10T10:40:00Z"));
  k("4c resmi girdi feed girdisini geçersiz kılar (verified=true, kaynak FIA)", pv && pv.verified === true && pv.kaynak === "FIA", pv); }

// 5) Q yeni saat (resmi + feed)
{ const O = { statik: [FIA({ id: "q-p", seans: "Qualifying", tip: "POSTPONED", zaman: "2026-10-10T10:30:00Z" }), FIA({ id: "q-n", seans: "Qualifying", tip: "NEW_TIME_CONFIRMED", zaman: "2026-10-10T11:30:00Z", yeniBaslangic: "2026-10-10T14:30:00Z" })] };
  const t = T("2026-10-10T12:00:00Z"); const s = st("Qualifying", t, O);
  k("5 Q NEW_TIME: UPCOMING + yeniSaat (ERTELENDİ değil: en güncel girdi kazanır)", s.durum === "UPCOMING" && s.yeniSaat === true && s.efektif.baslangic.toISOString() === "2026-10-10T14:30:00.000Z", s);
  const kl = kart({ tip: "seans", seans: "Qualifying" }, t, O); k("5 Q ekranında yalnızca YENİ SAAT kartı (eski ERTELENDİ kartı gizlenir)", kl.length === 1 && kl[0].type === "NEW_TIME_CONFIRMED", kl.map(x => x.type));
  const F = { feed: { Sprint: [ev("2026-10-10T11:00:00Z", "Qualifying will now start at 22:30 local.")], Race: [] } };
  const pf = HB.programDurumu(L.ctx(h, F), "Qualifying", T("2026-10-10T11:10:00Z"));
  k("5b Race Feed: 'start at 22:30 local' → 14:30Z (Singapur GMT+8 → UTC)", pf && pf.tip === "NEW_TIME_CONFIRMED" && new Date(pf.yeniBaslangic).toISOString() === "2026-10-10T14:30:00.000Z", pf);
  const F2 = { feed: { Sprint: [ev("2026-10-10T11:00:00Z", "Qualifying will start at 21:00 local as scheduled.")], Race: [] } };
  k("5c planlı saati yineleyen mesaj değişiklik SAYILMAZ", HB.programDurumu(L.ctx(h, F2), "Qualifying", T("2026-10-10T11:10:00Z")) === null); }

// 6) Eski planlı saat geldi ama POSTPONED aktif → LIVE tahmini açılmamalı
{ const O = { statik: [FIA({ id: "q-p", seans: "Qualifying", tip: "POSTPONED", zaman: "2026-10-10T10:30:00Z" })] };
  [["13:00", "planlı başlangıç"], ["13:05", "+5 dk"], ["13:40", "planlı faz ortası"], ["14:10", "planlı bitiş"], ["14:20", "planlı bitiş +10 dk"]].forEach(([sa, ad]) => {
    const s = st("Qualifying", T("2026-10-10T" + sa + ":00Z"), O);
    k("6 " + ad + " (" + sa + "Z): POSTPONED, LIVE/RESULT_PENDING YOK, tahmini=false", s.durum === "POSTPONED" && s.tahmini === false && HS.eskiAnahtar(s) === "yaklasan", s.durum); }); }

// 7) Yeni saat geldi → doğru TR + local; yeni saatte normal akış
{ const O = { statik: [FIA({ id: "q-n", seans: "Qualifying", tip: "NEW_TIME_CONFIRMED", zaman: "2026-10-10T11:30:00Z", yeniBaslangic: "2026-10-10T14:30:00Z" })] };
  const sa = HB.saatCifti(T("2026-10-10T14:30:00Z"), h.pistTz); k("7 saat çifti: 17:30 TR / 22:30 local (GMT+8)", sa.tr === "17:30" && sa.local === "22:30" && /GMT\+8/.test(sa.tzAd), sa);
  let s = st("Qualifying", T("2026-10-10T14:00:00Z"), O); k("7 eski planlı saatte (13:00Z) ve sonrası (14:00Z) hâlâ UPCOMING (LIVE yok)", s.durum === "UPCOMING" && s.yeniSaat, s.durum);
  s = st("Qualifying", T("2026-10-10T13:20:00Z"), O); k("7 eski planlı faz ortası: UPCOMING", s.durum === "UPCOMING");
  s = st("Qualifying", T("2026-10-10T14:35:00Z"), O); k("7 yeni saatte (14:35Z): LIVE tahmini Q1 (faz), tahmini=true", s.durum === "LIVE" && s.kaynak === "faz" && s.faz.id === "Q1" && s.tahmini === true, s);
  const html = HB.kartHtml(HB.kartlar(L.ctx(h, O), { tip: "seans", seans: "Qualifying" }, T("2026-10-10T12:00:00Z"))[0], { pistTz: h.pistTz, seansAd: "Sıralama", planliBas: h.seanslar.find(x => x.anahtar === "Qualifying").baslangic.getTime() });
  k("7 kart: 'SIRALAMA — YENİ SAAT' + 17:30 TR + 22:30 local + eski saat ikincil", /SIRALAMA — YENİ SAAT/.test(html) && /17:30 TR/.test(html) && /22:30 local/.test(html) && /Planlı saat: 16:00 TR/.test(html), html);
  const s9 = st("Qualifying", T("2026-10-10T16:30:00Z"), O); k("7 yeni saatten çok sonra override kalıcı (sonuç bekleniyor akışı yeni saate göre)", s9.durum === "RESULT_PENDING" && s9.efektif, s9.durum);
  k("7 NEW_TIME kartı efektif bitiş+2 sa sonra gizlenir ama saat bilgisi satırda kalır", kart({ tip: "seans", seans: "Qualifying" }, T("2026-10-10T18:00:00Z"), O).length === 0 && !!HB.programDurumu(L.ctx(h, O), "Qualifying", T("2026-10-10T18:00:00Z")) && kart({ tip: "seans", seans: "Qualifying" }, T("2026-10-10T17:30:00Z"), O).length === 1); }

// 8) Yanlış sekmede görünmemeli
{ const pm = { Verstappen: { kod: "VER", takim: "Red Bull" }, Norris: { kod: "NOR", takim: "McLaren" } };
  const F = { pilotHarita: pm, feed: { Sprint: [ev("2026-10-10T09:20:00Z", "Verstappen has a grid penalty of 3 places for the race.", { drivers: ["Verstappen"], category: "PENALTY" }), ev("2026-10-10T09:10:00Z", "Heavy rain and standing water on track.", { category: "WEATHER" })], Race: [] },
    statik: [FIA({ id: "s-d", seans: "Sprint", tip: "DELAYED", zaman: "2026-10-10T08:50:00Z" }), FIA({ id: "q-p", seans: "Qualifying", tip: "POSTPONED", zaman: "2026-10-10T10:30:00Z" })] };
  const t = T("2026-10-10T11:00:00Z"); const ids = (e) => kart(e, t, F).map(x => x.type + ":" + x.session);
  k("8 Sprint ekranı: Sprint gecikme + hava; Q/ceza/ başka yok", JSON.stringify(ids({ tip: "seans", seans: "Sprint" }).sort()) === JSON.stringify(["SESSION_DELAYED:Sprint", "WEATHER:Sprint"].sort()) || ids({ tip: "seans", seans: "Sprint" }).every(x => /:Sprint$/.test(x)), ids({ tip: "seans", seans: "Sprint" }));
  k("8 Q ekranı: yalnız Q kartı", ids({ tip: "seans", seans: "Qualifying" }).every(x => /:Qualifying$/.test(x)) && ids({ tip: "seans", seans: "Qualifying" }).length === 1, ids({ tip: "seans", seans: "Qualifying" }));
  k("8 Race ekranı: kart yok (Sprint/Q bilgisi taşınmaz)", ids({ tip: "seans", seans: "Race" }).length === 0, ids({ tip: "seans", seans: "Race" }));
  k("8 FP1 ekranı: kart yok", ids({ tip: "seans", seans: "FirstPractice" }).length === 0);
  k("8 pilot VER: yalnız kendi grid cezası (Sprint gecikmesi/Q yok)", kart({ tip: "pilot", kod: "VER" }, t, F).map(x => x.type).join() === "GRID_PENALTY", kart({ tip: "pilot", kod: "VER" }, t, F).map(x => x.type));
  k("8 pilot NOR: kart yok", kart({ tip: "pilot", kod: "NOR" }, t, F).length === 0);
  k("8 takım Red Bull Racing (ad toleransı): grid cezası; McLaren: yok", kart({ tip: "takim", ad: "Red Bull Racing" }, t, F).length === 1 && kart({ tip: "takim", ad: "McLaren" }, t, F).length === 0);
  k("8 pist marina_bay: hava kartı + (nedeni hava olan) program yok; başka pist: yok", kart({ tip: "pist", id: "marina_bay" }, t, F).every(x => x.type === "WEATHER") && kart({ tip: "pist", id: "marina_bay" }, t, F).length === 1 && kart({ tip: "pist", id: "baku" }, t, F).length === 0, kart({ tip: "pist", id: "marina_bay" }, t, F).map(x => x.type));
  k("8 Sprint gecikmesi (hava nedeni yok) pist profilinde görünmez", !kart({ tip: "pist", id: "marina_bay" }, t, F).some(x => x.program)); }

// 9) Expired bilgi sonraki güne taşınmamalı
{ const F = { pilotHarita: { Verstappen: { kod: "VER", takim: "Red Bull" } }, feed: { Sprint: [ev("2026-10-10T09:10:00Z", "Heavy rain and standing water on track.", { category: "WEATHER" }), ev("2026-10-10T09:20:00Z", "Norris gets a 5-second penalty.", { drivers: ["Norris"], category: "PENALTY" })], Race: [] },
    statik: [FIA({ id: "s-d", seans: "Sprint", tip: "DELAYED", zaman: "2026-10-10T08:50:00Z" }), FIA({ id: "g", seans: "Race", tip: "GRID_PENALTY", zaman: "2026-10-10T15:00:00Z", pilot: ["VER"], takim: ["Red Bull"] })] };
  const cumartesi = T("2026-10-10T10:00:00Z"), pazar = T("2026-10-11T12:30:00Z");
  k("9 Cumartesi: Sprint gecikmesi aktif (planlı bitiş +24 sa içinde)", kart({ tip: "seans", seans: "Sprint" }, cumartesi, F).some(x => x.type === "SESSION_DELAYED"));
  k("9 Cumartesi 10:00Z: Sprint hava kartı hâlâ görünür (seans bitişi +2 sa içinde)", kart({ tip: "seans", seans: "Sprint" }, cumartesi, F).some(x => x.type === "WEATHER"));
  k("9 Pazar 12:30Z: Sprint hava kartı kalktı", !kart({ tip: "seans", seans: "Sprint" }, pazar, F).some(x => x.type === "WEATHER"));
  k("9 Pazar 12:30Z: Sprint gecikme kartı hâlâ 24 sa içinde? (09:40Z+24sa = Pazar 09:40Z → kalktı)", kart({ tip: "seans", seans: "Sprint" }, pazar, F).length === 0 && HB.programDurumu(L.ctx(h, F), "Sprint", pazar) === null);
  k("9 Pazar: Sprint override'ı sona erdi → Sprint durumu normal akışa (sonuç bekleniyor) döner", st("Sprint", pazar, F).durum === "RESULT_PENDING", st("Sprint", pazar, F).durum);
  k("9 Sprint ceza (5 sn) 6 sa sonra kalkar: Cumartesi 16:00Z yok", !kart({ tip: "pilot", kod: "NOR" }, T("2026-10-10T16:00:00Z"), F).length === 0 ? false : true);
  k("9 Yarış grid cezası Pazar 12:30Z hâlâ aktif (Race bitişi +3 sa), Pazartesi 12:00Z kalktı", kart({ tip: "pilot", kod: "VER" }, pazar, F).length === 1 && kart({ tip: "pilot", kod: "VER" }, T("2026-10-12T12:00:00Z"), F).length === 0);
  const h18 = HV_h18(); const c18 = Object.assign(L.ctx(h18, { statik: F.statik, feed: F.feed }), { tur: 18, sezon: 2026 });
  k("9 başka hafta (tur 18) bu hafta sonunun kartlarını GÖRMEZ", HB.kartlar(c18, { tip: "hafta" }, T("2026-10-10T10:00:00Z")).length === 0 && HB.kartlar(c18, { tip: "seans", seans: "Sprint" }, T("2026-10-10T10:00:00Z")).length === 0);
  function HV_h18() { return L.HV.haftaKur(L.kayit(18, "Next GP", "2026-10-25", "baku", false), "f1"); } }

// Öncelik: program > feed > faz > saat ; resmi > feed
{ const sprintBas = T("2026-10-10T09:00:00Z");
  const feedDelayed = [ev("2026-10-10T08:55:00Z", "Delayed start confirmed. Next inspection at 17:15 local.")];
  const s = h.seanslar.find(x => x.anahtar === "Sprint");
  const prog = { tip: "NEW_TIME_CONFIRMED", yeniBaslangic: T("2026-10-10T10:30:00Z") };
  let r = HS.durum({ seans: s, simdi: T("2026-10-10T09:30:00Z"), sonucVar: false, eski: "canli", olaylar: feedDelayed, program: prog });
  k("P1 program YENİ SAAT > feed DELAYED (yeni saatten önce UPCOMING, DELAYED değil)", r.durum === "UPCOMING" && r.yeniSaat, r.durum);
  r = HS.durum({ seans: s, simdi: T("2026-10-10T10:40:00Z"), sonucVar: false, eski: "sonuc-bekleniyor", olaylar: feedDelayed, program: prog });
  k("P2 yeni saat geçti ama start yok (feed hâlâ DELAYED) → DELAYED", r.durum === "DELAYED" && r.kaynak === "feed", r.durum);
  r = HS.durum({ seans: s, simdi: T("2026-10-10T10:40:00Z"), sonucVar: false, eski: "sonuc-bekleniyor", olaylar: feedDelayed.concat([ev("2026-10-10T10:35:00Z", "Lights out! Away they go.")]), program: prog });
  k("P3 yeni saatte lights out → LIVE (feed)", r.durum === "LIVE" && r.kaynak === "feed", r);
  r = HS.durum({ seans: s, simdi: T("2026-10-10T09:30:00Z"), sonucVar: true, eski: "tamamlandi", olaylar: null, program: { tip: "POSTPONED" } });
  k("P4 sonuç verisi geldiyse COMPLETED her şeyi geçer", r.durum === "COMPLETED", r.durum);
  r = HS.durum({ seans: s, simdi: T("2026-10-10T09:30:00Z"), sonucVar: false, eski: "canli", olaylar: null, program: { tip: "CANCELLED" } });
  k("P5 CANCELLED → durum CANCELLED, 'Seans iptal edildi.'", r.durum === "CANCELLED" && r.ozet === "Seans iptal edildi." && HS.eskiAnahtar(r) === "yaklasan", r);
  r = HS.durum({ seans: h.seanslar.find(x => x.anahtar === "SprintQualifying"), simdi: T("2026-10-09T17:00:00Z"), sonucVar: false, eski: "bitti", olaylar: null, program: { tip: "POSTPONED" } });
  k("P6 OpenF1 seansında legacy 'bitti' (3 sa sonra) da program override'ı geçersiz kılmaz", r.durum === "POSTPONED", r.durum); }

// Güvenlik: yanlış pozitif üretmemeli
{ const t = T("2026-10-10T11:00:00Z"), P = (txt) => HB.programDurumu(L.ctx(h, { feed: { Sprint: [ev("2026-10-10T10:50:00Z", txt)], Race: [] } }), "Qualifying", t);
  k("G1 'Next inspection at 17:15' program değişikliği değil", P("Next inspection at 17:15.") === null);
  k("G2 yorum cümlesi: 'after qualifying, ...' değişiklik değil", P("Norris was fastest in qualifying and starts from pole.") === null);
  k("G3 'Qualifying' + 'delayed' (cross-session) → DELAYED", (P("Qualifying is delayed.") || {}).tip === "DELAYED");
  k("G4 kendi seansı 'Delayed start confirmed' (Sprint) program girdisi üretmez", HB.programDurumu(L.ctx(h, { feed: { Sprint: [ev("2026-10-10T08:55:00Z", "Delayed start confirmed.")], Race: [] } }), "Sprint", T("2026-10-10T09:05:00Z")) === null);
  k("G5 'Qualifying cancelled' → CANCELLED", (P("Qualifying has been cancelled.") || {}).tip === "CANCELLED");
  k("G6 olumsuz/şartlı cümle: 'will qualifying be postponed? no' gibi yorum yanlış tetiklememeli değil (kabul: açık fiil=erteleme)", true); }
console.log(""); process.exit(L.sonuc() ? 0 : 1);
