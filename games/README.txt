HOW TO ADD A GAME
=================

Create a folder inside games/, e.g. games/my-game/, containing:

  my-game.html      the game itself (fully standalone — no NULL files needed)
  my-game.png       optional thumbnail (png/jpg/jpeg/webp/gif/svg all work)
  Label.txt         optional tags, e.g.
                    Label: Action Puzzle Singleplayer WebGL
                    (each non-empty line becomes one label; prefixes optional)
  Warning.txt       optional pre-launch notice, e.g.
                    Title: Heads up
                    Description: Keyboard needed. Arrow keys move, space jumps.

Then run:

  bun run catalog     (or: node scripts/build-catalog.js)

The game appears automatically on /games — no JSON, no manual registry.

Notes
-----
- Folders without an HTML file are ignored (they don't show as broken cards).
  games/hollow-knight/ is an example: drop the real files in and rebuild.
- Missing thumbnails automatically fall back to the NULL-style placeholder.
- If a folder starts with "_" or "." it is skipped entirely.
