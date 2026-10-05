export type ExportNote = { id:number; kind:string; text:string; x:number; y:number };

export function buildHandoff(fileName:string, notes:ExportNote[]) {
  const body = notes.length
    ? notes.map(n => `${String(n.id).padStart(2,'0')} · ${n.kind}\n${n.text.trim() || '[No instruction written]'}`).join('\n\n')
    : 'No annotations yet.';
  return `# PATCHBOOK REVIEW\n\n**Screen:** ${fileName}\n\n${body}\n\n## Implementation rule\nIncorporate every requested change. Preserve unrelated behaviour and visual language. After implementation, re-check every marked area for regressions.`;
}

export function buildJSON(fileName:string, notes:ExportNote[]) {
  return JSON.stringify({ version:1, source:{name:fileName}, annotations:notes.map(n => ({ id:n.id, type:n.kind, text:n.text, position:{x:n.x,y:n.y} })) }, null, 2);
}

export function downloadText(name:string, content:string, type:string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=name; a.click();
  URL.revokeObjectURL(url);
}
