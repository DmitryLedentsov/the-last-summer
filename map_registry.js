// Maps describe the scene; the sandbox owns gameplay and input.
export const MAPS=Object.freeze({
 sunset:{title:'Лес за городом',subtitle:'Микрорайон у подножия',builder:'hillside',bots:6,monsters:12},
 mist:{title:'Туманная низина',subtitle:'До первого поезда',builder:'forest',bots:6,monsters:10},
 twilight:{title:'Каменный перевал',subtitle:'Место, которого нет',builder:'landscape',bots:4,monsters:6},
 courtyard:{title:'Забытый двор',subtitle:'03:17. Никого нет.',builder:'courtyard',bots:3,monsters:5},
 mindbreak:{title:'Распад сознания',subtitle:'После сна',builder:'mindbreak',bots:6,monsters:12},
 yard:{title:'Тихий квартал',subtitle:'Август. После семи.',builder:'panel',bots:6,monsters:10},
 outskirts:{title:'Пустырь у кольца',subtitle:'Конечная. Перед дождём.',builder:'panel',bots:6,monsters:10},
 demo:{title:'До темноты',subtitle:'PVPVE SANDBOX',builder:'forest',bots:6,monsters:12}
});
export function resolveMap(value){return Object.hasOwn(MAPS,value)?value:'demo';}
export function spawnScale(limit){return Math.max(.3,Math.min(1,limit/38));}
export function populationFor(id){const map=MAPS[resolveMap(id)];return {bots:map.bots,monsters:map.monsters};}
