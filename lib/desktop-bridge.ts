declare global {
  interface Window {
    forQDesktop?: {
      pickFile?: () => Promise<{ path: string; name: string } | null>
    }
  }
}

export async function pickDesktopFile() {
  if (!window.forQDesktop?.pickFile) return null
  return window.forQDesktop.pickFile()
}
