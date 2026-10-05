# Patchbook

Visual feedback workspace for AI-built interfaces.

Patchbook turns screenshots into structured, AI-ready build feedback: place the current UI beside your notes, annotate exact regions, and export a single review package that preserves both visual evidence and explicit instructions.

## Initial product direction

- Screenshot-first review canvas
- Side-by-side visual evidence + written feedback
- Numbered pins/regions tied to individual notes
- Feedback types: bug, change, add, remove, keep, question
- Multi-screenshot review sessions
- AI handoff export: annotated image + structured Markdown/JSON
- Local-first working state before any optional sync
- Fast keyboard-driven workflow

## Competitive intelligence

Patchbook should combine the strongest ideas observed in existing products without becoming a generic whiteboard:

- Markup Hero: mature screenshot annotation, multi-page images, history, copy/download/share, and browser capture. The product also exposes AI-assisted screenshot-to-text. 
- BugHerd: in-context pins tied to page elements, automatic screenshots/technical context, and task tracking.
- FigJam: flexible visual canvas, imported images, sticky notes, and export of boards/notes.
- Pinpoint: screenshot pins + comments with structured JSON and an agent-oriented workflow.
- AA.Annotate: privacy masks, crop/scale, numbered annotation boxes, separate agent-facing exports, and structured handoff files.
- Snap: fast global capture with annotations plus local agent/MCP handoff.
- Markup: browser-side annotation with generated structured fix briefs.
- Markagent: element-aware browser annotation with selectors, source context, screenshots, and agent-ready prompts.
- Loupe / FasterFixes: feedback that can flow into engineering systems and agent workflows.
- Snip Browser: capture -> annotate -> local AI visual context loop.

Patchbook's differentiator is the review-board composition itself: a deliberately readable screenshot + instruction sheet designed to be pasted directly into multimodal AI, while also retaining machine-readable structure.

## Design/engineering principles

Prefer direct component ownership, semantic design tokens, accessible interactions, restrained motion, strong keyboard support, and no opaque runtime lock-in. Keep the core workflow fast enough that taking a review should be easier than writing a long bug description.

The first implementation should remain dependency-light and local-first. Architecture should leave clear seams for browser capture, persistent sessions, AI/agent integrations, and export formats later.

## Product loop

1. Capture or paste visual state.
2. Frame/crop the relevant evidence.
3. Add numbered annotations.
4. Write precise feedback beside the visual.
5. Reorder/prioritize feedback.
6. Export an AI handoff containing the annotated visual and structured instructions.
7. Paste/send to the coding agent.
8. Review the resulting build and repeat.

## Roadmap

### v0.1 — core canvas
- App shell and design system
- Drag/drop/paste image intake
- Split visual + notes workspace
- Annotation/pin layer
- Notes panel
- Local persistence
- PNG export

### v0.2 — AI handoff
- Structured Markdown export
- JSON export
- Annotation crops and coordinates
- Copy-to-clipboard handoff
- Explicit "AI Review" template

### v0.3 — builder workflow
- Browser screenshot capture
- Multi-page/multi-screenshot sessions
- Issue statuses and priority
- Keyboard-first command system
- Privacy redaction
- Import/export project files

### v0.4 — agent integration
- Local agent inbox
- MCP/CLI bridge
- Codex / Claude Code / Cursor handoff adapters
- Browser element metadata where available


## Browser capture bridge

Patchbook now includes an unpacked Chrome MV3 extension under `extension/`. It lets a reviewer select a live UI element, capture the visible tab, collect DOM/accessibility context, and open Patchbook with the resulting capture packet. The packet preserves the URL, route, viewport, selector, element metadata and screenshot, plus opportunistic React component/source context when a development build exposes it. The bridge is local-first and does not require a Patchbook backend.

Capture packets are temporarily stored in `chrome.storage.local` under a generated key instead of pushing large screenshots through tab messaging. The Patchbook bridge consumes that key and removes it after import.

The capture protocol is intentionally small and versioned as `patchbook-browser-capture/v1`. Source metadata is best-effort and never required for the core review flow.

## Local MCP bridge

A first local MCP server now lives under `mcp/`. It reads exported Patchbook JSON packets from a configurable inbox and exposes `list_reviews`, `get_latest_review`, `get_review`, and `get_annotation` to MCP-compatible coding agents. The current contract intentionally keeps the MCP layer read-only; automatic agent-inbox delivery is the next integration step.
