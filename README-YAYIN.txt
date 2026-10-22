F1 TAKİP v3.0.0 — GitHub Pages Yayını

1. ZIP'i aç.
2. "GITHUB-PAGES" klasörüne gir.
3. GitHub'da şu repoyu aç:
   https://github.com/Ncg0659/F1-Takip
4. Repo root'una "GITHUB-PAGES" klasörünün KENDİSİNİ değil,
   İÇİNDEKİ TÜM DOSYALARI yükle (113 dosya).
5. Commit mesajı:
   F1 TAKİP v3.0.0 — Production Release
6. GitHub'da: Settings → Pages
7. Build and deployment: Deploy from a branch
8. Branch: main
9. Folder: / (root)
10. Save.

Beklenen canlı adres:
https://ncg0659.github.io/F1-Takip/

ÖNEMLİ — Repo root şöyle görünmeli:
  index.html
  *.css
  *.js
  ...
Şöyle OLMAMALI:
  GITHUB-PAGES/index.html

Yeni sürüm yüklerken:
- eski production dosyalarını yeni GITHUB-PAGES içeriğiyle değiştir
- test/yedek dosyalarını repo root'una yükleme
- Pages ayarını değiştirme

Rollback:
ROLLBACK/F1-Takip-pre-v3.0.0-YEDEK.zip (bir önceki sürüm; geri dönmek için içeriğini aynı şekilde yükle)

Yayın öncesi test sonuçları (sandbox):
- release test suiteleri: geçti (17 suite)
- canli5: 53/53
- viewport matrix: 100/100
- local production asset: 112/112
- JS critical error: 0
- NAV v3 varsayılan, açılış BUGÜN; ?nav=off eski görünüme döner

YAYINDAN SONRA KONTROL ET (sandbox'ta internet API'leri engelliydi, test edilemedi):
- Sayfa temiz tarayıcıda (gizli pencere) açılıyor mu; sert yenileme (Cmd+Shift+R)
- Gerçek sıradaki yarış ve sezon takvimi doğru mu; saatler Türkiye saati mi
- Jolpica (puan durumu/sonuçlar), OpenF1, Bluesky/Race Feed, hava durumu verileri geliyor mu
- SEZON, HAFTA SONU, YARIŞ GÜNÜ, ANALİZ/GRAFİK sekmeleri ilk girişte doluyor mu
- Favori pilot, Öğren [?], koyu/açık tema, 390 px mobil görünüm
- Tarayıcı konsolunda kırmızı hata ve 404 yok mu
