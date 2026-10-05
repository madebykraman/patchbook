import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Check, Clipboard, Download, ImagePlus, Layers3, Minus, Plus, Redo2, Send, Undo2, Upload, X } from 'lucide-react';
import { buildHandoff, buildJSON, downloadText } from './lib/export';
import './styles.css';

type Kind='BUG'|'CHANGE'|'ADD'|'REMOVE'|'KEEP';
type Note={id:number;kind:Kind;text:string;x:number;y:number};
type Snapshot={image:string|null;fileName:string;notes:Note[]};
const meta:Record<Kind,string>={BUG:'Bug',CHANGE:'Change',ADD:'Add',REMOVE:'Remove',KEEP:'Keep'};

function App(){
 const [image,setImage]=useState<string|null>(null),[fileName,setFileName]=useState('Current build'),[kind,setKind]=useState<Kind>('BUG'),[draft,setDraft]=useState(''),[notes,setNotes]=useState<Note[]>([]),[selectedId,setSelectedId]=useState<number|null>(null),[zoom,setZoom]=useState(1),[copied,setCopied]=useState(false);
 const [history,setHistory]=useState<Snapshot[]>([]),[historyIndex,setHistoryIndex]=useState(-1);
 const canvasRef=useRef<HTMLDivElement>(null);
 
 useEffect(()=>{
   const raw=localStorage.getItem('patchbook-session');
   if(!raw){setHistory([{image:null,fileName:'Current build',notes:[]}]);setHistoryIndex(0);return}
   try{
     const s=JSON.parse(raw);
     const restoredSnapshot:Snapshot={image:s.image??null,fileName:s.fileName??'Current build',notes:Array.isArray(s.notes)?s.notes:[]};
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
   const id=nextId();const nextNotes=[...notes,{id,kind,text,x:50,y:Math.min(88,42+notes.length*7)}];
   setNotes(nextNotes);setSelectedId(id);setDraft('');record({image,fileName,notes:nextNotes});
 };
 const placePin=(e:React.MouseEvent<HTMLDivElement>)=>{
   if(!image||!canvasRef.current)return;
   const r=canvasRef.current.getBoundingClientRect();
   const x=((e.clientX-r.left)/r.width)*100,y=((e.clientY-r.top)/r.height)*100,id=nextId();
   const nextNotes=[...notes,{id,kind,text:'',x,y}];
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
     <div ref={canvasRef} className={'review-canvas'+(!image?' empty':'')} style={image?{transform:'scale('+zoom+')'}:undefined} onClick={placePin}>
      {image?<><img src={image} alt='Current build' className='canvas-image'/>{notes.map(n=><button key={n.id} className={'pin '+n.kind.toLowerCase()+(selectedId===n.id?' selected':'')} style={{left:n.x+'%',top:n.y+'%'}} onClick={e=>{e.stopPropagation();setSelectedId(n.id)}}>{n.id}</button>)}</>:<label className='dropzone'><div className='drop-icon'><ImagePlus size={24}/></div><div className='drop-title'>Drop or paste a screenshot</div><div className='drop-copy'>Ctrl / ⌘ + V works while Patchbook is focused.</div><input hidden type='file' accept='image/*' onChange={e=>acceptFile(e.target.files?.[0])}/></label>}
     </div>
    </div>
    <div className='canvas-foot'><span>Click the screenshot to place a numbered pin.</span><span className='count-pill'>{notes.length} {notes.length===1?'annotation':'annotations'}</span></div>
   </section>
   <aside className='notes-panel'>
    <div className='notes-head'><div><div className='eyebrow'>PATCH NOTES</div><div className='notes-title'>Tell the AI what to fix.</div></div><div className='session-dot'/></div>
    <div className='kind-row'>{(Object.keys(meta) as Kind[]).map(k=><button key={k} className={'kind-chip '+k.toLowerCase()+(kind===k?' active':'')} onClick={()=>setKind(k)}>{meta[k]}</button>)}</div>
    <div className='composer'><div className='composer-top'><span className={'kind-dot '+kind.toLowerCase()}/><span>{meta[kind]}</span><span className='composer-number'>{notes.length+1}</span></div><textarea value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')addNote()}} placeholder='e.g. Increase the space between the icon and title.'/><div className='composer-bottom'><span className='shortcut'>Ctrl / ⌘ + Enter</span><button className='send-btn' onClick={addNote} disabled={!draft.trim()}>Add note <Send size={14}/></button></div></div>
    <div className='notes-list'>{notes.length===0?<div className='empty-notes'><Layers3 size={18}/><div><strong>Start with the visible problem.</strong><span>Click the screenshot to place a pin, or write a note here.</span></div></div>:notes.map(n=><div key={n.id} className={'note-card'+(selectedId===n.id?' selected':'')} onClick={()=>setSelectedId(n.id)}><div className='note-number'>{String(n.id).padStart(2,'0')}</div><div className='note-body'><div className='note-meta'><span className={'type-label '+n.kind.toLowerCase()}>{meta[n.kind]}</span><button className='delete-note' title='Delete note' aria-label={'Delete note '+n.id} onClick={e=>{e.stopPropagation();deleteNote(n.id)}}><X size={13}/></button></div>{selectedId===n.id?<textarea className='note-edit' autoFocus value={n.text} onChange={e=>updateNote(n.id,e.target.value)} onBlur={commitNoteEdit} placeholder='Write the exact change...'/>:<div className='note-text'>{n.text||'Write the exact change…'}</div>}</div><ArrowUpRight size={14} className='note-arrow'/></div>)}</div>
    <div className='handoff-card'><div className='handoff-title-row'><span>AI HANDOFF</span><span className={notes.length?'ready':'handoff-empty'}>{notes.length?'READY':'EMPTY'}</span></div><div className='handoff-preview'>{notes.length?notes.length+' structured '+(notes.length===1?'instruction':'instructions')+' + visual context':'Add notes to build the handoff.'}</div><div className='handoff-actions'><button className='handoff-btn' onClick={copy}>{copied?'Copied':'Copy brief'}<Clipboard size={14}/></button><button className='handoff-icon' title='Download Markdown' aria-label='Download Markdown' onClick={()=>downloadText('patchbook-review.md',handoff,'text/markdown')}><Download size={14}/></button><button className='handoff-icon' title='Download JSON' aria-label='Download JSON' onClick={()=>downloadText('patchbook-review.json',buildJSON(fileName,notes),'application/json')}><Download size={14}/></button></div></div>
   </aside>
  </main>
 </div>
}

export default App;
