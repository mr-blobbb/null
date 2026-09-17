HOW TO ADD AN APP
=================

Apps are the games page wearing a different word: same tile, same search,
same player window. The only difference is the entry's `kind`, and that an
app usually wants a smaller window.

Add one to src/lib/catalog.ts:

  {
    id: "notes",
    name: "Notes",
    kind: "app",
    file: "apps/notes/notes.html",
    labels: ["Writing", "Utilities"],
  }

The file it points at is loaded in an iframe in the player, so keep it
self-contained and relative: no absolute paths, no build step of its own.
