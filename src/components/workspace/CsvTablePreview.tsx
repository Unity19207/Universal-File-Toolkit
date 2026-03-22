import Papa from 'papaparse'

export interface CsvTablePreviewProps {
  csvText: string
  maxRows?: number
}

function toCellText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

export function CsvTablePreview({ csvText, maxRows = 100 }: CsvTablePreviewProps) {
  const trimmed = csvText.trim()
  if (!trimmed) {
    return <div className="csv-preview-state">Could not render table preview. Download the file to view.</div>
  }

  const result = Papa.parse<string[]>(trimmed, {
    header: false,
    skipEmptyLines: true,
  })

  const parsedRows = result.data.map((row) => row.map(toCellText))
  if (parsedRows.length === 0) {
    return <div className="csv-preview-state">Could not render table preview. Download the file to view.</div>
  }

  const [rawHeaders, ...rawDataRows] = parsedRows
  const columnCount = Math.max(rawHeaders.length, ...rawDataRows.map((row) => row.length), 0)

  if (columnCount === 0) {
    return <div className="csv-preview-state">Could not render table preview. Download the file to view.</div>
  }

  const headers = Array.from({ length: columnCount }, (_, index) => {
    const source = rawHeaders[index]?.trim()
    return source && source.length > 0 ? source : `Column ${index + 1}`
  })

  const totalRows = rawDataRows.length
  const visibleRows = rawDataRows.slice(0, maxRows).map((row) =>
    Array.from({ length: columnCount }, (_, index) => toCellText(row[index])),
  )
  const isTruncated = totalRows > maxRows

  return (
    <>
      <div className="csv-table-wrapper" role="region" aria-label="CSV table preview">
        <table className="csv-table">
          <thead>
            <tr>
              <th className="csv-row-num csv-row-num-header" aria-hidden="true" />
              {headers.map((header, index) => (
                <th key={`header-${index}-${header}`} className={index === 0 ? 'csv-first-data-col' : undefined} title={header}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                <td className="csv-row-num" aria-label={`Row ${rowIndex + 1}`}>
                  {rowIndex + 1}
                </td>
                {row.map((cell, colIndex) => (
                  <td key={`cell-${rowIndex}-${colIndex}`} title={cell}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isTruncated ? (
        <p className="csv-truncation-notice">
          Showing first {maxRows} of {totalRows} rows. Download the file to view all data.
        </p>
      ) : null}
    </>
  )
}
