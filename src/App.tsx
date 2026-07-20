import { useEffect } from 'react'
import { MotionConfig } from 'framer-motion'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
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
      <ProfileProvider>
        <Shell />
      </ProfileProvider>
    </MotionConfig>
  )
}

export default App
