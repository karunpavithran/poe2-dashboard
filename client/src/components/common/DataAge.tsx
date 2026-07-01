import { formatDistanceToNow } from 'date-fns'
import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

type DataAgeProps = {
  fetchedAt: number | null
  className?: string
  onRefetch?: () => void
  isFetching?: boolean
}

export const DataAge = ({ fetchedAt, className, onRefetch, isFetching }: DataAgeProps) => {
  const [, tick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  if (fetchedAt === null) return null

  return (
    <span className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
      {onRefetch && (
        <button
          type="button"
          onClick={onRefetch}
          className="inline-flex items-center hover:text-foreground transition-colors"
          title="Refresh"
        >
          <RefreshCw className={cn('w-3 h-3', isFetching && 'animate-spin')} />
        </button>
      )}
      {formatDistanceToNow(fetchedAt, { addSuffix: true })}
    </span>
  )
}
