/* NULL · favicon.ts
   What a proxied tab wears: the site's own icon and a readable name.

   The icon is Google's favicon service — one URL, any site, cached at the
   edge, no key. When a site has no icon (or the host is blocked) the img
   simply never draws and the globe underneath shows through, which is why
   the tab never carries a broken-image glyph.

   The name is the hostname with the noise taken off: no www, no TLD, the
   rest title-cased — `en.wikipedia.org` reads "En Wikipedia",
   `www.youtube.com` reads "Youtube". It is a tab label, not branding. */

export function faviconOf(url: string): string {
  let host = url;
  try {
    host = new URL(url).hostname;
  } catch {
    /* leave the raw string; the img will not load and the globe stays */
  }
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
}

/** The site's name, the way a tab bar would print it. */
export function siteName(url: string): string {
  let host = url;
  try {
    host = new URL(url).hostname;
  } catch {
    host = url.replace(/^https?:\/\//, "");
  }
  const words = host
    .replace(/^www\./, "")
    .split(".")
    .filter((part) => part && !/^(com|net|org|io|co|gg|me|tv|fm|sh|to|xyz|dev|app|pages?|github\.io)$/i.test(part) || host.split(".").length <= 2)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return words.join(" ") || host;
}
