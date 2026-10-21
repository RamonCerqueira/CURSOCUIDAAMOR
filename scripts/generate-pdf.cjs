const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const mdPath = path.resolve(__dirname, '../orçamento.md')
const htmlPath = path.resolve(__dirname, '../orçamento_temp.html')
const pdfPath = path.resolve(__dirname, '../orçamento.pdf')
const pdfPathAscii = path.resolve(__dirname, '../orcamento.pdf')

const md = fs.readFileSync(mdPath, 'utf8')

// Parse markdown to HTML
function markdownToHtml(content) {
  const lines = content.split(/\r?\n/)
  let html = []
  let inTable = false
  let tableHeaderDone = false
  let inList = false
  let listType = ''

  function closeList() {
    if (inList) {
      html.push(listType === 'ul' ? '</ul>' : '</ol>')
      inList = false
      listType = ''
    }
  }

  function closeTable() {
    if (inTable) {
      html.push('</tbody></table>')
      inTable = false
      tableHeaderDone = false
    }
  }

  function formatInline(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const trimmed = rawLine.trim()

    // Horizontal Rule
    if (trimmed === '---') {
      closeList()
      closeTable()
      html.push('<hr />')
      continue
    }

    // Headings
    if (trimmed.startsWith('# ')) {
      closeList()
      closeTable()
      html.push(`<h1>${formatInline(trimmed.slice(2))}</h1>`)
      continue
    }
    if (trimmed.startsWith('## ')) {
      closeList()
      closeTable()
      html.push(`<h2>${formatInline(trimmed.slice(3))}</h2>`)
      continue
    }
    if (trimmed.startsWith('### ')) {
      closeList()
      closeTable()
      html.push(`<h3>${formatInline(trimmed.slice(4))}</h3>`)
      continue
    }
    if (trimmed.startsWith('#### ')) {
      closeList()
      closeTable()
      html.push(`<h4>${formatInline(trimmed.slice(5))}</h4>`)
      continue
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      closeList()
      closeTable()
      html.push(`<blockquote>${formatInline(trimmed.slice(2))}</blockquote>`)
      continue
    }

    // Tables
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      closeList()
      const cells = trimmed.split('|').slice(1, -1).map(c => c.trim())
      
      // Separator row (e.g., |:---|:---:|)
      if (cells.every(c => /^:?-+:?$/.test(c))) {
        tableHeaderDone = true
        continue
      }

      if (!inTable) {
        inTable = true
        html.push('<table><thead><tr>')
        cells.forEach(c => html.push(`<th>${formatInline(c)}</th>`))
        html.push('</tr></thead><tbody>')
      } else {
        html.push('<tr>')
        cells.forEach(c => html.push(`<td>${formatInline(c)}</td>`))
        html.push('</tr>')
      }
      continue
    } else {
      closeTable()
    }

    // Unordered List
    if (/^-\s+/.test(trimmed)) {
      if (!inList || listType !== 'ul') {
        closeList()
        html.push('<ul>')
        inList = true
        listType = 'ul'
      }
      html.push(`<li>${formatInline(trimmed.replace(/^-\s+/, ''))}</li>`)
      continue
    }

    // Numbered List
    if (/^\d+\.\s+/.test(trimmed)) {
      if (!inList || listType !== 'ol') {
        closeList()
        html.push('<ol>')
        inList = true
        listType = 'ol'
      }
      html.push(`<li>${formatInline(trimmed.replace(/^\d+\.\s+/, ''))}</li>`)
      continue
    }

    closeList()

    // Empty lines
    if (!trimmed) {
      continue
    }

    // Regular paragraphs
    html.push(`<p>${formatInline(trimmed)}</p>`)
  }

  closeList()
  closeTable()

  return html.join('\n')
}

const bodyHtml = markdownToHtml(md)

const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Orçamento — Plataforma Cuida Amor</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Manrope:wght@600;700;800&display=swap');

    @page {
      size: A4;
      margin: 16mm 14mm 16mm 14mm;
      @bottom-right {
        content: counter(page) " / " counter(pages);
      }
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.5;
      color: #1e293b;
      margin: 0;
      padding: 0;
      background: #fff;
    }

    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 14pt;
      margin-bottom: 16pt;
      border-bottom: 2pt solid #be123c;
    }

    .brand-title {
      font-family: 'Manrope', sans-serif;
      font-size: 18pt;
      font-weight: 800;
      color: #9f1239;
      letter-spacing: -0.02em;
      margin: 0;
    }

    .brand-subtitle {
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: #94a3b8;
      text-transform: uppercase;
      margin-top: 2pt;
    }

    h1 {
      font-family: 'Manrope', sans-serif;
      font-size: 18pt;
      font-weight: 800;
      color: #881337;
      margin: 0 0 10pt 0;
      line-height: 1.25;
      letter-spacing: -0.02em;
    }

    h2 {
      font-family: 'Manrope', sans-serif;
      font-size: 12.5pt;
      font-weight: 700;
      color: #9f1239;
      margin: 16pt 0 6pt 0;
      padding-bottom: 3pt;
      border-bottom: 1pt solid #fecdd3;
      page-break-after: avoid;
    }

    h3 {
      font-family: 'Manrope', sans-serif;
      font-size: 10.5pt;
      font-weight: 700;
      color: #0f172a;
      margin: 10pt 0 3pt 0;
      page-break-after: avoid;
    }

    h4 {
      font-size: 9.5pt;
      font-weight: 700;
      color: #334155;
      margin: 8pt 0 2pt 0;
      page-break-after: avoid;
    }

    p {
      margin: 0 0 6pt 0;
    }

    strong {
      color: #0f172a;
      font-weight: 700;
    }

    ul, ol {
      margin: 2pt 0 8pt 16pt;
      padding: 0;
    }

    li {
      margin-bottom: 2.5pt;
    }

    blockquote {
      background: #fff1f2;
      border-left: 3pt solid #e11d48;
      margin: 8pt 0;
      padding: 6pt 10pt;
      color: #881337;
      border-radius: 0 4pt 4pt 0;
      font-size: 9.5pt;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8pt 0 12pt 0;
      page-break-inside: avoid;
    }

    th {
      background-color: #fdf2f8;
      color: #831843;
      border: 1pt solid #fbcfe8;
      padding: 5pt 7pt;
      text-align: left;
      font-size: 8.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    td {
      border: 1pt solid #e2e8f0;
      padding: 4.5pt 7pt;
      font-size: 8.5pt;
      color: #334155;
      vertical-align: middle;
    }

    tr:nth-child(even) td {
      background-color: #f8fafc;
    }

    code {
      background: #f1f5f9;
      color: #be123c;
      padding: 1pt 3pt;
      border-radius: 3pt;
      font-size: 8.5pt;
      font-family: Consolas, 'Courier New', monospace;
    }

    hr {
      border: 0;
      border-top: 1pt solid #cbd5e1;
      margin: 12pt 0;
    }

    .footer-note {
      margin-top: 18pt;
      font-size: 8pt;
      color: #94a3b8;
      text-align: center;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="doc-header">
    <div>
      <div class="brand-title">CUIDA AMOR</div>
      <div class="brand-subtitle">Plataforma de Cursos & Gestão Acadêmica Integrada</div>
    </div>
    <div style="text-align: right; font-size: 8.5pt; color: #64748b;">
      <div><strong>Proposta Comercial Oficial</strong></div>
      <div>Outubro / 2026</div>
    </div>
  </div>

  ${bodyHtml}

  <div class="footer-note">
    Documento confidencial gerado para apreciação e contratação de serviços tecnológicos.
  </div>
</body>
</html>`

fs.writeFileSync(htmlPath, fullHtml, 'utf8')
console.log('HTML gerado com sucesso em:', htmlPath)

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

try {
  const cmd = `"${edgePath}" --headless --disable-gpu --run-all-compositor-stages-before-draw --no-pdf-header-footer --print-to-pdf="${pdfPath}" "file:///${htmlPath.replace(/\\/g, '/')}"`
  execSync(cmd, { stdio: 'inherit' })
  console.log('PDF gerado com sucesso em:', pdfPath)

  // Copia sem acento para compatibilidade
  fs.copyFileSync(pdfPath, pdfPathAscii)
  console.log('Cópia gerada em:', pdfPathAscii)

  // Remove o html temporário
  if (fs.existsSync(htmlPath)) {
    fs.unlinkSync(htmlPath)
  }
} catch (e) {
  console.error('Erro ao converter para PDF:', e)
  process.exit(1)
}
