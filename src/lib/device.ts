/* NULL · device.ts
   What this browser is, in one short line.

   The point is not analytics — nothing here is sent anywhere unless the
   member asks for the chip to be shown on their card, and even then it is a
   string a person can read: "Chrome · Windows", "Safari · iPhone". It exists
   because half of what a games hub gets asked is "why is this different on
   my machine", and the first answer is always what the machine is.

   Parsing a user agent is guesswork by nature, so it is done in the least
   clever order possible: the client hints when the browser offers them, then
   a short list of names to look for, then "unknown". Nothing here decides
   anything — no feature is switched on by this — so being wrong costs a
   slightly odd word on a card. */

export type Device = {
  browser: string;
  os: string;
  /** "Chrome · Windows" — what the chip prints */
  label: string;
  mobile: boolean;
  touch: boolean;
  /** rough, and deliberately not shown unless asked for in the console */
  cores: number;
  screen: string;
};

export function detectDevice(): Device {
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string; mobile?: boolean; brands?: { brand: string }[] };
    deviceMemory?: number;
  };
  const ua = nav.userAgent ?? "";
  const hints = nav.userAgentData;

  const browser = browserName(ua, hints?.brands);
  const os = hints?.platform && hints.platform !== "Unknown" ? hints.platform : osName(ua, nav.platform);
  const mobile = hints?.mobile ?? /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const touch = ("ontouchstart" in window) || (nav.maxTouchPoints ?? 0) > 0;

  return {
    browser,
    os,
    label: `${browser} · ${os}`,
    mobile,
    touch,
    cores: nav.hardwareConcurrency ?? 0,
    screen: `${window.screen?.width ?? 0}×${window.screen?.height ?? 0}`,
  };
}

/** The label, or null when the member has asked not to wear one. */
export function deviceTag(on: boolean): string | null {
  if (!on) return null;
  try {
    return detectDevice().label.slice(0, 40);
  } catch {
    return null;
  }
}

function browserName(ua: string, brands?: { brand: string }[]): string {
  /* Edge and Opera both claim to be Chrome, and Chrome claims to be Safari,
     so the order matters more than the check does */
  const named = /(Edg|OPR|Oculus|SamsungBrowser|Brave|Firefox|FxiOS|CriOS|Chrome|Safari)\//i.exec(ua)?.[1];
  if (named) {
    const short = named.toLowerCase();
    if (short === "edg") return "Edge";
    if (short === "opr") return "Opera";
    if (short === "fxios" || short === "firefox") return "Firefox";
    if (short === "crios" || short === "chrome") return "Chrome";
    if (short === "samsungbrowser") return "Samsung";
    if (short === "oculus") return "Quest";
    return named;
  }
  /* client hints name a few brands, and the last one is usually the real
     engine while the first is the one pretending to be it */
  const brand = brands?.map((b) => b.brand).find((b) => !/Not|Chromium/i.test(b));
  return brand ?? "unknown browser";
}

function osName(ua: string, platform: string): string {
  if (/Windows NT 10/.test(ua)) return "Windows";
  if (/Windows/.test(ua)) return "Windows";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPod/.test(ua)) return "iPhone";
  if (/iPad/.test(ua) || (platform === "MacIntel" && "ontouchend" in document)) return "iPad";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return platform || "unknown";
}
