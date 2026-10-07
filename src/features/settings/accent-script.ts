import { ACCENT_STORAGE_KEY } from "./accent";

/**
 * Inline script run in `<head>` before first paint: applies the saved accent so the page never flashes the
 * default red. Plain ES5 (it is a string), wrapped in try/catch because storage can be blocked. It repeats
 * the math of `accentVars()`: a unit test checks that both give the same result.
 */
export const ACCENT_BOOT_SCRIPT = `(function(){try{var h=localStorage.getItem(${JSON.stringify(ACCENT_STORAGE_KEY)});if(!/^#[0-9a-f]{6}$/i.test(h||""))return;var n=parseInt(h.slice(1),16),c=[n>>16&255,n>>8&255,n&255],l=(0.2126*c[0]+0.7152*c[1]+0.0722*c[2])/255,s="#";for(var i=0;i<3;i++){var d=Math.round(c[i]*0.85).toString(16);s+=d.length<2?"0"+d:d}var st=document.documentElement.style;st.setProperty("--accent",h);st.setProperty("--accent-strong",s);st.setProperty("--accent-ink",l>0.6?"#111111":"#ffffff")}catch(e){}})();`;
