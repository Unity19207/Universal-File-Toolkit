import type { ToolCategory } from './types'

export const categoryMeta: Record<ToolCategory, { title: string; description: string; accent: string }> = {
  image: {
    title: 'Image',
    description: 'Resize, compress, and convert visuals without leaving the browser.',
    accent: 'from-indigo-500/14 to-cyan-500/10 dark:from-indigo-400/20 dark:to-cyan-400/16',
  },
  pdf: {
    title: 'PDF',
    description: 'Merge and split documents in memory with local-only processing.',
    accent: 'from-orange-500/14 to-rose-500/10 dark:from-orange-400/20 dark:to-rose-400/16',
  },
  data: {
    title: 'Data',
    description: 'Move between CSV and JSON with schema-preserving transforms.',
    accent: 'from-emerald-500/14 to-sky-500/10 dark:from-emerald-400/20 dark:to-sky-400/16',
  },
  text: {
    title: 'Text',
    description: 'Format, normalize, and clean plain text or JSON snippets instantly.',
    accent: 'from-violet-500/14 to-slate-500/10 dark:from-violet-400/22 dark:to-slate-400/16',
  },
  media: {
    title: 'Media',
    description: 'FFmpeg-powered extraction and conversion with progressive browser checks.',
    accent: 'from-blue-500/14 to-fuchsia-500/10 dark:from-blue-400/20 dark:to-fuchsia-400/16',
  },
  developer: {
    title: 'Developer',
    description: 'Encode, inspect, and transform developer-facing text and utility data locally.',
    accent: 'from-cyan-500/14 to-sky-500/10 dark:from-cyan-400/20 dark:to-sky-400/16',
  },
  archive: {
    title: 'Archive',
    description: 'Bundle, encode, and inspect file archives without leaving the browser.',
    accent: 'from-slate-500/14 to-stone-500/10 dark:from-slate-400/20 dark:to-stone-400/16',
  },
}
