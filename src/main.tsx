import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, Check, Clipboard, Download, ImagePlus, Layers3, Minus, Plus, Redo2, Send, Undo2, Upload, X } from 'lucide-react';
import { buildHandoff, buildJSON, downloadText } from './lib/export';
import './styles.css';

type Kind='BUG'|'CHANGE'|'ADD'|'REMOVE'|'KEEP';
type Tool='PIN'|'RECT'|'ARROW';
type Geometry={kind:'point';x:number;y:number}|{kind:'rect';x:number;y:number;width:number;height:number}|{kind:'arrow';x1:number;y1:number;x2:number;y2:number};
type Note={id:number;kind:Kind;text:string;x:number;y:number;geometry:Geometry};
type Snapshot={image:string|null;fileName:string;notes:Note[]};
const meta:Record<Kind,string>={BUG:'Bug',CHANGE:'Change',ADD:'Add',REMOVE:'Remove',KEEP:'Keep'};

function App(){
 const [image,setImage]=useState<string|null>(null),[fileName,setFileName]=useState('Current build'),[kind,setKind]=useState<Kind>('BUG'),[tool,setTool]=useState<Tool>('PIN'),[draft,setDraft]=useState(''),[notes,setNotes]=useState<Note[]>([]),[selectedId,setSelectedId]=useState<number|null>(null),[zoom,setZoom]=useState(1),[copied,setCopied]=useState(false),[draftShape,setDraftShape]=useState<Geometry|null>(null);
 const [history,setHistory]=useState<Snapshot[]>([]),[historyIndex,setHistoryIndex]=useState(-1);
 const canvasRef=useRef<HTMLDivElement>(null), draggingId=useRef<number|null>(null), notesRef=useRef<Note[]>([]);
 notesRef.current=notes;
 
 useEffect(()=>{
   const raw=localStorage.getItem('patchbook-session');
   if(!raw){setHistory([{image:null,fileName:'Current build',notes:[]}]);setHistoryIndex(0);return}
   try{
     const s=JSON.parse(raw);
     const restoredSnapshot:Snapshot={image:s.image??null,fileName:s.fileName??'Current build',notes:Array.isArray(s.notes)?s.notes.map((n:Note)=>({...n,geometry:n.geometry??{kind:'point',x:n.x,y:n.y}})):[]};
     setImage(restoredSnapshot.image);setFileName(restoredSnapshot.fileName);setNotes(restoredSnapshot.notes);
     setHistory([restoredSnapshot]);setHistoryIndex(0);
   }catch{
     setHistory([{image:null,fileName:'Current build',notes:[]}]);setHistoryIndex(0);
   }
  },[]);

 useEffect(()=>{if(historyIndex>=0)localStorage.setItem('patchbook-session',JSON.stringify({image,fileName,notes}))},[image,fileName,notes,historyIndex]);

 const currentSnapshot=():Snapshot=>({image,fileName,notes});
 const record=(next:Snapshot)=>{
   setHistory(prev=>{
     const base=historyIndex>=0?prev.slice(0,historyIndex+1):prev;
     const last=base[base.length-1];
     if(last&&JSON.stringify(last)===JSON.stringify(next))return prev;
     return [...base,next].slice(-50);
   });
   setHistoryIndex(prev=>Math.min(prev+1,49));
 };

 const applySnapshot=(s:Snapshot)=>{setImage(s.image);setFileName(s.fileName);setNotes(s.notes);setSelectedId(null)};
 const undo=()=>{if(historyIndex<=0)return;const next=history[historyIndex-1];setHistoryIndex(historyIndex-1);applySnapshot(next)};
 const redo=()=>{if(historyIndex<0||historyIndex>=history.length-1)return;const next=history[historyIndex+1];setHistoryIndex(historyIndex+1);applySnapshot(next)};

 const handoff=useMemo(()=>buildHandoff(fileName,notes),[fileName,notes]);
 const nextId=()=>notes.length?Math.max(...notes.map(n=>n.id))+1:1;
 const acceptFile=(file?:File)=>{
   if(!file||!file.type.startsWith('image/'))return;
   const r=new FileReader();
   r.onload=()=>{
     const next:Snapshot={image:String(r.result),fileName:file.name.replace(/\.[^.]+$/,''),notes:[]};
     setImage(next.image);setFileName(next.fileName);setNotes([]);setSelectedId(null);record(next);
   };
   r.readAsDataURL(file);
 };
 const addNote=()=>{
   const text=draft.trim();if(!text)return;
   const id=nextId();const x=50,y=Math.min(88,42+notes.length*7);const nextNotes=[...notes,{id,kind,text,x,y,geometry:{kind:'point',x,y}}];
   setNotes(nextNotes);setSelectedId(id);setDraft('');record({image,fileName,notes:nextNotes});
 };
 const pointFromEvent=(e:React.PointerEvent<HTMLDivElement>)=>{
   const r=canvasRef.current!.getBoundingClientRect();
   return {x:Math.max(0,Math.min(100,((e.clientX-r.left)/r.width)*100)),y:Math.max(0,Math.min(100,((e.clientY-r.top)/r.height)*100))};
 };
 const drawing=useRef<{tool:Tool;start:{x:number;y:number}}|null>(null);
 const startDraw=(e:React.PointerEvent<HTMLDivElement>)=>{
   if(!image||tool==='PIN'||e.button!==0)return;
   e.stopPropagation();drawing.current={tool,start:pointFromEvent(e)};canvasRef.current?.setPointerCapture(e.pointerId);
 };
 const moveDraw=(e:React.PointerEvent<HTMLDivElement>)=>{
   if(!drawing.current)return;
   const p=pointFromEvent(e),s=drawing.current.start;
   setDraftShape(drawing.current.tool==='RECT'?{kind:'rect',x:Math.min(s.x,p.x),y:Math.min(s.y,p.y),width:Math.abs(p.x-s.x),height:Math.abs(p.y-s.y)}:{kind:'arrow',x1:s.x,y1:s.y,x2:p.x,y2:p.y});
 };
 const finishDraw=(e:React.PointerEvent<HTMLDivElement>)=>{
   if(!drawing.current)return;
   const d=drawing.current;const p=pointFromEvent(e);const s=d.start;drawing.current=null;setDraftShape(null);
   const geometry:Geometry=d.tool==='RECT'?{kind:'rect',x:Math.min(s.x,p.x),y:Math.min(s.y,p.y),width:Math.abs(p.x-s.x),height:Math.abs(p.y-s.y)}:{kind:'arrow',x1:s.x,y1:s.y,x2:p.x,y2:p.y};
   const size=geometry.kind==='rect'?Math.max(geometry.width,geometry.height):Math.hypot(geometry.x2-geometry.x1,geometry.y2-geometry.y1);
   if(size<2)return;
   const x=geometry.kind==='rect'?geometry.x+geometry.width/2:(geometry.x1+geometry.x2)/2;
   const y=geometry.kind==='rect'?geometry.y+geometry.height/2:(geometry.y1+geometry.y2)/2;
   const id=nextId(),nextNotes=[...notes,{id,kind,text:'',x,y,geometry}];
   setNotes(nextNotes);setSelectedId(id);record({image,fileName,notes:nextNotes});
 };
 const placePin=(e:React.MouseEvent<HTMLDivElement>)=>{
   if(!image||tool!=='PIN'||!canvasRef.current)return;
   const r=canvasRef.current.getBoundingClientRect(),x=Math.max(0,Math.min(100,((e.clientX-r.left)/r.width)*100)),y=Math.max(0,Math.min(100,((e.clientY-r.top)/r.height)*100)),id=nextId();
   const nextNotes=[...notes,{id,kind,text:'',x,y,geometry:{kind:'point',x,y}}];
   setNotes(nextNotes);setSelectedId(id);record({image,fileName,notes:nextNotes});
 };
 const updateNote=(id:number,text:string)=>{
   const nextNotes=notes.map(v=>v.id===id?{...v,text}:v);setNotes(nextNotes);
 };
 const commitNoteEdit=()=>record(currentSnapshot());
 const deleteNote=(id:number)=>{
   const nextNotes=notes.filter(v=>v.id!==id);setNotes(nextNotes);setSelectedId(null);record({image,fileName,notes:nextNotes});
 };
 const copy=async()=>{await navigator.clipboard.writeText(handoff);setCopied(true);window.setTimeout(()=>setCopied(false),1200)};
 const movePin=(e:React.PointerEvent<HTMLDivElement>)=>{
   const id=draggingId.current;if(id===null||!canvasRef.current)return;
   const r=canvasRef.current.getBoundingClientRect();
   const x=Math.max(0,Math.min(100,((e.clientX-r.left)/r.width)*100));
   const y=Math.max(0,Math.min(100,((e.clientY-r.top)/r.height)*100));
   setNotes(current=>current.map(n=>n.id===id?{...n,x,y,geometry:n.geometry.kind==='point'?{kind:'point',x,y}:n.geometry}:n));
 };
 const finishPin=()=>{
   if(draggingId.current===null)return;
   draggingId.current=null;
   record({image,fileName,notes:notesRef.current});
 };
 const paste=(e:React.ClipboardEvent)=>{const item=Array.from(e.clipboardData.items).find(i=>i.type.startsWith('image/'));if(!item)return;const f=item.getAsFile();if(f){acceptFile(f);e.preventDefault()}};

 return <div className='app' onPaste={paste}>
  <header className='topbar'>
   <div className='brand'><div className='brand-mark'>P</div><div><div className='brand-name'>Patchbook</div><div className='brand-sub'>Visual feedback for AI builds</div></div></div>
   <div className='top-actions'>
    <button className='icon-btn' title='Undo' aria-label='Undo' disabled={historyIndex<=0} onClick={undo}><Undo2 size={17}/></button>
    <button className='icon-btn' title='Redo' aria-label='Redo' disabled={historyIndex<0||historyIndex>=history.length-1} onClick={redo}><Redo2 size={17}/></button>
    <div className='top-divider'/>
    <button className='primary-btn' disabled={!notes.length} onClick={copy}>{copied?<Check size={16}/>:<Clipboard size={16}/>} {copied?'Copied':'Copy AI handoff'}</button>
   </div>
  </header>
  <main className='workspace'>
   <section className='stage'>
    <div className='stage-head'><div><div className='eyebrow'>REVIEW</div><div className='stage-title'>{fileName}</div></div><div className='stage-tools'><label className='secondary-btn'><Upload size={15}/> Replace image<input hidden type='file' accept='image/*' onChange={e=>acceptFile(e.target.files?.[0])}/></label><button className='icon-btn' title='Zoom out' aria-label='Zoom out' onClick={()=>setZoom(z=>Math.max(.6,z-.1))}><Minus size={16}/></button><span className='zoom-label'>{Math.round(zoom*100)}%</span><button className='icon-btn' title='Zoom in' aria-label='Zoom in' onClick={()=>setZoom(z=>Math.min(1.6,z+.1))}><Plus size={16}/></button></div></div>
    <div className='canvas-wrap'>
     <div ref={canvasRef} className={'review-canvas'+(!image?' empty':'')} style={image?{transform:'scale('+zoom+')'}:undefined} onClick={placePin} onPointerDown={startDraw} onPointerMove={e=>{movePin(e);moveDraw(e)}} onPointerUp={e=>{finishPin();finishDraw(e)}} onPointerCancel={e=>{finishPin();drawing.current=null;setDraftShape(null)}}>
      {image?<><img src={image} alt='Current build' className='canvas-image'/><svg className='annotation-layer' viewBox='0 0 100 100' preserveAspectRatio='none' aria-hidden='true'><defs><marker id='patchbook-arrow' viewBox='0 0 10 10' refX='8' refY='5' markerWidth='5' markerHeight='5' orient='auto-start-reverse'><path d='M 0 0 L 10 5 L 0 10 z' fill='currentColor'/></marker></defs>{notes.map(n=>n.geometry.kind==='rect'?<rect key={n.id} x={n.geometry.x} y={n.geometry.y} width={n.geometry.width} height={n.geometry.height} className={'shape '+n.kind.toLowerCase()+(selectedId===n.id?' selected':'')} onClick={e=>{e.stopPropagation();setSelectedId(n.id)}}/>:n.geometry.kind==='arrow'?<line key={n.id} x1={n.geometry.x1} y1={n.geometry.y1} x2={n.geometry.x2} y2={n.geometry.y2} className={'shape arrow '+n.kind.toLowerCase()+(selectedId===n.id?' selected':'')} onClick={e=>{e.stopPropagation();setSelectedId(n.id)}} markerEnd='url(#patchbook-arrow)'/>:null)}{draftShape?.kind==='rect'?<rect x={draftShape.x} y={draftShape.y} width={draftShape.width} height={draftShape.height} className='shape draft'/>:draftShape?.kind==='arrow'?<line x1={draftShape.x1} y1={draftShape.y1} x2={draftShape.x2} y2={draftShape.y2} className='shape draft arrow' markerEnd='url(#patchbook-arrow)'/>:null}</svg>{notes.map(n=>n.geometry.kind==='point'?<button key={n.id} className={'pin '+n.kind.toLowerCase()+(selectedId===n.id?' selected':'')} style={{left:n.x+'%',top:n.y+'%'}} onClick={e=>{e.stopPropagation();setSelectedId(n.id)}} onPointerDown={e=>{e.stopPropagation();draggingId.current=n.id;canvasRef.current?.setPointerCapture(e.pointerId);setSelectedId(n.id)}}>{n.id}</button>:<button key={'label-'+n.id} className={'shape-label '+n.kind.toLowerCase()+(selectedId===n.id?' selected':'')} style={{left:n.x+'%',top:n.y+'%'}} onClick={e=>{e.stopPropagation();setSelectedId(n.id)}}>{n.id}</button>)}</>:<label className='dropzone'><div className='drop-icon'><ImagePlus size={24}/></div><div className='drop-title'>Drop or paste a screenshot</div><div className='drop-copy'>Ctrl / ⌘ + V works while Patchbook is focused.</div><input hidden type='file' accept='image/*' onChange={e=>acceptFile(e.target.files?.[0])}/></label>}
     </div>
    </div>
    <div className='canvas-foot'><span>{tool==='PIN'?'Click to place a numbered pin.':tool==='RECT'?'Drag to mark a region.':'Drag to draw an arrow.'}</span><span className='count-pill'>{notes.length} {notes.length===1?'annotation':'annotations'}</span></div>
   </section>
   <aside className='notes-panel'>
    <div className='notes-head'><div><div className='eyebrow'>PATCH NOTES</div><div className='notes-title'>Tell the AI what to fix.</div></div><div className='session-dot'/></div>
    <div className='tool-row'>{(['PIN','RECT','ARROW'] as Tool[]).map(t=><button key={t} className={'tool-chip '+(tool===t?'active':'')} onClick={()=>setTool(t)}>{t==='PIN'?'Pin':t==='RECT'?'Region':'Arrow'}</button>)}</div><div className='kind-row'>{(Object.keys(meta) as Kind[]).map(k=><button key={k} className={'kind-chip '+k.toLowerCase()+(kind===k?' active':'')} onClick={()=>setKind(k)}>{meta[k]}</button>)}</div>
    <div className='composer'><div className='composer-top'><span className={'kind-dot '+kind.toLowerCase()}/><span>{meta[kind]}</span><span className='composer-number'>{notes.length+1}</span></div><textarea value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')addNote()}} placeholder='e.g. Increase the space between the icon and title.'/><div className='composer-bottom'><span className='shortcut'>Ctrl / ⌘ + Enter</span><button className='send-btn' onClick={addNote} disabled={!draft.trim()}>Add note <Send size={14}/></button></div></div>
    <div className='notes-list'>{notes.length===0?<div className='empty-notes'><Layers3 size={18}/><div><strong>Start with the visible problem.</strong><span>Click the screenshot to place a pin, or write a note here.</span></div></div>:notes.map(n=><div key={n.id} className={'note-card'+(selectedId===n.id?' selected':'')} onClick={()=>setSelectedId(n.id)}><div className='note-number'>{String(n.id).padStart(2,'0')}</div><div className='note-body'><div className='note-meta'><span className={'type-label '+n.kind.toLowerCase()}>{meta[n.kind]}</span><button className='delete-note' title='Delete note' aria-label={'Delete note '+n.id} onClick={e=>{e.stopPropagation();deleteNote(n.id)}}><X size={13}/></button></div>{selectedId===n.id?<textarea className='note-edit' autoFocus value={n.text} onChange={e=>updateNote(n.id,e.target.value)} onBlur={commitNoteEdit} placeholder='Write the exact change...'/>:<div className='note-text'>{n.text||'Write the exact change…'}</div>}</div><ArrowUpRight size={14} className='note-arrow'/></div>)}</div>
    <div className='handoff-card'><div className='handoff-title-row'><span>AI HANDOFF</span><span className={notes.length?'ready':'handoff-empty'}>{notes.length?'READY':'EMPTY'}</span></div><div className='handoff-preview'>{notes.length?notes.length+' structured '+(notes.length===1?'instruction':'instructions')+' + visual context':'Add notes to build the handoff.'}</div><div className='handoff-actions'><button className='handoff-btn' onClick={copy}>{copied?'Copied':'Copy brief'}<Clipboard size={14}/></button><button className='handoff-icon' title='Download Markdown' aria-label='Download Markdown' onClick={()=>downloadText('patchbook-review.md',handoff,'text/markdown')}><Download size={14}/></button><button className='handoff-icon' title='Download JSON' aria-label='Download JSON' onClick={()=>downloadText('patchbook-review.json',buildJSON(fileName,notes),'application/json')}><Download size={14}/></button></div></div>
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
