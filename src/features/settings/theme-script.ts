import { THEME_COLORS, THEME_STORAGE_KEY } from "./theme";

/**
 * Inline script run in `<head>` before first paint: applies a forced theme (`data-theme` on <html>) so
 * the page never flashes the wrong colors, and, once the document is parsed, aligns the browser bar color
 * (`theme-color` meta tags) with it. Plain ES5 in a try/catch because storage can be blocked. Nothing is
 * done for "system": the CSS media query already handles it.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t!=="light"&&t!=="dark")return;var c=${JSON.stringify(THEME_COLORS)};document.documentElement.setAttribute("data-theme",t);document.addEventListener("DOMContentLoaded",function(){var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++){m[i].setAttribute("content",c[t]);m[i].removeAttribute("media")}})}catch(e){}})();`;
