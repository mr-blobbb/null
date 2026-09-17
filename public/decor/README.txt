NULL · the clips the shop sells
================================

Two kinds of looping clip live here. Both are played muted, on a loop and with
no controls, so nothing in the shop can make a sound.

  card-*.mp4    profile effects: a whole-card background. Cropped with
                object-fit: cover, and always under the .fx-tint scrim when
                the card has words on it. On the share card the scrim is the
                light one (.fx-clear), so the art is actually visible.

  avatar-*.mp4  avatar decorations: a face overlay. Clipped to the circle at
                inset 0 — the same size as the picture, centred, cropped not
                stretched — and composited with mix-blend-mode: screen. Every
                one of these was shot on black, so screening drops the field
                and keeps the glow, which is what makes them read as an
                overlay rather than a sticker.

Source
------
The files were fetched from Pinterest's own CDN (v1.pinimg.com), one per pin:

  card-rainy.mp4    pin 8936899257249307    pixel-art night: a cat on a roof in the rain
  card-voxel.mp4    pin 1134344224938245036  block landscape, drifting clouds
  card-hex.mp4      pin 3799980930910059    hexagon wall with lit edges
  card-galaxy.mp4   pin 660340364137281434  ringed disk over a starfield
  avatar-chroma.mp4 pin 1052786850394133296 light that runs around the rim (1:1)
  avatar-ember.mp4  pin 664562488788312314 violet fire climbing the face (4:5)

These are other people's uploads, reposted widely on Pinterest. If NULL is
published, replace them with clips you have the rights to, or delete the file
and the drawing stands in: the shop item, the tint and the layout all still
work without it (src/lib/art.tsx, EFFECT_VIDEO).

Replacing one
-------------
Keep the file name and the video is picked up as-is. 16:9 reads best for a
card, and a square reads best for a face; anything bigger than a few MB is
worth re-encoding first, since the shop grid plays several at once. A face
overlay only suits a clip shot on black — anything else needs its own
compositing, not a blend mode.
