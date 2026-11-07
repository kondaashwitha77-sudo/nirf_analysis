import { useMemo, useState } from 'react'
import { ChartCard } from '../components/charts/ChartCard'
import { SpecChart } from '../components/charts/SpecChart'
import { DataTable } from '../components/ui/DataTable'
import { FilterBar, MetricSelector, SelectFilter } from '../components/ui/filters'
import { KpiCard, KpiGrid } from '../components/ui/KpiCard'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionCard } from '../components/ui/SectionCard'
import { useGlobalFilters } from '../context/GlobalFilters'
import { PARAM_KEYS } from '../data/mock/constants'
import { HowToRead } from '../components/ui/HowToRead'
import { STATE_OPTIONS } from '../data/mock/rankings'
import { categoryOptions, metricLabel, metricValue, selectRecords, yearOptions } from '../data/selectors'
import { describe, shape, pearson } from '../lib/stats'
import { fmt, fmtInt } from '../lib/format'

export default function StatisticalAnalysis() {
  const { category, setCategory, year, setYear } = useGlobalFilters()
  const [metric, setMetric] = useState('score')
  const [state, setState] = useState('')

  const recs = useMemo(() => selectRecords({ category, year, state: state || undefined }), [category, year, state])
  const values = useMemo(() => recs.map((r) => metricValue(r, metric)), [recs, metric])
  const s = useMemo(() => describe(values), [values])
  const label = metricLabel(metric)
  const sh = useMemo(() => shape(values), [values])
  const [binSize, setBinSize] = useState(0)

  const keys = ['score', ...PARAM_KEYS]
  const corr = useMemo(
    () => keys.map((a) => keys.map((b) => {
      const { r } = pearson(recs.map((x) => metricValue(x, a)), recs.map((x) => metricValue(x, b)))
      return Number.isFinite(r) ? Math.round(r * 100) / 100 : null
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recs],
  )

  const statRows = [
    ['Sample size (n)', fmtInt(s.n)],
    ['Missing values', fmtInt(s.missing)],
    ['Mean', fmt(s.mean)],
    ['Median', fmt(s.median)],
    ['Standard deviation', fmt(s.std)],
    ['Variance', fmt(s.variance)],
    ['Minimum', fmt(s.min)],
    ['Maximum', fmt(s.max)],
    ['Quartile 1 (25th)', fmt(s.q1)],
    ['Quartile 3 (75th)', fmt(s.q3)],
    ['Interquartile range', fmt(s.iqr)],
    ['Skewness', fmt(sh.skew)],
    ['Excess kurtosis', fmt(sh.kurt)],
    ['5th percentile', fmt(s.p5)],
    ['10th percentile', fmt(s.p10)],
    ['90th percentile', fmt(s.p90)],
    ['95th percentile', fmt(s.p95)],
  ].map(([stat, value]) => ({ stat, value }))

  return (
    <>
      <PageHeader title="Statistical Analysis" description="Descriptive statistics for one metric. Missing values are counted and excluded; they are never treated as zero." />

      <HowToRead>
        {metric === 'rank'
          ? 'Rank is ordinal (it has an order but no equal spacing), so the median and quartiles describe it better than the mean. '
          : 'Compare the mean with the median: a gap means the distribution is skewed. '}
        Skewness above 0 means a long tail of high values; excess kurtosis above 0 means heavier tails than a normal curve.
      </HowToRead>

      <FilterBar onReset={() => { setMetric('score'); setState(''); setBinSize(0) }}>
        <SelectFilter label="Year" value={String(year)} onChange={(v) => setYear(Number(v))} options={yearOptions} />
        <SelectFilter label="Category" value={category} onChange={setCategory} options={categoryOptions} />
        <MetricSelector value={metric} onChange={setMetric} />
        <SelectFilter label="State" value={state} onChange={setState} options={STATE_OPTIONS.map((x) => ({ value: x, label: x }))} placeholder="All states" />
      </FilterBar>

      {s.n === 0 ? (
        <SectionCard>
          <p className="py-6 text-center text-sm text-muted">
            {label} has no published values for {category} in {year}{state ? ` (${state})` : ''}. Try another metric, year, or category.
          </p>
        </SectionCard>
      ) : (
        <>
          <KpiGrid cols={5}>
            <KpiCard label="Sample size" value={fmtInt(s.n)} hint={`${recs.length} records in selection`} />
            <KpiCard label="Missing values" value={fmtInt(s.missing)} tone={s.missing ? 'warn' : 'default'} hint="Excluded, not zero" />
            <KpiCard label="Mean" value={fmt(s.mean)} />
            <KpiCard label="Median" value={fmt(s.median)} />
            <KpiCard label="Std. deviation" value={fmt(s.std)} />
          </KpiGrid>

          <div className="grid gap-5 lg:grid-cols-5">
            <SectionCard title="Statistics" subtitle={`${label} — ${category}, ${year}`} className="lg:col-span-2">
              <DataTable dense pageSize={15} rows={statRows} rowKey={(r) => r.stat} columns={[
                { key: 'stat', header: 'Statistic', render: (r) => r.stat },
                { key: 'value', header: 'Value', align: 'right', render: (r) => <span className="font-medium">{r.value}</span> },
              ]} />
            </SectionCard>
            <ChartCard
              title="Distribution"
              subtitle="Histogram of non-missing values"
              className="lg:col-span-3"
              actions={
                <select aria-label="Bin width" className="field-control h-8 w-32 text-xs" value={binSize} onChange={(e) => setBinSize(Number(e.target.value))}>
                  <option value={0}>Bin width: auto</option>
                  {[1, 2, 5, 10].map((b) => <option key={b} value={b}>Bin width: {b}</option>)}
                </select>
              }
              why="The shape depends on bin width: try a few widths before trusting a pattern (L7)."
            >
              <SpecChart height={380} spec={{ type: 'histogram', title: `Distribution of ${label}`, xTitle: label, yTitle: 'Institutions', binSize: binSize || undefined, series: [{ name: label, x: values.filter((v): v is number => v !== null) }] }} />
            </ChartCard>
          </div>

          <ChartCard title="Correlation" subtitle="Pairwise Pearson r among score and parameters. Blank = too few paired values or parameter not published." footer="Correlation describes association only; it does not show cause. Pearson r assumes a roughly linear relationship without extreme outliers." why="Diverging scale centred on 0: blue = move together, orange = move opposite, white = no linear relationship (L6, L8).">
            <SpecChart height={420} spec={{ type: 'heatmap', diverging: true, showValues: true, title: `Correlation matrix — ${category}, ${year}`, xTitle: 'Metric', yTitle: 'Metric', series: [{ name: 'r', x: keys, yLabels: keys, z: corr }] }} />
          </ChartCard>
        </>
      )}
    </>
  )
}
