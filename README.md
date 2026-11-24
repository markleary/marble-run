# Marble Run

[Play Marble Run](https://markleary.github.io/marble-run/)

Race with two to six players on one screen. Each player chooses a color and names their marble. The track picker lists courses from shortest to longest by average heat time, with checkpoint courses grouped at the end. Choose a course and the camera follows the race automatically.

Use the fullscreen button in the top-right corner to expand the game or return to the window on supported browsers. The control stays available during the race and on the results screen.

On a phone, rotate between portrait and landscape at any point. Tap the chevron beside the race clock to expand the full running order. Switching apps pauses the race and audio until you return.

To play from your home screen, choose **Install game** in race setup. On iPhone or iPad, use Safari’s **Share → Add to Home Screen** and enable **Open as Web App** if shown. On Android, follow Chrome’s install prompt or choose the install option in its menu. After the first online launch finishes downloading the game, all ten tracks and their soundtracks work offline.

| Track | Race highlights | Soundtrack |
| --- | --- | --- |
| Wireworks Drop | Six pairs of steel rails, two routes around a tower and a banked reunion | Pulsing organ and a mechanical synth groove |
| Prism Speedway | Six lacquered lanes, a rainbow hairpin and a shared wooden finish | Electric piano and syncopated synth-funk |
| Timber Corkscrew | A descending wooden helix around a maple drum, trestle switchbacks and a felt catch tray | Fingerpicked guitar, pizzicato bass and marimba |
| Frostline Rally | Ice sweepers, timber rollers, a ten-post slalom and a striped finish bridge | Felt piano, strings and clarinet |
| Tideglass Conservatory | A botanical glasshouse with a winding half-pipe and twin sea-glass sluices | Alto flute and nylon-string guitar in a bossa nova |
| Midnight Orrery | Three swinging pendulums, an orbital underpass and two ramp jumps across open gaps | Celesta, bass clarinet and viola in a clockwork ostinato |
| Kepler Relay | A solar-array station, a steep gravity dive and an open-space jump into a banked glass half-pipe | “Signal Return,” an analog sequencer, string-synth pads and a gliding lead |
| Afterglow FM | A continuous neon ribbon with sliding crossfader pucks, a 270° bank and a narrow bridge beneath the upper deck | “Dial Tone at Midnight,” a late-night electro instrumental with a two-note FM synth hook |
| Crux Mountain Masters | A two-minute-plus climbing gym race with four gap jumps, bumper and blade slaloms, a double-apex turnaround and knockout gates | “Contour Line,” melodic electronic house with a rolling bass line and a rising synth hook |
| Spectral Relay | A vertical drop into a neon arena, two magnetic galleries and five timed checkpoints | “Chromatic Slipstream,” an ElevenLabs electro-breaks instrumental with a descending glass-synth hook |

Each track has its own instrumental loop. The music sits underneath the rolling marbles, starting gate and finish bell. The speaker button mutes or restores the full mix.

On Crux Mountain Masters, Spectral Relay and Afterglow FM, choose **Knockout** to race for a spot behind each release bar. Watch the white **ENTRY** stripe at the mouth of the funnel. At an active gate, the last marble across it is out. Once the qualifiers reach their pads, the last entrant rolls into the side pocket and the bar releases the qualifiers together. Smaller fields start the cuts later so two finalists race to the stripe. Choose **Endurance** to keep the gates open and race the entire field to the finish. Open **Checkpoint splits** in the results and select a gate to see its passing order and times.

Choose **Race again** to keep the field and draw a fresh starting grid. The results show finish times, gaps, checkpoint eliminations and points. First place earns 3 points, second earns 2 and third earns 1. **Standings** keeps total points and wins across all tracks for each name and color in this browser. Earlier releases saved only the winner of each race, so each recorded win carries forward as 3 points.

## Development

Use Node 24, then run:

```sh
npm ci
npm run dev
```

`npm run build` type-checks the project and produces the GitHub Pages site. `npm run test:physics` exercises all five field sizes on every course headlessly in Rapier, including both formats on every checkpoint course. See [AGENTS.md](AGENTS.md) for browser tests and local audio generation, and [ROADMAP.md](ROADMAP.md) for course designs and release criteria.

Built with Three.js, Rapier, TypeScript and Vite. The game bundles its ElevenLabs instrumental scores and sound effects. Sound begins with player interaction.

`npm run audio:generate -- --crux` remasters the cached recording of “Contour Line”. With an empty source cache, it uses the ElevenLabs key in `.env` to generate a new rendition.
