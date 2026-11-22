// Ticker + program override (FeedCanli.tickerOturum) ve programDegisikligiOlustur — Node, gerçek dosyalar
const L = require("./lib.js"); const { T, k } = L; const path = require("path"); const F1 = "/home/claude/f1-takip";
const si = global.setInterval, st = global.setTimeout; global.setInterval = () => 0; global.setTimeout = () => 0;
global.sezonYarislar = [L.kayit(17, "Singapore Grand Prix", "2026-10-11", "marina_bay", true)];
const STORE = {}; window.RaceFeed = { yukle: key => ({ olaylar: STORE[key] || [] }) };
require(path.join(F1, "baglam-ui.js")); require(path.join(F1, "feed-canli.js"));
global.setInterval = si; global.setTimeout = st;
const FC = window.FeedCanli; let pad = 0;
const FIA = o => Object.assign({ sezon: 2026, tur: 17, kaynak: "FIA", dogrulandi: true }, o);
function kur(girdiler, feed, tamam) {            // her senaryoda ctx önbelleği yenilensin diye (uzunluk anahtarı) benzersiz dolgu
  const l = (girdiler || []).slice(); pad++; while (l.length < pad * 20) l.push({});   // her senaryoda farklı uzunluk (ctx önbellek anahtarı)
  window.PROGRAM_DEGISIKLIK = l; STORE["2026-17-sprint"] = (feed && feed.Sprint) || []; STORE["2026-17"] = (feed && feed.Race) || [];
  window.YarisHaftasi = tamam ? { _durum: { hafta: Object.assign(L.SNG(), { sonuclar: tamam }) } } : undefined;
}
const o = (iso) => FC.tickerOturum(T(iso));
const durum = (iso) => { const r = o(iso); return r ? r.oturum + ":" + r.durum : null; };

// 1) Normal Sprint / Race, override yok
kur([]);
k("1 Sprint planlı 09:10Z: canli, eski davranış (canli() ile aynı alanlar)", durum("2026-10-10T09:10:00Z") === "Sprint:canli" && o("2026-10-10T09:10:00Z").raceKey === "2026-17-sprint" && FC.canli(T("2026-10-10T09:10:00Z")).bas === o("2026-10-10T09:10:00Z").bas);
k("1 Race planlı 12:30Z: canli", durum("2026-10-11T12:30:00Z") === "Race:canli");
k("1 planlı süre dışı (Sprint 09:41Z, Q arası): ticker yok", durum("2026-10-10T09:50:00Z") === null && durum("2026-10-10T13:10:00Z") === null);

// 2) Sprint DELAYED
kur([FIA({ id: "d", seans: "Sprint", tip: "DELAYED", zaman: "2026-10-10T08:50:00Z" })]);
k("2 Sprint DELAYED: 09:10Z gecikti (LIVE değil)", durum("2026-10-10T09:10:00Z") === "Sprint:gecikti");
k("2 DELAYED: planlı bitişten sonra (+1 sa) hâlâ gecikti satırı; +3 sa sonra kalkar", durum("2026-10-10T10:40:00Z") === "Sprint:gecikti" && durum("2026-10-10T12:50:00Z") === null);
k("2 açıklamadan ÖNCE (08:40Z) bir şey yok; seans başlamadan satır yok", durum("2026-10-10T08:40:00Z") === null);
k("2 Race etkilenmez", durum("2026-10-11T12:30:00Z") === "Race:canli");
// 3) POSTPONED
kur([FIA({ id: "p", seans: "Sprint", tip: "POSTPONED", zaman: "2026-10-10T08:50:00Z" })]);
k("3 Sprint POSTPONED: ertelendi", durum("2026-10-10T09:10:00Z") === "Sprint:ertelendi");
// 3b) CANCELLED
kur([FIA({ id: "c", seans: "Sprint", tip: "CANCELLED", zaman: "2026-10-10T08:50:00Z" })]);
k("3b Sprint CANCELLED: iptal", durum("2026-10-10T09:10:00Z") === "Sprint:iptal");
// 4) Sprint NEW_TIME (planlı 09:00 → 10:30Z; süre 40 dk)
kur([FIA({ id: "d", seans: "Sprint", tip: "DELAYED", zaman: "2026-10-10T08:50:00Z" }), FIA({ id: "n", seans: "Sprint", tip: "NEW_TIME_CONFIRMED", zaman: "2026-10-10T09:05:00Z", yeniBaslangic: "2026-10-10T10:30:00Z" })]);
k("4 NEW_TIME: eski planlı saatte (09:10Z) LIVE yok, satır da yok", durum("2026-10-10T09:10:00Z") === null);
const y = o("2026-10-10T10:35:00Z");
k("4 yeni saatte (10:35Z) canli, bas/bit YENİ saate göre", y && y.durum === "canli" && y.bas === T("2026-10-10T10:30:00Z") && y.bit === T("2026-10-10T11:10:00Z") && y.yeniSaat === true, y);
k("4 yeni bitişten sonra (11:15Z) ticker yok", durum("2026-10-10T11:15:00Z") === null);
// 5) Race NEW_TIME 12:00 → 14:00Z
kur([FIA({ id: "rn", seans: "Race", tip: "NEW_TIME_CONFIRMED", zaman: "2026-10-11T11:00:00Z", yeniBaslangic: "2026-10-11T14:00:00Z" })]);
k("5 Race NEW_TIME: 12:30Z (eski planlı) ticker yok", durum("2026-10-11T12:30:00Z") === null);
k("5 Race NEW_TIME: 14:30Z canli (yeni saate göre)", durum("2026-10-11T14:30:00Z") === "Race:canli");
k("5 Race NEW_TIME: yeni bitişten sonra (16:05Z) yok", durum("2026-10-11T16:05:00Z") === null);
k("5 Sprint etkilenmez (Sprint planlı canli)", durum("2026-10-10T09:10:00Z") === "Sprint:canli");
// 6) eski planlı saat geldi, override aktif → LIVE yok (POSTPONED Race 12:10Z)
kur([FIA({ id: "rp", seans: "Race", tip: "POSTPONED", zaman: "2026-10-11T11:00:00Z" })]);
k("6 Race POSTPONED, 12:10Z: LIVE yok → ertelendi", durum("2026-10-11T12:10:00Z") === "Race:ertelendi");
// 7) COMPLETED override'ı bastırır
kur([FIA({ id: "sp", seans: "Sprint", tip: "POSTPONED", zaman: "2026-10-10T08:50:00Z" })], null, { sprint: { x: 1 } });
k("7 Sprint sonucu var: POSTPONED override ticker'ı etkilemez (ticker yok)", durum("2026-10-10T09:10:00Z") === null);
kur([FIA({ id: "sp", seans: "Sprint", tip: "POSTPONED", zaman: "2026-10-10T08:50:00Z" })], null, null);
k("7 kontrol: sonuç yoksa aynı override ertelendi gösterir", durum("2026-10-10T09:10:00Z") === "Sprint:ertelendi");
// 8) başka round'a taşınmaz
kur([FIA({ id: "x", tur: 16, seans: "Sprint", tip: "POSTPONED", zaman: "2026-10-10T08:50:00Z" })]);
k("8 tur 16 override'ı tur 17 Sprint'ini etkilemez", durum("2026-10-10T09:10:00Z") === "Sprint:canli");
kur([FIA({ id: "x", sezon: 2025, seans: "Sprint", tip: "POSTPONED", zaman: "2026-10-10T08:50:00Z" })]);
k("8 sezon 2025 override'ı etkilemez", durum("2026-10-10T09:10:00Z") === "Sprint:canli");
// 9) başka session'a taşınmaz
kur([FIA({ id: "x", seans: "Qualifying", tip: "POSTPONED", zaman: "2026-10-10T08:50:00Z" })]);
k("9 Q ertelendi: Sprint ve Race ticker'ı normal", durum("2026-10-10T09:10:00Z") === "Sprint:canli" && durum("2026-10-11T12:30:00Z") === "Race:canli");
kur([FIA({ id: "x", seans: "Sprint", tip: "POSTPONED", zaman: "2026-10-10T08:50:00Z" })]);
k("9 Sprint ertelendi: Race ticker'ı normal", durum("2026-10-11T12:30:00Z") === "Race:canli");
// Race Feed durumu (override yok): kendi seansında "Delayed start confirmed"
const ev = (iso, t) => L.ev(iso, t);
kur([], { Sprint: [ev("2026-10-10T08:45:00Z", "Heavy rain at Marina Bay and aquaplaning."), ev("2026-10-10T08:55:00Z", "Delayed start confirmed. Next track inspection at 17:15 local, start will not be for at least 15 minutes.")] });
{ const r = o("2026-10-10T09:05:00Z"); k("F feed DELAYED (override yok): ticker gecikti, kaynak=feed", r && r.durum === "gecikti" && r.kaynak === "feed", r); }
kur([FIA({ id: "n", seans: "Sprint", tip: "NEW_TIME_CONFIRMED", zaman: "2026-10-10T09:05:00Z", yeniBaslangic: "2026-10-10T10:30:00Z" })], { Sprint: [ev("2026-10-10T08:55:00Z", "Delayed start confirmed. Next track inspection at 17:15 local.")] });
k("F NEW_TIME + yeni saatte start notu yok → hafta kartıyla aynı: gecikti (yeniSaat=true); eski planlı saatte (09:10Z) ticker yok", durum("2026-10-10T10:35:00Z") === "Sprint:gecikti" && o("2026-10-10T10:35:00Z").yeniSaat === true && durum("2026-10-10T09:10:00Z") === null);
kur([FIA({ id: "n", seans: "Sprint", tip: "NEW_TIME_CONFIRMED", zaman: "2026-10-10T09:05:00Z", yeniBaslangic: "2026-10-10T10:30:00Z" })], { Sprint: [ev("2026-10-10T08:55:00Z", "Delayed start confirmed. Next track inspection at 17:15 local."), ev("2026-10-10T10:31:00Z", "Lights out! Away they go.")] });
k("F NEW_TIME + yeni saatte lights out → canli", durum("2026-10-10T10:35:00Z") === "Sprint:canli");
// 'f1-feed' ile ilgisiz: ticker pure fonksiyonu eski API değişmedi
k("canli()/pollOturumu() değişmedi: DELAYED override'da canli() planlı saatte hâlâ Sprint (poll davranışı aynı)", (kur([FIA({ id: "d", seans: "Sprint", tip: "DELAYED", zaman: "2026-10-10T08:50:00Z" })]), FC.canli(T("2026-10-10T09:10:00Z")).oturum === "Sprint"));

// ===== Helper: programDegisikligiOlustur =====
const P = require(path.join(F1, "program-yardimci.js")); const HB = L.HB;
const ok = (g, s) => P.programDegisikligiOlustur(Object.assign({ season: 2026, round: 17, session: "Qualifying", type: "POSTPONED", source: "FIA", verified: true, effectiveFrom: "2026-10-10T10:30:00Z" }, g), s);
const red = (r, re) => r.ok === false && (!re || r.hatalar.some(h => re.test(h)));
k("H geçerli POSTPONED kaydı: alanlar", (r => r.ok && r.kayit.sezon === 2026 && r.kayit.tur === 17 && r.kayit.seans === "Qualifying" && r.kayit.tip === "POSTPONED" && r.kayit.dogrulandi === true && r.kayit.zaman === "2026-10-10T10:30:00.000Z" && !r.kayit.yeniBaslangic)(ok({})));
k("H season geçersiz → ret", red(ok({ season: "2026" }), /season/) && red(ok({ season: 1900 })) && red(ok({ season: 2026.5 })) && red(ok({ season: undefined })));
k("H round geçersiz/eksik → ret", red(ok({ round: 0 }), /round/) && red(ok({ round: "17" })) && red(ok({ round: undefined })));
k("H session desteklenmiyor/eksik → ret", red(ok({ session: "Warmup" }), /session/) && red(ok({ session: undefined })) && ok({ session: "Q" }).kayit.seans === "Qualifying" && ok({ session: "SQ" }).kayit.seans === "SprintQualifying");
k("H type desteklenmiyor → ret", red(ok({ type: "RED_FLAG" }), /type/) && red(ok({ type: undefined })) && ok({ type: "delayed" }).kayit.tip === "DELAYED");
k("H verified !== true → resmi kayıt üretilmez", red(ok({ verified: false }), /verified/) && red(ok({ verified: "true" })) && red(ok({ verified: undefined })));
k("H source eksik → ret", red(ok({ source: "" }), /source/) && red(ok({ source: undefined })));
k("H effectiveFrom saat dilimsiz → ret (tahmin yok)", red(ok({ effectiveFrom: "2026-10-10T10:30:00" }), /effectiveFrom/) && red(ok({ effectiveFrom: undefined })));
k("H expiry effectiveFrom'dan önce → ret", red(ok({ expiry: "2026-10-10T09:00:00Z" }), /expiry/) && ok({ expiry: "2026-10-10T20:00:00Z" }).kayit.bitis === "2026-10-10T20:00:00.000Z");
// 10) NEW_TIME + eksik yeni saat
k("10 NEW_TIME_CONFIRMED + yeni saat yok → ret", red(ok({ type: "NEW_TIME_CONFIRMED" }), /yeni saat zorunlu/));
k("10 NEW_TIME_CONFIRMED + local ama trackTimezone yok → ret", red(ok({ type: "NEW_TIME_CONFIRMED", revisedTimeLocal: "2026-10-10T22:30" }), /trackTimezone/));
k("10 NEW_TIME_CONFIRMED + hem local hem TR → ret", red(ok({ type: "NEW_TIME_CONFIRMED", revisedTimeLocal: "2026-10-10T22:30", trackTimezone: "Asia/Singapore", revisedTimeTR: "2026-10-10T17:30" }), /birlikte/));
k("10 yeni saat açıklama anından önce → ret", red(ok({ type: "NEW_TIME_CONFIRMED", revisedTimeTR: "2026-10-10T10:00" }), /önce olamaz/));
// 11) CANCELLED + revisedTime
k("11 CANCELLED + revisedTime → ret", red(ok({ type: "CANCELLED", revisedTimeTR: "2026-10-10T17:30" }), /yeni saat kabul etmez/) && red(ok({ type: "CANCELLED", revisedTimeLocal: "2026-10-10T22:30", trackTimezone: "Asia/Singapore" })) && ok({ type: "CANCELLED" }).ok);
k("11 DELAYED/POSTPONED + revisedTime de reddedilir (NEW_TIME kullanılmalı)", red(ok({ type: "DELAYED", revisedTimeTR: "2026-10-10T17:30" })) && red(ok({ type: "POSTPONED", revisedTimeTR: "2026-10-10T17:30" })));
// 12) invalid timezone
k("12 geçersiz timezone → ret, sessiz fallback yok", red(ok({ type: "NEW_TIME_CONFIRMED", revisedTimeLocal: "2026-10-10T22:30", trackTimezone: "Mars/Olympus" }), /IANA/) && red(ok({ type: "NEW_TIME_CONFIRMED", revisedTimeLocal: "2026-10-10T22:30", trackTimezone: "GMT+8" }), /IANA/) && red(ok({ type: "NEW_TIME_CONFIRMED", revisedTimeTR: "2026-10-10T17:30", trackTimezone: "Mars/Olympus" })) && red(ok({ type: "POSTPONED", trackTimezone: "nope" })));
// 14) TR/local dönüşümü
{ const a = ok({ type: "NEW_TIME_CONFIRMED", revisedTimeLocal: "2026-10-10T22:30", trackTimezone: "Asia/Singapore" }), b = ok({ type: "NEW_TIME_CONFIRMED", revisedTimeTR: "2026-10-10T17:30" });
  k("14 local 22:30 SGT = 14:30Z = 17:30 TR (iki giriş yolu aynı sonucu verir)", a.ok && b.ok && a.kayit.yeniBaslangic === "2026-10-10T14:30:00.000Z" && b.kayit.yeniBaslangic === a.kayit.yeniBaslangic, [a, b]);
  const c = HB.saatCifti(Date.parse(a.kayit.yeniBaslangic), "Asia/Singapore"); k("14 sistemin kart saati helper çıktısıyla uyumlu: 17:30 TR · 22:30 local", c.tr === "17:30" && c.local === "22:30", c);
  const m = ok({ type: "NEW_TIME_CONFIRMED", revisedTimeLocal: "2026-07-18T15:00", trackTimezone: "Europe/Budapest", effectiveFrom: "2026-07-18T09:00:00Z" }); k("14 DST: Budapeşte yaz (UTC+2) 15:00 → 13:00Z", m.ok && m.kayit.yeniBaslangic === "2026-07-18T13:00:00.000Z", m);
  const w = ok({ type: "NEW_TIME_CONFIRMED", revisedTimeLocal: "2026-12-06T15:00", trackTimezone: "Europe/Budapest", effectiveFrom: "2026-12-06T09:00:00Z" }); k("14 DST: Budapeşte kış (UTC+1) 15:00 → 14:00Z", w.ok && w.kayit.yeniBaslangic === "2026-12-06T14:00:00.000Z", w);
  const au = ok({ type: "NEW_TIME_CONFIRMED", revisedTimeLocal: "2026-03-15T15:00", trackTimezone: "Australia/Melbourne", effectiveFrom: "2026-03-15T01:00:00Z" }); k("14 DST: Melbourne (UTC+11, güney yarım küre yaz) 15:00 → 04:00Z", au.ok && au.kayit.yeniBaslangic === "2026-03-15T04:00:00.000Z", au);
  const bos = ok({ type: "NEW_TIME_CONFIRMED", revisedTimeLocal: "2026-03-08T02:30", trackTimezone: "America/New_York", effectiveFrom: "2026-03-08T00:00:00Z" }); k("14 olmayan yerel saat (yaz saati boşluğu) → ret", red(bos, /mevcut değil/), bos);
  const cift = ok({ type: "NEW_TIME_CONFIRMED", revisedTimeLocal: "2026-11-01T01:30", trackTimezone: "America/New_York", effectiveFrom: "2026-11-01T00:00:00Z" }); k("14 çift anlamlı yerel saat (kış geçişi) → ret", red(cift, /belirsiz/), cift);
  k("14 geçersiz tarih biçimleri → ret", red(ok({ type: "NEW_TIME_CONFIRMED", revisedTimeTR: "10.10.2026 17:30" })) && red(ok({ type: "NEW_TIME_CONFIRMED", revisedTimeTR: "2026-02-30T17:30" })) && red(ok({ type: "NEW_TIME_CONFIRMED", revisedTimeTR: "2026-10-10T17:30Z" })));
  // helper çıktısı sistemde gerçekten çalışıyor: kayıt → ticker
  const yeniK = ok({ session: "Sprint", type: "NEW_TIME_CONFIRMED", revisedTimeLocal: "2026-10-10T18:30", trackTimezone: "Asia/Singapore", effectiveFrom: "2026-10-10T09:05:00Z" });
  kur([yeniK.kayit]); const r = o("2026-10-10T10:35:00Z"); k("14 helper kaydı doğrudan sistemde çalışır: Sprint yeni 10:30Z'de canli", r && r.durum === "canli" && r.bas === T("2026-10-10T10:30:00Z"), [yeniK, r]);
  k("14 helper kaydı hafta-baglam kartında doğru TR/local gösterir", (() => { const h = L.SNG(); const kl = HB.kartlar(L.ctx(h, { statik: [yeniK.kayit] }), { tip: "seans", seans: "Sprint" }, T("2026-10-10T09:30:00Z")); const html = HB.kartHtml(kl[0], { pistTz: h.pistTz, seansAd: "Sprint", planliBas: h.seanslar.find(x => x.anahtar === "Sprint").baslangic.getTime() }); return /13:30 TR/.test(html) && /18:30 local/.test(html); })());
}
// 13) duplicate kayıt
{ const liste = []; const a = P.ekle(liste, { season: 2026, round: 17, session: "Qualifying", type: "POSTPONED", source: "FIA", verified: true, effectiveFrom: "2026-10-10T10:30:00Z" });
  const b = P.ekle(liste, { season: 2026, round: 17, session: "Q", type: "postponed", source: "FIA", verified: true, effectiveFrom: "2026-10-10T10:30:00+00:00", title: "başka başlık" });
  k("13 aynı kayıt iki kez eklenmez (tekrar:true), liste tek kayıt", a.ok && b.ok === false && b.tekrar === true && liste.length === 1, [a, b, liste]);
  const c = P.ekle(liste, { season: 2026, round: 17, session: "Qualifying", type: "POSTPONED", source: "FIA", verified: true, effectiveFrom: "2026-10-10T11:00:00Z" }); k("13 farklı açıklama anı = ayrı kayıt eklenir", c.ok && liste.length === 2);
  k("13 geçersiz kayıt listeye girmez", P.ekle(liste, { season: 2026 }).ok === false && liste.length === 2);
  const raw = [{ id: "a", sezon: 2026, tur: 17, seans: "Sprint", tip: "POSTPONED", zaman: "2026-10-10T08:50:00Z" }, { id: "b", sezon: 2026, tur: 17, seans: "Sprint", tip: "POSTPONED", zaman: "2026-10-10T08:50:00Z" }, { sezon: 2026, seans: "Sprint", tip: "NEW_TIME_CONFIRMED", zaman: "x" }, { sezon: 2026, tur: 17, seans: "Race", tip: "CANCELLED", zaman: "2026-10-11T08:00:00Z", yeniBaslangic: "2026-10-11T10:00:00Z" }];
  const s = P.kontrolListe(raw); k("13 kontrolListe: ham girdideki tekrar / eksik tur / geçersiz zaman / CANCELLED+yeni saat raporlanır", s.length >= 4 && s.some(x => /tekrar/.test(x)) && s.some(x => /tur eksik/.test(x)) && s.some(x => /zaman/.test(x)) && s.some(x => /CANCELLED/.test(x)), s);
  const g = P.ekle([], { season: 2026, round: 17, session: "Sprint", type: "POSTPONED", source: "FIA", verified: true, effectiveFrom: "2026-10-10T08:50:00Z" }, { hafta: L.SNG() }); k("hafta çapraz denetimi: var olan seans OK", g.ok);
  const g2 = P.ekle([], { season: 2026, round: 17, session: "SecondPractice", type: "POSTPONED", source: "FIA", verified: true, effectiveFrom: "2026-10-10T08:50:00Z" }, { hafta: L.SNG() }); k("hafta çapraz denetimi: o hafta olmayan seans (sprint haftasında FP2) → ret", red(g2, /bu hafta sonunda yok/), g2);
  const g3 = P.ekle([], { season: 2026, round: 17, session: "Sprint", type: "NEW_TIME_CONFIRMED", source: "FIA", verified: true, effectiveFrom: "2026-10-10T08:50:00Z", revisedTimeLocal: "2026-10-10T18:30", trackTimezone: "Europe/Istanbul" }, { hafta: L.SNG() }); k("hafta çapraz denetimi: pist saat dilimi uyuşmazlığı → ret", red(g3, /farklı/), g3);
}
process.exit(L.sonuc() ? 0 : 1);
