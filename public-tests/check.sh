#!/usr/bin/env bash
set -euo pipefail
test -e 'docs/threat-model.md' && test -e 'docs/privacy-data-inventory.md' && test -e 'src/lib/security/' && test -e 'tests/security.spec.ts' && test -e 'public/robots.txt'
test -f README.md
! rg -n -i '(api[_-]?key|secret|password|token)' --glob '!public-tests/check.sh' .
echo PUBLIC_OK

