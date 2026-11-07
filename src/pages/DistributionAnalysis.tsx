import { useMemo, useState } from 'react'
import { HowToRead } from '../components/ui/HowToRead'
import { ChartCard } from '../components/charts/ChartCard'
import { SpecChart } from '../components/charts/SpecChart'
import { FilterBar, MetricSelector, Segmented, SelectFilter } from '../components/ui/filters'
import { PageHeader } from '../components/ui/PageHeader'
import { useGlobalFilters } from '../context/GlobalFilters'
import { CATEGORIES, LATEST_YEAR, YEARS } from '../data/mock/constants'
import { categoryOptions, metricLabel, metricValue, selectRecords, yearOptions } from '../data/selectors'
import { orderLabels } from '../lib/order'
import type { ChartSeries } from '../types'

type Mode = 'histogram' | 'box' | 'ecdf'

const WHY: Record<Mode, string> = {
  histogram: 'Shows the shape of the spread, but the picture changes with bin width (L7).',
  ecdf: 'No binning: read any percentile straight off the curve, and compare groups directly (L7).',
  box: 'Compares medians and spread across groups; every point is overlaid so the box cannot hide the data (L8).',
}
type Group = 'none' | 'category' | 'year'

const HIST_CATEGORIES = ['Engineering', 'University', 'Management', 'Medical']
const HIST_YEARS = [YEARS[0], YEARS[Math.floor(YEARS.length / 2)], LATEST_YEAR]
const CATEGORY_AXIS = orderLabels('category', CATEGORIES, 'fixed')

const vals = (category: string | undefined, year: number | undefined, metric: string) =>
  selectRecords({ category, year }).map((r) => metricValue(r, metric)).filter((v): v is number => v !== null)

export default function DistributionAnalysis() {
  const { category, setCategory, year, setYear } = useGlobalFilters()
  const [metric, setMetric] = useState('score')
  const [group, setGroup] = useState<Group>('none')
  const [mode, setMode] = useState<Mode>('histogram')
  const label = metricLabel(metric)
  const isRank = metric === 'rank'

  const primary = useMemo<ChartSeries[]>(() => {
    const cats = mode !== 'box' ? HIST_CATEGORIES : CATEGORY_AXIS
    const yrs = mode !== 'box' ? HIST_YEARS : YEARS
    if (group === 'category') return cats.map((c) => (mode !== 'box' ? { name: c, x: vals(c, year, metric) } : { name: c, y: vals(c, year, metric) }))
    if (group === 'year') return yrs.map((y) => (mode !== 'box' ? { name: String(y), x: vals(category, y, metric) } : { name: String(y), y: vals(category, y, metric) }))
    const v = vals(category, year, metric)
    return [mode !== 'box' ? { name: category, x: v } : { name: category, y: v }]
  }, [mode, group, category, year, metric])

  const byCategory = useMemo(() => CATEGORY_AXIS.map((c) => ({ name: c, y: vals(c, year, metric) })).filter((s) => s.y.length), [year, metric])
  const byYear = useMemo(() => YEARS.map((y) => ({ name: String(y), y: vals(category, y, metric) })).filter((s) => s.y.length), [category, metric])

  const MODE_LABEL: Record<Mode, string> = { histogram: 'Histogram', box: 'Box plot', ecdf: 'ECDF' }
  const primaryTitle = `${MODE_LABEL[mode]} of ${label}${group === 'category' ? ` by category, ${year}` : group === 'year' ? ` by year, ${category}` : ` — ${category}, ${year}`}`
  const total = primary.reduce((a, s) => a + (s.x?.length ?? s.y?.length ?? 0), 0)

  return (
    <>
      <PageHeader title="Distribution Analysis" description="See how a metric is spread, and how that spread differs across categories and years. Missing values are left out." />

      <HowToRead>
        The histogram shows the shape, the ECDF shows the share of institutions at or below any value (the 0.5 line is the median), and the box plot
        compares groups. Missing values are left out, never counted as zero.
      </HowToRead>

      <FilterBar onReset={() => { setMetric('score'); setGroup('none'); setMode('histogram') }}>
        <SelectFilter label="Year" value={String(year)} onChange={(v) => setYear(Number(v))} options={yearOptions} />
        <SelectFilter label="Category" value={category} onChange={setCategory} options={categoryOptions} />
        <MetricSelector value={metric} onChange={setMetric} />
        <SelectFilter label="Group" value={group} onChange={(v) => setGroup(v as Group)} options={[{ value: 'none', label: 'No grouping' }, { value: 'category', label: 'By category' }, { value: 'year', label: 'By year' }]} />
        <Segmented<Mode> label="Chart" value={mode} onChange={setMode} options={[{ value: 'histogram', label: 'Histogram' }, { value: 'ecdf', label: 'ECDF' }, { value: 'box', label: 'Box plot' }]} />
      </FilterBar>

      <ChartCard
        title={MODE_LABEL[mode]}
        why={WHY[mode]}
        subtitle={isRank ? 'Rank distribution uses exact ranks only' : `${total.toLocaleString('en-IN')} values`}
        footer={
          mode !== 'box' && group !== 'none'
            ? `Histograms overlay ${group === 'category' ? HIST_CATEGORIES.join(', ') : HIST_YEARS.join(', ')} to stay readable. Use the box plot to see every group.`
            : undefined
        }
      >
        <SpecChart
          height={380}
          spec={{ type: mode, title: primaryTitle, xTitle: mode !== 'box' ? label : group === 'none' ? undefined : group === 'category' ? 'Category' : 'Year', yTitle: mode === 'histogram' ? 'Institutions' : mode === 'ecdf' ? 'Share at or below' : label, showPoints: mode === 'box', series: primary, reverseY: false }}
          emptyMessage={`No published ${label} values for this selection.`}
        />
      </ChartCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Category comparison" subtitle={`${label}, ${year}, in NIRF standard order`}>
          <SpecChart height={340} spec={{ type: 'box', title: `${label} by category, ${year}`, xTitle: 'Category', yTitle: label, series: byCategory }} emptyMessage="No values in any category." />
        </ChartCard>
        <ChartCard title="Year comparison" subtitle={`${label}, ${category}`}>
          <SpecChart height={340} spec={{ type: 'box', title: `${label} by year, ${category}`, xTitle: 'Year', yTitle: label, series: byYear }} emptyMessage="No values in any year." />
        </ChartCard>
      </div>
    </>
  )
}
