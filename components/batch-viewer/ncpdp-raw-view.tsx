"use client"

/**
 * Renders raw NCPDP text with syntax highlighting for control characters.
 * Purely character-level — no NCPDP domain knowledge needed.
 */
export function NcpdpRawView({ text }: { text: string }) {
  const elements: React.ReactNode[] = []
  let key = 0

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    switch (ch) {
      case "\x02":
        elements.push(
          <span
            key={key++}
            className="text-zinc-400 bg-zinc-100 rounded px-0.5 text-[10px] font-semibold"
          >
            STX
          </span>,
        )
        break

      case "\x03":
        elements.push(
          <span
            key={key++}
            className="text-zinc-400 bg-zinc-100 rounded px-0.5 text-[10px] font-semibold"
          >
            ETX
          </span>,
        )
        break

      case "\x1D":
        elements.push(
          <span
            key={key++}
            className="text-violet-600 bg-violet-50 rounded px-0.5 text-[10px] font-semibold"
          >
            GS
          </span>,
        )
        elements.push(<br key={key++} />)
        break

      case "\x1C":
        elements.push(
          <span
            key={key++}
            className="text-sky-600 bg-sky-50 rounded px-0.5 text-[10px] font-semibold"
          >
            FS
          </span>,
        )
        break

      case "\x1E": {
        elements.push(
          <span
            key={key++}
            className="text-amber-600 bg-amber-50 rounded px-0.5 text-[10px] font-semibold"
          >
            AM
          </span>,
        )
        // Highlight the 2-digit segment ID that follows
        const segId = text.slice(i + 1, i + 3)
        if (segId.length === 2 && /^[A-Z0-9]{2}$/.test(segId)) {
          elements.push(
            <span key={key++} className="text-amber-700 font-semibold">
              {segId}
            </span>,
          )
          i += 2
        }
        break
      }

      case "\n":
        elements.push(<br key={key++} />)
        break

      default:
        elements.push(ch)
        break
    }
  }

  return (
    <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap break-all p-4 bg-zinc-50 rounded-lg border overflow-auto max-h-[70vh]">
      {elements}
    </pre>
  )
}
