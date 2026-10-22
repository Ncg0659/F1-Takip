// Race Feed motoru (Bluesky canlı kaynakları).
// Ücretli servis yok: anahtar kelime, regex ve Türkçe şablonlarla çalışır.
// v2: cümle bazlı parçalar, tek posttan birden fazla olay, sıralama çıkarma, RACE_STATUS.
(function (kok) {
  "use strict";

  const MOTOR_SURUM = 3;   // her çeviri/şablon değişikliğinde artır: saklı olaylar özgün metinden yeniden çevrilir

  function ayar() {
    return Object.assign({ pollSaniye: 30, oncePencereDk: 60, sonraPencereDk: 60, maxYarisSaat: 4, maxOlay: 200 }, kok.NOTLAR_AYAR || {});
  }

  // ---------- Zaman penceresi ----------
  function pencere(basla, simdi) {
    const a = ayar();
    const s = simdi || new Date();
    const bas = new Date(basla.getTime() - a.oncePencereDk * 60000);
    const bit = new Date(basla.getTime() + a.maxYarisSaat * 3600000 + a.sonraPencereDk * 60000);
    return { bas: bas, bit: bit, aktif: s >= bas && s <= bit };
  }

  // ---------- Yardımcılar ----------
  function sade(s) {   // aksanları kaldır, uzunluğu koru
    return Array.from(s).map(function (ch) { return ch.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }).join("");
  }
  function kacis(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  // ---------- Pilot tespiti: metindeki pilotları §0§, §1§ gibi işaretlere çevirir ----------
  function tokenle(metin, pilotlar) {
    const duz = sade(metin);
    const bulunan = [];
    pilotlar.forEach(function (p, idx) {
      const aile = sade(p.family || "");
      if (!aile) { return; }
      const kaliplar = [];
      if (p.given) { kaliplar.push(kacis(sade(p.given)) + "\\s+" + kacis(aile)); }
      kaliplar.push(kacis(aile));
      const re = new RegExp("(^|[^A-Za-z0-9_])(" + kaliplar.join("|") + ")(?![A-Za-z0-9_])", "ig");
      let m;
      while ((m = re.exec(duz)) !== null) {
        bulunan.push({ bas: m.index + m[1].length, son: m.index + m[1].length + m[2].length, idx: idx });
      }
      if (p.code && /^[A-Z]{3}$/.test(p.code)) {   // 3 harfli kodlar sadece BÜYÜK harfle (GAS, BOT gibi kelimeler karışmasın)
        const rc = new RegExp("(^|[^A-Za-z0-9_])(" + p.code + ")(?![A-Za-z0-9_])", "g");
        let c;
        while ((c = rc.exec(metin)) !== null) {
          bulunan.push({ bas: c.index + c[1].length, son: c.index + c[1].length + c[2].length, idx: idx });
        }
      }
    });
    bulunan.sort(function (a, b) { return a.bas - b.bas || (b.son - b.bas) - (a.son - a.bas); });
    let tok = "", imle = 0;
    const mentions = [];
    bulunan.forEach(function (b) {
      if (b.bas < imle) { return; }
      tok += metin.slice(imle, b.bas) + "§" + mentions.length + "§";
      mentions.push(b.idx);
      imle = b.son;
    });
    tok += metin.slice(imle);
    return { tok: tok, mentions: mentions };
  }

  // ---------- Türkçe ekler (ünlü uyumu + yabancı isim okunuşları) ----------
  const UNLU_KUMESI = "aıeioöuü";
  const BELIRTME_UNLU = { "a": "ı", "ı": "ı", "e": "i", "i": "i", "o": "u", "u": "u", "ö": "ü", "ü": "ü" };
  // h: uyum için kullanılacak ünlü, sesli: ek eklerken kaynaştırma harfi gerekir mi, sert: -te/-ta
  const ISIM_OZEL = { "hamilton": { h: "ı" }, "russell": { h: "ı" }, "lawson": { h: "ı" },
                      "gasly": { h: "i", sesli: true }, "sainz": { h: "ı" } };
  function sesBilgi(ad) {
    const k = sade(ad).toLowerCase();
    const o = ISIM_OZEL[k] || {};
    let h = o.h;
    if (!h) {
      h = "e";
      for (let i = ad.length - 1; i >= 0; i--) {
        if (UNLU_KUMESI.indexOf(ad[i].toLowerCase()) >= 0) { h = ad[i].toLowerCase(); break; }
      }
    }
    const son = ad[ad.length - 1].toLowerCase();
    return {
      h: h,
      sesli: o.sesli !== undefined ? o.sesli : UNLU_KUMESI.indexOf(son) >= 0,
      sert: o.sert !== undefined ? o.sert : "fstkchp".indexOf(sade(son)) >= 0
    };
  }
  function arkaMi(h) { return "aıou".indexOf(h) >= 0; }
  function belirtmeEki(ad) { const b = sesBilgi(ad); return ad + "'" + (b.sesli ? "y" : "") + BELIRTME_UNLU[b.h]; }
  function yonelmeEki(ad) { const b = sesBilgi(ad); return ad + "'" + (b.sesli ? "y" : "") + (arkaMi(b.h) ? "a" : "e"); }
  function bulunmaEki(ad) { const b = sesBilgi(ad); return ad + "'" + (b.sert ? "t" : "d") + (arkaMi(b.h) ? "a" : "e"); }
  function tamlayanEki(ad) { const b = sesBilgi(ad); return ad + "'" + (b.sesli ? "n" : "") + BELIRTME_UNLU[b.h] + "n"; }

  const P_YON = { 1: "e", 2: "ye", 3: "e", 4: "e", 5: "e", 6: "ya", 7: "ye", 8: "e", 9: "a", 10: "a",
                  11: "e", 12: "ye", 13: "e", 14: "e", 15: "e", 16: "ya", 17: "ye", 18: "e", 19: "a", 20: "ye" };
  const P_BUL = { 1: "de", 2: "de", 3: "te", 4: "te", 5: "te", 6: "da", 7: "de", 8: "de", 9: "da", 10: "da",
                  11: "de", 12: "de", 13: "te", 14: "te", 15: "te", 16: "da", 17: "de", 18: "de", 19: "da", 20: "de" };
  function pYonelme(n) { return "P" + n + "'" + (P_YON[n] || "e"); }
  function pBulunma(n) { return "P" + n + "'" + (P_BUL[n] || "de"); }

  const ORD = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
                eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17,
                eighteenth: 18, nineteenth: 19, twentieth: 20 };
  const ORD_RE = Object.keys(ORD).join("|");
  function poz(s) {   // "P7" / "seventh" -> 7
    const m = /^p(\d{1,2})$/i.exec(s);
    if (m) { const n = parseInt(m[1], 10); return n >= 1 && n <= 20 ? n : null; }
    return ORD[s.toLowerCase()] || null;
  }
  const SAYI_EN = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const SAYI_TR = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz", "on"];
  function sayiTr(x) {
    const n = SAYI_EN[String(x).toLowerCase()] || parseInt(x, 10);
    return n >= 1 && n <= 10 ? SAYI_TR[n] : String(n);
  }

  const LASTIK = { "soft": "yumuşak", "medium": "orta", "hard": "sert", "intermediate": "intermediate", "inter": "intermediate", "wet": "yağmur" };
  function lastikAdi(k) {
    const x = k.toLowerCase().replace(/s$/, "");
    return LASTIK[x.indexOf("intermediate") === 0 ? "intermediate" : x] || null;
  }

  const GP_ADLARI = { "bahrain": "Bahreyn", "saudi arabian": "Suudi Arabistan", "australian": "Avustralya", "japanese": "Japonya",
    "chinese": "Çin", "miami": "Miami", "emilia romagna": "Emilia-Romagna", "monaco": "Monako", "spanish": "İspanya", "madrid": "Madrid",
    "canadian": "Kanada", "austrian": "Avusturya", "british": "Britanya", "belgian": "Belçika", "hungarian": "Macaristan",
    "dutch": "Hollanda", "italian": "İtalya", "azerbaijan": "Azerbaycan", "singapore": "Singapur", "united states": "ABD",
    "us": "ABD", "mexico city": "Meksika Şehri", "mexican": "Meksika", "sao paulo": "Sao Paulo", "brazilian": "Brezilya",
    "las vegas": "Las Vegas", "qatar": "Katar", "abu dhabi": "Abu Dabi", "malaysian": "Malezya", "turkish": "Türkiye" };
  function gpAdi(ham) { const k = sade(ham).toLowerCase().trim(); return GP_ADLARI[k] || ham.trim(); }

  // ---------- Şablonlar ----------
  // Her şablon bir PARÇA üretir. Bir cümlede birden fazla parça çıkabilir.
  //   cat: kategori | belirsizIzinli: "?" veya şüpheli cümlede de çalışabilir | belirsiz: olayı "doğrulanmadı" yapar
  //   devam: öznesi önceki parçayla aynı (aynı olaya eklenir) | oncul: sonraki parçanın başına eklenir
  const D = "§(\\d+)§";
  const TYRE_RE = "(softs?|mediums?|hards?|intermediates?|inters?|wets?)";
  function T(o) { return o; }
  const SABLONLAR = [
    // --- POSITION: geçişler ---
    T({ cat: "POSITION", kalip: D + "\\s+(?:is |has |gets |got |goes |went )?(?:gone )?through on\\s+" + D,
        yap: function (m, c) { return c.ad(m[1]) + ", " + c.acc(m[2]) + " geçti" + (c.postP ? " ve " + pYonelme(c.postP) + " yükseldi" : "") + "."; } }),
    T({ cat: "POSITION", kalip: D + "\\s+(?:passes|passed|overtakes|overtook)\\s+" + D,
        yap: function (m, c) { return c.ad(m[1]) + ", " + c.acc(m[2]) + " geçti" + (c.postP ? " ve " + pYonelme(c.postP) + " yükseldi" : "") + "."; } }),
    T({ cat: "POSITION", kalip: D + "\\s+(?:is |has |gets |got |goes |went )?(?:gone )?past\\s+" + D,
        yap: function (m, c) { return c.ad(m[1]) + ", " + c.acc(m[2]) + " geçti" + (c.postP ? " ve " + pYonelme(c.postP) + " yükseldi" : "") + "."; } }),
    T({ cat: "POSITION", kalip: D + "\\s+takes P(\\d{1,2}) from\\s+" + D,
        yap: function (m, c) { return c.ad(m[1]) + ", " + c.acc(m[3]) + " geçerek " + pYonelme(parseInt(m[2], 10)) + " yükseldi."; } }),
    T({ cat: "POSITION", kalip: D + "\\s+(?:goes|went|going) (?:around|round) the (outside|inside) of\\s+" + D + "(?:\\s+(?:at|in|into) turn (\\d+))?",
        yap: function (m, c) {
          return c.ad(m[1]) + ", " + c.acc(m[3]) + (m[4] ? " " + m[4] + ". virajın " : " ") + (m[2].toLowerCase() === "outside" ? "dışından" : "içinden") + " geçti.";
        } }),
    T({ cat: "POSITION", kalip: D + "\\s+(?:takes|has taken|takes over|moves into|moved into)\\s+(?:the )?(?:lead|P1)\\b",
        yap: function (m, c) { return c.ad(m[1]) + " liderliği aldı."; } }),
    T({ cat: "POSITION", kalip: D + "\\s+(?:moves into|moved into|takes|has taken)\\s+P(\\d{1,2})\\b(?!\\s+from)",
        yap: function (m, c) { return c.ad(m[1]) + ", " + pYonelme(parseInt(m[2], 10)) + " yükseldi."; } }),
    // --- TECHNICAL ---
    T({ cat: "TECHNICAL", kalip: D + "\\s+(?:has |is )?stopped\\b(?! in the rain)",
        yap: function (m, c) { return c.ad(m[1]) + " pist üzerinde durdu."; } }),
    T({ cat: "TECHNICAL", kalip: D + "\\s+(?:is out(?: of the race)?|has retired|retires|retired)\\b",
        yap: function (m, c) { return c.ad(m[1]) + " yarış dışı kaldı."; } }),
    T({ cat: "TECHNICAL", kalip: D + "\\s+(?:has |reports )?(?:an? )?(engine|gearbox|brake|hydraulic)s? (?:problem|issue|failure|trouble)",
        yap: function (m, c) {
          return c.ad(m[1]) + " için " + { engine: "motor", gearbox: "şanzıman", brake: "fren", hydraulic: "hidrolik" }[m[2].toLowerCase()] + " sorunu bildiriliyor.";
        } }),
    T({ cat: "TECHNICAL", belirsizIzinli: true, belirsiz: true,
        kalip: D + "\\s+(?:was|looked|seemed|is|looks|seems)\\s+(?:very |really |a bit |rather |quite )?(?:odd|strange|slow|off|unwell)\\W+(?:like|maybe|perhaps|possibly)\\s+(?:a |an )?(brake|engine|gearbox|power unit|hydraulic|mechanical)\\s+(?:issue|problem|failure|trouble)",
        yap: function (m, c) {
          const tr = { "brake": "fren", "engine": "motor", "gearbox": "şanzıman", "power unit": "güç ünitesi", "hydraulic": "hidrolik", "mechanical": "mekanik" }[m[2].toLowerCase()];
          return c.loc(m[1]) + " " + tr + " problemi olabileceğinden şüpheleniliyor.";
        } }),
    // --- INCIDENT ---
    T({ cat: "INCIDENT", kalip: D + "\\s+(?:is|goes|went|has gone|was)\\s+off(?:\\s+the\\s+track)?(?:\\s+(?:at|into|in)\\s+turn\\s+(\\d+))?\\b",
        yap: function (m, c) { return c.ad(m[1]) + " " + (m[2] ? m[2] + ". virajda " : "") + "pist dışına çıktı."; } }),
    T({ cat: "INCIDENT", devam: true,
        kalip: "(?:he|she) went flying into turn (\\d+) and (?:just )?avoided (?:running|crashing|hitting|smashing) into the back of\\s+" + D,
        yap: function (m, c) { return m[1] + ". virajda " + c.dat(m[2]) + " çarpmaktan son anda kaçındı."; } }),
    T({ cat: "INCIDENT", kalip: D + "\\s+(?:has )?(?:spun|spins)\\b", yap: function (m, c) { return c.ad(m[1]) + " spin attı."; } }),
    T({ cat: "INCIDENT", kalip: D + "\\s+(?:has )?(?:crashed|crashes)\\b", yap: function (m, c) { return c.ad(m[1]) + " kaza yaptı."; } }),
    T({ cat: "INCIDENT", kalip: D + "\\s+and\\s+" + D + "\\s+(?:make |made |have |had )?(?:contact|collide|collided|touch)",
        yap: function (m, c) { return c.ad(m[1]) + " ve " + c.ad(m[2]) + " arasında temas oldu."; } }),
    T({ cat: "INCIDENT", kalip: "contact between\\s+" + D + "\\s+and\\s+" + D,
        yap: function (m, c) { return c.ad(m[1]) + " ve " + c.ad(m[2]) + " arasında temas oldu."; } }),
    T({ cat: "INCIDENT", kalip: D + "\\s+(?:has|with|picks up|picked up|suffers)\\s+(?:some )?(?:front wing )?damage",
        yap: function (m, c) { return /front wing/i.test(c.tok) ? c.ad(m[1]) + " ön kanadında hasar aldı." : c.ad(m[1]) + " araçta hasar aldı."; } }),
    T({ cat: "INCIDENT", kalip: D + "\\s+(?:has |picks up |picked up |suffers )?(?:a )?puncture",
        yap: function (m, c) { return c.gen(m[1]) + " lastiği patladı."; } }),
    // --- RESTART / START ---
    T({ cat: "RESTART", kalip: "restart order\\W*((?:§\\d+§[\\s,]*(?:and\\s+)?)+)",
        yap: function (m, c) { return "Yeniden start sıralaması: " + c.liste(m[1]) + "."; } }),
    T({ cat: "RESTART", kalip: "restart(?:s|ing)? (?:at|on) the end of lap (\\d+)", yap: function (m) { return "Yarış " + m[1] + ". turun sonunda yeniden başlayacak."; } }),
    T({ cat: "RESTART", kalip: "restart(?:s|ing)? (?:at|on) lap (\\d+)", yap: function (m) { return "Yarış " + m[1] + ". turda yeniden başlayacak."; } }),
    T({ cat: "RESTART", kalip: "restart(?:s|ing)? (?:at the end of|on) this lap", yap: function () { return "Yarış bu turun sonunda yeniden başlayacak."; } }),
    T({ cat: "START", kalip: "lights out|away they go|race is under ?way", yap: function () { return "Start verildi, yarış başladı."; } }),
    T({ cat: "START", kalip: "formation lap (?:is )?(?:underway|starting|begins|has started)", yap: function () { return "Formasyon turu başladı."; } }),
    T({ cat: "START", kalip: D + "\\s+(?:gets|got|made|makes|has) (?:a |an )?(?:great|good|fantastic|brilliant|excellent) (?:start|launch|getaway)",
        yap: function (m, c) { return c.ad(m[1]) + " iyi bir kalkış yaptı."; } }),
    // --- VSC / SAFETY CAR / RED FLAG ---
    T({ cat: "VSC", kalip: "(?:virtual safety car|vsc)\\s+(?:is |has been )?(?:out|deployed)", yap: function () { return "Sanal Safety Car (VSC) devrede."; } }),
    T({ cat: "VSC", kalip: "(?:virtual safety car|vsc)\\s+(?:is )?(?:ending|over|ends)", yap: function () { return "VSC sona eriyor."; } }),
    T({ cat: "SAFETY_CAR", kalip: "safety car\\s+(?:is |has been )?(?:out|deployed|coming out)", kosul: function (t) { return !/virtual/i.test(t); },
        yap: function () { return "Safety Car çıktı."; } }),
    T({ cat: "SAFETY_CAR", kalip: "safety car\\s+(?:in this lap|coming in|is in|in at the end of this lap)", kosul: function (t) { return !/virtual/i.test(t); },
        yap: function () { return "Safety Car bu tur pite giriyor."; } }),
    T({ cat: "RED_FLAG", kalip: "red flag(?:s)?\\s+(?:is |has been |have been )?(?:out|shown|waved|deployed|thrown|called)|(?:race control|stewards|they)\\s+(?:have |has )?(?:shown|thrown|called|waved)\\s+(?:a |the )?red flag",
        yap: function () { return "Kırmızı bayrak çıktı, yarış durduruldu."; } }),
    // --- INVESTIGATION / PENALTY ---
    T({ cat: "INVESTIGATION", kalip: "(?:is|are|being|under|now)\\s+investigat\\w*|investigating|under investigation",
        kosul: function (t) { return !/investigation\s+(?:is\s+)?(?:over|complete|concluded)/i.test(t); },
        yap: function (m, c) { const a = c.adlar(); return a ? a + " ile ilgili olay yarış kontrolü tarafından inceleniyor." : "Olay yarış kontrolü tarafından inceleniyor."; } }),
    T({ cat: "INVESTIGATION", kalip: "(?:stewards?|race control)\\b[^.!?§]{0,30}(?:looking at|have noted|has noted|noted)",
        yap: function (m, c) { const a = c.adlar(); return a ? a + " ile ilgili olay yarış kontrolü tarafından inceleniyor." : "Olay yarış kontrolü tarafından inceleniyor."; } }),
    T({ cat: "PENALTY", kalip: D + "\\s+(?:has been given|has been handed|has been hit with|gets|got|receives|is given|is handed|has)\\s+an?\\s+(\\d+)[- ]?second(?:s)?(?: time)? penalty",
        yap: function (m, c) { return c.ad(m[1]) + " " + m[2] + " saniyelik ceza aldı."; } }),
    T({ cat: "PENALTY", kalip: D + "\\s+(?:gets|got|has|receives|is given|has been given)\\s+an?\\s+(drive-?through|stop-?go)(?: penalty)?",
        yap: function (m, c) { return c.ad(m[1]) + " " + (/drive/i.test(m[2]) ? "drive-through" : "stop-go") + " cezası aldı."; } }),
    T({ cat: "PENALTY", kalip: D + "\\s+(?:has been|is) penali[sz]ed", yap: function (m, c) { return c.ad(m[1]) + " ceza aldı."; } }),
    // --- RESULT ---
    T({ cat: "RESULT", kalip: D + "\\s+wins\\s+the\\s+([A-Za-z][A-Za-z\\s\\-]{1,30}?)\\s+(?:Grand Prix|GP)\\b(?:\\s+in\\s+[A-Za-z]+)?",
        yap: function (m, c) { return c.ad(m[1]) + " " + gpAdi(m[2]) + " GP'yi kazandı."; } }),
    T({ cat: "RESULT", kalip: D + "\\s+(?:wins|has won)\\b(?!\\s+(?:back|the (?:position|battle|duel|fight|place|title|championship)|an? ))",
        yap: function (m, c) { return c.ad(m[1]) + " yarışı kazandı."; } }),
    T({ cat: "RESULT", kalip: D + "\\s+takes the (?:chequered|checkered) flag", yap: function (m, c) { return c.ad(m[1]) + " yarışı kazandı."; } }),
    T({ cat: "RESULT", kalip: D + "\\s+completes the podium", yap: function (m, c) { return c.ad(m[1]) + " podyumu tamamladı."; } }),
    // --- PIT / TYRE ---
    T({ cat: "PIT", kalip: D + "\\s+(?:pits|has pitted|pitted|is pitting|boxes|has boxed|is in the pits|dives into the pits|comes into the pits|is into the pits)(?: for " + TYRE_RE + ")?",
        yap: function (m, c) { const l = m[2] ? lastikAdi(m[2]) : null; return c.ad(m[1]) + " pite girdi" + (l ? "; " + l + " lastik taktı" : "") + "."; } }),
    T({ cat: "TYRE", kalip: D + "\\s+(?:is )?on " + TYRE_RE + "\\b",
        yap: function (m, c) { const l = lastikAdi(m[2]); return l ? c.ad(m[1]) + " " + l + " lastikle devam ediyor." : null; } }),
    // --- WEATHER ---
    T({ cat: "WEATHER", kalip: "(?:started|starting|begun|begins) to rain|it'?s raining|rain (?:has )?(?:started|begun|arrived)|rain is (?:falling|starting|arriving)",
        yap: function () { return "Pistte yağmur başladı."; } }),
    // --- RACE_STATUS ---
    T({ cat: "RACE_STATUS", kalip: "^\\W*(?:and\\s+)?(?:it'?s\\s+)?(?:the\\s+)?(?:final|last)\\s+lap\\b", yap: function () { return "Son tura girildi."; } }),
    T({ cat: "RACE_STATUS", oncul: true, kalip: "\\b(one|two|three|four|five|six|seven|eight|nine|ten|\\d+)\\s+laps?\\s+(?:to go|remaining|left)\\b",
        yap: function (m) { return "Bitime " + sayiTr(m[1]) + " tur kala"; } }),
    T({ cat: "RACE_STATUS", kalip: "(?:the )?top (two|three|five|ten)\\s+(?:look|looks|are|is)\\s+set",
        yap: function (m) { return "İlk " + { two: "iki", three: "üç", five: "beş", ten: "on" }[m[1].toLowerCase()] + " sıra büyük ölçüde belli."; } }),
    T({ cat: "RACE_STATUS", kalip: D + "\\s+(?:has |have )?(?:dropped|pulled|moved)\\s+" + D + "\\s+out of\\s+(?:the\\s+)?(overtake|overtaking|DRS)\\s+range",
        yap: function (m, c) { return c.ad(m[1]) + ", " + c.acc(m[2]) + (/drs/i.test(m[3]) ? " DRS mesafesinin" : " geçiş mesafesinin") + " dışına çıkardı."; } }),
    T({ cat: "RACE_STATUS", kalip: D + "\\s+(?:is |are )?(?:catching|closing in on|closing on|closing)\\s+" + D,
        yap: function (m, c) { return c.ad(m[1]) + ", " + c.dat(m[2]) + " yaklaşıyor."; } }),
    T({ cat: "RACE_STATUS", kalip: D + "\\s+(?:is |are )?(?:holding off|holds off)\\s+" + D,
        yap: function (m, c) { return c.ad(m[1]) + ", " + c.acc(m[2]) + " arkasında tutuyor."; } }),
    T({ cat: "RACE_STATUS", kalip: D + "\\s+(?:is |are )?(?:trying to|attempting to)\\s+hold off\\s+" + D + "(?:\\s+for\\s+P(\\d{1,2}))?",
        yap: function (m, c) { return c.ad(m[1]) + ", " + (m[3] ? "P" + m[3] + " için " : "") + c.acc(m[2]) + " arkasında tutmaya çalışıyor."; } }),
    T({ cat: "RACE_STATUS", kalip: D + "\\s+(?:is |are )?(?:trying to|attempting to|looking to)\\s+(?:get past|pass|overtake)\\s+" + D,
        yap: function (m, c) { return c.ad(m[1]) + ", " + c.acc(m[2]) + " geçmeye çalışıyor."; } }),
    T({ cat: "RACE_STATUS", belirsizIzinli: true, kalip: "can\\s+" + D + "\\s+(?:find a way past|get past|pass|overtake)\\s+" + D + "(?:\\s+too)?",
        yap: function (m, c) { return c.ad(m[1]) + ", " + c.acc(m[2]) + " geçmeye çalışıyor."; } }),
    T({ cat: "RACE_STATUS", kalip: D + "\\s+(?:leads|is ahead of)\\s+" + D + "\\s+by\\s+(\\d+(?:\\.\\d+)?)\\s+(?:seconds?|s)\\b",
        yap: function (m, c) { return c.ad(m[1]) + ", " + c.gen(m[2]) + " " + m[3].replace(".", ",") + " saniye önünde."; } }),
    T({ cat: "RACE_STATUS", kalip: D + "\\s+(?:is\\s+)?(?:right behind|on the tail of|on the gearbox of)\\s+" + D,
        yap: function (m, c) { return c.ad(m[1]) + ", " + c.gen(m[2]) + " hemen arkasında."; } })
  ];
  SABLONLAR.forEach(function (s) { s.kaynak = s.kalip; });

  function eslesmeler(sablon, metin) {
    const re = new RegExp(sablon.kalip, "ig");
    const liste = [];
    let m;
    while ((m = re.exec(metin)) !== null) {
      liste.push(m);
      if (m[0].length === 0) { re.lastIndex++; }
    }
    return liste;
  }

  // ---------- Cümle bölme ----------
  function cumleBol(tok) {
    return tok.split(/(?<=[.!?…])\s+|\s*⏎\s*/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });
  }

  // ---------- Belirsizlik koruması (cümle bazlı) ----------
  const BELIRSIZ = /\b(could|might|may|maybe|possibly|possible|probably|likely|unlikely|expect(?:ed|ing)?|think|reckon|suggest\w*|rumou?r\w*|if|would|should|hoping|hope|reportedly|apparently|not|no|never|without)\b|n't|\?/i;

  // ---------- Bağlam: ad/ek yardımcıları ----------
  function baglamKur(tok, pilotlar, mentions, postTok) {
    const fam = function (i) { return pilotlar[mentions[parseInt(i, 10)]].family; };
    const pm = /\b(?:that'?s|that is|now|into|for|takes?)\s+P(\d{1,2})\b/i.exec(postTok);
    return {
      tok: tok,
      ad: fam,
      acc: function (i) { return belirtmeEki(fam(i)); },
      dat: function (i) { return yonelmeEki(fam(i)); },
      loc: function (i) { return bulunmaEki(fam(i)); },
      gen: function (i) { return tamlayanEki(fam(i)); },
      adlar: function () {
        const set = [];
        (tok.match(/§\d+§/g) || []).forEach(function (t) { const f = fam(t.replace(/§/g, "")); if (set.indexOf(f) < 0) { set.push(f); } });
        return set.join(" ve ");
      },
      liste: function (tokMetni) {
        return (tokMetni.match(/§(\d+)§/g) || []).map(function (t) { return fam(t.replace(/§/g, "")); }).join(", ");
      },
      postP: pm ? Math.min(20, parseInt(pm[1], 10)) : null
    };
  }

  // ---------- Bir cümleden parçalar topla ----------
  function parcaTopla(cumle, hedged, c) {
    const adaylar = [];
    SABLONLAR.forEach(function (s) {
      if (hedged && !s.belirsizIzinli) { return; }
      if (s.kosul && !s.kosul(cumle)) { return; }
      eslesmeler(s, cumle).forEach(function (m) {
        const cc = Object.assign({}, c, { tok: cumle });
        const metin = s.yap(m, cc);
        if (metin) {
          adaylar.push({ bas: m.index, son: m.index + m[0].length, cat: s.cat, text: metin, belirsiz: !!s.belirsiz,
                         devam: !!s.devam, oncul: !!s.oncul });
        }
      });
    });
    adaylar.sort(function (a, b) { return a.bas - b.bas || (b.son - b.bas) - (a.son - a.bas); });
    const secilen = [];
    let sonBitis = -1;
    adaylar.forEach(function (a) { if (a.bas >= sonBitis) { secilen.push(a); sonBitis = a.son; } });
    // "Bitime iki tur kala" gibi önekleri sonraki parçayla birleştir
    const sonuc = [];
    for (let i = 0; i < secilen.length; i++) {
      const p = secilen[i];
      if (p.oncul) {
        const sonraki = secilen[i + 1];
        if (sonraki) { sonuc.push({ cat: sonraki.cat, text: p.text + " " + sonraki.text, belirsiz: p.belirsiz || sonraki.belirsiz, devam: false }); i++; }
        else { sonuc.push({ cat: p.cat, text: p.text + ".", belirsiz: p.belirsiz, devam: false }); }
      } else { sonuc.push(p); }
    }
    return sonuc;
  }

  // ---------- Sıralama çıkarma: "Leclerc in P4 ahead of Hadjar", "Norris P9", "P2 for Antonelli", "seventh" ----------
  function listeYaz(oge) {
    if (oge.length <= 1) { return oge.join(""); }
    if (oge.length === 2) { return oge[0] + " ve " + oge[1]; }
    return oge.slice(0, -1).join(", ") + " ve " + oge[oge.length - 1];
  }
  function siralamaCikar(metin, c) {
    const ciftler = [];
    const gorulen = {};
    function ekle(i, p, bas, bitis, ord) { if (!gorulen[i] && p) { gorulen[i] = true; ciftler.push({ i: i, p: p, bas: bas, son: bitis, ord: ord }); } }
    const re1 = new RegExp("§(\\d+)§([^§!.?,;]{0,45}?)\\b(P\\d{1,2}|" + ORD_RE + ")\\b(?!\\s+(?:stop|pit|set|run|stint|row|time|lap|half|week))", "ig");
    let m;
    while ((m = re1.exec(metin)) !== null) {
      if (/\b(ahead|behind|past|through|on|from|after|than|by|of|for|with|and|into|round|around|vs|versus)\b/i.test(m[2])) { continue; }
      ekle(m[1], poz(m[3]), m.index, m.index + m[0].length, !/^p/i.test(m[3]));
    }
    const re2 = new RegExp("\\b(P\\d{1,2}|" + ORD_RE + ")\\s+for\\s+§(\\d+)§", "ig");
    while ((m = re2.exec(metin)) !== null) { ekle(m[2], poz(m[1]), m.index, m.index + m[0].length, !/^p/i.test(m[1])); }
    ciftler.sort(function (a, b) { return a.bas - b.bas; });
    if (!ciftler.length) { return null; }
    const ilk = ciftler[0];
    const arka = /^\s*ahead of\s+((?:§\d+§(?:\s*(?:,|and)\s*)?)+)/i.exec(metin.slice(ilk.son));
    const geride = arka ? (arka[1].match(/§(\d+)§/g) || []).map(function (t) { return c.ad(t.replace(/§/g, "")); }) : [];
    const sadecePler = ciftler.every(function (x) { return !x.ord; });
    const tekilKabul = ciftler.length === 1 && (geride.length > 0 || (sadecePler && /\b(?:is|now|in)\s+P\d/i.test(metin)));
    if (ciftler.length < 2 && !tekilKabul) { return null; }
    const parcalar = [];
    let kalan = ciftler;
    if (geride.length) {
      parcalar.push(c.ad(ilk.i) + " " + pBulunma(ilk.p) + "; arkasında " + listeYaz(geride) + " bulunuyor.");
      kalan = ciftler.slice(1);
    } else if (ciftler.length === 1) {
      parcalar.push(c.ad(ilk.i) + " " + pBulunma(ilk.p) + ".");
      kalan = [];
    }
    if (kalan.length) {
      const ogeler = kalan.map(function (x) { return c.ad(x.i) + " P" + x.p; });
      parcalar.push((ogeler.length === 2 ? ogeler.join(", ") : listeYaz(ogeler)) + ".");
    }
    return { cat: "POSITION", text: parcalar.join(" "), belirsiz: false, devam: false, siralama: true };
  }

  // ---------- Bir postu olaylara çevir ----------
  function grupla(parcalar) {
    const olaylar = [];
    parcalar.forEach(function (f) {
      const son = olaylar[olaylar.length - 1];
      const birlestir = son && (f.devam || f.cat === son.cat || (f.siralama && son.cat === "RESULT"));
      if (birlestir) { son.text += " " + f.text; son.belirsiz = son.belirsiz || f.belirsiz; }
      else { olaylar.push({ cat: f.cat, text: f.text, belirsiz: !!f.belirsiz }); }
    });
    return olaylar;
  }

  function cevirPost(tokMetin, pilotlar, mentions) {
    const postTok = tokMetin.replace(/⏎/g, " ");
    const c = baglamKur(tokMetin, pilotlar, mentions, postTok);
    const cumleler = cumleBol(tokMetin);
    const parcalar = [];
    const kalanCumleler = [];
    cumleler.forEach(function (cm) {
      const hedged = BELIRSIZ.test(cm.replace(/§\d+§/g, " X "));
      const ps = parcaTopla(cm, hedged, c);
      if (ps.length) { ps.forEach(function (p) { parcalar.push(p); }); }
      else if (!hedged) { kalanCumleler.push(cm); }
    });
    if (kalanCumleler.length) {
      const sr = siralamaCikar(kalanCumleler.join(" "), c);
      if (sr) { parcalar.push(sr); }
    }
    return grupla(parcalar);
  }

  // ---------- Kategori kuralları (çeviri bulunamazsa) ----------
  const KATEGORI_KURALLARI = [
    ["VSC", function (t) { return /\b(virtual safety car|vsc)\b/i.test(t); }],
    ["SAFETY_CAR", function (t) { return /\bsafety car\b/i.test(t); }],
    ["RED_FLAG", function (t) { return /\bred flag/i.test(t); }],
    ["RESTART", function (t) { return /\brestart\w*\b/i.test(t); }],
    ["PENALTY", function (t) { return /\b(penalt\w*|penali[sz]\w*)\b/i.test(t); }],
    ["INVESTIGATION", function (t) { return /\b(investigat\w*|steward\w*)\b/i.test(t); }],
    ["RESULT", function (t) { return /\b(wins|won|winner|chequered flag|checkered flag|final results?|classified)\b/i.test(t); }],
    ["TECHNICAL", function (t, n) { return /\b(retire\w*|engine|gearbox|brake\w*|mechanical|power unit|hydraulic)\b/i.test(t) || (n > 0 && /\bstopped\b/i.test(t)); }],
    ["INCIDENT", function (t) { return /\b(crash\w*|collision|collid\w*|contact|spin|spins|spun|damage\w*|debris|off track|beached|gravel|barrier)\b/i.test(t); }],
    ["PIT", function (t) { return /\b(pit|pits|pitted|pitting|pitstop|pit stop|box|boxes)\b/i.test(t); }],
    ["STRATEGY", function (t) { return /\b(strategy|undercut|overcut|one-stop|two-stop|three-stop)\b/i.test(t); }],
    ["WEATHER", function (t) { return /\b(rain\w*|storm\w*|drizzle|thunder\w*|downpour)\b/i.test(t); }],
    ["TYRE", function (t) { return /\b(tyres?|tires?|softs?|mediums?|hards?|intermediates?|inters?|wets?|slicks?)\b/i.test(t); }],
    ["RACE_STATUS", function (t) { return /\b(final lap|last lap|laps? to go|gap|overtake range|catching|closing|holding off|hold off|top three)\b/i.test(t); }],
    ["POSITION", function (t) { return /\b(passes|passed|overtak\w*|ahead|through on|moves into|takes P\d+|takes the lead|P\d{1,2})\b/i.test(t); }],
    ["START", function (t) { return /\b(starts?|started|lights out|formation lap)\b/i.test(t); }],
    ["RADIO", function (t) { return /\b(radio)\b/i.test(t); }]
  ];
  function kategoriBul(tok, mentionSayisi) {
    for (let i = 0; i < KATEGORI_KURALLARI.length; i++) {
      if (KATEGORI_KURALLARI[i][1](tok, mentionSayisi || 0)) { return KATEGORI_KURALLARI[i][0]; }
    }
    return "COMMENT";
  }

  const ONCELIK = { RED_FLAG: "high", SAFETY_CAR: "high", VSC: "high", PENALTY: "high", INVESTIGATION: "high", RESULT: "high",
    TECHNICAL: "high", INCIDENT: "high", RESTART: "high", START: "medium", POSITION: "medium", PIT: "medium", RACE_STATUS: "medium",
    WEATHER: "medium", TYRE: "low", STRATEGY: "low", RADIO: "low", COMMENT: "low" };

  // ---------- F1 ilgi filtresi ----------
  const ILGILI = /\b(f1|formula|grand prix|gp|race|racing|qualifying|sprint|pits?|pitstop|pitted|penalt\w*|investigat\w*|steward\w*|safety car|vsc|red flag|restart\w*|laps?|lights out|formation|stopped|retire\w*|crash\w*|collision|contact|spin\w*|damage\w*|tyres?|tires?|softs?|mediums?|hards?|inter\w*|wets?|slick\w*|rain\w*|storm\w*|wins|winner|podium|grid|p\d{1,2}|overtak\w*|pass\w*|through on|engine|gearbox|brake\w*|mechanical|power unit|team radio|undercut|strategy|chequered|checkered|drs|marshal\w*|debris|track limits|gap)\b/i;

  // Seans DURUMU bildiren çıplak notlar ("Next inspection at 17:15", "This isn't starting for at least 15 minutes", "Standing water… medical car") ILGILI listesinde
  // yoktu ve elendiği için canlı durum kartı (hafta-state.js) bu bilgiyi hiç göremiyordu. Yalnızca "ilgili mi?" kararını genişletir; çeviri/kategori/tekrar mantığı değişmedi.
  const DURUM_ILGILI = /\b(delay\w*|postpone\w*|inspect\w*|medical car|standing water|aquaplan\w*|(?:isn'?t|aren'?t|won'?t|not)\s+(?:be\s+)?(?:start\w*|begin\w*)|resum\w*|suspend\w*|green flag|at least \d+\s*(?:more\s+)?min\w*)\b/i;

  // ---------- Depolama ----------
  function anahtar(raceKey) { return "f1-feed-v1-" + raceKey; }
  function bosDurum() { return { olaylar: [], gorulen: {}, enYeniPost: null, motorSurum: MOTOR_SURUM }; }
  function yukle(raceKey, depo) {
    const d = depo || (typeof localStorage !== "undefined" ? localStorage : null);
    try {
      const v = JSON.parse(d.getItem(anahtar(raceKey)));
      if (v && v.olaylar && v.motorSurum === MOTOR_SURUM) { return v; }
    } catch (e) {}
    return bosDurum();   // eski sürümün cache'i yok sayılır, postlar yeniden çevrilir
  }
  function kaydet(raceKey, durum, depo) {
    const d = depo || (typeof localStorage !== "undefined" ? localStorage : null);
    try { d.setItem(anahtar(raceKey), JSON.stringify(durum)); } catch (e) {}
  }

  // ---------- Metin hazırlığı ----------
  function metniHazirla(ham) {
    return String(ham || "")
      .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\u00a0/g, " ").replace(/\r/g, "")
      .replace(/[ \t]*\n+[ \t]*/g, " ⏎ ").replace(/\s+/g, " ").trim();
  }

  // ---------- Tek postu olay(lar)a çevir ----------
  const KRITIK = ["SAFETY_CAR", "VSC", "RED_FLAG", "TECHNICAL", "INVESTIGATION", "PENALTY", "RESULT", "RESTART"];
  function normMetin(s) { return sade(s).toLowerCase().replace(/https?:\/\/\S+/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }

  function olayUret(post, kaynak, ctx) {
    const kayit = post.record || {};
    const hazir = metniHazirla(kayit.text);
    const gorunen = hazir.replace(/ ⏎ /g, " ").replace(/⏎/g, " ");
    let govde = hazir.replace(/^\s*(?:BREAKING|UPDATE|LIVE)\s*[:\-–]\s*/i, "").replace(/^\s*Lap\s*\d+(?:\s*(?:\/|of)\s*\d+)?\s*[:\-–]\s*/i, "");
    const t = tokenle(govde, ctx.pilotlar);
    const grup = cevirPost(t.tok, ctx.pilotlar, t.mentions);
    const lap = /\blap\s*(\d{1,2})\b/i.exec(gorunen);
    const rkey = String(post.uri || "").split("/").pop();
    const seviye = kaynak.trustLevel || "C";
    const simdi = new Date().toISOString();
    const globalBelirsiz = BELIRSIZ.test(gorunen);
    let tasLar;
    if (grup.length) {
      tasLar = grup.map(function (g) { return { cat: g.cat, tr: g.text, yedek: false, belirsiz: g.belirsiz }; });
    } else {
      const kat = kategoriBul(t.tok, t.mentions.length);
      tasLar = [{ cat: kat, tr: gorunen.length > 160 ? gorunen.slice(0, 157) + "..." : gorunen, yedek: true, belirsiz: globalBelirsiz }];
    }
    const olaylar = tasLar.map(function (g, i) {
      const surucular = [];
      ctx.pilotlar.forEach(function (p) { if (g.tr.indexOf(p.family) >= 0 && surucular.indexOf(p.family) < 0) { surucular.push(p.family); } });
      if (g.yedek) {
        t.mentions.forEach(function (idx) { const f = ctx.pilotlar[idx].family; if (surucular.indexOf(f) < 0) { surucular.push(f); } });
      }
      return {
        id: i === 0 ? post.uri : post.uri + "#" + (i + 1), postId: post.uri, raceId: ctx.raceKey,
        timestamp: kayit.createdAt || post.indexedAt, lap: lap ? parseInt(lap[1], 10) : null,
        category: g.cat, priority: ONCELIK[g.cat] || "low", driver: surucular[0] || null, drivers: surucular, team: null,
        textTr: g.tr, originalText: gorunen, sourceName: kaynak.name,
        sourceUrl: "https://bsky.app/profile/" + kaynak.handle + "/post/" + rkey,
        sourceLevel: seviye, confidence: g.belirsiz ? 0.4 : (seviye === "A" ? 0.9 : seviye === "B" ? 0.7 : 0.4),
        status: (g.belirsiz || seviye === "C") ? "unconfirmed" : "confirmed",
        fingerprint: g.cat + "|" + surucular.slice().sort().join(","),
        translationFallback: g.yedek, motor: MOTOR_SURUM, createdAt: simdi, updatedAt: simdi
      };
    });
    const ilgili = ILGILI.test(gorunen) || DURUM_ILGILI.test(gorunen) || t.mentions.length > 0 || grup.length > 0 || olaylar[0].category !== "COMMENT";
    return { ilgili: ilgili, olaylar: olaylar, olay: olaylar[0] };
  }

  // Seans durumu geçişi türü: yalnızca "aynı kategori + sürücüsüz" tekrar kuralında kullanılır. Farklı geçişler (örn. "Restart expected at 17:40" → "Green flag! Restart!",
  // "RED FLAG" → "Racing has resumed") 3 dk içinde gelse de birbirinin kopyası SAYILMAZ; aksi halde devam postu elenir ve durum kartı kırmızı bayrakta takılı kalırdı.
  function gecisTuru(m) {
    const t = String(m || "");
    if (/\b(lights out|green flag|resum(?:ed|es|ing)|restarted|racing (?:is )?back)\b/i.test(t) && !/\b(will|expected|at \d{1,2}[:.]\d{2}|in \d+ min)/i.test(t)) { return "devam"; }
    if (/\b(restart\w*|resum\w*)\b/i.test(t)) { return "plan"; }
    if (/\bred[- ]flag|stopped|suspended\b/i.test(t)) { return "durdu"; }
    return "";
  }
  function tekrarMi(yeni, mevcut) {
    const nt = normMetin(yeni.textTr);
    const tYeni = new Date(yeni.timestamp).getTime();
    for (let i = 0; i < mevcut.length; i++) {
      const e = mevcut[i];
      if (e.postId && e.postId === yeni.postId) { continue; }   // aynı postun kendi olayları birbirinin kopyası sayılmaz
      const fark = Math.abs(new Date(e.timestamp).getTime() - tYeni);
      if (fark < 10 * 60000 && normMetin(e.textTr) === nt) { return e; }
      if (fark < 3 * 60000 && e.fingerprint === yeni.fingerprint && KRITIK.indexOf(yeni.category) >= 0 && yeni.drivers.length > 0) { return e; }
      if (fark < 3 * 60000 && e.category === yeni.category && yeni.drivers.length === 0 && ["SAFETY_CAR", "VSC", "RED_FLAG", "RESTART"].indexOf(yeni.category) >= 0 &&
          gecisTuru(e.originalText) === gecisTuru(yeni.originalText)) { return e; }
    }
    return null;
  }

  // ---------- Saklı olayları yeniden çevir ----------
  // Saklı olay, özgün metinden türetilmiş bir çıktıdır. Başka (eski) bir motor sürümünün ürettiği
  // olaylar (EN yedekleri dahil) bu motorla özgün metinden yeniden üretilir. Bir kez yapılır: yeni olaylar damgalıdır.
  function yenidenCevir(durum, ctx, kaynaklar) {
    const eski = durum.olaylar.filter(function (e) { return e.motor !== MOTOR_SURUM; });
    if (!eski.length) { return 0; }
    const gorulenPost = {};
    const yeni = [];
    eski.forEach(function (e) {
      const pid = e.postId || String(e.id).split("#")[0];
      if (gorulenPost[pid]) { return; }
      gorulenPost[pid] = true;
      const kaynak = kaynaklar.filter(function (k) { return k.name === e.sourceName; })[0] || { name: e.sourceName, handle: "", trustLevel: e.sourceLevel };
      let u;
      try { u = olayUret({ uri: pid, record: { text: e.originalText, createdAt: e.timestamp } }, kaynak, ctx); } catch (x) { u = null; }
      if (!u) { return; }
      u.olaylar.forEach(function (ev) { ev.sourceUrl = e.sourceUrl; ev.createdAt = e.createdAt; yeni.push(ev); });
    });
    durum.olaylar = durum.olaylar.filter(function (e) { return e.motor === MOTOR_SURUM; }).concat(yeni);
    return Object.keys(gorulenPost).length;
  }

  // ---------- Ana döngü ----------
  // ctx: { raceKey, raceStart: Date, pilotlar: [{family, given, code}] }
  // opts: { testMode, fetchFn, depo, kaynaklar, simdi }
  async function poll(ctx, opts) {
    opts = opts || {};
    const a = ayar();
    const getir = opts.fetchFn || (typeof fetch !== "undefined" ? fetch.bind(kok) : null);
    const kaynaklar = (opts.kaynaklar || kok.NOTLAR_KAYNAKLAR || []).filter(function (s) {
      return s.enabled && s.liveSource && s.type === "bluesky";
    });
    const simdi = opts.simdi || new Date();
    const pen = pencere(ctx.raceStart, simdi);
    const durum = yukle(ctx.raceKey, opts.depo);
    const ist = { zaman: simdi.toISOString(), kaynak: [], fetched: 0, new: 0, relevant: 0, rejected: 0, duplicate: 0,
                  eventsAdded: 0, translated: 0, fallbackEN: 0, reddedilme: { zaman: 0, ilgisiz: 0, repost: 0, bos: 0 },
                  hatalar: [], lastPost: null,
                  pencere: { bas: pen.bas.toISOString(), bit: pen.bit.toISOString(), aktif: pen.aktif }, testMode: !!opts.testMode };

    ist.healed = yenidenCevir(durum, ctx, opts.kaynaklar || kok.NOTLAR_KAYNAKLAR || []);
    for (let k = 0; k < kaynaklar.length; k++) {
      const kaynak = kaynaklar[k];
      const kd = { id: kaynak.id, name: kaynak.name, durum: "ACTIVE", hata: "" };
      try {
        if (!getir) { throw new Error("fetch yok"); }
        const url = "https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=" + encodeURIComponent(kaynak.handle) + "&limit=30";
        const r = await getir(url);
        if (!r.ok) { throw new Error("HTTP " + r.status); }
        const veri = await r.json();
        const feed = veri.feed || [];
        ist.fetched += feed.length;
        const kayitlar = feed.map(function (o) { return { post: o.post, repost: !!o.reason }; }).filter(function (x) { return x.post; });
        kayitlar.sort(function (x, y) {
          return new Date((x.post.record || {}).createdAt || 0) - new Date((y.post.record || {}).createdAt || 0);
        });
        kayitlar.forEach(function (x) {
          const zaman = (x.post.record || {}).createdAt || x.post.indexedAt;
          if (zaman && (!ist.lastPost || zaman > ist.lastPost)) { ist.lastPost = zaman; }
        });
        kayitlar.forEach(function (x) {
          const uri = x.post.uri;
          if (durum.gorulen[uri]) { return; }
          const zaman = (x.post.record || {}).createdAt || x.post.indexedAt;
          const tz = new Date(zaman);
          if (!opts.testMode && !x.repost && (isNaN(tz) || tz < pen.bas || tz > pen.bit)) {
            ist.rejected++; ist.reddedilme.zaman++; return;   // "görüldü" işaretlenmez: test modunda tekrar değerlendirilebilsin
          }
          ist.new++;
          if (x.repost) { ist.rejected++; ist.reddedilme.repost++; durum.gorulen[uri] = Date.now(); return; }
          if (!((x.post.record || {}).text || "").trim()) { ist.rejected++; ist.reddedilme.bos++; durum.gorulen[uri] = Date.now(); return; }
          const u = olayUret(x.post, kaynak, ctx);
          durum.gorulen[uri] = Date.now();
          if (!u.ilgili) { ist.rejected++; ist.reddedilme.ilgisiz++; return; }
          ist.relevant++;
          if (u.olaylar[0].translationFallback) { ist.fallbackEN++; } else { ist.translated++; }
          u.olaylar.forEach(function (ev) {
            const tek = tekrarMi(ev, durum.olaylar);
            if (tek) {
              ist.duplicate++;
              tek.updatedAt = new Date().toISOString();
              tek.status = tek.status === "unconfirmed" && ev.status === "confirmed" ? "updated" : tek.status;
              return;
            }
            durum.olaylar.push(ev);
            ist.eventsAdded++;
          });
        });
      } catch (e) {
        kd.durum = "ERROR"; kd.hata = e.message; ist.hatalar.push(kaynak.name + ": " + e.message);
      }
      ist.kaynak.push(kd);
    }

    durum.olaylar.sort(function (x, y) { return new Date(y.timestamp) - new Date(x.timestamp); });
    durum.olaylar = durum.olaylar.slice(0, a.maxOlay);
    const anahtarlar = Object.keys(durum.gorulen);
    if (anahtarlar.length > 400) {
      anahtarlar.sort(function (x, y) { return durum.gorulen[x] - durum.gorulen[y]; }).slice(0, anahtarlar.length - 300)
        .forEach(function (k2) { delete durum.gorulen[k2]; });
    }
    if (ist.lastPost) { durum.enYeniPost = ist.lastPost; }
    durum.motorSurum = MOTOR_SURUM;
    kaydet(ctx.raceKey, durum, opts.depo);
    ist.eventsToplam = durum.olaylar.length;
    return { stats: ist, olaylar: durum.olaylar };
  }

  const API = { poll: poll, yukle: yukle, pencere: pencere, tokenle: tokenle, cevirPost: cevirPost, kategoriBul: kategoriBul,
                belirtmeEki: belirtmeEki, yonelmeEki: yonelmeEki, bulunmaEki: bulunmaEki, tamlayanEki: tamlayanEki,
                pYonelme: pYonelme, olayUret: olayUret, tekrarMi: tekrarMi, MOTOR_SURUM: MOTOR_SURUM };
  kok.RaceFeed = API;
  if (typeof module !== "undefined" && module.exports) { module.exports = API; }
})(typeof window !== "undefined" ? window : globalThis);
