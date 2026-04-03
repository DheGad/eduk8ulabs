import http from 'k6/http';
import { check, sleep } from 'k6';

// 50 concurrent users
export const options = {
  vus: 50,
  duration: '30s', // Keep it short but aggressive
};

export default function () {
  // Assuming the router service runs on port 4000 based on standard architecture configuration
  const url = 'http://localhost:4000/api/v1/execute';
  
  const payload = JSON.stringify({
    user_id: `load-test-vu-${__VU}`,
    prompt: "Health check packet. Respond with ACK.",
    provider: "streetmp",
    model: "system-test-model"
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': 'load-tenant-1',
      // Include bypass auth tokens if your security system intercepts these
      'Authorization': 'Bearer mock-load-test-token',
    },
  };

  const res = http.post(url, payload, params);

  // Assertions mapping to health / load stability
  check(res, {
    'is status 200': (r) => r.status === 200,
    'transaction time < 1000ms': (r) => r.timings.duration < 1000,
  });

  // Short sleep to simulate rapid-fire usage
  sleep(0.5);
}
