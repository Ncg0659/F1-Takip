/* A4.2 — Sözlük eklentisi (YALNIZCA veri). A2/A3 sözlük dosyalarına dokunmaz; yalnızca olmayan terimleri ekler. ogren-ui.js'ten ÖNCE yüklenmelidir. */
(function () {
  var I = window.ICERIK = window.ICERIK || {}, S = I.sozluk;
  if (!S || !S.terimler) { return; }
  var F1 = "https://www.formula1.com";
  var EK = {
    "team-principal": { ad: "Team Principal / Takım Patronu", kat: "teknik", seviye: 1,
      kisa: "Takımı yöneten kişi. Takımın yarış operasyonundan ve genel yönetiminden sorumlu olan kişi için kullanılan unvandır.",
      iliskili: ["takimlar-sampiyonasi"], kaynak: F1, dogrulama: "ikincil" },
    "power-unit": { ad: "Power Unit / Güç Ünitesi", kat: "teknik", seviye: 1,
      kisa: "Aracı hareket ettiren motor sisteminin tamamı: içten yanmalı motor ile elektrikle çalışan enerji geri kazanım bileşenlerini birlikte kapsar. Bazı takımlar kendi güç ünitesini üretir, bazıları başka bir üreticiden alır.",
      iliskili: ["takimlar-sampiyonasi"], kaynak: F1, dogrulama: "ikincil" }
  };
  Object.keys(EK).forEach(function (k) { if (!S.terimler[k]) { S.terimler[k] = EK[k]; } });
})();
