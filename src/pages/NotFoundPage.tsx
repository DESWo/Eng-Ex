import { Compass } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <span className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-stone-100 dark:bg-white/5">
        <Compass className="h-10 w-10 text-ink-soft dark:text-stone-400" />
      </span>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        This path is not built yet
      </h1>
      <p className="mt-3 text-ink-soft dark:text-stone-400">
        The page you are looking for does not exist. Let's get you back to exploring.
      </p>
      <ButtonLink to="/" className="mt-8">
        Back to home
      </ButtonLink>
    </div>
  )
}
