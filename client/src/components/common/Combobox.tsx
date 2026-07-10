import { useCombobox } from 'downshift'
import { useState } from 'react'

import { cn } from '@/lib/utils'

type ComboboxProps = {
  /** Suggestion list — free text outside this list is still allowed (datalist-style). */
  options: readonly string[]
  value: string
  onChange: (value: string) => void
  id?: string
  placeholder?: string
  autoFocus?: boolean
  className?: string
}

/**
 * Free-text input with a themed suggestion dropdown — a drop-in replacement for
 * native <input list> / <datalist>, whose popup the browser renders white and
 * refuses to style. Downshift drives keyboard nav and a11y; the menu is painted
 * with our own tokens so it matches the dark surface.
 */
export const Combobox = ({
  options,
  value,
  onChange,
  id,
  placeholder,
  autoFocus,
  className,
}: ComboboxProps) => {
  // Filter suggestions against the current text; an empty field shows them all.
  const [inputItems, setInputItems] = useState<readonly string[]>(options)

  const { isOpen, getMenuProps, getInputProps, getItemProps, highlightedIndex, openMenu } =
    useCombobox({
      items: [...inputItems],
      // Controlled text: the field value is whatever is typed, list or not.
      inputValue: value,
      onInputValueChange: ({ inputValue }) => {
        const next = inputValue ?? ''
        onChange(next)
        const needle = next.toLowerCase()
        setInputItems(options.filter(option => option.toLowerCase().includes(needle)))
      },
      onSelectedItemChange: ({ selectedItem }) => {
        if (selectedItem != null) onChange(selectedItem)
      },
      // Clicking the input toggles the menu by default; combined with our
      // open-on-focus that means a fresh click opens (focus) then instantly
      // closes (click toggle). Force a click to always open instead.
      stateReducer: (_state, { type, changes }) =>
        type === useCombobox.stateChangeTypes.InputClick ? { ...changes, isOpen: true } : changes,
    })

  return (
    <div className="relative">
      <input
        {...getInputProps({
          id,
          placeholder,
          autoFocus,
          onFocus: () => !isOpen && openMenu(),
        })}
        data-slot="input"
        className={cn(
          'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30',
          className,
        )}
      />
      <ul
        {...getMenuProps()}
        className={cn(
          'absolute left-0 top-full z-50 mt-1.5 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover py-1 shadow-lg',
          (!isOpen || inputItems.length === 0) && 'hidden',
        )}
      >
        {isOpen &&
          inputItems.map((item, index) => (
            <li
              key={item}
              {...getItemProps({ item, index })}
              className={cn(
                'cursor-pointer px-2.5 py-1 text-sm',
                highlightedIndex === index ? 'bg-accent text-accent-foreground' : 'text-foreground',
              )}
            >
              {item}
            </li>
          ))}
      </ul>
    </div>
  )
}
