# Automa: conservative synthetic click helper for SPA cards

`fireClick(el)` dispatches `pointerdown`/`pointerup`/`mousedown`/`mouseup`/`click` MouseEvents (bubbles + cancelable + view), each wrapped in its own try/catch, then falls back to `el.click()` in try/catch. Fire-and-forget: the helper returns immediately; a separate bounded poll waits for the async lazy-panel load (see `mem:browser-automation/automa/lazy-panel-wait-stale-read-guard`).

Why conservative: SPA card clicks trigger lazy content swaps and intermediate event handlers may be missing; the helper must never throw or block the iteration.