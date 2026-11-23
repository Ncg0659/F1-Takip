/* YARIŞIN HİKÂYESİ v1 — tamamlanmış yarış için tek dikey olay akışı (3.1.0).
   1) SAF katman (YarisHikaye.kur; DOM/ağ/depolama YOK, Node'da test edilir): Jolpica sonuç + OpenF1 historical (race_control, pit, stints,
      position, kazananın tur başlangıçları) → deterministik, az sayıda anlamlı olay. Veri uydurulmaz; eksik veri = olay yok.
   2) VERİ katmanı (YarisHikayeVeri.yukle; tarayıcı): mevcut historical modüller (RaceControlVeri, PitVeri, LastikVeri) + aynı OpenF1 kuyruğu
      (OpenF1Veri.sirali) ile yalnız position + kazananın laps'i. Tembel (bölüm görünür olunca), tek seferlik, sezon+tur anahtarlı önbellek.
   KURALLAR (v1):
     • Pozisyon olayı yalnız: P1 değişimi · podyuma giriş/çıkış · ilk 10'a giriş/çıkış · tek turda ≥3 sıra değişimi. Aynı tur + aynı tür birleşir.
       Pit yapan pilotun pit turu ve sonraki turdaki değişimi pozisyon olayı sayılmaz (pit kartında anlatılır). ≥4 pilotun pit yaptığı turlarda
       ilk 10 / büyük değişim kartı üretilmez (pit döngüsü gürültüsü); P1/podyum değişimi kalır. En çok 8 pozisyon kartı (önem sırasıyla seçilir).
     • Pit: lider/podyum pilotu, favori pilot veya ≥3 sıra kaybettiren pit; aynı turda ≥4 pit → tek grup kartı. Pit kaybı / strateji sebebi yazılmaz.
     • Lastik: yalnız stint verisi o pite birebir eşleşirse (yeni stint pit turunda ya da bir sonraki turda başlıyorsa) "MEDIUM → HARD".
     • SC / VSC: başlangıç–bitiş tek kart (race_control). Kırmızı bayrak ve açıkça "RESUMED" yazan yeniden başlama ayrı kart. "Kime yaradı" yorumu yok.
     • DNF: yalnız sonuçta sınıflandırılmamış ("R") pilot; tamamladığı tur sayısı. Sebep yazılmaz.
     • START: pole = sıralama P1 (grid P1 ile karıştırılmaz); grid ilk 3; ilk tur sonunda lider (pozisyon verisi varsa).
     • FINISH: kazanan, podyum, gridden en çok yükselen (≥3). Şampiyonluk: yalnız sampiyonluk-durum.js çıktısı (önce / sonra). */
(function (kok) {
  "use strict";
  var TERIM = {
    SC: "Güvenlik aracı pistte; araçlar arkasında dizilir, sollama yapılmaz.",
    VSC: "Pilotlar belirlenen delta hızına uyar; sollama yapılmaz.",
    RED: "Seans durduruldu; araçlar pit yoluna döner."
  };
  var SIRA = { START: 0, RED: 1, RESUMED: 1, SC: 1, VSC: 1, DNF: 2, PIT: 3, LIDER: 4, PODYUM: 5, BUYUK: 6, ILK10: 7, FINISH: 8, SAMPIYONLUK: 9 };
  var ONEM = { LIDER: 100, PODYUM: 60, BUYUK: 40, ILK10: 30 };
  var EN_COK_POZ = 8;

  function sayi(x) { var n = Number(x); return x !== null && x !== "" && isFinite(n) ? n : null; }
  function ms(x) { if (typeof x === "number") { return x; } var t = Date.parse(x); return isFinite(t) ? t : null; }
  function al(o, a, b) { return o == null ? null : (o[a] != null ? o[a] : o[b]); }

  // ---- pilotlar (Jolpica sonuç) ----
  function pilotlar(sonuc) {
    var m = {}, no = {};
    (sonuc || []).forEach(function (r) {
      if (!r || !r.Driver) { return; }
      var d = r.Driver, g = sayi(r.grid), pt = String(r.positionText == null ? "" : r.positionText);
      var p = { id: d.driverId, kod: d.code || (d.familyName || "").slice(0, 3).toUpperCase(), soyad: d.familyName || d.code || "", no: sayi(r.number),
                takim: r.Constructor ? r.Constructor.name : "", grid: g && g > 0 ? g : null, pitYolu: !(g && g > 0), bitis: sayi(r.position),
                siniflandi: /^\d+$/.test(pt), kod2: pt, tur: sayi(r.laps) || 0, durum: String(r.status || "") };
      m[p.id] = p; if (p.no != null) { no[p.no] = p.id; }
    });
    return { id: m, no: no };
  }

  // ---- tur sonu sıralamaları (OpenF1 position + kazananın tur başlangıçları) ----
  function anlikSiralar(P, poz, turBas, N) {
    if (!poz || !poz.length || !turBas) { return null; }
    var rows = poz.map(function (r, i) { return { t: ms(al(r, "date", "t")), dn: sayi(al(r, "driver_number", "dn")), p: sayi(al(r, "position", "p")), i: i }; })
      .filter(function (r) { return r.t != null && r.dn != null && r.p != null && P.no[r.dn]; })
      .sort(function (a, b) { return a.t - b.t || a.i - b.i; });
    var sinir = [], eksik = 0;
    for (var L = 1; L <= N; L++) { var b = turBas[L + 1]; if (L < N && b == null) { eksik++; } sinir.push(L < N ? b : null); }
    if (!rows.length || eksik > Math.max(2, N * 0.1)) { return null; }
    var S = [], cur = {}, k = 0;
    for (L = 1; L <= N; L++) {
      var lim = sinir[L - 1];
      if (lim == null && L < N) { S[L] = null; continue; }
      while (k < rows.length && (lim == null ? false : rows[k].t < lim)) { cur[P.no[rows[k].dn]] = rows[k].p; k++; }
      var kopya = {}; Object.keys(cur).forEach(function (id) { kopya[id] = cur[id]; }); S[L] = kopya;
    }
    // son tur: resmî sonuç (ceza sonrası) esas
    var son = {}; Object.keys(P.id).forEach(function (id) { var x = P.id[id]; if (x.siniflandi && x.bitis) { son[id] = x.bitis; } }); S[N] = son;
    return S;
  }
  function liderOf(s) { if (!s) { return null; } var l = null; Object.keys(s).forEach(function (id) { if (s[id] === 1) { l = id; } }); return l; }
  function aktif(P, id, L) { var x = P.id[id]; return !!x && (x.cekildi ? L <= x.tur : (x.siniflandi || L <= x.tur)); }

  function pd(n) { return "P" + n; }
  // Türkçe ayrılma eki: P1'den, P3'ten, P6'dan, P10'dan, P20'den (sayının okunuşuna göre)
  function pdan(n) {
    var x = Number(n), son = x % 10, ek;
    if (son === 0) { ek = { 10: "'dan", 20: "'den", 30: "'dan" }[x] || "'dan"; }
    else { ek = { 1: "'den", 2: "'den", 3: "'ten", 4: "'ten", 5: "'ten", 6: "'dan", 7: "'den", 8: "'den", 9: "'dan" }[son]; }
    return "P" + n + ek;
  }
  function adlar(P, ids) { return ids.map(function (id) { return P.id[id] ? P.id[id].soyad : id; }); }
  function olay(tur, tip, baslik, aciklama, ids, ek) {
    var o = { tur: tur, tip: tip, baslik: baslik, aciklama: aciklama || "", pilotlar: ids || [] };
    if (ek) { Object.keys(ek).forEach(function (k) { o[k] = ek[k]; }); }
    return o;
  }

  // ---- race_control → SC / VSC / RED / RESUMED ----
  function bayraklar(rc) {
    var out = [], acik = { SAFETY_CAR: null, VSC: null };
    (rc || []).forEach(function (e) {
      var tip = e.normalizedType, alt = e.subType, tur = sayi(e.lapNumber);
      if (tip === "SAFETY_CAR" || tip === "VSC") {
        if (alt !== "END") { if (!acik[tip]) { acik[tip] = { tur: tur }; } }
        else if (acik[tip]) { out.push({ tip: tip === "VSC" ? "VSC" : "SC", bas: acik[tip].tur, bit: tur }); acik[tip] = null; }
      } else if (tip === "RED_FLAG") { if (!out.some(function (o) { return o.tip === "RED" && o.bas === tur; })) { out.push({ tip: "RED", bas: tur }); } }
      else if (tip === "SESSION_RESUMED" && alt === "EXPLICIT") { out.push({ tip: "RESUMED", bas: tur }); }
    });
    Object.keys(acik).forEach(function (k) { if (acik[k]) { out.push({ tip: k === "VSC" ? "VSC" : "SC", bas: acik[k].tur, bit: null }); } });
    return out.filter(function (o) { return o.bas != null; });
  }
  function bayrakAktif(bay, L, tip) { return bay.some(function (b) { return b.tip === tip && b.bas <= L && (b.bit == null || L <= b.bit); }); }

  function kur(g) {
    g = g || {};
    var P = pilotlar(g.sonuc), ids = Object.keys(P.id);
    if (!ids.length) { return { olaylar: [], sinirli: true, kaynak: {} }; }
    var kazanan = ids.filter(function (id) { return P.id[id].bitis === 1; })[0] || null;
    var N = kazanan ? P.id[kazanan].tur : Math.max.apply(null, ids.map(function (id) { return P.id[id].tur; }));
    // yarıştan çekilen: sınıflandırılmamış (R / DNF) ya da sınıflandırılmış ama tur eksik ve durum "Finished / +N Lap" değil (ör. Retired). D (DSQ) / W (DNS) hariç.
    ids.forEach(function (id) { var x = P.id[id]; x.cekildi = (/^(R|DNF|RET)$/i.test(x.kod2) || (x.siniflandi && x.tur < N && !/Finished|Lap/i.test(x.durum))) && x.tur < N; });
    var turBas = null;
    if (g.turBas) { turBas = {}; Object.keys(g.turBas).forEach(function (k) { var t = ms(g.turBas[k]); if (t != null) { turBas[Number(k)] = t; } }); }
    var S = N > 0 ? anlikSiralar(P, g.pozisyon, turBas, N) : null;
    var grid = {}; ids.forEach(function (id) { if (P.id[id].grid) { grid[id] = P.id[id].grid; } });
    var bay = bayraklar(g.rc), fav = g.favori || null;
    var pitler = (g.pit || []).map(function (r) { return { dn: sayi(al(r, "driverNumber", "driver_number")), tur: sayi(al(r, "lapNumber", "lap_number")) }; })
      .filter(function (r) { return r.dn != null && r.tur != null && P.no[r.dn]; }).map(function (r) { return { id: P.no[r.dn], tur: r.tur }; });
    var pitTur = {}, pitSay = {}; pitler.forEach(function (p) { (pitTur[p.id] = pitTur[p.id] || {})[p.tur] = 1; pitSay[p.tur] = (pitSay[p.tur] || 0) + 1; });
    var stint = {};
    (g.stint || []).forEach(function (r) { var dn = sayi(al(r, "driver_number", "dn")), id = P.no[dn]; if (!id) { return; } (stint[id] = stint[id] || []).push({ n: sayi(r.stint_number), bas: sayi(r.lap_start), bit: sayi(r.lap_end), lastik: r.compound ? String(r.compound).toUpperCase() : null }); });
    Object.keys(stint).forEach(function (id) { stint[id].sort(function (a, b) { return (a.bas || 0) - (b.bas || 0); }); });
    var out = [];

    // START
    var gridSira = ids.filter(function (id) { return grid[id]; }).sort(function (a, b) { return grid[a] - grid[b]; });
    var pole = g.pole && P.id[g.pole] ? g.pole : (g.pole ? ids.filter(function (id) { return P.id[id].kod === g.pole; })[0] || null : null);   // driverId ya da 3 harfli kod
    var st1 = S && S[1], l1 = liderOf(st1), satir = [];
    if (pole) { var pg = P.id[pole]; satir.push("Pole: " + pg.soyad + (pg.grid === 1 ? "" : (pg.pitYolu ? " — sıralamada P1, yarışa pit yolundan başladı" : " — sıralamada P1, gridde " + pd(pg.grid)))); }
    if (gridSira.length >= 3) { satir.push("Grid ilk 3: " + adlar(P, gridSira.slice(0, 3)).join(" · ")); }
    var bas = "Yarış başladı", acik1 = "";
    if (l1) {
      var lg = P.id[l1];
      if (lg.grid === 1) { bas = lg.soyad + " ilk turu önde tamamladı"; }
      else { bas = lg.soyad + " ilk turda liderliği aldı"; acik1 = (lg.grid ? pdan(lg.grid) + " başladı" : "Pit yolundan başladı") + ", ilk tur sonunda P1'e çıktı."; }
    }
    out.push(olay(1, "START", bas, acik1, l1 ? [l1] : (gridSira[0] ? [gridSira[0]] : []), { satirlar: satir }));

    // BAYRAKLAR
    bay.forEach(function (b) {
      if (b.tip === "SC" || b.tip === "VSC") {
        out.push(olay(b.bas, b.tip, b.tip === "SC" ? "Güvenlik aracı" : "Sanal güvenlik aracı", TERIM[b.tip], [], { turBit: b.bit != null && b.bit !== b.bas ? b.bit : null }));
      } else if (b.tip === "RED") { out.push(olay(b.bas, "RED", "Kırmızı bayrak", TERIM.RED, [])); }
      else if (b.tip === "RESUMED") { out.push(olay(b.bas, "RESUMED", "Yarış yeniden başladı", "Race Control seansın yeniden başladığını bildirdi.", [])); }
    });

    // PİT
    var liderPit = {};      // tur → pit yapan lider (liderlik değişimi pit kartına katlanır)
    var pitKart = {};
    pitler.forEach(function (p) {
      var once = S && S[p.tur - 1] ? S[p.tur - 1][p.id] : (p.tur === 1 ? grid[p.id] : null);
      var sonra = S && S[p.tur + 1] ? S[p.tur + 1][p.id] : null;
      if (!aktif(P, p.id, p.tur + 1)) { sonra = null; }
      var onemli = (once != null && once <= 3) || (sonra != null && sonra <= 3) || p.id === fav;      // lider/podyum ya da favori
      if (once === 1) { liderPit[p.tur] = p.id; }
      var ls = stint[p.id] || [], yeni = ls.filter(function (s) { return s.bas === p.tur || s.bas === p.tur + 1; })[0], eski = yeni ? ls[ls.indexOf(yeni) - 1] : null;
      var lastik = yeni && yeni.lastik && eski && eski.lastik ? eski.lastik + " → " + yeni.lastik : null;
      var x = P.id[p.id];
      var govde = (once != null ? pdan(once) + " pit yaptı" : "Pit yaptı") + (sonra != null ? ", piste " + pd(sonra) + " döndü" : "") + "." + (lastik ? " " + lastik : "");
      (pitKart[p.tur] = pitKart[p.tur] || []).push({ id: p.id, onemli: onemli, govde: govde, metin: x.soyad + " " + (once != null ? govde : "pit yaptı" + govde.slice(9)), once: once });
    });
    Object.keys(pitKart).map(Number).sort(function (a, b) { return a - b; }).forEach(function (t) {
      var l = pitKart[t], sec = l.filter(function (x) { return x.onemli; }).sort(function (a, b) { return (a.once || 99) - (b.once || 99); });
      var sc = bayrakAktif(bay, t, "SC") ? " (güvenlik aracı sırasında)" : (bayrakAktif(bay, t, "VSC") ? " (VSC sırasında)" : "");
      if (l.length >= 4) {
        if (!sec.length && !sc) { return; }                                                    // önemli pilot yok, bayrak yok: döngü gürültüsü
        out.push(olay(t, "PIT", l.length + " pilot pite girdi" + sc, "", sec.slice(0, 4).map(function (x) { return x.id; }), { satirlar: sec.slice(0, 4).map(function (x) { return x.metin; }), grup: l.length }));
      } else {
        sec.forEach(function (x) { out.push(olay(t, "PIT", P.id[x.id].soyad + " pite girdi" + sc, x.govde, [x.id])); });
      }
    });

    // POZİSYON
    var aday = [];
    if (S) {
      // L = 1: grid → ilk tur sonu (lider değişimi START kartında). L = N atlanır: resmî sonuç cezaları içerir; FINISH kartı anlatır.
      for (var L = 1; L < N; L++) {
        var A = L === 1 ? grid : S[L - 1], B = S[L]; if (!A || !B) { continue; }
        var pitPencere = (pitSay[L] || 0) + (pitSay[L - 1] || 0) + (pitSay[L - 2] || 0);
        var gurultu = pitPencere >= 4;                                   // pit döngüsü: ilk 10 / büyük değişim kartı yok
        var la = liderOf(A), lb = liderOf(B);
        if (L > 1 && lb && la && lb !== la && aktif(P, lb, L)) {
          if (liderPit[L] === la || liderPit[L - 1] === la || (pitTur[la] && (pitTur[la][L] || pitTur[la][L - 1]))) {
            var pk = out.filter(function (o) { return o.tip === "PIT" && (o.tur === L || o.tur === L - 1) && o.pilotlar.indexOf(la) >= 0; })[0];
            if (pk) { (pk.satirlar = pk.satirlar || (pk.aciklama ? [pk.aciklama] : [])).push(P.id[lb].soyad + " liderliğe geçti."); if (pk.pilotlar.indexOf(lb) < 0) { pk.pilotlar.push(lb); } continue; }
          }
          aday.push({ tur: L, tip: "LIDER", ids: [lb], metin: [P.id[lb].soyad + " " + pdan(A[lb]) + " P1'e yükseldi."], onem: ONEM.LIDER });
        }
        var gir = { PODYUM: [], ILK10: [] }, cik = { PODYUM: [], ILK10: [] }, buyuk = [];
        Object.keys(B).forEach(function (id) {
          var a = A[id], b = B[id]; if (a == null || b == null || a === b || !aktif(P, id, L)) { return; }
          if (pitTur[id] && (pitTur[id][L] || pitTur[id][L - 1])) { return; }          // pit kaynaklı: pit kartında
          if (id === lb && la !== lb) { return; }
          if (L === 1 && id === lb) { return; }
          if (a > 3 && b <= 3) { gir.PODYUM.push(id); } else if (a <= 3 && b > 3) { cik.PODYUM.push(id); }
          else if (!gurultu && a > 10 && b <= 10) { gir.ILK10.push(id); } else if (!gurultu && a <= 10 && b > 10) { cik.ILK10.push(id); }
          else if (!gurultu && Math.abs(a - b) >= 3 && (b > a || pitPencere < 2)) { buyuk.push(id); }   // başkalarının pitiyle "yükselme" sayılmaz
        });
        ["PODYUM", "ILK10"].forEach(function (t) {
          if (!gir[t].length && !cik[t].length) { return; }
          var ya = t === "PODYUM" ? "podyuma" : "ilk 10'a", da = t === "PODYUM" ? "podyumdan" : "ilk 10'dan";
          var m = gir[t].map(function (id) { return P.id[id].soyad + " " + ya + " girdi (" + pd(A[id]) + " → " + pd(B[id]) + ")."; })
            .concat(cik[t].map(function (id) { return P.id[id].soyad + " " + da + " çıktı (" + pd(A[id]) + " → " + pd(B[id]) + ")."; }));
          aday.push({ tur: L, tip: t, ids: gir[t].concat(cik[t]), metin: m, onem: ONEM[t] });
        });
        buyuk.forEach(function (id) {
          var d = A[id] - B[id];
          aday.push({ tur: L, tip: "BUYUK", ids: [id], metin: [P.id[id].soyad + " bir turda " + Math.abs(d) + " sıra " + (d > 0 ? "yükseldi" : "geriledi") + " (" + pd(A[id]) + " → " + pd(B[id]) + ")."], onem: ONEM.BUYUK + Math.abs(d) });
        });
      }
    }
    aday.sort(function (a, b) { return b.onem - a.onem || a.tur - b.tur; }).slice(0, EN_COK_POZ).forEach(function (a) {
      var bas2 = a.tip === "LIDER" ? P.id[a.ids[0]].soyad + " liderliğe geçti" : a.tip === "PODYUM" ? "Podyum sırası değişti" : a.tip === "ILK10" ? "İlk 10 değişti" : P.id[a.ids[0]].soyad + " " + (/yükseldi/.test(a.metin[0]) ? "yükseldi" : "geriledi");
      out.push(olay(a.tur, a.tip, bas2, a.metin.length === 1 ? a.metin[0] : "", a.ids, a.metin.length > 1 ? { satirlar: a.metin } : null));
    });

    // DNF (yalnız "R": sınıflandırılmadı / yarıştan çekildi). Sebep yazılmaz.
    ids.forEach(function (id) {
      var x = P.id[id]; if (!x.cekildi) { return; }
      var t = Math.min(N, x.tur + 1), son = S && S[x.tur] && x.tur >= 1 ? S[x.tur][id] : null;
      out.push(olay(t, "DNF", x.soyad + " yarışı tamamlayamadı", x.tur + " tur tamamladı" + (son ? "; son kayıtlı sırası " + pd(son) : "") + ".", [id]));
    });

    // FINISH
    if (kazanan) {
      var podyum = ids.filter(function (id) { return P.id[id].bitis && P.id[id].bitis <= 3; }).sort(function (a, b) { return P.id[a].bitis - P.id[b].bitis; });
      var fs = ["Podyum: " + adlar(P, podyum).join(" · ")];
      var yuk = ids.filter(function (id) { var x = P.id[id]; return x.siniflandi && x.grid && x.bitis; }).map(function (id) { return { id: id, d: P.id[id].grid - P.id[id].bitis }; })
        .sort(function (a, b) { return b.d - a.d; })[0];
      if (yuk && yuk.d >= 3) { fs.push("Gridden en çok yükselen: " + P.id[yuk.id].soyad + " (" + pd(P.id[yuk.id].grid) + " → " + pd(P.id[yuk.id].bitis) + ", +" + yuk.d + ")"); }
      ids.filter(function (id) { var x = P.id[id]; return x.pitYolu && x.siniflandi && x.bitis && x.bitis <= 10; }).forEach(function (id) { fs.push(P.id[id].soyad + " pit yolundan başlayıp " + pd(P.id[id].bitis) + " bitirdi"); });
      var kg = P.id[kazanan];
      out.push(olay(N, "FINISH", kg.soyad + " kazandı", kg.grid ? "Yarışa " + pdan(kg.grid) + " başladı." : "", podyum, { satirlar: fs }));
    }

    // ŞAMPİYONLUK (yalnız sampiyonluk-durum.js çıktıları)
    var so = g.samp && g.samp.once, ss = g.samp && g.samp.sonra;
    if (ss && ss.durum && ss.durum !== "yok") {
      var cs = [], bas3, ton = ss.durum === "belli" && (!so || so.durum !== "belli") ? "sampiyon" : null;
      if (ton) { bas3 = ss.sampiyon.ad + " " + ss.sezon + " Dünya Şampiyonu"; cs.push("Matematiksel olarak belli: fark " + ss.fark + ", kalan en fazla " + ss.kalanMaks + " puan."); }
      else if (so && so.durum !== "yok" && so.lider && so.lider.id !== ss.lider.id) { bas3 = "Şampiyonada liderlik değişti"; cs.push(so.lider.soyad + " → " + ss.lider.soyad + " (" + ss.lider.puan + " puan, fark " + ss.fark + ")."); }
      else if (so && so.durum !== "yok" && so.ikinci && ss.ikinci && so.ikinci.id === ss.ikinci.id && so.fark !== ss.fark) {
        bas3 = "Şampiyonada fark " + (ss.fark > so.fark ? "açıldı" : "kapandı"); cs.push(ss.lider.soyad + " – " + ss.ikinci.soyad + ": " + so.fark + " → " + ss.fark + " puan.");
      } else { bas3 = "Şampiyona: lider " + ss.lider.soyad; cs.push(ss.lider.soyad + " " + ss.lider.puan + " puan; " + ss.ikinci.soyad + " ile fark " + ss.fark + "."); }
      if (!ton && ss.durum === "acik" && so && so.durum === "acik" && ss.adaySayisi < so.adaySayisi) { cs.push("Şampiyonluk şansı olan pilot sayısı " + so.adaySayisi + " → " + ss.adaySayisi + "."); }
      if (ss.durum === "belli" && !ton) { cs.push(ss.manset + "."); }
      out.push(olay(N, "SAMPIYONLUK", bas3, "", [ss.lider.id], { satirlar: cs, ton: ton || "" }));
    }

    out.forEach(function (o, i) { o._i = i; o.fav = !!(fav && o.pilotlar.indexOf(fav) >= 0); });
    out.sort(function (a, b) { return (a.tur - b.tur) || (SIRA[a.tip] - SIRA[b.tip]) || (a._i - b._i); });
    out.forEach(function (o) { delete o._i; });
    var sinirli = !S && !(g.rc && g.rc.length);
    return { olaylar: out, sinirli: sinirli, kaynak: { pozisyon: !!S, rc: !!(g.rc && g.rc.length), pit: pitler.length > 0, stint: Object.keys(stint).length > 0 }, toplamTur: N };
  }

  var API = { kur: kur, _pdan: pdan, _anlikSiralar: anlikSiralar, _bayraklar: bayraklar, TERIM: TERIM, EN_COK_POZ: EN_COK_POZ };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
  if (kok) { kok.YarisHikaye = API; }
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
