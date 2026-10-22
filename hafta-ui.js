/* Yarış Haftası + Sprint arayüzü. Bağımlılıklar: hafta-veri.js, tasarim.js (F1UI), seri-ayarlari.js.
   index.html yalnızca YarisHaftasi.hazirla() / ac() / durdur() çağırır. */
(function () {
  var V = window.HaftaVeri;
  var U = window.F1UI;
  var esc = U.esc;
  var ANA = V.ANA_TZ;
  var HS = window.HaftaState;
  var BU = window.BaglamUI;          // baglam-ui.js (bağlamsal bilgi kartları + program override); yoksa eski davranış aynen sürer        // hafta-state.js (saf durum hesabı); yoksa eski davranış aynen sürer
  var ALT_KEY = "f1-hafta-v1-altsekme";

  var S = { yarislar: [], tur: null, hafta: null, bekle: null, yukleniyor: false, hata: null, takvimEski: false,
            acik: {}, secSeans: null, secKul: false, feedAcik: false, feedPAcik: false, bkAcik: {}, pSek: "sonuc", qSekme: "grid", aciklaAcik: false, aktifSayfa: null, hazir: null, yukleSayac: 0 };

  function secimler() {
    return S.yarislar.map(function (y) {
      return "<option value='" + esc(y.round) + "'" + (Number(y.round) === S.tur ? " selected" : "") + ">Tur " + esc(y.round) + " · " + esc(y.raceName) + "</option>";
    }).join("");
  }

  // ---------- Küçük yardımcılar ----------
  function geriSayim(hedef) {
    var dk = Math.max(0, Math.floor((hedef.getTime() - Date.now()) / 60000));
    var g = Math.floor(dk / 1440), sa = Math.floor((dk % 1440) / 60), m = dk % 60;
    if (g > 0) { return g + " g " + sa + " sa"; }
    if (sa > 0) { return sa + " sa " + m + " dk"; }
    return Math.max(m, 1) + " dk";
  }
  // ---------- Canlı seans durumu (hafta-state.js): Race Feed deposu → faz → saat tahmini. Sonuç motoruna dokunmaz. ----------
  function feedOlaylari(h, s) {
    if (!window.RaceFeed || (s.anahtar !== "Sprint" && s.anahtar !== "Race")) { return null; }
    try { return window.RaceFeed.yukle(h.sezon + "-" + h.tur + (s.anahtar === "Sprint" ? "-sprint" : "")).olaylar || null; } catch (e) { return null; }   // yalnızca okunur: yeni fetch/timer yok
  }
  function durumBul(h, s) {
    var d0 = V.seansDurumu(s, h);
    if (!HS) { return { d: d0, st: null }; }
    var st;
    try {
      st = HS.durum({ seans: s, simdi: Date.now(), sonucVar: !!(s.sonucKaynagi && h.sonuclar[s.sonucKaynagi]), eski: d0, olaylar: feedOlaylari(h, s),
                      program: BU ? BU.program(h, s, Date.now()) : null });
    } catch (e) { return { d: d0, st: null }; }
    return { d: HS.eskiAnahtar(st), st: st };
  }
  // Yeni saat kesinse seansın EFEKTİF zamanı (kart, çizelge ve geri sayım bunu kullanır); değilse seansın kendisi
  function efektifSeans(s, st) {
    return st && st.efektif ? Object.assign({}, s, { baslangic: st.efektif.baslangic, bitis: st.efektif.bitis }) : s;
  }
  function programDurdu(st) { return !!st && (st.durum === "POSTPONED" || st.durum === "CANCELLED"); }
  function stOzet(st) {
    var h = "<span class='h-soluk'>" + esc(st.ozet) + "</span>";
    st.satirlar.forEach(function (x) { h += "<div class='h-soluk h-ikincil'>" + esc(x) + "</div>"; });
    return h;
  }
  function durumRozeti(d, st) {
    if (st) {
      var chip = st.chip ? " <span class='dr sc'>" + esc(st.chip) + "</span>" : "";
      if (st.durum === "POSTPONED") { return "<span class='dr bekle' title='Program değişikliği'>ERTELENDİ</span>"; }
      if (st.durum === "CANCELLED") { return "<span class='dr kirmizi' title='Program değişikliği'>İPTAL</span>"; }
      if (st.durum === "UPCOMING" && st.yeniSaat) { return "<span class='dr bekle' title='Program değişikliği: yeni saat açıklandı'>YENİ SAAT</span>"; }
      if (st.durum === "DELAYED") { return "<span class='dr bekle' title='Race Feed (Chris Medland) notlarına göre'>BAŞLANGIÇ GECİKTİ</span>"; }
      if (st.durum === "RED_FLAG") { return "<span class='dr kirmizi' title='Race Feed notlarına göre'>KIRMIZI BAYRAK</span>"; }
      if (st.durum === "SESSION_STOPPED") { return "<span class='dr sc' title='Race Feed notlarına göre'>SEANS DURDURULDU</span>"; }
      if (st.durum === "RESUMED") { return "<span class='dr live' title='Race Feed notlarına göre'>YENİDEN BAŞLADI</span>" + chip; }
      if (st.durum === "LIVE") {
        if (st.kaynak === "feed") { return "<span class='dr live' title='Race Feed notlarına göre'>LIVE</span>" + chip; }
        var faz = st.faz && st.faz.id ? " <span class='dr yakinda' title='Planlı saate göre tahmin; gerçek faz verisi yok'>" + esc(st.faz.id) + " <small class='tahmini'>tahmini</small></span>" : "";
        return "<span class='dr live' title='Saat/faz hesabına göre tahmini durum. Kesin canlı veri değildir.'>LIVE <small class='tahmini'>tahmini</small></span>" + faz + chip;
      }
    }
    return durumRozetiEski(d);
  }
  function durumRozetiEski(d) {
    if (d === "canli") { return "<span class='dr live' title='Saat hesabına göre tahmini durum. Kesin canlı veri değildir.'>LIVE <small class='tahmini'>tahmini</small></span>"; }
    if (d === "tamamlandi") { return "<span class='dr bitti' title='Sonuç verisi alındı.'>TAMAMLANDI</span>"; }
    if (d === "sonuc-bekleniyor") { return "<span class='dr bekle'>SONUÇ BEKLENİYOR</span>"; }
    if (d === "bitti") { return "<span class='dr bitti'>BİTTİ</span>"; }
    return "<span class='dr yakinda'>YAKLAŞIYOR</span>";
  }
  function pistBilgi(seans, hafta) {
    var p = V.pistSaati(seans.baslangic, hafta.pistTz);
    return p ? "<span class='h-pist' title='Pist yerel saati'>pist " + esc(p) + "</span>" : "";
  }
  function takim(ad) { return U.takimRozeti(ad); }

  // ---------- Sonuç tabloları ----------
  function yarisTablosu(liste, sprintMi, sinir) {
    var satirlar = (sinir ? liste.slice(0, sinir) : liste).map(function (r) {
      var puanli = r.puan > 0;
      return "<tr" + (sprintMi && puanli ? " class='h-puanli'" : "") + "><td>" + U.pozRozet(r.metin || r.sira) + "</td><td>" +
        U.pilotHucresi(r.kod, r.ad) + "</td><td>" + takim(r.takim) + "</td><td class='sayi'>" + (r.grid > 0 ? r.grid : "PIT") + "</td><td>" +
        U.farkRozeti(r.grid, r.sira) + "</td><td class='sayi'>" + esc(r.sure || r.durum) + "</td><td class='puan'>" + r.puan +
        (r.enHizli && r.enHizli.sira === 1 ? " <span class='h-fl' title='En hızlı tur'>FL</span>" : "") + "</td></tr>";
    }).join("");
    return "<div class='kap'><table><thead><tr><th>Sıra</th><th>Pilot</th><th>Takım</th><th>Start</th><th>Değişim</th><th>Süre / Durum</th><th>Puan</th></tr></thead><tbody>" +
           satirlar + "</tbody></table></div>";
  }

  function fpTablosu(liste, sinir) {
    var satirlar = (sinir ? liste.slice(0, sinir) : liste).map(function (r) {
      return "<tr><td>" + U.pozRozet(r.sira) + "</td><td>" + U.pilotHucresi(r.kod, r.ad) + "</td><td>" + takim(r.takim) + "</td><td class='sayi'>" + esc(r.sure || "-") +
        "</td><td class='sayi'>" + esc(r.fark || "") + "</td><td class='sayi'>" + (r.tur || "-") + "</td></tr>";
    }).join("");
    return "<div class='kap'><table><thead><tr><th>Sıra</th><th>Pilot</th><th>Takım</th><th>En iyi süre</th><th>Fark</th><th>Tur</th></tr></thead><tbody>" + satirlar + "</tbody></table></div>";
  }

  // q: çözümlenmiş sıralama (Qualifying ya da Sprint Sıralaması); onek: "Q" ya da "SQ"
  function siralamaKart(h, cezalar, q, onek, poleEtiket) {
    var ust = "<div class='h-ozet'><b>" + poleEtiket + ":</b> " + U.pilotHucresi(q.pole.kod, q.pole.ad) + " " + takim(q.pole.takim) +
              " <span class='h-sure'>" + esc(q.pole.sure) + "</span></div>" +
              (q.elemeGuvenilir
                ? "<div class='h-ozet h-soluk'>" + onek + "1'de " + q.q1Elenen + " pilot elendi (" + q.n + " → " + q.q2Sayisi + "), " + onek + "2'de " + q.q2Elenen + " pilot elendi (" + q.q2Sayisi + " → " + q.q3Sayisi + ").</div>"
                : "<div class='h-ozet h-soluk'>Eleme bilgisi tahminidir (veri eksik); grid ve süreler yine de gösterilir.</div>");
    var sekmeler = [["grid", "Grid"], ["Q3", onek + "3"], ["Q2", onek + "2"], ["Q1", onek + "1"]].map(function (t) {
      return "<button class='h-q" + (S.qSekme === t[0] ? " aktif" : "") + "' data-act='q' data-v='" + t[0] + "'>" + t[1] + "</button>";
    }).join("");
    var liste = q.liste;
    var govde;
    if (S.qSekme === "grid") {
      govde = liste.map(function (x, i) {
        var c = cezalar[x.kod];
        return "<tr" + (i === 0 ? " class='h-pole'" : "") + "><td>" + U.pozRozet(x.sira) + "</td><td>" + U.pilotHucresi(x.kod, x.ad) + "</td><td>" + takim(x.takim) +
          "</td><td class='sayi'>" + esc(x.enIyi || "-") + "</td><td>" + (x.elendi ? "<span class='h-elendi'>" + onek + x.elendi.slice(1) + "'de elendi</span>" : "") +
          (c ? "<span class='h-ceza' title='Start sırası bu sıralamadan farklı (grid cezası ya da pit çıkışı)'>P" + c.siralama + " → start " + (c.start === "PL" ? "pit" : "P" + c.start) + "</span>" : "") + "</td></tr>";
      }).join("");
      return ust + "<div class='h-sekme'>" + sekmeler + "</div><div class='kap'><table><thead><tr><th>Sıra</th><th>Pilot</th><th>Takım</th><th>En iyi tur</th><th></th></tr></thead><tbody>" + govde + "</tbody></table></div>";
    }
    var bolum = S.qSekme; // Q1 | Q2 | Q3
    var surelilar = liste.filter(function (x) { return x[bolum]; }).sort(function (a, b) { return a[bolum] < b[bolum] ? -1 : (a[bolum] > b[bolum] ? 1 : 0); });
    var gecen = bolum === "Q1" ? q.q2Sayisi : (bolum === "Q2" ? q.q3Sayisi : 0);
    govde = surelilar.map(function (x, i) {
      var cizgi = q.elemeGuvenilir && gecen && i === gecen ? " h-elemecizgi" : "";
      return "<tr class='" + cizgi + (q.elemeGuvenilir && gecen && i >= gecen ? " h-elenen" : "") + "'><td>" + U.pozRozet(i + 1) + "</td><td>" + U.pilotHucresi(x.kod, x.ad) + "</td><td>" + takim(x.takim) +
        "</td><td class='sayi'>" + esc(x[bolum]) + "</td><td>" + (q.elemeGuvenilir && gecen && i >= gecen ? "<span class='h-elendi'>Elendi</span>" : "") + "</td></tr>";
    }).join("");
    return ust + "<div class='h-sekme'>" + sekmeler + "</div>" +
      (surelilar.length ? "<div class='kap'><table><thead><tr><th>Sıra</th><th>Pilot</th><th>Takım</th><th>" + onek + bolum.slice(1) + " süresi</th><th></th></tr></thead><tbody>" + govde + "</tbody></table></div>"
                        : "<p class='h-not'>Bu bölüm için süre verisi yok.</p>");
  }

  // OpenF1 kaynaklı seans (FP, Sprint Sıralaması) için sonuç yokken gösterilecek kısa açıklama
  function openf1BosMetin(h, s, st) {
    var o = h.of[s.sonucKaynagi] || {};
    var eski = V.bekleSuresiDoldu(s);
    if (o.durum === "yok-meeting" && eski) { return "Bu hafta sonu için OpenF1 verisi bulunamadı."; }
    if (o.durum === "oturum-yok" && eski) { return "Bu seans OpenF1'de bulunamadı."; }
    // B) bitti, sonuç henüz yok → bekleme · C) gerçek ağ/5xx/429/JSON hatası → ulaşılamıyor (seans sürerken hiçbiri gösterilmez: durum LIVE/DELAYED… olur)
    if (HS && st && (st.durum === "RESULT_PENDING" || st.legacyBitti)) { var m = HS.sonucMesaji({ durum: "RESULT_PENDING" }, o.durum, eski); if (m) { return m; } }
    if (o.durum === "hata") { return "OpenF1'e şu anda ulaşılamıyor. Tekrar denenecek."; }
    return "Sonuç henüz yayımlanmadı.";
  }

  // ---------- Seans kartı ----------
  // Sonuç/özet parçaları (seans kartı VE v3 seçili seans paneli ortak kullanır; sonuç motoruna dokunmaz)
  function sonucParcalari(h, s, bd, bk, genis) {
    var d = bd.d, st = bd.st, se = efektifSeans(s, st);
    var kaynak = s.sonucKaynagi;
    var sonuc = kaynak ? h.sonuclar[kaynak] : null;
    var ozet = "", detay = "", fpToplam = 0;

    if (d === "yaklasan" && !programDurdu(st)) { ozet = "<span class='h-geri'>Başlamasına " + geriSayim(se.baslangic) + "</span>"; }
    if (kaynak && sonuc) {
      if (kaynak === "qualifying") {
        ozet = "Pole: " + U.pilotHucresi(sonuc.pole.kod, sonuc.pole.ad) + " <span class='h-sure'>" + esc(sonuc.pole.sure) + "</span>";
        detay = siralamaKart(h, V.gridCezalari(sonuc, h.sonuclar.race), sonuc, "Q", "Pole");
      } else if (kaynak === "sq") {
        ozet = "SQ pole: " + U.pilotHucresi(sonuc.pole.kod, sonuc.pole.ad) + " <span class='h-sure'>" + esc(sonuc.pole.sure) + "</span>";
        detay = "<div class='h-ozet h-soluk'>Sprint start sırası bu sonuçtan türetilir. Sprint tamamlandığında Jolpica Sprint sonucundaki gerçek start sırası (grid) esas alınır; fark varsa satırda gösterilir.</div>" +
                siralamaKart(h, V.gridCezalari(sonuc, h.sonuclar.sprint), sonuc, "SQ", "SQ pole");
      } else if (kaynak.indexOf("fp") === 0) {
        // FP: ilk görünümde P1-P3 (pilot, takım, en iyi tur); "Tüm sonuçları göster (N)" ile tam liste
        ozet = sonuc.liste.slice(0, 3).map(function (r) {
          return "<div class='h-fp3'>" + U.pozRozet(r.sira) + " " + U.pilotHucresi(r.kod, r.ad) + " " + takim(r.takim) + " <span class='h-sure'>" + esc(r.sure || "-") + "</span></div>";
        }).join("");
        detay = fpTablosu(sonuc.liste, 0);
        fpToplam = sonuc.liste.length;
      } else {
        var ilk3 = sonuc.liste.slice(0, 3).map(function (r) { return U.pozRozet(r.sira) + " " + esc(r.kod); }).join(" &nbsp; ");
        ozet = ilk3;
        var pole = h.sonuclar.qualifying && kaynak === "race" ? "<div class='h-ozet'><b>Pole:</b> " + U.pilotHucresi(h.sonuclar.qualifying.pole.kod, h.sonuclar.qualifying.pole.ad) + " <span class='h-soluk'>(sıralama P1)</span></div>" : "";
        var fl = sonuc.liste.filter(function (r) { return r.enHizli && r.enHizli.sira === 1; })[0];
        var flSat = fl && kaynak === "race" ? "<div class='h-ozet h-soluk'>En hızlı tur: " + esc(fl.kod) + " " + esc(fl.enHizli.sure) + " (tur " + fl.enHizli.tur + ")</div>" : "";
        detay = pole + flSat + yarisTablosu(sonuc.liste, kaynak === "sprint", genis ? 0 : 10);
      }
    } else if (kaynak === "qualifying" && (d === "sonuc-bekleniyor" || d === "tamamlandi")) {
      ozet = "<span class='h-soluk'>Pole verisi mevcut değil</span>";
    } else if (s.saglayici === "openf1" && (d === "sonuc-bekleniyor" || d === "bitti")) {
      ozet = "<span class='h-soluk'>" + openf1BosMetin(h, s, st) + "</span>";
      if (kaynak === "sq" && h.sonuclar.sprint) {
        var sg = h.sonuclar.sprint.liste.slice().sort(function (a, b) { return (a.grid || 99) - (b.grid || 99); }).map(function (r) {
          return "<tr><td>" + U.pozRozet(r.grid > 0 ? r.grid : "PIT") + "</td><td>" + U.pilotHucresi(r.kod, r.ad) + "</td><td>" + takim(r.takim) + "</td></tr>";
        }).join("");
        detay = "<div class='h-ozet h-soluk'>Sprint start sırası (Jolpica Sprint sonucundaki grid):</div><div class='kap'><table><thead><tr><th>Start</th><th>Pilot</th><th>Takım</th></tr></thead><tbody>" + sg + "</tbody></table></div>";
      }
    } else if (d === "canli") {
      var tutulu = st && (st.durum === "DELAYED" || st.durum === "RED_FLAG" || st.durum === "SESSION_STOPPED" || st.durum === "RESUMED");
      ozet = tutulu && bk.var ? "" : (st && st.ozet ? stOzet(st) : "<span class='h-soluk'>Seans saat hesabına göre sürüyor olmalı.</span>");   // aynı bilgi kartta varsa özet satırı tekrar edilmez
    }
    if (d === "sonuc-bekleniyor" && s.saglayici !== "openf1") {
      ozet = V.bekleSuresiDoldu(s) ? "<span class='h-soluk'>Sonuç henüz yayınlanmadı. “Yenile” ile tekrar deneyebilirsiniz.</span>"
                                   : "<span class='h-soluk'>Sonuç yayınlanınca burada görünecek (otomatik kontrol edilir).</span>";
    }
    return { ozet: ozet, detay: detay, fpToplam: fpToplam, sonuc: sonuc, kaynak: kaynak };
  }

  function seansKarti(h, s, genis) {
    var bd = durumBul(h, s), d = bd.d, st = bd.st;
    var se = efektifSeans(s, st);                         // yeni saat kesinse gösterim ve geri sayım YENİ saate göre
    var bk = BU ? BU.seansKartlari(h, s, st) : { html: "", var: false };
    var key = s.anahtar;
    var acik = genis || !!S.acik[key];
    var pp = sonucParcalari(h, s, bd, bk, genis);
    var kaynak = pp.kaynak, ozet = pp.ozet, detay = pp.detay, fpToplam = pp.fpToplam;

    var durdu0 = programDurdu(st);
    var tr = durdu0 ? "—" : V.saatYaz(se.baslangic, ANA);
    var gun = V.kisaGunYaz(se.baslangic, ANA);
    var eskiSaat = (durdu0 || (st && st.efektif)) ? "<small class='bk-eskizaman'>planlı <s>" + esc(V.saatYaz(s.baslangic, ANA)) + "</s></small>" : "";
    var dugme = detay && !genis ? "<button class='h-ac' data-act='ac' data-key='" + esc(key) + "' aria-expanded='" + acik + "'>" + (fpToplam ? (acik ? "Listeyi daralt" : "Tüm sonuçları göster (" + fpToplam + ")") : (acik ? "Detayı gizle" : "Detay")) + "</button>" : "";
    var kartSinif = st && (st.durum === "DELAYED" || st.durum === "RED_FLAG" || st.durum === "SESSION_STOPPED" || st.durum === "POSTPONED" || st.durum === "CANCELLED") ? "h-durdu" : d;
    return "<div class='h-seans h-" + kartSinif + "'>" +
      "<div class='h-zaman'><b>" + esc(tr) + "</b><span>" + esc(gun) + "</span>" + (durdu0 ? "" : pistBilgi(se, h)) + eskiSaat + "</div>" +
      "<div class='h-orta'><div class='h-baslik'><b>" + esc(s.ad) + "</b>" +
        "<span class='h-info' tabindex='0' title='" + esc(s.acikla) + "'>ⓘ</span>" + durumRozeti(d, st) + "</div>" + bk.html +
        ((kaynak === "qualifying" || fpToplam) && acik && detay ? "" : "<div class='h-ozet-satir'>" + ozet + "</div>") +
        (acik && detay ? "<div class='h-detay'>" + detay + "</div>" : "") + dugme + (window.SeansOlaylari ? window.SeansOlaylari.html(h, s, d, st) : "") + (window.TurAnalizi ? window.TurAnalizi.html(h, s, d, st) : "") + (window.Gecisler ? window.Gecisler.html(h, s, d, st) : "") + (window.Pitler ? window.Pitler.html(h, s, d, st) : "") + (window.SeansHava ? window.SeansHava.html(h, s, d, st) : "") + "</div></div>";
  }


  // ---------- UI v3: seçili seans paneli (yalnız sunum; durum/veri/fetch mantığı değişmez) ----------
  var V3 = window.V3;
  var A7 = [["olay", "OLAYLAR", "SeansOlaylari", "so"], ["tur", "TURLAR", "TurAnalizi", "ta"], ["gecis", "GEÇİŞ", "Gecisler", "gc"], ["pit", "PİT", "Pitler", "pt"], ["hava", "HAVA", "SeansHava", "sh"]];
  function a7Liste(h, s, d, st) {       // yalnız bu seansa uygulanabilir (modülün kendi koşulu) olanlar; modül html'i boşsa sekme yok
    var out = [];
    A7.forEach(function (m) {
      var mod = window[m[2]];
      if (!mod) { return; }
      var x = ""; try { x = mod.html(h, s, d, st); } catch (e) { x = ""; }
      if (x) { out.push({ k: m[0], ad: m[1], mod: m[2], on: m[3], html: x }); }
    });
    return out;
  }
  function modDurum(mod, h, s) {        // modülün BELLEKTEKİ yüklenmiş verisi (yeni istek yok); yüklenmediyse null
    var m = window[mod], id = h.sezon + "-" + h.tur + "-" + s.anahtar, d = m && m._durum && m._durum[id];
    return d && d.durum === "ok" ? d : null;
  }
  function derece(x) { return Math.round(x) + "°C"; }
  function ozetCipleri(h, s, pp) {      // YALNIZ mevcut/yüklenmiş veriden; veri yoksa çip yok, yeni hesap yok
    var c = [], sn = pp.sonuc, kaynak = pp.kaynak;
    if (sn && sn.liste && sn.liste.length && (kaynak === "race" || kaynak === "sprint" || kaynak === "qualifying" || kaynak === "sq" || (kaynak || "").indexOf("fp") === 0)) {
      if ((kaynak === "qualifying" || kaynak === "sq") && sn.pole) { c.push(V3.cip("POLE", sn.pole.kod, "p")); }
      sn.liste.slice(0, 3).forEach(function (r, i) {
        if ((kaynak === "qualifying" || kaynak === "sq") && i === 0) { return; }
        if (r && r.kod && /^\d+$/.test(String(r.sira))) { c.push(V3.cip("P" + r.sira, r.kod, "p")); }
      });
    }
    var o = modDurum("SeansOlaylari", h, s);
    if (o && o.veri && o.veri.ozet && o.veri.ozet.kritik > 0) { c.push(V3.cip(o.veri.ozet.kritik, "KRİTİK OLAY")); }
    var g = modDurum("Gecisler", h, s);
    if (g && g.veri && g.veri.ozet && g.veri.ozet.toplam > 0) { c.push(V3.cip(g.veri.ozet.toplam, "GEÇİŞ KAYDI")); }
    var p = modDurum("Pitler", h, s);
    if (p && p.veri && p.veri.ozet && p.veri.ozet.toplam > 0) { c.push(V3.cip(p.veri.ozet.toplam, "PİT")); }
    var w = modDurum("SeansHava", h, s), wo = w && (w.ozet || (w.veri && w.veri.ozet));
    if (wo && wo.hava && wo.hava.min != null) { c.push(V3.cip(wo.hava.min === wo.hava.max ? derece(wo.hava.min) : derece(wo.hava.min) + "–" + derece(wo.hava.max), "HAVA")); }
    if (wo && wo.yagis && wo.yagis.goruldu) { c.push(V3.cip("YAĞIŞ", "KAYDI VAR")); }
    return c;
  }
  function durumMetni(h, s, bd, pp) {   // şeridin tek satırı: MEVCUT çıktılardan (geri sayım / durum özeti / bekleme mesajı)
    var d = bd.d, st = bd.st, se = efektifSeans(s, st);
    if (d === "yaklasan" && !programDurdu(st)) { return "<span class='h-geri'>Başlamasına " + geriSayim(se.baslangic) + "</span>"; }
    if (d === "canli") { return st && st.ozet ? esc(st.ozet) : "Seans saat hesabına göre sürüyor olmalı."; }
    if (d === "sonuc-bekleniyor" || (!pp.sonuc && pp.ozet && (d === "bitti" || d === "tamamlandi"))) { return pp.ozet.replace(/<[^>]+>/g, ""); }
    return "";
  }
  function bkKapsa(bk, key) {           // "Ne oldu?" benzeri bağlam kartları: yalnız BİLGİ (bk-info) kartları başlık + 1–2 satır özet + [DETAY]; uyarı/kritik (gecikme, kırmızı bayrak, yeni saat) kartları tam görünür kalır
    if (!bk.var) { return ""; }
    var info = bk.html.split("<div class='bk ").slice(1).filter(function (x) { return x.indexOf("bk-info") === 0; });
    var ek = info.some(function (x) { return /class='bk-(ek|eski)'/.test(x) || /class='bk-metin'>[^<]{101,}/.test(x); }), acik = !!S.bkAcik[key];
    return "<div class='v3-bk" + (acik ? " acik" : "") + "'>" + bk.html +
      (ek ? "<button type='button' class='h-ac v3-mini' data-act='bk' data-key='" + esc(key) + "' aria-expanded='" + acik + "'>" + (acik ? "DARALT" : "DETAY") + "</button>" : "") + "</div>";
  }
  function feedPanel(h, s) {            // Race Feed: MEVCUT depodan salt-okunur; son 3 önemli not + [TÜMÜ]. Yeni fetch/timer yok.
    var ol = feedOlaylari(h, s);
    if (!ol || !ol.length) { return ""; }
    var bas = s.baslangic.getTime() - 90 * 60000;
    ol = ol.filter(function (o) { var t = Date.parse(o.timestamp); return isFinite(t) && t >= bas; }).sort(function (a, b) { return Date.parse(b.timestamp) - Date.parse(a.timestamp); });
    if (!ol.length) { return ""; }
    var yuksek = ol.filter(function (o) { return o.priority === "high"; }).length, gor;
    if (S.feedPAcik) { gor = ol.slice(0, 40); }
    else {
      gor = ol.filter(function (o) { return o.priority === "high"; }).slice(0, 3);
      ol.forEach(function (o) { if (gor.length < 3 && gor.indexOf(o) < 0) { gor.push(o); } });
      gor = ol.filter(function (o) { return gor.indexOf(o) >= 0; });
    }
    var ozet = ol.length + " not" + (yuksek ? " · " + yuksek + " yüksek öncelikli" : "");
    var dugme = ol.length > 3 || S.feedPAcik ? "<button type='button' class='h-ac v3-mini' data-act='feedp' aria-expanded='" + !!S.feedPAcik + "'>" + (S.feedPAcik ? "DARALT" : "TÜMÜ (" + ol.length + ")") + "</button>" : "";
    return "<section class='v3-feed' aria-label='Race Feed'><div class='v3-feed-ust'><b>RACE FEED</b><span>" + esc(ozet) + "</span>" + dugme + "</div>" +
      "<div class='tl'>" + gor.map(function (o) { return U.olaySatiri(o, olayTakimlari(o)); }).join("") + "</div></section>";
  }
  function sonucSekmesi(h, s, pp, key) {
    var sn = pp.sonuc, kaynak = pp.kaynak, acik = !!S.acik[key];
    if (!sn) { return "<div class='h-ozet-satir'>" + pp.ozet + "</div>"; }
    var top, toplam = sn.liste ? sn.liste.length : 0;
    if (kaynak === "qualifying" || kaynak === "sq") {      // P1 = pole satırı (mevcut özet: "Pole/SQ pole: KOD süre"), ardından P2–P3
      top = "<div class='h-fp3'>" + pp.ozet + "</div>" + sn.liste.slice(1, 3).map(function (r) { return "<div class='h-fp3'>" + U.pozRozet(r.sira) + " " + U.pilotHucresi(r.kod, r.ad) + " " + takim(r.takim) + " <span class='h-sure'>" + esc(r.enIyi || "-") + "</span></div>"; }).join("");
    } else if (kaynak.indexOf("fp") === 0) {
      top = pp.ozet;
    } else {
      top = sn.liste.slice(0, 3).map(function (r) { return "<div class='h-fp3'>" + U.pozRozet(r.metin || r.sira) + " " + U.pilotHucresi(r.kod, r.ad) + " " + takim(r.takim) + " <span class='h-sure'>" + esc(r.sure || r.durum || "") + "</span></div>"; }).join("");
    }
    var tam = pp.detay;
    var dugme = tam ? "<button type='button' class='h-ac v3-mini' data-act='ac' data-key='" + esc(key) + "' aria-expanded='" + acik + "'>" + (acik ? "DARALT" : "TÜM SONUÇLAR" + (toplam > 3 ? " (" + toplam + ")" : "")) + "</button>" : "";
    return (acik && tam ? "<div class='h-detay'>" + tam + "</div>" : "<div class='h-ozet-satir'>" + top + "</div>") + dugme;
  }
  function panelSeans(h, s) {
    var bd = durumBul(h, s), d = bd.d, st = bd.st, se = efektifSeans(s, st), key = s.anahtar;
    var bk = BU ? BU.seansKartlari(h, s, st) : { html: "", var: false };
    var pp = sonucParcalari(h, s, bd, bk, true);
    var et = durumEtiketi(d, st);
    var durdu0 = programDurdu(st);
    var tr = durdu0 ? "—" : V.saatYaz(se.baslangic, ANA), gun = V.kisaGunYaz(se.baslangic, ANA);
    var eskiSaat = (durdu0 || (st && st.efektif)) ? "<small class='bk-eskizaman'>planlı <s>" + esc(V.saatYaz(s.baslangic, ANA)) + "</s></small>" : "";
    var kartSinif = st && (st.durum === "DELAYED" || st.durum === "RED_FLAG" || st.durum === "SESSION_STOPPED" || st.durum === "POSTPONED" || st.durum === "CANCELLED") ? "h-durdu" : d;
    var ton = et[1];
    var sekmeler = a7Liste(h, s, d, st), aktif = "sonuc", govde = "";
    if (S.pSek && sekmeler.some(function (x) { return x.k === S.pSek; })) { aktif = S.pSek; }
    var sonucVar = !!(pp.sonuc || pp.ozet);
    if (aktif === "sonuc") {
      if (!pp.sonuc && (d === "canli" || d === "yaklasan")) {      // özet cümlesi şeritte zaten var; yalnız ek satırlar (varsa) burada
        govde = st && st.satirlar && d === "canli" ? st.satirlar.map(function (x) { return "<div class='h-soluk h-ikincil'>" + esc(x) + "</div>"; }).join("") : "";
      } else { govde = sonucVar ? sonucSekmesi(h, s, pp, key) : ""; }
    }
    else { govde = sekmeler.filter(function (x) { return x.k === aktif; })[0].html; }
    var tabs = sekmeler.length ? V3.sekmeler([{ k: "sonuc", ad: "SONUÇ" }].concat(sekmeler), aktif, "psek", "Seans ayrıntıları") + "<div class='v3-sek-govde' data-v3-sek='" + esc(aktif) + "'>" + govde + "</div>" : (govde ? "<div class='v3-sek-govde'>" + govde + "</div>" : "");
    var neden = (d === "yaklasan" || d === "canli") && !durdu0 ? V3.neden(s.acikla) : "";
    return "<div class='h-seans h-v3 h-" + kartSinif + "'>" +
      "<header class='v3-ph'><div class='v3-ph-sol'><div class='h-baslik'><b>" + esc(s.ad) + "</b><span class='h-info' tabindex='0' title='" + esc(s.acikla) + "'>ⓘ</span></div>" +
        "<div class='h-zaman v3-tarih'><b>" + esc(tr) + "</b><span>" + esc(gun) + "</span>" + (durdu0 ? "" : pistBilgi(se, h)) + eskiSaat + "</div></div>" +
        V3.durum(durumRozeti(d, st), durumMetni(h, s, bd, pp), ton) + "</header>" +
      V3.cipSerit(ozetCipleri(h, s, pp)) + bkKapsa(bk, key) + neden + tabs + feedPanel(h, s) + "</div>";
  }
  // Seçili sekmenin modülünü, KENDİ düğmesini tıklatarak açar (lazy-load ve durum mantığı modülde aynen kalır; yeni fetch yolu yok)
  function a7Ac() {
    var kutu = document.querySelector("#sekme-hafta .v3-sek-govde[data-v3-sek]");
    if (!kutu) { return; }
    var k = kutu.getAttribute("data-v3-sek"); if (k === "sonuc") { return; }
    var m = A7.filter(function (x) { return x[0] === k; })[0]; if (!m) { return; }
    var b = kutu.querySelector("[data-" + m[3] + "-act='ac']");
    if (b && b.getAttribute("aria-expanded") === "false") { b.click(); }
  }
  function cipGuncelle() {              // modül verisi sonradan yüklenince yalnız çip şeridini tazeler (zamanlayıcı yok; MutationObserver)
    var kap = document.querySelector("#sekme-hafta .h-dp"), h = S.hafta; if (!kap || !h) { return; }
    var s = h.seanslar.filter(function (x) { return x.anahtar === kap.getAttribute("data-seans"); })[0]; if (!s) { return; }
    var bd = durumBul(h, s), bk = { html: "", var: false };
    var pp = sonucParcalari(h, s, bd, bk, true), seri = kap.querySelector(".v3-cipler"); if (!seri) { return; }
    var yeni = ozetCipleri(h, s, pp).join("");
    if (seri.getAttribute("data-imza") !== yeni) { seri.setAttribute("data-imza", yeni); seri.innerHTML = yeni; }   // imza dizgesiyle karşılaştır (innerHTML serileştirmesi farklı → sonsuz döngü olmasın)
  }

  // ---------- Sayfa gövdeleri ----------
  // ---- UI STYLE PASS v2 (yalnız sunum): hero + seans mini takvim gridi. Durum/veri/fetch mantığı değişmez. ----
  function buyuk(x) { return String(x == null ? "" : x).toLocaleUpperCase("tr").replace(/SPRİNT/g, "SPRINT"); }   // İngilizce sabit terim: SPRINT
  function tarihAraligi(h) {
    var l = (h.seanslar || []).slice().sort(function (p, q) { return p.baslangic - q.baslangic; });
    if (!l.length) { return ""; }
    function p(d) { var g = String(V.kisaGunYaz(d, ANA) || "").split(/\s+/); return { g: g[0], a: g[1] }; }
    var x = p(l[0].baslangic), y = p(l[l.length - 1].baslangic);
    if (!x.g || !y.g) { return ""; }
    return buyuk(x.a === y.a ? x.g + "–" + y.g + " " + x.a : x.g + " " + x.a + "–" + y.g + " " + y.a);
  }
  function pistSvg(id) {
    var PS = window.PistSiluetleri;
    if (!PS || !PS.YOL || !PS.YOL[id]) { return ""; }
    return "<div class='h-hero-sag'><svg class='h-pist-svg' viewBox='0 0 300 200' role='img' aria-label='Pist silueti (dekoratif çizim)' preserveAspectRatio='xMidYMid meet'>" +
           "<path class='h-hat-alt' d='" + PS.YOL[id] + "'/><path class='h-hat' d='" + PS.YOL[id] + "'/></svg></div>";
  }
  function pistGorunen(h) {      // ham anahtar (ör. "marina_bay") yerine insan okunur pist adı; yalnız görüntü
    var ad = String(h.pistAdi || "");
    if (ad && ad !== h.pistId && !/^[a-z0-9]+(_[a-z0-9]+)*$/.test(ad)) { return ad; }
    var sn = window.PIST_SINIFLANDIRMA && window.PIST_SINIFLANDIRMA.harita ? window.PIST_SINIFLANDIRMA.harita()[h.pistId] : null;
    if (sn && sn.ad) { return sn.ad; }
    return ad.replace(/_/g, " ").replace(/(^|\s)([a-zçğıöşü])/g, function (m, a, b) { return a + b.toUpperCase(); });
  }
  function sehirG(t) { try { return window.SezonTakvim && SezonTakvim.sehirGorunen ? SezonTakvim.sehirGorunen(t) : t; } catch (e) { return t; } }
  function ustKart(h, sayfa) {
    var bay = U.bayrak(h.ulke), toplam = S.yarislar && S.yarislar.length ? " / " + S.yarislar.length : "";
    var tarih = tarihAraligi(h), svg = pistSvg(h.pistId);
    return "<div class='kap yk h-ust h-hero'><div class='yk-ust'>" +
        "<span class='yk-tur'>TUR " + h.tur + toplam + (h.sprintMi ? " <span class='h-sprint-r'>SPRINT</span>" : "") + "</span>" +
        "<select class='h-sec' data-act='sec' aria-label='Hafta sonu seç'>" + secimler() + "</select>" +
        "<button class='yenile h-yenile' data-act='yenile'>Yenile</button></div>" +
      "<div class='h-hero-g" + (svg ? "" : " h-hero-tek") + "'><div class='h-hero-sol'>" +
        "<div class='yk-yer'>" + bay + "<div><b>" + esc(h.ad) + "</b><span class='alt'>" + esc(pistGorunen(h)) + " · " + esc(sehirG(h.yer)) + ", " + esc(h.ulke) + "</span></div></div>" +
        (tarih ? "<p class='h-hero-meta'>" + esc(tarih) + "</p>" : "") + "</div>" + svg + "</div>" +
      "<p class='h-not'>Saatler Türkiye saatiyle gösterilir" + (h.pistTz ? "; pist yerel saati küçük yazıyla eklenir." : ".") + "</p>" +
      (S.hata ? "<p class='h-uyari'>" + esc(S.hata) + "</p>" : "") +
      (h.hata ? "<p class='h-uyari'>Veri güncellenemedi" + (h.eski ? "; son kaydedilen veri gösteriliyor." : ".") + "</p>" : "") + "</div>";
  }

  // Seans kartındaki kısa durum etiketi: yalnız MEVCUT durum çıktısından (HaftaState/seansDurumu); yeni durum mantığı yok
  function durumEtiketi(d, st) {
    if (st) {
      if (st.durum === "POSTPONED") { return ["ERTELENDİ", "bekle"]; }
      if (st.durum === "CANCELLED") { return ["İPTAL", "kirmizi"]; }
      if (st.durum === "UPCOMING" && st.yeniSaat) { return ["YENİ SAAT", "bekle"]; }
      if (st.durum === "DELAYED") { return ["GECİKTİ", "bekle"]; }
      if (st.durum === "RED_FLAG") { return ["KIRMIZI BAYRAK", "kirmizi"]; }
      if (st.durum === "SESSION_STOPPED") { return ["DURDURULDU", "bekle"]; }
      if (st.durum === "RESUMED") { return ["YENİDEN BAŞLADI", "live"]; }
      if (st.durum === "LIVE") { return ["LIVE", "live"]; }
    }
    if (d === "canli") { return ["LIVE", "live"]; }
    if (d === "tamamlandi") { return ["TAMAMLANDI", "bitti"]; }
    if (d === "sonuc-bekleniyor") { return ["SONUÇ BEKLENİYOR", "bekle"]; }
    if (d === "bitti") { return ["BİTTİ", "bitti"]; }
    return ["", "yaklasan"];
  }

  // Varsayılan seçili seans: MEVCUT durum çıktılarından (yeni durum mantığı yok). LIVE/aktif → sıradaki yaklaşan → hepsi bittiyse en son seans → ilk seans
  var AKTIF_ST = { LIVE: 1, RESUMED: 1, DELAYED: 1, RED_FLAG: 1, SESSION_STOPPED: 1 };
  function varsayilanSeans(h) {
    var l = h.seanslar.map(function (s) { var bd = durumBul(h, s); return { s: s, bd: bd, e: efektifSeans(s, bd.st) }; })
      .sort(function (a, b) { return a.e.baslangic - b.e.baslangic; });
    if (!l.length) { return null; }
    var x = l.filter(function (y) { return y.bd.d === "canli" || (y.bd.st && AKTIF_ST[y.bd.st.durum]); })[0] ||
            l.filter(function (y) { return y.bd.d === "yaklasan"; })[0];
    if (!x) { var bit = l.filter(function (y) { return y.bd.d === "tamamlandi" || y.bd.d === "bitti" || y.bd.d === "sonuc-bekleniyor"; }); x = bit.length ? bit[bit.length - 1] : l[0]; }
    return x.s;
  }
  function seciliSeans(h) {
    var s = S.secKul && S.secSeans ? h.seanslar.filter(function (x) { return x.anahtar === S.secSeans; })[0] : null;
    return s || varsayilanSeans(h);
  }

  function cizelge(h, sec) {
    return "<section class='h-prog' aria-label='Seans programı'><p class='h-prog-bas'>SEANS PROGRAMI</p><div class='h-cizelge' role='group' aria-label='Seans seç'>" + h.seanslar.map(function (s) {
      var bd = durumBul(h, s), d = bd.d;
      var durdu = bd.st && (bd.st.durum === "DELAYED" || bd.st.durum === "RED_FLAG" || bd.st.durum === "SESSION_STOPPED" || programDurdu(bd.st));
      var et = durumEtiketi(d, bd.st);
      if (durdu) { d = "yaklasan"; }   // gecikme/durdurma/erteleme: canlı vurgusu yok
      var se = efektifSeans(s, bd.st);
      var saatM = bd.st && bd.st.durum === "POSTPONED" ? "ERT." : (bd.st && bd.st.durum === "CANCELLED" ? "İPT." : V.saatYaz(se.baslangic, ANA));
      var g = String(V.kisaGunYaz(se.baslangic, ANA) || "").split(/\s+/), gun = g.length === 3 ? g[0] + " " + g[1] + " · " + g[2] : g.join(" ");
      var secili = sec && sec.anahtar === s.anahtar;
      return "<button type='button' class='h-cz h-" + d + " hz-" + et[1] + (secili ? " h-sec" : "") + "' data-act='seans' data-key='" + esc(s.anahtar) + "' aria-pressed='" + (secili ? "true" : "false") + "'>" +
        "<span class='h-cz-g'>" + esc(buyuk(gun)) + "</span><b>" + esc(buyuk(s.ad)) + "</b><span class='h-cz-s'>" + esc(saatM) + "</span><i class='h-cz-d'>" + esc(et[0]) + "</i></button>";
    }).join("") + "</div></section>";
  }

  function aciklamaKarti(h) {
    var adimlar = h.seanslar.map(function (s) { return "<li><b>" + esc(s.ad) + ":</b> " + esc(s.acikla) + "</li>"; }).join("");
    return "<details class='h-acikla'" + (S.aciklaAcik ? " open" : "") + " data-act='acikla'><summary>F1 hafta sonu nasıl işliyor?</summary>" +
      "<p class='h-not'>Bu hafta sonunun gerçek seans sırası:</p><ol>" + adimlar + "</ol></details>";
  }

  // Üstteki 5 seans kartı ana program ve ana gezinme; altta YALNIZ seçili seansın detayı (eski gün gün tekrar listesi kaldırıldı)
  function haftaSayfasi(h) {
    var sec = seciliSeans(h);
    return "<h1>Yarış Haftası</h1>" + ustKart(h) + (BU ? BU.haftaOzeti(h) : "") + cizelge(h, sec) + aciklamaKarti(h) +
      (sec ? "<section class='h-dp' aria-label='Seçili seans detayı' data-seans='" + esc(sec.anahtar) + "'>" + panelSeans(h, sec) + "</section>" : "");
  }

  // ---------- Sprint sekmesi: Race Feed notları (Yarış Günü ile AYNI depo; ikinci fetch/poll yok, yalnızca okunur) ----------
  function olayTakimlari(o) {
    var cikti = [];
    try {
      (o.drivers || []).forEach(function (f) {
        var k = sezonPilotlar.find(function (x) { return x.Driver.familyName === f; });
        if (k && k.Constructors.length) { var t = k.Constructors[k.Constructors.length - 1].name; if (cikti.indexOf(t) < 0) { cikti.push(t); } }
      });
    } catch (e) { /* pilot listesi henüz yok: rozetsiz göster */ }
    return cikti.slice(0, 2);
  }
  function sprintFeed(h, sp) {
    var baslik = "<h2 class='h-gun'>Sprint — Yarış Notları</h2>";
    if (!window.RaceFeed || !sp) { return ""; }
    var ol = [];
    try { ol = window.RaceFeed.yukle(h.sezon + "-" + h.tur + "-sprint").olaylar || []; } catch (e) { ol = []; }
    var bas = sp.baslangic.getTime() - 90 * 60000;
    ol = ol.filter(function (o) { var t = Date.parse(o.timestamp); return isFinite(t) && t >= bas; })
           .sort(function (a, b) { return Date.parse(b.timestamp) - Date.parse(a.timestamp); });
    if (!ol.length) {
      var oncesi = Date.now() < sp.baslangic.getTime() - 60 * 60000;
      return baslik + "<div class='kap h-feed'><p class='h-not'>" + (oncesi ? "Sprint yaklaşırken ve sürerken Race Feed notları burada görünür." : "Bu Sprint için henüz Race Feed notu yok.") + "</p></div>";
    }
    var gorunen;
    if (S.feedAcik) { gorunen = ol.slice(0, 40); }
    else {
      // ilk görünüm: en yeni kritik (yüksek öncelikli) 5 not; azsa en yeni notlarla tamamlanır
      var kritik = ol.filter(function (o) { return o.priority === "high"; }).slice(0, 5);
      if (kritik.length < 3) { ol.forEach(function (o) { if (kritik.length < 3 && kritik.indexOf(o) < 0) { kritik.push(o); } }); }
      gorunen = ol.filter(function (o) { return kritik.indexOf(o) >= 0; });
    }
    var liste = gorunen.map(function (o) { return U.olaySatiri(o, olayTakimlari(o)); }).join("");
    var dugme = ol.length > gorunen.length || S.feedAcik
      ? "<button class='h-ac' data-act='feed' aria-expanded='" + S.feedAcik + "'>" + (S.feedAcik ? "Listeyi daralt" : "Tüm notları göster (" + ol.length + ")") + "</button>" : "";
    return baslik + "<div class='kap h-feed'><div class='tl'>" + liste + "</div>" + dugme +
           "<p class='h-not'>Kaynak: Race Feed (Chris Medland). Yarış Günü ile aynı kayıttan gösterilir.</p></div>";
  }

  function sprintSayfasi(h) {
    if (!h.sprintMi) { return "<h1>Sprint</h1><p class='h-not'>Seçili hafta sonunda sprint yok.</p>"; }
    var sq = h.seanslar.filter(function (s) { return s.anahtar === "SprintQualifying" || s.anahtar === "SprintShootout"; })[0];
    var sp = h.seanslar.filter(function (s) { return s.anahtar === "Sprint"; })[0];
    return "<h1>Sprint</h1>" + ustKart(h) +
      "<h2 class='h-gun'>" + esc(sq ? sq.ad : "Sprint Sıralaması") + "</h2>" + (sq ? seansKarti(h, sq, true) : "<p class='h-not'>Bu hafta sonu için takvimde yok.</p>") +
      "<h2 class='h-gun'>Sprint</h2>" + seansKarti(h, sp, true) + sprintFeed(h, sp);
  }

  // ---------- Çizim ve akış ----------
  function cizHafta() {
    var a = document.getElementById("sekme-hafta"), b = document.getElementById("sekme-sprint");
    if (!a || !b) { return; }
    if (!S.hafta) {
      var msg = S.hata ? "<p class='h-uyari'>" + esc(S.hata) + "</p><button class='yenile' data-act='yenile'>Yeniden dene</button>" : "<p class='h-not'>Yükleniyor...</p>";
      a.innerHTML = "<h1>Yarış Haftası</h1>" + msg; b.innerHTML = "<h1>Sprint</h1>" + msg;
      return;
    }
    if (S.aktifSayfa !== "sprint") { a.innerHTML = haftaSayfasi(S.hafta); }
    if (S.aktifSayfa === "sprint") { b.innerHTML = sprintSayfasi(S.hafta); }
    if (S.aktifSayfa == null) { a.innerHTML = haftaSayfasi(S.hafta); }
    sprintDugmesi();
    a7Ac();
  }

  function sprintDugmesi() {
    var d = document.getElementById("btn-sprint");
    if (!d) { return; }
    var goster = !!(S.hafta && S.hafta.sprintMi);
    d.hidden = !goster;
    if (!goster && S.aktifSayfa === "sprint" && typeof sekmeAc === "function") { sekmeAc("hafta"); }
  }

  function durdurBekle() { if (S.bekle) { S.bekle.durdur(); S.bekle = null; } }

  async function turYukle(tur) {
    var kayit = S.yarislar.filter(function (y) { return Number(y.round) === Number(tur); })[0];
    if (!kayit) { return; }
    durdurBekle();
    var sayac = ++S.yukleSayac;
    S.tur = Number(tur); S.acik = {}; S.secSeans = null; S.secKul = false; S.qSekme = "grid"; S.hata = null; S.pSek = "sonuc"; S.feedPAcik = false; S.bkAcik = {};
    var h = V.haftaKur(kayit, "f1");
    S.hafta = h;
    cizHafta();
    await V.haftaYukle(h, undefined, function () { return sayac !== S.yukleSayac || S.aktifSayfa == null; });
    if (sayac !== S.yukleSayac) { return; } // arada başka hafta seçildi
    if (S.aktifSayfa == null) { return; }   // yükleme sürerken sekmeden çıkıldı: bekleme döngüsü başlatılmaz
    cizHafta();
    S.bekle = V.bekleBaslat(h, function () { if (sayac === S.yukleSayac) { cizHafta(); } });
  }

  // Takvimi bir kez yükler, varsayılan haftayı seçer, Sprint düğmesini ayarlar (Yarış grubuna girilince çağrılır)
  function hazirla() {
    if (S.hazir) { return S.hazir; }
    S.hazir = (async function () {
      try {
        var t = await V.takvimYukle(new Date().getFullYear());
        S.yarislar = t.yarislar; S.takvimEski = t.eski;
        var v = V.varsayilanTur(S.yarislar);
        if (v) {
          S.tur = Number(v.round);
          S.hafta = V.haftaKur(v, "f1");
          sprintDugmesi();
        }
      } catch (e) { S.hata = "Takvim alınamadı: " + e.message; S.hazir = null; }
    })();
    return S.hazir;
  }

  async function ac(sayfa) {
    S.aktifSayfa = sayfa;
    try { localStorage.setItem(ALT_KEY, sayfa); } catch (e) { /* önemli değil */ }
    cizHafta();
    await hazirla();
    if (S.aktifSayfa !== sayfa) { return; }
    if (S.tur != null && (!S.bekle && !S.yukleniyor)) {
      S.yukleniyor = true;
      try { await turYukle(S.tur); } finally { S.yukleniyor = false; }
    } else { cizHafta(); }
  }

  function durdur() { durdurBekle(); S.aktifSayfa = null; }

  function sonAltSekme() {
    try { var v = localStorage.getItem(ALT_KEY); if (v === "hafta" || v === "sprint" || v === "gun" || v === "yaris") { return v; } } catch (e) { /* yok */ }
    return "hafta";
  }
  function sonAltSekmeYaz(v) { try { localStorage.setItem(ALT_KEY, v); } catch (e) { /* yok */ } }

  // Olay yönetimi (iki bölüm için ortak)
  function olay(e) {
    var el = e.target.closest("[data-act]");
    if (!el) { return; }
    var a = el.getAttribute("data-act");
    if (a === "seans") {
      var sk = el.getAttribute("data-key"); S.secSeans = sk; S.secKul = true; S.qSekme = "grid"; S.pSek = "sonuc"; S.feedPAcik = false; S.bkAcik = {}; cizHafta();
      try { var yb = document.querySelector("#sekme-hafta [data-act='seans'][data-key='" + sk + "']"); if (yb) { yb.focus({ preventScroll: true }); } } catch (x) { /* önemsiz */ }
    }
    else if (a === "ac") { var k = el.getAttribute("data-key"); S.acik[k] = !S.acik[k]; cizHafta(); }
    else if (a === "feed") { S.feedAcik = !S.feedAcik; cizHafta(); }
    else if (a === "feedp") { S.feedPAcik = !S.feedPAcik; cizHafta(); }
    else if (a === "bk") { var bkk = el.getAttribute("data-key"); S.bkAcik[bkk] = !S.bkAcik[bkk]; cizHafta(); }
    else if (a === "psek") {
      var pv = el.getAttribute("data-v"); S.pSek = pv; cizHafta();
      try { var pb = document.querySelector("#sekme-hafta [data-act='psek'][data-v='" + pv + "']"); if (pb) { pb.focus({ preventScroll: true }); } } catch (x) { /* önemsiz */ }
    }
    else if (a === "q") { S.qSekme = el.getAttribute("data-v"); cizHafta(); }
    else if (a === "yenile") {
      if (!S.hafta) { S.hazir = null; ac(S.aktifSayfa || "hafta"); return; }
      turYukle(S.tur);
    }
  }
  function degisim(e) {
    var el = e.target;
    if (el.getAttribute && el.getAttribute("data-act") === "sec") { turYukle(el.value); }
    if (el.getAttribute && el.getAttribute("data-act") === "acikla") { /* toggle olayı ayrı */ }
  }
  document.addEventListener("DOMContentLoaded", function () {
    ["sekme-hafta", "sekme-sprint"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) { return; }
      el.addEventListener("click", olay);
      el.addEventListener("change", degisim);
      if (id === "sekme-hafta" && window.MutationObserver) { new MutationObserver(cipGuncelle).observe(el, { childList: true, subtree: true }); }
      el.addEventListener("toggle", function (e) { if (e.target.classList && e.target.classList.contains("h-acikla")) { S.aciklaAcik = e.target.open; } }, true);
    });
  });

  document.addEventListener("f1-feed-guncel", function () { if (S.hafta && S.aktifSayfa) { cizHafta(); } });

  window.YarisHaftasi = { hazirla: hazirla, ac: ac, durdur: durdur, sonAltSekme: sonAltSekme, sonAltSekmeYaz: sonAltSekmeYaz, _durum: S };
})();
