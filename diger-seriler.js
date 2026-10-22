// F2, F3 ve Formula E verileri. Ücretsiz bir canlı API bulunamadığı için elle güncellenen dosya.
// Güncellemek için: puanları, "guncelleme" tarihini ve "durum" yazısını değiştirmen yeterli.
// Pilot satırı: [sıra, "Pilot", "Takım", puan]   Takım satırı: [sıra, "Takım", puan]
window.DIGER_SERILER = [
  {
    kod: "f2", ad: "Formula 2",
    durum: "Sezon sürüyor. Takvimde kalan turlar: Lusail (27-29 Kasım), Yas Island (4-6 Aralık). Bir haber sitesi bu iki turun durumunun belirsiz olduğunu yazıyor.",
    guncelleme: "4 Ekim 2026",
    kaynak: "racingnews365.com (Bakü Feature Race 2 sonrası, 26 Eylül)",
    not: "Bakü hafta sonu tamamlandı. Câmara, Tsolov farkını 1 puandan 7 puana çıkardı.",
    pilotlar: [
      [1, "Rafael Câmara", "Invicta Racing", 207], [2, "Nikola Tsolov", "Campos Racing", 200],
      [3, "Alex Dunne", "Rodin Motorsport", 189], [4, "Gabriele Minì", "MP Motorsport", 163],
      [5, "Dino Beganovic", "DAMS Lucas Oil", 137], [6, "Noel León", "Campos Racing", 133],
      [7, "Martinius Stenshorne", "Rodin Motorsport", 107], [8, "Joshua Dürksen", "Invicta Racing", 90],
      [9, "Kush Maini", "ART Grand Prix", 90], [10, "Laurens van Hoepen", "Trident", 90],
      [11, "Tasanapol Inthraphuvasak", "ART Grand Prix", 71], [12, "Ritomo Miyata", "Hitech", 70],
      [13, "Rafael Villagómez", "Van Amersfoort Racing", 42], [14, "John Bennett", "Trident", 38],
      [15, "Oliver Goethe", "MP Motorsport", 37], [16, "Roman Bilinski", "DAMS Lucas Oil", 36],
      [17, "Sebastián Montoya", "Prema Racing", 30], [18, "Emerson Fittipaldi Jr.", "AIX Racing", 28],
      [19, "Colton Herta", "Hitech", 26], [20, "Mari Boya", "Prema Racing", 21],
      [21, "Nicolas Varrone", "Van Amersfoort Racing", 15], [22, "Cian Shields", "AIX Racing", 10],
      [23, "Hiyu Yamakoshi", "Van Amersfoort Racing", 2]
    ],
    takimlar: [
      [1, "Campos Racing", 333], [2, "Invicta Racing", 297], [3, "Rodin Motorsport", 296],
      [4, "MP Motorsport", 200], [5, "DAMS Lucas Oil", 173], [6, "ART Grand Prix", 163],
      [7, "Trident", 128], [8, "Hitech", 96], [9, "Van Amersfoort Racing", 55],
      [10, "Prema Racing", 51], [11, "AIX Racing", 38]
    ]
  },
  {
    kod: "f3", ad: "Formula 3",
    durum: "Sezon bitti. Şampiyon: Ugo Ugochukwu (Campos Racing). Takımlar şampiyonu: Campos Racing.",
    guncelleme: "4 Ekim 2026",
    kaynak: "pitdebrief.com (Madrid finali sonrası resmî puan durumu)",
    not: "Pilot listesinde ilk 10 var. Takım adı bazı pilotlar için haberlerden eşleştirildi.",
    pilotlar: [
      [1, "Ugo Ugochukwu", "Campos Racing", 159], [2, "Freddie Slater", "Trident", 145],
      [3, "Tuukka Taponen", "MP Motorsport", 109], [4, "Taito Kato", "ART Grand Prix", 105],
      [5, "Théophile Naël", "Campos Racing", 88], [6, "Pedro Clerot", "Rodin Motorsport", 88],
      [7, "Ernesto Rivera", "Campos Racing", 87], [8, "Brando Badoer", "Rodin Motorsport", 71],
      [9, "Hiyu Yamakoshi", "Van Amersfoort Racing", 71], [10, "Noah Strømsted", "Trident", 65]
    ],
    takimlar: [
      [1, "Campos Racing", 334], [2, "Trident", 217], [3, "MP Motorsport", 208],
      [4, "ART Grand Prix", 189], [5, "Van Amersfoort Racing", 168], [6, "Rodin Motorsport", 161],
      [7, "Prema Racing", 75], [8, "Hitech", 55], [9, "DAMS Lucas Oil", 53], [10, "AIX Racing", 43]
    ]
  },
  {
    kod: "fe", ad: "Formula E",
    durum: "2025-26 sezonu bitti (Londra sonrası). Şampiyon: Pascal Wehrlein.",
    guncelleme: "4 Ekim 2026",
    kaynak: "e-formula.news ve autosport.com puan tabloları",
    not: "Listede ilk 7 pilot var. Takımı kaynaklarda net göremediğim pilotların takım sütunu boş.",
    pilotlar: [
      [1, "Pascal Wehrlein", "Porsche", 169], [2, "Jake Dennis", "Andretti", 164],
      [3, "Mitch Evans", "Jaguar", 160], [4, "Oliver Rowland", "Nissan e.Dams", 137],
      [5, "Edoardo Mortara", "Mahindra", 137], [6, "António Félix da Costa", "-", 128],
      [7, "Nyck de Vries", "-", 115]
    ],
    takimlar: []
  }
];
