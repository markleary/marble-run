# Working on Marble Run

Read [ROADMAP.md](ROADMAP.md) for the four playable course designs, camera coverage and acceptance criteria. Update it when a course changes status or a design decision changes its route, camera coverage or acceptance criteria.

- Use Node 24 and `npm ci`. Run `npm run dev` for the development server and `npm run build` to type-check and build the static site into `dist/`.
- Use `npm run test:physics` to run 100 seeded heats at each field size from two through six on all four courses. For a short reproduction use `npm run test:physics -- 1 23 frostline` (one seed starting at 23 on Frostline Rally). Inspect the starting-slot, winning-slot and Wireworks branch reports after changes to course geometry.
- After building, use `npm run test:browser` for desktop or `npm run test:browser -- --mobile` for a phone viewport. Install Chromium with `npx playwright install chromium` or point `MARBLE_CHROME` at an existing Chrome executable. Set `MARBLE_URL` to exercise an existing preview or the live site.
- Run `npm run track:generate` to rebuild the four versioned layouts in `src/courses/` from their design seeds.
- Keep Rapier timing and race rules in the simulation. Let Three.js interpolate the physics poses for display. Course sampling is shared by the collision mesh, visible raceway and camera direction.
- Keep the local ElevenLabs key in `.env`. The optional `npm run audio:generate` command creates missing effects and per-course instrumental loops under `public/audio/`. Music generation uses FFmpeg to trim, crossfade and level the loops. The browser and CI use the committed audio files.
- GitHub Actions builds and deploys the default branch to GitHub Pages. Keep asset URLs compatible with the repository subpath.
