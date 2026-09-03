HOW TO ADD A PROXY
==================

Proxies are external links, not wrapped content. Create a folder inside
proxies/, e.g. proxies/my-link/, containing a proxy.txt file:

  Link: https://example.com/
  Description: What this site is.
  Status: All Good

Statuses are one of: All Good / Issue / Blocked.
They are maintained BY HAND — nothing auto-verifies them.

Then run:

  bun run catalog

The card opens the destination in a new tab (with a NULL redirect
confirmation first). Proxies are never loaded inside the player.
