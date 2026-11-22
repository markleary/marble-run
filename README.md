# Marble Run

[Play Marble Run](https://markleary.github.io/marble-run/)

Race with two to six players on one screen. Each player chooses a color and names their marble. Pick **Prism Speedway** for six lacquered lanes, a banked rainbow hairpin and a shared wooden finish. On **Frostline Rally**, ice sweepers and timber rollers lead to a field of slalom deflectors and a striped finish bridge. The broadcast camera follows the race automatically.

Choose **Race again** to keep the field and draw a fresh starting grid. The results show finish times, gaps and points. First place earns 3 points, second earns 2 and third earns 1. **Standings** keeps total points and wins across both tracks for each name and color in this browser. Earlier releases saved only the winner of each race, so each recorded win carries forward as 3 points.

## Development

Use Node 24, then run:

```sh
npm ci
npm run dev
```

`npm run build` type-checks the project and produces the GitHub Pages site. `npm run test:physics` exercises all five field sizes on both courses headlessly in Rapier. See [AGENTS.md](AGENTS.md) for browser tests and local audio generation, and [ROADMAP.md](ROADMAP.md) for course designs and release criteria.

Built with Three.js, Rapier, TypeScript and Vite. The sound effects are locally generated ElevenLabs assets bundled with the game.
