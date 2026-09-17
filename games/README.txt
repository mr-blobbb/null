HOW TO ADD A GAME
=================

NULL is built now, not served as a folder tree, so a game is two things:

  1. the files, anywhere the build can reach them (put them in games/my-game/)
  2. one entry in src/lib/catalog.ts

For example:

  {
    id: "my-game",
    name: "My Game",
    kind: "game",
    file: "games/my-game/my-game.html",
    thumb: "games/my-game/my-game.png",   // optional
    labels: ["Action", "Puzzle", "Singleplayer"],
  }

`file` is what the player window loads. `thumb` is optional: without it the
tile falls back to a plain square with a glyph on it. `labels` are the
categories search matches against; they are never printed on a card.

Ship the game as one self-contained HTML file where you can. If it needs its
own assets, keep them beside it and make every path inside it relative, so
the whole folder can be moved without breaking.

A pre-launch warning, shown before anything starts, goes on the entry:

  warning: { title: "Heads up", body: "Keyboard needed. Arrow keys move." }
