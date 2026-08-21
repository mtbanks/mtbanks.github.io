# RMS Titanic — Maiden Voyage

A first-person 3D ship simulator in the browser. You are the captain on the night
of 14 April 1912, four days out of Southampton, with 3,000 nautical miles to run
and an ice field ahead.

## Running it

Open `index.html` in a browser. No server, no build step, no install — three.js
is vendored in `vendor/`.

    xdg-open index.html

## Controls

| | |
|---|---|
| `W A S D` | walk (`Shift` to run) |
| Mouse | look (click to capture the pointer) |
| `← →` | steer the ship · `R` centres the wheel |
| `T` | engine order telegraph |
| `E` | use an object, or speak to someone |
| `M` | go below — jump to any deck |
| `F` | close/open the watertight doors |
| `V` | view her from outside · `G` free-fly · `H` back to the bridge |
| `N` | mute · `?` show/hide the on-screen controls card |

## What is aboard

Ten walkable decks, 193 named spaces, 213 modelled people:

- **Boat Deck** — wheelhouse (the helm, telegraphs, compass, watertight door
  switch), chart room, Marconi wireless room, officers' quarters, gymnasium,
  20 lifeboats on Welin davits
- **A / Promenade** — First Class Lounge, Reading & Writing Room, Smoking Room,
  Verandah Café, enclosed promenade
- **B / Bridge** — parlour suites, À la Carte Restaurant, Café Parisien
- **C / Shelter** — purser's office, Second Class Library, Third Class General Room
- **D / Saloon** — the First Class Dining Saloon (full beam), Reception Room,
  Second Class Dining Saloon, galley
- **E / Upper** — Scotland Road, the 130-metre working alleyway
- **F / Middle** — swimming bath, Turkish baths, Third Class dining saloons
- **G / Lower** — squash court (two decks high), post office and mail sorting
  room, firemen's quarters
- **Orlop** — cargo holds, and William Carter's crated Renault
- **Tank Top** — six boiler rooms with 29 boilers and their furnace doors, two
  four-cylinder triple-expansion engines that actually run, the low-pressure
  turbine, and the shaft tunnel

Two Grand Staircases and two working stairs connect them; you can walk from the
crow's nest to the tank top without a loading screen.

## The simulation

The numbers are the real ones, and they are the whole difficulty:

- **She answers the helm at about 1.3°/s hard over.** Committing to a turn takes
  a minute. The lookouts have no binoculars — they were left at Southampton — so
  on a moonless, flat-calm night you get roughly 70 seconds of warning.
- **Rung to Stop from full speed she still makes 11 knots a minute later.**
- **Six ice warnings** arrive by wireless over the voyage (Caronia, Baltic,
  Amerika, Mesaba, Californian — the real texts).
- **Sixteen watertight compartments.** She floats with any two open, or the
  first four. The berg opens six.
- **The bulkheads stop at E deck.** Once she settles by the head, the sea stands
  higher than the top of a bulkhead and water brims from one compartment into
  the next, working aft — the flaw that actually sank her. From the strike to
  foundering is about 180 minutes of ship's time, roughly 13 minutes of play.
- The lights fail before the end, because the engineers kept them burning.

If you clear the ice and make New York, you get an ending history did not.

## Layout

    index.html          markup, styling, script order
    vendor/three.min.js three.js r150 (UMD, so file:// works)
    src/core.js         constants, deck table, geometry batcher, light pool
    src/ship_exterior.js hull loft, weather decks, funnels, masts, boats, screws
    src/ship_interior.js walls, stairs, furniture, room registry, deck assembly
    src/decks.js        the actual room-by-room layout of every deck
    src/machinery.js    boiler rooms, engines, turbine, shaft tunnel
    src/world.js        sky, stars, ocean shader, ice field, funnel smoke
    src/player.js       pointer-lock controller, AABB collision, stair ramps
    src/npc.js          crew and passengers, animation, dialogue
    src/navigation.js   helm, telegraph, ship dynamics, voyage, lookouts
    src/damage.js       collision, compartment flooding, trim, list, foundering
    src/ui.js           HUD, modals, message log, end cards
    src/audio.js        synthesised engine, sea, furnace and bell audio
    src/main.js         boot, game loop, key bindings

Nothing is loaded from disk but the code: every mesh, texture and sound is
generated at runtime. Static geometry is welded into batched vertex-coloured
meshes, and interiors are lit by a pool of 8 point lights that follow you and
are chosen by how much light they would actually deliver.
