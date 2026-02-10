declare module 'yazl' {
  import { Readable } from 'node:stream'

  export type ZipFileOptions = Record<string, unknown>
  export type AddFileOptions = { mtime?: Date; mode?: number; compress?: boolean }

  export class ZipFile {
    constructor(options?: ZipFileOptions)
    addFile(realPath: string, metadataPath: string, options?: AddFileOptions): void
    end(options?: Record<string, unknown>): void
    outputStream: Readable
  }
}

