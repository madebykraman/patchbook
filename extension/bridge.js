chrome.runtime.onMessage.addListener(message=>{
  if(message?.type!=='PATCHBOOK_DELIVER_CAPTURE')return;
  window.postMessage(message.packet,'*');
});