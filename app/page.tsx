'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Database,
  Download,
  FileText,
  Filter,
  FolderOpen,
  LayoutDashboard,
  MessageSquareText,
  MoreHorizontal,
  PanelLeft,
  Search,
  Settings2,
  Sparkles,
  UploadCloud,
  X,
  Zap,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { businessLabels, issueToneByStatus, productGroups } from '@/lib/business-config'
import { pickDesktopFile } from '@/lib/desktop-bridge'
import { downloadBase64File } from '@/lib/download'
import type { AnalysisResponse, IssueItem } from '@/lib/types'

type NavLabel = 'Dashboard' | 'Gemini'

export default function Page() {
  const [setup, setSetup] = useState(true)
  const [business, setBusiness] = useState<'MX' | 'VD' | 'DA'>('MX')
  const [product, setProduct] = useState(productGroups.MX[0])
  const [activeNav, setActiveNav] = useState<NavLabel>('Dashboard')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All status')
  const [localPath, setLocalPath] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState<AnalysisResponse | null>(null)
  const [selectedIssue, setSelectedIssue] = useState<IssueItem | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [aiAnswer, setAiAnswer] = useState('Load a dataset to start local QA and report generation.')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [geminiLoading, setGeminiLoading] = useState(false)
  const [error, setError] = useState('')

  const issues = (result?.issues ?? []).filter((issue) => {
    const text = `${issue.id} ${issue.title} ${issue.keyword} ${issue.category}`.toLowerCase()
    const matchesSearch = text.includes(search.toLowerCase())
    const matchesStatus = status === 'All status' || issue.status === status
    return matchesSearch && matchesStatus
  })

  function showNotice(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2600)
  }

  async function chooseDesktopFile() {
    const picked = await pickDesktopFile()
    if (!picked) return
    setLocalPath(picked.path)
    setFileName(picked.name)
    setFile(null)
    showNotice('Connected a local file path. Use this mode for protected XLSX.')
  }

  function onFileSelected(nextFile: File | null) {
    setFile(nextFile)
    setLocalPath('')
    setFileName(nextFile?.name ?? '')
  }

  async function analyze() {
    setLoading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.set('business', business)
      formData.set('product', product)
      if (localPath.trim()) formData.set('localPath', localPath.trim())
      if (file) formData.set('file', file)
      const response = await fetch('/api/analyze', { method: 'POST', body: formData })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Analysis failed.')
      setResult(payload)
      setSelectedIssue(payload.issues?.[0] ?? null)
      setSetup(false)
      showNotice('Dataset analysis is complete.')
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Analysis failed.')
    } finally {
      setLoading(false)
    }
  }

  async function askAi(mode: 'qa' | 'report' = 'qa', value = question) {
    if (!result || !value.trim()) return
    setGeminiLoading(true)
    try {
      const prompt =
        mode === 'report'
          ? `${result.promptText}\n\n[request]\nCreate a concise executive markdown report.`
          : `${result.promptText}\n\n[question]\n${value}`
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || payload.hint || 'Gemini request failed.')
      setAiAnswer(payload.answer)
      setAiOpen(true)
      if (mode === 'report') {
        const blob = new Blob([payload.answer], { type: 'text/markdown;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = 'for-q-gemini-report.md'
        anchor.click()
        URL.revokeObjectURL(url)
      }
      setQuestion('')
    } catch (nextError) {
      setAiAnswer(nextError instanceof Error ? nextError.message : 'Gemini request failed.')
      setAiOpen(true)
    } finally {
      setGeminiLoading(false)
    }
  }

  if (setup) {
    return (
      <SetupScreen
        fileName={fileName}
        business={business}
        product={product}
        localPath={localPath}
        loading={loading}
        error={error}
        setLocalPath={setLocalPath}
        setBusiness={(value) => {
          setBusiness(value)
          setProduct(productGroups[value][0])
        }}
        setProduct={setProduct}
        chooseDesktopFile={chooseDesktopFile}
        onFileSelected={onFileSelected}
        analyze={analyze}
      />
    )
  }

  return (
    <main className="min-h-screen bg-background text-foreground lg:h-screen lg:overflow-hidden">
      <div className="flex min-h-screen lg:h-full">
        <aside className="hidden w-[238px] shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
          <div className="flex items-center gap-3 px-6 py-6">
            <div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
              <Zap className="size-4" fill="currentColor" />
            </div>
            <div>
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-sidebar-foreground/50">Quality workspace</p>
              <p className="text-[17px] font-semibold tracking-tight">For Q</p>
            </div>
          </div>
          <div className="px-4">
            <button onClick={() => setSetup(true)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-sidebar-primary px-3 py-2.5 text-sm font-semibold text-sidebar-primary-foreground transition hover:opacity-90">
              <UploadCloud className="size-4" />New run
            </button>
          </div>
          <nav className="mt-8 flex flex-col gap-1 px-3">
            <p className="px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/35">Workspace</p>
            <NavButton label="Dashboard" icon={LayoutDashboard} active={activeNav} setActive={setActiveNav} />
            <NavButton label="Gemini" icon={Bot} active={activeNav} setActive={(label) => { setActiveNav(label); setAiOpen(true) }} />
          </nav>
          <div className="mt-auto flex flex-col gap-1 px-3 pb-5">
            <button onClick={() => result && downloadBase64File(result.downloads.preprocessedFileName, result.downloads.preprocessedBase64, 'text/csv;charset=utf-8')} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground">
              <Download className="size-4" />Preprocessed CSV
            </button>
            <button onClick={() => result && downloadBase64File(result.downloads.promptFileName, result.downloads.promptBase64, 'text/plain;charset=utf-8')} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground">
              <FileText className="size-4" />Prompt file
            </button>
            <button className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground">
              <Settings2 className="size-4" />Runtime settings
            </button>
            <div className="mt-4 flex items-center gap-3 border-t border-sidebar-border px-2 pt-4">
              <div className="flex size-8 items-center justify-center rounded-full bg-sidebar-primary/15 font-mono text-xs font-bold text-sidebar-primary">FQ</div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">For Q Desktop</p>
                <p className="truncate text-[11px] text-sidebar-foreground/40">Local analysis workspace</p>
              </div>
              <MoreHorizontal className="ml-auto size-4 text-sidebar-foreground/35" />
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-border bg-card px-5 md:px-8">
            <div className="flex items-center gap-3">
              <button className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden">
                <PanelLeft className="size-5" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-semibold tracking-tight">{activeNav}</h1>
                  <span className="rounded-md bg-secondary px-2 py-1 font-mono text-[10px] text-muted-foreground">LOCAL DESKTOP</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{businessLabels[business]} / {product} / {result?.geminiHint}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setAiOpen(true)} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold transition hover:bg-muted">
                <Bot className="size-4 text-primary" />Gemini
              </button>
              <button onClick={() => result && downloadBase64File(result.downloads.zipFileName, result.downloads.zipBase64, 'application/zip')} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90">
                <Download className="size-4" /><span className="hidden sm:inline">Download bundle</span>
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-auto bg-background">
            <div className="mx-auto max-w-[1440px] p-5 md:p-8">
              <div className="mb-7 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono text-primary">DATASET</span>
                    <span>/</span>
                    <span>Live source</span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">Ready</span>
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight md:text-[30px]">{business} / {product} quality view</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{result?.sourceLabel} / {result?.dateRangeLabel} / <span className="font-medium text-foreground">{result?.rowCount.toLocaleString()} rows</span></p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-lg border border-border bg-card p-1 shadow-sm">
                    {(['MX', 'VD', 'DA'] as const).map((item) => (
                      <button key={item} onClick={() => { setBusiness(item); setProduct(productGroups[item][0]) }} className={`rounded-md px-3 py-1.5 font-mono text-xs font-semibold transition ${business === item ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                        {item}
                      </button>
                    ))}
                  </div>
                  <button className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm hover:text-foreground">
                    <CalendarDays className="size-4" />{result?.dateRangeLabel} <ChevronDown className="size-3" />
                  </button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <KpiCard label="Close ratio" value={`${result?.kpis.closeRatio.toFixed(1)}%`} detail={`${result?.kpis.closeCount.toLocaleString()} / ${result?.kpis.totalCount.toLocaleString()}`} trend={result?.signals[2]?.value ?? '-'} direction={result && result.kpis.closeRatio >= 90 ? 'up' : 'down'} icon={Check} accent="primary" />
                <KpiCard label="A always" value={`${result?.kpis.openCountA.toLocaleString()} cases`} detail={`Active ${result?.kpis.activeCountA.toLocaleString()}`} trend={`-${Math.max((result?.kpis.activeCountA ?? 0) - (result?.kpis.openCountA ?? 0), 0)}`} direction="down" icon={AlertTriangle} accent="amber" />
                <KpiCard label="System issues" value={`${result?.kpis.openCountSystem.toLocaleString()} cases`} detail={`Active ${result?.kpis.activeCountSystem.toLocaleString()}`} trend={result?.signals[0]?.value ?? '+0'} direction="up" icon={Database} accent="rose" />
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.8fr)]">
                <section className="rounded-xl border border-border bg-card p-5 shadow-sm md:p-6">
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">Keyword trend</h3>
                        <CircleHelp className="size-3.5 text-muted-foreground" />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">Business-specific trend groups from the loaded dataset</p>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      {result?.trendSeries.map((series, index) => (
                        <span key={series} className="flex items-center gap-1.5">
                          <i className={`size-2 rounded-full ${index === 0 ? 'bg-primary' : index === 1 ? 'bg-chart-2' : 'bg-chart-3'}`} />
                          {series}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="h-[245px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={result?.trend ?? []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="seriesA" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="oklch(0.54 0.22 264)" stopOpacity={0.16} />
                            <stop offset="100%" stopColor="oklch(0.54 0.22 264)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke="oklch(0.91 0.015 260)" strokeDasharray="3 3" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'oklch(0.55 0.02 260)', fontSize: 11 }} dy={8} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'oklch(0.55 0.02 260)', fontSize: 11 }} />
                        <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid oklch(0.9 0.02 260)', boxShadow: '0 4px 16px oklch(0.2 0 0 / 0.08)', fontSize: 12 }} />
                        {result?.trendSeries.map((series, index) => (
                          <Area
                            key={series}
                            type="monotone"
                            dataKey={series}
                            name={series}
                            stroke={index === 0 ? 'oklch(0.54 0.22 264)' : index === 1 ? 'oklch(0.63 0.13 175)' : 'oklch(0.63 0.14 75)'}
                            strokeWidth={index === 0 ? 2.5 : 2}
                            fill={index === 0 ? 'url(#seriesA)' : 'none'}
                          />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="rounded-xl border border-border bg-card p-5 shadow-sm md:p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">Auto signals</h3>
                      <p className="mt-1 text-xs text-muted-foreground">Branch-aware highlights for fast triage</p>
                    </div>
                    <Sparkles className="size-4 text-primary" />
                  </div>
                  <div className="mt-6 flex flex-col gap-5">
                    {result?.signals.map((signal) => <Signal key={signal.title} {...signal} />)}
                  </div>
                  <button onClick={() => setAiOpen(true)} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-xs font-semibold transition hover:bg-muted">
                    <MessageSquareText className="size-4 text-primary" />Ask AI with current context
                  </button>
                </section>
              </div>

              <section className="mt-4 rounded-xl border border-border bg-card shadow-sm">
                <div className="flex flex-col gap-4 border-b border-border p-5 md:flex-row md:items-center md:justify-between md:px-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">Issue table</h3>
                      <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{issues.length} ISSUES</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Search and inspect filtered issues from the desktop analysis flow</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2">
                      <Search className="size-3.5 text-muted-foreground" />
                      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search issue" className="w-[150px] bg-transparent text-xs outline-none placeholder:text-muted-foreground" />
                    </div>
                    <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-xs text-muted-foreground outline-none">
                      <option>All status</option>
                      {[...new Set(result?.issues.map((issue) => issue.status) ?? [])].map((item) => <option key={item}>{item}</option>)}
                    </select>
                    <button className="rounded-lg border border-input bg-background p-2 text-muted-foreground hover:text-foreground">
                      <Filter className="size-4" />
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-6 py-3 font-mono font-medium">Issue</th>
                        <th className="px-3 py-3 font-mono font-medium">Category</th>
                        <th className="px-3 py-3 font-mono font-medium">Grade</th>
                        <th className="px-3 py-3 font-mono font-medium">Count</th>
                        <th className="px-3 py-3 font-mono font-medium">Status</th>
                        <th className="px-6 py-3 text-right font-mono font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {issues.map((issue) => (
                        <tr key={`${issue.id}-${issue.category}`} onClick={() => setSelectedIssue(issue)} className="cursor-pointer transition hover:bg-muted/40">
                          <td className="px-6 py-4">
                            <p className="font-mono text-[10px] text-primary">{issue.id}</p>
                            <p className="mt-1 font-medium">{issue.title}</p>
                          </td>
                          <td className="px-3 py-4 text-muted-foreground">{issue.keyword}</td>
                          <td className="px-3 py-4">
                            <span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${issue.grade.includes('A') ? 'bg-rose-50 text-rose-700' : 'bg-secondary text-muted-foreground'}`}>{issue.grade}</span>
                          </td>
                          <td className="px-3 py-4 font-mono">{issue.count}</td>
                          <td className={`px-3 py-4 font-medium ${issueToneByStatus(issue.status) === 'critical' ? 'text-rose-700' : issueToneByStatus(issue.status) === 'warning' ? 'text-amber-700' : 'text-emerald-700'}`}>{issue.status}</td>
                          <td className="px-6 py-4 text-right font-mono text-muted-foreground">{issue.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        </section>

        {selectedIssue && <IssueDetail issue={selectedIssue} close={() => setSelectedIssue(null)} openAi={() => { setQuestion(`Explain root cause and next action for ${selectedIssue.id}.`); setAiOpen(true) }} />}
      </div>

      {aiOpen && (
        <AiPanel
          answer={aiAnswer}
          question={question}
          loading={geminiLoading}
          setQuestion={setQuestion}
          askAi={() => askAi('qa')}
          createReport={() => askAi('report', 'Generate executive report')}
          close={() => setAiOpen(false)}
        />
      )}
      {notice && <div className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-foreground px-4 py-3 text-xs font-medium text-background shadow-xl"><Check className="size-4 text-emerald-400" />{notice}</div>}
    </main>
  )
}

function SetupScreen({
  fileName,
  business,
  product,
  localPath,
  loading,
  error,
  setBusiness,
  setProduct,
  setLocalPath,
  chooseDesktopFile,
  onFileSelected,
  analyze,
}: {
  fileName: string
  business: 'MX' | 'VD' | 'DA'
  product: string
  localPath: string
  loading: boolean
  error: string
  setBusiness: (value: 'MX' | 'VD' | 'DA') => void
  setProduct: (value: string) => void
  setLocalPath: (value: string) => void
  chooseDesktopFile: () => Promise<void>
  onFileSelected: (nextFile: File | null) => void
  analyze: () => Promise<void>
}) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1180px] flex-col px-6 py-8 md:px-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-sidebar text-sidebar-primary">
              <Zap className="size-4" fill="currentColor" />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Quality workspace</p>
              <h1 className="text-lg font-semibold">For Q</h1>
            </div>
          </div>
          <span className="rounded-full border border-border bg-card px-3 py-1.5 font-mono text-[10px] text-muted-foreground">v0.2 DESKTOP FLOW</span>
        </header>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[760px]">
            <div className="mb-10 text-center">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-primary">Start a quality review</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Find the signal<br /><span className="text-primary">inside the data</span></h2>
              <p className="mx-auto mt-4 max-w-[500px] text-sm leading-6 text-muted-foreground">Load a source file, pick the branch and product group, then run preprocessing, KPI calculation, issue selection, and prompt packaging in one flow.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-2xl border border-border bg-card p-6">
                <button onClick={() => void chooseDesktopFile()} className={`group flex min-h-[180px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed p-7 text-center transition ${fileName ? 'border-primary/50 bg-primary/5' : 'border-border bg-card hover:border-primary/50 hover:bg-primary/5'}`}>
                  <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <FolderOpen className="size-5" />
                  </div>
                  <p className="font-semibold">{fileName || 'Select a source file'}</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">CSV, XLSX, and JSON are supported.<br />Use desktop path mode for protected XLSX.</p>
                  {fileName && <span className="mt-4 rounded-full bg-emerald-50 px-3 py-1.5 font-mono text-[10px] text-emerald-700">FILE READY</span>}
                </button>
                <div className="mt-4 rounded-xl border border-border/80 bg-background px-4 py-3">
                  <p className="mb-2 text-[11px] font-medium text-muted-foreground">Browser upload</p>
                  <input type="file" accept=".csv,.xlsx,.json" onChange={(event) => onFileSelected(event.target.files?.[0] ?? null)} className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary-foreground" />
                </div>
                <div className="mt-3 rounded-xl border border-border/80 bg-background px-4 py-3">
                  <p className="mb-2 text-[11px] font-medium text-muted-foreground">Direct path</p>
                  <input value={localPath} onChange={(event) => { setLocalPath(event.target.value); if (event.target.value.trim()) onFileSelected(null) }} placeholder="C:\\data\\forq.xlsx" className="w-full rounded-lg border border-input bg-card px-3 py-2 text-xs outline-none" />
                </div>
                {localPath && <div className="mt-3 rounded-xl bg-muted/70 px-4 py-3 text-xs text-muted-foreground">Current path: {localPath}</div>}
              </div>

              <div className="rounded-2xl border border-border bg-card p-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">01 / Business</p>
                <h3 className="mt-2 font-semibold">Choose branch</h3>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {(['MX', 'VD', 'DA'] as const).map((item) => (
                    <button key={item} onClick={() => setBusiness(item)} className={`rounded-xl border px-3 py-3 font-mono text-xs font-semibold transition ${business === item ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                      {item}
                    </button>
                  ))}
                </div>
                <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">02 / Product group</p>
                <h3 className="mt-2 font-semibold">Choose product</h3>
                <select value={product} onChange={(event) => setProduct(event.target.value)} className="mt-4 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring">
                  {productGroups[business].map((item) => <option key={item}>{item}</option>)}
                </select>
                <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                  Keyword groups, issue triage, and prompt content split by branch and product group.
                </div>
              </div>
            </div>

            {error && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

            <div className="mt-6 flex items-center justify-between rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <FileText className="size-4 text-primary" />
                <span>{fileName ? `${business} / ${product} is ready for analysis` : 'Pick a file to enable the analysis run.'}</span>
              </div>
              <button onClick={() => void analyze()} disabled={loading || !fileName} className="rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                {loading ? 'Running...' : 'Start analysis'} <ArrowUpRight className="ml-1 inline size-3.5" />
              </button>
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-border pt-5 text-[11px] text-muted-foreground">
          <span>For Q / Quality Intelligence Workspace</span>
          <span>Update-ready / Git raw sync ready</span>
        </footer>
      </div>
    </main>
  )
}

function NavButton({ label, icon: Icon, active, setActive }: { label: NavLabel; icon: typeof LayoutDashboard; active: NavLabel; setActive: (label: NavLabel) => void }) {
  return <button onClick={() => setActive(label)} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${active === label ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground' : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'}`}><Icon className="size-4" />{label}</button>
}

function KpiCard({ label, value, detail, trend, direction, icon: Icon, accent }: { label: string; value: string; detail: string; trend: string; direction: 'up' | 'down'; icon: typeof Check; accent: string }) {
  return <div className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div><div className={`rounded-lg p-2 ${accent === 'primary' ? 'bg-primary/10 text-primary' : accent === 'amber' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}><Icon className="size-4" /></div></div><div className={`mt-5 flex items-center gap-1 text-xs font-semibold ${direction === 'up' ? 'text-emerald-700' : 'text-amber-700'}`}>{direction === 'up' ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}{trend}<span className="font-normal text-muted-foreground">vs recent</span></div></div>
}

function Signal({ title, description, value, tone }: { title: string; description: string; value: string; tone: string }) {
  return <div className="flex items-center justify-between"><div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></div><span className={`font-mono text-sm font-semibold ${tone === 'rose' ? 'text-rose-600' : tone === 'mint' ? 'text-emerald-600' : 'text-amber-600'}`}>{value}</span></div>
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted/60 p-3"><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-1 text-xs font-semibold">{value || '-'}</p></div>
}

function IssueDetail({ issue, close, openAi }: { issue: IssueItem; close: () => void; openAi: () => void }) {
  return <aside className="fixed inset-y-0 right-0 z-20 flex w-full max-w-[390px] flex-col border-l border-border bg-card shadow-2xl sm:w-[390px]"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><p className="font-mono text-[10px] text-primary">ISSUE DETAIL</p><p className="mt-1 text-sm font-semibold">{issue.id}</p></div><button onClick={close} className="rounded-md p-2 text-muted-foreground hover:bg-muted"><X className="size-4" /></button></div><div className="flex-1 overflow-auto p-5"><div className={`mb-5 flex items-center justify-between rounded-xl p-4 ${issue.tone === 'critical' ? 'bg-rose-50' : issue.tone === 'warning' ? 'bg-amber-50' : 'bg-emerald-50'}`}><div><p className="text-xs font-medium text-muted-foreground">Current status</p><p className={`mt-1 text-sm font-semibold ${issue.tone === 'critical' ? 'text-rose-700' : issue.tone === 'warning' ? 'text-amber-700' : 'text-emerald-700'}`}>{issue.status}</p></div><AlertTriangle className="size-4 text-rose-600" /></div><h3 className="text-xl font-semibold leading-snug tracking-tight">{issue.title}</h3><div className="mt-5 grid grid-cols-2 gap-3"><Detail label="Category" value={issue.category} /><Detail label="Grade" value={issue.grade} /><Detail label="Count" value={`${issue.count}`} /><Detail label="Date" value={issue.date} /></div><div className="my-6 border-t border-border" /><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Summary</p><div className="mt-3 rounded-lg bg-muted/50 p-4 text-sm leading-relaxed text-muted-foreground">{issue.detail || 'No detail text was provided.'}</div><div className="mt-4 grid gap-3"><Detail label="Cause" value={issue.cause || 'No cause text'} /><Detail label="Action" value={issue.action || 'No action text'} /></div><button onClick={openAi} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-xs font-semibold text-primary-foreground"><Bot className="size-4" /> Ask Gemini about this issue</button></div></aside>
}

function AiPanel({ answer, question, loading, setQuestion, askAi, createReport, close }: { answer: string; question: string; loading: boolean; setQuestion: (value: string) => void; askAi: () => void; createReport: () => void; close: () => void }) {
  return <div className="fixed inset-0 z-30 flex items-end justify-end bg-slate-900/20 p-4 backdrop-blur-[2px] md:p-6"><div className="flex h-[min(670px,calc(100vh-32px))] w-full max-w-[430px] flex-col rounded-2xl border border-border bg-card shadow-2xl"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div className="flex items-center gap-3"><div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bot className="size-4" /></div><div><p className="text-sm font-semibold">Gemini analysis assistant</p><p className="font-mono text-[10px] text-emerald-600">READY / LOCAL CONTEXT</p></div></div><button onClick={close} className="rounded-md p-2 text-muted-foreground hover:bg-muted"><X className="size-4" /></button></div><div className="flex-1 overflow-auto p-5"><div className="rounded-xl rounded-tl-sm bg-muted p-4 text-sm leading-relaxed">Use the current analysis context to ask questions or create a report draft.<div className="mt-3 flex flex-wrap gap-2"><button onClick={() => { setQuestion('List the issues that should be resolved first.'); askAi() }} className="rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] text-muted-foreground">Priority issues</button><button onClick={createReport} className="rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] text-muted-foreground">Executive report</button></div></div><div className="mt-4 ml-8 rounded-xl rounded-tr-sm bg-primary p-4 text-sm leading-relaxed text-primary-foreground">{loading ? 'Gemini is generating a response...' : answer}</div></div><div className="border-t border-border p-4"><div className="flex items-end gap-2 rounded-xl border border-input bg-background p-2"><textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); askAi() } }} placeholder="Ask about the analyzed dataset" rows={2} className="min-h-12 flex-1 resize-none bg-transparent p-1 text-sm outline-none" /><button onClick={askAi} className="rounded-lg bg-primary p-2 text-primary-foreground"><ArrowUpRight className="size-4" /></button></div></div></div></div>
}
