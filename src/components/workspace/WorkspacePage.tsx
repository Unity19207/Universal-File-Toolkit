import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { Card } from '../common/Card'
import { downloadArtifact } from '../../core/files/downloads'
import { executeToolJob } from '../../core/jobs/execute-tool-job'
import { collectValidationSummary, useToolkitStore } from '../../core/jobs/toolkit-store'
import { getToolById, toolRegistry } from '../../core/plugins/registry'
import { validateFiles } from '../../core/files/validation'
import { formatBytes } from '../../core/utils/format'
import { Loader, Skeleton } from '../common/Loader'
import { useToast } from '../../app/providers/ToastProvider'
import { Modal } from '../common/Modal'
import { CsvTablePreview } from './CsvTablePreview'

function getFileExt(filename: string): string {
  return filename.split('.').pop()?.slice(0, 4).toUpperCase() ?? 'FILE'
}

export function WorkspacePage() {
  const { toolId = '' } = useParams()
  const tool = getToolById(toolId)
  const session = useToolkitStore((state) => state.sessions[toolId])
  const setInputs = useToolkitStore((state) => state.setInputs)
  const removeInput = useToolkitStore((state) => state.removeInput)
  const rememberTool = useToolkitStore((state) => state.rememberTool)
  const { pushToast } = useToast()

  const [module, setModule] = useState<Awaited<ReturnType<NonNullable<typeof tool>['load']>> | null>(null)
  const [options, setOptions] = useState<unknown>(null)
  const [issues, setIssues] = useState<string[]>([])
  const [pastedInput, setPastedInput] = useState('')
  const [showUploadGuide, setShowUploadGuide] = useState(false)
  const [copyLabel, setCopyLabel] = useState('Copy output')
  const progressRef = useRef<HTMLDivElement | null>(null)
  const outputRef = useRef<HTMLDivElement | null>(null)

  const isNoFileTool = tool?.requiresFile === false || (!tool?.accepts?.length && tool?.maxFileSize === 0)
  const capability = useMemo(() => tool?.capabilities(), [tool])

  useEffect(() => {
    if (!tool) return
    rememberTool(tool.id)
    tool.load().then((loaded) => {
      setModule(loaded)
      setOptions(loaded.defaultOptions)
    })
  }, [rememberTool, tool])

  const applyFiles = (acceptedFiles: File[], source: 'drop' | 'paste' | 'typed') => {
    if (!tool) return
    const nextIssues = collectValidationSummary(validateFiles(acceptedFiles, tool))
    setIssues(nextIssues)
    if (nextIssues.length === 0) {
      setInputs(tool.id, acceptedFiles)
      if (source === 'paste') pushToast('Clipboard file imported.', 'info')
      if (source === 'typed') pushToast('Pasted text attached as input.', 'info')
    }
  }

  useEffect(() => {
    if (!tool) return
    const onPaste = (event: ClipboardEvent) => {
      const clipboardFiles = Array.from(event.clipboardData?.files ?? [])
      if (clipboardFiles.length === 0) return
      event.preventDefault()
      applyFiles(clipboardFiles, 'paste')
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [tool, pushToast])

  const usePastedContent = () => {
    if (!tool || !pastedInput.trim()) return
    const file = new File([pastedInput], `${tool.id}-pasted-input.txt`, { type: 'text/plain' })
    applyFiles([file], 'typed')
  }

  const copyOutput = async () => {
    const text = session?.job.result?.preview.copyText
    if (!text) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      pushToast('Output copied to clipboard.', 'positive')
    } catch {
      pushToast('Clipboard write failed — try downloading instead.', 'negative')
    }
  }

  const handleCopyOutputBlob = async () => {
    try {
      const blob = session?.job.result?.outputs?.[0]?.blob
      if (!blob) return
      const text = await blob.text()
      if (text) {
        await navigator.clipboard.writeText(text)
        setCopyLabel('Copied!')
        setTimeout(() => setCopyLabel('Copy output'), 2000)
      }
    } catch (e) {
      console.error('Copy failed', e)
    }
  }


  const runProcessing = async () => {
    if (!tool || options === null) return
    progressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    await executeToolJob(tool, options)
    const updated = useToolkitStore.getState().sessions[tool.id]?.job
    if (updated?.status === 'succeeded') pushToast('Processing complete.', 'positive')
    if (updated?.status === 'failed') pushToast(updated.error || 'Processing failed.', 'negative')
  }

  const dropzone = useDropzone({
    onDrop: (accepted) => applyFiles(accepted, 'drop'),
    multiple: tool?.supportsBatch ?? false,
  })

  useEffect(() => {
    if (session?.job.status === 'succeeded') {
      outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [session?.job.status])

  if (!tool) return <Navigate to="/" replace />

  const inputCount = session?.inputs.length ?? 0
  const isRunning = session?.job.status === 'running'
  const hasResult = Boolean(session?.job.result)
  const showProgress = (session?.job.status ?? 'idle') !== 'idle'
  const status = session?.job.status ?? 'idle'
  const activeStep = hasResult || isRunning ? 3 : (inputCount > 0 || isNoFileTool ? 2 : 1)

  const outputMime = session?.job.result?.outputs?.[0]?.type ?? ''
  const canCopyOutput = hasResult && !outputMime.startsWith('image/')
    && !outputMime.startsWith('video/')
    && !outputMime.startsWith('audio/')
    && !outputMime.includes('vnd.')

  function formatAcceptedTypes(accepts: string[]): string {
    const typeMap: Record<string, string> = {
      'text/csv': 'CSV',
      'text/plain': 'TXT',
      'application/json': 'JSON',
      'application/pdf': 'PDF',
      'image/jpeg': 'JPG',
      'image/png': 'PNG',
      'image/webp': 'WEBP',
      'image/gif': 'GIF',
      'video/mp4': 'MP4',
      'audio/mpeg': 'MP3',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
      'application/vnd.ms-excel': 'XLS',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
      'application/xml': 'XML',
      'text/xml': 'XML',
      'text/html': 'HTML',
      'text/markdown': 'MD',
      'application/zip': 'ZIP',
    }
    if (!accepts || accepts.length === 0) return 'Any file'
    const names = accepts
      .map(t => typeMap[t.toLowerCase()] ?? t.split('/')[1]?.toUpperCase() ?? t)
      .filter((v, i, arr) => arr.indexOf(v) === i)  // deduplicate
    if (names.length > 5) return names.slice(0, 5).join(', ') + ' + more'
    return names.join(', ')
  }

  return (
    <main className="workspace-page">
      {/* ── TOOL HERO ── */}
      <div className="workspace-header">
        <div className="tool-breadcrumb">
          <Link to="/">dashboard</Link>
          <span className="bc-sep">/</span>
          <Link to={`/category/${tool.category}`}>{tool.category}</Link>
          <span className="bc-sep">/</span>
          <span className="bc-current">{tool.name.toLowerCase()}</span>
        </div>

        <h1 className="workspace-title">{tool.name}</h1>
        <p className="workspace-desc">{tool.description}</p>

        <div className="workspace-badges">
          <span className="badge-offline">BROWSER-ONLY</span>
          <button className="badge-docs" onClick={() => setShowUploadGuide(true)}>Documentation</button>
        </div>
      </div>

      {/* ── STEPS NAVIGATION ── */}
      <div className="step-bar">
        {['Input', 'Options', 'Output'].map((label, idx) => {
          const stepNum = idx + 1
          const s = stepNum < activeStep ? 'done' : stepNum === activeStep ? 'active' : 'future'
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', flex: idx < 2 ? 1 : 'none' }}>
              <div className={`step-item step-${s}`}>
                <span className="step-num">{stepNum}</span>
                <span className="step-dot">·</span>
                <span className="step-label">{label.toUpperCase()}</span>
                {s === 'done' && <span className="step-check">✓</span>}
              </div>
              {idx < 2 && <div className="step-connector" />}
            </div>
          )
        })}
      </div>

      {capability?.supported === false && (
        <Card className="mb-8 border-[var(--negative)] border-opacity-30 bg-[var(--negative)] bg-opacity-5">
          <div className="flex items-start gap-4 p-4 text-[var(--negative)]">
            <svg className="shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider">Unsupported browser</h3>
              <p className="mt-1 text-xs opacity-80">{capability.reason}</p>
            </div>
          </div>
        </Card>
      )}

      {isNoFileTool ? (
        <div className="workspace-no-file">
          <div className="no-file-info-banner">
            <span className="no-file-info-icon">i</span>
            <span>This tool generates output from your settings — no file upload needed.</span>
          </div>

          <div className="options-panel-card">
            <div className="options-panel-header">Configuration</div>
            <div className="options-panel-body">
              {issues.length > 0 && (
                <div className="mb-6 p-4 rounded-sm border border-[var(--negative)] border-opacity-20 bg-[var(--negative)] bg-opacity-5 text-[11px] text-[var(--negative)] font-medium">
                  {issues.map(i => <div key={i}>• {i}</div>)}
                </div>
              )}
              <div className="tool-options-form">
                {module && options !== null ? (
                  <module.OptionsComponent options={options as never} onChange={setOptions} inputs={session?.inputs} />
                ) : (
                  <div className="space-y-4"><Skeleton className="h-10 w-full r-sm" /><Loader label="Loading engine..." /></div>
                )}
              </div>
            </div>
          </div>

          <button className="process-btn" onClick={runProcessing} disabled={isRunning || (inputCount === 0 && tool.requiresFile !== false) || !module}>
            <span style={{ flex: 1, textAlign: 'center' }}>{isRunning ? 'Processing...' : 'GENERATE'}</span>
            <span style={{
              fontSize: '10px', opacity: 0.55,
              background: 'rgba(255,255,255,0.15)',
              padding: '2px 7px', borderRadius: '3px'
            }}>⌘ ↵</span>
          </button>

          <div ref={progressRef} className="mt-10">
            {showProgress && (
              status === 'succeeded' ? (
                <div className="job-success-banner">
                  <div className="job-success-dot" />
                  <span className="job-success-text">Task completed successfully</span>
                </div>
              ) : (
                <div className={`job-status-bar job-status-${status}`}>
                  <span className="job-status-text">{status === 'running' ? session?.job.progress.message : 'Failed'}</span>
                </div>
              )
            )}
          </div>
        </div>
      ) : (
        <div className="workspace-layout">
          <div className="workspace-col-left">
            <div className="workspace-col-left-card">
              <div {...dropzone.getRootProps()} className={`drop-zone ${dropzone.isDragActive ? 'drag-over' : ''}`}>
                <input {...dropzone.getInputProps()} />
                <svg className="drop-zone-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                <div className="drop-zone-main">Drop files here, click to browse, or paste</div>
                <div className="drop-zone-meta">{formatAcceptedTypes(tool.accepts)} · MAX 25 MB</div>
                <div className="drop-zone-privacy">FILES STAY ON THIS DEVICE ONLY</div>
              </div>
              <div className="selected-files-section">
                <div className="selected-files-header">
                  <span className="selected-files-title">Selected files</span>
                  {inputCount > 0 && (
                    <button className="purge-btn" onClick={() => setInputs(tool.id, [])}>Purge all</button>
                  )}
                </div>
                {inputCount === 0 ? (
                  <div className="files-empty-state">
                    <svg className="files-empty-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                    <div className="files-empty-text">Drop a file above to get started</div>
                    <div className="files-empty-sub">Your files stay in browser memory and are never uploaded</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {session?.inputs.map((file) => (
                      <div key={file.id} className="file-item">
                        <div className="file-item-icon">{getFileExt(file.name)}</div>
                        <div className="file-item-info">
                          <div className="file-item-name" title={file.name}>{file.name}</div>
                          <div className="file-item-size">{formatBytes(file.size)}</div>
                        </div>
                        <button className="file-item-delete" onClick={() => removeInput(tool.id, file.id)}>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="workspace-col-right">

            {/* 1. Configuration options */}
            <div className="options-panel-card">
              <div className="options-panel-header">Configuration</div>
              <div className="options-panel-body">
                {issues.length > 0 && (
                  <div className="mb-6 p-4 rounded-sm border border-[var(--negative)] border-opacity-20 bg-[var(--negative)] bg-opacity-5 text-[11px] text-[var(--negative)] font-medium">
                    {issues.map(i => <div key={i}>• {i}</div>)}
                  </div>
                )}
                <div className="tool-options-form">
                  {module && options !== null ? (
                    <module.OptionsComponent options={options as never} onChange={setOptions} inputs={session?.inputs} />
                  ) : (
                    <div className="space-y-4"><Skeleton className="h-10 w-full r-sm" /><Loader label="Loading engine..." /></div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Source override — before process button */}
            {tool.supportsPaste && (
              <div className="source-card">
                <div className="source-card-header">
                  <div className={`source-card-dot${!pastedInput ? ' empty' : ''}`} />
                  <span className="source-card-title">Source Override</span>
                  <span className="source-card-badge">Paste text instead of file</span>
                </div>
                <textarea
                  value={pastedInput}
                  onChange={(e) => setPastedInput(e.target.value)}
                  placeholder={`Paste raw CSV, JSON, or plain text here...\n\ne.g.\nid,name,email\n1,Alice,alice@example.com`}
                />
                <div className="source-card-footer">
                  <span className="source-card-status">
                    {pastedInput.trim() ? `${pastedInput.trim().split('\n').length} lines ready` : 'No source applied'}
                  </span>
                  <div className="source-card-actions">
                    <button className="source-clear-btn" onClick={() => setPastedInput('')} disabled={!pastedInput}>Clear</button>
                    <button className="source-apply-btn" onClick={usePastedContent} disabled={!pastedInput.trim()}>Apply source</button>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Process button — always last input element */}
            <button className="process-btn" onClick={runProcessing} disabled={isRunning || (inputCount === 0 && tool.requiresFile !== false) || !module}>
              <span style={{ flex: 1, textAlign: 'center' }}>{isRunning ? 'Processing...' : 'PROCESS FILES'}</span>
              <span style={{
                fontSize: '10px', opacity: 0.55,
                background: 'rgba(255,255,255,0.15)',
                padding: '2px 7px', borderRadius: '3px'
              }}>⌘ ↵</span>
            </button>

            {!isNoFileTool && (
              <div style={{
                textAlign: 'center', fontSize: '10px',
                letterSpacing: '0.08em', color: 'var(--text-muted)',
                textTransform: 'uppercase', marginTop: '8px'
              }}>
                Output will appear below after processing
              </div>
            )}

            {/* 4. Status bar after button */}
            <div ref={progressRef}>
              {showProgress && (
                status === 'succeeded' ? (
                  <div className="job-success-banner">
                    <div className="job-success-dot" />
                    <span className="job-success-text">Task completed successfully</span>
                  </div>
                ) : (
                  <div className={`job-status-bar job-status-${status}`}>
                    <span className="job-status-text">{status === 'running' ? session?.job.progress.message : 'Failed'}</span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* JOB OUTPUT */}
      <div ref={outputRef} style={{ width: '100%', marginTop: '48px', marginBottom: '80px', display: hasResult ? 'block' : 'none' }}>
        <div className="output-panel-card">
          {/* Header — same visual style as Configuration card */}
          <div className="output-panel-header">
            <span>Preview &amp; output</span>
            <div className="output-panel-actions">
              {session?.job.result?.preview.copyText ? (
                <button className="output-btn output-btn-secondary" onClick={copyOutput}>Copy output</button>
              ) : canCopyOutput && (
                <button className="output-btn output-btn-secondary" onClick={handleCopyOutputBlob}>{copyLabel}</button>
              )}
              {session?.job.result?.outputs?.[0] && (
                <button className="output-btn output-btn-primary" onClick={() => downloadArtifact(session.job.result!.outputs[0])}>Download final</button>
              )}
            </div>
          </div>

          {hasResult && (
            <div className="output-panel-body">
              {/* Title + summary */}
              <div className="output-result-title">{session!.job.result!.preview.title}</div>
              {session!.job.result!.preview.summary && (
                <div className="output-result-summary">{session!.job.result!.preview.summary}</div>
              )}

              {/* Preview content */}
              {session!.job.result!.preview.textContent ? (
                session!.job.result!.outputs?.[0]?.type === 'text/csv' ? (
                  <div className="output-preview-block overflow-hidden">
                    <CsvTablePreview csvText={session!.job.result!.preview.textContent} maxRows={15} />
                  </div>
                ) : session!.job.result!.preview.kind === 'markdown-tabs' ? (
                  <div className="output-preview-block">
                    <MarkdownTabs md={session!.job.result!.preview.textContent} meta={session!.job.result!.preview.metadata} output={session!.job.result!.outputs?.[0]} downloadArtifact={downloadArtifact} />
                  </div>
                ) : (
                  <div className="output-preview-block">
                    <pre className="output-pre">{session!.job.result!.preview.textContent}</pre>
                  </div>
                )
              ) : null}

              {/* Metadata pills */}
              {session?.job.result?.preview.metadata && (
                <div className="output-meta-strip">
                  {session.job.result.preview.metadata.map((item) => (
                    <div key={item.label} className="output-meta-pill">
                      <span className="omp-label">{item.label}</span>
                      <span className="omp-value">{item.value}</span>
                    </div>
                  ))}
                  <div className="output-meta-pill">
                    <span className="omp-label">File</span>
                    <span className="omp-value">{session.job.result.outputs?.[0]?.name}</span>
                  </div>
                  <div className="output-meta-pill">
                    <span className="omp-label">Size</span>
                    <span className="omp-value">{formatBytes(session.job.result.outputs?.[0]?.size ?? 0)}</span>
                  </div>
                </div>
              )}

              {/* Available Downloads */}
              {session!.job.result!.outputs.length > 0 && (
                <div className="output-downloads-section">
                  <div className="output-downloads-label">Available Downloads</div>
                  <div className="output-downloads-grid">
                    {session!.job.result!.outputs.map((out) => (
                      <div key={out.id} className="output-download-item">
                        <div className="min-w-0">
                          <p className="output-download-name">{out.name}</p>
                          <p className="output-download-size">{formatBytes(out.size)}</p>
                        </div>
                        <button className="output-download-btn" onClick={() => downloadArtifact(out)}>Download</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <section className="mt-12 pb-12">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-4">More in {tool.category}</p>
        <div className="other-tools-strip flex flex-wrap gap-2">
          {toolRegistry
            .filter((it) => it.category === tool.category && it.id !== tool.id)
            .slice(0, 4)
            .map((it) => (
              <Link key={it.id} to={`/tools/${it.id}`} className="other-tool-chip">
                <span className={`other-tool-chip-dot cat-${it.category}`}>
                  {it.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase()}
                </span>
                <span className="other-tool-chip-name">{it.name}</span>
              </Link>
            ))}
        </div>
      </section>

      <Modal open={showUploadGuide} onClose={() => setShowUploadGuide(false)} title={tool.name} description={tool.description}>
        <div>
          {tool.requiresFile !== false && (
            <>
              <div className="doc-section">
                <p className="doc-section-label">Accepted file types</p>
                <div className="doc-pills">
                  {tool.accepts.map((ext) => (
                    <span key={ext} className="doc-pill">{ext}</span>
                  ))}
                </div>
              </div>
              <hr className="doc-divider" />
            </>
          )}

          <div className="doc-section">
            <p className="doc-section-label">Capabilities</p>
            <div className="doc-pills">
              <span className="doc-pill">Browser-only</span>
              <span className="doc-pill">No upload</span>
              {tool.supportsBatch && <span className="doc-pill">Batch processing</span>}
              {tool.supportsPaste && <span className="doc-pill">Paste support</span>}
              {tool.maxFileSize && <span className="doc-pill">Max {Math.round(tool.maxFileSize / 1024 / 1024)} MB</span>}
            </div>
          </div>

          <hr className="doc-divider" />

          <div className="doc-section">
            <p className="doc-section-label">How to use</p>
            {tool.requiresFile !== false ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p className="doc-section-text">1. Drop or click to select a file in the input panel.</p>
                <p className="doc-section-text">2. Adjust settings in the Configuration panel on the right.</p>
                <p className="doc-section-text">3. Click <strong>Process Files</strong> — all processing happens locally in your browser.</p>
                <p className="doc-section-text">4. Download or copy the result from the Preview &amp; output panel.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p className="doc-section-text">1. Configure the settings in the panel below.</p>
                <p className="doc-section-text">2. Click <strong>Generate</strong> — everything runs in your browser, nothing is sent to a server.</p>
                <p className="doc-section-text">3. Download or copy the result from the Preview &amp; output panel.</p>
              </div>
            )}
          </div>

          <hr className="doc-divider" />

          <div className="doc-tip">
            <i className="doc-tip-icon">i</i>
            <span>
              {tool.supportsPaste
                ? 'You can paste content directly with Ctrl+V anywhere on the page to set it as input.'
                : 'Your files never leave your device — all processing runs entirely in the browser.'}
            </span>
          </div>
        </div>
      </Modal>
    </main>
  )
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function processInline(text: string): string {
  return text
    .replace(/\[x\]/gi, '<input type="checkbox" disabled checked class="md-check">')
    .replace(/\[ \]/g, '<input type="checkbox" disabled class="md-check">')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" class="md-img">')
    .replace(/(?<!\]\()(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" class="md-link">$1</a>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="md-link">$1</a>')
}

function buildHTMLTable(lines: string[]): string {
  const rows = lines.map(l => l.split('|').slice(1, -1).map(cell => cell.trim()))
  if (rows.length < 2) return lines.join('\n')

  const headers = rows[0]
  const sepRow = rows[1]
  const alignments = sepRow.map(s => {
    if (s.startsWith(':') && s.endsWith(':')) return 'center'
    if (s.endsWith(':')) return 'right'
    return 'left'
  })
  const dataRows = rows.slice(2)

  const thHTML = headers.map((h, i) => `<th style="text-align:${alignments[i]}">${processInline(h)}</th>`).join('')

  const tbodyHTML = dataRows.map(row =>
    '<tr>' + headers.map((_, i) => `<td style="text-align:${alignments[i]}">${processInline(row[i] ?? '')}</td>`).join('') + '</tr>'
  ).join('\n')

  return `<div class="md-table-wrap">
    <table class="md-table">
      <thead><tr>${thHTML}</tr></thead>
      <tbody>${tbodyHTML}</tbody>
    </table>
  </div>`
}

function buildList(lines: string[], startIndex: number, type: 'ul' | 'ol'): { html: string, consumed: number } {
  let i = startIndex
  const baseIndent = lines[i].match(/^\s*/)?.[0].length || 0
  let html = `<${type}>`

  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') { i++; continue; }
    const currentIndentMatch = line.match(/^\s*/)
    const indent = currentIndentMatch ? currentIndentMatch[0].length : 0
    if (indent < baseIndent && !/^\s*[-*+] /.test(line) && !/^\s*\d+\. /.test(line)) {
      break
    }

    const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)/)
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)/)

    if (ulMatch && type === 'ul') {
      html += `<li>${processInline(ulMatch[2])}</li>`
    } else if (olMatch && type === 'ol') {
      html += `<li>${processInline(olMatch[2])}</li>`
    } else {
      if (html.endsWith('</li>')) {
        html = html.slice(0, -5) + '<br>' + processInline(line.trim()) + '</li>'
      } else {
        break
      }
    }
    i++
  }
  html += `</${type}>`
  return { html, consumed: i - startIndex }
}

function renderMarkdownPreview(md: string): string {
  let html = md
  const fmMatch = html.match(/^\s*---\n([\s\S]*?)\n---\n?/)
  let frontMatterHTML = ''
  if (fmMatch) {
    html = html.slice(fmMatch[0].length)
    const fmLines = fmMatch[1].split('\n').filter(l => l.trim())
    const fmPairs = fmLines.map(line => {
      const colon = line.indexOf(':')
      if (colon === -1) return `<div class="fm-line">${escapeHtml(line)}</div>`
      const key = line.slice(0, colon).trim()
      const val = line.slice(colon + 1).trim().replace(/^["']|["']$/g, '')
      return `<div class="fm-line">
        <span class="fm-key">${escapeHtml(key)}</span>
        <span class="fm-sep">:</span>
        <span class="fm-val">${val ? escapeHtml(val) : '<em class="fm-empty">not set</em>'}</span>
      </div>`
    }).join('')
    frontMatterHTML = `<div class="md-frontmatter">${fmPairs}</div>`
  }

  const codeBlocks: string[] = []
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const id = codeBlocks.length
    codeBlocks.push(`<div class="md-code-block">${lang ? `<span class="code-lang">${escapeHtml(lang)}</span>` : ''}<pre><code>${escapeHtml(code.trimEnd())}</code></pre></div>`)
    return `__CODE_BLOCK_${id}__`
  })

  html = escapeHtml(html)
  html = html.replace(/__CODE_BLOCK_(\d+)__/g, (_, i) => codeBlocks[Number(i)])

  const lines = html.split('\n')
  const outputLines: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.includes('<div class="md-code-block">')) {
      outputLines.push(line)
      i++; continue
    }

    // Headings
    const hMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (hMatch) {
      const level = hMatch[1].length
      const text = processInline(hMatch[2])
      const slug = hMatch[2].toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
      outputLines.push(`<h${level} class="md-h${level}" id="${slug}">${text}</h${level}>`)
      i++; continue
    }

    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      outputLines.push('<hr class="md-hr">')
      i++; continue
    }

    if (line.startsWith('&gt; ')) { // escaped >
      let bqContent = ''
      while (i < lines.length && lines[i].startsWith('&gt; ')) {
        bqContent += processInline(lines[i].slice(5)) + ' '
        i++
      }
      outputLines.push(`<blockquote class="md-bq">${bqContent.trim()}</blockquote>`)
      continue
    }

    if (line.startsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].startsWith('|')) {
        tableLines.push(lines[i])
        i++
      }
      outputLines.push(buildHTMLTable(tableLines))
      continue
    }

    if (/^(\s*)[-*+] /.test(line)) {
      const listHTML = buildList(lines, i, 'ul')
      outputLines.push(listHTML.html)
      i += listHTML.consumed
      continue
    }

    if (/^(\s*)\d+\. /.test(line)) {
      const listHTML = buildList(lines, i, 'ol')
      outputLines.push(listHTML.html)
      i += listHTML.consumed
      continue
    }

    if (line.trim() === '') {
      outputLines.push('<div class="md-spacer"></div>')
      i++; continue
    }

    outputLines.push(`<p class="md-p">${processInline(line)}</p>`)
    i++
  }

  return frontMatterHTML + outputLines.join('\n')
}

function renderRawMarkdown(md: string): string {
  const lines = md.split('\n')
  const html = lines.map(line => {
    let cls = ''
    let content = escapeHtml(line)

    if (/^---/.test(line)) cls = 'md-raw-fm'
    else if (/^\s*#/.test(line)) cls = 'md-raw-heading'
    else if (/^\s*\|/.test(line)) cls = 'md-raw-pipe'
    else if (/^```/.test(line)) cls = 'md-raw-code'
    else if (/^---+$/.test(line.trim())) cls = 'md-raw-hr'
    else if (/\*\*/.test(line)) cls = 'md-raw-bold'

    content = content
      .replace(/(\*\*[^*]+\*\*)/g, '<span class="md-raw-bold">$1</span>')
      .replace(/(`.+?`)/g, '<span class="md-raw-code">$1</span>')

    return `<span class="md-raw-line${cls ? ' ' + cls : ''}">${content || ' '}</span>`
  }).join('')

  return `<div class="md-raw-wrapper">
    <pre class="md-raw-pre">${html}</pre>
  </div>`
}

function MarkdownTabs({ md, meta, output, downloadArtifact }: any) {
  const [activeTab, setActiveTab] = useState<'preview' | 'raw'>('preview')
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(md)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const contentType = meta?.find((m: any) => m.label === 'Content Type')?.value || 'auto'
  const outputLines = md.split('\n').length
  const headingCount = (md.match(/^#{1,6} /gm) || []).length
  const tableCount = (md.match(/^\|[-:| ]+\|(?=\r?$)/gm) || []).length
  const codeBlockCount = (md.match(/^```/gm) || []).length / 2

  return (
    <div className="mt-4 min-w-0 flex flex-col">
      <div className="md-tab-bar">
        <button
          className={`md-tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
          onClick={() => setActiveTab('preview')}
        >
          Preview
        </button>
        <button
          className={`md-tab-btn ${activeTab === 'raw' ? 'active' : ''}`}
          onClick={() => setActiveTab('raw')}
        >
          Raw Markdown
        </button>
      </div>

      <div className="md-tab-content relative">
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <button onClick={handleCopy} className="output-action-btn" title="Copy Raw Markdown">
            {copied ? 'Copied!' : 'COPY'}
          </button>
          {output && (
            <button onClick={() => downloadArtifact(output)} className="output-action-btn" title="Download .md file">
              DOWNLOAD
            </button>
          )}
        </div>

        {activeTab === 'preview' ? (
          <div className="md-preview-wrapper" dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(md) }} />
        ) : (
          <div dangerouslySetInnerHTML={{ __html: renderRawMarkdown(md) }} />
        )}
      </div>

      <div className="md-stats-bar">
        <span className="stat-item">
          <span className="stat-icon">⌗</span>
          <span className="stat-label">Content type</span>
          <span className="stat-value">{contentType}</span>
        </span>
        <span className="stat-divider" />
        <span className="stat-item">
          <span className="stat-icon">≡</span>
          <span className="stat-label">Lines</span>
          <span className="stat-value">{outputLines}</span>
        </span>
        <span className="stat-item">
          <span className="stat-icon">#</span>
          <span className="stat-label">Headings</span>
          <span className="stat-value">{headingCount}</span>
        </span>
        <span className="stat-item">
          <span className="stat-icon">⊞</span>
          <span className="stat-label">Tables</span>
          <span className="stat-value">{tableCount}</span>
        </span>
        <span className="stat-item">
          <span className="stat-icon">{`{ }`}</span>
          <span className="stat-label">Code blocks</span>
          <span className="stat-value">{Math.floor(codeBlockCount)}</span>
        </span>
      </div>
    </div>
  )
}
