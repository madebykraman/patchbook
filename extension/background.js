const PATCHBOOK_URL='https://patchbook-drab.vercel.app/';

function captureKey(){
  const id=crypto.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2,10);
  return 'patchbookCapture:'+id;
}

chrome.runtime.onMessage.addListener(async message=>{
  if(message?.type!=='PATCHBOOK_ELEMENT_SELECTED')return;
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab?.id)return;
  const image=await chrome.tabs.captureVisibleTab(tab.windowId,{format:'png'});
  const packet={
    kind:'patchbook-browser-capture',
    version:1,
    capturedAt:new Date().toISOString(),
    source:{
      url:message.page.url,
      title:message.page.title,
      route:message.page.route,
      viewport:message.page.viewport,
      element:message.element
    },
    image,
    fileName:(message.page.title||'browser-capture').replace(/[^a-z0-9-_]+/gi,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'browser-capture'
  };
  const key=captureKey();
  await chrome.storage.local.set({[key]:packet});
  await chrome.tabs.create({url:PATCHBOOK_URL+'?captureId='+encodeURIComponent(key)});
});
