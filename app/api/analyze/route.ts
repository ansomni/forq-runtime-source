import { mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { runPythonAnalysis } from '@/lib/server/python-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function persistUpload(file: File) {
  const tempDir = path.join(os.tmpdir(), 'for-q-uploads')
  await mkdir(tempDir, { recursive: true })
  const tempPath = path.join(tempDir, `${Date.now()}-${file.name}`)
  const arrayBuffer = await file.arrayBuffer()
  await writeFile(tempPath, Buffer.from(arrayBuffer))
  return tempPath
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const business = String(formData.get('business') || 'MX')
  const product = String(formData.get('product') || '')
  const localPath = String(formData.get('localPath') || '')
  const file = formData.get('file')

  if (!product) {
    return NextResponse.json({ error: 'Please choose a product group.' }, { status: 400 })
  }

  let tempPath: string | null = null

  try {
    if (!localPath && !(file instanceof File)) {
      return NextResponse.json({ error: 'An uploaded file or a local file path is required.' }, { status: 400 })
    }

    if (file instanceof File) {
      tempPath = await persistUpload(file)
    }

    const result = await runPythonAnalysis({
      business,
      product,
      sourcePath: localPath || tempPath,
      originalFileName: file instanceof File ? file.name : path.basename(localPath),
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown analysis error.'
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    if (tempPath) {
      await rm(tempPath, { force: true })
    }
  }
}
