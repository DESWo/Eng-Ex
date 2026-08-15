import bulb from '@/assets/doodles/bulb.svg?raw'
import reading from '@/assets/doodles/reading.svg?raw'
import sittingReading from '@/assets/doodles/sitting-reading.svg?raw'
import star from '@/assets/doodles/star.svg?raw'
import trophy from '@/assets/doodles/trophy.svg?raw'
import { cn } from '@/lib/utils'

/**
 * Credits in src/assets/doodles/CREDITS.md: figures by Pablo Stanley (Open
 * Doodles, CC0), icons by Khushmeen Sidhu (Doodle Icons, CC0).
 *
 * Inlined as raw SVG rather than <img> so ink can follow `currentColor` and
 * highlights the discipline `--accent`. Safe because these are vendored static
 * files reviewed before commit, not remote or user input.
 */
const DOODLES = {
  bulb,
  reading,
  'sitting-reading': sittingReading,
  star,
  trophy,
} as const

export type DoodleName = keyof typeof DOODLES

interface DoodleProps {
  name: DoodleName
  /** Size and color via Tailwind, e.g. "h-40 text-ink/70". */
  className?: string
  /** Screen-reader label; decals are decorative by default. */
  label?: string
}

export function Doodle({ name, className, label }: DoodleProps) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('block [&>svg]:h-full [&>svg]:w-full', className)}
      dangerouslySetInnerHTML={{ __html: DOODLES[name] }}
    />
  )
}
