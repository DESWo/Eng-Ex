import { lazy, Suspense, useEffect, useState } from 'react'
import { MotionConfig } from 'framer-motion'
import { X } from 'lucide-react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { ScrollProgress } from '@/components/ui/ScrollProgress'
import { LandingPage } from '@/pages/LandingPage'
import { ProfileProvider, useProfile } from '@/hooks/useProfile'
import { setPreview, usePreview } from '@/lib/preview'

// Only the landing page ships in the entry chunk. Everything else is a route
// split, so a first-time visitor downloads the hero and nothing behind it.
const importDisciplinePage = () => import('@/pages/DisciplinePage')
const DisciplinePage = lazy(() =>
  importDisciplinePage().then((m) => ({ default: m.DisciplinePage })),
)
const AboutPage = lazy(() =>
  import('@/pages/AboutPage').then((m) => ({ default: m.AboutPage })),
)
const NotFoundPage = lazy(() =>
  import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
)
// teacher-facing and reference pages get their own chunks
const TeacherPage = lazy(() =>
  import('@/pages/TeacherPage').then((m) => ({ default: m.TeacherPage })),
)
const PrivacyPage = lazy(() =>
  import('@/pages/PrivacyPage').then((m) => ({ default: m.PrivacyPage })),
)
const TechnicalNotesPage = lazy(() =>
  import('@/pages/TechnicalNotesPage').then((m) => ({ default: m.TechnicalNotesPage })),
)

/**
 * /explore/:slug is the one route almost every visitor clicks next, so warm its
 * chunk once the browser is idle. After first paint, so it costs the hero nothing.
 */
function usePrefetchDisciplinePage() {
  useEffect(() => {
    const idle = window.requestIdleCallback
    const warm = () => void importDisciplinePage()
    if (typeof idle !== 'function') {
      const t = window.setTimeout(warm, 2000)
      return () => window.clearTimeout(t)
    }
    const id = idle(warm, { timeout: 4000 })
    return () => window.cancelIdleCallback?.(id)
  }, [])
}

/** Jump back to the top whenever the route changes. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

/** ?preview=1 on any URL turns teacher preview on. */
function PreviewFromQuery() {
  const { search } = useLocation()
  useEffect(() => {
    if (new URLSearchParams(search).get('preview') === '1') setPreview(true)
  }, [search])
  return null
}

/**
 * Slim strip shown while teacher preview is on. Dismissing hides it for this
 * visit; only "Turn off" actually clears the flag, so the unlock state is
 * never ambiguous.
 */
function PreviewBanner() {
  const on = usePreview()
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => setDismissed(false), [on])
  if (!on || dismissed) return null
  return (
    <div className="flex items-center justify-center gap-3 bg-amber-100 px-4 py-2 text-sm text-amber-900 dark:bg-amber-500/15 dark:text-amber-200 print:hidden">
      <p className="font-display font-semibold">
        Teacher preview: every field unlocked. Student progress is not affected.
      </p>
      <button
        type="button"
        onClick={() => setPreview(false)}
        className="rounded-full border border-amber-900/30 px-3 py-0.5 font-display text-xs font-semibold transition-colors hover:bg-amber-900/10 dark:border-amber-200/40 dark:hover:bg-amber-200/10"
      >
        Turn off
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Hide this banner"
        className="rounded-full p-1 transition-colors hover:bg-amber-900/10 dark:hover:bg-amber-200/10"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

function Shell() {
  const { profile } = useProfile()
  usePrefetchDisciplinePage()
  return (
    <div className="flex min-h-screen flex-col">
      {/* first tab stop: skips keyboard users past the navbar */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-5 focus:py-2.5 focus:font-display focus:text-sm focus:font-semibold focus:text-cream dark:focus:bg-stone-100 dark:focus:text-ink"
      >
        Skip to content
      </a>
      <ScrollProgress />
      <PreviewBanner />
      <Navbar />
      <main id="main" className="flex-1">
        {/* keyed on the account so signing in or out remounts and every hook re-reads */}
        <Suspense fallback={null}>
          <Routes key={profile?.email ?? 'guest'}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/explore/:slug" element={<DisciplinePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/teacher" element={<TeacherPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/technical" element={<TechnicalNotesPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}

function App() {
  return (
    // reducedMotion="user" honours prefers-reduced-motion app-wide
    <MotionConfig reducedMotion="user">
      <ScrollToTop />
      <PreviewFromQuery />
      <ErrorBoundary
        fallback={() => (
          <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
            <h1 className="font-display text-2xl font-bold">Something went wrong.</h1>
            <p className="max-w-md text-ink-soft dark:text-stone-400">
              Sorry about that. A reload almost always fixes it, and your progress is
              saved on this device.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full bg-ink px-6 py-2.5 font-display font-semibold text-white dark:bg-white dark:text-ink"
            >
              Reload the page
            </button>
          </div>
        )}
      >
        <ProfileProvider>
          <Shell />
        </ProfileProvider>
      </ErrorBoundary>
    </MotionConfig>
  )
}

export default App
