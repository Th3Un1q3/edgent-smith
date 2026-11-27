/**
A prompt's `text` may interpolate the values its action can see: `${context.goal}`,
`${state}`, `${sentence(context.failure?.reason ?? 'unknown')}`. The scope is bound
to exactly three names, so a template reaches no event and no ambient global.
*/
import type { LoopContext } from '../../core/machine'

export interface TemplateScope {
  readonly context: LoopContext
  readonly state: string
}

export const sentence = (text: string): string => /[.!?]$/.test(text) ? text : text + '.'

const EXPRESSION = /\$\{([^{}]*)\}/g

type Evaluate = (context: LoopContext, state: string, sentenceText: (text: string) => string) => unknown

const readExpression = (expression: string, scope: TemplateScope): string => {
  try {
    const evaluate = new Function('context', 'state', 'sentence', 'return (' + expression + ')') as Evaluate
    const value = evaluate(scope.context, scope.state, sentence)

    return typeof value === 'string' ? value : String(value)
  }
  catch (error) {
    throw new Error('prompt template expression failed: ${' + expression + '}', { cause: error })
  }
}

export const renderPromptText = (text: string, scope: TemplateScope): string =>
  text.replaceAll(EXPRESSION, (_matched, expression: string) => readExpression(expression, scope))
