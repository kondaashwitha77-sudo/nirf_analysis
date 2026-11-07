import {
  Activity,
  BarChart3,
  BrainCircuit,
  Database,
  GitCompare,
  LayoutDashboard,
  ListChecks,
  Map as MapIcon,
  Palette,
  Radar,
  ShieldCheck,
  Sigma,
  Table2,
  TrendingUp,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  title: string
  description: string
}

export interface NavSection {
  heading: string
  items: NavItem[]
}

export const NAV: NavSection[] = [
  {
    heading: 'General',
    items: [
      { to: '/overview', label: 'Overview', icon: LayoutDashboard, title: 'Overview', description: 'A summary of the NIRF ranking dataset, 2017–2025.' },
      { to: '/ranking-trends', label: 'Ranking Trends', icon: TrendingUp, title: 'Ranking Trends', description: 'Follow ranks and scores over time. Lower rank numbers are better.' },
      { to: '/institution-comparison', label: 'Institution Comparison', icon: GitCompare, title: 'Institution Comparison', description: 'Compare institutions side by side on rank, score, and parameters.' },
      { to: '/geographic-analysis', label: 'Geographic Analysis', icon: MapIcon, title: 'Geographic Analysis', description: 'See how institutions are distributed across Indian states.' },
    ],
  },
  {
    heading: 'Analytics',
    items: [
      { to: '/statistical-analysis', label: 'Statistical Analysis', icon: Sigma, title: 'Statistical Analysis', description: 'Descriptive statistics and correlations for any metric.' },
      { to: '/distribution-analysis', label: 'Distribution Analysis', icon: BarChart3, title: 'Distribution Analysis', description: 'Histograms and box plots across categories and years.' },
      { to: '/rank-mobility', label: 'Rank Mobility', icon: Activity, title: 'Rank Mobility', description: 'Who moved up, who slipped, and who entered or left.' },
      { to: '/outlier-detection', label: 'Outlier Detection', icon: Radar, title: 'Outlier Detection', description: 'Flag unusual values using IQR, z-score, or percentile rules.' },
    ],
  },
  {
    heading: 'Advanced tools',
    items: [
      { to: '/visualization-studio', label: 'Visualization Studio', icon: Palette, title: 'Visualization Studio', description: 'Build your own chart from a safe, structured query.' },
      { to: '/ai-analyst', label: 'AI Analyst', icon: BrainCircuit, title: 'AI Analyst', description: 'Ask questions about the data in plain language.' },
      { to: '/question-explorer', label: 'Question Explorer', icon: ListChecks, title: 'Question Explorer', description: 'Run the 40 Annexure A questions one by one.' },
      { to: '/data-explorer', label: 'Data Explorer', icon: Table2, title: 'Data Explorer', description: 'Search, filter, sort, and page through the records.' },
    ],
  },
  {
    heading: 'Data management',
    items: [
      { to: '/data-quality', label: 'Data Quality', icon: ShieldCheck, title: 'Data Quality', description: 'Coverage, missing values, and validation status.' },
    ],
  },
]

export const ALL_NAV_ITEMS = NAV.flatMap((s) => s.items)
export const BRAND_ICON = Database
