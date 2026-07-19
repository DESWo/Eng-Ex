import { useEffect } from 'react'
import { MotionConfig } from 'framer-motion'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { LandingPage } from '@/pages/LandingPage'
import { DisciplinePage } from '@/pages/DisciplinePage'
import { NotFoundPage } from '@/pages/NotFoundPage'

/** Jump back to the top whenever the route changes. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function App() {
  return (
    // reducedMotion="user" softens animations for people who prefer less motion.
    <MotionConfig reducedMotion="user">
      <ScrollToTop />
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/explore/:slug" element={<DisciplinePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </MotionConfig>
  )
}

export default App
