import type { ProjectMeta } from '../types'

export type HomebrewFormulaInput = {
  className: string
  formulaName: string
  desc: string
  homepage: string
  version: string
  binary: string
  urls: {
    darwinArm64: { url: string; sha256: string }
    darwinX64: { url: string; sha256: string }
    linuxArm64: { url: string; sha256: string }
    linuxX64: { url: string; sha256: string }
  }
}

export function deriveFormulaName(binary: string): string {
  return (binary || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function formulaClassName(formulaName: string): string {
  const parts = (formulaName || '')
    .split(/[^a-zA-Z0-9]+/g)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
  const joined = parts.join('')
  if (!joined) return 'BunliCli'
  if (/^[0-9]/.test(joined)) return `Bunli${joined}`
  return joined
}

export function defaultFormulaDesc(meta: ProjectMeta): string {
  return (meta.description || '').trim() || `${meta.binary} CLI`
}

export function defaultHomepage(meta: ProjectMeta, fallback: string): string {
  return (meta.homepage || '').trim() || fallback
}

export function renderFormula(i: HomebrewFormulaInput): string {
  // Keep it simple and stable; Homebrew DSL will choose appropriate block at install time.
  return `class ${i.className} < Formula
  desc "${escapeRuby(i.desc)}"
  homepage "${escapeRuby(i.homepage)}"
  version "${escapeRuby(i.version)}"

  on_macos do
    if Hardware::CPU.arm?
      url "${escapeRuby(i.urls.darwinArm64.url)}"
      sha256 "${escapeRuby(i.urls.darwinArm64.sha256)}"
    else
      url "${escapeRuby(i.urls.darwinX64.url)}"
      sha256 "${escapeRuby(i.urls.darwinX64.sha256)}"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "${escapeRuby(i.urls.linuxArm64.url)}"
      sha256 "${escapeRuby(i.urls.linuxArm64.sha256)}"
    else
      url "${escapeRuby(i.urls.linuxX64.url)}"
      sha256 "${escapeRuby(i.urls.linuxX64.sha256)}"
    end
  end

  def install
    bin.install "${escapeRuby(i.binary)}"
  end

  test do
    system "#{bin}/${escapeRuby(i.binary)}", "--version"
  end
end
`
}

function escapeRuby(s: string): string {
  return (s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

