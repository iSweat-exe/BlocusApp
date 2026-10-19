import { describe, expect, it } from "vitest";
import { detectInstallMode } from "./install";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36";

function device(userAgent: string, options: { standalone?: boolean; displayStandalone?: boolean }) {
  return {
    navigator: { userAgent, maxTouchPoints: 0, standalone: options.standalone },
    matchMedia: () => ({ matches: options.displayStandalone ?? false }),
  };
}

describe("detectInstallMode", () => {
  it("skips the step once the app runs installed, on iOS and elsewhere", () => {
    expect(detectInstallMode(device(IPHONE, { standalone: true }), false)).toBe("installed");
    expect(detectInstallMode(device(ANDROID, { displayStandalone: true }), true)).toBe("installed");
  });

  it("explains Share > Add to Home Screen in Safari on iOS, which has no install prompt", () => {
    expect(detectInstallMode(device(IPHONE, {}), false)).toBe("ios");
  });

  it("offers the native prompt only when the browser handed one over", () => {
    expect(detectInstallMode(device(ANDROID, {}), true)).toBe("prompt");
    expect(detectInstallMode(device(ANDROID, {}), false)).toBe("unavailable");
  });
});
