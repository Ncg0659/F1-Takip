/* Şampiyonluk kalibrasyon kabul kuralı: ileri-zincir doğrulamada (eğitimde seçilen aday, doğrulama sezonunda ölçülür) varsayılana göre
   havuzda Brier VE log loss en az %3 iyi, hiçbir doğrulama sezonunda J (baseline'a göre bileşik hata) %5'ten fazla kötüleşmemiş, en az 2/3 sezon iyi. */
"use strict";
function karar(foldlar) {   // foldlar: [{val, secilenJ, varsayilanJ, secilen:{brier,logLoss}, varsayilan:{brier,logLoss}}]
  const n = foldlar.length, ort = (k, a) => foldlar.reduce((s, f) => s + f[a][k], 0) / n;
  const bGain = (ort("brier", "varsayilan") - ort("brier", "secilen")) / ort("brier", "varsayilan"), lGain = (ort("logLoss", "varsayilan") - ort("logLoss", "secilen")) / ort("logLoss", "varsayilan");
  const iyi = foldlar.filter(f => f.secilenJ < f.varsayilanJ).map(f => f.val), kotu = foldlar.filter(f => f.secilenJ > f.varsayilanJ * 1.05).map(f => f.val);
  const kabul = bGain >= 0.03 && lGain >= 0.03 && kotu.length === 0 && iyi.length >= Math.ceil(2 * n / 3);
  return { kabul: kabul, brierKazanc: bGain, logLossKazanc: lGain, iyiSezonlar: iyi, kotuSezonlar: kotu };
}
module.exports = { karar };
