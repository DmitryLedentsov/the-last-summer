#!/usr/bin/env python3
"""Build an isolated static runtime distribution from tracked sources.
Original archives and unused prototype assets are never modified.
Curated folders are intentionally retained in full: FBX textures use dynamic URL remapping.
"""
import argparse, hashlib, json, shutil, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PREFIXES = ("assets/curated/", "assets/derived/", "assets/survival/", "assets/mindbreak/")
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="dist/runtime")
    args = parser.parse_args()
    out = (ROOT / args.out).resolve()
    if ROOT not in out.parents or out == ROOT or out.parts[:len(ROOT.parts)+1] != (*ROOT.parts, "dist"):
        raise SystemExit("Output must be inside dist/")
    tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0")
    paths = sorted(p for p in tracked if p and (
        ("/" not in p and Path(p).suffix in (".html", ".js", ".css"))
        or p.startswith(PREFIXES) or p == "assets/README.md"))
    if not {"index.html", "survival.html", "play.js"}.issubset(paths):
        raise SystemExit("Missing runtime entry point")
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    manifest = []
    for p in paths:
        source = ROOT / p
        if not source.is_file():
            raise SystemExit("Missing tracked runtime file: " + p)
        dest = out / p
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, dest)
        data = dest.read_bytes()
        manifest.append({"path": p, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    (out / "runtime-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"{len(manifest)} files; {sum(x['bytes'] for x in manifest):,} bytes")
if __name__ == "__main__":
    main()
