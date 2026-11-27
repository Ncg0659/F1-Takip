/* 3.3.0 — Race Feed artık TÜM seanslarda: FP1, FP2, FP3, Sprint Sıralaması, Sprint, Sıralama, Yarış. Her seansın kendi deposu var (RaceFeed.oturumAnahtari):
   antrenman notu yarış kartını etkilemez. Antrenman/Sıralama için dar pencere (başlangıç −15 dk → bitiş + doğrulanmış uzatma + 30 dk) ve planlı bitişten
   sonra kısa bir "kapanış" poll payı (uzatma + 20 dk; doğrulanmış kırmızı bayrak/gecikme sürerken en çok +2 saat) vardır. Yeni fetch türü/timer yok.
   A4.5b — Canlı oturum boyunca Race Feed'in TEK sahibi. YENİ endpoint, YENİ ikinci polling döngüsü, YENİ ücretli servis/token YOK.
   Aynı kaynak (RaceFeed.poll → mevcut Bluesky kaynakları), aynı olay motoru/çevirisi/dedupe, aynı 30 sn ritmi kullanılır. Değişen tek şey yaşam döngüsü:
   "Yarış Günü sekmesi açık mı?" yerine "desteklenen canlı oturum var mı?" (yalnızca Sprint ve Race; FP / Sıralama / Sprint Sıralaması asla).
   Tek sahip: poll'u yapan TEK fonksiyon index.html'deki feedPoll()'dur. Bu modül yalnızca KARAR verir (ne zaman, hangi bağlamla) ve her poll arasında
   en az 30 sn şartını (izin) uygular; Yarış Günü sekmesinin eski zamanlayıcısı canlı oturumda devre dışıdır (aynı fetch iki kez olmaz).
   Oturum anahtarı: Race → "<yıl>-<tur>" (eski anahtar, değişmedi) · Sprint → "<yıl>-<tur>-sprint" (ayrı depo; Sprint olayları ana yarışa taşınmaz).
   Hazırlık: canlı oturumda takvim yoksa yerel önbellekten/A1 takvim önbelleğinden okunur; hiçbiri yoksa HaftaVeri.takvimYukle (A1'in önbellek-öncelikli mevcut çağrısı) en çok BİR kez denenir.
   Pilot adları (çeviri için) yoksa uygulamanın kendi sezonuYukle()'sü bir kez başlatılır (Güncel Sezon / Yarış Günü açılışında olan aynı çağrılar).
   Tarayıcı sekmesi gizliyken poll yapılmaz; görünür olunca canlı oturum sürüyorsa hemen bir güncelleme yapılır. Hata: yeni retry sistemi yok; sonraki 30 sn turunda normal devam. */
(function (kok) {
  "use strict";
  var S = { son: 0, zaman: null, takvimYedek: null, takvimIstendi: false, sezonBekle: 0, hata: false, sonZaman: null, sonAnahtar: null };
  var TIK_MS = 5000;                        // YEREL değerlendirme sıklığı (ağ yok); poll KESİN olarak en az 30 sn arayla (pratikte 30–35 sn)
  var DK = 60000, KAPANIS_DK = 20, SEANS_UZATMA_UST_MS = 2 * 3600 * 1000;

  function yarisTipi(an) { return an === "Sprint" || an === "Race"; }
  function anahtarYap(y, s, simdi) {
    var yil = y.season || new Date(simdi).getFullYear();
    if (kok.RaceFeed && RaceFeed.oturumAnahtari) { return RaceFeed.oturumAnahtari(yil, y.round, s.anahtar); }
    return yil + "-" + y.round + (s.anahtar === "Sprint" ? "-sprint" : (s.anahtar === "Race" ? "" : "-" + s.anahtar));
  }
  // Seansın Race Feed deposundaki DOĞRULANMIŞ durumu (HaftaState.feedDurumu; yalnız okur)
  function seansFeed(raceKey, s, simdi, bas, bit) {
    var HS = kok.HaftaState, RF = kok.RaceFeed;
    if (!HS || !HS.feedDurumu || !RF || !RF.yukle) { return null; }
    return bul(function () {
      var ol = RF.yukle(raceKey).olaylar.filter(function (o) { return !o.raceId || o.raceId === raceKey; });
      return HS.feedDurumu(ol, { anahtar: s.anahtar, baslangic: new Date(bas != null ? bas : s.baslangic.getTime()), bitis: new Date(bit != null ? bit : s.bitis.getTime()), planliBaslangic: s.baslangic }, simdi);
    }, null);
  }

  function bul(f, d) { try { return f(); } catch (e) { return d; } }
  function minMs() { var a = bul(function () { return kok.NOTLAR_AYAR.pollSaniye; }, 30); return Math.max(30, Number(a) || 30) * 1000; }

  function takvim() {
    var a = bul(function () { return typeof sezonYarislar !== "undefined" ? sezonYarislar : []; }, []);
    if (a && a.length) { return a; }
    a = bul(function () { return kok.YarisHaftasi && YarisHaftasi._durum && YarisHaftasi._durum.yarislar; }, null);
    if (a && a.length) { return a; }
    var yil = new Date().getFullYear();
    var c = bul(function () { return kok.JolpicaIstemci && JolpicaIstemci.oku("takvim-" + yil); }, null);
    var r = c && c.veri && c.veri.RaceTable && c.veri.RaceTable.Races;
    if (r && r.length) { return r; }
    return S.takvimYedek || [];
  }

  // Canlılık: mevcut A1 seans sistemi. canli() = yalnız Sprint ve Race (ESKİ ANLAM: Yarış Günü otomatik açılışı/yarış seçimi bunu kullanır).
  // canliSeans() = 3.3.0 tüm seanslar (Race Feed poll kararı bunu kullanır).
  function canli(simdi) { return canliIc(simdi, true); }
  function canliSeans(simdi) { return canliIc(simdi, false); }
  function canliIc(simdi, sadeceYaris) {
    simdi = simdi == null ? Date.now() : simdi;
    var HV = kok.HaftaVeri; if (!HV || !HV.haftaKur || !HV.seansDurumu) { return null; }
    var yl = takvim(), i, y, h, j, s, Y;
    for (i = 0; i < yl.length; i++) {
      y = yl[i];
      var gun = Date.parse(y.date);                                         // ön eleme: yarış günü ±3 gün dışında seans hesabı yapılmaz
      if (isNaN(gun) || simdi < gun - 3 * 86400000 || simdi > gun + 3 * 86400000) { continue; }
      h = bul(function () { return HV.haftaKur(y, "f1"); }, null); if (!h) { continue; }
      Y = bul(function () { return kok.YarisHaftasi._durum.hafta; }, null);
      if (Y && Number(Y.tur) === Number(h.tur) && Y.seanslar) { h = Y; }    // A1'in çözümlenmiş sonuçları varsa (sonuç yayımlandı) onu kullan
      for (j = 0; j < h.seanslar.length; j++) {
        s = h.seanslar[j];
        if ((!sadeceYaris || yarisTipi(s.anahtar)) && HV.seansDurumu(s, h, simdi) === "canli") {   // 3.3.0: sadeceYaris=false → tüm seanslar
          return { oturum: s.anahtar, tur: Number(h.tur), ad: h.ad, bas: s.baslangic.getTime(), bit: s.bitis.getTime(),
                   raceKey: anahtarYap(y, s, simdi), yaris: yarisTipi(s.anahtar) };
        }
      }
    }
    return null;
  }

  // Uzatılmış pencere (SADECE poll için; canli() değişmedi → Ticker / Yarış Günü seçimi etkilenmez).
  // Gecikme/kırmızı bayrak yüzünden seans planlı bitişini geçtiyse ve bu OTURUMUN kendi Race Feed deposunda DOĞRULANMIŞ, bitmemiş bir durum (DELAYED / RED_FLAG /
  // SESSION_STOPPED / RESUMED / feed'e göre LIVE) varsa, mevcut poll döngüsü planlı bitişte KÖR kapanmaz. Üst sınırlar: planlı bitişten +3 saat ve notlar-motorunun
  // kendi toplama penceresi (RaceFeed.pencere). Olay kimliği: yalnızca bu oturumun anahtarı (<yıl>-<tur>[-sprint]) ve raceId'si eşleşen olaylar sayılır →
  // Sprint'in eski gecikmesi Race'e (ya da tersi) taşınmaz. Yeni zamanlayıcı/fetch yok: aynı degerlendir() turu, aynı feedPoll(), aynı 30 sn izin kuralı.
  var UZATMA_UST_MS = 3 * 3600 * 1000;
  function uzatilmis(simdi) {
    simdi = simdi == null ? Date.now() : simdi;
    var HV = kok.HaftaVeri, HS = kok.HaftaState, RF = kok.RaceFeed;
    if (!HV || !HV.haftaKur || !HV.seansDurumu || !HS || !HS.feedDurumu || !RF || !RF.yukle) { return null; }
    var yl = takvim(), i, j, y, h, s, Y;
    for (i = 0; i < yl.length; i++) {
      y = yl[i];
      var gun = Date.parse(y.date);
      if (isNaN(gun) || simdi < gun - 3 * 86400000 || simdi > gun + 3 * 86400000) { continue; }
      h = bul(function () { return HV.haftaKur(y, "f1"); }, null); if (!h) { continue; }
      Y = bul(function () { return kok.YarisHaftasi._durum.hafta; }, null);
      if (Y && Number(Y.tur) === Number(h.tur) && Y.seanslar) { h = Y; }
      for (j = 0; j < h.seanslar.length; j++) {
        s = h.seanslar[j];
        if (!yarisTipi(s.anahtar)) {                                                         // 3.3.0: Antrenman / Sıralama kapanış payı
          var sk = kapanis(y, h, s, simdi);
          if (sk) { return sk; }
          continue;
        }
        var bas = s.baslangic.getTime(), bit = s.bitis.getTime();
        if (simdi < bit) { continue; }                                                      // planlı süre içinde → canli() zaten ele alır
        // Doğrulanmış PROGRAM değişikliği (hafta-baglam.js; resmi/statik girdi ya da Race Feed'den açık "yeni saat/ertelendi"): pencere YENİ saate kayar. Yeni saat için
        // yalnızca [yeni başlangıç −15 dk, yeni bitiş +3 saat] poll edilir (planlı bitiş ile yeni saat arasındaki uzun boşlukta poll yok).
        var prog = bul(function () { return kok.BaglamUI ? kok.BaglamUI.program(h, s, simdi) : null; }, null);
        var eb = bas, ebit = bit, progPencere = false;
        if (prog && prog.tip === "NEW_TIME_CONFIRMED" && prog.yeniBaslangic != null) {
          eb = prog.yeniBaslangic; ebit = prog.yeniBitis != null ? prog.yeniBitis : eb + (bit - bas);
          progPencere = simdi >= eb - 15 * 60000 && simdi <= ebit + UZATMA_UST_MS;
        } else if (prog && (prog.tip === "DELAYED" || prog.tip === "POSTPONED")) { progPencere = simdi <= bit + UZATMA_UST_MS; }
        if (simdi > Math.max(bit, ebit) + UZATMA_UST_MS) { continue; }                      // üst sınır aşıldı → durur
        if (HV.seansDurumu(s, h, simdi) !== "sonuc-bekleniyor") { continue; }               // sonuç geldi / bekleme bitti → uzatma yok
        var pen = bul(function () { return RF.pencere(new Date(eb), new Date(simdi)); }, null);
        if (!pen || !pen.aktif) { continue; }                                               // motor bu saatte zaten gönderi kabul etmez
        var yil = y.season || new Date(simdi).getFullYear();
        var raceKey = yil + "-" + y.round + (s.anahtar === "Sprint" ? "-sprint" : "");
        var olaylar = bul(function () { return RF.yukle(raceKey).olaylar; }, []).filter(function (o) { return !o.raceId || o.raceId === raceKey; });
        var fd = bul(function () { return HS.feedDurumu(olaylar, { anahtar: s.anahtar, baslangic: new Date(eb), bitis: new Date(ebit), planliBaslangic: s.baslangic }, simdi); }, null);
        if (fd && fd.tip === "ENDED") { continue; }                                          // seans bitti → poll durur
        var feedDogrulandi = !!(fd && fd.tip);
        if (!feedDogrulandi && !progPencere) { continue; }                                   // ne doğrulanmış feed durumu ne de program değişikliği → eski davranış (planlı bitişte durur)
        if (feedDogrulandi && simdi > Math.max(bit, ebit) + UZATMA_UST_MS) { continue; }
        return { oturum: s.anahtar, tur: Number(h.tur), ad: h.ad, bas: eb, bit: ebit, raceKey: raceKey, uzatma: true };
      }
    }
    return null;
  }

  // Antrenman/Sıralama: planlı bitişten sonra poll ne zamana kadar sürer?
  //  • doğrulanmış seans uzatması (ör. "extended the session by 13 minutes") → bitiş + uzatma + 20 dk
  //  • uzatma yoksa → bitiş + 20 dk (seans sonu özet notları: "X tops FP2", sonuç)
  //  • doğrulanmış kırmızı bayrak / durdurma / gecikme sürüyorsa (ENDED değil) → en çok bitiş + 2 saat
  //  • muhabir "seans bitti" dediyse (ENDED) → bitiş/ENDED + 20 dk'dan hangisi erkense
  function kapanis(y, h, s, simdi) {
    var bas = s.baslangic.getTime(), bit = s.bitis.getTime();
    if (simdi < bit || simdi > bit + SEANS_UZATMA_UST_MS) { return null; }
    var raceKey = anahtarYap(y, s, simdi), fd = seansFeed(raceKey, s, simdi);
    var uz = fd && fd.uzatmaDk ? fd.uzatmaDk : 0, son = bit + (uz + KAPANIS_DK) * DK;
    if (fd && (fd.tip === "RED_FLAG" || fd.tip === "SESSION_STOPPED" || fd.tip === "DELAYED") ) { son = bit + SEANS_UZATMA_UST_MS; }
    if (fd && fd.tip === "ENDED" && fd.bittiTs != null) { son = Math.min(son, Math.max(bit, fd.bittiTs) + KAPANIS_DK * DK); }
    if (simdi > son) { return null; }
    return { oturum: s.anahtar, tur: Number(h.tur), ad: h.ad, bas: bas, bit: bit + uz * DK, raceKey: raceKey, uzatma: true, uzatmaDk: uz, yaris: false };
  }

  // Ticker için oturum seçimi (YALNIZCA okur; poll kararını etkilemez → canli()/pollOturumu() değişmedi).
  // Öncelik: COMPLETED (sonuç var → program override'ı yok sayılır) > PROGRAM override (BaglamUI.program: sezon+tur+seans anahtarlı) > Race Feed durumu (DELAYED) > normal takvim.
  //  NEW_TIME_CONFIRMED → tüm hesap YENİ saate göre (planlı saatte LIVE yok); DELAYED / POSTPONED / CANCELLED → planlı başlangıçtan planlı bitiş +3 sa'e kadar durum satırı.
  // Dönüş: canli() ile aynı alanlar + durum: "canli" | "gecikti" | "ertelendi" | "iptal"
  function tickerOturum(simdi) {
    simdi = simdi == null ? Date.now() : simdi;
    var HV = kok.HaftaVeri, HS = kok.HaftaState, RF = kok.RaceFeed;
    if (!HV || !HV.haftaKur || !HV.seansDurumu) { return null; }
    var yl = takvim(), i, j, y, h, s, Y;
    for (i = 0; i < yl.length; i++) {
      y = yl[i];
      var gun = Date.parse(y.date);
      if (isNaN(gun) || simdi < gun - 3 * 86400000 || simdi > gun + 3 * 86400000) { continue; }
      h = bul(function () { return HV.haftaKur(y, "f1"); }, null); if (!h) { continue; }
      Y = bul(function () { return kok.YarisHaftasi._durum.hafta; }, null);
      if (Y && Number(Y.tur) === Number(h.tur) && Y.seanslar) { h = Y; }
      for (j = 0; j < h.seanslar.length; j++) {
        s = h.seanslar[j];
        var eski = HV.seansDurumu(s, h, simdi);
        if (!yarisTipi(s.anahtar)) {                                                          // 3.3.0: FP1-3 / Sıralama / Sprint Sıralaması: Race Feed VAR (kendi deposu)
          var rk = anahtarYap(y, s, simdi);
          if (eski === "canli") { return { oturum: s.anahtar, tur: Number(h.tur), ad: h.ad, bas: s.baslangic.getTime(), bit: s.bitis.getTime(), raceKey: rk, durum: "canli", feedYok: false }; }
          if (eski === "sonuc-bekleniyor" || eski === "bitti") {                             // planlı bitiş geçti: yalnız DOĞRULANMIŞ uzatma/kırmızı bayrak varsa hâlâ canlı
            var fdS = seansFeed(rk, s, simdi), uzS = fdS && fdS.uzatmaDk ? fdS.uzatmaDk : 0;
            var surer = fdS && fdS.tip && fdS.tip !== "ENDED" && (fdS.tip === "RED_FLAG" || fdS.tip === "SESSION_STOPPED" || fdS.tip === "RESUMED" || (uzS && simdi < s.bitis.getTime() + uzS * DK));
            if (surer && simdi < s.bitis.getTime() + SEANS_UZATMA_UST_MS) { return { oturum: s.anahtar, tur: Number(h.tur), ad: h.ad, bas: s.baslangic.getTime(), bit: s.bitis.getTime() + uzS * DK, raceKey: rk, durum: "canli", feedYok: false, uzatmaDk: uzS }; }
          }
          continue;
        }
        if (eski === "tamamlandi") { continue; }                                              // COMPLETED: override ticker'ı etkilemez
        var bas = s.baslangic.getTime(), bit = s.bitis.getTime(), yil = y.season || new Date(simdi).getFullYear();
        var raceKey = yil + "-" + y.round + (s.anahtar === "Sprint" ? "-sprint" : "");
        var temel = { oturum: s.anahtar, tur: Number(h.tur), ad: h.ad, bas: bas, bit: bit, raceKey: raceKey, durum: "canli" };
        var prog = bul(function () { return kok.BaglamUI ? kok.BaglamUI.program(h, s, simdi) : null; }, null);
        if (prog && prog.tip && prog.tip !== "SCHEDULED") {
          if (prog.tip === "NEW_TIME_CONFIRMED" && prog.yeniBaslangic != null) {
            var eb = prog.yeniBaslangic, ebit = prog.yeniBitis != null ? prog.yeniBitis : eb + (bit - bas);
            if (simdi < eb || simdi >= ebit) { continue; }                                     // yeni saatten önce/sonra: eski planlı saate göre LIVE yok
            temel.bas = eb; temel.bit = ebit; temel.yeniSaat = true;
          } else {
            if (simdi < bas || simdi > bit + UZATMA_UST_MS) { continue; }
            temel.durum = prog.tip === "POSTPONED" ? "ertelendi" : (prog.tip === "CANCELLED" ? "iptal" : "gecikti");
            return temel;
          }
        } else if (eski !== "canli") { continue; }
        // Race Feed durumu: seans için doğrulanmış "başlangıç gecikti" varsa LIVE denmez
        var fd = HS && HS.feedDurumu && RF && RF.yukle ? bul(function () {
          var ol = RF.yukle(raceKey).olaylar.filter(function (o) { return !o.raceId || o.raceId === raceKey; });
          return HS.feedDurumu(ol, { anahtar: s.anahtar, baslangic: new Date(temel.bas), bitis: new Date(temel.bit), planliBaslangic: s.baslangic }, simdi);
        }, null) : null;
        if (fd && fd.tip === "DELAYED") { temel.durum = "gecikti"; temel.kaynak = "feed"; }
        return temel;
      }
    }
    return null;
  }
  // Poll kararı: önce mevcut canlı tanımı, yoksa (yalnızca poll için) uzatılmış pencere
  function pollOturumu(simdi) { return canliSeans(simdi) || uzatilmis(simdi); }

  // RaceFeed.poll bağlamı (mevcut feedCtx ile aynı biçim): pencere, oturumun başlangıcına göre
  function ctx(c) {
    c = c || pollOturumu(); if (!c) { return null; }
    var st = bul(function () { return typeof sezonPilotlar !== "undefined" ? sezonPilotlar : []; }, []);
    var r = { raceKey: c.raceKey, raceStart: new Date(c.bas), oturum: c.oturum,
             pilotlar: st.map(function (k) { return { family: k.Driver.familyName, given: k.Driver.givenName, code: k.Driver.code }; }) };
    if (c.oturum && !yarisTipi(c.oturum) && kok.RaceFeed && RaceFeed.seansPencere) {     // antrenman/sıralama: seansa özel dar pencere
      var p = RaceFeed.seansPencere(new Date(c.bas), new Date(c.bit), new Date(), 0);
      r.pencereBas = p.bas; r.pencereBit = p.bit;
    }
    return r;
  }

  // Canlı oturumda poll izni: en az 30 sn arayla, tarayıcı sekmesi gizli değilken
  function izin() {
    var n = Date.now();
    if (bul(function () { return document.visibilityState === "hidden"; }, false)) { return false; }
    if (n - S.son < minMs()) { return false; }
    S.son = n; return true;
  }

  // feedPoll() her bitişinde çağırır: durum kaydı + olay yayını (Race Feed UI zaten kendi çizer; ticker bu olayı dinler)
  function bildir(sonuc) {
    var st = sonuc && sonuc.stats ? sonuc.stats : null;
    S.hata = !!(st && st.hatalar && st.hatalar.length && !st.fetched);      // hiçbir kaynak yanıt vermediyse
    S.sonZaman = Date.now();
    bul(function () { document.dispatchEvent(new CustomEvent("f1-feed-guncel", { detail: { hata: S.hata, eklenen: st ? st.eventsAdded : 0 } })); });
  }

  function takvimIste() {
    if (S.takvimIstendi || takvim().length) { return; }
    var HV = kok.HaftaVeri; if (!HV || !HV.takvimYukle) { return; }
    S.takvimIstendi = true;
    HV.takvimYukle(new Date().getFullYear()).then(function (t) { S.takvimYedek = t.yarislar; degerlendir(); }, function () { /* sessiz: bir sonraki açılışta */ });
  }

  function degerlendir() {
    if (bul(function () { return document.visibilityState === "hidden"; }, false)) { return; }
    var c = pollOturumu();
    if (!c) { S.sonAnahtar = null; S.sezonBekle = 0; takvimIste(); return; }
    if (S.sonAnahtar !== c.raceKey) { S.sonAnahtar = c.raceKey; S.hata = false; S.sezonBekle = 0; }       // oturum değişti
    var pil = bul(function () { return typeof sezonPilotlar !== "undefined" ? sezonPilotlar.length : 0; }, 0);
    if (!pil && S.sezonBekle < 6) {                                                                          // çeviri için pilot adları: uygulamanın kendi yüklemesi, bir kez
      S.sezonBekle++;
      bul(function () { if (!sezonYuklendi) { sezonYuklendi = true; sezonuYukle(); } });
      return;
    }
    if (Date.now() - S.son < minMs()) { return; }
    bul(function () { feedPoll(); });
  }

  function baslat() {
    if (S.zaman) { return; }
    S.zaman = setInterval(degerlendir, TIK_MS);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState !== "hidden") { degerlendir(); } });
    setTimeout(degerlendir, 1500);
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", baslat); } else { baslat(); }

  kok.FeedCanli = { canli: canli, canliSeans: canliSeans, tickerOturum: tickerOturum, uzatilmis: uzatilmis, pollOturumu: pollOturumu, ctx: ctx, izin: izin, bildir: bildir, degerlendir: degerlendir, durum: function () { return { hata: S.hata, sonZaman: S.sonZaman, son: S.son }; }, _durum: S };
})(typeof window !== "undefined" ? window : null);
