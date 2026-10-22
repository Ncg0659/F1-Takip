/* A2.2 — Y3 içerik: Lastik rehberi (5 kısa kart). YALNIZCA VERİ. Metinde yalnızca [[terim]] ve **kalın** işlenir.
   Kapsam notu: Jolpica pit stop verisi lastik bileşiğini içermez; rehber genel açıklamadır, belirli bir pilotun hangi lastikle koştuğunu göstermez.
   Kaynak: formula1.com "The beginner's guide to F1 tyres" (2026 sezonu kuralları). */
(function () {
  var I = window.ICERIK = window.ICERIK || {};
  var KAYNAK = "https://www.formula1.com/en/latest/article/the-beginners-guide-to-formula-1-tyres.61SvF0Kfg29UR2SPhakDqd";
  I.lastik = {
    surum: 1,
    baslik: "Lastik rehberi",
    kaynak: KAYNAK,
    kartlar: [
      { id: "bilesikler", baslik: "Lastik bileşikleri", donem: "2026",
        metin: "Kuru hava için üç lastik kullanılır: **Yumuşak** (kırmızı) çok tutar ama çabuk biter; **Sert** (beyaz) daha az tutar ama uzun dayanır; **Orta** (sarı) ikisinin arasıdır. Yumuşak lastik sıralama turları için idealdir. [[lastik-bilesikleri]]",
        gorsel: [
          { ad: "Yumuşak", renk: "#e10600", tutus: 3, dayanim: 1 },
          { ad: "Orta", renk: "#f5c400", tutus: 2, dayanim: 2 },
          { ad: "Sert", renk: "#e9eef5", tutus: 1, dayanim: 3 }
        ] },
      { id: "islak", baslik: "Islak hava lastikleri",
        metin: "Pist nemli ya da hafif ıslakken **ara lastik** (yeşil), çok ıslakken **yağmur lastiği** (mavi) kullanılır. Pist kuruduğunda tekrar kuru lastiğe dönülür. [[ara-lastik]] [[yagmur-lastigi]]" },
      { id: "neden-degisir", baslik: "Lastik neden değişir?",
        metin: "Lastik kullanıldıkça tutuşunu kaybeder ([[lastik-asinmasi]]) ve tur süreleri yavaşlar. Pilot yeni lastik için pite girer; iki pit stop arasındaki bölüme [[stint]] denir. Rakipten önce pite girip taze lastikle öne geçmeye çalışmaya [[undercut]] denir." },
      { id: "kural", baslik: "Yarışta kural", donem: "2026",
        metin: "Pist kuruysa her pilot yarış boyunca **en az iki farklı kuru lastik bileşeni** kullanmak zorundadır; bu yüzden kuru yarışta en az bir pit stop gerekir. Standart hafta sonunda her pilota **13 set kuru, 5 set ara ve 2 set yağmur lastiği** verilir. [[durus-sayisi]]" },
      { id: "pit-tablosu", baslik: "Pit stop tablosunu okumak",
        metin: "Yarış Analizi'ndeki tabloda **Stop** pilotun kaçıncı kez pite girdiğini, **Tur** hangi turda girdiğini, **Süre** ise genellikle pit hattında geçen toplam süreyi gösterir. Örneğin 1. stop 18. turda, 2. stop 38. turda ise pilot iki duruşlu bir yarış koşmuş demektir. [[pit-stop]]" }
    ]
  };
})();
