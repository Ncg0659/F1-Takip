/* A5.1 — Pist Profili statik içeriği. YALNIZCA pist bilgisi; Grand Prix adı, tarih, sonuç ve takvim sırası burada YOKTUR (Jolpica/A1'den dinamik gelir).
   Kural: bir alan kaynakta doğrulanamıyorsa YAZILMAZ; çelişkili alan çıkarılır. Eksik alan arayüzde hiç çizilmez.
   Kaynak önceliği: Formula1.com → resmî F1 yayınları. Yön, DRS/aktif aero bölge sayısı ve yalnızca Wikipedia'dan gelen viraj sayısı BİLEREK yok.
   Tur rekoru: yalnızca Formula1.com + ikinci kaynak (Wikipedia 'official F1 race lap record') çapraz kontrolü yapılmış YARIŞ turu rekorları; Formula1.com sayfaları etiketi 'Fastest lap time' olarak verdiği için tek kaynakla yetinilmedi.
   veriSezonu: değerin alındığı Formula1.com sayfasının sezonu (2026 sayfası yoksa son resmî sayfa; pist düzeni değişmemiştir). Arayüzde gösterilmez.
   Anahtar: Jolpica circuitId. Kapsam 26 pist; kod sabit sayıya bağlı değildir. */
(function (kok) {
  "use strict";
  var API = {
    surum: 1, dogrulama: "2026-10-06",
    pistler: {
 "monaco": {
  "sehir": "Monte Carlo",
  "ulke": "Monako",
  "uzunlukKm": 3.337,
  "turSayisi": 78,
  "yarisMesafesiKm": 260.286,
  "ilkGp": 1950,
  "turRekoru": {
   "pilot": "Lewis Hamilton",
   "sure": "1:12.909",
   "yil": 2021,
   "dogrulama": "2026-10-06"
  },
  "tarihce": [
   "1929'da ilk Monaco Grand Prix'si yapıldı (Dünya Şampiyonası öncesi).",
   "1950'de Formula 1 Dünya Şampiyonası'nın ilk sezonunda takvimde yer aldı.",
   "1955'ten bu yana takvimde kesintisiz yer alıyor."
  ],
  "kaynak": [
   "https://www.formula1.com/en/racing/2026/monaco/circuit"
  ],
  "veriSezonu": 2026,
  "dogrulamaTarihi": "2026-10-06"
 },
 "marina_bay": {
  "sehir": "Singapur",
  "ulke": "Singapur",
  "uzunlukKm": 4.927,
  "turSayisi": 62,
  "yarisMesafesiKm": 305.337,
  "ilkGp": 2008,
  "virajSayisi": 19,
  "turRekoru": {
   "pilot": "Lewis Hamilton",
   "sure": "1:33.808",
   "yil": 2025,
   "dogrulama": "2026-10-06"
  },
  "tarihce": [
   "2008'de F1 tarihinin ilk gece yarışı olarak ilk Singapur Grand Prix'si yapıldı.",
   "2023'te pist yerleşimi değişti; viraj sayısı 23'ten 19'a indi."
  ],
  "kaynak": [
   "https://www.formula1.com/en/racing/2026/singapore/circuit",
   "https://www.formula1.com/en/racing/2026/singapore/circuit"
  ],
  "veriSezonu": 2026,
  "dogrulamaTarihi": "2026-10-06"
 },
 "baku": {
  "sehir": "Bakü",
  "ulke": "Azerbaycan",
  "uzunlukKm": 6.003,
  "turSayisi": 51,
  "yarisMesafesiKm": 306.049,
  "ilkGp": 2016,
  "fizikselTur": "Sokak pisti",
  "tarihce": [
   "2016'da Avrupa Grand Prix'si adıyla F1 takviminde yer aldı.",
   "Azerbaycan Grand Prix adı 2017'den itibaren kullanılıyor."
  ],
  "kaynak": [
   "https://www.formula1.com/en/racing/2026/azerbaijan/circuit"
  ],
  "veriSezonu": 2026,
  "dogrulamaTarihi": "2026-10-06"
 },
 "vegas": {
  "sehir": "Las Vegas",
  "ulke": "ABD",
  "uzunlukKm": 6.201,
  "turSayisi": 50,
  "yarisMesafesiKm": 309.958,
  "ilkGp": 2023,
  "virajSayisi": 17,
  "fizikselTur": "Sokak pisti",
  "tarihce": [
   "Mevcut pistteki ilk F1 yarışı 2023'te yapıldı.",
   "Aynı şehirde 1981 ve 1982'de, farklı bir pistte Caesars Palace Grand Prix'si yapılmıştı."
  ],
  "kaynak": [
   "https://www.formula1.com/en/racing/2026/las-vegas/circuit",
   "https://www.formula1.com/en/racing/2026/las-vegas/circuit; https://en.wikipedia.org/wiki/Las_Vegas_Strip_Circuit"
  ],
  "veriSezonu": 2026,
  "dogrulamaTarihi": "2026-10-06"
 },
 "jeddah": {
  "sehir": "Cidde",
  "ulke": "Suudi Arabistan",
  "uzunlukKm": 6.174,
  "turSayisi": 50,
  "yarisMesafesiKm": 308.45,
  "ilkGp": 2021,
  "virajSayisi": 27,
  "fizikselTur": "Sokak pisti",
  "tarihce": [
   "İlk Suudi Arabistan Grand Prix'si 5 Aralık 2021'de yapıldı."
  ],
  "kaynak": [
   "https://www.formula1.com/en/racing/2025/saudi-arabia",
   "https://raceprogramme.formula1.com/2025/saudi-arabia/the-circuit"
  ],
  "veriSezonu": 2025,
  "dogrulamaTarihi": "2026-10-06"
 },
 "monza": {
  "sehir": "Monza",
  "ulke": "İtalya",
  "uzunlukKm": 5.793,
  "turSayisi": 53,
  "yarisMesafesiKm": 306.72,
  "ilkGp": 1950,
  "turRekoru": {
   "pilot": "Lando Norris",
   "sure": "1:20.901",
   "yil": 2025,
   "dogrulama": "2026-10-06"
  },
  "tarihce": [
   "Pist 1922'de inşa edildi; ilk İtalya Grand Prix'si aynı yıl Monza'da yapıldı.",
   "1950'den bu yana Dünya Şampiyonası takvimindedir; 1980'de pist yenileme nedeniyle yarış yapılmadı."
  ],
  "kaynak": [
   "https://www.formula1.com/en/racing/2026/italy/circuit"
  ],
  "veriSezonu": 2026,
  "dogrulamaTarihi": "2026-10-06"
 },
 "spa": {
  "sehir": "Spa",
  "ulke": "Belçika",
  "uzunlukKm": 7.004,
  "turSayisi": 44,
  "yarisMesafesiKm": 308.054,
  "ilkGp": 1950,
  "tarihce": [
   "1921'de kamu yolları üzerinde, 14,9 km uzunluğunda üçgen bir pist olarak kuruldu.",
   "1979'da pist yeniden yapıldı ve orijinalin yaklaşık yarısı uzunluğa indi.",
   "1950'de ilk Dünya Şampiyonası sezonundaki yedi pistten biriydi."
  ],
  "kaynak": [
   "https://www.formula1.com/en/racing/2026/belgium/circuit"
  ],
  "veriSezonu": 2026,
  "dogrulamaTarihi": "2026-10-06"
 },
 "silverstone": {
  "sehir": "Silverstone",
  "ulke": "Birleşik Krallık",
  "uzunlukKm": 5.891,
  "turSayisi": 52,
  "yarisMesafesiKm": 306.198,
  "ilkGp": 1950,
  "virajSayisi": 18,
  "turRekoru": {
   "pilot": "Max Verstappen",
   "sure": "1:27.097",
   "yil": 2020,
   "dogrulama": "2026-10-06"
  },
  "tarihce": [
   "13 Mayıs 1950'de ilk F1 Dünya Şampiyonası yarışı burada yapıldı.",
   "Pist, savaş döneminde inşa edilen bir RAF havaalanının çevre yolları üzerine kuruldu."
  ],
  "kaynak": [
   "https://www.formula1.com/en/racing/2026/Great-Britain/Circuit.html",
   "https://www.formula1.com/en/latest/article/circuit-guide-everything-you-need-to-know-about-silverstone-2026.5Sl0O8g393enBWVIkjRzOr"
  ],
  "veriSezonu": 2026,
  "dogrulamaTarihi": "2026-10-06"
 },
 "red_bull_ring": {
  "sehir": "Spielberg",
  "ulke": "Avusturya",
  "uzunlukKm": 4.326,
  "turSayisi": 71,
  "virajSayisi": 10,
  "tarihce": [
   "Österreichring adıyla 1969'da açıldı.",
   "1995–96'da yeniden tasarlandı; 1997–2003 arasında A1-Ring adıyla kullanıldı.",
   "2004'te Dietrich Mateschitz tarafından satın alındı ve Red Bull Ring adını aldı; F1'e 2014'te döndü."
  ],
  "kaynak": [
   "https://www.formula1.com/en/racing/2026/Austria/Circuit.html",
   "https://www.formula1.com/en/latest/article/circuit-guide-everything-you-need-to-know-about-the-red-bull-ring.76j6twpa7Be26Prj6fO90F"
  ],
  "veriSezonu": 2026,
  "dogrulamaTarihi": "2026-10-06"
 },
 "losail": {
  "sehir": "Lusail",
  "ulke": "Katar",
  "uzunlukKm": 5.419,
  "turSayisi": 57,
  "yarisMesafesiKm": 308.611,
  "ilkGp": 2021,
  "tarihce": [
   "Pist 2004'te MotoGP için açıldı.",
   "2021'de Katar'ın ilk F1 Grand Prix'sine ev sahipliği yaptı."
  ],
  "kaynak": [
   "https://www.formula1.com/en/racing/2026/Qatar/Circuit.html"
  ],
  "veriSezonu": 2026,
  "dogrulamaTarihi": "2026-10-06"
 },
 "suzuka": {
  "sehir": "Suzuka",
  "ulke": "Japonya",
  "uzunlukKm": 5.807,
  "turSayisi": 53,
  "yarisMesafesiKm": 307.471,
  "ilkGp": 1987,
  "turRekoru": {
   "pilot": "Kimi Antonelli",
   "sure": "1:30.965",
   "yil": 2025,
   "dogrulama": "2026-10-06"
  },
  "tarihce": [
   "1962'de Honda'nın test tesisi olarak yaptırıldı.",
   "F1'e 1987'de girdi.",
   "Takvimdeki tek sekiz şeklindeki pisttir."
  ],
  "kaynak": [
   "https://www.formula1.com/en/racing/2026/Japan/Circuit.html"
  ],
  "veriSezonu": 2026,
  "dogrulamaTarihi": "2026-10-06"
 },
 "hungaroring": {
  "sehir": "Mogyoród",
  "ulke": "Macaristan",
  "uzunlukKm": 4.381,
  "turSayisi": 70,
  "yarisMesafesiKm": 306.63,
  "ilkGp": 1986,
  "virajSayisi": 14,
  "tarihce": [
   "Yapımı 1985'te başladı ve yaklaşık dokuz ay içinde tamamlandı.",
   "1986'da Demir Perde'nin gerisinde yapılan ilk F1 yarışı burada yapıldı."
  ],
  "kaynak": [
   "https://www.formula1.com/en/racing/2026/Hungary/Circuit.html",
   "https://www.formula1.com/en/latest/article/need-to-know-the-most-important-facts-stats-and-trivia-ahead-of-the-2026-hungarian-grand-prix.5Zhle8vMBDwzt2OSoCgk4d"
  ],
  "veriSezonu": 2026,
  "dogrulamaTarihi": "2026-10-06"
 },
 "zandvoort": {
  "sehir": "Zandvoort",
  "ulke": "Hollanda",
  "uzunlukKm": 4.259,
  "turSayisi": 72,
  "yarisMesafesiKm": 306.592,
  "tarihce": [
   "Pist 1948'de açıldı.",
   "F1'de 1952–1985 arasında yer aldı; 36 yıllık aradan sonra 2021'de takvime döndü."
  ],
  "kaynak": [
   "https://www.formula1.com/en/racing/2026/Netherlands/Circuit.html"
  ],
  "veriSezonu": 2026,
  "dogrulamaTarihi": "2026-10-06"
 },
 "bahrain": {
  "sehir": "Sakhir",
  "ulke": "Bahreyn",
  "uzunlukKm": 5.412,
  "turSayisi": 57,
  "yarisMesafesiKm": 308.238,
  "ilkGp": 2004,
  "tarihce": [
   "Yapımı Aralık 2002'de başladı; tasarım Hermann Tilke'ye ait.",
   "2004'te ilk Bahreyn Grand Prix'si yapıldı; Orta Doğu'daki ilk F1 yarışıydı."
  ],
  "kaynak": [
   "https://www.formula1.com/en/racing/2025/Bahrain/Circuit.html"
  ],
  "veriSezonu": 2025,
  "dogrulamaTarihi": "2026-10-06"
 },
 "miami": {
  "sehir": "Miami",
  "ulke": "ABD",
  "uzunlukKm": 5.412,
  "turSayisi": 57,
  "yarisMesafesiKm": 308.326,
  "ilkGp": 2022,
  "virajSayisi": 19,
  "fizikselTur": "Geçici pist",
  "tarihce": [
   "İlk Miami Grand Prix'si 7 Mayıs 2022'de yapıldı.",
   "Pist, Hard Rock Stadium kompleksi içinde geçici olarak kuruluyor."
  ],
  "kaynak": [
   "https://www.formula1.com/en/racing/2026/miami",
   "https://www.formula1.com/en/racing/2026/miami"
  ],
  "veriSezonu": 2026,
  "dogrulamaTarihi": "2026-10-06"
 },
 "imola": {
  "sehir": "Imola",
  "ulke": "İtalya",
  "uzunlukKm": 4.909,
  "turSayisi": 63,
  "yarisMesafesiKm": 309.049,
  "ilkGp": 1980,
  "tarihce": [
   "1980 İtalya Grand Prix'si Imola'da yapıldı.",
   "San Marino Grand Prix'si 1981–2006 arasında burada yapıldı.",
   "2020'de Emilia-Romagna Grand Prix'siyle takvime döndü."
  ],
  "kaynak": [
   "https://www.formula1.com/en/racing/2024/EmiliaRomagna/Circuit.html"
  ],
  "veriSezonu": 2024,
  "dogrulamaTarihi": "2026-10-06"
 },
 "yas_marina": {
  "sehir": "Abu Dabi",
  "ulke": "BAE",
  "uzunlukKm": 5.281,
  "turSayisi": 58,
  "ilkGp": 2009,
  "tarihce": [
   "İlk Abu Dabi Grand Prix'si 2009'da, sezon finali olarak yapıldı.",
   "Pistin tasarımı Hermann Tilke'ye aittir."
  ],
  "kaynak": [
   "https://www.formula1.com/en/racing/2026/united-arab-emirates"
  ],
  "veriSezonu": 2026,
  "dogrulamaTarihi": "2026-10-06"
 },
 "catalunya": {
  "sehir": "Barselona",
  "ulke": "İspanya",
  "uzunlukKm": 4.657,
  "turSayisi": 66,
  "yarisMesafesiKm": 307.236,
  "ilkGp": 1991,
  "tarihce": [
   "İlk F1 yarışı 1991'de yapıldı.",
   "Pist, 1992 Barselona Olimpiyatları programı kapsamında inşa edildi."
  ],
  "kaynak": [
   "https://www.formula1.com/en/racing/2026/barcelona-catalunya"
  ],
  "veriSezonu": 2026,
  "dogrulamaTarihi": "2026-10-06"
 },
 "interlagos": {
  "sehir": "São Paulo",
  "ulke": "Brezilya",
  "uzunlukKm": 4.309,
  "turSayisi": 71,
  "yarisMesafesiKm": 305.879,
  "ilkGp": 1973,
  "tarihce": [
   "1973'te Brezilya Grand Prix'si şampiyona yarışı olarak ilk kez burada yapıldı (1972'de şampiyona dışı yarış vardı).",
   "1981–1989 arasında Brezilya Grand Prix'si Rio'daki Jacarepaguá pistinde yapıldı.",
   "1985'te José Carlos Pace adını aldı."
  ],
  "kaynak": [
   "https://www.formula1.com/en/racing/2026/brazil"
  ],
  "veriSezonu": 2026,
  "dogrulamaTarihi": "2026-10-06"
 },
 "americas": {
  "sehir": "Austin",
  "ulke": "ABD",
  "uzunlukKm": 5.513,
  "turSayisi": 56,
  "yarisMesafesiKm": 308.405,
  "ilkGp": 2012,
  "tarihce": [
   "İlk ABD Grand Prix'si burada 18 Kasım 2012'de yapıldı.",
   "Yapım 31 Aralık 2010'da başladı; resmî açılış 21 Ekim 2012'de yapıldı."
  ],
  "kaynak": [
   "https://www.formula1.com/en/racing/2026/united-states"
  ],
  "veriSezonu": 2026,
  "dogrulamaTarihi": "2026-10-06"
 },
 "rodriguez": {
  "sehir": "Meksika Şehri",
  "ulke": "Meksika",
  "uzunlukKm": 4.304,
  "turSayisi": 71,
  "yarisMesafesiKm": 305.354,
  "ilkGp": 1963,
  "tarihce": [
   "1962'de şampiyona dışı yarış, 1963–1970 arasında şampiyona yarışları yapıldı.",
   "1986–1992 arasında ve 2015'ten bu yana yeniden F1 takvimindedir.",
   "2015'teki dönüş için yeniden tasarlandı; pist yaklaşık 170 m kısaldı."
  ],
  "kaynak": [
   "https://www.formula1.com/en/racing/2026/mexico"
  ],
  "veriSezonu": 2026,
  "dogrulamaTarihi": "2026-10-06"
 },
 "shanghai": {
  "sehir": "Şanghay",
  "ulke": "Çin",
  "uzunlukKm": 5.451,
  "turSayisi": 56,
  "yarisMesafesiKm": 305.066,
  "ilkGp": 2004,
  "virajSayisi": 16,
  "fizikselTur": "Kalıcı pist",
  "tarihce": [
   "2004'te ilk Çin Grand Prix'si yapıldı.",
   "Pist, F1 yarışlarına ev sahipliği yapmak için özel olarak inşa edildi."
  ],
  "kaynak": [
   "https://www.formula1.com/en/racing/2026/china/circuit",
   "F1 circuit guide"
  ],
  "veriSezonu": 2026,
  "dogrulamaTarihi": "2026-10-06"
 },
 "albert_park": {
  "sehir": "Melbourne",
  "ulke": "Avustralya",
  "uzunlukKm": 5.278,
  "turSayisi": 58,
  "yarisMesafesiKm": 306.124,
  "ilkGp": 1996,
  "virajSayisi": 14,
  "fizikselTur": "Geçici sokak pisti",
  "tarihce": [
   "1996'da Melbourne'deki ilk F1 Dünya Şampiyonası yarışı yapıldı.",
   "Adelaide'in son Grand Prix'si 1995 sonunda yapılmıştı."
  ],
  "kaynak": [
   "https://www.formula1.com/en/racing/2026/australia/circuit",
   "F1 circuit guide 2026"
  ],
  "veriSezonu": 2026,
  "dogrulamaTarihi": "2026-10-06"
 },
 "villeneuve": {
  "sehir": "Montreal",
  "ulke": "Kanada",
  "uzunlukKm": 4.361,
  "turSayisi": 70,
  "yarisMesafesiKm": 305.27,
  "ilkGp": 1978,
  "tarihce": [
   "1978'de pistteki ilk F1 yarışı yapıldı.",
   "Eski adı Circuit Île Notre-Dame'dır."
  ],
  "kaynak": [
   "idem"
  ],
  "veriSezonu": 2026,
  "dogrulamaTarihi": "2026-10-06"
 },
 "sepang": {
  "sehir": "Kuala Lumpur",
  "ulke": "Malezya",
  "uzunlukKm": 5.543,
  "turSayisi": 56,
  "yarisMesafesiKm": 310.417,
  "ilkGp": 1999,
  "turRekoru": {
   "pilot": "Sebastian Vettel",
   "sure": "1:34.080",
   "yil": 2017,
   "dogrulama": "2026-10-06"
  },
  "tarihce": [
   "1999'da ilk Malezya Grand Prix'si yapıldı.",
   "1999–2017 arasında 19 ardışık Malezya Grand Prix'si yapıldı.",
   "Pistin tasarımı Hermann Tilke'ye aittir."
  ],
  "kaynak": [
   "https://www.formula1.com/en/racing/2026/bahrain/circuit"
  ],
  "veriSezonu": 2026,
  "dogrulamaTarihi": "2026-10-06"
 },
 "madring": {
  "sehir": "Madrid",
  "ulke": "İspanya",
  "uzunlukKm": 5.414,
  "turSayisi": 57,
  "yarisMesafesiKm": 308.399,
  "ilkGp": 2026,
  "virajSayisi": 22,
  "fizikselTur": "Hibrit (kamu yolları ve özel yapım bölümler)",
  "tarihce": [
   "Pist ilk kez 2026 sezonunda F1 takvimine girdi.",
   "Yerleşim kamu yolları ile IFEMA/Valdebebas çevresinde özel yapılmış bölümlerden oluşuyor."
  ],
  "kaynak": [
   "https://www.formula1.com/en/racing/2026/spain/circuit",
   "F1 circuit guide, F1 /spain/circuit, Wikipedia"
  ],
  "veriSezonu": 2026,
  "dogrulamaTarihi": "2026-10-06"
 }
}
  };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
  if (kok) { kok.ICERIK_PISTLER = API; }
})(typeof window !== "undefined" ? window : null);
