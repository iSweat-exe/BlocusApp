import { EVENT_COLORS, EVENT_STORAGE_KEY } from "./event";

/**
 * Inline script run in `<head>` before first paint: reads the preview from `?event=` (halloween, off or reset),
 * works out the running event (it repeats the math of `resolveEvent()`: a unit test runs both), sets
 * `data-event` on <html> so the palette applies at once, and, once the document is parsed, aligns the browser
 * bar color. Plain ES5 (it is a string); every storage access is guarded because storage can be blocked.
 */
export const EVENT_BOOT_SCRIPT = `(function(){try{var k=${JSON.stringify(EVENT_STORAGE_KEY)},c=${JSON.stringify(EVENT_COLORS)};function g(){try{return localStorage.getItem(k)}catch(e){return null}}function s(v){try{v===null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){}}var q=/[?&]event=([a-z]+)/.exec(location.search);if(q){if(q[1]==="halloween"||q[1]==="off")s(q[1]);else if(q[1]==="reset")s(null)}var p=g(),n=new Date(),v=p==="halloween"?"halloween":p==="off"?null:(n.getMonth()===9&&n.getDate()===31?"halloween":null);if(!v)return;document.documentElement.setAttribute("data-event",v);document.addEventListener("DOMContentLoaded",function(){var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++){m[i].setAttribute("content",c[v]);m[i].removeAttribute("media")}})}catch(e){}})();`;
