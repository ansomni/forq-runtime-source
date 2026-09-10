import { NextResponse } from 'next/server'
import { runCommand } from '@/lib/server/run-command'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await request.json()
  const prompt = String(body.prompt || '')

  if (!prompt.trim()) {
    return NextResponse.json({ error: 'Gemini prompt is empty.' }, { status: 400 })
  }

  const configured = process.env.GEMINI_CLI_COMMAND
  const args = process.env.GEMINI_CLI_ARGS?.split(' ').filter(Boolean) ?? []

  try {
    const result = await runCommand(
      configured
        ? [{ command: configured, args }]
        : [
            { command: 'gemini', args },
            { command: 'gemini-cli', args },
          ],
      prompt,
    )

    return NextResponse.json({
      answer: result.stdout.trim(),
      command: result.command,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gemini CLI execution failed.'
    return NextResponse.json(
      {
        error: `Gemini CLI execution failed: ${message}`,
        hint: 'Set GEMINI_CLI_COMMAND / GEMINI_CLI_ARGS in the launcher or runtime environment to attach Gemini CLI.',
      },
      { status: 500 },
    )
  }
}
