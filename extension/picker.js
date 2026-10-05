let active=false;
let hoverEl=null;
let outline=null;

function ensureOutline(){
  if(outline)return;
  outline=document.createElement('div');
  outline.style.cssText='position:fixed;z-index:2147483646;pointer-events:none;border:2px solid #8b5cf6;background:rgba(139,92,246,.08);box-shadow:0 0 0 1px rgba(255,255,255,.45);display:none';
  document.documentElement.appendChild(outline);
}

function showOutline(el){
  ensureOutline();
  const r=el.getBoundingClientRect();
  outline.style.display='block';
  outline.style.left=r.left+'px';
  outline.style.top=r.top+'px';
  outline.style.width=r.width+'px';
  outline.style.height=r.height+'px';
}

function hideOutline(){
  if(outline)outline.style.display='none';
}

function cssEscape(value){
  if(window.CSS?.escape)return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g,'\\$&');
}

function selectorFor(el){
  if(el.id)return '#'+cssEscape(el.id);
  const parts=[];
  let node=el;
  for(let i=0;node&&node.nodeType===1&&i<5;node=node.parentElement,i++){
    let part=node.tagName.toLowerCase();
    if(node.getAttribute('data-testid'))part+='[data-testid="'+cssEscape(node.getAttribute('data-testid'))+'"]';
    else if(node.getAttribute('data-component'))part+='[data-component="'+cssEscape(node.getAttribute('data-component'))+'"]';
    else{
      const classes=Array.from(node.classList).filter(Boolean).slice(0,2);
      if(classes.length)part+='.'+classes.map(cssEscape).join('.');
    }
    if(node.parentElement){
      const siblings=Array.from(node.parentElement.children).filter(s=>s.tagName===node.tagName);
      if(siblings.length>1)part+=':nth-of-type('+(siblings.indexOf(node)+1)+')';
    }
    parts.unshift(part);
    const candidate=parts.join(' > ');
    try{if(document.querySelectorAll(candidate).length===1)return candidate}catch{}
  }
  return parts.join(' > ');
}

function reactFiberFor(el){
  try{
    const key=Object.keys(el).find(k=>k.startsWith('__reactFiber$')||k.startsWith('__reactInternalInstance$'));
    return key?el[key]:null;
  }catch{
    return null;
  }
}

function componentTypeName(type){
  try{
    if(typeof type==='function')return type.displayName||type.name||undefined;
    if(type&&typeof type==='object'){
      if(type.displayName)return type.displayName;
      if(type.type)return componentTypeName(type.type);
      if(type.render)return type.render.displayName||type.render.name||undefined;
    }
  }catch{}
  return undefined;
}

function reactContext(el){
  let fiber=reactFiberFor(el);
  let component;
  let source;
  for(let depth=0;fiber&&depth<20;depth++,fiber=fiber.return){
    const name=componentTypeName(fiber.type);
    if(name&&!component)component=name;
    const debug=fiber._debugSource;
    if(debug?.fileName){
      source=debug;
      break;
    }
  }
  if(!component&&!source)return {};
  return {
    framework:'react',
    component,
    sourceFile:source?.fileName,
    sourceLine:source?.lineNumber,
    sourceColumn:source?.columnNumber
  };
}

function describe(el){
  const text=(el.innerText||el.textContent||'').trim().replace(/\s+/g,' ').slice(0,180);
  const react=reactContext(el);
  return {
    tag:el.tagName.toLowerCase(),
    id:el.id||undefined,
    classes:Array.from(el.classList).slice(0,8),
    role:el.getAttribute('role')||undefined,
    ariaLabel:el.getAttribute('aria-label')||undefined,
    text:text||undefined,
    selector:selectorFor(el),
    component:el.getAttribute('data-component')||el.getAttribute('data-slot')||react.component,
    ...react
  };
}

function stop(){
  active=false;
  hideOutline();
  window.removeEventListener('mousemove',move,true);
  window.removeEventListener('click',pick,true);
  document.documentElement.style.cursor='';
}

function move(event){
  if(!active)return;
  const el=event.target;
  if(!(el instanceof Element)||el===outline||outline?.contains(el))return;
  hoverEl=el;
  showOutline(el);
}

function pick(event){
  if(!active)return;
  const el=hoverEl||event.target;
  if(!(el instanceof Element))return;
  event.preventDefault();
  event.stopPropagation();
  const detail=describe(el);
  stop();
  chrome.runtime.sendMessage({
    type:'PATCHBOOK_ELEMENT_SELECTED',
    element:detail,
    page:{url:location.href,title:document.title,route:location.pathname+location.search,viewport:{width:innerWidth,height:innerHeight}}
  });
}

chrome.runtime.onMessage.addListener(message=>{
  if(message?.type!=='PATCHBOOK_START_PICKER')return;
  active=true;
  ensureOutline();
  document.documentElement.style.cursor='crosshair';
  window.addEventListener('mousemove',move,true);
  window.addEventListener('click',pick,true);
});
