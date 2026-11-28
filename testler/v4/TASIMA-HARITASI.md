# F1 TAKİP v4.0 — Taşıma Haritası (Aşama 0)

Kaynak: `tasima-haritasi.json` (bu tablo ondan üretildi). Aşama: özelliğin taşınacağı v4 aşaması; boş = yeri değişmez.

| # | Özellik | Şu anki yeri | v4'teki yeri | Aşama |
|---|---|---|---|---|
| 1 | BUGÜN durum merkezi (canlı / yarış haftası / yarış bitti / normal / sezon arası modları) | BUGÜN | ANA SAYFA › üst durum kartı | 2 |
| 2 | Kısa yarış tahmini kartı (ilk 3) | BUGÜN | YARIŞ HAFTASI › PROGRAM | 3 |
| 3 | Sezon arası 'Geçmiş şampiyonlar' bloğu | BUGÜN (sezon arası modu) | ANA SAYFA › sezon arası kartı | 2 |
| 4 | Sezon başlığı ve sıradaki yarış kutusu | SEZON | ANA SAYFA | 2 |
| 5 | Takvim kartları + yarış Detay paneli | SEZON › Takvim | ANA SAYFA › Takvim | 2 |
| 6 | Yedek takvim tablosu (kartlar çizilemezse) | SEZON | ANA SAYFA (yedek) | 2 |
| 7 | Şampiyonluk hesaplayıcı | SEZON | ANA SAYFA › Puan durumu › SENARYO (şampiyonluk kesinleşince gizlenir) | 2 |
| 8 | Pilotlar puan durumu | SEZON | ANA SAYFA › Puan durumu | 2 |
| 9 | Takımlar puan durumu | SEZON | ANA SAYFA › Puan durumu | 2 |
| 10 | Yarış haftası programı, seans kartları, seans detayı | HAFTA SONU › HAFTA | YARIŞ HAFTASI › PROGRAM | 3 |
| 11 | Hafta sonu bağlam kartı (en fazla 3 madde) | HAFTA SONU › HAFTA | YARIŞ HAFTASI › PROGRAM | 3 |
| 12 | Sprint ekranı (Sprint Sıralaması, Sprint, Sprint notları) | HAFTA SONU › SPRINT (yalnız sprint haftası) | YARIŞ HAFTASI › SPRINT (yalnız sprint haftası) | 3 |
| 13 | Yarış Günü / Live Race Control durum özeti, seans şeridi | HAFTA SONU › GÜN | YARIŞ HAFTASI › CANLI | 3 |
| 14 | Geri sayım / sıradaki seans kutusu | HAFTA SONU › GÜN | YARIŞ HAFTASI › CANLI | 3 |
| 15 | Yarış günü hava durumu | HAFTA SONU › GÜN | YARIŞ HAFTASI › PROGRAM ve CANLI (yeni hava kartı) | 3 |
| 16 | Race Feed v2 (tüm seanslar, Bluesky notları) | HAFTA SONU › GÜN | YARIŞ HAFTASI › CANLI | 3 |
| 17 | Yarış günü sonuç paneli + OpenF1 ek panelleri | HAFTA SONU › GÜN | YARIŞ HAFTASI › CANLI | 3 |
| 18 | Yarış günü 'İzlerken öğren' kutusu | HAFTA SONU › GÜN | YARIŞ HAFTASI › CANLI | 3 |
| 19 | Feed geliştirici araçları (yenile/test/debug) | HAFTA SONU › GÜN › geliştirici | YARIŞ HAFTASI › CANLI › geliştirici | 3 |
| 20 | Yarış seçici ve yarış başlığı | ANALİZ › YARIŞ | ANALİZ › YARIŞ | 4 |
| 21 | Yarışı Kaçırdıysan (v1 + v2 zenginleştirme) | ANALİZ › YARIŞ | ANALİZ › YARIŞ | 4 |
| 22 | Yarışın Hikâyesi | ANALİZ › YARIŞ | ANALİZ › YARIŞ | 4 |
| 23 | Lastik ve Yarış Stratejisi | ANALİZ › YARIŞ | ANALİZ › YARIŞ | 4 |
| 24 | Sonuç tablosu ve neden çipleri | ANALİZ › YARIŞ | ANALİZ › YARIŞ | 4 |
| 25 | Seans Olayları, Tur Analizi, Geçişler, Pit Stoplar, Seans Hava Koşulları | ANALİZ › YARIŞ (tembel açılır bloklar) | ANALİZ › YARIŞ | 4 |
| 26 | Pit stop tablosu (Jolpica) | ANALİZ › YARIŞ | ANALİZ › YARIŞ | 4 |
| 27 | Tur süreleri grafiği (iki pilot) | ANALİZ › YARIŞ | ANALİZ › YARIŞ | 4 |
| 28 | Ghost Lap + Location Replay (telemetri) | ANALİZ › YARIŞ › Tur süreleri | ANALİZ › YARIŞ | 4 |
| 29 | Ayrıntılı tahmin paneli | ANALİZ › GRAFİK | ANALİZ › TAHMİN | 4 |
| 30 | Sezon Analiz Merkezi (özet, puan gelişimi, form, sprint vs yarış, pist türü performansı) | ANALİZ › GRAFİK | ANALİZ › GRAFİKLER | 4 |
| 31 | Eski puan grafiği (canvas) | ANALİZ › GRAFİK | ANALİZ › GRAFİKLER | 4 |
| 32 | Pilot karşılaştırma (iki pilot, sezon performansı, son 5 form) | KEŞFET › PİLOT & PİST | ANALİZ › PİLOTLAR & TAKIMLAR | 4 |
| 33 | Takım profilleri listesi | KEŞFET › PİLOT & PİST | ANALİZ › PİLOTLAR & TAKIMLAR | 4 |
| 34 | Sezonun pistleri + pist profili | KEŞFET › PİLOT & PİST | ANALİZ › PİSTLER | 4 |
| 35 | Pilot profili (detay paneli) | KEŞFET › PİLOT & PİST › Profil | ANALİZ › PİLOTLAR & TAKIMLAR | 4 |
| 36 | Şampiyonlar arşivi (arama + tablo) | KEŞFET › ŞAMPİYONLAR | ANALİZ › PİLOTLAR & TAKIMLAR › Şampiyonlar (Pilot / Takım) | 4 |
| 37 | Diğer seriler (F2, F3, Formula E — elle doğrulanmış veri) | KEŞFET › DİĞER SERİLER | KEŞFET › SERİLER (F2, F3; F4 ve F1 Academy veri hakkı doğrulanınca). Kısayollar: ANA SAYFA, ANALİZ | 5 |
| 38 | ÖĞREN: sözlük, lastik rehberi, açıklama modu | KEŞFET › ÖĞREN (sözlük paneli açar) | KEŞFET › ÖĞREN | 5 |
| 39 | İzlerken öğren ⓘ ipuçları (tüm ekranlarda) | her ekran | her ekran (değişmez) | — |
| 40 | Ana menü ve alt menü | üst menü (5 sekme) | 4 sekme + logo = ANA SAYFA; canlıda tek dokunuşla CANLI | 1 |
| 41 | Canlı ticker / Race Control çubuğu | üst çubuk | üst çubuk (değişmez) | — |
| 42 | Global arama / hızlı git | üst çubuk | üst çubuk; hedefler yeni konumlara güncellenir | 1 |
| 43 | Favori pilot seçimi ve vurgusu | üst çubuk | üst çubuk (değişmez) | — |
| 44 | Koyu / açık tema | üst çubuk | üst çubuk (değişmez) | — |
| 45 | Scroll telemetry (eğlence sayacı) | sayfa altı | sayfa altı (değişmez) | — |
| 46 | Detay paneli altyapısı (sağ panel / alt sayfa) | her ekran | değişmez | — |
| 47 | Kaynak durumu, Jolpica kuyruğu, YOĞUN / ULAŞILAMIYOR kartları | arka plan | değişmez | — |
| 48 | PWA / service worker / çevrimdışı | arka plan | değişmez; her aşamada sürüm ve önbellek birlikte | — |

## Planlanan, henüz olmayan (gösterilmez)

- **Bildirim Merkezi** → üst başlık › zil simgesi (çalışana kadar gizli)
- **Prediction v2 ve tahmin karnesi** → YARIŞ HAFTASI › PROGRAM, ANALİZ › TAHMİN
- **Yarışın Hikâyesi v2** → ANALİZ › YARIŞ
- **Sezon Sonu Özeti** → ANA SAYFA › sezon arası kartı
- **Enteresan Sorular** → KEŞFET
- **3D Formula Araç Atölyesi** → KEŞFET › ATÖLYE
- **Takımını Kur** → KEŞFET
- **F4 (İtalya) ve F1 Academy otomatik veri altyapısı** → KEŞFET › SERİLER (sonraki geliştirme listesi)
- **Haber Merkezi** → askıda
- **Native iOS** → askıda (bu repoda değil)
