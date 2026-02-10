import * as core from '@actions/core'
import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods'
import fs from 'node:fs/promises'

type Octokit = {
  rest: {
    repos: {
      getReleaseByTag: (p: RestEndpointMethodTypes['repos']['getReleaseByTag']['parameters']) => Promise<any>
      createRelease: (p: RestEndpointMethodTypes['repos']['createRelease']['parameters']) => Promise<any>
      listReleaseAssets: (p: RestEndpointMethodTypes['repos']['listReleaseAssets']['parameters']) => Promise<any>
      uploadReleaseAsset: (p: any) => Promise<any>
    }
  }
}

export async function upsertReleaseAndUpload(opts: {
  octokit: Octokit
  owner: string
  repo: string
  tag: string
  releaseName: string
  assets: { filePath: string; fileName: string; contentType: string }[]
}): Promise<{ releaseUrl: string }> {
  const release = await getOrCreateRelease(opts)

  const existingAssets = await opts.octokit.rest.repos.listReleaseAssets({
    owner: opts.owner,
    repo: opts.repo,
    release_id: release.id,
    per_page: 100
  })

  const existing = new Set<string>((existingAssets.data || []).map((a: any) => a.name))
  for (const a of opts.assets) {
    if (existing.has(a.fileName)) {
      throw new Error(
        `Release asset already exists for tag ${opts.tag}: ${a.fileName}. v1 is idempotent-fail by default.`
      )
    }
  }

  for (const a of opts.assets) {
    core.info(`Uploading release asset: ${a.fileName}`)
    const buf = await fs.readFile(a.filePath)
    await opts.octokit.rest.repos.uploadReleaseAsset({
      owner: opts.owner,
      repo: opts.repo,
      release_id: release.id,
      name: a.fileName,
      data: buf,
      headers: {
        'content-type': a.contentType,
        'content-length': buf.length
      }
    })
  }

  return { releaseUrl: release.html_url }
}

async function getOrCreateRelease(opts: {
  octokit: Octokit
  owner: string
  repo: string
  tag: string
  releaseName: string
}): Promise<any> {
  try {
    const r = await opts.octokit.rest.repos.getReleaseByTag({
      owner: opts.owner,
      repo: opts.repo,
      tag: opts.tag
    })
    core.info(`Found existing release for ${opts.tag}`)
    return r.data
  } catch (e: any) {
    if (e?.status !== 404) throw e
  }

  core.info(`Creating release for ${opts.tag}`)
  const created = await opts.octokit.rest.repos.createRelease({
    owner: opts.owner,
    repo: opts.repo,
    tag_name: opts.tag,
    name: opts.releaseName,
    draft: false,
    prerelease: false,
    generate_release_notes: true
  })
  return created.data
}
