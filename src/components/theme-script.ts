// Light / Dark per device (localStorage, so it works offline too). The inline
// script below runs before first paint: it sets <html data-theme="light|dark">
// (no stored choice → follow the phone) and globals.css swaps the palette.
// It also sets <html data-tone="gold"> when the gold accent (แบบ A1) is chosen;
// no stored tone → sand (แบบ A). <ThemeSwitch>/<ToneSwitch> on /me call
// window.__sopTheme() after saving a new choice.

export const THEME_KEY = "sop-theme";
export type ThemePref = "system" | "light" | "dark";
export const TONE_KEY = "sop-tone";
export type TonePref = "sand" | "gold";

export const THEME_SCRIPT = `(function(){
var d=document,m=matchMedia('(prefers-color-scheme: dark)');
function apply(){
var p;try{p=localStorage.getItem('${THEME_KEY}')}catch(e){}
var t=p==='light'||p==='dark'?p:m.matches?'dark':'light';
d.documentElement.setAttribute('data-theme',t);
var o;try{o=localStorage.getItem('${TONE_KEY}')}catch(e){}
if(o==='gold')d.documentElement.setAttribute('data-tone','gold');else d.documentElement.removeAttribute('data-tone');
d.querySelectorAll('meta[name="theme-color"]').forEach(function(e){e.setAttribute('content',t==='dark'?'#0e1522':'#f6f3ee')});
}
window.__sopTheme=apply;apply();
m.addEventListener?m.addEventListener('change',apply):m.addListener(apply);
d.addEventListener('DOMContentLoaded',apply);
})();`;
