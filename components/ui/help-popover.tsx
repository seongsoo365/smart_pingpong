'use client'
import { useState, useRef, useEffect } from 'react'
import { HelpCircle, X } from 'lucide-react'

interface HelpPopoverProps {
  title: string
  children: React.ReactNode
}

export function HelpPopover({ title, children }: HelpPopoverProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label="도움말"
        className="p-1 text-muted-foreground hover:text-primary transition-colors"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute left-0 top-7 z-50 w-80 glass border border-white/15 rounded-2xl shadow-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-primary">{title}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-xs text-muted-foreground space-y-2 leading-relaxed">
            {children}
          </div>
        </div>
      )}
    </div>
  )
}
