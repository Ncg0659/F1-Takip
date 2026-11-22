# F1 TAKİP — çalışma kuralları (Claude / Codex için)

Bu repo **yayındaki sitenin kendisidir** (GitHub Pages, `main` dalı, kök klasör). `main`'e giden her şey canlıya çıkar.

## Tek kaynak
- Web/PWA'nın tek doğru kopyası bu repodur. Masaüstü klasörleri, eski ZIP'ler veya başka sohbetlerin çıktıları taban alınmaz.
- Çalışma her zaman ayrı bir dalda yapılır (`gelistirme/...`), test edilir, PR açılır. `main`'e birleştirmeye kullanıcı karar verir.
- Yayın ZIP'i yalnız kullanıcı isterse hazırlanır.

## Kullanıcı kuralları
- Türkçe yanıt; kullanıcı kodlamaya yeni başlıyor (grafik tasarımcı). Mesajlarda kod paylaşma; kısa, numaralı final rapor.
- Ücretli servis yok (0 TL), APNs/backend yok. Eksik veri = null; veri UYDURULMAZ.
- Test sonuçlarını dürüst raporla; çalıştırılmayanı "geçti" deme. Gerçek iPhone'da denenmeyeni "doğrulandı" deme.
- Sürüm atlatma / ZIP / yeni özellik yalnız açıkça istenince. "Yap, test et, DUR."
- `canli5` testini asla çalıştırma.

## Tasarım dili
Premium %70 / race-control %30, koyu-teknik-temiz. Kırmızı yalnız gerçek LIVE/kritik, amber tahmini/gecikmeli, favori pilot nötr vurgu. Neon/glow yok. Referans kart sistemi: ANALİZ → GRAFİK (`.a3-kart`). Son katman görünüm kuralları `polish-v1.css`.

## Sürüm ve önbellek
- Sürüm: `index.html` → `app-version` + tüm `?v=X.Y.Z` etiketleri, `sw.js` → `VERSION = "F1-TAKIP-vX.Y.Z-PWA1"`. Üçü birlikte değişir; yoksa telefon eski dosyayı gösterir.
- `index.html`'in yüklediği her yerel JS/CSS `sw.js` PRECACHE listesinde olmalı. API/dış kaynak önbelleğe alınmaz.

## Testler
- `bash testler/calistir.sh` → çekirdek regresyon (Playwright + node). Tek dosya: `bash testler/calistir.sh bugun_v3_test`.
- Testler siteyi `/home/claude/f1-takip` yolundan açar (script gerekirse bağlantı kurar). Ekran görüntüleri `/tmp/f1-ekran/`.
- `testler/` ve bu dosya Pages'te yayınlanmaz (`_config.yml` exclude).
- Native iOS (`f1-ios`) bu repoda değil.
