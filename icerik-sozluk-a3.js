/* A3 — Sözlük eklentisi (Y3 içerik). YALNIZCA VERİ. A2.2'nin icerik-sozluk.js dosyasını DEĞİŞTİRMEZ; mevcut terimlere dokunmaz,
   yalnızca olmayan terimleri ekler. ogren-ui.js'ten ÖNCE yüklenmelidir. Bu terimler uygulamanın kendi hesap yöntemini anlatır
   (dış kural iddiası yok), bu yüzden dogrulama: "uygulama" ve harici kaynak bağlantısı yoktur.
   A3.1: puan-dogrulama. A3.2: ortalama-start, ortalama-bitis, form, net-pozisyon, pole-donusumu. A3.3: sprint-katkisi. A3.4a: pist-turu.
   Kalan terimler (baş başa vb.) ilgili özellikler yapıldığında (A3.3) eklenecek. */
(function () {
  var I = window.ICERIK = window.ICERIK || {}, S = I.sozluk;
  if (!S || !S.terimler) { return; }
  var EK = {
    "puan-dogrulama": { ad: "Hesaplanan puan ve resmî sıralama", kat: "puan", seviye: 2,
      kisa: "Sezon Analiz Merkezi puanları, sezonun tüm yarış ve sprint sonuçlarını toplayarak kendisi hesaplar. Bu toplam, uygulamadaki resmî sıralama tablolarıyla karşılaştırılır.",
      uzun: "Fark görünürse iki kaynaktaki sonuçlar bir noktada ayrışmıştır. Uygulama farkın nedenini bilemez ve hiçbir değeri kendiliğinden değiştirmez. Karşılaştırmada resmî sıralama tablosu referans alınır; hesaplanan toplamlar sprint puanlarını da içerir.",
      iliskili: ["puan-sistemi", "sprint-puani", "takimlar-sampiyonasi"], dogrulama: "uygulama" },
    "ortalama-start": { ad: "Ortalama Start", kat: "pozisyon", seviye: 1,
      kisa: "Pilotun ana yarışlarda başladığı sıranın ortalaması. Küçük sayı, yarışlara genellikle önden başlandığı anlamına gelir (1 = ilk sıra).",
      uzun: "Hesap: yalnızca ana yarış; sprint, DNF, DNS, DSQ ve pit çıkışından (grid 0) başlanan yarışlar sayılmaz. Ortalama Start ve Ortalama Bitiş aynı yarışlardan hesaplanır; yarış sayısı kartta “14 / 16” gibi yazılır, yani ortalama sezonun tamamını değil o yarışları kapsar. Kaynak: uygulama içi hesap yöntemi.",
      iliskili: ["ortalama-bitis", "net-pozisyon", "grid", "pit-cikisi"], dogrulama: "uygulama" },
    "ortalama-bitis": { ad: "Ortalama Bitiş", kat: "pozisyon", seviye: 1,
      kisa: "Pilotun ana yarışları bitirdiği sıranın ortalaması. Küçük sayı, yarışları genellikle önde bitirdiği anlamına gelir (1 = birincilik).",
      uzun: "Hesap: yalnızca ana yarış ve yalnızca sınıflandırılmış bitişler; bir tur geride bitirip sınıflandırılan pilot dahildir. Sprint, DNF, DNS, DSQ ve pit çıkışından (grid 0) başlanan yarışlar sayılmaz. Aynı yarışlar Ortalama Start için de kullanılır; yarış sayısı kartta yazılır. Kaynak: uygulama içi hesap yöntemi.",
      iliskili: ["ortalama-start", "net-pozisyon", "dnf", "tur-farki"], dogrulama: "uygulama" },
    "form": { ad: "Form", kat: "yaris", seviye: 1,
      kisa: "Bir pilotun son yarışlardaki sonuçlarının görünümü. Bu ekranda son 5 ana yarıştaki bitiş sırası yan yana gösterilir.",
      uzun: "Sonuçlar olduğu gibi listelenir; neden yorumu yapılmaz. DNF (yarışı bitiremedi), DNS (başlayamadı) ve DSQ (diskalifiye) ayrı yazılır; pilot yarışmadıysa tire görünür. Küçük çubuklar bitiş sırasını gösterir: çubuk ne kadar yüksekse sıra o kadar önde. Kaynak: uygulama içi hesap yöntemi.",
      iliskili: ["dnf", "dns-dsq", "podyum"], dogrulama: "uygulama" },
    "net-pozisyon": { ad: "Net Pozisyon", kat: "pozisyon", seviye: 1,
      kisa: "Başlangıç sırası eksi bitiş sırası. 19. sıradan başlayıp 1. bitirmek +18, 3. sıradan başlayıp 7. bitirmek -4 eder.",
      uzun: "Sezon toplamı, yarışlardaki bu farkların toplamıdır. Yalnızca ana yarış ve sınıflandırılmış bitişler sayılır; sprint, DNF, DNS, DSQ ve pit çıkışı (grid 0) hariçtir. Yarış sayısı kartta yazılır; arkadan başlayan pilotlar kolay pozisyon kazanabileceği için sayı tek başına “daha iyi pilot” anlamına gelmez. Kaynak: uygulama içi hesap yöntemi.",
      iliskili: ["pozisyon-kazanma", "ortalama-start", "ortalama-bitis", "grid"], dogrulama: "uygulama" },
    "pole-donusumu": { ad: "Pole Dönüşümü", kat: "hafta-sonu", seviye: 2,
      kisa: "Pole'dan başlayan pilotun yarışı kazanma oranı. Örnek: 6 pole'un 4'ünde galibiyet, %66.7 dönüşüm demektir.",
      uzun: "“P1 start → galibiyet” ayrı bir ölçüdür: yarışa gerçekten gridin ilk sırasından çıkan pilotu sayar. Grid cezası alan pole sahibi pole sayısına girer ama P1 start sayısına girmez; pole'u olmadan P1'den başlayan pilot ise yalnızca P1 start'a girer. Pole yalnızca sıralama P1'dir. Kaynak: uygulama içi hesap yöntemi.",
      iliskili: ["pole", "grid", "grid-cezasi", "siralama"], dogrulama: "uygulama" },
    "pist-turu": { ad: "Pist türü", kat: "yaris", seviye: 1,
      kisa: "Pistlerin karakterine göre dörde ayrıldığı uygulama içi sınıflandırma: Sokak, Yüksek hız, Teknik, Karma. Resmî FIA kategorisi değildir.",
      uzun: "Sınıflandırma elle yazılmış sabit bir tablodur; otomatik tahmin yoktur. Her pist yalnızca bir ana kategoriye girer, bu yüzden bir yarış iki türün istatistiğinde birden sayılmaz. Tartışmalı pistlerin (örneğin Baku) gerekçesi 'Pist sınıflandırmasını göster' bölümünde yazılıdır. Bir türde 3 yarıştan az sonuç varsa 'Küçük örneklem' uyarısı görünür. Kaynak: uygulama içi hesap yöntemi (elle yazılmış sınıflandırma tablosu).",
      iliskili: ["sprint-katkisi", "ortalama-bitis", "podyum"], dogrulama: "uygulama" },
    "sprint-katkisi": { ad: "Sprint Katkısı", kat: "puan", seviye: 1,
      kisa: "Bir pilotun toplam puanının ne kadarının sprint yarışlarından geldiği. Örnek: 320 puanın 34'ü sprint ise katkı %10,6'dır.",
      uzun: "Hesap: sprint puanı ÷ toplam puan. Toplam puan, ana yarış puanı ile sprint puanının toplamıdır; ikisi ayrı gösterilir ve birbirine karıştırılmaz. Toplam puan 0 ise oran hesaplanamaz ve tire görünür. Sprint galibiyeti ve podyumu ana yarış galibiyetine ve podyumuna eklenmez. Kaynak: uygulama içi hesap yöntemi.",
      iliskili: ["sprint-puani", "sprint", "puan-sistemi"], dogrulama: "uygulama" }
  };
  Object.keys(EK).forEach(function (k) { if (!S.terimler[k]) { S.terimler[k] = EK[k]; } });
})();
