import { useEffect } from 'react'
import { MotionConfig } from 'framer-motion'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { LandingPage } from '@/pages/LandingPage'
import { DisciplinePage } from '@/pages/DisciplinePage'
import { AboutPage } from '@/pages/AboutPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ProfileProvider, useProfile } from '@/hooks/useProfile'

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
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Keyed on who is signed in: signing in or out remounts the pages so
            every hook re-reads that person's saved work instead of the last one's. */}
        <Routes key={profile?.email ?? 'guest'}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/explore/:slug" element={<DisciplinePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

function App() {
  return (
    // reducedMotion="user" softens animations for people who prefer less motion.
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
