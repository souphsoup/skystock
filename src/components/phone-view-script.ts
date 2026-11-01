// "Phone view" on a computer: the whole app at phone width, so managers can see the
// screens staff use. Per device (localStorage). The inline script below runs before
// first paint and sets <html data-view="phone">; globals.css then turns the sm/md/lg/xl
// layouts off and narrows the page. <PhoneViewButton> / <PhoneViewExit> flip it.

export const VIEW_KEY = "sop-view";

export const PHONE_VIEW_SCRIPT = `(function(){
try{if(localStorage.getItem('${VIEW_KEY}')==='phone')document.documentElement.setAttribute('data-view','phone')}catch(e){}
})();`;
