# Marble Run

[Play Marble Run](https://markleary.github.io/marble-run/)

Race with two to six players on one screen. Each player chooses a color and names their marble. Choose a course and the camera follows the race automatically.

| Track | Race highlights | Soundtrack |
| --- | --- | --- |
| Prism Speedway | Six lacquered lanes, a rainbow hairpin and a shared wooden finish | Electric piano and syncopated synth-funk |
| Frostline Rally | Ice sweepers, timber rollers, a ten-post slalom and a striped finish bridge | Felt piano, strings and clarinet |
| Timber Corkscrew | A descending wooden helix around a maple drum, trestle switchbacks and a felt catch tray | Fingerpicked guitar, pizzicato bass and marimba |
| Wireworks Drop | Six pairs of steel rails, two routes around a tower and a banked reunion | Pulsing organ and a mechanical synth groove |
| Midnight Orrery | Three swinging pendulums, an orbital underpass and two ramp jumps across open gaps | Celesta, bass clarinet and viola in a clockwork ostinato |
| Tideglass Conservatory | A botanical glasshouse with a winding half-pipe and twin sea-glass sluices | Alto flute and nylon-string guitar in a bossa nova |

Each track has its own instrumental loop. The music sits underneath the rolling marbles, starting gate and finish bell. The speaker button mutes or restores the full mix.

Choose **Race again** to keep the field and draw a fresh starting grid. The results show finish times, gaps and points. First place earns 3 points, second earns 2 and third earns 1. **Standings** keeps total points and wins across all six tracks for each name and color in this browser. Earlier releases saved only the winner of each race, so each recorded win carries forward as 3 points.

## Development

Use Node 24, then run:

```sh
npm ci
npm run dev
```

`npm run build` type-checks the project and produces the GitHub Pages site. `npm run test:physics` exercises all five field sizes on all six courses headlessly in Rapier. See [AGENTS.md](AGENTS.md) for browser tests and local audio generation, and [ROADMAP.md](ROADMAP.md) for course designs and release criteria.

Built with Three.js, Rapier, TypeScript and Vite. The game bundles its ElevenLabs music and sound effects. Sound begins with player interaction.
