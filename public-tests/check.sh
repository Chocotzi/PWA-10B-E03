#!/usr/bin/env bash
set -euo pipefail
test -e 'public/manifest.webmanifest' && test -e 'src/app/layout.tsx' && test -e 'src/app/page.tsx' && test -e 'src/components/app-shell.tsx' && test -e 'tests/manifest.spec.ts'
test -f README.md
! rg -n -i '(api[_-]?key|secret|password|token)' --glob '!public-tests/check.sh' .
echo PUBLIC_OK

