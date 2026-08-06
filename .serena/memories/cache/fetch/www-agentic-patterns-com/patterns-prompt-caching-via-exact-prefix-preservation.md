tool: fetch raw
url: https://www.agentic-patterns.com/patterns/prompt-caching-via-exact-prefix-preservation
date: 2026-08-06
source: fetch

Content type text/html; charset=utf-8 cannot be simplified to markdown, but here is the raw content:
Contents of https://www.agentic-patterns.com/patterns/prompt-caching-via-exact-prefix-preservation:
<!DOCTYPE html><html lang="en"> <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="canonical" href="https://agentic-patterns.com/patterns/prompt-caching-via-exact-prefix-preservation/"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><!-- Primary Meta Tags --><title>Prompt Caching via Exact Prefix Preservation - Pattern</title><meta name="title" content="Prompt Caching via Exact Prefix Preservation - Pattern"><meta name="description" content="Reference entry for Prompt Caching via Exact Prefix Preservation."><!-- Open Graph / Facebook --><meta property="og:type" content="article"><meta property="og:url" content="https://agentic-patterns.com/patterns/prompt-caching-via-exact-prefix-preservation/"><meta property="og:title" content="Prompt Caching via Exact Prefix Preservation - Pattern"><meta property="og:description" content="Reference entry for Prompt Caching via Exact Prefix Preservation."><meta property="og:image" content="https://agentic-patterns.com/og-image.svg"><!-- Twitter --><meta property="twitter:card" content="summary_large_image"><meta property="twitter:url" content="https://agentic-patterns.com/patterns/prompt-caching-via-exact-prefix-preservation/"><meta property="twitter:title" content="Prompt Caching via Exact Prefix Preservation - Pattern"><meta property="twitter:description" content="Reference entry for Prompt Caching via Exact Prefix Preservation."><meta property="twitter:image" content="https://agentic-patterns.com/og-image.svg"><!-- Theme Color --><meta name="theme-color" content="#c24331" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#ec745f" media="(prefers-color-scheme: dark)"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap"><!-- Theme Initialization --><script>
  (function() {
    try {
      const stored = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const theme = stored || (prefersDark ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', theme);
    } catch {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
  })();
</script><link rel="stylesheet" href="/_astro/BaseLayout.psfFluJ8.css">
<link rel="stylesheet" href="/_astro/_slug_@_@astro.B4PwnAvd.css">
<style>.pattern-card[data-astro-cid-oyphue5v]{position:relative;overflow:hidden;border-radius:var(--radius-lg);background:#fffaf2b8;border:1px solid rgba(182,164,143,.5);box-shadow:var(--shadow-sm);backdrop-filter:blur(12px)}.pattern-card[data-astro-cid-oyphue5v]:before{content:"";position:absolute;inset:0 auto auto 0;width:100%;height:4px;background:linear-gradient(90deg,var(--category-color),transparent 78%)}.pattern-card[data-astro-cid-oyphue5v]:hover{transform:translateY(-2px);border-color:var(--category-color);box-shadow:var(--shadow-md)}.pattern-card-link[data-astro-cid-oyphue5v]{display:block;padding:1.35rem;min-height:100%}.pattern-card-topline[data-astro-cid-oyphue5v]{display:flex;align-items:center;justify-content:space-between;gap:var(--spacing-sm);margin-bottom:var(--spacing-md)}.pattern-card-category[data-astro-cid-oyphue5v],.pattern-card-status[data-astro-cid-oyphue5v]{font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.pattern-card-category[data-astro-cid-oyphue5v]{color:var(--category-color)}.pattern-card-status[data-astro-cid-oyphue5v]{color:var(--status-color);text-align:right}.pattern-card-title[data-astro-cid-oyphue5v]{font-size:clamp(1.2rem,2vw,1.45rem);line-height:1.1}.pattern-card-summary[data-astro-cid-oyphue5v]{margin:var(--spacing-md) 0 var(--spacing-lg);color:var(--color-text-muted);font-size:.94rem;line-height:1.65;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}.pattern-card-footer[data-astro-cid-oyphue5v]{display:flex;align-items:center;justify-content:space-between;gap:var(--spacing-md);margin-top:auto}.pattern-card-readmore[data-astro-cid-oyphue5v]{color:var(--color-text);font-weight:600}.pattern-card-tags[data-astro-cid-oyphue5v]{display:flex;gap:var(--spacing-xs);flex-wrap:wrap;justify-content:flex-end}.pattern-card-tag[data-astro-cid-oyphue5v]{padding:.18rem .5rem;border-radius:999px;background:#325d9614;color:var(--color-text-muted);font-size:.74rem}:root[data-theme=dark] .pattern-card[data-astro-cid-oyphue5v]{background:#241d18f0;border-color:#685445eb}:root[data-theme=dark] .pattern-card-summary[data-astro-cid-oyphue5v],:root[data-theme=dark] .pattern-card-tag[data-astro-cid-oyphue5v]{color:#d4c9bb}:root[data-theme=dark] .pattern-card-tag[data-astro-cid-oyphue5v]{background:#77a0d729}@media(prefers-color-scheme:dark){:root:not([data-theme]) .pattern-card[data-astro-cid-oyphue5v]{background:#241d18f0;border-color:#685445eb}:root:not([data-theme]) .pattern-card-summary[data-astro-cid-oyphue5v],:root:not([data-theme]) .pattern-card-tag[data-astro-cid-oyphue5v]{color:#d4c9bb}:root:not([data-theme]) .pattern-card-tag[data-astro-cid-oyphue5v]{background:#77a0d729}}@media(max-width:640px){.pattern-card-footer[data-astro-cid-oyphue5v],.pattern-card-topline[data-astro-cid-oyphue5v]{flex-direction:column;align-items:flex-start}.pattern-card-tags[data-astro-cid-oyphue5v]{justify-content:flex-start}}
</style>
<link rel="stylesheet" href="/_astro/NewsletterCTA.nA16pq9O.css"></head> <body> <!-- Skip Navigation for Keyboard Users --> <a href="#main-content" class="skip-link">Skip to main content</a> <header class="header" data-astro-cid-3ef6ksr2> <div class="header-container" data-astro-cid-3ef6ksr2> <a href="/" class="logo" data-astro-cid-3ef6ksr2> <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" data-astro-cid-3ef6ksr2> <rect width="32" height="32" rx="6" fill="currentColor" data-astro-cid-3ef6ksr2></rect> <path d="M10 16L14 12L18 16L22 12" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-astro-cid-3ef6ksr2></path> <path d="M10 22L14 18L18 22L22 18" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-astro-cid-3ef6ksr2></path> </svg> <span data-astro-cid-3ef6ksr2>Agentic Patterns</span> </a> <nav class="nav" aria-label="Main navigation" data-astro-cid-3ef6ksr2> <ul class="nav-list" data-astro-cid-3ef6ksr2> <li class="nav-item" data-astro-cid-3ef6ksr2> <a href="/" class="nav-link" data-astro-cid-3ef6ksr2> Home </a> </li><li class="nav-item" data-astro-cid-3ef6ksr2> <a href="/patterns" class="nav-link" data-astro-cid-3ef6ksr2> Patterns </a> </li><li class="nav-item" data-astro-cid-3ef6ksr2> <a href="/graph" class="nav-link" data-astro-cid-3ef6ksr2> Graph </a> </li><li class="nav-item" data-astro-cid-3ef6ksr2> <a href="/guides" class="nav-link" data-astro-cid-3ef6ksr2> Guides </a> </li> </ul> </nav> <div class="header-actions" data-astro-cid-3ef6ksr2> <a class="repo-link" href="https://github.com/nibzard/awesome-agentic-patterns" target="_blank" rel="noreferrer" aria-label="Open GitHub repository" data-astro-cid-3ef6ksr2> <svg width="18" height="18" viewBox="0 0 64 64" fill="currentColor" aria-hidden="true" data-astro-cid-3ef6ksr2><path d="M32.029,8.345c-13.27,0 -24.029,10.759 -24.029,24.033c0,10.617 6.885,19.624 16.435,22.803c1.202,0.22 1.64,-0.522 1.64,-1.16c0,-0.569 -0.02,-2.081 -0.032,-4.086c-6.685,1.452 -8.095,-3.222 -8.095,-3.222c-1.093,-2.775 -2.669,-3.514 -2.669,-3.514c-2.182,-1.492 0.165,-1.462 0.165,-1.462c2.412,0.171 3.681,2.477 3.681,2.477c2.144,3.672 5.625,2.611 6.994,1.997c0.219,-1.553 0.838,-2.612 1.526,-3.213c-5.336,-0.606 -10.947,-2.669 -10.947,-11.877c0,-2.623 0.937,-4.769 2.474,-6.449c-0.247,-0.608 -1.072,-3.051 0.235,-6.36c0,0 2.018,-0.646 6.609,2.464c1.917,-0.533 3.973,-0.8 6.016,-0.809c2.041,0.009 4.097,0.276 6.017,0.809c4.588,-3.11 6.602,-2.464 6.602,-2.464c1.311,3.309 0.486,5.752 0.239,6.36c1.54,1.68 2.471,3.826 2.471,6.449c0,9.232 -5.62,11.263 -10.974,11.858c0.864,0.742 1.632,2.208 1.632,4.451c0,3.212 -0.029,5.804 -0.029,6.591c0,0.644 0.432,1.392 1.652,1.157c9.542,-3.185 16.421,-12.186 16.421,-22.8c0,-13.274 -10.76,-24.033 -24.034,-24.033" data-astro-cid-3ef6ksr2></path></svg> <span class="repo-link-count" aria-label="4.8K GitHub stars" data-astro-cid-3ef6ksr2> 4.8K </span> </a> <button id="search-toggle" class="search-toggle" aria-label="Search" data-astro-cid-3ef6ksr2> <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" data-astro-cid-3ef6ksr2> <path d="M9 17A8 8 0 1 0 9 1A8 8 0 0 0 9 17Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-astro-cid-3ef6ksr2></path> <path d="M19 19L13.5 13.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-astro-cid-3ef6ksr2></path> </svg> <span data-astro-cid-3ef6ksr2>Search</span> </button> <button id="theme-toggle" class="theme-toggle" aria-label="Toggle theme" type="button" data-astro-cid-x3pjskd3> <svg class="sun-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" data-astro-cid-x3pjskd3> <circle cx="10" cy="10" r="4" stroke="currentColor" stroke-width="2" data-astro-cid-x3pjskd3></circle> <path d="M10 2V4M10 16V18M18 10H16M4 10H2M15.66 15.66L14.24 14.24M5.76 5.76L4.34 4.34M15.66 4.34L14.24 5.76M5.76 14.24L4.34 15.66" stroke="currentColor" stroke-width="2" stroke-linecap="round" data-astro-cid-x3pjskd3></path> </svg> <svg class="moon-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" data-astro-cid-x3pjskd3> <path d="M17.293 13.293A8 8 0 1 1 6.707 2.707a8.001 8.001 0 0 0 10.586 10.586Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-astro-cid-x3pjskd3></path> </svg> </button>  <script type="module">const l=document.getElementById("theme-toggle"),t=document.querySelector(".sun-icon"),o=document.querySelector(".moon-icon");function n(){if(typeof localStorage<"u"){const e=localStorage.getItem("theme");if(e)return e}return window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}function c(e){typeof localStorage<"u"&&localStorage.setItem("theme",e),document.documentElement.setAttribute("data-theme",e),s(e)}function s(e){e==="dark"?(t?.style.setProperty("display","block"),o?.style.setProperty("display","none")):(t?.style.setProperty("display","none"),o?.style.setProperty("display","block"))}c(n());l?.addEventListener("click",()=>{const r=(document.documentElement.getAttribute("data-theme")||n())==="dark"?"light":"dark";c(r)});</script> </div> <!-- Mobile Menu Toggle --> <button id="mobile-menu-toggle" class="mobile-menu-toggle" aria-label="Open navigation menu" aria-expanded="false" aria-controls="mobile-menu" data-astro-cid-3ef6ksr2> <span class="hamburger" data-astro-cid-3ef6ksr2> <span class="hamburger-line" data-astro-cid-3ef6ksr2></span> <span class="hamburger-line" data-astro-cid-3ef6ksr2></span> <span class="hamburger-line" data-astro-cid-3ef6ksr2></span> </span> </button> <!-- Search Modal --> <div id="search-modal" class="search-modal" hidden inert aria-hidden="true" role="dialog" aria-modal="true" aria-label="Search patterns" data-astro-cid-3ef6ksr2> <div class="search-backdrop" data-astro-cid-3ef6ksr2></div> <div class="search-container" data-astro-cid-3ef6ksr2> <button type="button" class="search-close" aria-label="Close search" data-astro-cid-3ef6ksr2> <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" data-astro-cid-3ef6ksr2> <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" data-astro-cid-3ef6ksr2></path> </svg> </button> <div class="search-input-wrapper" data-astro-cid-3ef6ksr2> <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="search-icon" data-astro-cid-3ef6ksr2> <path d="M9 17A8 8 0 1 0 9 1A8 8 0 0 0 9 17Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-astro-cid-3ef6ksr2></path> <path d="M19 19L13.5 13.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-astro-cid-3ef6ksr2></path> </svg> <input id="search-input" type="text" placeholder="Search patterns..." autocomplete="off" aria-label="Search patterns" aria-describedby="search-instructions" role="searchbox" aria-autocomplete="list" data-astro-cid-3ef6ksr2> <kbd id="search-shortcut" data-astro-cid-3ef6ksr2>⌘K</kbd> </div> <div id="search-results" class="search-results" role="region" aria-live="polite" aria-atomic="true" data-astro-cid-3ef6ksr2></div> <div class="search-footer" id="search-instructions" data-astro-cid-3ef6ksr2> <span data-astro-cid-3ef6ksr2>Use <kbd data-astro-cid-3ef6ksr2>↑</kbd> <kbd data-astro-cid-3ef6ksr2>↓</kbd> to navigate</span> <span data-astro-cid-3ef6ksr2><kbd data-astro-cid-3ef6ksr2>↵</kbd> to select</span> <span data-astro-cid-3ef6ksr2><kbd data-astro-cid-3ef6ksr2>esc</kbd> to close</span> </div> </div> </div> <script type="module" src="/_astro/Header.astro_astro_type_script_index_0_lang.B9QDizEs.js"></script> </div> <!-- Mobile Menu --> <div id="mobile-menu" class="mobile-menu" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-label="Navigation menu" data-astro-cid-3ef6ksr2> <div class="mobile-menu-backdrop" data-astro-cid-3ef6ksr2></div> <div class="mobile-menu-container" data-astro-cid-3ef6ksr2> <nav class="mobile-menu-nav" aria-label="Mobile navigation" data-astro-cid-3ef6ksr2> <ul class="mobile-menu-list" data-astro-cid-3ef6ksr2> <li data-astro-cid-3ef6ksr2> <a href="/" class="mobile-menu-link" data-astro-cid-3ef6ksr2> Home </a> </li><li data-astro-cid-3ef6ksr2> <a href="/patterns" class="mobile-menu-link" data-astro-cid-3ef6ksr2> Patterns </a> </li><li data-astro-cid-3ef6ksr2> <a href="/graph" class="mobile-menu-link" data-astro-cid-3ef6ksr2> Graph </a> </li><li data-astro-cid-3ef6ksr2> <a href="/guides" class="mobile-menu-link" data-astro-cid-3ef6ksr2> Guides </a> </li> </ul> </nav> <div class="mobile-menu-footer" data-astro-cid-3ef6ksr2> <a class="repo-link repo-link--mobile" href="https://github.com/nibzard/awesome-agentic-patterns" target="_blank" rel="noreferrer" aria-label="Open GitHub repository" data-astro-cid-3ef6ksr2> <svg width="18" height="18" viewBox="0 0 64 64" fill="currentColor" aria-hidden="true" data-astro-cid-3ef6ksr2><path d="M32.029,8.345c-13.27,0 -24.029,10.759 -24.029,24.033c0,10.617 6.885,19.624 16.435,22.803c1.202,0.22 1.64,-0.522 1.64,-1.16c0,-0.569 -0.02,-2.081 -0.032,-4.086c-6.685,1.452 -8.095,-3.222 -8.095,-3.222c-1.093,-2.775 -2.669,-3.514 -2.669,-3.514c-2.182,-1.492 0.165,-1.462 0.165,-1.462c2.412,0.171 3.681,2.477 3.681,2.477c2.144,3.672 5.625,2.611 6.994,1.997c0.219,-1.553 0.838,-2.612 1.526,-3.213c-5.336,-0.606 -10.947,-2.669 -10.947,-11.877c0,-2.623 0.937,-4.769 2.474,-6.449c-0.247,-0.608 -1.072,-3.051 0.235,-6.36c0,0 2.018,-0.646 6.609,2.464c1.917,-0.533 3.973,-0.8 6.016,-0.809c2.041,0.009 4.097,0.276 6.017,0.809c4.588,-3.11 6.602,-2.464 6.602,-2.464c1.311,3.309 0.486,5.752 0.239,6.36c1.54,1.68 2.471,3.826 2.471,6.449c0,9.232 -5.62,11.263 -10.974,11.858c0.864,0.742 1.632,2.208 1.632,4.451c0,3.212 -0.029,5.804 -0.029,6.591c0,0.644 0.432,1.392 1.652,1.157c9.542,-3.185 16.421,-12.186 16.421,-22.8c0,-13.274 -10.76,-24.033 -24.034,-24.033" data-astro-cid-3ef6ksr2></path></svg> <span class="repo-link-count" aria-label="4.8K GitHub stars" data-astro-cid-3ef6ksr2> 4.8K </span> <span aria-hidden="true" data-astro-cid-3ef6ksr2>↗</span> </a> </div> </div> </div> </header> <main id="main-content" tabindex="-1">  <div class="pattern-page" data-astro-cid-pjne7374> <section class="pattern-hero" data-astro-cid-pjne7374> <div class="pattern-hero-main" data-astro-cid-pjne7374> <div class="pattern-meta" data-astro-cid-pjne7374> <span class="section-label" data-astro-cid-pjne7374>Pattern Reference</span> <span class="pattern-pill pattern-pill--category" data-astro-cid-pjne7374>Context &amp; Memory</span> <span class="pattern-pill pattern-pill--status" data-astro-cid-pjne7374>emerging</span>   </div> <h1 data-astro-cid-pjne7374>Prompt Caching via Exact Prefix Preservation</h1>  <div class="pattern-authors" data-astro-cid-pjne7374> <span class="pattern-authors-label" data-astro-cid-pjne7374>By</span> <span class="author" data-astro-cid-pjne7374>Nikola Balic (@nibzard)</span> </div> <div class="pattern-actions" data-astro-cid-3u5a4cme> <button class="action-button" data-copy="markdown" data-content="# Prompt Caching via Exact Prefix Preservation

**Status:** emerging
**Category:** Context &#38; Memory
**Authors:** Nikola Balic (@nibzard)
**Tags:** prompt-caching, exact-prefix, performance, stateless, zero-data-retention, message-ordering, optimization
**Source:** https://openai.com/index/unrolling-the-codex-agent-loop/


## Problem

Long-running agent conversations with many tool calls can suffer from **quadratic performance degradation**:

- **Growing JSON payloads**: Each iteration sends the entire conversation history to the API
- **Expensive re-computation**: Without caching, the model re-processes the same static content repeatedly
- **ZDR constraints**: Zero Data Retention (ZDR) policies prevent server-side state, ruling out `previous_response_id` optimization
- **Configuration changes**: Mid-conversation changes (sandbox, tools, working directory) can break cache efficiency

As conversations grow, inference costs and latency increase quadratically without proper caching strategies.

## Solution

Maintain prompt cache efficiency through **exact prefix preservation** - always append new messages rather than modifying existing ones, and carefully order messages to maximize cache hits.

**Core insight**: Prompt caches only work on **exact prefix matches**. If the first N tokens of a request match a previous request, the cached computation can be reused.

**Mechanism**: Caching operates at the token level, not message level. The cache checks token-by-token for prefix matches, independent of message boundaries.

**Message ordering strategy:**

1. **Static content first** (beginning of prompt - cached across all requests):
   - System message (if server-controlled)
   - Tool definitions (must be in consistent order)
   - Developer instructions
   - User/project instructions

2. **Variable content last** (end of prompt - changes per request):
   - User message
   - Assistant messages
   - Tool call results (appended iteratively)

**Configuration change via insertion:**

When configuration changes mid-conversation, **insert a new message** rather than modifying an existing one:

```
[Static prefix...]
<sandbox_config_v1>     // Original config message
[Conversation...]

<sandbox changed>
<sandbox_config_v2>     // NEW message inserted
[Conversation continues...]
```

This preserves the exact prefix of all previous messages, maintaining cache hits.

**What breaks cache hits:**

- Changing the list of available tools (position-sensitive)
- Reordering messages
- Modifying existing message content
- Changing the model (affects server-side system message)

**Provider variations:**

- **OpenAI**: Automatic caching on exact prefix matches
- **Anthropic**: Explicit cache-control headers, TTL-based invalidation (up to 5 minutes), 90% discount on cached tokens

**Stateless design for ZDR:**

Avoid `previous_response_id` to support Zero Data Retention. Instead, rely on prompt caching for linear performance:

```
Without previous_response_id:
- Quadratic network traffic (send full JSON each time)
- Linear sampling cost (due to prompt caching)

With previous_response_id:
- Linear network traffic
- But violates ZDR (server must store conversation state)
```

## Example

```mermaid
graph TD
    subgraph &#34;Request 1&#34;
        A1[System message]
        A2[Tools]
        A3[Instructions]
        A4[User message]
    end

    subgraph &#34;Request 2 - Cache Hit!&#34;
        B1[System message]
        B2[Tools]
        B3[Instructions]
        B4[User message]
        B5[Assistant response]
        B6[Tool result]
    end

    subgraph &#34;Request 3 - Cache Hit!&#34;
        C1[System message]
        C2[Tools]
        C3[Instructions]
        C4[User message]
        C5[Assistant response]
        C6[Tool result 1]
        C7[Tool result 2]
    end

    style A1 fill:#90EE90
    style A2 fill:#90EE90
    style A3 fill:#90EE90
    style B1 fill:#90EE90
    style B2 fill:#90EE90
    style B3 fill:#90EE90
    style C1 fill:#90EE90
    style C2 fill:#90EE90
    style C3 fill:#90EE90

    style A4 fill:#FFB6C1
    style B4 fill:#FFB6C1
    style B5 fill:#FFB6C1
    style B6 fill:#FFB6C1
    style C4 fill:#FFB6C1
    style C5 fill:#FFB6C1
    style C6 fill:#FFB6C1
    style C7 fill:#FFB6C1
```

**Green = Cached** (exact prefix match) | **Pink = Recomputed** (new tokens)

## How to use it

**Prompt construction checklist:**

1. **Order messages by stability**: Static → Variable
2. **Never modify existing messages**: Always append new ones
3. **Keep tool order consistent**: Enumerate tools in deterministic order
4. **Insert, don't update**: For config changes, add new messages

**Handling configuration changes:**

| Change Type | What NOT to do | What TO do |
|-------------|----------------|------------|
| Sandbox/approval mode | Modify permission message | Insert new `role=developer` message |
| Working directory | Modify environment message | Insert new `role=user` message |
| Tool list | Change mid-conversation | Avoid if possible; breaks cache |

**MCP server considerations:**

MCP servers can emit `notifications/tools/list_changed` to indicate tool list changes. **Avoid honoring this mid-conversation** as it breaks cache hits. Instead:
- Delay tool refresh until conversation boundary
- Or accept the cache miss as necessary trade-off

**Implementation sketch:**

```typescript
function buildPrompt(state: ConversationState): Prompt {
  const items: PromptItem[] = [];

  // Static prefix (cached)
  items.push({ role: 'system', content: state.systemMessage });
  items.push({ type: 'tools', tools: state.tools });  // Consistent order!
  items.push({ role: 'developer', content: state.instructions });

  // Variable content (appended)
  items.push(...state.history);

  return { items };
}

function handleConfigChange(
  state: ConversationState,
  newConfig: SandboxConfig
): ConversationState {
  // DON'T: Modify existing permission message
  // DO: Insert new message
  return {
    ...state,
    history: [
      ...state.history,
      {
        role: 'developer',
        content: formatSandboxConfig(newConfig),
      },
    ],
  };
}
```

## Trade-offs

**Pros:**

- **Linear sampling cost**: Prompt caching makes repeated inference linear rather than quadratic
- **ZDR-compatible**: Stateless design supports Zero Data Retention policies
- **No server state**: Avoids `previous_response_id` complexity
- **Simple conceptual model**: Exact prefix matching is easy to reason about
- **Production-validated savings**: 43% cost reduction demonstrated at scale (HyperAgent, 9.4B tokens/month)

**Cons:**

- **Quadratic network traffic**: JSON payload size still grows quadratically (only sampling is cached)
- **Cache fragility**: Mid-conversation changes (tools, model) break prefix matching
- **Disciplined ordering required**: All static content must come before variable content
- **Tool enumeration complexity**: Must maintain consistent tool ordering
- **MCP server limitations**: Dynamic tool changes can cause cache misses

## References

* [Unrolling the Codex agent loop | OpenAI Blog](https://openai.com/index/unrolling-the-codex-agent-loop/)
* [Prompt Caching Documentation | OpenAI](https://platform.openai.com/docs/guides/prompt-caching)
* [Context Caching | Anthropic](https://docs.anthropic.com/en/docs/build-with-claude/context-caching)
* [Codex CLI | GitHub](https://github.com/openai/codex)
* Related: [Context Window Auto-Compaction](/patterns/context-window-auto-compaction)
" aria-label="Copy as Markdown" data-astro-cid-3u5a4cme> <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-astro-cid-3u5a4cme> <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" data-astro-cid-3u5a4cme></path> <polyline points="14 2 14 8 20 8" data-astro-cid-3u5a4cme></polyline> <line x1="16" y1="13" x2="8" y2="13" data-astro-cid-3u5a4cme></line> <line x1="16" y1="17" x2="8" y2="17" data-astro-cid-3u5a4cme></line> <polyline points="10 9 9 9 8 9" data-astro-cid-3u5a4cme></polyline> </svg>
Copy as Markdown
</button> <button class="action-button" data-copy="json" data-content="{
  &#34;id&#34;: &#34;prompt-caching-via-exact-prefix-preservation&#34;,
  &#34;slug&#34;: &#34;prompt-caching-via-exact-prefix-preservation&#34;,
  &#34;title&#34;: &#34;Prompt Caching via Exact Prefix Preservation&#34;,
  &#34;status&#34;: &#34;emerging&#34;,
  &#34;authors&#34;: [
    &#34;Nikola Balic (@nibzard)&#34;
  ],
  &#34;based_on&#34;: [
    &#34;Michael Bolin (OpenAI Codex)&#34;
  ],
  &#34;category&#34;: &#34;Context &#38; Memory&#34;,
  &#34;source&#34;: &#34;https://openai.com/index/unrolling-the-codex-agent-loop/&#34;,
  &#34;tags&#34;: [
    &#34;prompt-caching&#34;,
    &#34;exact-prefix&#34;,
    &#34;performance&#34;,
    &#34;stateless&#34;,
    &#34;zero-data-retention&#34;,
    &#34;message-ordering&#34;,
    &#34;optimization&#34;
  ],
  &#34;body&#34;: &#34;\n## Problem\n\nLong-running agent conversations with many tool calls can suffer from **quadratic performance degradation**:\n\n- **Growing JSON payloads**: Each iteration sends the entire conversation history to the API\n- **Expensive re-computation**: Without caching, the model re-processes the same static content repeatedly\n- **ZDR constraints**: Zero Data Retention (ZDR) policies prevent server-side state, ruling out `previous_response_id` optimization\n- **Configuration changes**: Mid-conversation changes (sandbox, tools, working directory) can break cache efficiency\n\nAs conversations grow, inference costs and latency increase quadratically without proper caching strategies.\n\n## Solution\n\nMaintain prompt cache efficiency through **exact prefix preservation** - always append new messages rather than modifying existing ones, and carefully order messages to maximize cache hits.\n\n**Core insight**: Prompt caches only work on **exact prefix matches**. If the first N tokens of a request match a previous request, the cached computation can be reused.\n\n**Mechanism**: Caching operates at the token level, not message level. The cache checks token-by-token for prefix matches, independent of message boundaries.\n\n**Message ordering strategy:**\n\n1. **Static content first** (beginning of prompt - cached across all requests):\n   - System message (if server-controlled)\n   - Tool definitions (must be in consistent order)\n   - Developer instructions\n   - User/project instructions\n\n2. **Variable content last** (end of prompt - changes per request):\n   - User message\n   - Assistant messages\n   - Tool call results (appended iteratively)\n\n**Configuration change via insertion:**\n\nWhen configuration changes mid-conversation, **insert a new message** rather than modifying an existing one:\n\n```\n[Static prefix...]\n<sandbox_config_v1>     // Original config message\n[Conversation...]\n\n<sandbox changed>\n<sandbox_config_v2>     // NEW message inserted\n[Conversation continues...]\n```\n\nThis preserves the exact prefix of all previous messages, maintaining cache hits.\n\n**What breaks cache hits:**\n\n- Changing the list of available tools (position-sensitive)\n- Reordering messages\n- Modifying existing message content\n- Changing the model (affects server-side system message)\n\n**Provider variations:**\n\n- **OpenAI**: Automatic caching on exact prefix matches\n- **Anthropic**: Explicit cache-control headers, TTL-based invalidation (up to 5 minutes), 90% discount on cached tokens\n\n**Stateless design for ZDR:**\n\nAvoid `previous_response_id` to support Zero Data Retention. Instead, rely on prompt caching for linear performance:\n\n```\nWithout previous_response_id:\n- Quadratic network traffic (send full JSON each time)\n- Linear sampling cost (due to prompt caching)\n\nWith previous_response_id:\n- Linear network traffic\n- But violates ZDR (server must store conversation state)\n```\n\n## Example\n\n```mermaid\ngraph TD\n    subgraph \&#34;Request 1\&#34;\n        A1[System message]\n        A2[Tools]\n        A3[Instructions]\n        A4[User message]\n    end\n\n    subgraph \&#34;Request 2 - Cache Hit!\&#34;\n        B1[System message]\n        B2[Tools]\n        B3[Instructions]\n        B4[User message]\n        B5[Assistant response]\n        B6[Tool result]\n    end\n\n    subgraph \&#34;Request 3 - Cache Hit!\&#34;\n        C1[System message]\n        C2[Tools]\n        C3[Instructions]\n        C4[User message]\n        C5[Assistant response]\n        C6[Tool result 1]\n        C7[Tool result 2]\n    end\n\n    style A1 fill:#90EE90\n    style A2 fill:#90EE90\n    style A3 fill:#90EE90\n    style B1 fill:#90EE90\n    style B2 fill:#90EE90\n    style B3 fill:#90EE90\n    style C1 fill:#90EE90\n    style C2 fill:#90EE90\n    style C3 fill:#90EE90\n\n    style A4 fill:#FFB6C1\n    style B4 fill:#FFB6C1\n    style B5 fill:#FFB6C1\n    style B6 fill:#FFB6C1\n    style C4 fill:#FFB6C1\n    style C5 fill:#FFB6C1\n    style C6 fill:#FFB6C1\n    style C7 fill:#FFB6C1\n```\n\n**Green = Cached** (exact prefix match) | **Pink = Recomputed** (new tokens)\n\n## How to use it\n\n**Prompt construction checklist:**\n\n1. **Order messages by stability**: Static → Variable\n2. **Never modify existing messages**: Always append new ones\n3. **Keep tool order consistent**: Enumerate tools in deterministic order\n4. **Insert, don't update**: For config changes, add new messages\n\n**Handling configuration changes:**\n\n| Change Type | What NOT to do | What TO do |\n|-------------|----------------|------------|\n| Sandbox/approval mode | Modify permission message | Insert new `role=developer` message |\n| Working directory | Modify environment message | Insert new `role=user` message |\n| Tool list | Change mid-conversation | Avoid if possible; breaks cache |\n\n**MCP server considerations:**\n\nMCP servers can emit `notifications/tools/list_changed` to indicate tool list changes. **Avoid honoring this mid-conversation** as it breaks cache hits. Instead:\n- Delay tool refresh until conversation boundary\n- Or accept the cache miss as necessary trade-off\n\n**Implementation sketch:**\n\n```typescript\nfunction buildPrompt(state: ConversationState): Prompt {\n  const items: PromptItem[] = [];\n\n  // Static prefix (cached)\n  items.push({ role: 'system', content: state.systemMessage });\n  items.push({ type: 'tools', tools: state.tools });  // Consistent order!\n  items.push({ role: 'developer', content: state.instructions });\n\n  // Variable content (appended)\n  items.push(...state.history);\n\n  return { items };\n}\n\nfunction handleConfigChange(\n  state: ConversationState,\n  newConfig: SandboxConfig\n): ConversationState {\n  // DON'T: Modify existing permission message\n  // DO: Insert new message\n  return {\n    ...state,\n    history: [\n      ...state.history,\n      {\n        role: 'developer',\n        content: formatSandboxConfig(newConfig),\n      },\n    ],\n  };\n}\n```\n\n## Trade-offs\n\n**Pros:**\n\n- **Linear sampling cost**: Prompt caching makes repeated inference linear rather than quadratic\n- **ZDR-compatible**: Stateless design supports Zero Data Retention policies\n- **No server state**: Avoids `previous_response_id` complexity\n- **Simple conceptual model**: Exact prefix matching is easy to reason about\n- **Production-validated savings**: 43% cost reduction demonstrated at scale (HyperAgent, 9.4B tokens/month)\n\n**Cons:**\n\n- **Quadratic network traffic**: JSON payload size still grows quadratically (only sampling is cached)\n- **Cache fragility**: Mid-conversation changes (tools, model) break prefix matching\n- **Disciplined ordering required**: All static content must come before variable content\n- **Tool enumeration complexity**: Must maintain consistent tool ordering\n- **MCP server limitations**: Dynamic tool changes can cause cache misses\n\n## References\n\n* [Unrolling the Codex agent loop | OpenAI Blog](https://openai.com/index/unrolling-the-codex-agent-loop/)\n* [Prompt Caching Documentation | OpenAI](https://platform.openai.com/docs/guides/prompt-caching)\n* [Context Caching | Anthropic](https://docs.anthropic.com/en/docs/build-with-claude/context-caching)\n* [Codex CLI | GitHub](https://github.com/openai/codex)\n* Related: [Context Window Auto-Compaction](/patterns/context-window-auto-compaction)\n&#34;
}" aria-label="Copy as JSON" data-astro-cid-3u5a4cme> <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-astro-cid-3u5a4cme> <polyline points="16 18 22 12 16 6" data-astro-cid-3u5a4cme></polyline> <polyline points="8 6 2 12 8 18" data-astro-cid-3u5a4cme></polyline> </svg>
Copy as JSON
</button> <details class="pack-details" data-pack-action data-pattern-slug="prompt-caching-via-exact-prefix-preservation" data-pattern-title="Prompt Caching via Exact Prefix Preservation" data-astro-cid-3u5a4cme> <summary class="action-button" aria-label="Add this pattern to a pack" data-astro-cid-3u5a4cme>Add to Pack</summary> <div class="pack-panel" data-astro-cid-3u5a4cme> <div class="pack-row" data-astro-cid-3u5a4cme> <label class="pack-label" for="pack-select-prompt-caching-via-exact-prefix-preservation" data-astro-cid-3u5a4cme>Choose pack</label> <select class="pack-select" id="pack-select-prompt-caching-via-exact-prefix-preservation" aria-label="Select a pack" data-astro-cid-3u5a4cme> <option value="" data-astro-cid-3u5a4cme>No packs yet</option> </select> <button class="pack-add" type="button" data-pack-add data-astro-cid-3u5a4cme>Add</button> </div> <div class="pack-divider" data-astro-cid-3u5a4cme>or</div> <div class="pack-row" data-astro-cid-3u5a4cme> <label class="pack-label" for="pack-new-prompt-caching-via-exact-prefix-preservation" data-astro-cid-3u5a4cme>New pack</label> <input class="pack-input" id="pack-new-prompt-caching-via-exact-prefix-preservation" type="text" placeholder="Name your pack" data-astro-cid-3u5a4cme> <button class="pack-create" type="button" data-pack-create data-astro-cid-3u5a4cme>Create</button> </div> <p class="pack-hint" data-astro-cid-3u5a4cme>Saved locally in this browser for now.</p> <span class="pack-feedback" aria-live="polite" data-astro-cid-3u5a4cme></span> </div> </details> <details class="citation-details" data-astro-cid-3u5a4cme> <summary class="action-button" aria-label="Cite this pattern" data-astro-cid-3u5a4cme>Cite This Pattern</summary> <div class="citation-panel" data-astro-cid-3u5a4cme> <div class="citation-row" data-astro-cid-3u5a4cme> <div class="citation-header" data-astro-cid-3u5a4cme> <span class="citation-label" data-astro-cid-3u5a4cme>APA</span> <button class="copy-button" data-copy-content="Nikola Balic (@nibzard) (2026). Prompt Caching via Exact Prefix Preservation. In *Awesome Agentic Patterns*. Retrieved July 23, 2026, from https://agentic-patterns.com/patterns/prompt-caching-via-exact-prefix-preservation" aria-label="Copy APA citation" type="button" data-astro-cid-74lkg7sv> <svg class="copy-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" data-astro-cid-74lkg7sv> <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.5" data-astro-cid-74lkg7sv></rect> <path d="M5 6H11M5 8H11M5 10H8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" data-astro-cid-74lkg7sv></path> </svg> <svg class="check-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" data-astro-cid-74lkg7sv> <path d="M13 5L5.5 12.5L2 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-astro-cid-74lkg7sv></path> </svg> </button>  <script type="module">document.querySelectorAll(".copy-button").forEach(e=>{e.addEventListener("click",async()=>{const t=e.getAttribute("data-copy-content");if(t)try{await navigator.clipboard.writeText(t),e.classList.add("copied"),setTimeout(()=>{e.classList.remove("copied")},2e3)}catch(c){console.error("Failed to copy:",c)}})});</script> </div> <pre class="citation-text" data-astro-cid-3u5a4cme>Nikola Balic (@nibzard) (2026). Prompt Caching via Exact Prefix Preservation. In *Awesome Agentic Patterns*. Retrieved July 23, 2026, from https://agentic-patterns.com/patterns/prompt-caching-via-exact-prefix-preservation</pre> </div> <div class="citation-row" data-astro-cid-3u5a4cme> <div class="citation-header" data-astro-cid-3u5a4cme> <span class="citation-label" data-astro-cid-3u5a4cme>BibTeX</span> <button class="copy-button" data-copy-content="@misc{agentic_patterns_prompt-caching-via-exact-prefix-preservation,
  title = {Prompt Caching via Exact Prefix Preservation},
  author = {Nikola Balic (@nibzard)},
  year = {2026},
  howpublished = {\url{https://agentic-patterns.com/patterns/prompt-caching-via-exact-prefix-preservation}},
  note = {Awesome Agentic Patterns}
}" aria-label="Copy BibTeX citation" type="button" data-astro-cid-74lkg7sv> <svg class="copy-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" data-astro-cid-74lkg7sv> <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.5" data-astro-cid-74lkg7sv></rect> <path d="M5 6H11M5 8H11M5 10H8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" data-astro-cid-74lkg7sv></path> </svg> <svg class="check-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" data-astro-cid-74lkg7sv> <path d="M13 5L5.5 12.5L2 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-astro-cid-74lkg7sv></path> </svg> </button>   </div> <pre class="citation-text citation-text--code" data-astro-cid-3u5a4cme>@misc{agentic_patterns_prompt-caching-via-exact-prefix-preservation,
  title = {Prompt Caching via Exact Prefix Preservation},
  author = {Nikola Balic (@nibzard)},
  year = {2026},
  howpublished = {\url{https://agentic-patterns.com/patterns/prompt-caching-via-exact-prefix-preservation}},
  note = {Awesome Agentic Patterns}
}</pre> </div> </div> </details> <span class="copy-feedback" aria-live="polite" data-astro-cid-3u5a4cme></span> </div> <script type="module">const m=document.querySelectorAll("[data-copy]"),u=document.querySelector(".copy-feedback"),o=document.querySelector("[data-pack-action]"),k="aap:user-packs";m.forEach(t=>{t.addEventListener("click",async()=>{const e=t.getAttribute("data-content"),a=t.getAttribute("data-copy");if(e)try{await navigator.clipboard.writeText(e),u.textContent=`Copied as ${a}!`,setTimeout(()=>{u.textContent=""},2e3)}catch{u.textContent="Failed to copy",setTimeout(()=>{u.textContent=""},2e3)}})});const l=()=>{try{const t=localStorage.getItem(k),e=t?JSON.parse(t):[];return Array.isArray(e)?e.map(a=>({...a,patterns:Array.isArray(a.patterns)?a.patterns:[]})):[]}catch{return[]}},f=t=>{try{localStorage.setItem(k,JSON.stringify(t))}catch{s("Unable to save packs in this browser.",!0)}},s=(t,e=!1)=>{if(!o)return;const a=o.querySelector(".pack-feedback");a&&(a.textContent=t,a.classList.toggle("pack-feedback--error",e),setTimeout(()=>{a.textContent="",a.classList.remove("pack-feedback--error")},2400))},p=(t,e,a)=>{if(t){if(t.innerHTML="",a.length===0){const r=document.createElement("option");r.value="",r.textContent="No packs yet",t.appendChild(r),t.disabled=!0,e&&(e.disabled=!0);return}t.disabled=!1,e&&(e.disabled=!1),a.forEach(r=>{const n=document.createElement("option");n.value=r.id,n.textContent=`${r.name} (${r.patterns.length})`,t.appendChild(n)})}},g=()=>`pack-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`,S=(t,e,a)=>{const r=t.find(n=>n.id===e);return r?r.patterns.includes(a)?{packs:t,status:"exists",pack:r}:(r.patterns.push(a),r.updatedAt=new Date().toISOString(),{packs:t,status:"added",pack:r}):{packs:t,status:"missing"}};if(o){const t=o.getAttribute("data-pattern-slug")||"",e=o.querySelector(".pack-select"),a=o.querySelector("[data-pack-add]"),r=o.querySelector("[data-pack-create]"),n=o.querySelector(".pack-input"),y=l();p(e,a,y),a?.addEventListener("click",()=>{const i=e?.value;if(!i){s("Create a pack first.",!0);return}const d=l(),c=S(d,i,t);if(c.status==="missing"){s("Pack not found.",!0);return}if(c.status==="exists"){s("Already in that pack.");return}f(c.packs),p(e,a,c.packs),s(`Added to ${c.pack.name}.`)}),r?.addEventListener("click",()=>{const i=n?.value.trim();if(!i){s("Add a pack name.",!0);return}const d=l(),c={id:g(),name:i,patterns:t?[t]:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};d.unshift(c),f(d),p(e,a,d),e&&(e.value=c.id),n&&(n.value=""),s(`Created "${i}".`)})}</script> </div> <aside class="pattern-summary-panel surface-panel" data-astro-cid-pjne7374> <p class="pattern-kicker" data-astro-cid-pjne7374>At a glance</p> <div class="pattern-fact-grid" data-astro-cid-pjne7374> <div class="pattern-fact" data-astro-cid-pjne7374> <span class="pattern-fact-label" data-astro-cid-pjne7374>Category</span> <span class="pattern-fact-value" data-astro-cid-pjne7374>Context &amp; Memory</span> </div><div class="pattern-fact" data-astro-cid-pjne7374> <span class="pattern-fact-label" data-astro-cid-pjne7374>Status</span> <span class="pattern-fact-value" data-astro-cid-pjne7374>emerging</span> </div> </div> <div class="pattern-tag-cluster" data-astro-cid-pjne7374> <p class="pattern-kicker" data-astro-cid-pjne7374>Tags</p> <div class="pattern-tags" data-astro-cid-pjne7374> <span class="tag" data-astro-cid-pjne7374>prompt-caching</span><span class="tag" data-astro-cid-pjne7374>exact-prefix</span><span class="tag" data-astro-cid-pjne7374>performance</span><span class="tag" data-astro-cid-pjne7374>stateless</span><span class="tag" data-astro-cid-pjne7374>zero-data-retention</span><span class="tag" data-astro-cid-pjne7374>message-ordering</span><span class="tag" data-astro-cid-pjne7374>optimization</span> </div> </div> </aside> </section> <section class="pattern-body-layout" data-astro-cid-pjne7374> <aside class="pattern-rail" data-astro-cid-pjne7374> <div class="pattern-nav surface-panel" data-astro-cid-pjne7374> <p class="pattern-kicker" data-astro-cid-pjne7374>On this page</p> <nav aria-label="Pattern sections" data-astro-cid-pjne7374> <a href="#problem" class="pattern-nav-link" data-astro-cid-pjne7374> <span class="pattern-nav-number" data-astro-cid-pjne7374>01</span> <span data-astro-cid-pjne7374>Problem</span> </a><a href="#solution" class="pattern-nav-link" data-astro-cid-pjne7374> <span class="pattern-nav-number" data-astro-cid-pjne7374>02</span> <span data-astro-cid-pjne7374>Solution</span> </a><a href="#how-to-use-it" class="pattern-nav-link" data-astro-cid-pjne7374> <span class="pattern-nav-number" data-astro-cid-pjne7374>03</span> <span data-astro-cid-pjne7374>How to use it</span> </a><a href="#tradeoffs" class="pattern-nav-link" data-astro-cid-pjne7374> <span class="pattern-nav-number" data-astro-cid-pjne7374>04</span> <span data-astro-cid-pjne7374>Trade-offs</span> </a><a href="#example" class="pattern-nav-link" data-astro-cid-pjne7374> <span class="pattern-nav-number" data-astro-cid-pjne7374>05</span> <span data-astro-cid-pjne7374>Example</span> </a><a href="#references" class="pattern-nav-link" data-astro-cid-pjne7374> <span class="pattern-nav-number" data-astro-cid-pjne7374>06</span> <span data-astro-cid-pjne7374>References</span> </a> </nav> </div> <div class="pattern-rail-source" data-astro-cid-pjne7374> <div class="pattern-source-block" data-astro-cid-7bmmsmqf><div class="pattern-source-header" data-astro-cid-7bmmsmqf><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" class="pattern-source-icon" data-astro-cid-7bmmsmqf><path d="M8 0L3 5V11C3 11.5523 3.44772 12 4 12H12C12.5523 12 13 11.5523 13 11V5L8 0Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" data-astro-cid-7bmmsmqf></path><path d="M6 16H10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" data-astro-cid-7bmmsmqf></path><path d="M8 12V16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" data-astro-cid-7bmmsmqf></path></svg><span class="pattern-source-label" data-astro-cid-7bmmsmqf>Source</span></div><a href="https://openai.com/index/unrolling-the-codex-agent-loop/" target="_blank" rel="noopener noreferrer" class="pattern-source-link" data-astro-cid-7bmmsmqf>https://openai.com/index/unrolling-the-codex-agent-loop/<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" class="external-link-icon" data-astro-cid-7bmmsmqf><path d="M1 6H11M6 1L11 6L6 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-astro-cid-7bmmsmqf></path></svg></a></div> </div> </aside> <article class="pattern-content" data-astro-cid-pjne7374> <section id="problem" class="pattern-section surface-panel" data-astro-cid-pjne7374> <div class="pattern-section-header" data-astro-cid-pjne7374> <span class="pattern-section-number" data-astro-cid-pjne7374>01</span> <h2 data-astro-cid-pjne7374>Problem</h2> </div> <div class="pattern-section-body" data-astro-cid-pjne7374><p>Long-running agent conversations with many tool calls can suffer from <strong>quadratic performance degradation</strong>:</p>
<ul>
<li><strong>Growing JSON payloads</strong>: Each iteration sends the entire conversation history to the API</li>
<li><strong>Expensive re-computation</strong>: Without caching, the model re-processes the same static content repeatedly</li>
<li><strong>ZDR constraints</strong>: Zero Data Retention (ZDR) policies prevent server-side state, ruling out <code>previous_response_id</code> optimization</li>
<li><strong>Configuration changes</strong>: Mid-conversation changes (sandbox, tools, working directory) can break cache efficiency</li>
</ul>
<p>As conversations grow, inference costs and latency increase quadratically without proper caching strategies.</p>
</div> </section><section id="solution" class="pattern-section surface-panel" data-astro-cid-pjne7374> <div class="pattern-section-header" data-astro-cid-pjne7374> <span class="pattern-section-number" data-astro-cid-pjne7374>02</span> <h2 data-astro-cid-pjne7374>Solution</h2> </div> <div class="pattern-section-body" data-astro-cid-pjne7374><p>Maintain prompt cache efficiency through <strong>exact prefix preservation</strong> - always append new messages rather than modifying existing ones, and carefully order messages to maximize cache hits.</p>
<p><strong>Core insight</strong>: Prompt caches only work on <strong>exact prefix matches</strong>. If the first N tokens of a request match a previous request, the cached computation can be reused.</p>
<p><strong>Mechanism</strong>: Caching operates at the token level, not message level. The cache checks token-by-token for prefix matches, independent of message boundaries.</p>
<p><strong>Message ordering strategy:</strong></p>
<ol>
<li>
<p><strong>Static content first</strong> (beginning of prompt - cached across all requests):</p>
<ul>
<li>System message (if server-controlled)</li>
<li>Tool definitions (must be in consistent order)</li>
<li>Developer instructions</li>
<li>User/project instructions</li>
</ul>
</li>
<li>
<p><strong>Variable content last</strong> (end of prompt - changes per request):</p>
<ul>
<li>User message</li>
<li>Assistant messages</li>
<li>Tool call results (appended iteratively)</li>
</ul>
</li>
</ol>
<p><strong>Configuration change via insertion:</strong></p>
<p>When configuration changes mid-conversation, <strong>insert a new message</strong> rather than modifying an existing one:</p>
<pre><code>[Static prefix...]
&lt;sandbox_config_v1&gt;     // Original config message
[Conversation...]

&lt;sandbox changed&gt;
&lt;sandbox_config_v2&gt;     // NEW message inserted
[Conversation continues...]
</code></pre>
<p>This preserves the exact prefix of all previous messages, maintaining cache hits.</p>
<p><strong>What breaks cache hits:</strong></p>
<ul>
<li>Changing the list of available tools (position-sensitive)</li>
<li>Reordering messages</li>
<li>Modifying existing message content</li>
<li>Changing the model (affects server-side system message)</li>
</ul>
<p><strong>Provider variations:</strong></p>
<ul>
<li><strong>OpenAI</strong>: Automatic caching on exact prefix matches</li>
<li><strong>Anthropic</strong>: Explicit cache-control headers, TTL-based invalidation (up to 5 minutes), 90% discount on cached tokens</li>
</ul>
<p><strong>Stateless design for ZDR:</strong></p>
<p>Avoid <code>previous_response_id</code> to support Zero Data Retention. Instead, rely on prompt caching for linear performance:</p>
<pre><code>Without previous_response_id:
- Quadratic network traffic (send full JSON each time)
- Linear sampling cost (due to prompt caching)

With previous_response_id:
- Linear network traffic
- But violates ZDR (server must store conversation state)
</code></pre>
</div> </section><section id="how-to-use-it" class="pattern-section surface-panel" data-astro-cid-pjne7374> <div class="pattern-section-header" data-astro-cid-pjne7374> <span class="pattern-section-number" data-astro-cid-pjne7374>03</span> <h2 data-astro-cid-pjne7374>How to use it</h2> </div> <div class="pattern-section-body" data-astro-cid-pjne7374><p><strong>Prompt construction checklist:</strong></p>
<ol>
<li><strong>Order messages by stability</strong>: Static → Variable</li>
<li><strong>Never modify existing messages</strong>: Always append new ones</li>
<li><strong>Keep tool order consistent</strong>: Enumerate tools in deterministic order</li>
<li><strong>Insert, don't update</strong>: For config changes, add new messages</li>
</ol>
<p><strong>Handling configuration changes:</strong></p>
<table>
<thead>
<tr>
<th>Change Type</th>
<th>What NOT to do</th>
<th>What TO do</th>
</tr>
</thead>
<tbody>
<tr>
<td>Sandbox/approval mode</td>
<td>Modify permission message</td>
<td>Insert new <code>role=developer</code> message</td>
</tr>
<tr>
<td>Working directory</td>
<td>Modify environment message</td>
<td>Insert new <code>role=user</code> message</td>
</tr>
<tr>
<td>Tool list</td>
<td>Change mid-conversation</td>
<td>Avoid if possible; breaks cache</td>
</tr>
</tbody>
</table>
<p><strong>MCP server considerations:</strong></p>
<p>MCP servers can emit <code>notifications/tools/list_changed</code> to indicate tool list changes. <strong>Avoid honoring this mid-conversation</strong> as it breaks cache hits. Instead:</p>
<ul>
<li>Delay tool refresh until conversation boundary</li>
<li>Or accept the cache miss as necessary trade-off</li>
</ul>
<p><strong>Implementation sketch:</strong></p>
<pre><code class="language-typescript">function buildPrompt(state: ConversationState): Prompt {
  const items: PromptItem[] = [];

  // Static prefix (cached)
  items.push({ role: 'system', content: state.systemMessage });
  items.push({ type: 'tools', tools: state.tools });  // Consistent order!
  items.push({ role: 'developer', content: state.instructions });

  // Variable content (appended)
  items.push(...state.history);

  return { items };
}

function handleConfigChange(
  state: ConversationState,
  newConfig: SandboxConfig
): ConversationState {
  // DON'T: Modify existing permission message
  // DO: Insert new message
  return {
    ...state,
    history: [
      ...state.history,
      {
        role: 'developer',
        content: formatSandboxConfig(newConfig),
      },
    ],
  };
}
</code></pre>
</div> </section><section id="tradeoffs" class="pattern-section surface-panel" data-astro-cid-pjne7374> <div class="pattern-section-header" data-astro-cid-pjne7374> <span class="pattern-section-number" data-astro-cid-pjne7374>04</span> <h2 data-astro-cid-pjne7374>Trade-offs</h2> </div> <div class="pattern-section-body" data-astro-cid-pjne7374><p><strong>Pros:</strong></p>
<ul>
<li><strong>Linear sampling cost</strong>: Prompt caching makes repeated inference linear rather than quadratic</li>
<li><strong>ZDR-compatible</strong>: Stateless design supports Zero Data Retention policies</li>
<li><strong>No server state</strong>: Avoids <code>previous_response_id</code> complexity</li>
<li><strong>Simple conceptual model</strong>: Exact prefix matching is easy to reason about</li>
<li><strong>Production-validated savings</strong>: 43% cost reduction demonstrated at scale (HyperAgent, 9.4B tokens/month)</li>
</ul>
<p><strong>Cons:</strong></p>
<ul>
<li><strong>Quadratic network traffic</strong>: JSON payload size still grows quadratically (only sampling is cached)</li>
<li><strong>Cache fragility</strong>: Mid-conversation changes (tools, model) break prefix matching</li>
<li><strong>Disciplined ordering required</strong>: All static content must come before variable content</li>
<li><strong>Tool enumeration complexity</strong>: Must maintain consistent tool ordering</li>
<li><strong>MCP server limitations</strong>: Dynamic tool changes can cause cache misses</li>
</ul>
</div> </section><section id="example" class="pattern-section surface-panel" data-astro-cid-pjne7374> <div class="pattern-section-header" data-astro-cid-pjne7374> <span class="pattern-section-number" data-astro-cid-pjne7374>05</span> <h2 data-astro-cid-pjne7374>Example</h2> </div> <div class="pattern-section-body" data-astro-cid-pjne7374><div class="mermaid">graph TD
    subgraph &quot;Request 1&quot;
        A1[System message]
        A2[Tools]
        A3[Instructions]
        A4[User message]
    end

    subgraph &quot;Request 2 - Cache Hit!&quot;
        B1[System message]
        B2[Tools]
        B3[Instructions]
        B4[User message]
        B5[Assistant response]
        B6[Tool result]
    end

    subgraph &quot;Request 3 - Cache Hit!&quot;
        C1[System message]
        C2[Tools]
        C3[Instructions]
        C4[User message]
        C5[Assistant response]
        C6[Tool result 1]
        C7[Tool result 2]
    end

    style A1 fill:#90EE90
    style A2 fill:#90EE90
    style A3 fill:#90EE90
    style B1 fill:#90EE90
    style B2 fill:#90EE90
    style B3 fill:#90EE90
    style C1 fill:#90EE90
    style C2 fill:#90EE90
    style C3 fill:#90EE90

    style A4 fill:#FFB6C1
    style B4 fill:#FFB6C1
    style B5 fill:#FFB6C1
    style B6 fill:#FFB6C1
    style C4 fill:#FFB6C1
    style C5 fill:#FFB6C1
    style C6 fill:#FFB6C1
    style C7 fill:#FFB6C1
</div><p><strong>Green = Cached</strong> (exact prefix match) | <strong>Pink = Recomputed</strong> (new tokens)</p>
</div> </section><section id="references" class="pattern-section surface-panel" data-astro-cid-pjne7374> <div class="pattern-section-header" data-astro-cid-pjne7374> <span class="pattern-section-number" data-astro-cid-pjne7374>06</span> <h2 data-astro-cid-pjne7374>References</h2> </div> <div class="pattern-section-body" data-astro-cid-pjne7374><ul>
<li><a href="https://openai.com/index/unrolling-the-codex-agent-loop/">Unrolling the Codex agent loop | OpenAI Blog</a></li>
<li><a href="https://platform.openai.com/docs/guides/prompt-caching">Prompt Caching Documentation | OpenAI</a></li>
<li><a href="https://docs.anthropic.com/en/docs/build-with-claude/context-caching">Context Caching | Anthropic</a></li>
<li><a href="https://github.com/openai/codex">Codex CLI | GitHub</a></li>
<li>Related: <a href="/patterns/context-window-auto-compaction">Context Window Auto-Compaction</a></li>
</ul>
</div> </section> </article> </section> <section class="pattern-dispatch" data-astro-cid-pjne7374> <div class="newsletter-cta newsletter-cta--default" data-astro-cid-6zkp5hrb> <div class="newsletter-cta-content" data-astro-cid-6zkp5hrb> <h3 class="newsletter-cta-title" data-astro-cid-6zkp5hrb>Follow the library as it sharpens</h3> <p class="newsletter-cta-description" data-astro-cid-6zkp5hrb>Get notified when this pattern improves or when related entries are added.</p> </div> <form class="newsletter-cta-form" data-newsletter-form data-nonce="58ec7n" data-astro-cid-6zkp5hrb>  <div class="newsletter-cta-input-group" data-astro-cid-6zkp5hrb> <input type="email" name="email" placeholder="your@email.com" required class="newsletter-cta-input" aria-label="Email address" data-astro-cid-6zkp5hrb> <button type="submit" class="newsletter-cta-button" data-astro-cid-6zkp5hrb> <span class="newsletter-cta-button-text" data-astro-cid-6zkp5hrb>Subscribe</span> <svg class="newsletter-cta-spinner" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" data-astro-cid-6zkp5hrb> <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="16 10" stroke-dashoffset="0" class="spinner-circle" data-astro-cid-6zkp5hrb></circle> </svg> </button> </div> <div class="newsletter-cta-message" role="status" aria-live="polite" data-astro-cid-6zkp5hrb></div> </form> </div> <script type="module">async function b(r){try{return await r.json()}catch{return{}}}document.querySelectorAll("[data-newsletter-form]").forEach(r=>{const s=r,a=s.querySelector('input[type="email"]'),t=s.querySelector('button[type="submit"]'),n=t?.querySelector(".newsletter-cta-button-text"),o=t?.querySelector(".newsletter-cta-spinner"),e=s.querySelector(".newsletter-cta-message"),c=n?.textContent?.trim()||"Subscribe";s.addEventListener("submit",async d=>{d.preventDefault();const i=a?.value.trim();if(!(!i||!t||!n||!e)){e.textContent="",e.className="newsletter-cta-message",t.disabled=!0,n.textContent="Subscribing...",o?.classList.add("spinner-spinning");try{const l=await fetch("/api/subscribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:i})}),u=await b(l);l.ok?(e.textContent=u.message||"Thanks for subscribing.",e.classList.add("newsletter-cta-message--success"),a.value="",n.textContent="Subscribed"):(e.textContent=u.error||"Something went wrong. Please try again.",e.classList.add("newsletter-cta-message--error"),t.disabled=!1,n.textContent=c)}catch{e.textContent="Network error. Please check your connection and try again.",e.classList.add("newsletter-cta-message--error"),t.disabled=!1,n.textContent=c}finally{o?.classList.remove("spinner-spinning")}}})});</script> </section>  </div>  </main> <footer class="footer" data-astro-cid-sz7xmlte> <div class="footer-container" data-astro-cid-sz7xmlte> <div class="footer-intro" data-astro-cid-sz7xmlte> <h2 class="footer-headline" data-astro-cid-sz7xmlte>A reference surface for teams building agent products.</h2> <p class="footer-copy" data-astro-cid-sz7xmlte>
Browse patterns, compare trade-offs, and move from first prototype to production-grade agent
        systems with fewer blind spots.
</p> <div class="footer-actions" data-astro-cid-sz7xmlte> <a href="/patterns" class="button button--primary" data-astro-cid-sz7xmlte>Browse the Library</a> <a href="https://github.com/nibzard/awesome-agentic-patterns" target="_blank" rel="noreferrer" class="footer-inline-link" data-astro-cid-sz7xmlte>
View repository ↗
</a> </div> </div> <div class="footer-links" data-astro-cid-sz7xmlte> <div class="footer-section" data-astro-cid-sz7xmlte> <h3 class="footer-section-title" data-astro-cid-sz7xmlte>Library</h3> <ul class="footer-section-links" data-astro-cid-sz7xmlte> <li data-astro-cid-sz7xmlte> <a href="/patterns" class="footer-link" data-astro-cid-sz7xmlte> Browse Patterns </a> </li><li data-astro-cid-sz7xmlte> <a href="/graph" class="footer-link" data-astro-cid-sz7xmlte> Pattern Graph </a> </li><li data-astro-cid-sz7xmlte> <a href="/decision" class="footer-link" data-astro-cid-sz7xmlte> Decision Guide </a> </li><li data-astro-cid-sz7xmlte> <a href="/guides" class="footer-link" data-astro-cid-sz7xmlte> Guides </a> </li> </ul> </div><div class="footer-section" data-astro-cid-sz7xmlte> <h3 class="footer-section-title" data-astro-cid-sz7xmlte>Project</h3> <ul class="footer-section-links" data-astro-cid-sz7xmlte> <li data-astro-cid-sz7xmlte> <a href="/contribute" class="footer-link" data-astro-cid-sz7xmlte> Contribute </a> </li><li data-astro-cid-sz7xmlte> <a href="https://github.com/nibzard/awesome-agentic-patterns" class="footer-link" data-astro-cid-sz7xmlte> GitHub </a> </li><li data-astro-cid-sz7xmlte> <a href="https://x.com/nibzard" class="footer-link" data-astro-cid-sz7xmlte> Twitter </a> </li> </ul> </div><div class="footer-section" data-astro-cid-sz7xmlte> <h3 class="footer-section-title" data-astro-cid-sz7xmlte>Policy</h3> <ul class="footer-section-links" data-astro-cid-sz7xmlte> <li data-astro-cid-sz7xmlte> <a href="/privacy" class="footer-link" data-astro-cid-sz7xmlte> Privacy Policy </a> </li><li data-astro-cid-sz7xmlte> <a href="/terms" class="footer-link" data-astro-cid-sz7xmlte> Terms of Service </a> </li> </ul> </div> </div> </div> <div class="footer-bottom" data-astro-cid-sz7xmlte> <p class="footer-copyright" data-astro-cid-sz7xmlte>
&copy; 2026 Awesome Agentic Patterns. Built as an open reference for shipping AI agents.
</p> </div> </footer> </body></html> <script type="module" src="/_astro/_slug_.astro_astro_type_script_index_0_lang.Dynw_3PF.js"></script>