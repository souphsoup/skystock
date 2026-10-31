// Opening the link on a phone shows "install first" instead of the app. The
// inline script below decides before first paint (no flash of the login page):
// it sets <html data-install="ios|android|line|inapp"> and globals.css shows
// <InstallGate> and the matching steps. Already installed (standalone), desktop,
// or "use in browser" tapped this session → no attribute, app shows as usual.

export const INSTALL_SKIP_KEY = "sop-install-skip";

export const INSTALL_GATE_SCRIPT = `(function(){
var w=window,n=navigator,u=n.userAgent;
w.addEventListener('beforeinstallprompt',function(e){e.preventDefault();w.__sopInstall=e;w.dispatchEvent(new Event('sop-install'))});
w.addEventListener('appinstalled',function(){w.__sopInstall=null;w.__sopInstalled=true;w.dispatchEvent(new Event('sop-install'))});
try{
if(matchMedia('(display-mode: standalone)').matches||n.standalone||sessionStorage.getItem('${INSTALL_SKIP_KEY}'))return;
var ios=/iPad|iPhone|iPod/.test(u)||(n.platform==='MacIntel'&&n.maxTouchPoints>1);
if(!ios&&!/Android/.test(u))return;
document.documentElement.setAttribute('data-install',/\\bLine\\//i.test(u)?'line':/FBAN|FBAV|FB_IAB|Instagram|Messenger|MicroMessenger|KAKAOTALK/i.test(u)?'inapp':ios?'ios':'android');
}catch(e){}
})();`;
