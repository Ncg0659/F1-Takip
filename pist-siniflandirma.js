/* A3.4a — UYGULAMA İÇİ PİST SINIFLANDIRMASI. Elle yazılmış sabit tablo; resmî FIA kategorisi DEĞİLDİR, otomatik tahmin yapılmaz.
   Kurallar: her pistin YALNIZCA BİR ana kategorisi vardır (bir pist iki kategorinin istatistiğine girmez); tabloda olmayan circuitId
   "sınıflandırılmamış" sayılır ve hiçbir kategoriye girmez. Hesaplar yalnızca ana kategori üzerinden çalışır (ikincil etiket yok).
   Kategoriler: sokak, yuksek (Yüksek hız), teknik, karma. tartisma:true = tek kategoriye oturması tartışmalı; gerekçede neden seçildiği yazar.
   circuitId değerleri Jolpica/Ergast kimlikleridir. Kapsam: 2026 takvimindeki 23 pist + uygulamanın pist listesinde (seri-ayarlari.js) bulunan Bahreyn, Cidde ve Imola = 26 pist. Yeni pist eklemek için bu dosyaya satır eklenir. */
(function (kok) {
  "use strict";
  var KATEGORILER = {
    sokak:  { ad: "Sokak",      tanim: "Şehir/sokak karakteri baskın pistler: dar alan, bariyer yakınlığı, sokak yerleşimi." },
    yuksek: { ad: "Yüksek hız", tanim: "Uzun düzlükler, yüksek ortalama hız ve düşük downforce karakteri baskın pistler." },
    teknik: { ad: "Teknik",     tanim: "Viraj kombinasyonları, yön değişimleri ve mekanik tutuşun daha belirleyici olduğu pistler." },
    karma:  { ad: "Karma",      tanim: "Belirgin şekilde tek kategoriye oturmayan, farklı karakterleri dengeli taşıyan pistler." }
  };
  var SIRA = ["sokak", "yuksek", "teknik", "karma"];
  var PISTLER = [
    // ---- SOKAK ----
    { circuitId: "monaco",       ad: "Circuit de Monaco",                   kategori: "sokak",  gerekce: "Şehir içi sokak pisti; dar alan ve bariyer yakınlığı baskın." },
    { circuitId: "marina_bay",   ad: "Marina Bay Street Circuit",           kategori: "sokak",  gerekce: "Şehir içi sokak pisti; çok sayıda sert viraj ve duvar." },
    { circuitId: "baku",         ad: "Baku City Circuit",                   kategori: "sokak",  gerekce: "TARTIŞMALI: çok uzun düzlüğü var ama pistin tamamı şehir sokaklarında ve dar eski şehir bölümü bariyerler arasından geçiyor; sokak karakteri baskın sayıldı.", tartisma: true },
    { circuitId: "vegas",        ad: "Las Vegas Strip Circuit",             kategori: "sokak",  gerekce: "TARTIŞMALI: çok hızlı uzun düzlükler içerir; ancak geçici şehir/sokak yerleşimi olduğu için Sokak seçildi, Yüksek hız değil.", tartisma: true },
    { circuitId: "jeddah",       ad: "Jeddah Corniche Circuit",             kategori: "sokak",  gerekce: "TARTIŞMALI: ortalama hızı çok yüksek; fakat duvarlarla çevrili sokak yerleşimi baskın olduğu için Sokak seçildi.", tartisma: true },
    // ---- YÜKSEK HIZ ----
    { circuitId: "monza",        ad: "Autodromo Nazionale Monza",           kategori: "yuksek", gerekce: "Uzun düzlükler ve düşük downforce ayarı; en yüksek ortalama hızlardan biri." },
    { circuitId: "spa",          ad: "Circuit de Spa-Francorchamps",        kategori: "yuksek", gerekce: "Uzun düzlükler ve yüksek hızlı viraj kombinasyonları." },
    { circuitId: "silverstone",  ad: "Silverstone Circuit",                 kategori: "yuksek", gerekce: "Hızlı, akıcı viraj kombinasyonları; yüksek ortalama hız." },
    { circuitId: "red_bull_ring", ad: "Red Bull Ring",                      kategori: "yuksek", gerekce: "TARTIŞMALI: pist kısa ama turun büyük kısmı tam gaza yakın, az viraj; yüksek ortalama hız nedeniyle Yüksek hız seçildi.", tartisma: true },
    { circuitId: "losail",       ad: "Losail International Circuit",        kategori: "yuksek", gerekce: "TARTIŞMALI: yavaş viraj az, sürekli orta-yüksek hızlı viraj zinciri ve yüksek ortalama hız; Teknik/Karma yerine Yüksek hız seçildi.", tartisma: true },
    // ---- TEKNİK ----
    { circuitId: "suzuka",       ad: "Suzuka International Racing Course",  kategori: "teknik", gerekce: "Art arda yön değişimleri (ess bölümü); viraj kombinasyonları belirleyici." },
    { circuitId: "hungaroring",  ad: "Hungaroring",                         kategori: "teknik", gerekce: "Dar, virajlı ve düşük ortalama hızlı; mekanik tutuş belirleyici." },
    { circuitId: "zandvoort",    ad: "Circuit Park Zandvoort",              kategori: "teknik", gerekce: "Dar, yan eğimli virajlı ve çok yön değiştiren yerleşim." },
    { circuitId: "bahrain",      ad: "Bahrain International Circuit",       kategori: "teknik", gerekce: "TARTIŞMALI: sert frenleme ve çıkış çekişi (mekanik tutuş) belirleyici; uzun düzlükleri de var, Teknik seçildi.", tartisma: true },
    { circuitId: "miami",        ad: "Miami International Autodrome",       kategori: "teknik", gerekce: "TARTIŞMALI: geçici pist ama sokak yerleşimi değil (stadyum çevresi); yavaş viraj ve şikan dizileri nedeniyle Teknik seçildi.", tartisma: true },
    { circuitId: "imola",        ad: "Autodromo Enzo e Dino Ferrari",       kategori: "teknik", gerekce: "TARTIŞMALI: dar ve eski usul akıcı pist; şikanlar ve yön değişimleri belirleyici; geçiş zorluğu nedeniyle Teknik. (2026 takviminde yok; eski sezon verisi için tanımlı.)", tartisma: true },
    { circuitId: "yas_marina",   ad: "Yas Marina Circuit",                  kategori: "teknik", gerekce: "TARTIŞMALI: yavaş virajlar ve ağır frenleme bölgeleri; çekiş ve mekanik tutuş belirleyici sayıldı." },
    // ---- KARMA ----
    { circuitId: "catalunya",    ad: "Circuit de Barcelona-Catalunya",      kategori: "karma",  gerekce: "Hızlı, yavaş ve orta hızlı virajları dengeli taşıyan klasik karma pist." },
    { circuitId: "interlagos",   ad: "Autódromo José Carlos Pace",          kategori: "karma",  gerekce: "Uzun düzlük + yavaş viraj + akıcı bölüm dengeli." },
    { circuitId: "americas",     ad: "Circuit of the Americas",             kategori: "karma",  gerekce: "Uzun düzlük, yavaş keskin virajlar ve hızlı ess bölümü bir arada." },
    { circuitId: "rodriguez",    ad: "Autódromo Hermanos Rodríguez",        kategori: "karma",  gerekce: "TARTIŞMALI: uzun düzlük ve yavaş stadyum bölümü bir arada; yüksek rakım ayrı bir etken ama tek kategoriye oturmadığı için Karma." },
    { circuitId: "shanghai",     ad: "Shanghai International Circuit",      kategori: "karma",  gerekce: "Uzun arka düzlük, uzun viraj zincirleri ve keskin dönüşler dengeli." },
    { circuitId: "albert_park",  ad: "Albert Park Circuit",                 kategori: "karma",  gerekce: "TARTIŞMALI: park içi yollar (yarı sokak) ama akıcı ve hızlı bölümleri de var; tek kategoriye oturmadığı için Karma." },
    { circuitId: "villeneuve",   ad: "Circuit Gilles Villeneuve",           kategori: "karma",  gerekce: "TARTIŞMALI: dur-kalk karakteri ve uzun düzlükler, duvarlara yakın yarı kalıcı yerleşim; tek bir karaktere oturmadığı için Karma." },
    { circuitId: "sepang",       ad: "Sepang International Circuit",        kategori: "karma",  gerekce: "TARTIŞMALI: 2026 takviminde 'Bahrain Grand Prix in Malaysia' adıyla yer alıyor. Uzun düzlükler, geniş viraj yayları ve yavaş dönüşler dengeli; tek kategoriye oturmadığı için Karma.", tartisma: true },
    { circuitId: "madring",      ad: "Madring (Madrid)",                    kategori: "karma",  gerekce: "TARTIŞMALI: yeni, kısmen şehir içi / kısmen kalıcı hibrit yerleşim; elde uzun vadeli sonuç olmadığından Karma seçildi, ileride gözden geçirilebilir.", tartisma: true }
  ];

  function harita() { var h = {}; PISTLER.forEach(function (p) { h[p.circuitId] = p; }); return h; }
  function kategoriOf(id) { var p = harita()[id]; return p ? p.kategori : null; }
  var API = { baslik: "Uygulama içi pist sınıflandırması", KATEGORILER: KATEGORILER, SIRA: SIRA, PISTLER: PISTLER, harita: harita, kategoriOf: kategoriOf };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
  if (kok) { kok.PIST_SINIFLANDIRMA = API; }
})(typeof window !== "undefined" ? window : null);
