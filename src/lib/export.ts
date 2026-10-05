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

export function downloadText(name:string, content:string, type:string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=name; a.click();
  URL.revokeObjectURL(url);
}
