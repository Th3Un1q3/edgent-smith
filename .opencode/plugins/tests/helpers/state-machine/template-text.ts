import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { renderTemplateFile, TEMPLATE_DIRECTORY } from '@plugins/state-machine/machines/session/template-files'
import type { TemplateId, TemplateValues } from '@plugins/state-machine/machines/session/template-files'

/**
The shipped template's own text, read from the directory production loads it
from. A test expectation built here moves with a wording edit instead of
freezing prose the template is allowed to change.
*/
export const templateText = (id: TemplateId): string =>
  readFileSync(path.join(fileURLToPath(TEMPLATE_DIRECTORY), `${id}.md`), 'utf8').trim()

/**
The template rendered with the supplied values by the production renderer, so
placeholders and sections resolve exactly as the machine emits them.
*/
export const templateRendered = (id: TemplateId, values: TemplateValues = {}): string =>
  renderTemplateFile(id, values)

/**
The literal text before the template's first tag; empty when it opens with one.
*/
export const templateStart = (id: TemplateId): string => {
  const [start = ''] = templateText(id).split('{{', 1)

  return start
}

/**
The literal text after the template's last tag; empty when it ends with one.
*/
export const templateEnd = (id: TemplateId): string => {
  const text = templateText(id)

  return text.slice(text.lastIndexOf('}}') + 2).trim()
}
