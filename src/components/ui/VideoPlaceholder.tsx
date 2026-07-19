import { Play } from 'lucide-react'

interface VideoPlaceholderProps {
  /** When set, renders a real YouTube embed instead of the placeholder. */
  videoId?: string
  title: string
}

/**
 * A friendly stand-in for an intro video.
 * Drop a YouTube id into the discipline data and it becomes a real player.
 */
export function VideoPlaceholder({ videoId, title }: VideoPlaceholderProps) {
  if (videoId) {
    return (
      <div className="aspect-video overflow-hidden rounded-2xl shadow-clay">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  return (
    <div className="accent-soft accent-border flex aspect-video flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-clay dark:bg-night-panel">
        <Play className="accent-text ml-1 h-7 w-7" fill="currentColor" />
      </span>
      <p className="font-display font-semibold">Video coming soon</p>
      <p className="text-sm text-ink-soft dark:text-stone-400">
        A quick intro video will live right here.
      </p>
    </div>
  )
}
