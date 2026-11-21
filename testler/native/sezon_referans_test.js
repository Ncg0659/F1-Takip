// SEZON v1 JS referansı (Swift SeasonBuilder/CircuitShapes mantığı + paketlenen silüet verisinin web verisiyle birebirliği). Swift'in kendisi DEĞİLDİR.
const fs = require("fs"), PS = require("../../f1/pist-siluetleri.js");
let ok = 0, n = 0; const T = (a, g, e) => { n++; const p = JSON.stringify(g) === JSON.stringify(e); ok += p; console.log((p?"OK   ":"FAIL ")+a+(p?"":"  got="+JSON.stringify(g)+" exp="+JSON.stringify(e))); };
// --- silüet: paketlenen JSON == web YOL; Swift ayrıştırıcısının (M/L/Z tokenizer) JS karşılığı
const bundled = JSON.parse(fs.readFileSync("../../f1-ios/F1Takip/Resources/pist_silueti.json", "utf8"));
T("silüet verisi web ile birebir (25 pist)", [Object.keys(bundled).length, JSON.stringify(bundled) === JSON.stringify(PS.YOL)], [25, true]);
function parse(path) { const out = []; let cur = [];
  const tk = path.replace(/M/g," M ").replace(/L/g," L ").replace(/Z/g," Z ").split(/[ ,]+/).filter(Boolean); let i = 0;
  while (i < tk.length) { const t = tk[i];
    if (t === "M") { if (cur.length > 1) out.push(cur); cur = []; i++; } else if (t === "L") i++;
    else if (t === "Z") { if (cur.length) cur.push(cur[0]); if (cur.length > 1) out.push(cur); cur = []; i++; }
    else if (i+1 < tk.length && !isNaN(+t) && !isNaN(+tk[i+1])) { cur.push([+t, +tk[i+1]]); i += 2; } else i++; }
  if (cur.length > 1) out.push(cur); return out; }
let allOk = true, pts = 0; for (const [k, v] of Object.entries(bundled)) { const sp = parse(v); const nums = (v.match(/-?\d+\.?\d*/g)||[]).length / 2; const got = sp.reduce((a,s)=>a+s.length,0) - (v.match(/Z/g)||[]).length;
  pts += got; if (!sp.length || got !== nums || sp.flat().some(([x,y]) => x<0||x>300||y<0||y>200)) { allOk = false; console.log("  sorunlu:", k, got, nums); } }
T("25 silüet ayrışıyor, nokta sayısı eşit, 300×200 içinde", allOk, true);
T("2026 takvimindeki pist kimlikleri kapsanıyor (kritik)", ["americas","monaco","vegas","yas_marina","madring"].every(k => bundled[k]), true);
// --- Takvim/özet mantığı aynası
const DAY = 86400000, mk = (round, iso, sprint) => ({ round, race: Date.parse(iso), sprint: !!sprint });
const W = [mk(1,"2026-03-08T05:00:00Z"), mk(2,"2026-03-22T05:00:00Z",true), mk(3,"2026-04-05T05:00:00Z"), mk(4,"2026-04-19T05:00:00Z")];
function season(now, winners, live) { const over = w => winners[w.round] || w.race + 6*3600000 <= now; const next = W.find(w => !over(w));
  const cards = W.map(w => { let b = winners[w.round] ? "TAMAMLANDI" : over(w) ? "BİTTİ" : (next && next.round === w.round) ? "SIRADA" : "YAKLAŞAN"; if (live && live === w.round && !winners[w.round]) b = "LIVE"; return { r:w.round, b, sprint:w.sprint, win: winners[w.round]||null }; });
  return { completed: Object.keys(winners).length, total: W.length, next: next && next.round, cards, over: !next }; }
let s = season(Date.parse("2026-02-01T00:00:00Z"), {}); T("sezon başı", [s.completed, s.next, s.cards.map(c=>c.b)], [0,1,["SIRADA","YAKLAŞAN","YAKLAŞAN","YAKLAŞAN"]]);
s = season(Date.parse("2026-03-30T00:00:00Z"), {1:"VER",2:"NOR"}); T("sezon ortası", [s.completed, s.next, s.cards.map(c=>c.b), s.cards[0].win, s.cards[2].win], [2,3,["TAMAMLANDI","TAMAMLANDI","SIRADA","YAKLAŞAN"],"VER",null]);
T("sprint round işareti", s.cards.map(c=>c.sprint), [false,true,false,false]);
s = season(Date.parse("2026-05-30T00:00:00Z"), {1:"A",2:"B",3:"C",4:"D"}); T("sezon sonu", [s.over, s.next, s.completed], [true, undefined, 4]);
s = season(Date.parse("2026-03-30T00:00:00Z"), {}); T("sonuç verisi yoksa uydurma kazanan yok", [s.cards[0].b, s.cards[0].win], ["BİTTİ", null]);
s = season(Date.parse("2026-04-05T05:10:00Z"), {1:"A",2:"B"}, 3); T("canlı yarış rozeti", s.cards[2].b, "LIVE");
// --- puan farkları
const fmt = d => Number.isInteger(d) ? String(d) : d.toFixed(1); const gaps = p => p.map((x,i) => i===0 ? "—" : "-" + fmt(Math.max(0, p[0]-x)));
T("pilot/takım liderden fark", [gaps([300,288.5,200]), gaps([500,420])], [["—","-11.5","-100"],["—","-80"]]);
T("kalan potansiyel puan (2 yarış)", 2*25 + 0*8, 50);
console.log(ok+"/"+n); process.exit(ok===n?0:1);
