import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { disciplines } from '@/data/disciplines'
import { useProfile } from '@/hooks/useProfile'
import { LEVELS_PER_CHALLENGE, TIER_LABEL, masteryFor, type MasteryTier } from '@/lib/mastery'
import { loadJson } from '@/lib/storage'
import type { Reflection } from '@/lib/types'
import { cn } from '@/lib/utils'

/** challenge id -> cleared levels, best metric values, stars. Written by useLevels. */
type LevelStore = Record<
  string,
  {
    cleared?: number[]
    best?: Record<string, number>
    stars?: Record<number, number>
  }
>

/** Three stars per level is the ceiling useLevels can award. */
const STARS_PER_LEVEL = 3

const tierChip: Record<MasteryTier, string> = {
  untouched: 'bg-stone-200 text-ink-soft dark:bg-white/10 dark:text-stone-400',
  explored: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  solid: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  mastered: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
}

const enjoyedLabel: Record<string, string> = {
  loved: 'Loved it',
  okay: 'It was okay',
  'not-really': 'Not for me',
}

const tryAnotherLabel: Record<string, string> = {
  yes: 'Yes',
  maybe: 'Maybe',
  no: 'No thanks',
}

/** Metric ids are code names ("peak-g", "line_loss"); print them as words. */
const metricLabel = (id: string) => id.replace(/[-_]/g, ' ')

/**
 * Metric ids that a retune renamed away (amp -> shake, dampers -> peak on
 * Smooth Ride). Old saves still carry bests under them until the level is
 * replayed (useLevels prunes on clear), and a best for a measurement the game
 * no longer makes should not print on a report.
 */
const RETIRED_METRIC_IDS = new Set(['amp', 'dampers'])

const fmt = (v: number) => String(Math.round(v * 100) / 100)

function SectionLabel({ children }: { children: string }) {
  return <h2 className="label-caps text-ink-soft dark:text-stone-400">{children}</h2>
}

export function TeacherPage() {
  const { profile } = useProfile()

  // One read at mount is enough: opening the report is the refresh.
  const store = loadJson<LevelStore>('levels', {})
  const reflections = loadJson<Record<string, Reflection>>('reflections', {})

  const starsFor = (challengeId: string) => {
    const stars = store[challengeId]?.stars ?? {}
    let sum = 0
    for (let n = 1; n <= LEVELS_PER_CHALLENGE; n++) sum += stars[n] ?? 0
    return sum
  }

  const rows = disciplines.map((d) => ({
    d,
    mastery: masteryFor(d),
    stars: d.challenges.reduce((sum, c) => sum + starsFor(c.id), 0),
    maxStars: d.challenges.length * LEVELS_PER_CHALLENGE * STARS_PER_LEVEL,
  }))

  const touched = rows.filter((r) => r.mastery.cleared > 0)
  const reflected = disciplines.filter((d) => {
    const r = reflections[d.slug]
    return r && (r.enjoyed !== undefined || r.difficulty !== undefined || r.tryAnother !== undefined)
  })

  const student = profile ? profile.name : 'Guest on this device'
  const printed = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="teacher-report mx-auto max-w-4xl px-6 py-10">
      {/* print rules for this page only: drop the chrome, force black on white */}
      <style>{`
        @media print {
          header, footer, .no-print { display: none !important; }
          html.dark body, body { background: #fff !important; color: #000 !important; }
          .teacher-report { max-width: none; padding: 0; }
        }
      `}</style>

      <p className="label-caps text-ink-soft dark:text-stone-400">Progress report</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
        Engineering Explorer
      </h1>
      <p className="mt-2 font-mono text-sm tabular-nums text-ink-soft dark:text-stone-400">
        {student} · {printed}
      </p>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft dark:text-stone-400">
        Everything below is read from this browser's saved work for whoever is signed in. Nothing
        leaves this device.
      </p>

      <div className="no-print mt-6 flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print this report
        </Button>
      </div>

      {/* Per-field summary */}
      <section className="mt-10">
        <SectionLabel>Fields</SectionLabel>
        <div className="rule mt-3" />
        <table className="mt-1 w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="label-caps py-2.5 pr-3 font-semibold text-ink-soft dark:text-stone-400">
                Field
              </th>
              <th className="label-caps py-2.5 pr-3 text-right font-semibold text-ink-soft dark:text-stone-400">
                Levels
              </th>
              <th className="label-caps py-2.5 pr-3 text-right font-semibold text-ink-soft dark:text-stone-400">
                Stars
              </th>
              <th className="label-caps py-2.5 text-right font-semibold text-ink-soft dark:text-stone-400">
                Tier
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ d, mastery, stars, maxStars }) => (
              <tr key={d.slug} className="border-t border-stone-900/10 dark:border-white/10">
                <td className="py-2.5 pr-3 font-display font-semibold">{d.name}</td>
                <td className="py-2.5 pr-3 text-right font-mono tabular-nums">
                  {mastery.cleared} / {mastery.total}
                </td>
                <td className="py-2.5 pr-3 text-right font-mono tabular-nums">
                  {stars} / {maxStars}
                </td>
                <td className="py-2.5 text-right">
                  <span
                    className={cn(
                      'inline-block rounded-full px-2.5 py-0.5 font-display text-xs font-semibold',
                      tierChip[mastery.tier],
                    )}
                  >
                    {TIER_LABEL[mastery.tier]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Per-game detail, only for fields with any cleared level */}
      <section className="mt-10">
        <SectionLabel>Games</SectionLabel>
        <div className="rule mt-3" />
        {touched.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft dark:text-stone-400">
            No levels cleared yet. This section fills in as soon as a game is played.
          </p>
        ) : (
          touched.map(({ d }) => (
            <div key={d.slug} className="mt-6">
              <h3 className="font-display text-lg font-bold tracking-tight">{d.name}</h3>
              <div className="mt-2 space-y-3">
                {d.challenges.map((c) => {
                  const entry = store[c.id] ?? {}
                  // Deduped, matching masteryFor: restored saves are untrusted.
                  const cleared = new Set(
                    (Array.isArray(entry.cleared) ? entry.cleared : []).filter(
                      (n) => n >= 1 && n <= LEVELS_PER_CHALLENGE,
                    ),
                  ).size
                  const best = Object.entries(entry.best ?? {}).filter(
                    ([id]) => !RETIRED_METRIC_IDS.has(id),
                  )
                  return (
                    <div
                      key={c.id}
                      className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-stone-900/10 pt-2.5 text-sm dark:border-white/10"
                    >
                      <span className="min-w-40 font-display font-semibold">{c.title}</span>
                      <span className="font-mono tabular-nums">
                        {cleared} / {LEVELS_PER_CHALLENGE} levels
                      </span>
                      <span
                        className="font-mono tabular-nums"
                        title="Stars earned on levels 1 through 5"
                      >
                        stars{' '}
                        {[1, 2, 3, 4, 5]
                          .map((n) => entry.stars?.[n]?.toString() ?? '·')
                          .join(' ')}
                      </span>
                      {best.length > 0 && (
                        <span className="text-ink-soft dark:text-stone-400">
                          best:{' '}
                          {best.map(([id, v], i) => (
                            <span key={id}>
                              {i > 0 && ', '}
                              {metricLabel(id)}{' '}
                              <span className="font-mono tabular-nums">{fmt(v)}</span>
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </section>

      {/* What the student said afterwards */}
      <section className="mb-6 mt-10">
        <SectionLabel>Reflections</SectionLabel>
        <div className="rule mt-3" />
        {reflected.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft dark:text-stone-400">
            No reflections recorded yet. Students answer three quick questions after each field's
            challenge step.
          </p>
        ) : (
          <div className="mt-2">
            {reflected.map((d) => {
              const r = reflections[d.slug]
              return (
                <div
                  key={d.slug}
                  className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-stone-900/10 py-2.5 text-sm first:border-t-0 dark:border-white/10"
                >
                  <span className="min-w-40 font-display font-semibold">{d.name}</span>
                  <span>{r.enjoyed ? enjoyedLabel[r.enjoyed] : 'No answer'}</span>
                  <span className="font-mono tabular-nums">
                    difficulty {r.difficulty !== undefined ? `${r.difficulty} / 5` : '·'}
                  </span>
                  <span>
                    try another: {r.tryAnother ? tryAnotherLabel[r.tryAnother] : 'no answer'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
