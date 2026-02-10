export type ParsedTag = {
  tag: string
  version: string
}

const TAG_RE = /^v(\d+)\.(\d+)\.(\d+)$/

export function parseTag(tag: string): ParsedTag {
  const trimmed = (tag || '').trim()
  const m = TAG_RE.exec(trimmed)
  if (!m) {
    throw new Error(`Unsupported tag format: "${tag}". Expected "v1.2.3".`)
  }
  return { tag: trimmed, version: `${m[1]}.${m[2]}.${m[3]}` }
}

