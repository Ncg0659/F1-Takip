/* Grid adayı karar kuralı (v3): B, A'ya göre sezon bazında "belirgin" üstünse sayılır; >=2/3 sezon + havuzda kötü değil + yalnız-2026 değil → kabul. */
"use strict";
function belirgin(a, b) {   // b, a'dan belirgin iyi mi? (Brier'da >=%3 göreli iyileşme VEYA Top1'de >=+0.05 ve LL kötüleşmedi + Brier kötüleşmedi)
  const brierIyi = (a.brierWin - b.brierWin) / a.brierWin >= 0.03, top1Iyi = b.top1 - a.top1 >= 0.05 && b.logLossWin <= a.logLossWin && b.brierWin <= a.brierWin;
  return brierIyi || top1Iyi;
}
function kotu(a, b) { return (b.brierWin - a.brierWin) / a.brierWin > 0.03 || b.top1 - a.top1 <= -0.05; }   // belirgin kötü
function karar(sezon, havuz) {   // sezon: {2024:{A,B},2025:{A,B},2026:{A,B}} ; havuz:{A,B}
  const y = Object.keys(sezon), iyi = y.filter(s => belirgin(sezon[s].A, sezon[s].B)), kt = y.filter(s => kotu(sezon[s].A, sezon[s].B));
  const sadece2026 = iyi.length === 1 && iyi[0] === "2026";
  const havuzOk = havuz.B.brierWin <= havuz.A.brierWin && havuz.B.logLossWin <= havuz.A.logLossWin;
  const kabul = iyi.length >= 2 && !sadece2026 && kt.length === 0 && havuzOk;
  return { kabul: kabul, iyiSezonlar: iyi, kotuSezonlar: kt, sadece2026: sadece2026, havuzOk: havuzOk };
}
module.exports = { belirgin, kotu, karar };
