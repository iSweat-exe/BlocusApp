import { describe, expect, it } from "vitest";
import { detectPushSupport, urlBase64ToUint8Array } from "./device";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15";
const IPAD_AS_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36";

function device(options: {
  userAgent: string;
  touch?: number;
  standalone?: boolean;
  displayStandalone?: boolean;
  push?: boolean;
}) {
  return {
    navigator: {
      userAgent: options.userAgent,
      maxTouchPoints: options.touch ?? 0,
      standalone: options.standalone,
      serviceWorker: {},
    },
    matchMedia: () => ({ matches: options.displayStandalone ?? false }),
    ...(options.push === false ? {} : { PushManager: {}, Notification: {} }),
  };
}

describe("detectPushSupport", () => {
  it("asks iPhone users to install the app first, even if Safari hides the push API", () => {
    expect(detectPushSupport(device({ userAgent: IPHONE, push: false }), true)).toBe(
      "needs-install",
    );
  });

  it("recognizes an iPad that reports itself as a Mac", () => {
    expect(detectPushSupport(device({ userAgent: IPAD_AS_MAC, touch: 5 }), true)).toBe(
      "needs-install",
    );
  });

  it("supports an installed iPhone app (home screen)", () => {
    expect(detectPushSupport(device({ userAgent: IPHONE, standalone: true }), true)).toBe(
      "supported",
    );
    expect(detectPushSupport(device({ userAgent: IPHONE, displayStandalone: true }), true)).toBe(
      "supported",
    );
  });

  it("supports Android in the browser, no installation needed", () => {
    expect(detectPushSupport(device({ userAgent: ANDROID }), true)).toBe("supported");
  });

  it("does not take a desktop Mac without touch for an iPad", () => {
    expect(detectPushSupport(device({ userAgent: IPAD_AS_MAC, touch: 0 }), true)).toBe("supported");
  });

  it("is unsupported without the push API, and in development (no service worker)", () => {
    expect(detectPushSupport(device({ userAgent: ANDROID, push: false }), true)).toBe(
      "unsupported",
    );
    expect(detectPushSupport(device({ userAgent: ANDROID }), false)).toBe("unsupported");
  });
});

describe("urlBase64ToUint8Array", () => {
  it("decodes base64url with or without padding", () => {
    expect([...urlBase64ToUint8Array("AQID")]).toEqual([1, 2, 3]);
    expect([...urlBase64ToUint8Array("AQI")]).toEqual([1, 2]);
    expect([...urlBase64ToUint8Array("-_8")]).toEqual([251, 255]);
  });
});
