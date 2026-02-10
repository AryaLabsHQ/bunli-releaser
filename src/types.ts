export type Os = 'darwin' | 'linux' | 'windows'
export type Arch = 'arm64' | 'x64'

export type TargetTriple = `${Os}-${Arch}`

export type NormalizedTarget = {
  target: TargetTriple
  os: Os
  arch: Arch
  isWindows: boolean
}

export type ProjectMeta = {
  name: string
  description?: string
  homepage?: string
  repository?: string
  binary: string
}

