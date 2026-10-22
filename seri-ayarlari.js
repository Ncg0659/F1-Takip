/* Yarış Haftası: seri ayarları (yalnızca veri/ayar, kod yok).
   Yeni bir seri (F2, F3) eklemek için buraya yeni bir kayıt eklenir; şimdilik yalnızca F1 aktiftir. */
(function () {
  // sonucKaynagi: sonucun saklandığı anahtar. saglayici: "jolpica" (ana kaynak) ya da "openf1" (yalnızca FP ve Sprint Sıralaması).
  // Yalnızca sonucKaynagi dolu seanslar için "sonuç bekleme" döngüsü çalışır (seans bitince 60 sn aralıkla, en çok 3 saat).
  var F1_SEANSLAR = {
    FirstPractice:    { ad: "Antrenman 1", kisa: "FP1", sureDk: 60,  sonucKaynagi: "fp1", saglayici: "openf1",
                        acikla: "Takımlar pisti ve lastikleri tanır, araç ayarlarını dener. Süreler yarışın sonucunu belirlemez." },
    SecondPractice:   { ad: "Antrenman 2", kisa: "FP2", sureDk: 60,  sonucKaynagi: "fp2", saglayici: "openf1",
                        acikla: "Yarış temposu ve lastik aşınması denenir. Takımlar yarışa hazırlık yapar." },
    ThirdPractice:    { ad: "Antrenman 3", kisa: "FP3", sureDk: 60,  sonucKaynagi: "fp3", saglayici: "openf1",
                        acikla: "Sıralama öncesi son denemeler. Takımlar ayarları son haline getirir." },
    SprintQualifying: { ad: "Sprint Sıralaması", kisa: "SQ", sureDk: 45, sonucKaynagi: "sq", saglayici: "openf1",
                        acikla: "Kısa sprint yarışının başlangıç sırasını belirleyen sıralama turu. Ana yarışın gridini belirlemez." },
    SprintShootout:   { ad: "Sprint Sıralaması", kisa: "SQ", sureDk: 45, sonucKaynagi: "sq", saglayici: "openf1",
                        acikla: "Kısa sprint yarışının başlangıç sırasını belirleyen sıralama turu. Ana yarışın gridini belirlemez." },
    Sprint:           { ad: "Sprint", kisa: "SPR", sureDk: 40, sonucKaynagi: "sprint",
                        acikla: "Yaklaşık 100 km'lik kısa yarış. İlk sekiz pilot puan alır (8'den 1'e). Ana yarış gridini etkilemez." },
    Qualifying:       { ad: "Sıralama", kisa: "Q", sureDk: 70, sonucKaynagi: "qualifying",
                        acikla: "Pilotlar ana yarışın başlangıç sırası için en hızlı turu atar. Q1, Q2 ve Q3 olarak üç bölümdür; en hızlı pilot pole alır." },
    Race:             { ad: "Yarış", kisa: "R", sureDk: 120, sonucKaynagi: "race",
                        acikla: "Grand Prix'nin ana yarışı. Puanlar ilk on pilota dağıtılır." }
  };

  // Pist saat dilimi: IANA kimliği (ağ çağrısı yok). Saat farkı/yaz saati Intl tarafından hesaplanır.
  // Anahtar: Jolpica circuitId. Tanımsız pistte pist saati gösterilmez.
  var F1_PIST_SAAT_DILIMI = {
    albert_park: "Australia/Melbourne", shanghai: "Asia/Shanghai", suzuka: "Asia/Tokyo", bahrain: "Asia/Bahrain",
    jeddah: "Asia/Riyadh", miami: "America/New_York", imola: "Europe/Rome", monaco: "Europe/Monaco",
    catalunya: "Europe/Madrid", madring: "Europe/Madrid", villeneuve: "America/Toronto", red_bull_ring: "Europe/Vienna",
    silverstone: "Europe/London", spa: "Europe/Brussels", hungaroring: "Europe/Budapest", zandvoort: "Europe/Amsterdam",
    monza: "Europe/Rome", baku: "Asia/Baku", marina_bay: "Asia/Singapore", americas: "America/Chicago",
    rodriguez: "America/Mexico_City", interlagos: "America/Sao_Paulo", vegas: "America/Los_Angeles",
    losail: "Asia/Qatar", yas_marina: "Asia/Dubai"
  };

  window.SERI_AYARLARI = {
    f1: {
      ad: "Formula 1", aktif: true, jolpicaYol: "f1", sezonKaynagi: "jolpica",
      seansAnahtarlari: ["FirstPractice", "SecondPractice", "ThirdPractice", "SprintQualifying", "SprintShootout", "Sprint", "Qualifying"],
      seanslar: F1_SEANSLAR, pistSaatDilimi: F1_PIST_SAAT_DILIMI
    },
    // Mimari hazır; elle veri girilmeyecek, güvenilir ücretsiz kaynak bulunursa etkinleştirilir.
    f2: { ad: "Formula 2", aktif: false },
    f3: { ad: "Formula 3", aktif: false }
  };
  window.ANA_SAAT_DILIMI = "Europe/Istanbul"; // ana gösterim: Türkiye saati
})();
