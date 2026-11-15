const fault = profile.fault;
const scenarios = {
  fixed_profile: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: profile.stages,
    gracefulRampDown: '10s',
  },
};

if (__ENV.ENABLE_FAULT === 'true' && fault) {
  scenarios.fault_window = {
    executor: 'constant-arrival-rate',
    rate: fault.rate,
    timeUnit: '1s',
    duration: fault.duration,
    startTime: fault.startTime,
    preAllocatedVUs: 10,
    exec: 'faulted',
  };
}

export const options = { scenarios, thresholds: profile.thresholds };

export function faulted() {
  const res = http.get(`${BASE}/api/v2/products`, {
    headers: { 'x-chaos-token': __ENV.CHAOS_TOKEN, 'x-inject-fault': fault.header },
    tags: { chaos: 'true' },
  });
  check(res, { 'response 200 or 500 injected': (r) => r.status === 200 || r.status === 500 });
}