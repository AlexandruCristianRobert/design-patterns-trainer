import { CircleAlert, LoaderCircle, RotateCw, Sparkles } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IDE_DOWNLOAD_FAILED } from '../../compiler/dotnetBoot'
import { useIde } from './useIde'

/** The size shown in the tooltip: megabytes rounded to 0.1. */
export const toMegabytes = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1)

/** Square icon button in the editor toolbar. Off: starts the download. Ready: a pressed toggle that opens the setting. */
export function IdeButton() {
  const { t } = useTranslation()
  const ide = useIde()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverId = useId()
  const status = ide?.status ?? 'off'
  const ready = status === 'ready'

  // Light dismiss: Escape (focus goes back to the button) and a click or focus outside.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    const onPointer = (e: Event) => {
      if (e.target instanceof Node && !rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('focusin', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('focusin', onPointer)
    }
  }, [open])

  if (!ide) return null

  const mustReload = status === 'failed' && !!ide.error?.message.startsWith(IDE_DOWNLOAD_FAILED)
  const label = ready
    ? t('ide.on')
    : status === 'loading'
      ? t('ide.loading')
      : ide.sizeBytes !== null
        ? t('ide.enable', { size: toMegabytes(ide.sizeBytes) })
        : t('ide.enableNoSize')
  const inert = status === 'loading' || mustReload

  return (
    <div className="ide-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="icon-btn"
        aria-label={label}
        title={label}
        aria-pressed={ready}
        aria-disabled={inert || undefined}
        aria-haspopup={ready ? 'dialog' : undefined}
        aria-expanded={ready ? open : undefined}
        aria-controls={ready && open ? popoverId : undefined}
        onClick={() => {
          if (ready) setOpen((o) => !o)
          else if (!inert) ide.load()
        }}
      >
        {status === 'loading' ? (
          <LoaderCircle size={16} className="spin" aria-hidden="true" />
        ) : (
          <Sparkles size={16} aria-hidden="true" />
        )}
      </button>
      {ready && open && (
        <div className="ide-popover" id={popoverId} role="dialog" aria-label={t('ide.on')}>
          <label className="ide-autoload">
            <input type="checkbox" checked={ide.autoload} onChange={(e) => ide.setAutoload(e.target.checked)} />
            <span>{t('ide.autoload')}</span>
          </label>
          <p className="ide-hint">{t('ide.formatHint')}</p>
        </div>
      )}
    </div>
  )
}

/** The loading and failed messages, in the toolbar next to the compiler status. Renders nothing otherwise. */
export function IdeStatusLine() {
  const { t } = useTranslation()
  const ide = useIde()
  if (!ide || (ide.status !== 'loading' && ide.status !== 'failed')) return null

  if (ide.status === 'loading') {
    return (
      <div className="compiler-status ide-status" data-state="loading" role="status">
        <span className="status-msg">
          <LoaderCircle size={14} className="spin" aria-hidden="true" />
          <span>{t('ide.loading')}</span>
        </span>
      </div>
    )
  }

  const mustReload = !!ide.error?.message.startsWith(IDE_DOWNLOAD_FAILED)
  return (
    <div className="compiler-status ide-status" data-state="failed" role="status">
      <span className="status-msg">
        <CircleAlert size={14} className="status-bad" aria-hidden="true" />
        <span className="status-bad-text">{mustReload ? t('ide.downloadFailed') : t('ide.failed')}</span>
      </span>
      <button
        type="button"
        className="btn btn-quiet btn-small"
        onClick={() => (mustReload ? location.reload() : ide.load())}
      >
        <RotateCw size={14} aria-hidden="true" />
        <span>{mustReload ? t('actions.reload') : t('ide.retry')}</span>
      </button>
    </div>
  )
}
