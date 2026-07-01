import { cn } from '@/lib/utils'

export const sectionLabelClass = 'text-xs font-medium text-muted-foreground uppercase tracking-wide'

type Props = {
  htmlFor?: string
  className?: string
  children: React.ReactNode
}

export const SectionLabel = ({ htmlFor, className, children }: Props) => {
  const cls = cn(sectionLabelClass, className)
  return htmlFor ? (
    <label htmlFor={htmlFor} className={cls}>
      {children}
    </label>
  ) : (
    <p className={cls}>{children}</p>
  )
}
