node ghost_kontrol.js | python3 -c "
import sys,json
K=json.loads(sys.stdin.read().strip().splitlines()[-1])
for c in K: print(('OK   ' if c['ok'] else 'FAIL ')+c['ad']+('' if c['ok'] else ' | '+c['d']))
print(sum(c['ok'] for c in K),'/',len(K))"
