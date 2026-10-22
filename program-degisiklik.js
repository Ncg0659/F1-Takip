/* DOĞRULANMIŞ PROGRAM DEĞİŞİKLİKLERİ ve resmi/kesin bağlamsal bilgiler (elle girilir; ağ isteği yok, ücretsiz).
   Yalnızca FIA / Formula 1 resmi açıklamasıyla DOĞRULANMIŞ bilgiyi buraya yaz. Uydurma/tahmin girme.
   Bu liste, takvimdeki planlı saat ve Race Feed'den önceliklidir (doğrulanmış girdi > Race Feed > faz tahmini > saat tahmini).

   Şablon (bir satır = bir bilgi; boş bırakılan alanlar isteğe bağlıdır):
   { id: "2026-17-q-ertelendi", sezon: 2026, tur: 17, seans: "Qualifying",
     tip: "POSTPONED",              // DELAYED | POSTPONED | NEW_TIME_CONFIRMED | CANCELLED  (ya da RED_FLAG, START_PROCEDURE, SESSION_SHORTENED, WEATHER, TRACK_CHANGE, GRID_PENALTY, PIT_LANE_START, PENALTY, TECH_UPDATE, OPERATIONAL)
     zaman: "2026-10-10T10:15:00Z", // açıklamanın yapıldığı an (UTC, ISO)
     yeniBaslangic: "2026-10-10T13:30:00Z", // YALNIZCA NEW_TIME_CONFIRMED: yeni başlangıç anı (UTC, ISO)
     baslik: "...", metin: "...",   // isteğe bağlı; yoksa türe göre varsayılan Türkçe metin kullanılır
     kaynak: "FIA",                 // "FIA" | "Formula 1" → resmi; başka değer "statik" sayılır
     neden: "hava",                 // isteğe bağlı ("hava" ise Pist profilinde de görünür)
     pilot: ["NOR"], takim: ["McLaren"], pist: "marina_bay",   // pilot/takım/pist ekranlarına bağlamak için (isteğe bağlı)
     bitis: "2026-10-10T20:00:00Z", // isteğe bağlı süre sonu; yoksa tür başına varsayılan
     dogrulandi: true }
   seans anahtarları: FirstPractice, SecondPractice, ThirdPractice, SprintQualifying (SprintShootout), Sprint, Qualifying, Race */
window.PROGRAM_DEGISIKLIK = [];

/* GÜVENLİ GİRİŞ (önerilen): ham nesne yazmak yerine yardımcıyı kullan; geçersiz kayıt listeye EKLENMEZ, aynı kayıt iki kez eklenmez.
   Saatler IANA saat dilimiyle çevrilir (sabit GMT farkı yok). Örnek (yorumdan çıkar):
   ProgramYardimci.ekle(PROGRAM_DEGISIKLIK, { season: 2026, round: 17, session: "Qualifying", type: "NEW_TIME_CONFIRMED", source: "FIA", verified: true,
     revisedTimeLocal: "2026-10-10T22:30", trackTimezone: "Asia/Singapore",     // ya da revisedTimeTR: "2026-10-10T17:30"
     effectiveFrom: "2026-10-10T10:30:00Z", reason: "hava" });
   DELAYED / POSTPONED / CANCELLED: yeni saat VERME. Reddedilen kayıtlar konsola yazılır:  var r = ProgramYardimci.ekle(...); if (!r.ok) console.warn(r.hatalar); */
(function () {
  // Elle yazılmış ham girdilerdeki hataları sessizce yutmak yerine konsola bildirir (ağ yok, davranış değişmez)
  try { if (window.ProgramYardimci) { var s = ProgramYardimci.kontrolListe(window.PROGRAM_DEGISIKLIK); if (s.length && window.console) { console.warn("PROGRAM_DEGISIKLIK sorunları:", s); } } } catch (e) { /* önemsiz */ }
})();
