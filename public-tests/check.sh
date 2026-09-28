#!/usr/bin/env bash
set -euo pipefail
test -e 'src/app/inspecciones/page.tsx' && test -e 'src/app/inspecciones/[id]/page.tsx' && test -e 'src/components/loading-state.tsx' && test -e 'docs/rendering-decision.md' && test -e 'tests/rendering.spec.ts'
test -f README.md
! rg -n -i '(api[_-]?key|secret|password|token)' --glob '!public-tests/check.sh' .
echo PUBLIC_OK
