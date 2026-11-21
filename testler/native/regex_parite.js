// JS (hafta-state.js) regex kaynakları ↔ Swift (RaceStateEngine.swift) desenleri birebir mi? + Swift dosyalarında parantez dengesi.
const fs = require("fs"), path = require("path");
const js = fs.readFileSync("../../f1/hafta-state.js", "utf8");
const sw = fs.readFileSync("../../f1-ios/F1Core/Sources/F1Core/RaceStateEngine.swift", "utf8");
const map = { RE_BITTI:"reBitti", RE_BITTI_GELECEK:"reBittiGelecek", RE_KIRMIZI:"reKirmizi", RE_KIRMIZI_OLUMSUZ:"reKirmiziOlumsuz", RE_KIRMIZI_GECMIS:"reKirmiziGecmis",
  RE_KIRMIZI_AKTIF:"reKirmiziAktif", RE_KIRMIZI_BUYUK:"reKirmiziBuyuk", RE_DURDU:"reDurdu", RE_ONCE:"reOnce", RE_GELECEK_DEVAM:"reGelecekDevam", RE_DEVAM:"reDevam",
  RE_PLAN_ZAMAN:"rePlanZaman", RE_BASLANGIC:"reBaslangic", RE_GECIKME_START:"reGecikmeStart", RE_GECIKME_DEGIL:"reGecikmeDegil", RE_ENAZ_SERBEST:"reEnazSerbest",
  RE_DUYURU:"reDuyuru", RE_SC:"reSc", RE_SC_BITTI:"reScBitti", RE_VSC:"reVsc", RE_VSC_BITTI:"reVscBitti", RE_SAAT:"reSaat", RE_ENAZ:"reEnaz" };
let ok = 0, bad = 0;
for (const [j, s] of Object.entries(map)) {
  const mj = js.match(new RegExp("var " + j + " = /(.*)/([a-z]*);"));
  const ms = sw.match(new RegExp("static let " + s + " = Rx\\(#\"(.*?)\"#(, ci: false)?\\)"));
  const jsFlag = mj && mj[2].includes("i"), swCi = ms && !ms[2];
  if (mj && ms && mj[1] === ms[1] && jsFlag === swCi) ok++; else { bad++; console.log("FARK:", j, !!mj, !!ms); }
}
console.log("regex birebir:", ok + "/" + Object.keys(map).length, bad ? "HATA" : "OK");
// Swift desenleri JS RegExp olarak da derlenir mi (sözdizimi)?
for (const m of sw.matchAll(/Rx\(#"(.*?)"#/g)) { try { new RegExp(m[1]); } catch (e) { console.log("derlenmedi:", m[1].slice(0,40)); bad++; } }
// Basit denge kontrolü
function denge(f) { const t = fs.readFileSync(f, "utf8").replace(/#"[^\n]*?"#/g, '""').replace(/"(\\.|[^"\\\n])*"/g, '""').replace(/\/\/.*$/gm, "");
  const st = []; const p = { ")":"(", "]":"[", "}":"{" };
  for (const c of t) { if ("([{".includes(c)) st.push(c); else if (p[c]) { if (st.pop() !== p[c]) return false; } } return st.length === 0; }
function gez(d) { return fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? gez(path.join(d, e.name)) : e.name.endsWith(".swift") ? [path.join(d, e.name)] : []); }
const files = gez("../../f1-ios"); let db = 0;
files.forEach(f => { if (!denge(f)) { console.log("DENGESİZ:", f); db++; } });
console.log("swift dosyası:", files.length, "dengesiz:", db);
process.exit(bad || db ? 1 : 0);
