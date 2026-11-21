// OPENF1 A7.1 — saf katman birim testleri (Node)
const R = require("/home/claude/f1-takip/race-control.js");
const fx = require("./rc_fixture_sq.js");
let ok = 0, bad = 0;
function t(ad, c, ek) { if (c) { ok++; console.log("PASS " + ad); } else { bad++; console.log("FAIL " + ad + " | " + (ek || "")); } }
const tipler = (o) => o.map((e) => e.normalizedType);
const mk = (msg, o) => Object.assign({ date: "2026-10-09T12:00:00Z", session_key: 1, message: msg, category: "Other", flag: null }, o || {});
const n1 = (msg, o) => R.normalize([mk(msg, o)], { sessionKey: 1 }).olaylar[0];

// --- Singapur SQ fixture ---
const N = R.normalize(fx, { sessionKey: 11379, meetingKey: 1296 }), ol = N.olaylar;
t("U1 SQ: hiçbir satır atılmadı, kronolojik sıra", N.atilan === 0 && ol.every((e, i) => i === 0 || ol[i - 1].ms <= e.ms));
t("U2 SQ: kırmızı bayrak 1 + durdurma birleşti", ol.filter((e) => e.normalizedType === "RED_FLAG").length === 1 && ol.find((e) => e.normalizedType === "SESSION_STOPPED").gizli);
const yb = ol.filter((e) => e.normalizedType === "SESSION_RESUMED");
t("U3 SQ: durdurma sonrası SESSION STARTED = SEANS YENİDEN BAŞLADI (tek)", yb.length === 1 && yb[0].date.slice(11, 19) === "12:46:00", JSON.stringify(yb.map((e) => e.date)));
t("U4 SQ: ilk SESSION STARTED başlangıç (yeniden başlama DEĞİL)", ol.find((e) => e.date.slice(11, 19) === "12:30:02").normalizedType === "START");
t("U5 SQ: 3 damalı bayrak (SQ1/SQ2/SQ3)", ol.filter((e) => e.normalizedType === "CHEQUERED").length === 3);
t("U6 SQ: SQ2 gecikme + başlama saatleri durum olayı", ol.some((e) => e.subType === "START_DELAYED") && ol.some((e) => e.subType === "WILL_START"));
t("U7 SQ: sektör temiz + pit çıkışı + overtake listede GİZLİ", ol.filter((e) => e.gizli).length >= 4 && R.listelenen(ol).every((e) => e.subType !== "OVERTAKE" && e.subType !== "SECTOR_CLEAR"));
t("U8 SQ: PER/BOT/SAI soruşturma + işlem yok", ol.some((e) => e.normalizedType === "INVESTIGATION" && e.drivers.length === 3) && ol.some((e) => e.subType === "NO_FURTHER_ACTION"));
t("U9 SQ: HAM pist sınırı + Viraj 10", ol.some((e) => e.normalizedType === "TRACK_LIMITS" && e.driverNumber === 44 && e.turn === 10));
const k = R.kritikler(ol, 5);
t("U10 SQ: ilk görünüm 3–5 olay ve kırmızı bayrak + damalı içerir", k.length >= 3 && k.length <= 5 && k.some((e) => e.normalizedType === "RED_FLAG") && k.some((e) => e.normalizedType === "CHEQUERED"), tipler(k).join());
t("U11 SQ: ilk görünüm kronolojik", k.every((e, i) => i === 0 || k[i - 1].ms <= e.ms));
const oz = R.ozet(ol);
t("U12 SQ özet: kırmızı 1, yeniden başlama 1, damalı 3, SC/VSC 0", oz.kirmiziBayrak === 1 && oz.yenidenBaslama === 1 && oz.damali === 3 && oz.safetyCar === 0 && oz.vsc === 0, JSON.stringify(oz));

// --- Tip testleri ---
t("U13 RED_FLAG", n1("RED FLAG", { flag: "RED", category: "Flag" }).normalizedType === "RED_FLAG");
t("U14 SESSION_RESUMED (açık)", n1("SESSION RESUMED").normalizedType === "SESSION_RESUMED");
t("U15 SAFETY_CAR", n1("SAFETY CAR DEPLOYED", { category: "SafetyCar" }).normalizedType === "SAFETY_CAR");
t("U16 VSC", n1("VIRTUAL SAFETY CAR DEPLOYED").normalizedType === "VSC");
t("U17 CHEQUERED", n1("CHEQUERED FLAG", { flag: "CHEQUERED" }).normalizedType === "CHEQUERED");
t("U18 INVESTIGATION", n1("FIA STEWARDS: INCIDENT INVOLVING CAR 4 (NOR) UNDER INVESTIGATION - CAUSING A COLLISION").normalizedType === "INVESTIGATION");
t("U19 PENALTY", n1("FIA STEWARDS: 5 SECOND TIME PENALTY FOR CAR 4 (NOR)").normalizedType === "PENALTY");
t("U20 TRACK_LIMITS", n1("CAR 44 (HAM) LAP DELETED - TRACK LIMITS AT TURN 4").normalizedType === "TRACK_LIMITS");
t("U21 bilinmeyen → OTHER (uydurma yok, ham metin korunur)", (() => { const e = n1("SOMETHING COMPLETELY NEW"); return e.normalizedType === "OTHER" && R.satir(e).metin === "SOMETHING COMPLETELY NEW"; })());
t("U22 sarı bayrak", n1("YELLOW IN TRACK SECTOR 4", { flag: "YELLOW", scope: "Sector", sector: 4 }).normalizedType === "YELLOW_FLAG");

// --- Karışma koruması ---
const mix = R.normalize([mk("RED FLAG", { flag: "RED", session_key: 1 }), mk("RED FLAG", { flag: "RED", session_key: 2 }), mk("CHEQUERED FLAG", { flag: "CHEQUERED", session_key: 1, meeting_key: 7 })], { sessionKey: 1, meetingKey: 7 });
t("U23 yanlış session_key satırı atılır", mix.olaylar.length === 1 || mix.olaylar.every((e) => e.sessionKey === 1), mix.olaylar.length);
t("U24 başka meeting_key atılır", R.normalize([mk("RED FLAG", { flag: "RED", meeting_key: 8 })], { sessionKey: 1, meetingKey: 7 }).olaylar.length === 0);
t("U25 oturumSec: Sprint ≠ Sprint Qualifying ≠ Race", (() => {
  const l = [{ session_key: 1, session_name: "Practice 1", session_type: "Practice", date_start: "2026-10-09T08:30:00Z" }, { session_key: 2, session_name: "Sprint Qualifying", session_type: "Qualifying", date_start: "2026-10-09T12:30:00Z" },
    { session_key: 3, session_name: "Sprint", session_type: "Race", date_start: "2026-10-10T09:00:00Z" }, { session_key: 4, session_name: "Qualifying", session_type: "Qualifying", date_start: "2026-10-10T13:00:00Z" }, { session_key: 5, session_name: "Race", session_type: "Race", date_start: "2026-10-11T12:00:00Z" }];
  const f = (a, ms) => (R.oturumSec(l, a, Date.parse(ms)) || {}).session_key;
  return f("FirstPractice", "2026-10-09T08:30:00Z") === 1 && f("SprintQualifying", "2026-10-09T12:30:00Z") === 2 && f("Sprint", "2026-10-10T09:00:00Z") === 3 && f("Qualifying", "2026-10-10T13:00:00Z") === 4 && f("Race", "2026-10-11T12:00:00Z") === 5;
})());
t("U26 oturumSec: başka hafta sonunun oturumu (tarih uyuşmaz) → null", R.oturumSec([{ session_key: 9, session_name: "Race", session_type: "Race", date_start: "2026-09-20T12:00:00Z" }], "Race", Date.parse("2026-10-11T12:00:00Z")) === null);
t("U27 yayimlandiMi: bitiş+30dk kapısı", !R.yayimlandiMi(1000, 1000 + 29 * 60000) && R.yayimlandiMi(1000, 1000 + 30 * 60000));
t("U28 mesajlar: yayımlanmadı ≠ ulaşılamıyor", R.durumMesaji("bos") === "Race Control verisi henüz yayımlanmadı." && R.durumMesaji("hata") === "OpenF1 Race Control verisine şu anda ulaşılamıyor." && R.durumMesaji("yayimlanmadi") === R.durumMesaji("bos"));
t("U29 az olayda hepsi gösterilir; boş girdi güvenli", R.kritikler(ol.slice(0, 3), 5).length <= 3 && R.normalize(null).olaylar.length === 0 && R.normalize([{ date: "x" }]).olaylar.length === 0);
t("U30 satır: saat TR (UTC+3) ve ikon/başlık", (() => { const s = R.satir(ol.find((e) => e.normalizedType === "RED_FLAG"), { pistTz: "Asia/Singapore" }); return s.saat === "15:35" && s.yerel === "20:35" && s.ikon === "🔴" && s.baslik === "KIRMIZI BAYRAK"; })());
t("U31 ham İngilizce başlıkta basılmaz (çevrilenlerde ham satır yok)", ol.filter((e) => ["RED_FLAG", "CHEQUERED", "SESSION_RESUMED"].includes(e.normalizedType)).every((e) => R.satir(e).ham === ""));
t("U32 yinelenen aynı kayıt tek", R.normalize([mk("RED FLAG", { flag: "RED" }), mk("RED FLAG", { flag: "RED" })], { sessionKey: 1 }).olaylar.length === 1);
console.log("\n" + ok + "/" + (ok + bad));
process.exit(bad ? 1 : 0);
