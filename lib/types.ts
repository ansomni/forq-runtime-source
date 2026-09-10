export type BusinessCode = 'MX' | 'VD' | 'DA'

export type ProductGroupMap = Record<BusinessCode, string[]>

export type TrendPoint = {
  date: string
  [key: string]: string | number
}

export type KpiSummary = {
  closeRatio: number
  closeCount: number
  totalCount: number
  openCountA: number
  activeCountA: number
  openCountSystem: number
  activeCountSystem: number
}

export type SignalItem = {
  title: string
  description: string
  value: string
  tone: 'rose' | 'amber' | 'mint'
}

export type IssueItem = {
  id: string
  title: string
  keyword: string
  grade: string
  status: string
  date: string
  count: number
  tone: 'critical' | 'warning' | 'success'
  category: string
  detail?: string
  cause?: string
  action?: string
}

export type AnalysisDownloads = {
  zipFileName: string
  zipBase64: string
  promptFileName: string
  promptBase64: string
  preprocessedFileName: string
  preprocessedBase64: string
}

export type GeminiResult = {
  answer: string
  reportMarkdown?: string
  reportHtml?: string
}

export type AnalysisResponse = {
  business: BusinessCode
  product: string
  sourceLabel: string
  rowCount: number
  dateRangeLabel: string
  kpis: KpiSummary
  signals: SignalItem[]
  trendSeries: string[]
  trend: TrendPoint[]
  issues: IssueItem[]
  categoryCounts: Record<string, number>
  promptText: string
  downloads: AnalysisDownloads
  geminiReady: boolean
  geminiHint: string
  keywordOptions: string[]
}
