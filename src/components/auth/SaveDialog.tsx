import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Download, FolderOpen, Info, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useProfile } from '@/hooks/useProfile'
import { applySave, downloadSave } from '@/lib/saveFile'

type Status = { kind: 'ok' | 'error'; text: string } | null

export function SaveDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useProfile()
  const [status, setStatus] = useState<Status>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setStatus(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const restore = async (file: File) => {
    const error = applySave(await file.text())
    if (error) {
      setStatus({ kind: 'error', text: error })
      return
    }
    setStatus({ kind: 'ok', text: 'Progress loaded. Reloading so everything picks it up…' })
    // A reload makes every screen re-read the restored progress cleanly.
    setTimeout(() => window.location.reload(), 900)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm dark:bg-black/60"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-title"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="w-full max-w-md rounded-3xl border border-stone-200/70 bg-white p-6 shadow-clay-lg dark:border-white/10 dark:bg-night-panel"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 id="save-title" className="font-display text-xl font-bold tracking-tight">
                  Back up your progress
                </h2>
                <p className="mt-1 text-sm text-ink-soft dark:text-stone-400">
                  {profile
                    ? `Everything ${profile.email} has done, as one file.`
                    : 'Everything saved on this browser, as one file.'}
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
                  if (file) void restore(file)
                  e.target.value = ''
                }}
              />
            </div>

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

            <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-stone-100 px-3.5 py-2.5 dark:bg-white/5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft dark:text-stone-400" />
              <p className="text-xs leading-relaxed text-ink-soft dark:text-stone-400">
                Progress saves itself on this browser automatically, but a cleared browser or a
                different computer starts empty. Download a save file now and then, and load it to
                pick up exactly where you left off. Loading a file overwrites the progress of
                whoever is signed in right now.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
