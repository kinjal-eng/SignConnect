'use strict';
(() => {
 const button=document.getElementById('install-app');
 let deferred=null;
 window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();deferred=event;button.hidden=false;
 });
 button.addEventListener('click',async()=>{
  if(!deferred)return;
  button.disabled=true;
  try{await deferred.prompt();await deferred.userChoice;}
  finally{deferred=null;button.hidden=true;button.disabled=false;}
 });
 window.addEventListener('appinstalled',()=>{button.hidden=true;deferred=null;});
 if('serviceWorker' in navigator && window.isSecureContext){
  navigator.serviceWorker.register('./sw.js').catch(error=>console.warn('Installation support unavailable:',error));
 }
})();
