import { useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Volume2, VolumeX } from 'lucide-react'
import { isMuted, onMuteChange, playSound, setMuted } from '@/lib/sound'

export function SoundToggle() {
  const muted = useSyncExternalStore(onMuteChange, isMuted, () => true)

  const toggle = () => {
    const next = !muted
    setMuted(next)
    // Unmuting confirms itself, so you know it worked without hunting for a game.
    if (!next) playSound('success')
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      aria-pressed={!muted}
      className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft transition-colors duration-200 hover:bg-stone-900/5 dark:text-stone-300 dark:hover:bg-white/10"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={muted ? 'off' : 'on'}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="flex"
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
