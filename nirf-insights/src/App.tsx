import { lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { GlobalFiltersProvider } from './context/GlobalFilters'

const Overview = lazy(() => import('./pages/Overview'))
const RankingTrends = lazy(() => import('./pages/RankingTrends'))
const InstitutionComparison = lazy(() => import('./pages/InstitutionComparison'))
const GeographicAnalysis = lazy(() => import('./pages/GeographicAnalysis'))
const StatisticalAnalysis = lazy(() => import('./pages/StatisticalAnalysis'))
const DistributionAnalysis = lazy(() => import('./pages/DistributionAnalysis'))
const RankMobility = lazy(() => import('./pages/RankMobility'))
const OutlierDetection = lazy(() => import('./pages/OutlierDetection'))
const VisualizationStudio = lazy(() => import('./pages/VisualizationStudio'))
const AIAnalyst = lazy(() => import('./pages/AIAnalyst'))
const QuestionExplorer = lazy(() => import('./pages/QuestionExplorer'))
const DataExplorer = lazy(() => import('./pages/DataExplorer'))
const DataQuality = lazy(() => import('./pages/DataQuality'))
const NotFound = lazy(() => import('./pages/NotFound'))

export default function App() {
  return (
    <GlobalFiltersProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<Overview />} />
            <Route path="/ranking-trends" element={<RankingTrends />} />
            <Route path="/institution-comparison" element={<InstitutionComparison />} />
            <Route path="/geographic-analysis" element={<GeographicAnalysis />} />
            <Route path="/statistical-analysis" element={<StatisticalAnalysis />} />
            <Route path="/distribution-analysis" element={<DistributionAnalysis />} />
            <Route path="/rank-mobility" element={<RankMobility />} />
            <Route path="/outlier-detection" element={<OutlierDetection />} />
            <Route path="/visualization-studio" element={<VisualizationStudio />} />
            <Route path="/ai-analyst" element={<AIAnalyst />} />
            <Route path="/question-explorer" element={<QuestionExplorer />} />
            <Route path="/data-explorer" element={<DataExplorer />} />
            <Route path="/data-quality" element={<DataQuality />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </GlobalFiltersProvider>
  )
}
