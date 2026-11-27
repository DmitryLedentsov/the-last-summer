# Shared playable maps (06.3)
All eight menu entries launch survival.html?map=<id>. The original demo remains an alias of the sunset forest.
play.js loads a scene builder, validates its world descriptor and starts the same survival_combat.js runtime. Builders export world with scene, camera, renderer, level (limit, spawn, yaw), height, colliders, terrain and sun; optional treeBatches, extraTextures, interactions, canEnter and updateEnvironment.
Map geometry, assets, lighting, and authored environment effects are retained. The forest builder is shared by sunset, mist and demo. The old HTML routes redirect to the shared entry point. Desktop F and mobile ОСМОТР inspect objects; Q/E remains top camera rotation.
Map registry controls population and compact-map spawn scaling. Existing combat, AI, IK, input and graphics modules are reused; the local simulation is not yet a networked runtime. Courtyard uses the original 28m play area, fewer actors, and a flat floor. Mist excludes the pond except the dock.
Browser QA: load all maps, start desktop and touch, check walking/stance/sprint/roll, muzzle and grip, firing, respawn, tree and wall obstruction, dock and camera, inspect props, and animated Mindbreak/courtyard elements. No renderer or gameplay redesign in this migration.

## 06.6: independent hillside map
`sunset` now loads `forest_outskirts.js` using `hillside_layout.js`. `demo` still loads the original `survival_map.js`; `mist` also retains its original builder. The new heightfield uses a graded switchback road and a flattened residential basin. Shared combat uses the same triangle sampler as the terrain mesh. Initial bot spawning falls back from the sector to global sampling; unspawned actors stay hidden and do not enter weapon posing.
