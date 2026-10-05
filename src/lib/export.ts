export type ExportGeometry =
  | {kind:'point';x:number;y:number}
  | {kind:'rect';x:number;y:number;width:number;height:number}
  | {kind:'arrow';x1:number;y1:number;x2:number;y2:number};

export type ExportNote = {id:number;kind:string;text:string;x:number;y:number;geometry:ExportGeometry};

function geometryLabel(g:ExportGeometry){
  if(g.kind==='rect')return 'Region: '+Math.round(g.x)+'% left, '+Math.round(g.y)+'% top; '+Math.round(g.width)+'% wide × '+Math.round(g.height)+'% high';
  if(g.kind==='arrow')return 'Arrow: '+Math.round(g.x1)+'%, '+Math.round(g.y1)+'% → '+Math.round(g.x2)+'%, '+Math.round(g.y2)+'%';
  return 'Point: '+Math.round(g.x)+'% from left, '+Math.round(g.y)+'% from top';
}

export function buildHandoff(fileName:string, notes:ExportNote[]) {
  const body = notes.length
    ? notes.map(n => '### '+String(n.id).padStart(2,'0')+' · '+n.kind.toLowerCase()+'\n'+geometryLabel(n.geometry)+'\n\nInstruction: '+(n.text.trim() || '[No instruction written]')+'\nExpected result: The requested change is visible at the marked location without altering unrelated UI or behaviour.').join('\n\n')
    : 'No annotations yet.';
  return '# PATCHBOOK REVIEW\n\nScreen: '+fileName+'\n\n## Findings\n\n'+body+'\n\n## Implementation constraints\n- Treat every annotation as an explicit implementation request.\n- Preserve unrelated behaviour, content, layout structure, and visual language.\n- Do not “fix” unmarked areas unless required by the requested change.\n- After implementation, re-check every marked area at the relevant viewport.\n\n## Verification\n- Every requested annotation is addressed.\n- No unrelated visual regressions were introduced.\n- The revised screen matches the intent of the visual feedback.';
}

export function buildJSON(fileName:string, notes:ExportNote[]) {
  return JSON.stringify({
    version:3,
    review:{screen:fileName,createdAt:new Date().toISOString(),coordinateSpace:'normalized-percent'},
    annotations:notes.map(n=>({id:n.id,type:n.kind.toLowerCase(),text:n.text,geometry:n.geometry}))
  }, null, 2);
}

export async function downloadAnnotatedImage(name:string,imageSrc:string,notes:ExportNote[]) {
  const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=imageSrc;});
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas rendering is unavailable');
  ctx.drawImage(image,0,0);
  const colors:Record<string,string>={bug:'#ff5f5f',change:'#ffc857',add:'#57d7a2',remove:'#ad8cff',keep:'#63b7ff'};
  const px=(x:number)=>x/100*canvas.width,py=(y:number)=>y/100*canvas.height;
  ctx.lineWidth=Math.max(3,canvas.width/500);ctx.font='700 '+Math.max(12,canvas.width/70)+'px Inter, Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  notes.forEach(n=>{
    const color=colors[n.kind.toLowerCase()]??'#f4f4f5';ctx.strokeStyle=color;ctx.fillStyle=color;
    if(n.geometry.kind==='rect'){ctx.strokeRect(px(n.geometry.x),py(n.geometry.y),px(n.geometry.width),py(n.geometry.height));}
    if(n.geometry.kind==='arrow'){const x1=px(n.geometry.x1),y1=py(n.geometry.y1),x2=px(n.geometry.x2),y2=py(n.geometry.y2);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();const a=Math.atan2(y2-y1,x2-x1),head=Math.max(10,canvas.width/70);ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-head*Math.cos(a-.45),y2-head*Math.sin(a-.45));ctx.lineTo(x2-head*Math.cos(a+.45),y2-head*Math.sin(a+.45));ctx.closePath();ctx.fill();}
    const x=n.geometry.kind==='point'?px(n.geometry.x):px(n.x),y=n.geometry.kind==='point'?py(n.geometry.y):py(n.y),r=Math.max(11,canvas.width/55);
    ctx.beginPath();ctx.fillStyle='#0a0a0b';ctx.arc(x,y,r+2,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.fillStyle=color;ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#111';ctx.fillText(String(n.id),x,y+1);
  });
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png',1));if(!blob)throw new Error('Could not encode annotated image');
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name.replace(/\.[^.]+$/,'')+'-annotated.png';a.click();URL.revokeObjectURL(url);
}

export function downloadText(name:string, content:string, type:string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=name; a.click();
  URL.revokeObjectURL(url);
}
