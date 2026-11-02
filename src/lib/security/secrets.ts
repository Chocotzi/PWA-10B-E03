/**
 * Semana 9 · Tarea 2 (Carlos) · detección de credenciales en texto (T-08).
 *
 * `scanForSecrets(text)` busca formas conocidas de credenciales: claves de nube y de API, llaves
 * privadas, cadenas tipo JWT, credenciales dentro de URLs, asignaciones sospechosas y variables
 * `NEXT_PUBLIC_*` con nombre sensible (Next.js copia esas variables al bundle del navegador).
 * La usan `scripts/scan-secrets.mjs` (repositorio y bundle) y `tests/security.spec.ts`.
 * El archivo no importa nada: el script lo carga con `scripts/lib/import-ts.mjs`.
 *
 * Reglas de diseño:
 * - Un hallazgo nunca incluye el valor completo; el reporte de CI no debe convertirse en la filtración.
 * - Las reglas de proveedor buscan prefijos y longitudes con formato fijo; la regla genérica de
 *   asignación exige un literal con letras y dígitos y descarta marcadores evidentes («example»,
 *   «sintético», `${...}`), para no marcar código ni documentación normales.
 * - Las pruebas arman sus muestras en tiempo de ejecución: ningún archivo del repositorio contiene un
 *   literal con forma de credencial, ni siquiera de ejemplo.
 */

export type SecretRule = {
  id: string;
  description: string;
  /** Expresión con bandera `g`. */
  pattern: RegExp;
  /** Grupo con el valor que se oculta en el reporte (0 = coincidencia completa). */
  valueGroup?: number;
  /** Devuelve `false` para descartar coincidencias que no son credenciales. */
  accept?: (value: string) => boolean;
};

export type SecretFinding = {
  rule: string;
  description: string;
  /** Línea y columna, contadas desde 1. */
  line: number;
  column: number;
  /** Primeros caracteres y longitud del valor; nunca el valor completo. */
  redacted: string;
};

/** Marcadores de valores de ejemplo: un valor que se declara de mentira no es una credencial. */
const PLACEHOLDER_MARKERS = [
  "example",
  "ejemplo",
  "sample",
  "muestra",
  "placeholder",
  "changeme",
  "dummy",
  "fake",
  "falso",
  "sintetic",
  "synthetic",
  "redacted",
  "your",
  "xxxx",
  "****",
  "${",
  "{{",
  "<",
  "process.env",
  "import.meta.env",
];

export function isPlaceholder(value: string): boolean {
  const lower = value.toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => lower.indexOf(marker) >= 0);
}

/** Un literal parece credencial si no es marcador, no es ruta ni URL y mezcla letras con dígitos. */
export function looksLikeCredentialValue(value: string): boolean {
  if (value.length < 8 || isPlaceholder(value)) return false;
  if (/^(?:[a-z][a-z0-9+.-]*:\/\/|\.{0,2}\/)/i.test(value)) return false;
  return /[A-Za-z]/.test(value) && /[0-9]/.test(value);
}

/** Contraseña dentro de una URL (`esquema://usuario:contraseña@host`). */
function acceptUrlPassword(value: string): boolean {
  return !isPlaceholder(value) && !/^(?:pass(?:word)?|pwd|secret|contrase(?:ñ|n)a)$/i.test(value);
}

export const SECRET_RULES: SecretRule[] = [
  {
    id: "aws-access-key-id",
    description: "Clave de acceso de AWS",
    pattern: /\b(?:AKIA|ASIA|ABIA|ACCA)[A-Z2-7]{16}\b/g,
  },
  {
    id: "google-api-key",
    description: "Clave de API de Google Cloud o Firebase",
    pattern: /\bAIza[0-9A-Za-z_-]{35}(?![0-9A-Za-z_-])/g,
  },
  {
    id: "azure-storage-key",
    description: "Clave de cuenta de Azure Storage en una cadena de conexión",
    pattern: /AccountKey=([A-Za-z0-9+\/]{40,}={0,2})/g,
    valueGroup: 1,
  },
  {
    id: "github-token",
    description: "Token de GitHub",
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{22,255})\b/g,
  },
  {
    id: "npm-token",
    description: "Token de npm",
    pattern: /\bnpm_[A-Za-z0-9]{36}\b/g,
  },
  {
    id: "slack-token",
    description: "Token de Slack",
    pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  },
  {
    id: "stripe-secret-key",
    description: "Clave secreta o restringida de Stripe",
    pattern: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g,
  },
  {
    id: "sk-api-key",
    description: "Clave de API con prefijo sk- (OpenAI, Anthropic y similares)",
    pattern: /\bsk-(?:[A-Za-z0-9]+-){0,3}[A-Za-z0-9_-]{20,}/g,
    accept: (value) => /[0-9]/.test(value) && /[A-Za-z]/.test(value),
  },
  {
    id: "supabase-secret-key",
    description: "Clave secreta de Supabase",
    pattern: /\bsb_secret_[A-Za-z0-9_-]{20,}/g,
  },
  {
    id: "twilio-api-key",
    description: "Clave de API de Twilio",
    pattern: /\bSK[0-9a-fA-F]{32}\b/g,
  },
  {
    id: "private-key",
    description: "Llave privada (PEM, OpenSSH o PGP)",
    pattern: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/g,
  },
  {
    id: "jwt",
    description: "Cadena con forma de JWT (encabezado.carga.firma)",
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  },
  {
    id: "credential-in-url",
    description: "Usuario y contraseña dentro de una URL",
    pattern: /\b[a-z][a-z0-9+.-]{1,20}:\/\/[^\s:@\/"'`<>]{1,64}:([^\s@\/"'`<>]{3,128})@[^\s"'`<>]{1,256}/gi,
    valueGroup: 1,
    accept: acceptUrlPassword,
  },
  {
    id: "suspicious-assignment",
    description: "Literal asignado a un nombre de credencial (contraseña, token, clave)",
    pattern:
      /\b[A-Za-z0-9_.-]{0,40}?(?:passw(?:or)?d|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|auth[_-]?key|credential)[A-Za-z0-9_.-]{0,40}["']?[ \t]*(?::=|=(?![=>])|:)[ \t]*["'`]([^"'`\s]{8,512})["'`]/gi,
    valueGroup: 1,
    accept: looksLikeCredentialValue,
  },
  {
    id: "env-assignment",
    description: "Variable de entorno de credencial con valor (estilo .env o export)",
    pattern:
      /^[ \t]*(?:export[ \t]+|-[ \t]+)?[A-Z][A-Z0-9_]*(?:PASSWORD|PASSWD|PWD|SECRET|TOKEN|API_KEY|APIKEY|ACCESS_KEY|PRIVATE_KEY|AUTH_KEY|CREDENTIAL)[A-Z0-9_]*[ \t]*=[ \t]*([^\s"'`#]{8,512})/gm,
    valueGroup: 1,
    accept: looksLikeCredentialValue,
  },
  {
    id: "sensitive-public-env",
    description: "Variable NEXT_PUBLIC_* con nombre sensible (Next.js la copia al bundle del navegador)",
    pattern: /\bNEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE|SERVICE_ROLE|CREDENTIAL)[A-Z0-9_]*/g,
  },
];

/** Recorta un valor para el reporte: primeros 4 caracteres y la longitud. */
export function redact(value: string): string {
  return `${value.slice(0, 4)}… (${value.length} caracteres)`;
}

function lineStarts(text: string): number[] {
  const starts = [0];
  for (let index = text.indexOf("\n"); index >= 0; index = text.indexOf("\n", index + 1)) {
    starts.push(index + 1);
  }
  return starts;
}

function position(starts: number[], offset: number): { line: number; column: number } {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (starts[middle] <= offset) low = middle;
    else high = middle - 1;
  }
  return { line: low + 1, column: offset - starts[low] + 1 };
}

/** Busca credenciales en un texto. Devuelve los hallazgos ordenados por posición. */
export function scanForSecrets(text: string, rules: SecretRule[] = SECRET_RULES): SecretFinding[] {
  const findings: Array<SecretFinding & { offset: number }> = [];
  const starts = lineStarts(text);
  rules.forEach((rule) => {
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags.indexOf("g") >= 0 ? rule.pattern.flags : `${rule.pattern.flags}g`);
    let match = pattern.exec(text);
    while (match !== null) {
      const value = match[rule.valueGroup ?? 0] ?? match[0];
      if (!rule.accept || rule.accept(value)) {
        const offset = match.index + Math.max(0, match[0].indexOf(value));
        findings.push({ rule: rule.id, description: rule.description, ...position(starts, offset), redacted: redact(value), offset });
      }
      if (match[0].length === 0) pattern.lastIndex += 1;
      match = pattern.exec(text);
    }
  });
  return findings
    .sort((a, b) => a.offset - b.offset || a.rule.localeCompare(b.rule))
    .map(({ rule, description, line, column, redacted }) => ({ rule, description, line, column, redacted }));
}

/**
 * Archivos que no deben versionarse por su nombre (llaves, credenciales, variables de entorno).
 * `.env.example` sí se permite: documenta variables sin valores reales.
 */
export function isSensitiveFileName(path: string): boolean {
  const parts = path.split(/[\\/]/);
  const name = parts[parts.length - 1].toLowerCase();
  if (name === ".env.example") return false;
  if (name === ".env" || name.indexOf(".env.") === 0) return true;
  if (/\.(?:pem|key|p12|pfx|jks|keystore)$/.test(name)) return true;
  if (/^id_(?:rsa|dsa|ecdsa|ed25519)$/.test(name)) return true;
  return /^(?:credentials|.+\.credentials|service-account.*|gha-creds-.+)\.json$/.test(name);
}
