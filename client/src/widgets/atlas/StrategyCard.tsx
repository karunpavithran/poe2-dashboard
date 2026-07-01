import type { AtlasStrategy } from '@poe2-dashboard/shared'
import { AlertTriangle, Copy, ExternalLink, Pencil, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type StrategyCardProps = {
  strategy: AtlasStrategy
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}

type FieldProps = {
  label: string
  children: React.ReactNode
}

const Field = ({ label, children }: FieldProps) => (
  <div className="grid grid-cols-[5rem_1fr] gap-2 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <div className="min-w-0">{children}</div>
  </div>
)

export const StrategyCard = ({ strategy, onEdit, onDuplicate, onDelete }: StrategyCardProps) => (
  <Card className="group/strategy h-fit">
    <CardContent className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-lg leading-tight font-medium">
              {strategy.sourceUrl ? (
                <a
                  href={strategy.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  {strategy.name}
                  <ExternalLink className="size-3.5 text-muted-foreground" />
                </a>
              ) : (
                strategy.name
              )}
            </h3>
            {strategy.profitPerHour !== undefined && (
              <Badge variant="secondary">~{strategy.profitPerHour}d/hr</Badge>
            )}
            {strategy.warning && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertTriangle
                    className="size-4 shrink-0 text-destructive"
                    aria-label="Warning"
                  />
                </TooltipTrigger>
                <TooltipContent variant="destructive" className="max-w-xs text-wrap">
                  {strategy.warning}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover/strategy:opacity-100">
          <Button type="button" size="icon-sm" variant="ghost" onClick={onEdit} title="Edit">
            <Pencil />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={onDuplicate}
            title="Duplicate"
          >
            <Copy />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={onDelete}
            title="Delete"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Field label="Master">
          <span className="font-medium">{strategy.master.name || '—'}</span>
          {strategy.master.nodes && (
            <span className="text-muted-foreground"> · {strategy.master.nodes}</span>
          )}
        </Field>
        <Field label="Tablets">
          {strategy.tablets.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <ul className="flex flex-col gap-1">
              {strategy.tablets.map((tablet, index) => (
                <li key={index} className="flex items-start gap-1.5">
                  <span>
                    <span className="font-medium">{tablet.type}</span>
                    {tablet.quantity > 1 && (
                      <span className="text-muted-foreground"> ×{tablet.quantity}</span>
                    )}
                    {tablet.mods.length > 0 && (
                      <span className="text-muted-foreground"> — {tablet.mods.join(', ')}</span>
                    )}
                  </span>
                  {tablet.tradeUrl && (
                    <a
                      href={tablet.tradeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 shrink-0 text-primary hover:text-primary/80"
                      title="Open trade search"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Field>
      </div>

      {strategy.notes && (
        <p className="border-t border-border/60 pt-2 text-sm whitespace-pre-line text-muted-foreground">
          {strategy.notes}
        </p>
      )}

      {strategy.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {strategy.tags.map(tag => (
            <Badge key={tag} variant="outline" className="text-muted-foreground">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
)
