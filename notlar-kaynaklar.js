// Race Feed kaynak yapılandırması.
// liveSource: true  -> yarış sırasında düzenli kontrol edilir
// enabled: false    -> hiç kontrol edilmez
// trustLevel: A (resmî) / B (tanınmış gazeteci, haber kuruluşu) / C (fan, diğer)
window.NOTLAR_KAYNAKLAR = [
  {
    id: "bsky-medland", name: "Chris Medland", type: "bluesky",
    handle: "chrismedlandf1.bsky.social",
    priority: "high", trustLevel: "B", enabled: true, liveSource: true
  },
  {
    id: "bsky-fabrega", name: "Albert Fabrega", type: "bluesky",
    handle: "albertfabrega.bsky.social",
    priority: "secondary", trustLevel: "B", enabled: false, liveSource: false
    // Not: Test sırasında son postu Temmuz 2026'ydı, canlı kaynak olarak kullanılmıyor.
  }
  // RSS kaynakları (Formula 1, Autosport, ...) ikinci aşamada, Cloudflare Worker ile eklenecek.
];

// Genel ayarlar
window.NOTLAR_AYAR = {
  debug: false,            // debug paneli (production: kapalı)
  pollSaniye: 30,          // yarış aktifken kontrol aralığı
  oncePencereDk: 60,       // yarıştan kaç dakika önceki postlar alınsın
  sonraPencereDk: 60,      // yarış bitiminden kaç dakika sonrası alınsın
  maxYarisSaat: 4,         // bitiş zamanı bilinmiyorsa start + bu kadar saat
  maxOlay: 200             // saklanacak en fazla olay sayısı
};
