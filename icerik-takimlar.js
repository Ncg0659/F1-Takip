/* A4.2 — Takım profili: STATİK, kısa, doğrulanmış takım bilgisi (yalnızca veri; kod yok). Anahtar: Jolpica constructorId.
   Kaynak: Formula 1 resmî takım sayfaları ve 2026 takım patronları/güç ünitesi yazıları (formula1.com), FIA 2026 giriş listesi haberi, takım siteleri; Wikipedia yalnızca çapraz kontrol.
   Doğrulama: Ekim 2026. Doğrulanamayan alan YAZILMAZ (alan yoksa profilde o satır gizlenir). Öznel sıfat yok; sezon içinde değişen sayılar (puan/galibiyet) yazılmaz.
   "uyruk": YALNIZCA yedektir — takım uyruğu önce standings'teki Constructor.nationality (Jolpica) alanından gelir. "merkez": operasyon merkezi (uyruktan AYRI alan), "merkezNot": isteğe bağlı kısa alt not. "liderlik": [{ad, rol}] — tek "Team Principal" varsa arayüz "Takım Patronu", aksi halde "Takım Liderliği" gösterir.
   "sampiyonluk": Constructors' şampiyonluğu, 2025 sezonu sonu itibarıyla. Pilot adları burada TUTULMAZ (mevcut pilotlar standings'ten dinamik gelir).
   Dosyada olmayan takım için profil yine açılır; yalnızca statik bilgi/tarihçe bloğu gizlenir. */
(function () {
  var T = {
    mercedes: { uyruk: "Almanya", merkez: "Brackley, Birleşik Krallık", liderlik: [{ ad: "Toto Wolff", rol: "Team Principal" }], powerUnit: "Mercedes",
      kurulus: "Köken 1970'te yarışmaya başlayan Tyrrell; Mercedes çalışma takımı olarak 2010'dan beri yarışıyor.",
      oncekiIsim: ["Tyrrell (1970–1998)", "British American Racing (1999–2005)", "Honda Racing F1 Team (2006–2008)", "Brawn GP (2009)"],
      sampiyonluk: { constructors: 8, yillar: [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021] },
      tarihce: ["Mevcut takımın kökeni Tyrrell'e dayanır; takım sırasıyla BAR, Honda ve Brawn GP adlarıyla yarıştı.", "Mercedes-Benz, Brawn GP'yi devralarak 2010'da çalışma takımı olarak F1'e döndü.", "2014–2021 arasında sekiz Constructors' şampiyonluğu kazandı."] },
    ferrari: { uyruk: "İtalya", merkez: "Maranello, İtalya", liderlik: [{ ad: "Frédéric Vasseur", rol: "Team Principal" }], powerUnit: "Ferrari",
      kurulus: "Scuderia Ferrari 1929'da kuruldu; F1 dünya şampiyonasına 1950'de katıldı.",
      oncekiIsim: [],
      sampiyonluk: { constructors: 16, yillar: [1961, 1964, 1975, 1976, 1977, 1979, 1982, 1983, 1999, 2000, 2001, 2002, 2003, 2004, 2007, 2008] },
      tarihce: ["Scuderia Ferrari 1929'da Enzo Ferrari tarafından kuruldu.", "1950'de şampiyonanın ilk sezonundan beri her sezon yarışan tek takımdır.", "Son Constructors' şampiyonluğu 2008'dedir (2025 sonu itibarıyla)."] },
    mclaren: { uyruk: "Birleşik Krallık", merkez: "Woking, Birleşik Krallık", liderlik: [{ ad: "Andrea Stella", rol: "Team Principal" }], powerUnit: "Mercedes",
      kurulus: "1963'te Bruce McLaren tarafından kuruldu; F1'deki ilk yarışı 1966 Monaco GP'dir.",
      oncekiIsim: [],
      sampiyonluk: { constructors: 10, yillar: [1974, 1984, 1985, 1988, 1989, 1990, 1991, 1998, 2024, 2025] },
      tarihce: ["1963'te Bruce McLaren tarafından kuruldu, 1966'da F1'e çıktı.", "1988–1991 arasında dört Constructors' şampiyonluğu kazandı.", "1998'den sonra Constructors' şampiyonluğuna 2024'te döndü; 2025'te yeniden kazandı."] },
    red_bull: { uyruk: "Avusturya", merkez: "Milton Keynes, Birleşik Krallık", liderlik: [{ ad: "Laurent Mekies", rol: "Team Principal" }], powerUnit: "Red Bull Ford",
      kurulus: "Red Bull, Jaguar Racing'i Kasım 2004'te satın aldı; takım 2005'ten beri Red Bull Racing adıyla yarışıyor.",
      oncekiIsim: ["Stewart Grand Prix (1997–1999)", "Jaguar Racing (2000–2004)"],
      sampiyonluk: { constructors: 6, yillar: [2010, 2011, 2012, 2013, 2022, 2023] },
      tarihce: ["Red Bull, Jaguar Racing'i 2004'te satın aldı ve 2005'te Red Bull Racing olarak yarışmaya başladı.", "2010–2013 arasında dört, 2022 ve 2023'te iki Constructors' şampiyonluğu kazandı.", "Laurent Mekies, Temmuz 2025'te Christian Horner'ın yerine takım patronu oldu.", "2026'da Ford ortaklığıyla geliştirilen Red Bull Ford güç ünitesine geçti."] },
    rb: { uyruk: "İtalya", merkez: "Faenza, İtalya", liderlik: [{ ad: "Alan Permane", rol: "Team Principal" }], powerUnit: "Red Bull Ford",
      kurulus: "Minardi olarak 1985'te F1'e girdi; Red Bull 2006'da takımı devralıp Scuderia Toro Rosso'ya dönüştürdü.",
      oncekiIsim: ["Minardi (1985–2005)", "Scuderia Toro Rosso (2006–2019)", "Scuderia AlphaTauri (2020–2023)", "Visa Cash App RB (2024)"],
      sampiyonluk: { constructors: 0, yillar: [] },
      tarihce: ["Takım F1'e 1985'te Minardi adıyla girdi.", "Red Bull 2006'da Minardi'yi satın aldı; takım Toro Rosso, AlphaTauri ve RB adlarıyla yarıştı.", "2025'ten itibaren Racing Bulls adını kullanıyor."] },
    alpine: { uyruk: "Fransa", merkez: "Enstone, Birleşik Krallık", liderlik: [{ ad: "Flavio Briatore", rol: "Executive Advisor" }, { ad: "Steve Nielsen", rol: "Managing Director" }], powerUnit: "Mercedes",
      kurulus: "Köken 1981'de yarışmaya başlayan Toleman; Alpine adı 2021'den beri kullanılıyor.",
      oncekiIsim: ["Toleman (1981–1985)", "Benetton (1986–2001)", "Renault (2002–2011)", "Lotus F1 Team (2012–2015)", "Renault (2016–2020)"],
      sampiyonluk: { constructors: 2, yillar: [2005, 2006] },
      tarihce: ["Enstone merkezli takım Toleman, Benetton, Renault ve Lotus adlarıyla yarıştı.", "Renault adıyla 2005 ve 2006'da Constructors' şampiyonluğu kazandı (Benetton'un 1995 Constructors' şampiyonluğu bu sayıya dahil değildir).", "2021'de Alpine adını aldı.", "2026'dan itibaren Mercedes güç ünitesi kullanıyor."] },
    haas: { uyruk: "ABD", merkez: "Kannapolis, ABD", liderlik: [{ ad: "Ayao Komatsu", rol: "Team Principal" }], powerUnit: "Ferrari",
      kurulus: "Gene Haas tarafından kuruldu; F1'e 2016'da girdi.",
      oncekiIsim: ["Haas F1 Team (2016–2025)"],
      sampiyonluk: { constructors: 0, yillar: [] },
      tarihce: ["Gene Haas'ın takımı 2016 sezonunda F1'e girdi.", "Ayao Komatsu, 2024'te Guenther Steiner'ın yerine takım patronu oldu.", "2026'da Toyota Gazoo Racing başlık ortaklığıyla TGR Haas F1 Team adıyla yarışıyor."] },
    audi: { merkez: "Hinwil, İsviçre", motorMerkezi: "Neuburg an der Donau, Almanya", liderlik: [{ ad: "Mattia Binotto", rol: "Team Principal" }], powerUnit: "Audi",
      kurulus: "Audi, Sauber'i devralarak F1'e 2026'da katıldı; takımın kökeni 1993'te F1'e giren Sauber'dir.",
      oncekiIsim: ["Sauber (1993–2005)", "BMW Sauber (2006–2009)", "Sauber (2010–2018)", "Alfa Romeo Racing (2019–2023)", "Stake F1 Team Kick Sauber (2024–2025)"],
      sampiyonluk: { constructors: 0, yillar: [] },
      tarihce: ["Audi, Ağustos 2022'de 2026'dan itibaren F1'e güç ünitesi üreticisi olarak katılacağını duyurdu.", "Takım Sauber altyapısı üzerinde, Hinwil tesisinde kuruldu.", "Takım, Aralık 2025'te Audi Revolut F1 Team adını aldı.", "Mattia Binotto, 20 Mart 2026'da Jonathan Wheatley'in ayrılmasının ardından takım patronluğunu devraldı."] },
    williams: { uyruk: "Birleşik Krallık", merkez: "Grove, Birleşik Krallık", liderlik: [{ ad: "James Vowles", rol: "Team Principal" }], powerUnit: "Mercedes",
      kurulus: "Williams Grand Prix Engineering 1977'de Frank Williams ve Patrick Head tarafından kuruldu.",
      oncekiIsim: [],
      sampiyonluk: { constructors: 9, yillar: [1980, 1981, 1986, 1987, 1992, 1993, 1994, 1996, 1997] },
      tarihce: ["1977'de Frank Williams ve Patrick Head tarafından kuruldu.", "1980–1997 arasında dokuz Constructors' şampiyonluğu kazandı.", "Williams ailesi 2020'de takımı Dorilton Capital'e sattı.", "James Vowles 2023'te takım patronu oldu."] },
    aston_martin: { uyruk: "Birleşik Krallık", merkez: "Silverstone, Birleşik Krallık", liderlik: [{ ad: "Adrian Newey", rol: "Team Principal" }], powerUnit: "Honda",
      kurulus: "Köken 1991'de F1'e giren Jordan; Aston Martin adı 2021'den beri kullanılıyor.",
      oncekiIsim: ["Jordan (1991–2005)", "Midland (2006)", "Spyker (2007)", "Force India (2008–2018)", "Racing Point (2019–2020)"],
      sampiyonluk: { constructors: 0, yillar: [] },
      tarihce: ["Takımın kökeni Jordan'a dayanır; sırasıyla Midland, Spyker, Force India ve Racing Point adlarıyla yarıştı.", "2021'de Aston Martin adını aldı.", "2026'dan itibaren Honda ile fabrika güç ünitesi ortaklığı kurdu."] },
    cadillac: { uyruk: "ABD", merkez: "Indianapolis / Fishers, ABD", merkezNot: "UK teknik merkezi: Silverstone", liderlik: [{ ad: "Marcin Budkowski", rol: "Team Principal" }], powerUnit: "Ferrari",
      kurulus: "General Motors ve TWG Motorsports ortak girişimi; F1'e 2026'da 11. takım olarak girdi.",
      oncekiIsim: [],
      sampiyonluk: { constructors: 0, yillar: [] },
      tarihce: ["Takımın F1 girişi Kasım 2024'te ilke olarak, Mart 2025'te resmen onaylandı.", "2026'da F1'e katılan yeni takımdır; önceki bir takımdan devralınmadı.", "Marcin Budkowski, Ağustos 2026'da Graeme Lowdon'un yerine takım patronu oldu."] }
  };
  window.ICERIK_TAKIMLAR = {
    surum: 1,
    kaynak: "Formula 1 (formula1.com) ve takım siteleri; Wikipedia ile çapraz kontrol",
    dogrulama: "Ekim 2026",
    sampiyonlukKapsami: "2025 sonu itibarıyla",
    takimlar: T
  };
})();
