export type BrowserCapture = {
  kind: 'patchbook-browser-capture';
  version: 1;
  capturedAt: string;
  source: {
    url: string;
    title: string;
    route: string;
    viewport: { width: number; height: number };
    element?: {
      tag: string;
      id?: string;
      classes?: string[];
      role?: string;
      ariaLabel?: string;
      text?: string;
      selector: string;
      component?: string;
    };
  };
  image: string;
  fileName: string;
};

export function isBrowserCapture(value: unknown): value is BrowserCapture {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<BrowserCapture>;
  return v.kind === 'patchbook-browser-capture'
    && v.version === 1
    && typeof v.image === 'string'
    && typeof v.source?.url === 'string';
}
