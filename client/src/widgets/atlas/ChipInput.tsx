import { X } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'

type ChipInputProps = {
  values: string[]
  onChange: (values: string[]) => void
}

export const ChipInput = ({ values, onChange }: ChipInputProps) => {
  const [text, setText] = useState('')

  const addChip = () => {
    const trimmed = text.trim()
    if (trimmed && !values.includes(trimmed)) onChange([...values, trimmed])
    setText('')
  }

  const removeChip = (chip: string) => onChange(values.filter(value => value !== chip))

  return (
    <div className="flex min-h-8 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-input/30 px-2 py-1.5">
      {values.map(chip => (
        <Badge key={chip} variant="secondary" className="gap-1 pr-1">
          {chip}
          <button
            type="button"
            onClick={() => removeChip(chip)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <input
        value={text}
        onChange={event => setText(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault()
            addChip()
          } else if (event.key === 'Backspace' && !text && values.length > 0) {
            onChange(values.slice(0, -1))
          }
        }}
        onBlur={addChip}
        className="h-6 min-w-24 flex-1 bg-transparent text-sm outline-none"
      />
    </div>
  )
}
