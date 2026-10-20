import { describe, expect, it } from "vitest";
import { detectInstallMode } from "./install";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15";
const DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36";
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
  });

  it("explains the browser menu on Android when no native prompt came", () => {
    expect(detectInstallMode(device(ANDROID, {}), false)).toBe("android");
  });

  it("has nothing to offer on a desktop browser without the prompt", () => {
    expect(detectInstallMode(device(DESKTOP, {}), false)).toBe("unavailable");
  });
});
