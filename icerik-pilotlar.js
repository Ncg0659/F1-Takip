/* A4.1 — Pilot profili: STATİK, kısa, doğrulanmış kariyer bilgisi (yalnızca veri; kod yok). Anahtar: Jolpica driverId.
   Kaynak: Formula 1 resmî pilot sayfaları (formula1.com); Wikipedia yalnızca çapraz kontrol. Doğrulama: Ekim 2026.
   Kurallar: öznel sıfat yok; sezon içinde değişen sayılar (galibiyet/puan) yazılmaz; çelişen/tek kaynaklı ve sezon içi gelişmeler maddeye alınmaz.
   "takimlar": 2025 SEZONU SONUNA KADAR F1 takımları (kısa ad, yıl aralığı). Güncel (2026) takım canlı standings'ten gelir, burada tutulmaz.
   "sampiyonluk": 2025 sonu itibarıyla Dünya Pilotlar Şampiyonluğu — YEDEKTİR; uygulama, Şampiyonlar sekmesinin yüklü verisinden türetebiliyorsa onu kullanır.
   Dosyada olmayan pilot için profil yine açılır; yalnızca biyografi bloğu gizlenir. */
(function () {
  var P = {
    russell: { giris: 2019, takimlar: ["Williams (2019–2021)", "Mercedes (2022–2025)"], sampiyonluk: { sayi: 0, yillar: [] }, maddeler: [
      "2019 Avustralya GP'de Williams ile F1'e başladı.", "2017'de GP3, 2018'de FIA Formula 2 şampiyonu oldu.",
      "2020 Sakhir GP'de Mercedes'ten, Lewis Hamilton'ın yerine yarıştı.", "İlk Grand Prix galibiyetini 2022 São Paulo GP'de aldı."] },
    antonelli: { giris: 2025, takimlar: ["Mercedes (2025)"], sampiyonluk: { sayi: 0, yillar: [] }, maddeler: [
      "F1'e 16 Mart 2025 Avustralya GP'de başladı.", "2022'de İtalyan F4 ve ADAC F4, 2023'te Formula Regional Middle East ve Formula Regional Europe şampiyonu oldu.",
      "Formula 3'ü atlayarak doğrudan Formula 2'ye çıktı.", "İlk podyumunu 2025 Kanada GP'de (3.) aldı."] },
    leclerc: { giris: 2018, takimlar: ["Sauber (2018)", "Ferrari (2019–2025)"], sampiyonluk: { sayi: 0, yillar: [] }, maddeler: [
      "2018 Avustralya GP'de Sauber ile F1'e başladı.", "2016'da GP3, 2017'de FIA Formula 2 şampiyonu oldu.",
      "2019'da Ferrari'ye geçti.", "İlk Grand Prix galibiyetini 2019 Belçika GP'de aldı."] },
    hamilton: { giris: 2007, takimlar: ["McLaren (2007–2012)", "Mercedes (2013–2024)", "Ferrari (2025)"], sampiyonluk: { sayi: 7, yillar: [2008, 2014, 2015, 2017, 2018, 2019, 2020] }, maddeler: [
      "2007 Avustralya GP'de McLaren ile F1'e başladı.", "İlk Grand Prix galibiyetini 2007 Kanada GP'de aldı.",
      "2003'te Formula Renault UK, 2005'te Formula 3 Euro Series, 2006'da GP2 şampiyonu oldu.", "2025'te Ferrari'ye geçti."] },
    norris: { giris: 2019, takimlar: ["McLaren (2019–2025)"], sampiyonluk: { sayi: 1, yillar: [2025] }, maddeler: [
      "2019 Avustralya GP'de McLaren ile F1'e başladı.", "2017'de FIA Formula 3 Avrupa şampiyonu oldu.",
      "İlk Grand Prix galibiyetini 2024 Miami GP'de aldı."] },
    max_verstappen: { giris: 2015, takimlar: ["Toro Rosso (2015–2016)", "Red Bull (2016–2025)"], sampiyonluk: { sayi: 4, yillar: [2021, 2022, 2023, 2024] }, maddeler: [
      "2015 Avustralya GP'de Toro Rosso ile F1'e başladı.", "2016 Rusya GP'den sonra Red Bull'a geçti.",
      "Red Bull ile ilk yarışı olan 2016 İspanya GP'yi kazandı; en genç Grand Prix galibi oldu."] },
    bearman: { giris: 2024, takimlar: ["Ferrari (2024, tek yarış)", "Haas (2025)"], sampiyonluk: { sayi: 0, yillar: [] }, maddeler: [
      "F1'e 2024 Suudi Arabistan GP'de, Carlos Sainz'ın yerine Ferrari ile başladı.", "İlk yarışında puan aldı.",
      "2021'de İtalyan F4 ve ADAC F4 şampiyonu oldu."] },
    arvid_lindblad: { giris: 2026, takimlar: [], sampiyonluk: { sayi: 0, yillar: [] }, maddeler: [
      "F1'e 2026 Avustralya GP'de Racing Bulls ile başladı.", "2021'den beri Red Bull genç pilot programında.", "2026 sezonunun tek çaylak pilotuydu."] },
    bortoleto: { giris: 2025, takimlar: ["Sauber (2025)"], sampiyonluk: { sayi: 0, yillar: [] }, maddeler: [
      "F1'e 2025 Avustralya GP'de Sauber ile başladı.", "2023'te FIA Formula 3, 2024'te FIA Formula 2 şampiyonu oldu.",
      "İlk puanlarını 2025 Avusturya GP'de (8.) aldı."] },
    gasly: { giris: 2017, takimlar: ["Toro Rosso (2017–2018)", "Red Bull (2019)", "Toro Rosso (2019)", "AlphaTauri (2020–2022)", "Alpine (2023–2025)"], sampiyonluk: { sayi: 0, yillar: [] }, maddeler: [
      "F1'e 2017 Malezya GP'de Toro Rosso ile başladı.", "2016'da GP2 şampiyonu oldu.",
      "2019'da aynı sezon içinde Red Bull'dan Toro Rosso'ya döndü.", "İlk galibiyetini 2020 İtalya GP'de (Monza) AlphaTauri ile aldı."] },
    ocon: { giris: 2016, takimlar: ["Manor (2016)", "Force India (2017–2018)", "Renault (2020)", "Alpine (2021–2024)", "Haas (2025)"], sampiyonluk: { sayi: 0, yillar: [] }, maddeler: [
      "F1'e 2016 Belçika GP'de Manor ile başladı.", "2014'te FIA Formula 3 Avrupa, 2015'te GP3 şampiyonu oldu.",
      "2019'da Mercedes'in yedek pilotuydu, yarışmadı.", "İlk galibiyetini 2021 Macaristan GP'de Alpine ile aldı."] },
    albon: { giris: 2019, takimlar: ["Toro Rosso (2019)", "Red Bull (2019–2020)", "Williams (2022–2025)"], sampiyonluk: { sayi: 0, yillar: [] }, maddeler: [
      "F1'e 2019 Avustralya GP'de Toro Rosso ile başladı.", "2019 sezonunun ortasında Red Bull'a geçti.",
      "İlk podyumunu 2020 Toskana GP'de (3.) aldı.", "2021'de yarış koltuğu olmadan Red Bull'un yedek pilotuydu."] },
    lawson: { giris: 2023, takimlar: ["AlphaTauri (2023)", "RB (2024)", "Red Bull (2025, ilk 2 yarış)", "Racing Bulls (2025)"], sampiyonluk: { sayi: 0, yillar: [] }, maddeler: [
      "F1'e 2023 Hollanda GP'de, Daniel Ricciardo'nun yerine AlphaTauri ile başladı.", "İlk puanını 2023 Singapur GP'de (9.) aldı.",
      "2019'da Toyota Racing Series şampiyonu oldu."] },
    colapinto: { giris: 2024, takimlar: ["Williams (2024)", "Alpine (2025)"], sampiyonluk: { sayi: 0, yillar: [] }, maddeler: [
      "F1'e 2024 İtalya GP'de (Monza) Williams ile başladı.", "2001'den sonra F1'de yarışan ilk Arjantinli oldu.",
      "2025'te Alpine'e geçti."] },
    sainz: { giris: 2015, takimlar: ["Toro Rosso (2015–2017)", "Renault (2017–2018)", "McLaren (2019–2020)", "Ferrari (2021–2024)", "Williams (2025)"], sampiyonluk: { sayi: 0, yillar: [] }, maddeler: [
      "F1'e 2015 Avustralya GP'de Toro Rosso ile başladı.", "2014'te Formula Renault 3.5 Series şampiyonu oldu.",
      "İlk galibiyetini 2022 İngiltere GP'de Ferrari ile aldı."] },
    perez: { giris: 2011, takimlar: ["Sauber (2011–2012)", "McLaren (2013)", "Force India (2014–2018)", "Racing Point (2019–2020)", "Red Bull (2021–2024)"], sampiyonluk: { sayi: 0, yillar: [] }, maddeler: [
      "F1'e 2011 Avustralya GP'de Sauber ile başladı.", "İlk podyumunu 2012 Malezya GP'de aldı.",
      "İlk galibiyetini 2020 Sakhir GP'de Racing Point ile aldı.", "2025'te F1 yarış koltuğu yoktu."] },
    stroll: { giris: 2017, takimlar: ["Williams (2017–2018)", "Racing Point (2019–2020)", "Aston Martin (2021–2025)"], sampiyonluk: { sayi: 0, yillar: [] }, maddeler: [
      "F1'e 2017 Avustralya GP'de Williams ile başladı.", "İlk podyumunu 2017 Azerbaycan GP'de (3.) aldı.",
      "2014 İtalyan F4, 2015 Toyota Racing Series ve 2016 FIA Formula 3 Avrupa şampiyonu oldu.", "İlk pole pozisyonunu 2020 Türkiye GP'de aldı."] },
    alonso: { giris: 2001, takimlar: ["Minardi (2001)", "Renault (2003–2006)", "McLaren (2007)", "Renault (2008–2009)", "Ferrari (2010–2014)", "McLaren (2015–2018)", "Alpine (2021–2022)", "Aston Martin (2023–2025)"], sampiyonluk: { sayi: 2, yillar: [2005, 2006] }, maddeler: [
      "F1'e 2001 Avustralya GP'de Minardi ile başladı.", "İlk galibiyetini 2003 Macaristan GP'de Renault ile aldı.",
      "2005 ve 2006'da Renault ile Dünya Pilotlar Şampiyonu oldu.", "2019 ve 2020'de F1'de yarışmadı."] },
    bottas: { giris: 2013, takimlar: ["Williams (2013–2016)", "Mercedes (2017–2021)", "Alfa Romeo (2022–2023)", "Sauber (2024)"], sampiyonluk: { sayi: 0, yillar: [] }, maddeler: [
      "F1'e 2013 Avustralya GP'de Williams ile başladı.", "İlk galibiyetini 2017 Rusya GP'de Mercedes ile aldı.",
      "2019 ve 2020 sezonlarında şampiyonayı ikinci bitirdi.", "2025'te Mercedes'in yedek pilotuydu."] },
    hadjar: { giris: 2025, takimlar: ["Racing Bulls (2025)"], sampiyonluk: { sayi: 0, yillar: [] }, maddeler: [
      "F1'e 2025 Avustralya GP'de Racing Bulls ile başladı.", "2024 Formula 2 sezonunu ikinci bitirdi.",
      "İlk podyumunu 2025 Hollanda GP'de (3.) aldı.", "2022'den beri Red Bull genç pilot programında."] },
    piastri: { giris: 2023, takimlar: ["McLaren (2023–2025)"], sampiyonluk: { sayi: 0, yillar: [] }, maddeler: [
      "F1'e 2023 Bahreyn GP'de McLaren ile başladı.", "2019'da Formula Renault Eurocup, 2020'de FIA Formula 3, 2021'de FIA Formula 2 şampiyonu oldu.",
      "2022'de Alpine'in yedek pilotuydu.", "İlk galibiyetini 2024 Macaristan GP'de aldı."] },
    hulkenberg: { giris: 2010, takimlar: ["Williams (2010)", "Force India (2012)", "Sauber (2013)", "Force India (2014–2016)", "Renault (2017–2019)", "Racing Point (2020, 3 yarış)", "Aston Martin (2022, 2 yarış)", "Haas (2023–2024)", "Sauber (2025)"], sampiyonluk: { sayi: 0, yillar: [] }, maddeler: [
      "F1'e 2010 Bahreyn GP'de Williams ile başladı.", "2008'de F3 Euro Series, 2009'da GP2 şampiyonu oldu.",
      "2015'te Porsche ile Le Mans 24 Saat'i kazandı.", "İlk podyumunu 2025 İngiltere GP'de (3.) Sauber ile aldı."] },
    tsunoda: { giris: 2021, takimlar: ["AlphaTauri (2021–2023)", "RB (2024)", "Racing Bulls (2025, ilk 2 yarış)", "Red Bull (2025)"], sampiyonluk: { sayi: 0, yillar: [] }, maddeler: [
      "F1'e 2021 Bahreyn GP'de AlphaTauri ile başladı.", "2020 Formula 2 sezonunu üçüncü bitirdi.",
      "2025 Japonya GP'den itibaren Red Bull Racing'de yarıştı."] }
  };
  window.ICERIK_PILOTLAR = {
    surum: 1,
    kaynak: "Formula 1 (formula1.com), Wikipedia ile çapraz kontrol",
    dogrulama: "Ekim 2026",
    takimKapsami: "2025 sonuna kadar",
    pilotlar: P
  };
})();
