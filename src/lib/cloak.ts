/* NULL · cloak.ts
   Tab cloaks: what NULL's tab calls itself.

   A cloak is a title and an icon, nothing more. It does not hide anything from
   a network or a teacher's console — it changes what the tab strip says, which
   is the whole of what a tab strip can say. Being clear about that is better
   than implying more.

   Every icon is drawn here as a few shapes in the site's own colours and
   carried as a data URI, so a cloak costs no request, works offline, and
   looks like the door it is pretending to be at 16px in a tab strip — which
   is the size it is actually seen at, and the size a letter on a tile never
   survives.

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

function uri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg).replace(/%20/g, " ")}`;
}

/** One 32px icon: a rounded sheet in the site's colour, and a mark on it. */
function mark(bg: string, art: string): string {
  return uri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
      `<rect width="32" height="32" rx="6" fill="${bg}"/>` +
      art +
      `</svg>`,
  );
}

/* ---------- the marks ---------- */

/* Google's four-colour G, the one cloak that is worth drawing exactly */
const GOOGLE = uri(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<rect width="32" height="32" rx="6" fill="#ffffff"/>` +
    `<path d="M16 10.6c1.7 0 3.2.6 4.4 1.7l3.3-3.3A14 14 0 0 0 16 6a10 10 0 0 0-9 5.6l3.8 3a6 6 0 0 1 5.2-4z" fill="#4285f4"/>` +
    `<path d="M7 11.6 10.8 15a6 6 0 0 0 0 3.4L7 22a10 10 0 0 1 0-10.4z" fill="#fbbc05"/>` +
    `<path d="M16 26a10 10 0 0 0 6.9-2.5l-3.3-2.7A6 6 0 0 1 10.8 18L7 22a10 10 0 0 0 9 4z" fill="#34a853"/>` +
    `<path d="M23.5 23.5A10 10 0 0 0 26 16.5h-10v3.9h5.6a4.8 4.8 0 0 1-2.1 3.1z" fill="#4285f4"/>` +
    `</svg>`,
);

/* a page: the empty one, and the document Google Docs opens on */
const ABOUT_BLANK = uri(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#ffffff"/></svg>`,
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

/* the drive triangle */
const DRIVE = uri(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<rect width="32" height="32" rx="6" fill="#ffffff"/>` +
    `<path d="M12 6h8l8 14h-8z" fill="#fbbc05"/>` +
    `<path d="M12 6 4 20h8l8-14z" fill="#34a853"/>` +
    `<path d="M4 20h24l-4 6H8z" fill="#4285f4"/>` +
    `</svg>`,
);

/* the envelope, cut to its two diagonals */
const GMAIL = uri(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<rect width="32" height="32" rx="6" fill="#ffffff"/>` +
    `<path d="M6 10v13h4v-8l6 4.5L22 15v8h4V10l-10 7.4z" fill="#ea4335"/>` +
    `<rect x="6" y="9" width="20" height="3" fill="#c5221f"/>` +
    `</svg>`,
);

/* a chalkboard with a class standing in front of it */
const CLASSROOM = mark(
  "#0f9d58",
  `<rect x="4" y="5" width="24" height="22" rx="2.5" fill="#f1f3f4"/>` +
    `<circle cx="12.5" cy="13.5" r="3" fill="#0f9d58"/>` +
    `<path d="M7.6 24c0-3.1 2.1-4.9 4.9-4.9s4.9 1.8 4.9 4.9z" fill="#0f9d58"/>` +
    `<rect x="19" y="11" width="6" height="1.8" rx=".9" fill="#0f9d58"/>` +
    `<rect x="19" y="15.2" width="6" height="1.8" rx=".9" fill="#0f9d58"/>` +
    `<rect x="19" y="19.4" width="3.6" height="1.8" rx=".9" fill="#0f9d58"/>`,
);

/* the swirl canvas opens on */
const CANVAS = mark(
  "#e23e2e",
  `<path d="M9.5 18.5A7 7 0 0 1 20 9.8" fill="none" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round"/>` +
    `<path d="M22.5 13.5A7 7 0 0 1 12 22.2" fill="none" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round"/>` +
    `<circle cx="16" cy="16" r="3" fill="#ffffff"/>`,
);

/* clever's swoosh through a C */
const CLEVER = mark(
  "#4273c5",
  `<path d="M22.5 19.5a7.5 7.5 0 1 1 0-7" fill="none" stroke="#ffffff" stroke-width="3.4" stroke-linecap="round"/>` +
    `<path d="M19.4 15.2l4.6 1.2" stroke="#ffffff" stroke-width="3.4" stroke-linecap="round"/>`,
);

/* the khan badge: one leaf, drawn as the academy draws it */
const KHAN = mark(
  "#14bf96",
  `<path d="M16 6.5c3.9 3.9 5.8 6.9 5.8 9.7a5.8 5.8 0 0 1-11.6 0c0-2.8 1.9-5.8 5.8-9.7z" fill="#ffffff"/>` +
    `<path d="M16 12v11" stroke="#14bf96" stroke-width="1.6" stroke-linecap="round"/>`,
);

/* schoology's S, as one stroke */
const SCHOOLOGY = mark(
  "#0072ce",
  `<path d="M21.5 12.4c-.9-1.5-2.9-2.4-4.9-2.4-2.4 0-4 1.1-4 2.9 0 4 8 2 8 6 0 1.9-2 3.1-4.6 3.1-2.2 0-4.1-1-5.1-2.6" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>`,
);

/* two cards in the deck */
const QUIZLET = mark(
  "#4255ff",
  `<rect x="9" y="7" width="14" height="8.6" rx="2.2" fill="#ffffff" opacity=".72"/>` +
    `<rect x="9" y="16.4" width="14" height="8.6" rx="2.2" fill="#ffffff"/>`,
);

/* the creature, with its eyes cut back out */
const BLOOKET = mark(
  "#3b4b8f",
  `<path d="M8 14a8 8 0 0 1 16 0v8a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4z" fill="#ffffff"/>` +
    `<circle cx="13" cy="16" r="1.7" fill="#3b4b8f"/>` +
    `<circle cx="19" cy="16" r="1.7" fill="#3b4b8f"/>` +
    `<path d="M13 21h6" stroke="#3b4b8f" stroke-width="1.6" stroke-linecap="round"/>`,
);

/* the play triangle */
const EDPUZZLE = mark(
  "#ff6b35",
  `<path d="M12 7.5l14 8.5-14 8.5z" fill="#ffffff"/>`,
);

/* kahoot's three bars */
const KAHOOT = mark(
  "#46178f",
  `<rect x="7" y="9" width="10.5" height="4.4" rx="2.2" fill="#ffffff"/>` +
    `<rect x="14.5" y="14.8" width="10.5" height="4.4" rx="2.2" fill="#ffffff"/>` +
    `<rect x="7" y="20.6" width="10.5" height="4.4" rx="2.2" fill="#ffffff" opacity=".72"/>`,
);

/* the globe */
const WIKIPEDIA = mark(
  "#ffffff",
  `<circle cx="16" cy="16" r="8.6" fill="none" stroke="#202122" stroke-width="2"/>` +
    `<ellipse cx="16" cy="16" rx="3.9" ry="8.6" fill="none" stroke="#202122" stroke-width="1.6"/>` +
    `<path d="M7.4 16h17.2" stroke="#202122" stroke-width="1.6"/>` +
    `<path d="M9.3 11.4h13.4M9.3 20.6h13.4" stroke="#202122" stroke-width="1.2"/>`,
);

/* an open book */
const CAMPUS = mark(
  "#00a0df",
  `<path d="M6 9.5h8.2a2.4 2.4 0 0 1 2.4 2.4v11.6a2.4 2.4 0 0 0-2.4-2.4H6z" fill="#ffffff"/>` +
    `<path d="M26 9.5h-8.2a2.4 2.4 0 0 0-2.4 2.4v11.6a2.4 2.4 0 0 1 2.4-2.4H26z" fill="#ffffff" opacity=".7"/>`,
);

/* the shield with its two halves */
const POWERSCHOOL = mark(
  "#e21836",
  `<path d="M16 6l8 2.8v7.4c0 4.9-3.4 8.3-8 9.8-4.6-1.5-8-4.9-8-9.8V8.8z" fill="#ffffff"/>` +
    `<path d="M16 9.6v13.6c-2.9-1.2-4.8-3.6-4.8-6.5V11.5z" fill="#e21836" opacity=".55"/>` +
    `<circle cx="16" cy="15" r="2.3" fill="#e21836"/>`,
);

/* the mortarboard, for the one that is a lesson */
const IREADY = mark(
  "#f27a1a",
  `<path d="M6 12.5l10-4.2 10 4.2-10 4.2z" fill="#ffffff"/>` +
    `<path d="M13.6 18.5h4.8V26a2.4 2.4 0 0 1-4.8 0z" fill="#ffffff"/>` +
    `<path d="M24.4 13.4v5.4" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>`,
);

/* ---------- the list ----------
   Order matters: the first few are the ones people actually reach for. */
export const CLOAKS: Cloak[] = [
  { id: "off", name: "Off", title: "null", icon: "/favicon.svg" },
  { id: "blank", name: "About:Blank", title: "about:blank", icon: ABOUT_BLANK },
  { id: "google", name: "Google", title: "Google", icon: GOOGLE },
  { id: "classroom", name: "Classroom", title: "Classes", icon: CLASSROOM },
  { id: "docs", name: "Google Docs", title: "Untitled document - Google Docs", icon: DOCS },
  { id: "drive", name: "Google Drive", title: "My Drive - Google Drive", icon: DRIVE },
  { id: "gmail", name: "Gmail", title: "Inbox (1) - Gmail", icon: GMAIL },
  { id: "clever", name: "Clever", title: "Clever | Portal", icon: CLEVER },
  { id: "canvas", name: "Canvas", title: "Dashboard", icon: CANVAS },
  { id: "khan", name: "Khan Academy", title: "Khan Academy", icon: KHAN },
  { id: "schoology", name: "Schoology", title: "Home | Schoology", icon: SCHOOLOGY },
  { id: "quizlet", name: "Quizlet", title: "Flashcards, learning tools and textbook solutions | Quizlet", icon: QUIZLET },
  { id: "blooket", name: "Blooket", title: "Blooket", icon: BLOOKET },
  { id: "edpuzzle", name: "Edpuzzle", title: "Edpuzzle", icon: EDPUZZLE },
  { id: "kahoot", name: "Kahoot!", title: "Kahoot!", icon: KAHOOT },
  { id: "wikipedia", name: "Wikipedia", title: "Wikipedia, the free encyclopedia", icon: WIKIPEDIA },
  { id: "campus", name: "Infinite Campus", title: "Infinite Campus", icon: CAMPUS },
  { id: "powerschool", name: "PowerSchool", title: "PowerSchool", icon: POWERSCHOOL },
  { id: "iready", name: "i-Ready", title: "i-Ready", icon: IREADY },
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
