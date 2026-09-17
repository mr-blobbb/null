NULL · profile card backgrounds
===============================

Four looping clips, used by the Profile effects shelf in the shop. They are
played muted, on a loop, cropped with object-fit: cover inside the card, and
they always sit under the .fx-tint scrim so the card's text stays readable.
Nothing here has a sound track in the player: the <video> elements are muted
and have no controls.

Source
------
The files were fetched from Pinterest's own CDN (v1.pinimg.com), one per pin:

  card-rainy.mp4   pin 8936899257249307   pixel-art night: a cat on a roof in the rain
  card-voxel.mp4   pin 1134344224938245036 block landscape, drifting clouds
  card-hex.mp4     pin 3799980930910059   hexagon wall with lit edges
  card-galaxy.mp4  pin 660340364137281434 ringed disk over a starfield

These are other people's uploads, reposted widely on Pinterest. If NULL is
published, replace them with clips you have the rights to, or delete the file
and the drawing stands in: the shop item, the tint and the layout all still
work without it (src/lib/art.tsx, EFFECT_VIDEO).

Replacing one
-------------
Keep the file name and the video is picked up as-is. Roughly 16:9 reads best;
anything bigger than a few MB is worth re-encoding first, since the shop grid
plays four of these at once.
