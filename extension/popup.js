document.getElementById('capture').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
  if (!tab?.id) return;
  await chrome.tabs.sendMessage(tab.id, {type:'PATCHBOOK_START_PICKER'});
  window.close();
});