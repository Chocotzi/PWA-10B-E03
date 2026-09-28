import { mkdir, writeFile } from "node:fs/promises";

const baseUrl = process.env.RENDERING_BASE_URL ?? "http://localhost:3000";
const targets = [
  { route: "/inspecciones", kind: "csr-shell" },
  { route: "/inspecciones/inspection-002", kind: "ssr-detail" },
];

const measurements = [];
const percentile = (values, percentage) => {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percentage / 100) * sorted.length) - 1);
  return sorted[index];
};

for (const target of targets) {
  await fetch(`${baseUrl}${target.route}`);
  const samples = [];
  let lastBody = "";
  let lastStatus = 0;

  for (let index = 0; index < 10; index += 1) {
    const startedAt = performance.now();
    const response = await fetch(`${baseUrl}${target.route}`);
    const body = await response.text();
    samples.push(performance.now() - startedAt);
    lastBody = body;
    lastStatus = response.status;
  }

  measurements.push({
    route: target.route,
    kind: target.kind,
    status: lastStatus,
    htmlBytes: Buffer.byteLength(lastBody),
    containsSyntheticData: lastBody.includes("Laboratorio de"),
    ttfbMs: {
      median: Number(percentile(samples, 50).toFixed(2)),
      p90: Number(percentile(samples, 90).toFixed(2)),
    },
    samples: samples.map((sample) => Number(sample.toFixed(2))),
  });
}

await mkdir("reports", { recursive: true });
await writeFile(
  "reports/rendering-metrics.json",
  `${JSON.stringify({ baseUrl, measuredAt: new Date().toISOString(), measurements }, null, 2)}\n`,
);
console.log("Rendering metrics written to reports/rendering-metrics.json");
