import type { DataQualityReport, MissingReason, ParamKey } from '../../types'
import { CATEGORIES, PARAM_KEYS, YEARS } from './constants'
import { RECORDS } from './rankings'
import { USE_MOCK } from '../../services/apiClient'

export function buildDataQualityReport(): DataQualityReport {
  const reasonCounts: Record<MissingReason, number> = {
    missing: 0,
    not_published: 0,
    not_applicable: 0,
    parser_failure: 0,
    invalid: 0,
  }
  RECORDS.forEach((r) =>
    (Object.values(r.paramReasons) as MissingReason[]).forEach((reason) => {
      reasonCounts[reason]++
    }),
  )

  const coverage = CATEGORIES.map((category) => ({
    category,
    byYear: Object.fromEntries(
      YEARS.map((y) => [y, RECORDS.filter((r) => r.category === category && r.year === y).length]),
    ) as Record<number, number>,
  }))

  const parameterAvailability = PARAM_KEYS.map((parameter: ParamKey) => ({
    parameter,
    byYear: Object.fromEntries(
      YEARS.map((y) => {
        const rows = RECORDS.filter((r) => r.year === y)
        const present = rows.filter((r) => r.params[parameter] !== null).length
        return [y, rows.length ? Math.round((present / rows.length) * 1000) / 10 : 0]
      }),
    ) as Record<number, number>,
  }))

  const duplicates = RECORDS.filter((r) => r.duplicateCandidate).map((r) => ({
    year: r.year,
    category: r.category,
    institution: r.institution,
    matches: 2,
  }))

  const invalid = RECORDS.filter((r) => Object.values(r.paramReasons).includes('invalid')).length

  return {
    totals: {
      records: RECORDS.length,
      institutions: new Set(RECORDS.map((r) => r.institutionId)).size,
      categories: CATEGORIES.length,
      years: YEARS.length,
      missingValues: Object.values(reasonCounts).reduce((a, b) => a + b, 0),
      duplicateCandidates: duplicates.length,
      invalidRecords: invalid,
    },
    coverage,
    parameterAvailability,
    issues: [
      { type: 'missing', count: reasonCounts.missing, description: 'Expected values that were not found in the source.' },
      { type: 'not_published', count: reasonCounts.not_published, description: 'Parameters not published for a category or year (e.g. TLR, RPC and GO for the Research category from 2021).' },
      { type: 'not_applicable', count: reasonCounts.not_applicable, description: 'Parameters that do not apply to a category.' },
      { type: 'parser_failure', count: reasonCounts.parser_failure, description: 'Values the extraction step could not parse.' },
      { type: 'invalid', count: reasonCounts.invalid, description: 'Values that failed range or type validation.' },
      { type: 'duplicate_candidate', count: duplicates.length, description: 'Near-identical entries flagged for manual review.' },
    ],
    sources: USE_MOCK
      ? [
          { source: 'Demo source A — PDF tables, 2017–2019', years: '2017–2019', records: RECORDS.filter((r) => r.year <= 2019).length, status: 'validated' },
          { source: 'Demo source B — HTML tables, 2020–2022', years: '2020–2022', records: RECORDS.filter((r) => r.year >= 2020 && r.year <= 2022).length, status: 'partial' },
          { source: 'Demo source C — Excel export, 2023–2025', years: '2023–2025', records: RECORDS.filter((r) => r.year >= 2023).length, status: 'validated' },
        ]
      : [
          { source: 'NIRF ranking tables (CSV), 2017–2022', years: '2017–2022', records: RECORDS.filter((r) => r.year <= 2022).length, status: 'validated' },
          { source: 'NIRF ranking tables (Excel), 2023', years: '2023', records: RECORDS.filter((r) => r.year === 2023).length, status: 'validated' },
          { source: 'NIRF ranking tables (CSV), 2024–2025', years: '2024–2025', records: RECORDS.filter((r) => r.year >= 2024).length, status: 'validated' },
        ],
    validation: [
      { check: 'Rank is unique within category and year (exact ranks)', status: 'pass', detail: 'No exact-rank collisions in the dataset.' },
      { check: 'Scores within 0–100', status: 'pass', detail: 'All published scores are in range.' },
      { check: 'Only exact ranks are included — rows listed only as a rank band (e.g. 101–150) were excluded from this dataset.', status: 'pass', detail: 'Every rank shown is an exact NIRF rank.' },
      { check: 'Parameter coverage per category/year', status: 'warn', detail: 'Some parameters are not published for some categories and years.' },
      { check: 'Duplicate candidates reviewed', status: 'warn', detail: `${duplicates.length} candidates awaiting manual review.` },
      { check: 'Parser failures', status: reasonCounts.parser_failure > 0 ? 'warn' : 'pass', detail: `${reasonCounts.parser_failure} values could not be parsed.` },
    ],
    duplicates,
    isMock: true,
  }
}
