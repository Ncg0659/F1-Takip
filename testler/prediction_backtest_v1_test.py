import json,subprocess,sys,os
D=os.path.dirname(os.path.abspath(__file__))+"/backtest"
r=subprocess.run(["node","bt_kontrol.js"],cwd=D,capture_output=True,text=True)
if r.returncode!=0: print(r.stderr[-2000:]); sys.exit(1)
C=json.loads(r.stdout.strip().splitlines()[-1]);g=0
for c in C:
    print(("OK   " if c["ok"] else "FAIL ")+c["ad"]+((" | "+c["d"]) if (c["d"] and not c["ok"]) else ""));g+=c["ok"]
print("SONUC %d/%d"%(g,len(C)));sys.exit(0 if g==len(C) else 1)
