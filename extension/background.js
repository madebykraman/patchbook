const PATCHBOOK_URL='https://patchbook-drab.vercel.app/';

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
  await chrome.storage.local.set({patchbookCapture:packet});
  const captureTab=await chrome.tabs.create({url:PATCHBOOK_URL});
  const listener=(tabId,info)=>{
    if(tabId!==captureTab.id||info.status!=='complete')return;
    chrome.tabs.onUpdated.removeListener(listener);
    chrome.tabs.sendMessage(tabId,{type:'PATCHBOOK_DELIVER_CAPTURE',packet}).catch(()=>{});
  };
  chrome.tabs.onUpdated.addListener(listener);
});