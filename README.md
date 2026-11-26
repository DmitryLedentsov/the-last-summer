# The Last Summer / Последнее лето

Небольшая экспериментальная 3D-игра от первого лица. Пустой постсоветский двор, деревья, выцветшие фасады и летний свет — как далёкое воспоминание.

## Запуск

```sh
python -m http.server 8000
```

Открыть http://localhost:8000/ в Chromium/Firefox с WebGL 2. Three.js r170 загружается с CDN; интернет нужен. Не открывать index.html через file://.

WASD — движение, мышь — обзор, Shift — ускорение, E — взаимодействие у лавочек и качелей, Esc — пауза.

## Ассеты

Для тестовой сцены используется подготовленный пакет с папкой `assets/`. Если папки нет после клонирования, распаковать архив `the-last-summer-assets.zip` в корень репозитория (путь `assets/manifest.json` должен находиться рядом с `index.html` через один уровень). Без него сцена работает с резервной процедурной геометрией. Папка `assets/` больше не исключается из Git; перед публичной публикацией проверить лицензии сторонних материалов.

Используемые файлы:
- assets/houses/house03.fbx, house05.fbx, house06.fbx, house07.fbx и текстуры 1h.png–6h.png — abanodehousepack.
- assets/forest/forest.fbx — PSX Forest Level by Stark Crafts (деревья, трава, цветы, камни).
- assets/ground/PSX_Seamless_*.png — текстуры того же пака.
- assets/sky/DAYSKY.hdr — PSX Daysky HDRI.
- assets/nature/nature.fbx и JPG рядом — PS1 Dark Fantasy Horror Game Assets by Stark Crafts (кусты).
- assets/manifest.json — {"version":1}.

Проверить права на веб-публикацию моделей/текстур перед добавлением ассетов в GitHub Pages. MIT LICENSE в репозитории относится к собственному коду, не к сторонним ассетам.

## Технически

Three.js + FBXLoader + RGBELoader, ES modules, статический HTTP-хостинг. Камера от первого лица с pointer lock и AABB-коллизиями. Повторяющаяся мелкая растительность через InstancedMesh; фиксированная генерация двора, пиксельная фильтрация, дневной туман, направленный свет. Дома снаружи, без интерьеров. Сцена намеренно небольшая. GitHub Pages пока не настроен.
