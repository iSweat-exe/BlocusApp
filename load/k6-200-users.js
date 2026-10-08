// Load test: ~200 simultaneous users on a LOCAL build against a LOCAL Supabase (see docs/load-testing.md).
// Never point it at the production site: it would burn the free-tier quotas and could get the deployment paused.
//
// Each virtual user behaves like a phone user: open the home page, read, open the calendar, come back, sometimes
// ask for more announcements. Only HTML documents are requested (the worst case for the server: every visit is a
// full render), static assets are served by the CDN in production and cost no function invocation.
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://host.docker.internal:3200";
const VUS = Number(__ENV.VUS || 200);
// Optional session cookie value of a signed-in user (`blocus-auth`), used by one VU out of five.
const AUTH_COOKIE_NAME = __ENV.AUTH_COOKIE_NAME || "";
const AUTH_COOKIE_VALUE = __ENV.AUTH_COOKIE_VALUE || "";

export const options = {
  stages: [
    { duration: "30s", target: VUS }, // everybody arrives within 30 s
    { duration: __ENV.HOLD || "120s", target: VUS }, // the peak
    { duration: "15s", target: 0 },
  ],
  thresholds: {
    // Targets written in docs/load-testing.md. A failed threshold makes k6 exit with a non-zero code.
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800", "p(99)<2000"],
    checks: ["rate>0.99"],
  },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
};

/**
 * Fetches one page and checks that it really is the app (not an error page).
 * @param {string} path
 * @param {boolean} signedIn
 * @param {string} name
 */
function visit(path, signedIn, name) {
  const params = { tags: { name } };
  if (signedIn) params.headers = { Cookie: `${AUTH_COOKIE_NAME}=${AUTH_COOKIE_VALUE}` };
  const response = http.get(`${BASE_URL}${path}`, params);
  check(response, {
    [`${name}: status 200`]: (r) => r.status === 200,
    [`${name}: is the app`]: (r) => typeof r.body === "string" && r.body.includes("BlocusApp"),
  });
}

/** One user session: a few screens separated by realistic reading time. */
export default function () {
  const signedIn = AUTH_COOKIE_VALUE !== "" && __VU % 5 === 0;

  visit("/", signedIn, "home");
  sleep(3 + Math.random() * 5);

  visit("/calendar", signedIn, "calendar");
  sleep(3 + Math.random() * 5);

  if (Math.random() < 0.3) {
    visit("/?n=20", signedIn, "home-more");
    sleep(2 + Math.random() * 4);
  }

  visit("/", signedIn, "home");
  sleep(5 + Math.random() * 10);
}
