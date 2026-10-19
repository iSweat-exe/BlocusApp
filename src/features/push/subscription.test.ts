import { describe, expect, it } from "vitest";
import {
  explainInvalidSubscription,
  isAllowedPushEndpoint,
  parsePushSubscription,
} from "./subscription";

const KEY = "B".repeat(87);
const AUTH = "a".repeat(22);

describe("isAllowedPushEndpoint", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc123def456",
    "https://jmt17.google.com/fcm/send/abc123def456",
    "https://updates.push.services.mozilla.com/wpush/v2/abcdef123456",
    "https://web.push.apple.com/QWERTY12345678901234",
    "https://wns2-par02p.notify.windows.com/w/?token=abc123",
  ])("accepts the push service %s", (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    ["an arbitrary host", "https://evil.example.com/push/abcdefghij"],
    ["a look-alike host", "https://fcm.googleapis.com.evil.example.com/abcdefghij"],
    [
      "a look-alike of the staging FCM host",
      "https://jmt17.google.com.evil.example.com/abcdefghij",
    ],
    ["another Google host", "https://storage.googleapis.com/some-bucket/abcdefghij"],
    ["a look-alike suffix", "https://evilpush.apple.com.example.org/abcdefghij"],
    ["plain HTTP", "http://fcm.googleapis.com/fcm/send/abc123def456"],
    ["credentials in the URL", "https://user:pass@fcm.googleapis.com/fcm/send/abc"],
    ["a custom port", "https://fcm.googleapis.com:8443/fcm/send/abc123def"],
    ["a local address", "https://localhost/fcm/send/abc123def456"],
    ["not a URL", "fcm.googleapis.com/fcm/send/abc123def456"],
    ["too long", `https://fcm.googleapis.com/${"a".repeat(2048)}`],
  ])("refuses %s", (_name, endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });

  it("refuses a value that is not a string", () => {
    expect(isAllowedPushEndpoint(undefined)).toBe(false);
    expect(isAllowedPushEndpoint({})).toBe(false);
  });
});

describe("parsePushSubscription", () => {
  const valid = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc123def456",
    keys: { p256dh: KEY, auth: AUTH },
  };

  it("reads what the browser serializes, and drops the rest", () => {
    expect(parsePushSubscription({ ...valid, expirationTime: null, extra: "x" })).toEqual({
      endpoint: valid.endpoint,
      p256dh: KEY,
      auth: AUTH,
    });
  });

  it.each([
    ["null", null],
    ["no keys", { endpoint: valid.endpoint }],
    ["a bad endpoint", { ...valid, endpoint: "https://evil.example.com/abcdefghijkl" }],
    ["a short p256dh", { ...valid, keys: { p256dh: "short", auth: AUTH } }],
    ["a p256dh with a forbidden character", { ...valid, keys: { p256dh: `${KEY}+`, auth: AUTH } }],
    ["a long auth", { ...valid, keys: { p256dh: KEY, auth: "a".repeat(40) } }],
    ["a non-string auth", { ...valid, keys: { p256dh: KEY, auth: 1 } }],
  ])("refuses %s", (_name, input) => {
    expect(parsePushSubscription(input)).toBeNull();
  });
});

describe("explainInvalidSubscription", () => {
  const keys = { p256dh: KEY, auth: AUTH };

  it("names the push service host of a browser that is not supported, and nothing else of the address", () => {
    const reason = explainInvalidSubscription({
      endpoint: "https://push.example.org/secret-device-token",
      keys,
    });
    expect(reason).toBe("service de notification non reconnu (push.example.org)");
    expect(reason).not.toContain("secret-device-token");
  });

  it.each([
    ["nothing", null, "abonnement vide"],
    ["no address", { keys }, "adresse absente"],
    [
      "a plain HTTP address",
      { endpoint: "http://fcm.googleapis.com/fcm/send/abc123def456", keys },
      "adresse non sécurisée",
    ],
    ["an unreadable address", { endpoint: "not a url at all, really", keys }, "adresse illisible"],
    ["no keys", { endpoint: "https://fcm.googleapis.com/fcm/send/abc123def456" }, "clés absentes"],
    [
      "bad keys",
      {
        endpoint: "https://fcm.googleapis.com/fcm/send/abc123def456",
        keys: { p256dh: "x", auth: "y" },
      },
      "clés de chiffrement invalides",
    ],
  ])("says what is wrong with %s", (_name, input, expected) => {
    expect(explainInvalidSubscription(input)).toBe(expected);
  });
});
