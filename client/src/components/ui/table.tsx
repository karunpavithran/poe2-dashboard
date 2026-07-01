import * as React from 'react'

import { cn } from '@/lib/utils'

type TableProps = React.ComponentProps<'table'>

const Table = ({ className, ...props }: TableProps) => (
  <div data-slot="table-container" className="relative w-full">
    <table
      data-slot="table"
      className={cn('w-full caption-bottom text-sm', className)}
      {...props}
    />
  </div>
)

type TableHeaderProps = React.ComponentProps<'thead'>

const TableHeader = ({ className, ...props }: TableHeaderProps) => (
  <thead data-slot="table-header" className={cn(className)} {...props} />
)

type TableBodyProps = React.ComponentProps<'tbody'>

const TableBody = ({ className, ...props }: TableBodyProps) => (
  <tbody
    data-slot="table-body"
    className={cn('[&_tr:last-child]:border-0', className)}
    {...props}
  />
)

type TableFooterProps = React.ComponentProps<'tfoot'>

const TableFooter = ({ className, ...props }: TableFooterProps) => (
  <tfoot
    data-slot="table-footer"
    className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)}
    {...props}
  />
)

type TableRowProps = React.ComponentProps<'tr'>

const TableRow = ({ className, ...props }: TableRowProps) => (
  <tr
    data-slot="table-row"
    className={cn(
      'border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted',
      className,
    )}
    {...props}
  />
)

type TableHeadProps = React.ComponentProps<'th'>

const TableHead = ({ className, ...props }: TableHeadProps) => (
  <th
    data-slot="table-head"
    className={cn(
      'h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground shadow-[inset_0_-1px_0_rgba(255,255,255,0.2)] [&:has([role=checkbox])]:pr-0',
      className,
    )}
    {...props}
  />
)

type TableCellProps = React.ComponentProps<'td'>

const TableCell = ({ className, ...props }: TableCellProps) => (
  <td
    data-slot="table-cell"
    className={cn('p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0', className)}
    {...props}
  />
)

type TableCaptionProps = React.ComponentProps<'caption'>

const TableCaption = ({ className, ...props }: TableCaptionProps) => (
  <caption
    data-slot="table-caption"
    className={cn('mt-4 text-sm text-muted-foreground', className)}
    {...props}
  />
)

export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow }
