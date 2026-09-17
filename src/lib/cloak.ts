/* NULL · cloak.ts
   Tab cloaks: what NULL's tab calls itself.

   A cloak is a title and an icon, nothing more. It does not hide anything from
   a network or a teacher's console — it changes what the tab strip says, which
   is the whole of what a tab strip can say. Being clear about that is better
   than implying more.

   Smart Cloak is the same idea with the choosing done for you: it reads the
   clock and the weekday and picks a disguise that fits the hour, so the tab
   never tells the same story twice in a day. */

export type Cloak = {
  id: string;
  name: string;
  title: string;
  /** a data URI, so a cloak costs no request and works offline */
  icon: string;
};

/** A letter on a coloured tile: what most of these look like at 16px. */
function tile(bg: string, letter: string, ink = "#ffffff"): string {
  return uri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
      `<rect width="32" height="32" rx="6" fill="${bg}"/>` +
      `<text x="16" y="23" font-family="system-ui,sans-serif" font-size="19" font-weight="700" text-anchor="middle" fill="${ink}">${letter}</text>` +
      `</svg>`,
  );
}

function uri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg).replace(/%20/g, " ")}`;
}

/* ---------- the marks that are worth drawing properly ---------- */

const GOOGLE = uri(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<rect width="32" height="32" rx="6" fill="#ffffff"/>` +
    `<path d="M16 10.6c1.7 0 3.2.6 4.4 1.7l3.3-3.3A14 14 0 0 0 16 6a10 10 0 0 0-9 5.6l3.8 3a6 6 0 0 1 5.2-4z" fill="#4285f4"/>` +
    `<path d="M7 11.6 10.8 15a6 6 0 0 0 0 3.4L7 22a10 10 0 0 1 0-10.4z" fill="#fbbc05"/>` +
    `<path d="M16 26a10 10 0 0 0 6.9-2.5l-3.3-2.7A6 6 0 0 1 10.8 18L7 22a10 10 0 0 0 9 4z" fill="#34a853"/>` +
    `<path d="M23.5 23.5A10 10 0 0 0 26 16.5h-10v3.9h5.6a4.8 4.8 0 0 1-2.1 3.1z" fill="#4285f4"/>` +
    `</svg>`,
);

const DOCS = uri(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<rect width="32" height="32" rx="6" fill="#ffffff"/>` +
    `<rect x="8" y="5" width="16" height="22" rx="2" fill="#4285f4"/>` +
    `<rect x="11" y="11" width="10" height="1.6" rx=".8" fill="#fff"/>` +
    `<rect x="11" y="15" width="10" height="1.6" rx=".8" fill="#fff"/>` +
    `<rect x="11" y="19" width="6" height="1.6" rx=".8" fill="#fff"/>` +
    `</svg>`,
);

const DRIVE = uri(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<rect width="32" height="32" rx="6" fill="#ffffff"/>` +
    `<path d="M12 6h8l8 14h-8z" fill="#fbbc05"/>` +
    `<path d="M12 6 4 20h8l8-14z" fill="#34a853"/>` +
    `<path d="M4 20h24l-4 6H8z" fill="#4285f4"/>` +
    `</svg>`,
);

const GMAIL = uri(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<rect width="32" height="32" rx="6" fill="#ffffff"/>` +
    `<path d="M6 10v13h4v-8l6 4.5L22 15v8h4V10l-10 7.4z" fill="#ea4335"/>` +
    `<rect x="6" y="9" width="20" height="3" fill="#c5221f"/>` +
    `</svg>`,
);

const ABOUT_BLANK = uri(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#ffffff"/></svg>`,
);

/* ---------- the list ----------
   Order matters: the first few are the ones people actually reach for. */
export const CLOAKS: Cloak[] = [
  { id: "off", name: "Off", title: "null", icon: "/favicon.svg" },
  { id: "blank", name: "About:Blank", title: "about:blank", icon: ABOUT_BLANK },
  { id: "google", name: "Google", title: "Google", icon: GOOGLE },
  { id: "classroom", name: "Classroom", title: "Classes", icon: tile("#0f9d58", "C") },
  { id: "docs", name: "Google Docs", title: "Untitled document - Google Docs", icon: DOCS },
  { id: "drive", name: "Google Drive", title: "My Drive - Google Drive", icon: DRIVE },
  { id: "gmail", name: "Gmail", title: "Inbox (1) - Gmail", icon: GMAIL },
  { id: "clever", name: "Clever", title: "Clever | Portal", icon: tile("#4273c5", "C") },
  { id: "canvas", name: "Canvas", title: "Dashboard", icon: tile("#e23e2e", "C") },
  { id: "khan", name: "Khan Academy", title: "Khan Academy", icon: tile("#14bf96", "K") },
  { id: "schoology", name: "Schoology", title: "Home | Schoology", icon: tile("#0072ce", "S") },
  { id: "quizlet", name: "Quizlet", title: "Flashcards, learning tools and textbook solutions | Quizlet", icon: tile("#4255ff", "Q") },
  { id: "wikipedia", name: "Wikipedia", title: "Wikipedia, the free encyclopedia", icon: tile("#ffffff", "W", "#202122") },
  { id: "campus", name: "Infinite Campus", title: "Infinite Campus", icon: tile("#00a0df", "IC") },
  { id: "powerschool", name: "PowerSchool", title: "PowerSchool", icon: tile("#e21836", "P") },
  { id: "iready", name: "i-Ready", title: "i-Ready", icon: tile("#f27a1a", "i") },
];

export const SMART_ID = "smart";

/** The disguise the clock picks. Weekday mornings look like school work,
 *  afternoons like a document, evenings like something to read. */
export function smartPick(now = new Date()): Cloak {
  const byId = (id: string) => CLOAKS.find((c) => c.id === id) ?? CLOAKS[0];
  const day = now.getDay();
  const hour = now.getHours();
  const school = day >= 1 && day <= 5;

  if (school && hour < 12) return Math.random() < 0.5 ? byId("classroom") : byId("docs");
  if (school && hour < 16) return Math.random() < 0.5 ? byId("drive") : byId("clever");
  if (hour < 21) return Math.random() < 0.5 ? byId("google") : byId("wikipedia");
  return Math.random() < 0.5 ? byId("quizlet") : byId("khan");
}

/** Which cloak should be on right now. `panic` overrides the setting, which
 *  is what the panic key flips. */
export function cloakFor(setting: string, panic: boolean): Cloak {
  if (panic) return setting === "off" || setting === SMART_ID ? smartPick() : pick(setting);
  if (setting === "off") return CLOAKS[0];
  if (setting === SMART_ID) return smartPick();
  return pick(setting);
}

export function pick(id: string): Cloak {
  return CLOAKS.find((c) => c.id === id) ?? CLOAKS[0];
}

/** Write the cloak onto the document. The icon link is created once and then
 *  reused, so switching cloaks does not stack up <link> tags. */
export function applyCloak(cloak: Cloak) {
  document.title = cloak.title;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.append(link);
  }
  if (link.getAttribute("href") !== cloak.icon) link.setAttribute("href", cloak.icon);
}
