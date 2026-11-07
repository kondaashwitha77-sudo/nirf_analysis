import type { ChartSpec } from '../types'

/** Breaks a long name into lines for axis labels and annotations (hover keeps the full name). */
export function wrapLabel(text: string, max = 24): string {
  const lines: string[] = []
  text.split(' ').forEach((word) => {
    const last = lines[lines.length - 1]
    if (last !== undefined && `${last} ${word}`.length <= max) lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
  })
  return lines.join('<br>')
}

/** False when a chart would draw nothing, so it is never rendered as a blank box. */
export function chartHasData(chart: ChartSpec): boolean {
  return chart.series.some((s) => {
    if (chart.type === 'heatmap') return !!s.z?.some((row) => row.some((v) => v !== null))
    if (chart.type === 'pie' || chart.type === 'donut') return !!s.values?.some((v) => v > 0)
    if (chart.type === 'histogram') return (s.x?.length ?? 0) > 0
    return !!s.y?.some((v) => v !== null)
  })
}
