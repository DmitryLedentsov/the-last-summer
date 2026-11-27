# Assets

Полная папка ассетов, собранная из всех архивов, которые были загружены в чат.

## Структура

- `raw/` — исходные директории паков без изменений.
- `curated/` — нормализованные копии с короткими путями для использования в игре.
- `manifest.json` — список всех файлов.

## Наборы

- `raw/abanodehousepack/` — постсоветские дома.
- `raw/PSX_Daysky_HDRI/` — дневное HDRI небо.
- `raw/PSX_Nightsky_HDRI/` — ночное HDRI небо.
- `raw/PSX_Forest_Level_byStarkCrafts/` — PSX-лес и текстуры земли.
- `raw/PS1 Dark Fantasy Horror Game Assets (by Stark Crafts)/` — природа, каменные/дворцовые фрагменты, скелет, череп, меч, руны.

## Для текущей сцены используются

- `curated/sky/PSX_NIGHTSKY.hdr`
- `curated/houses/house03.fbx`
- `curated/houses/house07.fbx`
- `curated/forest/forest_collection.fbx`
- `curated/ground/*.png`
- `curated/nature/nature_collection.fbx`
- `curated/palast/palast_collection.fbx`
- `curated/skull/PS1_Skeleton.fbx`
- `curated/skull/PS1_Skull.fbx`
- `curated/skull/ps1_Sword.fbx`
- `curated/skull/MagicRunes_Emission.png`

## Производные материалы v0.3

`derived/sunset.jpg`, `derived/mist.jpg`, `derived/twilight.jpg` — цветокоррекция исходного DAYSKY.hdr для новых локаций.

## 07.1
- `curated/swamp/`: ABERRANT CURSE PSX Forest assets, supplied by the user as redistributable. FBX files are losslessly zlib-compressed; original textures. Credit: ABERRANT CURSE.
- `curated/vfx/`: Binbun Muzzle Flash VFX (selected reduced-resolution masks) and knowercoder BloodFX (BloodSplat, Smoke, MIT license included). Engine-specific project files are not included.
