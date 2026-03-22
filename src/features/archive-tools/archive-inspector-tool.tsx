import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect } from '../../components/workspace/OptionsComponents'

interface ArchiveInspectorOptions {
  sortBy: 'Name' | 'Size'
}

function ArchiveInspectorOptionsComponent({ options, onChange }: ToolOptionsComponentProps<ArchiveInspectorOptions>) {
  return (
    <OptionsSection label="Display Settings">
      <OptionsSelect
        label="Sort By"
        value={options.sortBy}
        onChange={(val) => onChange({ ...options, sortBy: val as ArchiveInspectorOptions['sortBy'] })}
        options={[
          { value: 'Name', label: 'File / Path Name' },
          { value: 'Size', label: 'Uncompressed Size' },
        ]}
      />
      <p className="text-xs text-secondary mt-2">
        Inspect ZIP file contents instantly without dumping everything into your downloads folder.
      </p>
    </OptionsSection>
  )
}

const module: ToolModule<ArchiveInspectorOptions> = {
  defaultOptions: { sortBy: 'Name' },
  OptionsComponent: ArchiveInspectorOptionsComponent,
  async run(files, options, helpers) {
    const JSZip = (await import('jszip')).default
    const input = files[0]
    
    helpers.onProgress({ phase: 'processing', value: 0.3, message: 'Parsing archive headers...' })
    
    let zip;
    try {
      zip = await JSZip.loadAsync(await input.file.arrayBuffer())
    } catch {
      throw new Error('Invalid or corrupted ZIP archive. JSZip cannot reconstruct the index map.')
    }
    
    helpers.onProgress({ phase: 'processing', value: 0.7, message: 'Building file tree...' })

    const entriesList: any[] = []
    let totalUncompressed = 0
    let totalFiles = 0
    let totalFolders = 0

    zip.forEach((relativePath, zipEntry) => {
      // @ts-ignore js-zip typings for internal fields
      const compressedSize = zipEntry._data?.compressedSize || 0
      // @ts-ignore
      const uncompressedSize = zipEntry._data?.uncompressedSize || 0
      
      totalUncompressed += uncompressedSize
      if (zipEntry.dir) totalFolders++
      else totalFiles++

      entriesList.push({
        path: relativePath,
        isDirectory: zipEntry.dir,
        compressedSize,
        uncompressedSize,
        date: zipEntry.date.toISOString(),
      })
    })

    if (options.sortBy === 'Name') {
      entriesList.sort((a, b) => a.path.localeCompare(b.path))
    } else {
      entriesList.sort((a, b) => b.uncompressedSize - a.uncompressedSize)
    }

    const report = {
      archiveInfo: {
        name: input.name,
        compressedSize: input.file.size,
        uncompressedSize: totalUncompressed,
        totalFiles,
        totalFolders
      },
      contents: entriesList
    }
    
    const reportStr = JSON.stringify(report, null, 2)
    const blob = new Blob([reportStr], { type: 'application/json' })

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    const outName = `${input.name.replace(/\.[^.]+$/, '')}-inspection.json`
    
    return {
      outputs: [{ id: crypto.randomUUID(), name: outName, blob, type: 'application/json', size: blob.size }],
      preview: { kind: 'text', title: 'Archive Inspected', summary: `Found ${totalFiles} files and ${totalFolders} folders.`, textContent: reportStr, metadata: [{ label: 'Compression Ratio', value: `${((input.file.size / (totalUncompressed || 1)) * 100).toFixed(1)}%` }] },
    }
  },
}

export default module
