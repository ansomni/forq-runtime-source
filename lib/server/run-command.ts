import { spawn } from 'node:child_process'

export async function runCommand(
  candidates: Array<{ command: string; args: string[] }>,
  stdinText?: string,
): Promise<{ stdout: string; stderr: string; command: string }> {
  let lastError = 'No command candidates were provided.'

  for (const candidate of candidates) {
    try {
      const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        const child = spawn(candidate.command, candidate.args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: process.platform === 'win32',
        })

        let stdout = ''
        let stderr = ''

        child.stdout.on('data', (chunk) => {
          stdout += chunk.toString()
        })
        child.stderr.on('data', (chunk) => {
          stderr += chunk.toString()
        })
        child.on('error', reject)
        child.on('close', (code) => {
          if (code === 0) {
            resolve({ stdout, stderr })
            return
          }
          reject(new Error(stderr || `Command exited with code ${code}.`))
        })

        if (stdinText) {
          child.stdin.write(stdinText)
        }
        child.stdin.end()
      })

      return { ...result, command: `${candidate.command} ${candidate.args.join(' ')}`.trim() }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }

  throw new Error(lastError)
}
