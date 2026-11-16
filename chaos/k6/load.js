// Perfil de carga

import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.BASE_URL;
const RUTA = __ENV.RUTA || '/api/v1/products';      
const P95_MS = Number(__ENV.P95_MS || 1600);          
const SOSTENIDO = __ENV.SOSTENIDO || '240s';        

if (!BASE) {
  throw new Error('Missing BASE_URL');
}

const scenarios = {
  perfil: {
    executor: 'ramping-vus',
    startVUs: 0,
    gracefulRampDown: '10s',
    stages: [
      { duration: '60s', target: 5 },
      { duration: '60s', target: 15 },
      { duration: '60s', target: 30 },
      { duration: SOSTENIDO, target: 30 },
    ],
  },
};

// Ventana opcional del experimento "header-fault": peticiones con el interruptor de fallos.
if (__ENV.ENABLE_FAULT === 'true') {
  scenarios.ventana_de_falla = {
    executor: 'constant-arrival-rate',
    rate: 10,
    timeUnit: '1s',
    duration: '2m',
    startTime: '2m',
    preAllocatedVUs: 10,
    exec: 'conFalla',
  };
}

export const options = {
  scenarios,
  thresholds: {
    // Hipótesis: éxito >= 99 % y p95 dentro del umbral. Aborta si se cae el servicio (éxito < 50 % o p95 > 15 s).
    http_req_failed: ['rate<0.01', { threshold: 'rate<0.5', abortOnFail: true, delayAbortEval: '20s' }],
    http_req_duration: [`p(95)<${P95_MS}`, { threshold: 'p(95)<15000', abortOnFail: true, delayAbortEval: '20s' }],
  },
};

export default function () {
  const r = http.get(`${BASE}${RUTA}`, { headers: { 'X-Trace-Id': `k6-${__VU}-${__ITER}` } });
  check(r, { 'status 200': (x) => x.status === 200 });
}

export function conFalla() {
  const r = http.get(`${BASE}${RUTA}`, {
    headers: { 'X-Trace-Id': `k6f-${__VU}-${__ITER}`, 'x-chaos-token': __ENV.CHAOS_TOKEN, 'x-inject-fault': 'error' },
    tags: { chaos: 'true' },
  });
  check(r, { 'respuesta 200 o 500 inyectado': (x) => x.status === 200 || x.status === 500 });
}
