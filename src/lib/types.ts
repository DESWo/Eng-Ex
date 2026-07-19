import type { LucideIcon } from 'lucide-react'

/** The five steps every discipline flow moves through, in order. */
export const STEP_ORDER = ['intro', 'challenge', 'reflection', 'learn', 'diy'] as const
export type StepId = (typeof STEP_ORDER)[number]

export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced'

/** Props every interactive challenge component receives. */
export interface ChallengeProps {
  /** Call once, when the player first solves the challenge. */
  onComplete: () => void
}

export interface LearnPoint {
  icon: LucideIcon
  title: string
  body: string
}

export interface ChallengeRef {
  /** Must match a key in src/challenges/registry.ts. */
  id: string
  title: string
  goal: string
  /** Why THIS game works, shown in the "Why it works" step (one card each). */
  why: LearnPoint[]
}

export interface Discipline {
  slug: string
  name: string
  shortName: string
  tagline: string
  description: string
  icon: LucideIcon
  /** Hex color that themes the whole discipline (cards, buttons, scenes). */
  accent: string
  /** 'core' shows in the main grid; 'more' shows under "Explore more". Defaults to core. */
  tier?: 'core' | 'more'
  /** For 'more' fields: the slug of the core field this branches off (mechanical/civil/electrical). */
  parent?: string
  difficulty: Difficulty
  intro: {
    heading: string
    paragraphs: string[]
    /** Chips shown under "Things they build". */
    builds: string[]
    /** YouTube video id. Leave undefined to show the placeholder. */
    videoId?: string
    /** Short mission text shown right before the challenge starts. */
    challengeTeaser: string
  }
  /** Playable challenges, in suggested order. Solving any one unlocks the next step. */
  challenges: ChallengeRef[]
  learn: {
    heading: string
    /** One line that ties the whole field together, shown after the per-game cards. */
    bigIdea: string
    /** The core engineering tradeoff of this field, in one plain sentence. */
    tradeoff: string
    /** Where this concept shows up in the real world (industry examples). */
    realWorld: {
      intro: string
      examples: string[]
    }
  }
  /** A real-world project for the "Try it at home" step. */
  diy: {
    title: string
    intro: string
    /** Optional build diagram id from src/components/diy (registry). */
    diagram?: string
    materials: string[]
    steps: string[]
    /** A follow-up experiment that connects back to the challenge. */
    experiment: string
    safety: string
  }
}

export type Enjoyment = 'loved' | 'okay' | 'not-really'
export type TryAnother = 'yes' | 'maybe' | 'no'

/** What the student tells us after finishing a challenge. */
export interface Reflection {
  enjoyed?: Enjoyment
  difficulty?: number
  tryAnother?: TryAnother
}
