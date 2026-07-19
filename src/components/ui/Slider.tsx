import { useId } from 'react'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  /** Shown after the value, e.g. "°" or "%". */
  unit?: string
  onChange: (value: number) => void
  disabled?: boolean
}

/** Labeled range slider that picks up the discipline accent color. */
export function Slider({ label, value, min, max, step = 1, unit = '', onChange, disabled }: SliderProps) {
  const id = useId()
  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between">
        <label htmlFor={id} className="font-display text-sm font-semibold">
          {label}
        </label>
        <span className="accent-soft accent-text rounded-full px-2.5 py-0.5 font-display text-sm font-bold tabular-nums">
          {value}
          {unit}
        </span>
      </div>
      <input
        id={id}
        type="range"
        className="ee-slider"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}
