/* YARIŞI KAÇIRDIYSAN v2 — SAF HESAP KATMANI (DOM/ağ/depolama YOK; Node'da test edilir).
   A6'nın (yaris-ozet-hesap.js) sonuç özetini DEĞİŞTİRMEZ; üzerine, OpenF1 historical katmanlarından gelen HAZIR verilerle kısa, deterministik, ölçülebilir özet ekler.
   Kaynaklar (yalnızca mevcut hesap katmanları): RaceControl (olaylar/ozet), LapsHesap, OvertakesHesap, PitHesap, SeansHavaHesap.
   Veri yoksa ilgili madde hiç üretilmez (placeholder yok). Nedensel/yorum dili YOK: yalnızca "N kayıt", süre, sayı. "Geçiş" yerine "geçiş kaydı".
   Girdi: { rc, laps, ovt, pit, hava } — her biri ilgili Veri.yukle()/oku() sonucu ({durum:"ok", ...}) ya da null.
   Çıktı: { var, hizliTur, kartlar:[{anahtar, etiket, satirlar:[string], not?}], detay:{olaylar, gecis, pit, hava, tur} }  (hepsi düz metin/sayı; arayüz kaçışlar) */
(function (kok) {
  "use strict";
  function K(ad, dosya) { return kok && kok[ad] ? kok[ad] : (typeof require !== "undefined" ? require(dosya) : null); }
  var RC = K("RaceControl", "./race-control.js"), LH = K("LapsHesap", "./laps-veri.js"), OH = K("OvertakesHesap", "./overtakes-veri.js"),
      PH = K("PitHesap", "./pit-veri.js"), HH = K("SeansHavaHesap", "./seans-hava-veri.js");
  var KRITIK_TIPLER = { RED_FLAG: 1, SESSION_RESUMED: 1, SAFETY_CAR: 1, VSC: 1, PENALTY: 1, CHEQUERED: 1, RESTART: 1 };
  var MAKS_OLAY = 12;

  function ok(x) { return !!(x && x.durum === "ok"); }
  // driver_number → kod: laps/ovt/pit isimler + Race Control olay sürücüleri (kod mesajdan). Bilinmeyen: "#no"
  function isimHaritasi(g) {
    var m = {};
    [g.laps, g.ovt, g.pit].forEach(function (k) { if (ok(k) && k.isimler) { Object.keys(k.isimler).forEach(function (n) { if (k.isimler[n] && k.isimler[n].kod && !m[n]) { m[n] = k.isimler[n].kod; } }); } });
    if (ok(g.rc)) { (g.rc.olaylar || []).forEach(function (e) { (e.drivers || []).forEach(function (d) { if (d.kod && !m[d.no]) { m[d.no] = d.kod; } }); }); }
    return m;
  }
  function kod(m, no) { return no == null ? "?" : (m[no] || "#" + no); }
  function sayiMetin(n, ek) { return n + " " + ek; }

  // ---- AKIŞ (Race Control) ----
  function akis(rc) {
    if (!ok(rc) || !rc.ozet) { return null; }
    var o = rc.ozet, p = [];
    if (o.kirmiziBayrak) { p.push(sayiMetin(o.kirmiziBayrak, "kırmızı bayrak kaydı")); }
    if (o.safetyCar) { p.push(sayiMetin(o.safetyCar, "Safety Car kaydı")); }
    if (o.vsc) { p.push(sayiMetin(o.vsc, "VSC kaydı")); }
    var yb = (o.yenidenBaslama || 0) + (o.restart || 0);
    if (yb) { p.push(sayiMetin(yb, "yeniden başlama kaydı")); }
    if (o.ceza) { p.push(sayiMetin(o.ceza, "ceza kaydı")); }
    if (o.sariBayrak) { p.push(sayiMetin(o.sariBayrak, "sarı bayrak kaydı")); }
    var satirlar = p.length ? [p.join(" · ")] : ["Kırmızı bayrak, Safety Car veya VSC kaydı yok"];
    if (!o.listelenen && !o.toplam) { return null; }
    return { anahtar: "akis", etiket: "Yarışın akışı", satirlar: satirlar };
  }
  function olaylar(rc) {
    if (!ok(rc)) { return null; }
    var l = RC.listelenen(rc.olaylar).filter(function (e) { return KRITIK_TIPLER[e.normalizedType]; });
    var satirlar = l.slice(0, MAKS_OLAY).map(function (e) { var s = RC.satir(e, { seansAd: "Yarış" }); return { saat: s.saat, ikon: s.ikon, baslik: s.baslik, metin: s.metin }; });
    return { satirlar: satirlar, fazla: Math.max(0, l.length - MAKS_OLAY), sari: rc.ozet ? rc.ozet.sariBayrak || 0 : 0 };
  }

  // ---- POZİSYON HAREKETİ (Overtakes) ----
  function hareket(ovt, m) {
    if (!ok(ovt) || !ovt.gecisler || !ovt.gecisler.length) { return null; }
    var P = OH.pilotSayilari(ovt.gecisler).filter(function (x) { return x.yapilan > 0; });
    var satirlar = ["Toplam " + ovt.gecisler.length + " geçiş kaydı"].concat(P.slice(0, 2).map(function (x) { return kod(m, x.driverNumber) + " için " + x.yapilan + " geçiş kaydı"; }));
    return { anahtar: "hareket", etiket: "Pozisyon hareketi", satirlar: satirlar, not: "OpenF1 kayıtları pit/ceza kaynaklı sıra değişimlerini de içerebilir." };
  }
  function gecisDetay(ovt, m) {
    if (!ok(ovt) || !ovt.gecisler || !ovt.gecisler.length) { return null; }
    var P = OH.pilotSayilari(ovt.gecisler);
    return { toplam: ovt.gecisler.length,
             pilotlar: P.filter(function (x) { return x.yapilan > 0; }).slice(0, 5).map(function (x) { return { kod: kod(m, x.driverNumber), yapilan: x.yapilan, yapilanGecis: x.yapilanGecis }; }),
             son: ovt.gecisler.slice(-3).map(function (e) { return { ms: e.ms, metin: kod(m, e.overtakingDriverNumber) + " → " + kod(m, e.overtakenDriverNumber), pozisyon: e.position }; }) };
  }

  // ---- PİT ----
  function pitKart(pit, m) {
    if (!ok(pit) || !pit.kayitlar || !pit.kayitlar.length) { return null; }
    var P = PH.pilotOzetleri(pit.kayitlar), ek = PH.enKisaStoplar(pit.kayitlar, 1), en = P[0];
    var satirlar = [pit.kayitlar.length + " pit kaydı"];
    if (en) { var esit = P.filter(function (x) { return x.toplamPit === en.toplamPit; }); satirlar[0] += " · En çok: " + esit.slice(0, 2).map(function (x) { return kod(m, x.driverNumber); }).join(", ") + (esit.length > 2 ? " +" + (esit.length - 2) : "") + " (" + en.toplamPit + ")"; }
    if (ek.length) { satirlar.push("En kısa kayıtlı stop: " + kod(m, ek[0].driverNumber) + " " + PH.stopYaz(ek[0].stopDuration)); }
    return { anahtar: "pit", etiket: "Pit", satirlar: satirlar };
  }
  function pitDetay(pit, m) {
    if (!ok(pit) || !pit.kayitlar || !pit.kayitlar.length) { return null; }
    var P = PH.pilotOzetleri(pit.kayitlar), lane = null, stopYok = 0;
    pit.kayitlar.forEach(function (e) { if (e.laneDuration != null && (!lane || e.laneDuration > lane.laneDuration)) { lane = e; } if (e.stopDuration == null) { stopYok++; } });
    return { toplam: pit.kayitlar.length, pilotlar: P.map(function (x) { return kod(m, x.driverNumber) + " " + x.toplamPit; }),
             enKisa: PH.enKisaStoplar(pit.kayitlar, 3).map(function (x) { return { kod: kod(m, x.driverNumber), stop: PH.stopYaz(x.stopDuration) }; }),
             enUzunLane: lane ? { kod: kod(m, lane.driverNumber), lane: PH.laneYaz(lane.laneDuration), tur: lane.lapNumber } : null, stopSuresiYok: stopYok };
  }

  // ---- HAVA ----
  function havaKart(hava) {
    if (!ok(hava) || !hava.ozet || !hava.ozet.veriVar) { return null; }
    var o = hava.ozet, s = [], b = o.baslangic, e = o.bitis;
    if (o.yagis && o.yagis.olcumVar) { s.push(o.yagis.goruldu ? "Seans içinde yağış kaydedildi" : "Seans içinde yağış kaydı yok"); }
    if (b && e && b.trackTemperature != null && e.trackTemperature != null) { s.push(b.ms === e.ms ? "Pist sıcaklığı " + HH.derece(b.trackTemperature) : "Pist sıcaklığı " + HH.derece(b.trackTemperature) + " → " + HH.derece(e.trackTemperature)); }
    else if (o.pist) { s.push("Pist sıcaklığı " + HH.derece(o.pist.min) + (o.pist.min === o.pist.max ? "" : " – " + HH.derece(o.pist.max))); }
    if (b && e && b.airTemperature != null && e.airTemperature != null && b.ms !== e.ms) { s.push("Hava sıcaklığı " + HH.derece(b.airTemperature) + " → " + HH.derece(e.airTemperature)); }
    if (!s.length) { return null; }
    return { anahtar: "hava", etiket: "Hava (seans içi OpenF1 ölçümleri)", satirlar: s };
  }
  function havaDetay(hava) {
    if (!ok(hava) || !hava.ozet || !hava.ozet.veriVar) { return null; }
    var o = hava.ozet;
    function olc(b) {
      if (!b) { return null; }
      var s = [];
      if (b.airTemperature != null) { s.push("Hava " + HH.derece(b.airTemperature)); }
      if (b.trackTemperature != null) { s.push("Pist " + HH.derece(b.trackTemperature)); }
      if (b.humidity != null) { s.push("Nem " + HH.yuzde(b.humidity)); }
      if (b.windSpeed != null) { s.push("Rüzgâr " + HH.ruzgar(b.windSpeed)); }
      if (b.rainfall != null) { s.push("Yağış: " + HH.yagisYaz(b.rainfall)); }
      return { ms: b.ms, metin: s.join(" · ") };
    }
    var ayni = o.baslangic && o.bitis && o.baslangic.ms === o.bitis.ms, ek = [];
    if (o.hava) { ek.push("Hava " + HH.derece(o.hava.min) + (o.hava.min === o.hava.max ? "" : " – " + HH.derece(o.hava.max))); }
    if (o.pist) { ek.push("Pist " + HH.derece(o.pist.min) + (o.pist.min === o.pist.max ? "" : " – " + HH.derece(o.pist.max))); }
    if (o.maxRuzgar != null) { ek.push("En yüksek rüzgâr " + HH.ruzgar(o.maxRuzgar)); }
    if (o.yagis && o.yagis.olcumVar) { ek.push(o.yagis.goruldu ? "Yağış kaydı: " + o.yagis.yagisliKayit + " / " + o.yagis.kayit + " ölçüm" : "Yağış kaydı yok (" + o.yagis.kayit + " ölçüm)"); }
    return { baslangic: olc(o.baslangic), bitis: ayni ? null : olc(o.bitis), boyunca: ek };
  }

  // ---- LAPS ----
  function hizli(laps, m) {
    if (!ok(laps) || !laps.turlar || !laps.turlar.length) { return null; }
    var P = LH.pilotOzetleri(laps.turlar).filter(function (x) { return x.enHizli; });
    if (!P.length) { return null; }
    var l = P[0];
    return { kod: kod(m, l.driverNumber), sure: LH.sureYaz(l.enHizli.lapDuration), tur: l.enHizli.lapNumber,
             ilk3: P.slice(0, 3).map(function (x) { return { kod: kod(m, x.driverNumber), sure: LH.sureYaz(x.enHizli.lapDuration), tur: x.enHizli.lapNumber }; }),
             sureliTur: P.reduce(function (a, x) { return a + x.sureliTur; }, 0) };
  }

  function ozet(g) {
    g = g || {};
    var m = isimHaritasi(g), kartlar = [], a = akis(g.rc), h = hareket(g.ovt, m), p = pitKart(g.pit, m), v = havaKart(g.hava), f = hizli(g.laps, m);
    if (a) { kartlar.push(a); } if (h) { kartlar.push(h); } if (p) { kartlar.push(p); } if (v) { kartlar.push(v); }
    var d = { olaylar: olaylar(g.rc), gecis: gecisDetay(g.ovt, m), pit: pitDetay(g.pit, m), hava: havaDetay(g.hava), tur: f };
    return { var: kartlar.length > 0 || !!f, hizliTur: f ? { kod: f.kod, sure: f.sure, tur: f.tur } : null, kartlar: kartlar, detay: d };
  }

  var API = { ozet: ozet, MAKS_OLAY: MAKS_OLAY };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
  if (kok) { kok.YarisOzetV2Hesap = API; }
})(typeof window !== "undefined" ? window : null);
