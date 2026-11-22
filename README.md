# Marble Run

[Play Prism Speedway](https://markleary.github.io/marble-run/)

Set up two to four marbles on one screen. Each player can give their marble a name and choose its color. Four lacquered lanes feed a banked hairpin and a shared wooden finish. The broadcast camera follows the action automatically.

Choose **Race again** to keep the field and draw a fresh starting grid. The results show finish times and gaps, and **Standings** keeps wins by name and color in this browser.

## Development

Use Node 24, then run:

```sh
npm ci
npm run dev
```

`npm run build` type-checks the project and produces the GitHub Pages site. `npm run test:physics` exercises all three field sizes headlessly in Rapier. See [AGENTS.md](AGENTS.md) for browser tests and local audio generation, and [ROADMAP.md](ROADMAP.md) for the next three courses.

Built with Three.js, Rapier, TypeScript and Vite. The sound effects are locally generated ElevenLabs assets bundled with the game.
