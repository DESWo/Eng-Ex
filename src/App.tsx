import { lazy, Suspense, useEffect } from 'react'
import { MotionConfig } from 'framer-motion'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { ScrollProgress } from '@/components/ui/ScrollProgress'
import { LandingPage } from '@/pages/LandingPage'
import { ProfileProvider, useProfile } from '@/hooks/useProfile'

// Only the landing page ships in the entry chunk. Everything else is a route
// split, so a first-time visitor downloads the hero and nothing behind it.
const importDisciplinePage = () => import('@/pages/DisciplinePage')
const DisciplinePage = lazy(() =>
  importDisciplinePage().then((m) => ({ default: m.DisciplinePage })),
)
const ChallengePage = lazy(() =>
  import('@/pages/ChallengePage').then((m) => ({ default: m.ChallengePage })),
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
      <Navbar />
      <main id="main" className="flex-1">
        {/* keyed on the account so signing in or out remounts and every hook re-reads */}
        <Suspense fallback={null}>
          <Routes key={profile?.email ?? 'guest'}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/explore/:slug" element={<DisciplinePage />} />
            <Route path="/explore/:slug/:challengeId" element={<ChallengePage />} />
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
