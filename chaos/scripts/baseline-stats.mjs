import { readFileSync } from 'node:fs';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Uso: node baseline-stats.mjs run-1.json run-2.json run-3.json');
  process.exit(1);
}

const median = (values) => {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const rows = files.map((file) => {
  const m = JSON.parse(readFileSync(file, 'utf8')).metrics;
  const dur = m.http_req_duration;
  return {
    archivo: file,
    peticiones: m.http_reqs.count,
    exito_pct: Number(((1 - m.http_req_failed.value) * 100).toFixed(3)),
    p95_ms: Number(dur['p(95)'].toFixed(2)),
  };
});

console.table(rows);

const med = {
  exito_pct: median(rows.map((r) => r.exito_pct)),
  p95_ms: median(rows.map((r) => r.p95_ms)),
  p99_ms: median(rows.map((r) => r.p99_ms)),
};
console.log('Mediana de las ejecuciones:', med);
console.log(
  'Umbral sugerido (mediana p95 x 1.5, redondeado a 50 ms):',
  Math.ceil((med.p95_ms * 1.5) / 50) * 50,
);