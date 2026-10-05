import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Check, Clipboard, Download, ImagePlus, Layers3, Minus, Plus, Redo2, Send, Undo2, Upload, X } from 'lucide-react';
import { buildHandoff, buildJSON, downloadAnnotatedImage, downloadText, ExportGeometry } from './lib/export';
import { loadState, saveState } from './lib/storage';
import './styles.css';

type Kind='BUG'|'CHANGE'|'ADD'|'REMOVE'|'KEEP';
type Tool='PIN'|'RECT'|'ARROW';
type Geometry=ExportGeometry;
type Note={id:number;kind:Kind;text:string;x:number;y:number;geometry:Geometry;priority:'low'|'normal'|'high';status:'open'|'done'};
type Screen={id:string;fileName:string;image:string|null;viewport:{width:number;height:number}|null;notes:Note[]};
type Review={reviewId:string;title:string;createdAt:string;screens:Screen[]};
type HistorySnapshot=Review;
const meta:Record<Kind,string>={BUG:'Bug',CHANGE:'Change',ADD:'Add',REMOVE:'Remove',KEEP:'Keep'};

const newId=()=>crypto.randomUUID?.() ?? 'screen-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
const emptyScreen=():Screen=>({id:newId(),fileName:'Untitled screen',image:null,viewport:null,notes:[]});
const initialReview=():Review=>({reviewId:'review-'+Date.now().toString(36),title:'Untitled review',createdAt:new Date().toISOString(),screens:[emptyScreen()]});

function imageDimensions(src:string):Promise<{width:number;height:number}>{
 return new Promise(resolve=>{
  const img=new Image();
  img.onload=()=>resolve({width:img.naturalWidth,height:img.naturalHeight});
  img.onerror=()=>resolve({width:window.innerWidth,height:window.innerHeight});
  img.src=src;
 });
}

function App(){
 const [review,setReview]=useState<Review>(()=>initialReview());
 const [activeScreenId,setActiveScreenId]=useState('');
 const [kind,setKind]=useState<Kind>('BUG');
 const [tool,setTool]=useState<Tool>('PIN');
 const [draft,setDraft]=useState('');
 const [selectedId,setSelectedId]=useState<number|null>(null);
 const [zoom,setZoom]=useState(1);
 const [copied,setCopied]=useState(false);
 const [draftShape,setDraftShape]=useState<Geometry|null>(null);
 const [history,setHistory]=useState<HistorySnapshot[]>([]);
 const [historyIndex,setHistoryIndex]=useState(-1);
 const historyIndexRef=useRef(-1);\n const reviewRef=useRef(review);\n reviewRef.current=review;
 const hydrated=useRef(false);
 const canvasRef=useRef<HTMLDivElement>(null);
 const draggingId=useRef<number|null>(null);
 const notesRef=useRef<Note[]>([]);
 const drawing=useRef<{tool:Tool;start:{x:number;y:number}}|null>(null);

 useEffect(()=>{
  let cancelled=false;
  loadState<Review>().then(saved=>{
   if(cancelled)return;
   const next=saved?.screens?.length?saved:initialReview();
   setReview(next);
   setActiveScreenId(next.screens[0].id);
   setHistory([next]);
   historyIndexRef.current=0;
   setHistoryIndex(0);
   hydrated.current=true;
  });
  return()=>{cancelled=true};
 },[]);

 useEffect(()=>{
  if(hydrated.current)void saveState(review);
 },[review]);

 const activeScreen=review.screens.find(s=>s.id===activeScreenId) ?? review.screens[0];
 const image=activeScreen?.image ?? null;
 const notes=activeScreen?.notes ?? [];
 notesRef.current=notes;

 const currentSnapshot=():Review=>JSON.parse(JSON.stringify(reviewRef.current)) as Review;
 const record=(next:Review)=>{
  setHistory(prev=>{
   const idx=historyIndexRef.current;
   const base=idx>=0?prev.slice(0,idx+1):prev;
   const last=base[base.length-1];
   if(last&&JSON.stringify(last)===JSON.stringify(next))return prev;
   const nextHistory=[...base,next].slice(-50);
   historyIndexRef.current=nextHistory.length-1;
   setHistoryIndex(nextHistory.length-1);
   return nextHistory;
  });
 };
 const commit=(next:Review)=>{
  setReview(next);
  record(next);
 };

 const undo=()=>{
  const idx=historyIndexRef.current;
  if(idx<=0)return;
  const next=history[idx-1];
  historyIndexRef.current=idx-1;
  setHistoryIndex(idx-1);
  setReview(next);
  setSelectedId(null);
 };
 const redo=()=>{
  const idx=historyIndexRef.current;
  if(idx<0||idx>=history.length-1)return;
  const next=history[idx+1];
  historyIndexRef.current=idx+1;
  setHistoryIndex(idx+1);
  setReview(next);
  setSelectedId(null);
 };

 const updateActive=(updater:(screen:Screen)=>Screen,shouldRecord=true)=>{
  const next:Review={...review,screens:review.screens.map(s=>s.id===activeScreen.id?updater(s):s)};
  reviewRef.current=next;\n  if(shouldRecord)record(next);\n  setReview(next);
 };

 const acceptFile=(file?:File,mode:'replace'|'new'='replace')=>{
  if(!file||!file.type.startsWith('image/'))return;
  const reader=new FileReader();
  reader.onload=async()=>{
   const src=String(reader.result);
   const dims=await imageDimensions(src);
   const screen:Screen={id:newId(),fileName:file.name.replace(/\.[^.]+$/,''),image:src,viewport:dims,notes:[]};
   if(mode==='new'||activeScreen.image){
    const next:Review={...review,screens:[...review.screens,screen]};
    commit(next);
    setActiveScreenId(screen.id);
   }else{
    const next:Review={...review,screens:review.screens.map(s=>s.id===activeScreen.id?{...screen,id:s.id}:s)};
    commit(next);
   }
   setSelectedId(null);
   setZoom(1);
  };
  reader.readAsDataURL(file);
 };

 const addScreen=()=>{
  const screen=emptyScreen();
  const next:Review={...review,screens:[...review.screens,screen]};
  commit(next);
  setActiveScreenId(screen.id);
  setSelectedId(null);
  setZoom(1);
 };

 const deleteScreen=(id:string)=>{
  if(review.screens.length<=1)return;
  const index=review.screens.findIndex(s=>s.id===id);
  const nextScreens=review.screens.filter(s=>s.id!==id);
  const next:Review={...review,screens:nextScreens};
  commit(next);
  if(id===activeScreen.id){
   const nextActive=nextScreens[Math.max(0,index-1)] ?? nextScreens[0];
   setActiveScreenId(nextActive.id);
   setSelectedId(null);
  }
 };

 const handoff=useMemo(()=>buildHandoff(review),[review]);
 const nextId=()=>{
  const ids=review.screens.flatMap(s=>s.notes.map(n=>n.id));
  return ids.length?Math.max(...ids)+1:1;
 };

 const pointFromEvent=(e:React.PointerEvent<HTMLDivElement>)=>{
  const r=canvasRef.current!.getBoundingClientRect();
  return {x:Math.max(0,Math.min(100,((e.clientX-r.left)/r.width)*100)),y:Math.max(0,Math.min(100,((e.clientY-r.top)/r.height)*100))};
 };
 const startDraw=(e:React.PointerEvent<HTMLDivElement>)=>{
  if(!image||tool==='PIN'||e.button!==0)return;
  e.stopPropagation();
  drawing.current={tool,start:pointFromEvent(e)};
  canvasRef.current?.setPointerCapture(e.pointerId);
 };
 const moveDraw=(e:React.PointerEvent<HTMLDivElement>)=>{
  if(!drawing.current)return;
  const p=pointFromEvent(e),s=drawing.current.start;
  setDraftShape(drawing.current.tool==='RECT'?{kind:'rect',x:Math.min(s.x,p.x),y:Math.min(s.y,p.y),width:Math.abs(p.x-s.x),height:Math.abs(p.y-s.y)}:{kind:'arrow',x1:s.x,y1:s.y,x2:p.x,y2:p.y});
 };
 const finishDraw=(e:React.PointerEvent<HTMLDivElement>)=>{
  if(!drawing.current)return;
  const d=drawing.current,p=pointFromEvent(e),s=d.start;
  drawing.current=null;
  setDraftShape(null);
  const geometry:Geometry=d.tool==='RECT'?{kind:'rect',x:Math.min(s.x,p.x),y:Math.min(s.y,p.y),width:Math.abs(p.x-s.x),height:Math.abs(p.y-s.y)}:{kind:'arrow',x1:s.x,y1:s.y,x2:p.x,y2:p.y};
  const size=geometry.kind==='rect'?Math.max(geometry.width,geometry.height):Math.hypot(geometry.x2-geometry.x1,geometry.y2-geometry.y1);
  if(size<2)return;
  const x=geometry.kind==='rect'?geometry.x+geometry.width/2:(geometry.x1+geometry.x2)/2;
  const y=geometry.kind==='rect'?geometry.y+geometry.height/2:(geometry.y1+geometry.y2)/2;
  const note:Note={id:nextId(),kind,text:'',x,y,geometry,priority:'normal',status:'open'};
  updateActive(s=>({...s,notes:[...s.notes,note]}));
  setSelectedId(note.id);
 };
 const placePin=(e:React.MouseEvent<HTMLDivElement>)=>{
  if(!image||tool!=='PIN'||!canvasRef.current)return;
  const r=canvasRef.current.getBoundingClientRect();
  const x=Math.max(0,Math.min(100,((e.clientX-r.left)/r.width)*100));
  const y=Math.max(0,Math.min(100,((e.clientY-r.top)/r.height)*100));
  const note:Note={id:nextId(),kind,text:'',x,y,geometry:{kind:'point',x,y},priority:'normal',status:'open'};
  updateActive(s=>({...s,notes:[...s.notes,note]}));
  setSelectedId(note.id);
 };
 const updateNote=(id:number,text:string)=>{
  updateActive(s=>({...s,notes:s.notes.map(n=>n.id===id?{...n,text}:n)}),false);
 };
 const commitNoteEdit=()=>record(currentSnapshot());
 const deleteNote=(id:number)=>{
  updateActive(s=>({...s,notes:s.notes.filter(n=>n.id!==id)}));
  setSelectedId(null);
 };
 const movePin=(e:React.PointerEvent<HTMLDivElement>)=>{
  const id=draggingId.current;
  if(id===null||!canvasRef.current)return;
  const r=canvasRef.current.getBoundingClientRect();
  const x=Math.max(0,Math.min(100,((e.clientX-r.left)/r.width)*100));
  const y=Math.max(0,Math.min(100,((e.clientY-r.top)/r.height)*100));
  updateActive(s=>({...s,notes:s.notes.map(n=>n.id===id&&n.geometry.kind==='point'?{...n,x,y,geometry:{kind:'point',x,y}}:n)}),false);
 };
 const finishPin=()=>{
  if(draggingId.current===null)return;
  draggingId.current=null;
  record(currentSnapshot());
 };
 const paste=(e:React.ClipboardEvent)=>{
  const item=Array.from(e.clipboardData.items).find(i=>i.type.startsWith('image/'));
  if(!item)return;
  const f=item.getAsFile();
  if(f){acceptFile(f,'replace');e.preventDefault();}
 };
 const copy=async()=>{
  await navigator.clipboard.writeText(handoff);
  setCopied(true);
  window.setTimeout(()=>setCopied(false),1200);
 };
 const switchScreen=(id:string)=>{setActiveScreenId(id);setSelectedId(null);setZoom(1)};
 const renameScreen=(id:string,value:string)=>{
  const next:Review={...review,screens:review.screens.map(s=>s.id===id?{...s,fileName:value||'Untitled screen'}:s)};
  setReview(next);
 };

 return <div className='app' onPaste={paste}>
  <header className='topbar'>
   <div className='brand'><div className='brand-mark'>P</div><div><div className='brand-name'>Patchbook</div><div className='brand-sub'>Visual feedback for AI builds</div></div></div>
   <div className='review-title'><input aria-label='Review title' value={review.title} onChange={e=>setReview({...review,title:e.target.value||'Untitled review'})}/></div>
   <div className='top-actions'>
    <button className='icon-btn' title='Undo' aria-label='Undo' disabled={historyIndex<=0} onClick={undo}><Undo2 size={17}/></button>
    <button className='icon-btn' title='Redo' aria-label='Redo' disabled={historyIndex<0||historyIndex>=history.length-1} onClick={redo}><Redo2 size={17}/></button>
    <div className='top-divider'/>
    <button className='primary-btn' disabled={!notes.length} onClick={copy}>{copied?<Check size={16}/>:<Clipboard size={16}/>} {copied?'Copied':'Copy AI handoff'}</button>
   </div>
  </header>
  <main className='workspace'>
   <section className='stage'>
    <div className='stage-head'>
     <div><div className='eyebrow'>REVIEW</div><div className='stage-title'>{activeScreen.fileName}</div></div>
     <div className='stage-tools'>
      <label className='secondary-btn'><Upload size={15}/> Replace<input hidden type='file' accept='image/*' onChange={e=>acceptFile(e.target.files?.[0],'replace')}/></label>
      <button className='secondary-btn' onClick={addScreen}><Plus size={15}/> Add screen</button>
      <button className='icon-btn' title='Zoom out' aria-label='Zoom out' onClick={()=>setZoom(z=>Math.max(.6,z-.1))}><Minus size={16}/></button>
      <span className='zoom-label'>{Math.round(zoom*100)}%</span>
      <button className='icon-btn' title='Zoom in' aria-label='Zoom in' onClick={()=>setZoom(z=>Math.min(1.6,z+.1))}><Plus size={16}/></button>
     </div>
    </div>
    <div className='screen-tabs'>{review.screens.map((s,i)=><div key={s.id} className={'screen-tab'+(s.id===activeScreen.id?' active':'')}><button onClick={()=>switchScreen(s.id)}>{i+1}. {s.fileName}</button>{review.screens.length>1?<button className='screen-close' title='Remove screen' aria-label={'Remove screen '+(i+1)} onClick={e=>{e.stopPropagation();deleteScreen(s.id)}}><X size={11}/></button>:null}</div>)}</div>
    <div className='canvas-wrap'>
     <div ref={canvasRef} className={'review-canvas'+(!image?' empty':'')} style={image?{transform:'scale('+zoom+')'}:undefined} onClick={placePin} onPointerDown={startDraw} onPointerMove={e=>{movePin(e);moveDraw(e)}} onPointerUp={e=>{finishPin();finishDraw(e)}} onPointerCancel={e=>{finishPin();drawing.current=null;setDraftShape(null)}}>
      {image?<><img src={image} alt={activeScreen.fileName} className='canvas-image'/><svg className='annotation-layer' viewBox='0 0 100 100' preserveAspectRatio='none' aria-hidden='true'><defs><marker id='patchbook-arrow' viewBox='0 0 10 10' refX='8' refY='5' markerWidth='5' markerHeight='5' orient='auto-start-reverse'><path d='M 0 0 L 10 5 L 0 10 z' fill='currentColor'/></marker></defs>{notes.map(n=>n.geometry.kind==='rect'?<rect key={n.id} x={n.geometry.x} y={n.geometry.y} width={n.geometry.width} height={n.geometry.height} className={'shape '+n.kind.toLowerCase()+(selectedId===n.id?' selected':'')} onClick={e=>{e.stopPropagation();setSelectedId(n.id)}}/>:n.geometry.kind==='arrow'?<line key={n.id} x1={n.geometry.x1} y1={n.geometry.y1} x2={n.geometry.x2} y2={n.geometry.y2} className={'shape arrow '+n.kind.toLowerCase()+(selectedId===n.id?' selected':'')} onClick={e=>{e.stopPropagation();setSelectedId(n.id)}} markerEnd='url(#patchbook-arrow)'/>:null)}{draftShape?.kind==='rect'?<rect x={draftShape.x} y={draftShape.y} width={draftShape.width} height={draftShape.height} className='shape draft'/>:draftShape?.kind==='arrow'?<line x1={draftShape.x1} y1={draftShape.y1} x2={draftShape.x2} y2={draftShape.y2} className='shape draft arrow' markerEnd='url(#patchbook-arrow)'/>:null}</svg>{notes.map(n=>n.geometry.kind==='point'?<button key={n.id} className={'pin '+n.kind.toLowerCase()+(selectedId===n.id?' selected':'')} style={{left:n.x+'%',top:n.y+'%'}} onClick={e=>{e.stopPropagation();setSelectedId(n.id)}} onPointerDown={e=>{e.stopPropagation();draggingId.current=n.id;canvasRef.current?.setPointerCapture(e.pointerId);setSelectedId(n.id)}}>{n.id}</button>:<button key={'label-'+n.id} className={'shape-label '+n.kind.toLowerCase()+(selectedId===n.id?' selected':'')} style={{left:n.x+'%',top:n.y+'%'}} onClick={e=>{e.stopPropagation();setSelectedId(n.id)}}>{n.id}</button>)}</>:<label className='dropzone'><div className='drop-icon'><ImagePlus size={24}/></div><div className='drop-title'>{activeScreen.image?'Replace screenshot':'Drop or paste a screenshot'}</div><div className='drop-copy'>Ctrl / ⌘ + V works while Patchbook is focused.</div><input hidden type='file' accept='image/*' onChange={e=>acceptFile(e.target.files?.[0],'replace')}/></label>}
     </div>
    </div>
    <div className='canvas-foot'><span>{tool==='PIN'?'Click to place a numbered pin.':tool==='RECT'?'Drag to mark a region.':'Drag to draw an arrow.'}</span><span className='count-pill'>{notes.length} {notes.length===1?'annotation':'annotations'}</span></div>
   </section>
   <aside className='notes-panel'>
    <div className='notes-head'><div><div className='eyebrow'>PATCH NOTES</div><div className='notes-title'>Tell the AI what to fix.</div></div><div className='session-dot'/></div>
    <div className='screen-name-row'><input aria-label='Screen name' value={activeScreen.fileName} onChange={e=>renameScreen(activeScreen.id,e.target.value)} onBlur={()=>record(currentSnapshot())}/></div>
    <div className='tool-row'>{(['PIN','RECT','ARROW'] as Tool[]).map(t=><button key={t} className={'tool-chip '+(tool===t?'active':'')} onClick={()=>setTool(t)}>{t==='PIN'?'Pin':t==='RECT'?'Region':'Arrow'}</button>)}</div>
    <div className='kind-row'>{(Object.keys(meta) as Kind[]).map(k=><button key={k} className={'kind-chip '+k.toLowerCase()+(kind===k?' active':'')} onClick={()=>setKind(k)}>{meta[k]}</button>)}</div>
    <div className='composer'><div className='composer-top'><span className={'kind-dot '+kind.toLowerCase()}/><span>{meta[kind]}</span><span className='composer-number'>{nextId()}</span></div><textarea value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){const text=draft.trim();if(text){const id=nextId(),x=50,y=Math.min(88,42+notes.length*7),note:Note={id,kind,text,x,y,geometry:{kind:'point',x,y},priority:'normal',status:'open'};updateActive(s=>({...s,notes:[...s.notes,note]}));setSelectedId(id);setDraft('')}}}} placeholder='e.g. Increase the space between the icon and title.'/><div className='composer-bottom'><span className='shortcut'>Ctrl / ⌘ + Enter</span><button className='send-btn' onClick={()=>{const text=draft.trim();if(!text)return;const id=nextId(),x=50,y=Math.min(88,42+notes.length*7),note:Note={id,kind,text,x,y,geometry:{kind:'point',x,y},priority:'normal',status:'open'};updateActive(s=>({...s,notes:[...s.notes,note]}));setSelectedId(id);setDraft('')}} disabled={!draft.trim()}>Add note <Send size={14}/></button></div></div>
    <div className='notes-list'>{notes.length===0?<div className='empty-notes'><Layers3 size={18}/><div><strong>Start with the visible problem.</strong><span>Click the screenshot to place a pin, or write a note here.</span></div></div>:notes.map(n=><div key={n.id} className={'note-card'+(selectedId===n.id?' selected':'')} onClick={()=>setSelectedId(n.id)}><div className='note-number'>{String(n.id).padStart(2,'0')}</div><div className='note-body'><div className='note-meta'><span className={'type-label '+n.kind.toLowerCase()}>{meta[n.kind]}</span><button className='delete-note' title='Delete note' aria-label={'Delete note '+n.id} onClick={e=>{e.stopPropagation();deleteNote(n.id)}}><X size={13}/></button></div>{selectedId===n.id?<textarea className='note-edit' autoFocus value={n.text} onChange={e=>updateNote(n.id,e.target.value)} onBlur={commitNoteEdit} placeholder='Write the exact change...'/>:<div className='note-text'>{n.text||'Write the exact change…'}</div>}</div><ArrowUpRight size={14} className='note-arrow'/></div>)}</div>
    <div className='handoff-card'><div className='handoff-title-row'><span>AI HANDOFF</span><span className={notes.length?'ready':'handoff-empty'}>{notes.length?review.screens.length+' SCREEN'+(review.screens.length===1?'':'S')+' · READY':'EMPTY'}</span></div><div className='handoff-preview'>{notes.length?review.screens.reduce((sum,s)=>sum+s.notes.length,0)+' structured '+(review.screens.reduce((sum,s)=>sum+s.notes.length,0)===1?'instruction':'instructions')+' across '+review.screens.length+' screen'+(review.screens.length===1?'':'s'):'Add notes to build the handoff.'}</div><div className='handoff-actions'><button className='handoff-btn' onClick={copy}>{copied?'Copied':'Copy brief'}<Clipboard size={14}/></button><button className='handoff-icon' title='Download Markdown' aria-label='Download Markdown' onClick={()=>downloadText('patchbook-review.md',handoff,'text/markdown')}><Download size={14}/></button><button className='handoff-icon' title='Download JSON' aria-label='Download JSON' onClick={()=>downloadText('patchbook-review.json',buildJSON(review),'application/json')}><Download size={14}/></button><button className='handoff-icon' title='Download annotated PNG for this screen' aria-label='Download annotated PNG for this screen' disabled={!image} onClick={()=>image&&downloadAnnotatedImage(activeScreen.fileName,image,notes)}><ImagePlus size={14}/></button></div></div>
   </aside>
  </main>
 </div>
}

export default App;

class ErrorBoundary extends React.Component<{children:React.ReactNode},{error:Error|null}> {
 state={error:null as Error|null};
 static getDerivedStateFromError(error:Error){return {error}};
 componentDidCatch(error:Error,info:React.ErrorInfo){console.error('Patchbook render error',error,info);}
 render(){
  if(this.state.error){
   return <main className='fatal-error'>
    <div className='fatal-mark'>P</div>
    <div className='eyebrow'>PATCHBOOK ERROR</div>
    <h1>The review surface failed to load.</h1>
    <p>Reload once. If this persists, copy the diagnostic below and send it with the deployment URL.</p>
    <pre>{this.state.error.message}</pre>
    <button onClick={()=>window.location.reload()}>Reload Patchbook</button>
   </main>;
  }
  return this.props.children;
 }
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><App/></ErrorBoundary></React.StrictMode>);
