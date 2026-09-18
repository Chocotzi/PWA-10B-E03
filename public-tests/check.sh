#!/usr/bin/env bash
set -euo pipefail
test -e 'public/sw.js' && test -e 'src/lib/pwa/register-service-worker.ts' && test -e 'docs/cache-strategy.md' && test -e 'tests/service-worker.spec.ts' && test -e 'tests/offline.spec.ts'
test -f README.md
! rg -n -i '(api[_-]?key|secret|password|token)' --glob '!public-tests/check.sh' .
echo PUBLIC_OK
