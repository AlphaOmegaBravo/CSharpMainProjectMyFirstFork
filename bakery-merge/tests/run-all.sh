#!/bin/sh
# Runs every Bakery Merge test suite; exits non-zero if any check fails.
cd "$(dirname "$0")" || exit 1
fail=0
for t in i18n v1 v2 v3 v4 v5 v6 vk v8; do
  echo "== $t"
  out=$(node "$t.js" 2>&1); echo "$out" | grep -E "FAIL|ALL PASSED|ERRORS|missing" 
  echo "$out" | grep -q "FAIL" && fail=1
done
node balance.js 3 | tail -2
node perf.js
exit $fail
