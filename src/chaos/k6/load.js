import http from 'k6/http';
import { check, sleep } from 'k6';

const profile = JSON.parse(open('./profile.json'));

export const options = {
  scenarios: {
    fixed_profile: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: profile.stages,
      gracefulRampDown: '10s',
    },
  },
  thresholds: profile.thresholds,
};

const BASE = __ENV.BASE_URL;
const FAULT = __ENV.FAULT || '';
const TOKEN = __ENV.CHAOS_TOKEN || '';

export default function () {
  const headers = FAULT ? { 'x-chaos-fault': FAULT, 'x-chaos-token': TOKEN } : {};
  const res = http.get(`${BASE}/api/v2/products`, { headers });
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(1);
}