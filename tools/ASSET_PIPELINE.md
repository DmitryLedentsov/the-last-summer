# Runtime asset pipeline
Build: `python tools/build_runtime.py`. Serve `dist/runtime` using an HTTP server.
The build retains the curated/derived/survival/mindbreak directories (including dynamically remapped FBX textures) and excludes raw archives and abandoned psyche prototypes. It emits a SHA-256 manifest. Versioned service worker caches same-origin runtime assets across map reloads; first load still downloads assets. Increment its version when replacing any runtime asset.

## GLB / Meshopt / KTX2 migration (opt-in candidates, NOT active loaders)
Install Blender 4.x, Node, @gltf-transform/cli and KTX-Software.
For .fbx.deflate sources, decompress into a temporary .fbx (zlib or raw deflate as appropriate); do not overwrite original.
```sh
blender -b -t 2 --python tools/convert_fbx.py -- assets/survival/monster/MonsterPSX.fbx dist/candidates/monster.glb
gltf-transform meshopt dist/candidates/monster.glb dist/candidates/monster-meshopt.glb
# For appropriate larger textures; retain original PNG for PSX atlases until visual comparison:
gltf-transform uastc dist/candidates/monster-meshopt.glb dist/candidates/monster-ktx2.glb
```
Validate node names, bind transforms, height, animation lengths/root motion, material atlas mapping, alpha cutouts, texture nearest filters, and identical physical map colliders before replacing any loader. GLTFLoader requires MeshoptDecoder and KTX2Loader configured for the compressed variants. FBX collection meshes and custom texture URL remapping need individual review. Conversion has not been run in the connector environment; current production runtime continues using original assets.
