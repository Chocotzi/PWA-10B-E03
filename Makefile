.PHONY: verify test build lint typecheck e2e e2e-browser

# Semana 8: `make verify` ejecuta comprobaciones reales y se detiene con error en la primera que falle.
# Equivalente exacto sin make (Windows):
#   npm run lint && npm run typecheck && npm run verify && npm test
verify:
	npm run lint
	npm run typecheck
	npm run verify
	npm test

test:
	npm test

build:
	npm run build

lint:
	npm run lint

typecheck:
	npm run typecheck

e2e:
	npm run test:e2e

# Requiere `npm run build` y el Chromium de Playwright (`npx playwright install chromium`).
e2e-browser:
	npm run test:e2e:browser
