// Optional cache: private mode, local HTTP or storage refusal do not prevent gameplay.
export function registerAssetCache(){if(!('serviceWorker' in navigator)||!globalThis.isSecureContext)return;return navigator.serviceWorker.register(new URL('./asset-cache-sw.js?v=081',import.meta.url),{updateViaCache:'none'}).catch(()=>{});}
registerAssetCache();
