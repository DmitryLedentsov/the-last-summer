"""Run under Blender 4.x, not normal Python. Offline conversion candidate, never overwrite runtime source."""
import argparse, sys
from pathlib import Path
import bpy
p = argparse.ArgumentParser()
p.add_argument("source")
p.add_argument("output")
a = p.parse_args(sys.argv[sys.argv.index("--") + 1:])
src, dst = Path(a.source).resolve(), Path(a.output).resolve()
if src.suffix.lower() != ".fbx" or dst.suffix.lower() != ".glb" or dst.exists():
    raise SystemExit("Use an FBX source and a NEW GLB output")
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(src))
dst.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(dst), export_format="GLB", export_animations=True, export_skins=True, export_morph=True)
