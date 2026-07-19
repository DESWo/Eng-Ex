import { motion } from 'framer-motion'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'accent' | 'soft' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  // Ink pill in light mode, white pill in dark mode (Apple style).
  primary:
    'bg-ink text-cream shadow-clay hover:bg-stone-700 dark:bg-stone-100 dark:text-ink dark:hover:bg-white',
  // Filled with the current discipline accent.
  accent: 'accent-bg text-white shadow-clay hover:brightness-110',
  // Soft tinted background with accent text.
  soft: 'accent-soft accent-text hover:brightness-97 dark:hover:brightness-110',
  ghost:
    'text-ink-soft hover:bg-stone-900/5 dark:text-stone-400 dark:hover:bg-white/10 dark:hover:text-stone-200',
}

const sizes: Record<Size, string> = {
  sm: 'px-4 py-2 text-sm gap-1.5',
  md: 'px-6 py-3 text-base gap-2',
  lg: 'px-8 py-4 text-lg gap-2.5',
}

const base =
  'inline-flex items-center justify-center rounded-full font-display font-semibold ' +
  'transition-[background-color,filter,box-shadow] duration-200 select-none ' +
  'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100'

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', extra?: string) {
  return cn(base, variants[variant], sizes[size], extra)
}

interface ButtonProps extends Omit<ComponentPropsWithoutRef<typeof motion.button>, 'children'> {
  variant?: Variant
  size?: Size
  children: ReactNode
}

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      className={buttonClasses(variant, size, className)}
      {...props}
    >
      {children}
    </motion.button>
  )
}

interface ButtonLinkProps {
  to: string
  variant?: Variant
  size?: Size
  className?: string
  children: ReactNode
}

/** A react-router Link styled exactly like a Button. */
export function ButtonLink({ to, variant = 'primary', size = 'md', className, children }: ButtonLinkProps) {
  return (
    <Link to={to} className={buttonClasses(variant, size, className)}>
      {children}
    </Link>
  )
}
