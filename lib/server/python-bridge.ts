import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { runCommand } from './run-command'

const bridgeScript = path.join(process.cwd(), 'python', 'analyze_quality.py')

export async function runPythonAnalysis(payload: Record<string, unknown>) {
  const tempDir = path.join(os.tmpdir(), 'for-q-analysis')
  await mkdir(tempDir, { recursive: true })

  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const inputPath = path.join(tempDir, `request-${stamp}.json`)
  const outputPath = path.join(tempDir, `response-${stamp}.json`)

  try {
    await writeFile(inputPath, JSON.stringify(payload), 'utf8')

    await runCommand(
      [
        { command: 'py', args: ['-3', bridgeScript, '--input', inputPath, '--output', outputPath] },
        { command: 'python', args: [bridgeScript, '--input', inputPath, '--output', outputPath] },
        { command: 'python3', args: [bridgeScript, '--input', inputPath, '--output', outputPath] },
      ],
    )

    const raw = await readFile(outputPath, 'utf8')
    return JSON.parse(raw)
  } finally {
    await Promise.allSettled([rm(inputPath, { force: true }), rm(outputPath, { force: true })])
  }
}
