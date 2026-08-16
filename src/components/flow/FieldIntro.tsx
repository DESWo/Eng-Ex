import type { Discipline } from '@/lib/types'

/**
 * The opening sentences of the field's intro copy. The data holds two
 * paragraphs written for a full page; the field page only has room for the
 * first few, so it takes them rather than duplicating the copy in a second
 * place that can drift.
 */
function openingSentences(paragraphs: string[], count = 3) {
  const text = paragraphs.join(' ')
  const sentences = text.match(/[^.!?]+[.!?]+/g)
  if (!sentences) return text.trim()
  return sentences
    .slice(0, count)
    .map((sentence) => sentence.trim())
    .join(' ')
}

/** What this field is, in two or three sentences, at the top of the field page. */
export function FieldIntro({ discipline }: { discipline: Discipline }) {
  return (
    <p className="max-w-2xl text-lg leading-relaxed text-ink-soft dark:text-stone-300">
      {openingSentences(discipline.intro.paragraphs)}
    </p>
  )
}
