import { CircleAlert, CircleX, Info, LoaderCircle, TimerOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { diagnosticMessage } from '../../editor/diagnosticMessage'
import type { SandboxOutput } from './runSandbox'

/** `failed`: the engine itself errored (not the learner's program). */
export type OutputState = SandboxOutput | { kind: 'failed' }

export function OutputPanel({
  output,
  onLocate,
}: {
  output: OutputState
  onLocate(line: number, column: number): void
}) {
  const { t } = useTranslation('sandbox')
  return (
    <section className="panel output" aria-labelledby="output-title">
      <div className="panel-head">
        <h2 id="output-title" className="panel-title">
          {t('output.title')}
        </h2>
      </div>
      <div className="output-body" aria-live="polite">
        <OutputBody output={output} onLocate={onLocate} />
      </div>
    </section>
  )
}

function Note({ icon, tone = 'muted', children }: { icon: ReactNode; tone?: 'muted' | 'bad'; children: ReactNode }) {
  return (
    <p className={`note note-${tone}`}>
      <span className="note-icon" aria-hidden="true">
        {icon}
      </span>
      <span>{children}</span>
    </p>
  )
}

function OutputBody({ output, onLocate }: { output: OutputState; onLocate(line: number, column: number): void }) {
  const { t } = useTranslation('sandbox')
  switch (output.kind) {
    case 'idle':
      return <p className="muted">{t('output.idle')}</p>
    case 'running':
      return <Note icon={<LoaderCircle size={16} className="spin" />}>{t('running')}</Note>
    case 'timedOut':
      return (
        <Note icon={<TimerOff size={16} />} tone="bad">
          {t('output.timedOut')}
        </Note>
      )
    case 'noEntryPoint':
      return <Note icon={<Info size={16} />}>{t('output.noEntryPoint')}</Note>
    case 'failed':
      return (
        <Note icon={<CircleAlert size={16} />} tone="bad">
          {t('output.failed')}
        </Note>
      )
    case 'compileErrors':
      return (
        <div className="diags">
          <p className="diags-title">{t('output.compileErrors')}</p>
          <ul className="diag-list">
            {output.diagnostics.map((d, i) => (
              // Only the location is the button: compiler messages stay out of button names.
              <li key={`${d.id}-${d.startLine}-${d.startColumn}-${i}`} className="diag">
                <CircleX size={16} className="diag-icon" aria-hidden="true" />
                <div className="diag-text">
                  <span className="diag-msg">{diagnosticMessage(d, t)}</span>
                  <span className="diag-meta">
                    <button type="button" className="diag-loc" onClick={() => onLocate(d.startLine, d.startColumn)}>
                      {t('output.location', { line: d.startLine, column: d.startColumn })}
                    </button>
                    <span className="diag-id">{d.id}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )
    case 'completed':
      return (
        <>
          {output.stdout === '' && !output.exception ? (
            <p className="muted">{t('output.empty')}</p>
          ) : (
            output.stdout !== '' && <pre className="stdout">{output.stdout}</pre>
          )}
          {output.truncated && <Note icon={<Info size={16} />}>{t('output.truncated')}</Note>}
          {output.exception && (
            <Note icon={<CircleAlert size={16} />} tone="bad">
              {t('output.exception', { type: output.exception.type, message: output.exception.message })}
            </Note>
          )}
        </>
      )
  }
}
