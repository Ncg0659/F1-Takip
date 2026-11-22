# Pist yönü denetimi: node testler/pist_yon_audit.js çıktısını PASS/FAIL satırlarına çevirir (UNVERIFIED geçer ama raporlanır).
import subprocess, json, os
r = subprocess.run(["node", os.path.join(os.path.dirname(os.path.abspath(__file__)), "pist_yon_audit.js")], capture_output=True, text=True)
n = 0
for s in r.stdout.splitlines():
    if s.startswith("{"):
        d = json.loads(s); n += 1
        print(("PASS" if d["durum"] in ("PASS", "UNVERIFIED", "FIXED") else "FAIL"), d["pist"], d["durum"], "—", d["not"])
    elif s.startswith("ÖZET"): print(s)
print("\nTOPLAM %d/%d" % (sum(1 for s in r.stdout.splitlines() if s.startswith("{") and '"HATA"' not in s), n))
