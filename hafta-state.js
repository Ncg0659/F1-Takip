/* Yarış Haftası: CANLI SEANS DURUMU (state) katmanı — SAF HESAP. DOM yok, fetch yok, timer yok, depolama yazımı yok.
   Sonuç motoruna (hafta-veri.js: haftaYukle/kaynakYukle/bekleBaslat, openf1-veri.js) DOKUNMAZ; yalnızca "kartta hangi durum gösterilsin?" sorusunu yanıtlar.
   Sonuç yükleme/yeniden deneme mantığı eskisi gibi çalışmaya devam eder (seans planlı bitişinden sonra OpenF1 dakikada bir sorulur).

   Durumlar: UPCOMING · DELAYED · LIVE · RED_FLAG · SESSION_STOPPED · RESUMED · RESULT_PENDING · COMPLETED
   Öncelik:  GERÇEK FEED (Race Feed deposundaki olaylar; yalnızca Sprint/Race) > FAZ BİLGİSİ (SQ1-3 / Q1-3, saat tabanlı plan) > SAAT TABANLI TAHMİN
   Fazlar:   Sprint Sıralaması SQ1/SQ2/SQ3, Sıralama Q1/Q2/Q3 (planlı süreler; gerçek faz verisi ücretsiz kaynaklardan gelmez → "tahmini" etiketi korunur)
   Kural:    Seans gerçekten bitmediyse RESULT_PENDING'e geçilmez. Planlı bitiş geçse bile (kırmızı bayrak/gecikme olabilir) kısa bir "uzamış olabilir" payı tanınır. */
(function (kok) {
  "use strict";
  var DK = 60000;

  // Planlı faz pencereleri (seans başlangıcından dakika): [ad, başlangıç, bitiş]. Aralar: bölümler arası bekleme.
  var FAZ_PLANI = {
    SQ: [["SQ1", 0, 12], ["SQ2", 19, 29], ["SQ3", 36, 44]],
    Q:  [["Q1", 0, 18], ["Q2", 25, 40], ["Q3", 47, 59]]
  };
  var UZAMA_DK = 15;          // son fazın planlı bitişinden sonra "uzamış olabilir" payı (RESULT_PENDING'e geçmeden önce)
  var KARAR_YASI_MS = 4 * 3600 * 1000;   // kırmızı bayrak/gecikme/durdurma feed durumu, daha yeni olay yoksa bu süreden sonra geçersiz sayılır
  var POLL_UZATMA_MS = 3 * 3600 * 1000;  // feed-canli.js UZATMA_UST_MS ile aynı olmalı: bu süreden sonra Race Feed poll'u kapanır
  var DEVAM_GOSTER_MS = 10 * DK;         // "yeniden başladı" rozeti bu kadar süre görünür, sonra normal LIVE

  function turBul(anahtar) {
    if (anahtar === "SprintQualifying" || anahtar === "SprintShootout") { return "SQ"; }
    if (anahtar === "Qualifying") { return "Q"; }
    return null;
  }
  function feedKullanir(anahtar) { return anahtar === "Sprint" || anahtar === "Race"; }   // Race Feed yalnızca Sprint ve Race için poll edilir

  // ---------- Faz hesabı (saat tabanlı plan) ----------
  // dönüş: null (başlamadı / fazsız seans) | { id, tip: "aktif"|"ara"|"bitti", sonraki, sira }
  function fazHesapla(tur, basMs, simdi) {
    var plan = FAZ_PLANI[tur]; if (!plan) { return null; }
    var dk = (simdi - basMs) / DK; if (dk < 0) { return null; }
    for (var i = 0; i < plan.length; i++) {
      var p = plan[i], sn = plan[i + 1];
      if (dk >= p[1] && dk < p[2]) { return { id: p[0], tip: "aktif", sonraki: sn ? sn[0] : null, sira: i }; }
      if (sn && dk >= p[2] && dk < sn[1]) { return { id: p[0], tip: "ara", sonraki: sn[0], sira: i }; }
    }
    var son = plan[plan.length - 1];
    return { id: son[0], tip: "bitti", sonraki: null, sira: plan.length - 1 };
  }
  function planliBitisMs(tur, basMs) { var plan = FAZ_PLANI[tur]; return plan ? basMs + plan[plan.length - 1][2] * DK : null; }

  // ---------- Feed olaylarını okuma (Race Feed deposu; yalnızca okunur) ----------
  var RE_BITTI = /\b(chequered flag|checkered flag|wins the (sprint|race|grand prix)\b(?! start| to)|takes the (sprint |race )?(win|victory)|(sprint|race) (is )?over|final classification)/i;
  var RE_BITTI_GELECEK = /\b(before|until|ahead of|approaching|towards?|heading (for|to)|about to|to|will)\s+(take |see |receive |get |wave |bring out )?(the |a )?(chequered|checkered) flag|\b(chequered|checkered) flag\s+(in|is coming|will|soon)\b/i;
  // KIRMIZI BAYRAK: metinde "red flag" geçmesi tek başına durum değildir (restart/geçmiş/olumsuz bağlam). Yalnızca ETKİN bildirim sayılır.
  var RE_KIRMIZI = /\bred[- ]flag(ged)?\b/i;
  var RE_KIRMIZI_OLUMSUZ = /\b(no|not a|not|without a|without|isn'?t a|wasn'?t a|avoid\w*|rule[sd]? out)\s+(a |the )?red[- ]flag/i;
  var RE_KIRMIZI_GECMIS = /\b(before|since|after|following|during|under|prior to|ahead of|until|despite|because of|due to|post|pre)[- ](the |a |that |this |last |previous |earlier )?red[- ]flag/i;
  var RE_KIRMIZI_AKTIF = /^\W*red[- ]flag(ged)?\b|\bred[- ]flags?\b[^.!?]{0,12}\b(is out|are out|out|shown|waved|deployed|thrown|called|has been (shown|thrown|called|waved)|has come out)\b|\b(shows?|showed|shown|throws?|thrown|calls?|called|waves?|waved|brings? out|brought out|displays?)\s+(a |the )?red[- ]flag|\bred[- ]flagged\b/i;
  var RE_KIRMIZI_BUYUK = /\bRED FLAG\b/;
  function kirmiziMi(t) {
    if (RE_KIRMIZI_OLUMSUZ.test(t)) { return false; }
    var akt = RE_KIRMIZI_AKTIF.test(t) || RE_KIRMIZI_BUYUK.test(t);
    if (RE_KIRMIZI_GECMIS.test(t) && !akt) { return false; }     // "after the red flag…", "since the red flag restart…" = geçmiş referansı
    if (akt) { return true; }
    return RE_KIRMIZI.test(t) && t.length <= 80;                  // uzun yorum cümlesinde çıplak "red flag" durum bildirimi sayılmaz
  }
  var RE_DURDU = /\b(session|race|sprint|qualifying)\b(?: has been| is| was| is being)?\s+(stopped|suspended|halted|interrupted)\b|\b(race control|officials|stewards|they)\s+(have |has )?(stopped|suspended|halted)\s+the\s+(session|race|sprint)\b|^\W*(stopped|suspended)\W*$/i;
  // Restart ÖNCESİ ifadeler ("restart in 2 minutes", "restart procedure", "cars lining up") yeniden başlama gerçekleşti demek DEĞİLDİR
  var RE_ONCE = /\b(restart\w*|resum\w*|start\w*|lights out|green flag)\b[^.!?]{0,25}\b(in|within)\s+(about |around |roughly )?\d+\s*(min\w*|sec\w*|lap\w*)|\b(restart|resumption)\s+(procedure|sequence|preparations?|is imminent|imminent|soon|shortly)\b|\b(about to|preparing to|getting ready to|set to|ready to)\s+(restart|resume|start)\b|\bwill (soon|shortly) (restart|resume)\b|\b(line[sd]? up|lining up|queue\w*|heading (out )?to the grid)\b/i;
  var RE_GELECEK_DEVAM = /\b(will|to|expected to|should|set to|scheduled to|aims? to|hopes? to|plans? to|could|may)\b[^.]{0,30}\b(resum\w*|restart\w*|re-?start\w*|get under way|go green|begin)\b/i;
  var RE_DEVAM = /\b(resum(ed|es|ing)|restart(ed|s)?|green flag|back (under ?way|to green|racing)|racing (is )?(back|resum\w*)|under ?way again|(race|sprint|session) (is )?(now )?(live|under ?way)|lights out)\b/i;
  var RE_PLAN_ZAMAN = /\b(resum\w*|restart\w*|start|lights out)\b[^.]{0,15}\b(at|in|for|by|not before|no earlier than)\s*\d{1,2}[:.]\d{2}\b/i;   // "restart at 17:30" = plan, gerçekleşme değil
  var RE_BASLANGIC = /\b(start procedure|formation lap|pit[- ]?lane (is )?open(ed)?|cars (are )?(leaving|heading|going|out of) (the pits?|the pit ?lane|to the grid)|(grid|cars) (is |are )?(forming|formed|on the grid))\b/i;
  // GECİKME: yalnızca BAŞLANGICA bağlı ifadeler ("delayed start", "isn't starting for at least 15 minutes"); "Hamilton delayed his pit stop" gecikme değildir
  var RE_GECIKME_START = /\b(start|session|race|sprint|lights out|formation lap|green flag)\b[^.!?]{0,30}\b(delay\w*|postpone\w*|push\w* back)\b|\b(delay\w*|postpone\w*)\b[^.!?]{0,15}\b(start|session|race|sprint|lights out|formation lap)\b/i;
  var RE_GECIKME_DEGIL = /\b(isn'?t|aren'?t|won'?t|will not|is not|not)\s+(be\s+)?(start(ing)?|begin(ning)?|get(ting)? under ?way|going to (start|begin)|happening)\b|\bno earlier than\b|\bnot before\b/i;
  var RE_ENAZ_SERBEST = /\bat least \d+\s*(?:more\s+)?(min|minutes)\b/i;
  function gecikmeMi(t, durum) {
    return RE_GECIKME_START.test(t) || RE_GECIKME_DEGIL.test(t) || (durum === "DELAYED" && RE_ENAZ_SERBEST.test(t));
  }
  var RE_GECIKME = RE_GECIKME_START;      // devam kararında "bu bir gecikme/plan metni mi?" kontrolü için
  var RE_SC = /\b(safety car)\b/i;
  var RE_SC_BITTI = /\b(safety car (is )?(in|coming in|ending|to come in)|safety car in this lap|restart|green flag|back to green|racing (is )?(back|resum\w*))\b/i;
  var RE_VSC = /\b(virtual safety car|vsc)\b/i;
  var RE_VSC_BITTI = /\b(vsc (ending|over|is over|ends)|vsc ends|back to green|green flag)\b/i;
  var RE_KONTROL = /\b(inspect\w*|medical car|aquaplan\w*|standing water|track (check|review|conditions?)|rain\w*|downpour|wet|conditions)\b/i;
  var RE_SAAT = /\b(?:at|by|around|for|until|before)\s*(\d{1,2})[:.](\d{2})\b/i;
  var RE_ENAZ = /\bat least (\d+)\s*(?:more\s+)?(?:min|minutes)\b/i;

  function metin(o) { return String((o && (o.originalText || o.textTr)) || ""); }
  function zamanMs(o) { var t = Date.parse(o && o.timestamp); return isFinite(t) ? t : null; }

  function nedenTr(t) {
    var n = [];
    if (/\b(rain\w*|downpour|wet)\b/i.test(t)) { n.push("yoğun yağmur"); }
    if (/\baquaplan\w*|standing water\b/i.test(t)) { n.push("su birikintisi (aquaplaning)"); }
    if (/\binspect\w*|track check\b/i.test(t)) { n.push("pist kontrolü"); }
    if (/\bmedical car\b/i.test(t)) { n.push("medical car pist turu"); }
    return n;
  }

  // olaylar: Race Feed deposundaki olay dizisi (sırası önemsiz). Dönüş: { tip, ts, gercekBas, sonKontrol, enAz, neden[], chip } ya da null
  function feedDurumu(olaylar, seans, simdi) {
    if (!feedKullanir(seans.anahtar) || !olaylar || !olaylar.length) { return null; }
    var bas = seans.baslangic.getTime();
    var alt = Math.min(bas, seans.planliBaslangic ? seans.planliBaslangic.getTime() : bas) - 90 * DK;   // yeni saat kesinse planlı saatten beri gelen notlar da okunur
    var liste = olaylar.map(function (o) { return { o: o, t: zamanMs(o) }; })
      .filter(function (x) { return x.t != null && x.t <= simdi && x.t >= alt; })
      .sort(function (a, b) { return a.t - b.t; });
    if (!liste.length) { return null; }
    var durum = null, ts = null, gercekBas = null, sonKontrol = null, enAz = null, neden = [], chip = null, chipTs = null, bitti = false, bittiTs = null, havaGecmis = [];
    liste.forEach(function (x) {
      if (durum === "ENDED") { return; }      // seans bitti: sonraki yorumlar (restart/red flag geçmiş referansları dahil) durumu değiştirmez
      var t = metin(x.o), kirmizi = kirmiziMi(t), gelecekDevam = RE_GELECEK_DEVAM.test(t);
      var devam = RE_DEVAM.test(t) && !gelecekDevam && !RE_GECIKME.test(t) && !RE_PLAN_ZAMAN.test(t) && !RE_ONCE.test(t);
      // 1) Seans bitti (kesin işaretler)
      if (RE_BITTI.test(t) && !RE_BITTI_GELECEK.test(t) && x.t > bas + 10 * DK) { bitti = true; bittiTs = x.t; durum = "ENDED"; ts = x.t; chip = null; return; }
      // 2) Devam / başlangıç
      if (devam) {
        var onceki = durum;
        if (onceki === "RED_FLAG" || onceki === "SESSION_STOPPED") { durum = "RESUMED"; }
        else { durum = "LIVE"; if (onceki === "DELAYED" || onceki === null) { gercekBas = x.t; } }
        ts = x.t; sonKontrol = null; enAz = null; neden = []; bitti = false; chip = null; return;
      }
      if (RE_BASLANGIC.test(t) && (durum === "DELAYED" || durum === null || durum === "LIVE")) {
        if (durum === "DELAYED" || durum === null) { gercekBas = gercekBas || x.t; }
        durum = "LIVE"; ts = x.t; sonKontrol = null; enAz = null; neden = []; return;
      }
      // Hava/pist notları: yalnızca gecikme/durdurma ile birlikte "neden" olur (son 60 dk'daki notlar hatırlanır)
      if (RE_KONTROL.test(t)) { havaGecmis.push({ t: x.t, n: nedenTr(t) }); }
      // 3) Durduran olaylar
      if (kirmizi && !gelecekDevam) { durum = "RED_FLAG"; ts = x.t; chip = null; }
      else if (kirmizi && gelecekDevam && durum !== "RED_FLAG" && durum !== "SESSION_STOPPED") { durum = "RED_FLAG"; ts = x.t; chip = null; }
      else if (RE_DURDU.test(t) && durum !== "RED_FLAG") { durum = "SESSION_STOPPED"; ts = x.t; chip = null; }
      else if (gecikmeMi(t, durum) && (durum === null || durum === "DELAYED" || durum === "UPCOMING")) { durum = "DELAYED"; ts = x.t; }
      // 4) Gecikme/durdurma sırasında ikincil bilgi (pist kontrol saati, en az süre, neden)
      if (durum === "DELAYED" || durum === "RED_FLAG" || durum === "SESSION_STOPPED") {
        havaGecmis.forEach(function (h) { if (x.t - h.t <= 60 * DK) { h.n.forEach(function (n) { if (neden.indexOf(n) < 0) { neden.push(n); } }); } });
        var sa = RE_SAAT.exec(t);
        if (sa && /\b(inspect\w*|update|review|decision|resume|restart|start|next)\b/i.test(t)) { sonKontrol = ("0" + sa[1]).slice(-2) + ":" + sa[2]; }
        var ea = RE_ENAZ.exec(t); if (ea) { enAz = parseInt(ea[1], 10); }
        if (RE_KONTROL.test(t)) { nedenTr(t).forEach(function (n) { if (neden.indexOf(n) < 0) { neden.push(n); } }); }
      }
      // 5) Safety car / VSC (LIVE sırasında ikincil rozet)
      if (RE_VSC.test(t) && !RE_VSC_BITTI.test(t)) { chip = "VSC"; chipTs = x.t; }
      else if (RE_SC.test(t) && !RE_SC_BITTI.test(t) && !kirmizi) { chip = "SAFETY CAR"; chipTs = x.t; }
      else if (chip && (RE_SC_BITTI.test(t) || RE_VSC_BITTI.test(t))) { chip = null; }
    });
    if (durum && (durum === "DELAYED" || durum === "RED_FLAG" || durum === "SESSION_STOPPED") && ts != null && simdi - ts > KARAR_YASI_MS) { return null; }   // eski/bayat durum: normal akışa dön
    if (!durum && !chip) { return null; }
    if (durum === "RESUMED" && ts != null && simdi - ts > DEVAM_GOSTER_MS) { durum = "LIVE"; }
    return { tip: durum, ts: ts, gercekBas: gercekBas, sonKontrol: sonKontrol, enAz: enAz, neden: neden, chip: chip, bitti: bitti, bittiTs: bittiTs };
  }

  // ---------- Ana hesap ----------
  // g: { seans: {anahtar, baslangic:Date, bitis:Date}, simdi:ms, sonucVar:bool, eski:legacy durum ("yaklasan"|"canli"|"sonuc-bekleniyor"|"bitti"|"tamamlandi"), olaylar:[...] }
  // dönüş: { durum, kaynak: "sonuc"|"feed"|"faz"|"saat", faz, tahmini, uzamis, ozet, satirlar[], chip, sonKontrol, enAz }
  function programKarti(durum, ozet, prog) {
    return { durum: durum, kaynak: "program", faz: null, tahmini: false, uzamis: false, ozet: ozet, satirlar: [], chip: null, sonKontrol: null, enAz: null, program: prog };
  }
  function durum(g) {
    // ÖNCELİK: doğrulanmış program değişikliği (hafta-baglam.js `program`) > Race Feed durumu > faz tahmini > saat tahmini. Sonuç verisi her zaman kazanır (COMPLETED).
    var prog = g.program && g.program.tip && g.program.tip !== "SCHEDULED" ? g.program : null;
    if (prog && !(g.sonucVar || g.eski === "tamamlandi")) {
      if (prog.tip === "CANCELLED") { return programKarti("CANCELLED", "Seans iptal edildi.", prog); }
      if (prog.tip === "POSTPONED") { return programKarti("POSTPONED", "Ertelendi. Yeni başlangıç saati bekleniyor.", prog); }
      if (prog.tip === "DELAYED") { return programKarti("DELAYED", "Başlangıç gecikti. Yeni başlangıç saati bekleniyor.", prog); }
      if (prog.tip === "NEW_TIME_CONFIRMED" && prog.yeniBaslangic != null) {
        // Yeni saat kesin: tüm hesap (UPCOMING / faz / feed / saat) YENİ saate göre yapılır; planlı eski saat artık hiçbir durumu tetiklemez
        var s0 = g.seans, sim0 = g.simdi == null ? Date.now() : g.simdi, sure0 = s0.bitis.getTime() - s0.baslangic.getTime();
        var yb = prog.yeniBaslangic, ybit = prog.yeniBitis != null ? prog.yeniBitis : yb + sure0;
        var seans2 = { anahtar: s0.anahtar, baslangic: new Date(yb), bitis: new Date(ybit), planliBaslangic: s0.baslangic };
        var r = durum({ seans: seans2, simdi: sim0, sonucVar: false, eski: sim0 < yb ? "yaklasan" : (sim0 < ybit ? "canli" : "sonuc-bekleniyor"), olaylar: g.olaylar });
        if (r.durum === "DELAYED" && r.kaynak === "feed" && sim0 < yb) { r = { durum: "UPCOMING", kaynak: "saat", faz: null, tahmini: false, uzamis: false, ozet: "", satirlar: [], chip: r.chip || null, sonKontrol: null, enAz: null }; }
        r.efektif = { baslangic: seans2.baslangic, bitis: seans2.bitis }; r.program = prog;
        if (r.durum === "UPCOMING") { r.yeniSaat = true; r.kaynak = "program"; r.ozet = "Yeni başlangıç saati açıklandı."; }
        return r;
      }
    }
    var s = g.seans, simdi = g.simdi == null ? Date.now() : g.simdi, bas = s.baslangic.getTime(), bit = s.bitis.getTime();
    var tur = turBul(s.anahtar), sureMs = bit - bas;
    var cikti = { durum: null, kaynak: "saat", faz: null, tahmini: true, uzamis: false, ozet: "", satirlar: [], chip: null, sonKontrol: null, enAz: null };

    // Legacy "bitti" (sonuç kaynağı yok / bekleme süresi doldu) ve "tamamlandi" olduğu gibi kalır
    if (g.eski === "bitti") { cikti.durum = "COMPLETED"; cikti.kaynak = "saat"; cikti.tahmini = false; cikti.legacyBitti = true; return cikti; }

    // COMPLETED: sonuç verisi var (SQ/Q için son faz planlı bitişine yakın olmadan kabul edilmez: kısmi/erken veri seansı bitirmez)
    if (g.sonucVar || g.eski === "tamamlandi") {
      var pb = tur ? planliBitisMs(tur, bas) : null;
      if (!(pb != null && simdi < pb - 2 * DK)) { cikti.durum = "COMPLETED"; cikti.kaynak = "sonuc"; cikti.tahmini = false; return cikti; }
    }

    var fd = feedDurumu(g.olaylar, s, simdi);
    if (fd && fd.chip) { cikti.chip = fd.chip; }

    // ---- Başlamadan önce ----
    if (simdi < bas) {
      if (fd && fd.tip === "DELAYED") { return delayedKart(cikti, fd, simdi, bit); }
      cikti.durum = "UPCOMING"; cikti.kaynak = "saat"; cikti.tahmini = false; return cikti;
    }

    // ---- 1) Gerçek feed ----
    if (fd && fd.tip) {
      cikti.kaynak = "feed"; cikti.tahmini = false; cikti.sonKontrol = fd.sonKontrol; cikti.enAz = fd.enAz;
      if (fd.tip === "DELAYED") { return delayedKart(cikti, fd, simdi, bit); }
      if (fd.tip === "RED_FLAG") { cikti.durum = "RED_FLAG"; cikti.ozet = "Kırmızı bayrak: seans durduruldu. Yeniden başlama bekleniyor."; return ekSatirlar(cikti, fd, simdi, bit); }
      if (fd.tip === "SESSION_STOPPED") { cikti.durum = "SESSION_STOPPED"; cikti.ozet = "Seans durduruldu. Yeniden başlama bekleniyor."; return ekSatirlar(cikti, fd, simdi, bit); }
      if (fd.tip === "RESUMED") { cikti.durum = "RESUMED"; cikti.ozet = "Seans yeniden başladı."; return ekSatirlar(cikti, fd, simdi, bit); }
      if (fd.tip === "ENDED") { cikti.durum = "RESULT_PENDING"; return cikti; }
      if (fd.tip === "LIVE") {
        // gerçek başlangıç biliniyorsa planlı bitiş ona göre kayar; yine de süre dolduysa sonuç beklenir
        var efBit = fd.gercekBas != null ? Math.max(bit, fd.gercekBas + sureMs) : bit;
        if (simdi > efBit + UZAMA_DK * DK) { cikti.durum = "RESULT_PENDING"; cikti.kaynak = "saat"; cikti.tahmini = true; return cikti; }
        cikti.durum = "LIVE"; cikti.ozet = "Seans sürüyor (Race Feed'e göre)."; return ekSatirlar(cikti, fd, simdi, bit);
      }
    }

    // ---- 2) Faz bilgisi (SQ/Q) ----
    if (tur) {
      var f = fazHesapla(tur, bas, simdi), son = planliBitisMs(tur, bas);
      if (f && simdi < son) {
        // GERÇEK faz verisi yok (ücretsiz kaynaklarda SQ/Q canlı faz bilgisi gelmez): bu yalnızca planlı saate göre TAHMİNDİR, kesin iddia değildir
        cikti.durum = "LIVE"; cikti.kaynak = "faz"; cikti.faz = Object.assign({}, f, { tahmini: true, kaynak: "plan" }); cikti.fazTahmini = true;
        cikti.ozet = f.tip === "aktif" ? f.id + " planlı saate göre sürüyor olmalı (tahmini)."
                                       : f.id + " planlı saate göre bitmiş olmalı · " + f.sonraki + " bekleniyor (tahmini).";
        return cikti;
      }
      if (simdi < son + UZAMA_DK * DK) {
        cikti.durum = "LIVE"; cikti.kaynak = "faz"; cikti.faz = f ? Object.assign({}, f, { tahmini: true, kaynak: "plan" }) : f; cikti.fazTahmini = true; cikti.uzamis = true;
        cikti.ozet = "Planlı bitiş geçti; seans uzamış olabilir (gecikme/kırmızı bayrak). Sonuç gelince otomatik güncellenir.";
        return cikti;
      }
      cikti.durum = "RESULT_PENDING"; cikti.faz = null; return cikti;      // sonuç beklenirken faz iddiası yok
    }

    // ---- 3) Saat tabanlı tahmin (FP, Sprint, Race; feed yok) ----
    if (simdi < bit) { cikti.durum = "LIVE"; cikti.kaynak = "saat"; cikti.ozet = "Seans saat hesabına göre sürüyor olmalı."; return cikti; }
    cikti.durum = "RESULT_PENDING"; return cikti;
  }

  function delayedKart(c, fd, simdi, bit) {
    c.durum = "DELAYED"; c.kaynak = "feed"; c.tahmini = false; c.sonKontrol = fd.sonKontrol; c.enAz = fd.enAz;
    c.ozet = "Başlangıç gecikti. Yeni başlangıç saati bekleniyor.";
    return ekSatirlar(c, fd, simdi, bit);
  }
  function saatTr(ms) {
    try { return new Date(ms).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Istanbul" }); } catch (e) { return ""; }
  }
  function ekSatirlar(c, fd, simdi, bit) {
    if (fd.sonKontrol) { c.satirlar.push("Bir sonraki pist kontrolü: " + fd.sonKontrol + " local"); }
    if (fd.enAz) { c.satirlar.push("Start en az " + fd.enAz + " dk daha olmayacak."); }
    var durdu = c.durum === "DELAYED" || c.durum === "RED_FLAG" || c.durum === "SESSION_STOPPED";
    if (fd.neden && fd.neden.length && durdu) { c.satirlar.push("Neden: " + fd.neden.join(", ") + "."); }
    if (durdu && fd.ts != null) {
      c.satirlar.push("Son Race Feed notu: " + saatTr(fd.ts) + " TR");
      // Doğrulanmış gecikme/durdurma sürerken poll, planlı bitişten +3 saate kadar sürer (feed-canli.js uzatılmış pencere). Bu sınır da aşıldıysa poll kapanmıştır → bilgi bayat olabilir
      if (simdi != null && bit != null && simdi > bit + POLL_UZATMA_MS && simdi - fd.ts > 30 * DK) { c.satirlar.push("Race Feed güncellemesi alınamıyor olabilir; sonuç gelince durum otomatik güncellenir."); }
    }
    return c;
  }

  // Kartın eski ("yaklasan"|"canli"|"sonuc-bekleniyor"|"bitti"|"tamamlandi") görsel/dal anahtarına çeviri
  function eskiAnahtar(st) {
    switch (st.durum) {
      case "UPCOMING": return "yaklasan";
      case "COMPLETED": return st.legacyBitti ? "bitti" : "tamamlandi";
      case "RESULT_PENDING": return "sonuc-bekleniyor";
      case "POSTPONED": case "CANCELLED": return "yaklasan";
      default: return "canli";     // DELAYED, LIVE, RED_FLAG, SESSION_STOPPED, RESUMED
    }
  }

  // OpenF1/sonuç bekleme mesajı ayrımı (yalnızca seans bittikten sonra anlamlıdır)
  // A) seans sürüyor → "" · B) bitti, sonuç henüz yok → bekleme · C) gerçek ağ/5xx/429/JSON hatası → ulaşılamıyor · D) sonuç → ""
  function sonucMesaji(st, ofDurum, eski) {
    if (st.durum !== "RESULT_PENDING") { return ""; }
    if (ofDurum === "hata") { return eski ? "OpenF1'e ulaşılamadı. “Yenile” ile tekrar deneyebilirsiniz." : "OpenF1'e şu anda ulaşılamıyor. Tekrar denenecek."; }
    return eski ? "Sonuç henüz yayımlanmadı. “Yenile” ile tekrar deneyebilirsiniz." : "Sonuç henüz yayımlanmadı. Otomatik olarak tekrar kontrol ediliyor.";
  }

  var API = { durum: durum, feedDurumu: feedDurumu, fazHesapla: fazHesapla, eskiAnahtar: eskiAnahtar, sonucMesaji: sonucMesaji, turBul: turBul,
              FAZ_PLANI: FAZ_PLANI, UZAMA_DK: UZAMA_DK };
  if (kok) { kok.HaftaState = API; }
  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
})(typeof window !== "undefined" ? window : null);
