import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge does not know the project's accent-* helpers, and its
 * unknown-class heuristic lumped them into one "accent" group, so passing two
 * of them through cn() silently dropped one (twMerge('accent-soft accent-text')
 * returned only 'accent-text'). Registering each as its own group of one means
 * none of them ever conflict with anything, so they all survive the merge.
 */
const twMerge = extendTailwindMerge<
  'ee-accent-bg' | 'ee-accent-soft' | 'ee-accent-softer' | 'ee-accent-text' | 'ee-accent-border'
>({
  extend: {
    classGroups: {
      'ee-accent-bg': ['accent-bg'],
      'ee-accent-soft': ['accent-soft'],
      'ee-accent-softer': ['accent-softer'],
      'ee-accent-text': ['accent-text'],
      'ee-accent-border': ['accent-border'],
    },
  },
})

/** Merge Tailwind classes without duplicates or conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
