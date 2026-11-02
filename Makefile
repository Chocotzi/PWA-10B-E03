.PHONY: verify test build lint typecheck e2e e2e-browser scan-secrets audit

# Semana 8: `make verify` ejecuta comprobaciones reales y se detiene con error en la primera que falle.
# Semana 9: agrega el escaneo de secretos del repositorio (determinista y sin red).
# Equivalente exacto sin make (Windows):
#   npm run lint && npm run typecheck && npm run verify && npm run scan:secrets && npm test
verify:
	npm run lint
	npm run typecheck
	npm run verify
	npm run scan:secrets
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

# Semana 9: credenciales en el repositorio y, después de `npm run build`, en el bundle.
scan-secrets:
	npm run scan:secrets
	npm run scan:secrets -- --bundle

# Semana 9: avisos de seguridad en dependencias de producción (umbral high). Requiere red, por eso no
# forma parte de `make verify`; corre en CI en cada push.
audit:
	npm run audit:deps
