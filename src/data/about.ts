import {
  Compass,
  FlaskConical,
  Gamepad2,
  Layers,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * ALL About-page content lives here. Edit freely.
 * The creator section is a first-person intro; personalize it however you like.
 */

export const aboutWhy = {
  heading: 'Why I built this',
  paragraphs: [
    'Most people never find out what engineering actually feels like until college, if ever. Textbooks explain it, but they rarely let you touch it.',
    'Engineering Explorer flips that around. Instead of reading about forces, budgets, and tradeoffs, you play with them: build a bridge and watch it fail, balance a reactor, wire a real circuit. The idea clicks because you did it, not because someone told you.',
    'It is not meant to replace school or Khan Academy. It is meant to make engineering feel approachable and exciting, so more curious students discover a field they might love.',
  ],
}

export const aboutGoal = {
  heading: 'The goal',
  body: 'Help middle school and high school students discover which kind of engineering fits them, through short, hands-on simulations. No grades, no pressure, just exploration. Every challenge ends by showing the real engineering principle behind it and where that idea shows up in industry, so students leave thinking, "I just did what real engineers do."',
  pillars: [
    { icon: Gamepad2, label: 'Learn by doing', text: 'Interactive simulations, not walls of text.' },
    { icon: FlaskConical, label: 'Real concepts', text: 'Forces, budgets, and tradeoffs, made visual.' },
    { icon: Compass, label: 'Find your fit', text: 'Sample many fields and see what excites you.' },
  ] as { icon: LucideIcon; label: string; text: string }[],
}

// Personalize this. It is written in first person as the creator.
export const aboutCreator = {
  heading: 'About the creator',
  name: 'Desmond Wong',
  role: 'Creator of Engineering Explorer',
  paragraphs: [
    'Hi, I\'m Desmond. I build things at the intersection of engineering and education, and I care a lot about making technical ideas feel intuitive instead of intimidating.',
    'I made Engineering Explorer because I wished something like it existed when I was younger: a place to try engineering for real before committing to it. If it helps even a few students find a field they love, it did its job.',
  ],
}

interface RoadmapItem {
  icon: LucideIcon
  title: string
  body: string
  status: 'building' | 'planned'
}

export const aboutRoadmap: { heading: string; items: RoadmapItem[] } = {
  heading: 'Where it is headed',
  items: [
    {
      icon: Trophy,
      title: 'Leaderboards and scoring',
      body: 'Every game gets a real score for efficiency, cost, and clever design, so there is always a better solution to chase.',
      status: 'building',
    },
    {
      icon: Sparkles,
      title: 'Quick tutorials',
      body: 'A 30-second hands-on intro before each game: the concept, the goal, the controls, and how you score.',
      status: 'building',
    },
    {
      icon: Layers,
      title: 'Level progression',
      body: 'Each game grows one idea at a time: play, understand, analyze, then optimize, so you gradually think like an engineer.',
      status: 'planned',
    },
    {
      icon: FlaskConical,
      title: 'Deeper simulations',
      body: 'More authentic physics: live stress colors, force arrows, wind and quake loads, and clearer failure explanations.',
      status: 'planned',
    },
    {
      icon: Users,
      title: 'Accounts and global boards',
      body: 'Save progress across devices and compare designs with students everywhere (coming with a real backend).',
      status: 'planned',
    },
  ],
}
