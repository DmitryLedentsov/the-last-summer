# Shared playable maps (06.3)
All eight menu entries launch survival.html?map=<id>. The original demo remains an alias of the sunset forest.
play.js loads a scene builder, validates its world descriptor and starts the same survival_combat.js runtime. Builders export world with scene, camera, renderer, level (limit, spawn, yaw), height, colliders, terrain and sun; optional treeBatches, extraTextures, interactions, canEnter and updateEnvironment.
Map geometry, assets, lighting, and authored environment effects are retained. The forest builder is shared by sunset, mist and demo. The old HTML routes redirect to the shared entry point. Desktop F and mobile ОСМОТР inspect objects; Q/E remains top camera rotation.
Map registry controls population and compact-map spawn scaling. Existing combat, AI, IK, input and graphics modules are reused; the local simulation is not yet a networked runtime. Courtyard uses the original 28m play area, fewer actors, and a flat floor. Mist excludes the pond except the dock.
Browser QA: load all maps, start desktop and touch, check walking/stance/sprint/roll, muzzle and grip, firing, respawn, tree and wall obstruction, dock and camera, inspect props, and animated Mindbreak/courtyard elements. No renderer or gameplay redesign in this migration.

## 06.6: independent hillside map
`sunset` now loads `forest_outskirts.js` using `hillside_layout.js`. `demo` still loads the original `survival_map.js`; `mist` also retains its original builder. The new heightfield uses a graded switchback road and a flattened residential basin. Shared combat uses the same triangle sampler as the terrain mesh. Initial bot spawning falls back from the sector to global sampling; unspawned actors stay hidden and do not enter weapon posing.

## 06.7: daylight outskirts art pass
Only the hillside builder changes. Original DAYSKY.hdr, asymmetric ridge/gully terrain, forest stands and weathered asphalt. The former viewpoint is a relay-station service yard with open road access; district heat pipes and garage rows tie the neighborhood together. The original sunset demo and combat module are unchanged.

## 06.8: large-map rendering
`vegetation_system.js` is optional per world: stable 24 m instance chunks, distance-based counts with hysteresis and identical close detail for all graphics settings. Ground-cover density is visual only, not a collider or concealment mechanic. `forest_outskirts.js` is the first adopter; no wind, terrain LOD or NPC animation throttling. Solid placement retains its existing seed; decorative generation has its own seed. Static tree/rock batches use existing `splitStaticInstances`. Shared `spatial_grid.js` keeps the same combat broadphase. `world_data.js` exposes the hillside physical descriptor and an on-demand portable schema containing the sampled heightfield and colliders, independent of Three.js. This is a foundation, not a server exporter or a network protocol. Future Java MapLoader should consume baked data from a versioned artifact rather than duplicate JS generation; MF `ConfiguredGameSession` owns rules and uses Action/State/Event, per-session worker and JS SDK. Fair PvP concealment needs explicit authoritative rules before adding tactical grass. Measure F3 on mobile before changing animation or terrain geometry.

## 06.9: mobile rendering budget
Hillside local shadow frustum (36 m half extent, snapped to 2 m), static primitive instancing by material and 64 m cells, larger tree/rock chunks, fixed decorative vegetation LOD for all quality presets (12/20 m to 12 m chunk centers, 1.5 m hysteresis). Reeds replace Plant; fewer decorative bushes. No physics, simulation cadence, diorama or asset simplification changes. F3/FPS shows a checkbox for detailed timings; Shift+F3 toggles detail on desktop. Scene times include shadow submission; GPU time is optional, not inferred. Other maps retain their own shadow coverage. 
Detailed FPS separates shadow submission (included in scene totals), scene, post, bot decision/pose, monsters, FX and respawn. GPU timing requires EXT_disjoint_timer_query_webgl2; otherwise n/a. No GPU stall is inferred from CPU submission timings.

## 07.0: vegetation range calibration
Low retains 06.9: 12/20 m. Medium 18/34, High 24/46, Ultra 30/60 m (distance to 12 m chunk centers; 1.5 m hysteresis and movement threshold). Mid density 35/35/30/25%. Quality changes refresh immediately even without movement and discard hysteresis from previous quality. F3 detailed panel reports current LOD radii. All solid scenery remains rendered by frustum culling only; no distance-based removal of collision objects. Tree batch instance/point indices, colors, shadow material and culling settings are retained. The local shadow radius, terrain, colliders, combat and Diorama remain unchanged. Ranges are a first-pass budget estimate from one mobile screenshot, not measured optimal values. Validate across town/forest/summit and all presets before further tuning.

## 07.1
Separate `swamp` map, existing `mist` unchanged. Swamp uses the existing vegetation LOD, local shadow radius and shared collision/physical world descriptor. `styled_vfx.js` implements compact world-space muzzle flashes, short blood atlas bursts and smoke; existing stains, bullets, combat cadence, input and locomotion are retained.

## 07.2
Swamp rework: no trees or tree colliders, Z-up FBX scene correction, grass uses Misc atlas, peat/mud texture transitions, clustered ground cover, scattered shallow pools and isolated buildings. Flash playback is advanced only before rendering, ensuring at least one full-brightness frame even with multiple fixed simulation ticks; side masks point forward. Existing shadows and gameplay unchanged.

## 07.4
Swamp only: finer shared heightfield, multi-scale peat banks and hollows, footpaths follow terrain, tall clustered grass and sparse birch-dominant groves. Tree geometry is corrected to Y-up before fitting and anchored on its actual base; lower trunk collision is derived from the same visible mesh. Existing vegetation LOD, shadow settings, other maps, and combat remain unchanged.

## 07.6
Default graphics: DIORAMA LEGACY / MEDIUM / 52m ground-cover range; settings panel and localStorage persistence. Quality remains independent of the vegetation radius. Swamp anomaly sprites and point lights are stationary, individually colored and do not cast shadows. Blood hits use only BloodSplat (no BloodSmoke), larger and slower; muzzle flash is larger and longer.
