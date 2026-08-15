import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ClipboardCopy, Download, FolderOpen, Info, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useDialogChrome } from '@/components/auth/useDialogChrome'
import { useProfile } from '@/hooks/useProfile'
import {
  applySave,
  buildTransferCode,
  decodeTransferCode,
  downloadSave,
  parseSave,
  saveMatchesCurrentAccount,
  type SaveFile,
} from '@/lib/saveFile'

type Status = { kind: 'ok' | 'error'; text: string } | null

/**
 * Save file and transfer code, for getting progress off this browser. The code
 * exists for machines where a download never lands anywhere findable. Both go
 * through parseSave, so a mangled file and a truncated code fail the same way,
 * before anything is written.
 */

/** Name both sides of a mismatch, guest slot included, in one question. */
function mismatchQuestion(save: SaveFile, mine: string | null) {
  const theirs = typeof save.account === 'string' && save.account ? save.account : null
  const from = theirs ? `This save belongs to ${theirs}.` : 'This save was made without an account.'
  const into = mine
    ? `Load it into ${mine}'s progress?`
    : `Load it into the guest progress on this browser?`
  return `${from} ${into}`
}

export function SaveDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useProfile()
  const [status, setStatus] = useState<Status>(null)
  // A save whose account is not the one signed in waits here for a yes.
  const [pending, setPending] = useState<SaveFile | null>(null)
  const [code, setCode] = useState('')
  // Shown when the clipboard is unavailable, so the code can still be selected.
  const [codeOut, setCodeOut] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useDialogChrome(open, panelRef, onClose)

  useEffect(() => {
    if (!open) return
    setStatus(null)
    setPending(null)
    setCode('')
    setCodeOut('')
  }, [open])

  const write = (save: SaveFile) => {
    applySave(save)
    setPending(null)
    setStatus({ kind: 'ok', text: 'Progress loaded. Reloading so every screen picks it up.' })
    // A reload makes every hook re-read the restored progress cleanly.
    setTimeout(() => window.location.reload(), 900)
  }

  /** Validate first, ask about a mismatch second, write last. */
  const offer = (raw: string) => {
    const parsed = parseSave(raw)
    if (!parsed.ok) {
      setPending(null)
      setStatus({ kind: 'error', text: parsed.error })
      return
    }
    if (!saveMatchesCurrentAccount(parsed.save)) {
      setStatus(null)
      setPending(parsed.save)
      return
    }
    write(parsed.save)
  }

  const copyCode = async () => {
    const text = buildTransferCode()
    setCodeOut(text)
    try {
      await navigator.clipboard.writeText(text)
      setStatus({
        kind: 'ok',
        text: 'Transfer code copied. Paste it somewhere you can get back to: a notes app, or an email to yourself.',
      })
    } catch {
      // Clipboard access is blocked on plenty of school machines. The code is
      // on screen either way, so the student can select it by hand.
      setStatus({
        kind: 'error',
        text: 'This browser blocked the clipboard. Select the code below and copy it yourself.',
      })
    }
  }

  const loadCode = () => {
    const text = decodeTransferCode(code)
    if (text === null) {
      setPending(null)
      setStatus({ kind: 'error', text: 'That transfer code could not be read. Paste the whole code, from the first character to the last.' })
      return
    }
    offer(text)
  }

  // Portalled to <body> so the dialog sits outside the app it makes inert.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm dark:bg-black/60"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-title"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="my-auto w-full max-w-md rounded-3xl border border-stone-200/70 bg-white p-6 shadow-clay-lg dark:border-white/10 dark:bg-night-panel"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 id="save-title" className="font-display text-xl font-bold tracking-tight">
                  Back up your progress
                </h2>
                <p className="mt-1 text-sm text-ink-soft dark:text-stone-400">
                  {profile
                    ? `Everything ${profile.email} has done, as one file or one line of text.`
                    : 'Everything saved on this browser, as one file or one line of text.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-full p-1.5 text-ink-soft transition-colors hover:bg-stone-900/5 dark:text-stone-400 dark:hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-2.5">
              <Button variant="accent" onClick={() => downloadSave()}>
                <Download className="h-4 w-4" />
                Download save file
              </Button>
              <Button variant="soft" onClick={() => fileRef.current?.click()}>
                <FolderOpen className="h-4 w-4" />
                Load a save file
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void file.text().then(offer)
                  e.target.value = ''
                }}
              />
            </div>

            {pending && (
              <div className="mt-3 rounded-xl bg-amber-100 px-3.5 py-3 dark:bg-amber-500/15">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-900 dark:text-amber-200" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                      {mismatchQuestion(pending, profile?.email ?? null)}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-amber-900/80 dark:text-amber-200/80">
                      The progress that is here now is replaced, and there is no undo. Download a
                      save file first if you are not sure.
                    </p>
                    {pending.summary?.['All fields'] && (
                      <p className="mt-1 font-mono text-xs text-amber-900/80 dark:text-amber-200/80">
                        In that save: {pending.summary['All fields']}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setPending(null)}>
                    Cancel
                  </Button>
                  <Button size="sm" variant="primary" onClick={() => write(pending)}>
                    Load it anyway
                  </Button>
                </div>
              </div>
            )}

            {status && (
              <p
                role="status"
                className={
                  status.kind === 'ok'
                    ? 'mt-3 rounded-xl bg-emerald-100 px-3.5 py-2.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'mt-3 rounded-xl bg-rose-100 px-3.5 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300'
                }
              >
                {status.text}
              </p>
            )}

            <div className="mt-5 border-t border-stone-200/70 pt-4 dark:border-white/10">
              <h3 className="font-display text-sm font-semibold">No downloads on this computer?</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft dark:text-stone-400">
                Copy your progress as one line of text, paste it somewhere handy such as a notes app
                or an email to yourself, then paste it back in on the other computer.
              </p>

              <div className="mt-2.5 flex flex-col gap-2.5">
                <Button variant="soft" size="sm" onClick={() => void copyCode()}>
                  <ClipboardCopy className="h-4 w-4" />
                  Copy transfer code
                </Button>

                {codeOut && (
                  <textarea
                    readOnly
                    value={codeOut}
                    aria-label="Your transfer code"
                    onFocus={(e) => e.currentTarget.select()}
                    className="h-20 w-full resize-none rounded-2xl border-2 border-stone-200 bg-transparent px-3 py-2 font-mono text-xs break-all outline-none focus:border-ink dark:border-white/15 dark:focus:border-stone-300"
                  />
                )}

                <label htmlFor="transfer-code" className="font-display text-sm font-semibold">
                  Load from code
                </label>
                <textarea
                  id="transfer-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Paste a transfer code here"
                  className="h-20 w-full resize-none rounded-2xl border-2 border-stone-200 bg-transparent px-3 py-2 font-mono text-xs break-all outline-none placeholder:font-sans placeholder:text-stone-400 focus:border-ink dark:border-white/15 dark:placeholder:text-stone-600 dark:focus:border-stone-300"
                />
                <Button
                  variant="soft"
                  size="sm"
                  onClick={loadCode}
                  disabled={code.trim().length === 0}
                >
                  <FolderOpen className="h-4 w-4" />
                  Load from code
                </Button>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-stone-100 px-3.5 py-2.5 dark:bg-white/5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft dark:text-stone-400" />
              <p className="text-xs leading-relaxed text-ink-soft dark:text-stone-400">
                Progress saves itself on this browser automatically, but a cleared browser or a
                different computer starts empty. Back up now and then, and load it to pick up exactly
                where you left off. Loading replaces the progress of whoever is signed in right now
                with what the save holds.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
