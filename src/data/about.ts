import {
  FlaskConical,
  GraduationCap,
  Layers,
  Trophy,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * ALL About-page content lives here. Edit freely.
 * The creator section is a first-person intro; personalize it however you like.
 */

// PLACEHOLDER FOR DESMOND: there is no "why I built this" here any more, because
// the old one was not written by you. Add a paragraph in your own words and put
// the heading back to 'Why I built this'. A few plain sentences is enough.
export const aboutWhy = {
  heading: 'What this is',
  paragraphs: [
    'Twelve engineering fields. Each one has three games, five levels deep, then a short explanation of what you just did and a project you can build at home.',
    'The games are simulations rather than quizzes. Bridge Builder assembles a truss stiffness matrix and solves it again at every position the truck rolls to, so a bridge with too few triangles comes apart the way a real mechanism does. The robot arm solves inverse kinematics, elbow-up and elbow-down. Smooth Ride works out the transmissibility of the suspension you picked, which is why the stiff setup that wins level 2 shakes itself apart on level 3.',
    'It all runs in the browser and saves to whichever device you played on. There is no server, no account, and no analytics.',
  ],
}

export const aboutGoal = {
  heading: 'The goal',
  body: 'For middle and high school students to try several kinds of engineering and work out which ones they want more of. Nothing is graded and no score is compared between students. Levels award up to three stars for solving them unaided, and replaying can raise a rating but never lower it. Each game ends with the principle behind it and where that principle is used in industry.',
  pillars: [
    { label: 'Play first', text: 'Every field opens with the games. The explanation comes afterwards.' },
    { label: 'Real models', text: 'The bridge solves a truss. The arm solves inverse kinematics.' },
    { label: 'Twelve fields', text: 'Three are open from the start. Nine more unlock after those.' },
  ] as { label: string; text: string }[],
}

// PLACEHOLDER FOR DESMOND: the two paragraphs that used to be here were written
// for you, not by you. Replace the line below with however you want to introduce
// yourself. Write it yourself.
export const aboutCreator = {
  heading: 'About the creator',
  name: 'Desmond Wong',
  role: 'Creator of Engineering Explorer',
  paragraphs: [
    'I built Engineering Explorer. The roadmap below is what I am working on next.',
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
      title: 'Boards to compare designs',
      body: 'Every optimize level already scores your design against three competing targets. Next: seeing how a class solved the same problem differently.',
      status: 'building',
    },
    {
      icon: GraduationCap,
      title: 'Quick tutorials',
      body: 'A 30-second hands-on intro before each game: the concept, the goal, the controls, and how you score.',
      status: 'building',
    },
    {
      icon: Layers,
      title: 'More fields',
      body: 'Biomedical, materials, and software engineering, each with the same three games and five levels as the twelve already here.',
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
      title: 'Accounts that follow you',
      body: 'A transfer code already carries your progress to another computer. Real accounts, so it happens by itself, need a server this app does not have yet.',
      status: 'planned',
    },
  ],
}
