import type { Arbitrage } from '@poe2-dashboard/shared'
import type { Column, RowData } from '@tanstack/react-table'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowRight, ArrowUpDown, ChevronDown, ChevronUp, Loader2, RotateCcw } from 'lucide-react'
import { useMemo } from 'react'

import { sectionLabelClass } from '@/components/common/SectionLabel.js'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { useArbitrageContext, useArbitrages } from './context.js'
import { CurrencyIcon } from './CurrencyIcon.js'
import { cycleKey, cycleThroughputDivine, formatCompact, formatRate } from './utils.js'

// Per-column Tailwind classes ride along on the column meta so the generic
// header/cell renderers can apply each column's width + alignment.
declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- must mirror the base interface's generics
  interface ColumnMeta<TData extends RowData, TValue> {
    headClass?: string
    cellClass?: string
  }
}

type CycleChainProps = {
  legs: Arbitrage['legs']
  /** Narrow mode (calculator open): show icons + arrows only, rate on hover. */
  compact: boolean
}

const CycleChain = ({ legs, compact }: CycleChainProps) => (
  <div className="flex items-center gap-2 flex-wrap">
    {legs.map((leg, i) => {
      const [fromAmt, toAmt] = formatRate(leg.rate)
      const Connector = i === legs.length - 1 ? RotateCcw : ArrowRight
      return (
        <div key={`${leg.from}-${i}`} className="flex items-center gap-2">
          <CurrencyIcon name={leg.from} />
          {compact ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Connector className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="tabular-nums">
                {fromAmt} → {toAmt}
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm text-foreground tabular-nums">
              <span>{fromAmt}</span>
              <Connector className="w-4 h-4" />
              <span>{toAmt}</span>
            </span>
          )}
        </div>
      )
    })}
  </div>
)

// A clickable column label that drives the TanStack sort. Shows a neutral
// up/down glyph until its column is active, then the current direction. The
// table is configured desc-first with no "unsorted" state, so a click toggles
// desc ↔ asc. Every sortable column here is numeric, hence Column<…, number>.
const SortableHeader = ({
  column,
  label,
}: {
  column: Column<Arbitrage, number>
  label: string
}) => {
  const sorted = column.getIsSorted()
  const Icon = sorted === false ? ArrowUpDown : sorted === 'desc' ? ChevronDown : ChevronUp
  return (
    <button
      type="button"
      onClick={column.getToggleSortingHandler()}
      aria-pressed={sorted !== false}
      className={cn(
        'inline-flex items-center gap-1 transition-colors hover:text-foreground',
        sorted !== false ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      <span>{label}</span>
      <Icon className="h-3 w-3" />
    </button>
  )
}

// Legs cell reads the selection from context so the column definitions stay
// static: open-calculator "compact" mode just collapses each chain to icons.
const LegsCell = ({ arb }: { arb: Arbitrage }) => {
  const { selectedCycleKey } = useArbitrageContext()
  return <CycleChain legs={arb.legs} compact={selectedCycleKey !== null} />
}

// A bare icon for use inside another tooltip's content — unlike CurrencyIcon it
// carries no nested Radix tooltip (which would be illegal here); the name rides
// on alt/title instead. Falls back to the raw name when no icon is known.
const LegIcon = ({ name, src }: { name: string; src?: string }) =>
  src ? (
    <img
      src={src}
      alt={name}
      title={name}
      className="inline-block w-5 h-5 object-contain shrink-0"
    />
  ) : (
    <span>{name}</span>
  )

// Bottleneck volume with a per-leg breakdown on hover, so a single dead leg
// (the thing min-volume alone can't reveal) is one hover away. The thinnest
// leg — the one that set minVolume — is highlighted.
const VolumeCell = ({ arb }: { arb: Arbitrage }) => {
  const { arbitrages } = useArbitrages()
  const { currencyIcons } = arbitrages
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-default underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">
          {formatCompact(arb.minVolume)}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex flex-col gap-1">
          {arb.legs.map((leg, i) => (
            <div
              key={`${leg.from}-${i}`}
              className={cn(
                'flex items-center justify-between gap-3 tabular-nums',
                leg.volume === arb.minVolume && 'text-amber-400',
              )}
            >
              <span className="flex items-center gap-1">
                <LegIcon name={leg.from} src={currencyIcons[leg.from]} />
                <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                <LegIcon name={leg.to} src={currencyIcons[leg.to]} />
              </span>
              <span>{formatCompact(leg.volume)}</span>
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

const columnHelper = createColumnHelper<Arbitrage>()

// Column ids matter: 'profit' is the default sort key seeded in context, and
// 'minVolume'/'throughput' are toggled in/out of view by the compact layout.
const columns = [
  columnHelper.display({
    id: 'legs',
    header: 'Legs',
    cell: ({ row }) => <LegsCell arb={row.original} />,
  }),
  columnHelper.accessor('minVolume', {
    id: 'minVolume',
    header: ({ column }) => <SortableHeader column={column} label="Min Vol" />,
    cell: ({ row }) => <VolumeCell arb={row.original} />,
    meta: { headClass: 'w-24 text-right', cellClass: 'text-right tabular-nums' },
  }),
  columnHelper.accessor('profitPct', {
    id: 'profit',
    header: ({ column }) => <SortableHeader column={column} label="Profit %" />,
    cell: ({ getValue }) => `+${getValue().toFixed(2)}%`,
    meta: {
      headClass: 'w-24 text-right',
      cellClass: 'text-right text-green-400 tabular-nums font-medium',
    },
  }),
  columnHelper.accessor(row => cycleThroughputDivine(row), {
    id: 'throughput',
    header: ({ column }) => <SortableHeader column={column} label="Profit/day" />,
    cell: ({ getValue }) => formatCompact(getValue()),
    meta: { headClass: 'w-24 text-right', cellClass: 'text-right tabular-nums text-green-400' },
  }),
]

const emptyStateMessage = (isAwaitingFirstSnapshot: boolean, hasError: boolean): string => {
  if (!isAwaitingFirstSnapshot) return 'No arbitrages match the current filters.'
  if (hasError) return 'No data yet — the latest poll failed (see above).'
  return 'Waiting for the first rates from poe.ninja…'
}

export const ArbitrageTable = () => {
  const { selectedCycleKey, setSelectedCycleKey, sorting, setSorting } = useArbitrageContext()
  const { arbitrages } = useArbitrages()
  const { arbitrages: rows, dataAgeMs, lastError } = arbitrages
  const isAwaitingFirstSnapshot = dataAgeMs === null
  const isLoading = isAwaitingFirstSnapshot && !lastError

  // With the payoff calculator open the table is squeezed beside its w-80 panel,
  // so hide the two analytical columns (the calculator already shows volume and
  // profit/day). Off-focus, all four show and a min width keeps a very narrow
  // window scrolling rather than crushing the fixed numeric columns together.
  const compact = selectedCycleKey !== null
  const columnVisibility = useMemo(() => ({ minVolume: !compact, throughput: !compact }), [compact])

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    getRowId: cycleKey,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSortingRemoval: false,
    sortDescFirst: true,
  })

  return (
    <Table className={cn('table-fixed', !compact && 'min-w-[30rem]')}>
      <TableHeader>
        {table.getHeaderGroups().map(headerGroup => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map(header => (
              <TableHead
                key={header.id}
                className={cn(
                  sectionLabelClass,
                  'sticky top-0 bg-card text-sm',
                  header.column.columnDef.meta?.headClass,
                )}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={table.getVisibleLeafColumns().length}
              className="text-muted-foreground py-4"
            >
              <span className="flex items-center gap-2">
                {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {emptyStateMessage(isAwaitingFirstSnapshot, Boolean(lastError))}
              </span>
            </TableCell>
          </TableRow>
        ) : (
          table.getRowModel().rows.map(row => {
            const isSelected = row.id === selectedCycleKey
            return (
              <TableRow
                key={row.id}
                onClick={() => setSelectedCycleKey(isSelected ? null : row.id)}
                data-state={isSelected ? 'selected' : undefined}
                aria-selected={isSelected}
                className="cursor-pointer"
              >
                {row.getVisibleCells().map(cell => (
                  <TableCell key={cell.id} className={cn(cell.column.columnDef.meta?.cellClass)}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}
