/* İZLERKEN ÖĞREN v2 — sözlük genişlemesi (YALNIZCA VERİ). Tek kaynak: window.ICERIK.sozluk (icerik-sozluk.js).
   • Yeni terimler yalnızca eksikse eklenir; mevcut bir terimin metni DEĞİŞTİRİLMEZ (aynı terim için iki farklı açıklama olmaz).
   • Mevcut terimlere yalnızca eksik alanlar eklenir: "neden" (Neden önemli?) ve "en" (yayındaki İngilizce ad).
   • Açıklamalar sabit sözlük metnidir; tahmin / neden-sonuç / yorum içermez. Yeni fetch, zamanlayıcı, depolama YOK.
   • Şema: ad, kat, seviye, kisa, uzun?, neden?, en?, iliskili[], dogrulama. Kategoriler mevcut 7 kategoridir. */
(function () {
  var I = window.ICERIK = window.ICERIK || {}, S = I.sozluk;
  if (!S || !S.terimler) { return; }
  var YENI = {
    "restart": { ad: "Restart", kat: "yaris", seviye: 1, en: "Restart",
      kisa: "Yarışın Safety Car ya da kırmızı bayrak döneminden sonra yeniden hızlı tempoda başlaması. Araçlar sıralı dizilidir; geçiş yeniden serbesttir.",
      neden: "Araçlar birbirine yakın dizildiği için yeniden start sırasında pozisyonlar değişebilir.",
      iliskili: ["safety-car", "isinma", "formasyon-turu"], dogrulama: "ikincil" },
    "blue-flag": { ad: "Mavi bayrak", kat: "yaris", seviye: 1, en: "Blue flag",
      kisa: "Turu bir tur veya daha fazla geride kalan pilota, kendisini geçmek üzere olan daha hızlı bir araç olduğunu bildiren bayrak.",
      neden: "Geride kalan pilotun yol vermesi beklenir; vermemesi ceza nedeni olabilir.",
      iliskili: ["backmarker", "impeding", "tur-farki"], dogrulama: "ikincil" },
    "pit-window": { ad: "Pit window", kat: "strateji", seviye: 2, en: "Pit window",
      kisa: "Takımın pit stop için uygun gördüğü tur aralığı.",
      neden: "Pit stopun bu aralıkta yapılması lastik ömrü ve pist konumu açısından değerlendirilir.",
      iliskili: ["pit-stop", "undercut", "lastik-asinmasi"], dogrulama: "ikincil" },
    "box": { ad: "BOX", kat: "strateji", seviye: 1, en: "Box, box",
      kisa: "Takımın telsizle pilota “pite gir” demesi (“box, box”). Pit garajına “box” denir.",
      neden: "Telsiz çağrısı pit stopun bir sonraki turda yapılacağını gösterir.",
      iliskili: ["pit-stop", "pit-window"], dogrulama: "ikincil" },
    "double-stack": { ad: "Double stack", kat: "strateji", seviye: 2, en: "Double stack",
      kisa: "Aynı takımın iki pilotunun art arda pite girmesi; ikinci pilot birinci pilotun lastik değişimi bitene kadar bekleyebilir.",
      neden: "İkinci pilotun pit hattında ek bekleme süresi geçirmesine yol açabilir.",
      iliskili: ["pit-stop", "pit-window"], dogrulama: "ikincil" },
    "out-lap": { ad: "Out lap", kat: "lastik", seviye: 1, en: "Out lap",
      kisa: "Pit hattından çıkıp pistte atılan ilk tur. Lastik henüz tam ısınmamıştır.",
      neden: "Bu tur süresi normal turlardan yavaş olabilir; tur listelerinde ayrı ele alınır.",
      iliskili: ["in-lap", "isinma", "pit-stop"], dogrulama: "ikincil" },
    "in-lap": { ad: "In lap", kat: "lastik", seviye: 1, en: "In lap",
      kisa: "Pit hattına girmeden önceki son tur.",
      neden: "Pite girişe hazırlanıldığı için bu tur süresi normal turlardan farklı olabilir.",
      iliskili: ["out-lap", "pit-stop"], dogrulama: "ikincil" },
    "flying-lap": { ad: "Flying lap", kat: "lastik", seviye: 1, en: "Flying lap",
      kisa: "Pit giriş/çıkış turu olmayan, tam tempoda atılan tur.",
      neden: "Tur sürelerini karşılaştırırken bu turlar esas alınır; out lap ve in lap dışarıda kalır.",
      iliskili: ["out-lap", "in-lap", "lastik-asinmasi"], dogrulama: "ikincil" },
    "grip": { ad: "Grip", kat: "lastik", seviye: 1, en: "Grip",
      kisa: "Lastiğin pistte tutunma gücü. Lastik ısındıkça ve pist lastik bırakıp temizlendikçe değişir; lastik aşındıkça azalır.",
      neden: "Tutuş azaldığında araç viraj çıkışlarında kayar ve tur süreleri uzar.",
      iliskili: ["lastik-asinmasi", "isinma"], dogrulama: "ikincil" },
    "dirty-air": { ad: "Dirty air", kat: "pozisyon", seviye: 2, en: "Dirty air",
      kisa: "Öndeki aracın arkasında oluşan türbülanslı hava. Arkadaki araç aerodinamik tutuş kaybeder.",
      neden: "Yakın takip sırasında arkadaki aracın viraj hızı düşebilir ve lastikler daha çok kayabilir.",
      iliskili: ["cekim", "gecis"], dogrulama: "ikincil" },
    "drs": { ad: "DRS", kat: "teknik", seviye: 2, en: "Drag Reduction System",
      kisa: "Drag Reduction System: 2025 ve öncesinde arka kanadı açarak düz yolda hız kazandıran sistem. 2026 teknik kurallarında DRS yoktur; yerini aktif aerodinamik ve overtake modu almıştır.",
      neden: "2025 ve öncesi yarışlarını izlerken geçişlerin nasıl kolaylaştığını anlamaya yarar.",
      iliskili: ["drs-train", "cekim", "gecis"], dogrulama: "ikincil" },
    "drs-train": { ad: "DRS train", kat: "pozisyon", seviye: 2, en: "DRS train",
      kisa: "2025 ve öncesinde, birkaç aracın DRS mesafesinde (1 saniye içinde) art arda dizilmesi.",
      neden: "Hepsi birbirine yakın olduğundan öndeki araç geçilmeyebilir.",
      iliskili: ["drs", "dirty-air"], dogrulama: "ikincil" },
    "backmarker": { ad: "Backmarker", kat: "pozisyon", seviye: 1, en: "Backmarker",
      kisa: "Yarışın gerisinde kalan ve öndeki pilotlar tarafından tur bindirilen (lapped) araç.",
      neden: "Öndeki pilotlar tur bindirirken bu araçlarla karşılaşır; mavi bayrak bu durumda gösterilir.",
      iliskili: ["blue-flag", "tur-farki"], dogrulama: "ikincil" },
    "impeding": { ad: "Impeding", kat: "hafta-sonu", seviye: 2, en: "Impeding",
      kisa: "Bir pilotun, hızlı turdaki başka bir pilotun önünü gereksiz yere kesmesi (engelleme). Komiserler değerlendirir.",
      neden: "Sıralama turlarında sık görülür; ceza ya da uyarı ile sonuçlanabilir.",
      iliskili: ["grid-cezasi", "blue-flag"], dogrulama: "ikincil" },
    "lap-deleted": { ad: "Lap deleted", kat: "hafta-sonu", seviye: 1, en: "Lap time deleted",
      kisa: "Pist limiti ihlali gibi nedenlerle bir tur süresinin geçersiz sayılması.",
      neden: "Silinen tur sıralamada ya da sonuçta o tur süresine sayılmaz.",
      iliskili: ["pist-limiti", "ceza-saniyesi"], dogrulama: "ikincil" }
  };
  Object.keys(YENI).forEach(function (k) { if (!S.terimler[k]) { S.terimler[k] = YENI[k]; } });

  // mevcut terimlere yalnızca EKSİK alanlar (metin değişmez)
  var YAMA = {
    "safety-car": { en: "Safety Car", neden: "Pozisyon farkları kapanır ve pit stop zamanlaması değişebilir." },
    "vsc": { en: "Virtual Safety Car", neden: "Pit stop sırasında kaybedilen süre normal yarış temposuna göre azalabilir." },
    "kirmizi-bayrak": { en: "Red flag", neden: "Yarış durur; bu sırada lastik değişimine izin verilir." },
    "undercut": { en: "Undercut", neden: "Yeni lastiğin ilk turlardaki hız avantajı pozisyon kazandırabilir." },
    "overcut": { en: "Overcut", neden: "Pistte kalan pilotun lastiği hâlâ iyiyse pit sonrası öne geçmesi mümkün olabilir." },
    "pist-limiti": { en: "Track limits", neden: "İhlal tur süresinin silinmesine ya da cezaya yol açabilir." },
    "grid-cezasi": { en: "Grid penalty", neden: "Pilot yarışa sıralamadaki yerinden daha geride başlar." },
    "parc-ferme": { en: "Parc fermé", neden: "Takımlar sıralamadan sonra aracı serbestçe değiştiremez." },
    "dnf": { en: "Did Not Finish", neden: "Pilot yarış sonunda sıralanmaz ve puan alamaz." },
    "dns-dsq": { en: "Did Not Start / Disqualified", neden: "İkisinde de pilotun yarış sonucu puan getirmez." },
    "cekim": { en: "Slipstream / tow", neden: "Geçiş denemesi öncesi arkadaki aracın hız kazanmasını sağlar." },
    "lastik-asinmasi": { en: "Tyre degradation", neden: "Tur süreleri yavaşladığında pit stop zamanı yaklaşır." },
    "isinma": { en: "Tyre warm-up", neden: "Yeni lastikle ya da yeniden startta tutuş düşük olabilir." },
    "formasyon-turu": { en: "Formation lap", neden: "Lastik ve frenler start öncesi çalışma sıcaklığına yaklaşır." },
    "durus-sayisi": { en: "One-stop / two-stop", neden: "Duruş sayısı yarışın stratejik planını gösterir." },
    "pit-stop": { en: "Pit stop", neden: "Pozisyon ve lastik durumu pit stop sonrası değişebilir." }
  };
  Object.keys(YAMA).forEach(function (k) {
    var t = S.terimler[k]; if (!t) { return; }
    Object.keys(YAMA[k]).forEach(function (a) { if (t[a] == null) { t[a] = YAMA[k][a]; } });
  });
  var G = S.terimler["gecis"];
  if (G && G.iliskili) { ["dirty-air", "drs"].forEach(function (r) { if (G.iliskili.indexOf(r) < 0 && S.terimler[r]) { G.iliskili.push(r); } }); }
  // pit-stop → strateji terimlerine ulaşım (ilişkili çipler)
  var P = S.terimler["pit-stop"];
  if (P && P.iliskili) { ["pit-window", "box", "double-stack", "out-lap"].forEach(function (r) { if (P.iliskili.indexOf(r) < 0 && S.terimler[r]) { P.iliskili.push(r); } }); }
})();
