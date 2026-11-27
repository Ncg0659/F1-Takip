// Race Feed kaynak yapılandırması.
// liveSource: true  -> canlı seans sırasında düzenli kontrol edilir (FP1-3, Sprint Sıralaması, Sprint, Sıralama, Yarış)
// enabled: false    -> hiç kontrol edilmez
// trustLevel: A (resmî) / B (tanınmış gazeteci, haber kuruluşu) / C (fan, diğer)
// did: Bluesky kalıcı hesap kimliği (handle değişse de aynı hesap). Varsa istek did ile yapılır; bağlantılarda handle kullanılır.
window.NOTLAR_KAYNAKLAR = [
  {
    id: "bsky-medland", name: "Chris Medland", type: "bluesky",
    handle: "chrismedlandf1.bsky.social",
    priority: "high", trustLevel: "B", enabled: true, liveSource: true
  },
  {
    // 3.3.0: ikinci canlı kaynak. Doğrulama (27 Kas 2026): did:plc:bmmxdktsmsdklw5arywa36iw, "F1 Journalist" (Autosport, RacingNews365, F1Oversteer imzaları),
    // Katar FP1/FP2'de kırmızı bayrak, seans uzatması ve pist olaylarını dakikalar içinde paylaştı. Medland çoğunlukla yalnız yarışları anlatıyor.
    id: "bsky-mitchell", name: "Rory Mitchell", type: "bluesky",
    handle: "rorymitchellf1.bsky.social", did: "did:plc:bmmxdktsmsdklw5arywa36iw",
    priority: "high", trustLevel: "B", enabled: true, liveSource: true
  },
  {
    id: "bsky-fabrega", name: "Albert Fabrega", type: "bluesky",
    handle: "albertfabrega.bsky.social",
    priority: "secondary", trustLevel: "B", enabled: false, liveSource: false
    // Not: Test sırasında son postu Temmuz 2026'ydı, canlı kaynak olarak kullanılmıyor.
  }
  // RSS kaynakları (haber) Race Feed'e girmez: Haber Merkezi ayrı çalışmadır.
];

// Genel ayarlar
window.NOTLAR_AYAR = {
  debug: false,            // debug paneli (production: kapalı)
  pollSaniye: 30,          // seans aktifken kontrol aralığı
  oncePencereDk: 60,       // YARIŞ/SPRINT: başlangıçtan kaç dakika önceki postlar alınsın
  sonraPencereDk: 60,      // YARIŞ/SPRINT: bitişten kaç dakika sonrası alınsın
  maxYarisSaat: 4,         // bitiş zamanı bilinmiyorsa start + bu kadar saat
  maxOlay: 200,            // saklanacak en fazla olay sayısı
  seansOnceDk: 15,         // ANTRENMAN/SIRALAMA: seans başlangıcından kaç dakika önceki postlar (aradaki başka seansın notları karışmasın)
  seansSonraDk: 30,        // ANTRENMAN/SIRALAMA: (uzatma dahil) bitişten kaç dakika sonrası (seans özeti notları)
  kaynakZamanAsimiMs: 8000 // tek kaynağın en uzun bekleme süresi; biri yavaş/kapalıysa diğeri beklemez
};
