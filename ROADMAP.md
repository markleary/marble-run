# Marble Run course roadmap

Prism Speedway is the first playable course. The other three courses below are designs for future releases. Each will have a fixed, pre-generated layout, a recognizable silhouette and a section where a spectator can see how an overtake happened.

| Course | Setting | Signature section | Intended heat |
| --- | --- | --- | --- |
| Prism Speedway | Sunlit racing workbench | Four lacquered lanes rolling into opposing banks and a shared timber finish | About 35–45 seconds |
| Timber Corkscrew | Cabinetmaker’s bench | Open wooden helix around a drum | 35–50 seconds |
| Wireworks Drop | Metalworking exhibit | Wire descent followed by two competing routes | 40–55 seconds |
| Frostline Rally | Snowy village square | Low-friction ice sweeper and a deflector field | 40–60 seconds |

## Prism Speedway

The four launch troughs descend over shallow rollers into the Spectrum Hairpin. The return straight feeds the opposing timber bank. The lane separators taper into the shared finishing deck, and the timing stripe sits upstream of the collection tray. A close finish uses the leading edge of the marble at the stripe. The camera follows remaining racers after the winner crosses.

Preserve this layout as a reference when adding course selection. Keep the starting-grid seed separate from the course seed so a rematch changes the grid and preserves the geometry. Use the headless runner to compare completion, heat duration and win rates by starting slot after physics or material changes.

## Timber Corkscrew

**Race sequence.** The timber start gate feeds a short, grooved launch. The dividers taper before a long descending helix around a central wooden drum. An outside line builds speed, while the inside line covers less distance. A broad exit leads into two opposite switchbacks, a shallow grooved descent and a short sprint into a felt-lined catch tray.

**Geometry and materials.** Generate the helix from radius, pitch and turn count. Sample the floor and lip with the same cross section for rendering and collision. Give adjacent levels enough vertical clearance for a marble, its guardrail and an unobstructed exterior camera angle. Describe the wood with bent plywood edges, staggered planks and a dark rail. The timing section remains open across its width.

**Progress and cameras.** Use the previous course segment and elevation when projecting a marble onto the helix. Two marbles can have nearly identical horizontal positions on separate levels. Set one exterior camera on the drum’s open side and hold a side-by-side pair through the bend. Pick up the exit from downstream before cutting to the switchbacks.

**Acceptance.** No jumps in displayed rank when marbles pass above each other. The inside edge cannot trap a slow marble. All three field sizes must clear the helix and the switchback joints. Review slow and fast examples from inside and outside starts; verify the drum never hides the selected marble for an entire turn.

## Wireworks Drop

**Race sequence.** A high gate releases the field onto four paired wire rails. The rails curl downward and level out over a wooden catch deck. A broad splitter routes marbles around a support tower. The inner branch takes a short, tight line, and the outer branch takes a longer, gentler descent. Both feed a wide, banked reunion and a straight finish.

**Geometry and materials.** Generate the two rails in each chute from a common centerline and clearance profile. Test sphere contact at entry, maximum curvature and exit; the visual gap between the rails must match what supports the marble. Use a tangent joint at the catch deck and a rounded nose on the splitter. Span the drop with curved painted braces, leaving the sides open to the camera.

**Progress and cameras.** Give each branch its own route and checkpoints. Map both branches to common progress between split and merge for live rankings; use physical crossing time at the finish. A wide fixed shot should contain both exits and the merge so the viewer can see which line paid off. Use a side shot on the wire drop to show the change in elevation.

**Acceptance.** Test isolated marbles on each route and four marbles arriving together. Check for wedging at the splitter, falling between rails, and colliding with a seam at the reunion. Sample branch use and finish order across many seeds. Tune branch geometry if one route always loses. Add a wire-rattle sound layer driven by contact with the rail section.

## Frostline Rally

**Race sequence.** The field leaves a gate in a snowy village square, enters a smooth ice-blue S-bend, crosses a short bank of wooden rollers and fans out through staggered round deflectors. A broad final skating turn leads over a striped finish bridge.

**Geometry and materials.** Assign an ice contact material to the sweeper, and wood to the rollers. Blend the surfaces at their physical joins. Keep the ice translucent-looking with an opaque tinted surface and a reflective highlight to control mobile rendering cost. Give the deflectors rounded feet and multiple downhill exits wider than a marble. Keep snow, miniature buildings and trees outside the racing channel.

**Progress and cameras.** Use an elevated three-quarter shot for the S-bend, a high fixed view showing the paths through the deflectors and a side view at the bridge. Track downhill progress through the wide deflector field without awarding places to marbles that bounce sideways across adjacent rows. Use dark trim at the track edges for contrast against snow.

**Acceptance.** Verify a marble starting almost at rest can clear each transition. Test two-marble pinches at deflectors and four-marble traffic at the skating turn. Compare speeds exiting the ice and wood sections. Check pale marble visibility, shadow cost and timing-stripe readability on a phone viewport.

## Adding courses to the game

1. Introduce a small course catalog when the second course is implemented. Each entry owns its ID, title, preview, baked layout, material sections, camera shots and finish plane. The setup screen should offer only playable courses.
2. Extract shared troughs, railings, gates, finish detection and timing from the Prism implementation as a second course needs them. Keep branches and layered paths explicit in their course data.
3. Add the new course to the no-render physics runner. Run at least 100 seeded grids for each of two, three and four entrants. Preserve failing seeds and report durations, escapes, stalls and win rates per starting slot.
4. Play a complete heat and rematch through the browser UI. Check desktop and phone layouts, the selected-marble marker, each signature camera shot, sound on/off and persistent wins after a reload. Include close finishes and a split pack in camera reviews.
5. Keep wins global by color and normalized name. A rematch reuses the selected course and entrants, shuffles the starting slots and awards a win only after every entrant finishes. Smoke-test the shipped GitHub Pages build on its repository subpath.
