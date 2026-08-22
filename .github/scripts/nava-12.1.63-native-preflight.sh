#!/usr/bin/env bash
set +e
LOG=/tmp/native63-preflight.log
: > "$LOG"
python android-patch/v12.1.59/patch-offline-runtime.py android-patch/v12.1.59/native-source/OfflineRuntime.java.txt /tmp/OfflineRuntime59.java >> "$LOG" 2>&1
RC=$?; echo "PATCH59_RC=$RC" >> "$LOG"; [ "$RC" -eq 0 ] || exit "$RC"
python android-patch/v12.1.59/fix-jadx-compile.py /tmp/OfflineRuntime59.java >> "$LOG" 2>&1
RC=$?; echo "JADX_RC=$RC" >> "$LOG"; [ "$RC" -eq 0 ] || exit "$RC"
python android-patch/v12.1.63/patch-offline-runtime63.py /tmp/OfflineRuntime59.java /tmp/OfflineRuntime.java >> "$LOG" 2>&1
RC=$?; echo "PATCH63_RC=$RC" >> "$LOG"; [ "$RC" -eq 0 ] || exit "$RC"
ANDROID_JAR="$(find "$ANDROID_HOME/platforms" -name android.jar | sort -V | tail -1)"
rm -rf /tmp/javac63-preflight; mkdir -p /tmp/javac63-preflight
javac -encoding UTF-8 -source 8 -target 8 -cp "$ANDROID_JAR" -d /tmp/javac63-preflight /tmp/OfflineRuntime.java >> "$LOG" 2>&1
RC=$?; echo "JAVAC_RC=$RC" >> "$LOG"
if [ "$RC" -eq 0 ]; then grep -q 'Nava:OfflineDownload63' /tmp/OfflineRuntime.java; G=$?; echo "WAKELOCK_MARK_RC=$G" >> "$LOG"; [ "$G" -eq 0 ] || RC=$G; fi
exit "$RC"
