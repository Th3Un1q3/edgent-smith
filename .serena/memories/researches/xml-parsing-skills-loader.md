# XML parsing vs regex for skills-loader envelope detection

Research question: is a general-purpose XML parser better than the ENVELOPE_TAG_PATTERN regex in `.opencode/plugins/skills-loader.ts` for detecting the plugin-generated `<envelope id=.../>` tag in arbitrary agent prose?

## Findings

- **Bun.XMLParser does not exist.** Runtime check on Bun 1.3.14 (installed): `typeof Bun.XMLParser === "undefined"`; `Object.keys(Bun)` exposes only `escapeHTML` among xml/html/sax names. No bun-types declarations found in the project or Bun install. bun.sh/docs/api/xml returns 404. GitHub issue search for XMLParser in oven-sh/bun: 0 real hits.
- **Only related Bun work is open PR #29154** (2026-04-11, open, label `claude`): "Add XML parser, `.xml` loader, and `Bun.XML.parse`". Proposes a DOM-conversion API `Bun.XML.parse(str)` following the fast-xml-parser JS-object convention — NOT a SAX/streaming parser with onStartTag/onText/onEndTag events. Unshipped, unreviewed, no docs.
- **npm options (latest versions, unpkg sizes)**: fast-xml-parser 5.10.1 (1254KB, entity-expanding whole-document parser, JSON-object output); saxes 6.0.0 (160KB, strict SAX, no DTD/entity handling by design); @xmldom/xmldom 0.9.10 (402KB, DOM, lenient error recovery); htmlparser2 12.0.0 (230KB, forgiving streaming tokenizer, entity decoding default on, claims fastest).
- **Feeding non-XML text (markdown/code fences)**: saxes "will report well-formedness errors" / "aim to raise errors for all malformed constructs" (README) — throws on prompt prose. xmldom historically misinterprets malicious/malformed input and even allowed multiple root nodes (GHSA-crh6-fp67-6883 critical). htmlparser2 never throws (tokenizes anything) but yields a whole-document tree. fxp parses the whole string as an XML document (README: Validate/Parse XML). All four parse whole inputs; none detects our single tag inside arbitrary prose without first extracting candidate fragments — which is regex/scanning work anyway.
- **Entity-expansion security history (relevant because agent text is untrusted)**: fast-xml-parser has 12 advisories incl. GHSA-m7jm-9gc2-mpf2 [critical] DOCTYPE entity-name regex injection, GHSA-jmr7-xgp7-cmfj / GHSA-8gc5-j5rx-235r / GHSA-8r6m-32jq-jx6q (entity expansion DoS, last fixed in 5.10.1), GHSA-37qj-frw5-hhjh RangeError numeric-entities DoS. @xmldom/xmldom has 8 advisories incl. GHSA-crh6-fp67-6883 [critical] and recursion DoS (GHSA-2v35-w6hq-6mfw). Regex-based detection never decodes entities, so this whole attack class is out of scope for the current pipeline.
- **The pipeline never needs XML parsing**: it (1) detects an exact self-closing tag shape the plugin itself emits (id always first: `<envelope id="..." description="..."/>`), (2) extracts the UUID, (3) looks it up in the envelope store, (4) substitutes the stored `<task_skills>` payload VERBATIM. No payload parsing, no attribute parsing beyond id extraction, no structure validation.

## Bottom line

- Keep the regex. It is the right tool: precise, zero-dependency, no entity/DoS surface, and it operates on the exact byte shape the plugin controls. A DOM/SAX parser would be strictly worse here (throws on or mangles prose; whole-document semantics; must still pre-extract fragments).
- Cheap hardening for the residual attribute-order concern (already mostly done): keep emitting a canonical single-attribute-first order (`id` then `description` — current code does this), keep the `[^>]*id=` tolerance for forward compatibility, and keep the UUID-precise id shape as the matching gate. If generic attribute-order robustness were ever required, a ~15-line hand-rolled single-tag scanner (read from `<envelope` to the first unquoted `/>`, split attributes) beats any dependency; a full parser is never justified for this pipeline.
- If the operator still wants structural XML handling someday (e.g., validating/extracting the unwrapped `<task_skills>` payload), that is a different, later stage: the payload is well-formed when the plugin emits it, so a real parser is justified there — but not for envelope detection in free text.
- Non-XML alternative noted (not recommended): a unique marker line would avoid regex/XML entirely, but the XML-ish shape is already well-formed as emitted, familiar to agents, and consistent with the `<task_skills>` convention; the risk it introduces (agent prose echoing `<envelope id="...">`) is already mitigated by the UUID-precise pattern.

## Empirical verification (2026-08-06, /tmp/opencode, Bun 1.3.14)

Fed a realistic agent-prompt string (prose + markdown code fence `<foo>` + unbalanced `<div>` + embedded `<envelope id="550e8400-e29b-41d4-a716-446655440000" description="..."/>`):

- saxes 6.0.0: ERROR "7:5: unclosed tag: foo" - strict parser dies on the code fence, never reaches the envelope.
- fast-xml-parser 5.10.1: "parsed OK, root keys: foo" - silently built a document tree around `<foo>`, envelope absorbed as content; garbage, no extraction.
- @xmldom/xmldom 0.9.10: threw on obsolete `errorHandler` option (API moved to `onError` in 0.9.x); lenient-recovery behavior per its advisory history (multiple-root-nodes GHSA-crh6-fp67-6883).
- htmlparser2 12.0.0: never threw; tokenizer surfaced the envelope element with id from the messy text - the ONLY parser that works here, but a 230KB whole-document tokenizer (deps: domutils, entities, domhandler, domelementtype) where a one-line regex suffices.

Conclusion: parser-based detection would require htmlparser2-style forgiving tokenization (overkill) - or fails (saxes) or mangles (fxp) on agent prose. Regex remains the right tool.

## Cached sources

- mem:cache/fetch/api-github-com/repos-oven-sh-bun-issues-29154
- mem:cache/fetch/api-github-com/search-issues-q-repo-oven-sh-bun-xmlparser-per-page-10
- mem:cache/fetch/api-github-com/search-issues-q-repo-oven-sh-bun-22xml-parser-22-in-title-pe
- mem:cache/fetch/api-github-com/advisories-affects-fast-xml-parser
- mem:cache/fetch/api-github-com/advisories-affects-40xmldom-2fxmldom
- mem:cache/fetch/registry-npmjs-org/fast-xml-parser-latest
- mem:cache/fetch/registry-npmjs-org/saxes-latest
- mem:cache/fetch/registry-npmjs-org/xmldom-xmldom-latest
- mem:cache/fetch/registry-npmjs-org/htmlparser2-latest
- mem:cache/fetch/raw-githubusercontent-com/naturalintelligence-fast-xml-parser-master-readme-md
- mem:cache/fetch/raw-githubusercontent-com/lddubeau-saxes-master-readme-md
- mem:cache/fetch/raw-githubusercontent-com/fb55-htmlparser2-master-readme-md
- mem:cache/fetch/bun-sh/docs
- mem:cache/fetch/api-github-com/repos-oven-sh-bun-contents-docs

Local evidence (not cached): Bun 1.3.14 runtime probe (`typeof Bun.XMLParser`), `.opencode/plugins/skills-loader.ts` source (read directly), test file listing.