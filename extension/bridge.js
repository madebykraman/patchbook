const captureId=new URL(location.href).searchParams.get('captureId');

if(captureId){
  chrome.storage.local.get(captureId).then(result=>{
    const packet=result[captureId];
    if(!packet)return;
    window.postMessage(packet,location.origin);
    return chrome.storage.local.remove(captureId);
  }).catch(error=>console.warn('Patchbook capture bridge failed',error));
}
