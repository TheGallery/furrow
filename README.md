# Furrow

A calm, top-down farming sandbox to clear your mind while you wait for something else to finish.
There is one continuous field, a red barn, and a machine for every job. You drive slowly over the field with the arrow keys while the seasons turn.
There is no money, there are no goals, and nothing ever dies.

![The field in autumn](docs/screenshots/field.png)

## Play

**Play it in your browser: https://thegallery.github.io/furrow/**

Or run it locally:

```sh
npm install
npm run dev      # open the printed local URL
```

`npm run build` writes a static build to `dist/`, and `npm run preview` serves it.

## Controls

| Key | Out on the field | In the barn |
| --- | --- | --- |
| ↑ | Drive forward | Turn the carousel up |
| ↓ | Brake, then reverse | Turn the carousel down |
| ← → | Steer (slowly when standing still) | Change the crop |
| Enter / Space | | Drive out with the machine at the door |
| − / = (or +) | Slower / faster pace | Slower / faster pace |
| L | Lane lines on or off | Lane lines on or off |
| H | Lane hold on or off | Lane hold on or off |
| A | Auto-steer on or off | Auto-steer on or off |

The arrow keys work as soon as the page loads; no click is needed. If the browser keeps the keyboard elsewhere (for example, the tab opened in the background or the address bar still has focus), the card at the top says "Click the field, then drive with the arrow keys", and one click on the field fixes it.

The dashboard in the bottom-right corner holds the same settings and stays in view, in the barn too. Its dial shows how fast the machine is going against the pace limit. Click a pace (1×, 1½× or 2×) to set it, or click a guide to switch it on or off; a lit lamp means the guide is on.

- **Pace**: 1× (the original speed), 1½× or 2×. A faster pace keeps the same turning circle.
- **Lane lines**: faint dashed lines along the lane edges, brighter while you drive on the field. While auto-steer drives, they also show the way it will go: soft dashes ahead, red where it will back up, and a dot where the implement meets the ground.
- **Lane hold**: while you are not steering, the machine straightens and settles onto the middle of the nearest lane, so passes sit side by side. Steering always wins.
- **Auto-steer**: hold ↑ and, once the machine is on the field, it works along the lane until the implement reaches the far edge, then makes a three-point turn into the next lane: it stops, backs round, pulls across and swings into the row, so the ends of the lanes are worked too. Let go of ↑ and it rolls to a stop, keeping its place. ← →, or backing up with ↓, take over at any time.

Lane lines and lane hold start on and auto-steer starts off. Furrow remembers the pace and each switch, and so does the mute button in the top-right corner.

The **Field** tab in the bottom-left corner shows what is planted. Click it to open the card: each crop, how much of the field it covers, its stage (sown, sprouting, growing, ripe or resting) and when it will be ripe, plus what is bare or ready for seed. Times are rounded, never ticking. It starts folded and folds itself while you are in the barn.

## How it plays

- **The field.** Work the ground by driving over it: the implement works whatever it passes over, a lane wide with a little overlap, so passes side by side leave no line between them.
  - The **cultivator** roughens bare ground.
  - The **planter** sows worked ground.
  - The **boom sprayer** waters what has been sown.
  - The **harvester** takes in the ripe crop and leaves stubble.
- **Growing.** Unwatered seed only sprouts. Once watered, a crop grows to ripe over about five minutes, and nothing grows in winter.
- **The barn.** Drive in through the roll-up door and stop:
  - The roof turns see-through.
  - Your machine turns round on the turntable.
  - The barn's machines wait on a carousel.

  The label by the door shows the season and what the field needs, and marks one machine **Next up**. Out-of-season machines are dimmed, but you can always pick them. You also choose the crop here.
- **Crops.** Each crop has its own planter and harvester:

  | Crop | Planter | Harvester |
  | --- | --- | --- |
  | Wheat | Seed drill | Combine harvester |
  | Carrots | Precision planter | Root harvester |
  | Pumpkins | Row planter | Tractor + trailer |

- **Seasons.** Spring, summer, autumn and winter each last about five minutes. The grass and hedges fade between them, and winter brings snow. The season pill in the top-left corner fills a soft ring through the season, says what you are doing and when the next season comes, e.g. "winter in about 3 min", and counts this year's harvest.
- **Weather.** Soft cloud shadows drift over the whole farm. Every few seconds a gust crosses it and blows petals off the hedges in spring, seed fluff in summer and leaves in autumn; winter's bare hedges let nothing go.
- **Soft showers.** Now and then, but never in winter, a light shower drifts across the farm. The light dims a little under it, and puddles fill on the verges and slowly dry afterwards. Wherever it rains on the field it waters what is sown, just as the sprayer would. It never stops or slows the work.
- **Birds.** Outside summer, gulls follow the work and settle on the freshly worked strip (rooks in autumn), lifting as you come back past. Swallows loop over the summer crop, and sparrows hop along the hedge tops, with a robin in winter.
- **Animals.** Sheep graze in a paddock under the barn, with lambs in spring, shorn in summer and snowy-backed in winter, when the flock walks out to winter on the field and comes home again in spring. Hens scratch about among the bales (chicks in spring), and the farm dog trots out to pace you from the top verge and curls up by the bales in winter. They all step aside long before the machine reaches them and never settle where auto-steer turns.
- **Wildlife at the edges.** Now and then a hare sits out on the verge or the edge of the field (in spring two may box), or a fox trots along the top verge. They leave as the machine comes near and never settle where auto-steer turns. In winter they leave tracks across the snowy grass.
- **The neighbours' lane.** A quiet farm lane runs along the bottom of the farm, under the field, and every so often someone passes by: one at a time, with long empty spells between. Who comes changes with the season: walkers and the odd van all year, cyclists in spring and summer, a flock moved along with a dog in spring and autumn, a neighbour's tractor with bales in summer and with pumpkins in autumn, and feed going out in winter. Walkers wave while you work the low end of the field, and anyone on the lane slows and waits if the machine noses out in their way.
- **Time of day.** The light follows your own clock: a soft dawn, clear daylight, a golden evening and a moonlit blue night that never hides the field or the machines. After dusk the barn lamp and the machine's lights come on, and fireflies drift over the summer hedges. The farm settles for the night: the hens roost in a row by the bales, the sheep lie down, the dog curls up at home, the gulls and swallows stay away and the hedge birds sit tight and stop singing, while the hare and the fox come by a little more often.
- **Sound.** Soft wind that swells as a gust passes, the odd bird (heard from where the birds are), a quiet engine hum while you drive and the patter of a passing shower, all generated in the browser.
- **Saving.** Progress is kept in your browser's local storage and restored when you come back.

![A machine at work](docs/screenshots/working.png)
![Choosing the next machine in the barn](docs/screenshots/barn.png)

## Development

```sh
npm test           # Vitest: season clock, soil and growth, barn rules, carousel, arrow keys, driving, tyres, pace and guides, auto-steer coverage, birds, animals, the neighbours' lane, what is planted, wind and cloud shadows, wildlife, showers, time of day, layout, save/load
npm run lint       # ESLint
npm run typecheck  # TypeScript
```

- `src/game/` holds the pure game logic. It has no DOM access and is unit-tested.
- `ZOOM` in `src/game/constants.ts` sets how large the farm is drawn, in screen pixels per world unit. Machines, the barn, plants, lanes and speeds are all in world units, so changing it rescales everything together and the field grows or shrinks to fill the view.
- `src/draw/` holds the canvas drawings: the field, the machines, the barn, the weather and showers, the birds, the animals, the wildlife, the neighbours' lane and the light of the hour.
- `src/ui/` holds the barn label, the season pill, the dashboard and the field card.
- `src/audio.ts` holds the ambient sound.

## License

[MIT](LICENSE)
