'use client'
import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 space-y-4">
      <p className="text-6xl font-black text-destructive">500</p>
      <h1 className="text-xl font-bold">오류가 발생했습니다</h1>
      <p className="text-muted-foreground text-sm">
        일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.
      </p>
      <button
        onClick={reset}
        className="mt-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
      >
        다시 시도
      </button>
    </div>
  )
}
