export type ExportNote = { id:number; kind:string; text:string; x:number; y:number };

export function buildHandoff(fileName:string, notes:ExportNote[]) {
  const body = notes.length
    ? notes.map(n => {
        const location='Location: '+Math.round(n.x)+'% from left, '+Math.round(n.y)+'% from top';
        return '### '+String(n.id).padStart(2,'0')+' · '+n.kind.toLowerCase()+'\n'+location+'\n\nInstruction: '+(n.text.trim() || '[No instruction written]')+'\nExpected result: The requested change is visible at this marked location without altering unrelated UI or behaviour.';
      }).join('\n\n')
    : 'No annotations yet.';
  return '# PATCHBOOK REVIEW\n\nScreen: '+fileName+'\n\n## Findings\n\n'+body+'\n\n## Implementation constraints\n- Treat every annotation as an explicit implementation request.\n- Preserve unrelated behaviour, content, layout structure, and visual language.\n- Do not “fix” unmarked areas unless required by the requested change.\n- After implementation, re-check every marked area at the relevant viewport.\n\n## Verification\n- Every requested annotation is addressed.\n- No unrelated visual regressions were introduced.\n- The revised screen matches the intent of the visual feedback.';
}

export function buildJSON(fileName:string, notes:ExportNote[]) {
  return JSON.stringify({
    version:2,
    review:{screen:fileName,createdAt:new Date().toISOString()},
    annotations:notes.map(n=>({
      id:n.id,type:n.kind.toLowerCase(),text:n.text,
      geometry:{kind:'point',x:n.x,y:n.y,coordinateSpace:'normalized-percent'}
    }))
  }, null, 2);
}

export function downloadText(name:string, content:string, type:string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=name; a.click();
  URL.revokeObjectURL(url);
}
