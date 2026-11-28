#!/bin/bash
# F1 TAKİP — tek komutla regresyon. Çalıştır:  bash testler/calistir.sh          (hepsi)
#                                              bash testler/calistir.sh bugun_v3_test raceday_390_test   (seçilenler)
# Gereken: python3 + playwright (chromium), node. Testler siteyi /home/claude/f1-takip yolundan açar;
# repo başka yerdeyse o yola bağlantı (symlink) kurulur. Ekran görüntüleri /tmp/f1-ekran/ altına yazılır (repoya değil).
set -u
REPO="$(cd "$(dirname "$0")/.." && pwd)"
if [ "$REPO" != "/home/claude/f1-takip" ] && [ ! -e /home/claude/f1-takip ]; then mkdir -p /home/claude && ln -s "$REPO" /home/claude/f1-takip; fi
mkdir -p /tmp/f1-ekran
cd "$REPO/testler"
CEKIRDEK="polish_v1_test motion_v2_test bugun_v3_test raceday_390_test feed_v1_test feed_state_test sezon_arasi_test offline_pwa_test pist_yon_test prediction_snapshot_test yaris_v3_test ghost_lap_v1_test telemetry_data_v1_test prediction_ui_v1_test prediction_engine_v1_test gecmis_yaris_v1_test favori_v1_test nav_v3_test nav_v3_faz2_test ogren_v2_test audit_fixes_v1_test kaynak_timeout_v1_test yaris_hikaye_v1_test strateji_v1_test race_feed_v2_test nav_v4_guvenlik_test nav_v4_kabuk_test nav_v4_ana_test"
LISTE="${*:-$CEKIRDEK}"
TOPLAM_HATA=0
for t in $LISTE; do
  [ -f "$t.py" ] || { echo "$t: DOSYA YOK"; TOPLAM_HATA=$((TOPLAM_HATA+1)); continue; }
  timeout 1500 python3 "$t.py" > "/tmp/f1-ekran/sonuc_$t.txt" 2>&1; kod=$?
  p=$(grep -c '^PASS' "/tmp/f1-ekran/sonuc_$t.txt"); f=$(grep -c '^FAIL' "/tmp/f1-ekran/sonuc_$t.txt")
  ozet=$(grep -E 'TOPLAM|SONU[CÇ]|^[0-9]+ ?/ ?[0-9]+' "/tmp/f1-ekran/sonuc_$t.txt" | tail -1)
  durum="OK"; if [ "$f" != "0" ] || [ "$kod" != "0" ]; then durum="HATA(çıkış $kod)"; TOPLAM_HATA=$((TOPLAM_HATA+1)); fi
  echo "$t: $durum  PASS=$p FAIL=$f  $ozet"
  grep '^FAIL' "/tmp/f1-ekran/sonuc_$t.txt" | cut -c1-180
  [ "$kod" != "0" ] && grep -A3 'Traceback' "/tmp/f1-ekran/sonuc_$t.txt" | tail -3 | cut -c1-180
done
echo "---"; if [ "$TOPLAM_HATA" = "0" ]; then echo "SONUÇ: TÜMÜ GEÇTİ"; else echo "SONUÇ: $TOPLAM_HATA dosyada sorun"; fi
exit $TOPLAM_HATA
