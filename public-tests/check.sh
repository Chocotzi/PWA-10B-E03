#!/usr/bin/env bash
set -euo pipefail
test -e 'src/lib/device/camera.ts' && test -e 'src/lib/device/geolocation.ts' && test -e 'src/lib/notifications/client.ts' && test -e 'docs/capabilities.md' && test -e 'tests/capabilities.spec.ts'
test -f README.md
! rg -n -i '(api[_-]?key|secret|password|token)' --glob '!public-tests/check.sh' .
echo PUBLIC_OK

