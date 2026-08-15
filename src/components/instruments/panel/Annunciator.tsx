import { motion, useReducedMotion } from 'framer-motion'
import { Engraved } from './PanelSurface'
import { LAMP } from './tokens'
import type { AnnunciatorState, AnnunciatorTile } from './useAnnunciators'
import { cn } from '@/lib/utils'

function Tile({ tile }: { tile: AnnunciatorTile }) {
  const reduced = useReducedMotion()
  const ink = LAMP[tile.tone ?? 'amber']
  const lit = tile.status !== 'clear'
  const flashing = tile.status === 'unacked'
  const state = flashing ? 'alarm, not acknowledged' : tile.status === 'acked' ? 'alarm, acknowledged' : 'clear'

  return (
    <motion.li
      className={cn(
        'flex min-h-[46px] items-center justify-center rounded-[3px] border px-1.5 py-1 text-center',
        lit ? 'border-black/50' : 'border-black/40',
        // Reduced motion loses the flash, so an unacknowledged window keeps a
        // dashed edge to stay distinguishable from an acknowledged one.
        flashing && reduced && 'border-dashed border-white/60',
      )}
      style={{
        backgroundColor: lit ? ink.lit : ink.off,
        boxShadow: lit ? `0 0 12px ${ink.glow}, inset 0 1px 0 rgb(255 255 255 / 0.25)` : 'inset 0 2px 5px rgb(0 0 0 / 0.5)',
      }}
      animate={flashing && !reduced ? { opacity: [1, 0.38, 1] } : { opacity: 1 }}
      transition={flashing && !reduced ? { duration: 1.1, repeat: Infinity, ease: 'linear' } : { duration: 0.2 }}
    >
      <span
        className="font-body text-[9.5px] leading-[1.15] font-semibold uppercase tracking-[0.1em]"
        style={{ color: lit ? ink.legendOn : ink.legendOff }}
      >
        {tile.legend}
      </span>
      <span className="sr-only">: {state}</span>
    </motion.li>
  )
}

interface AnnunciatorPanelProps {
  state: AnnunciatorState
  /** Tiles per row on a wide screen. */
  columns?: 2 | 3 | 4
  legend?: string
  className?: string
}

/**
 * The alarm windows plus the acknowledge pushbutton. New alarms are announced
 * once through a polite live region; the tiles themselves are not live, or a
 * ticking sim would talk over itself.
 */
export function AnnunciatorPanel({ state, columns = 3, legend = 'Annunciators', className }: AnnunciatorPanelProps) {
  const cols = columns === 2 ? 'grid-cols-2' : columns === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'
  const waiting = state.tiles.filter((t) => t.status === 'unacked').map((t) => t.legend)

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <Engraved>{legend}</Engraved>
        <button
          type="button"
          onClick={state.acknowledge}
          disabled={state.unacked === 0}
          className={cn(
            'rounded-[3px] border px-3 py-1 font-body text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors duration-150',
            state.unacked > 0
              ? 'border-black/50 bg-[#dde4ea] text-[#12171c] hover:bg-white'
              : 'border-black/40 bg-[#2a3037] text-slate-400',
          )}
          aria-label={
            state.unacked > 0
              ? `Acknowledge ${state.unacked} alarm${state.unacked === 1 ? '' : 's'}`
              : 'Acknowledge alarms, nothing waiting'
          }
        >
          Ack{state.unacked > 0 ? ` ${state.unacked}` : ''}
        </button>
      </div>
      <ul className={cn('grid gap-1.5', cols)}>
        {state.tiles.map((t) => (
          <Tile key={t.id} tile={t} />
        ))}
      </ul>
      <p aria-live="polite" className="sr-only">
        {waiting.length > 0 ? `Alarm: ${waiting.join(', ')}. Press acknowledge.` : 'No alarms waiting.'}
      </p>
    </div>
  )
}
