"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/index.ts
var core7 = __toESM(require("@actions/core"));
var github = __toESM(require("@actions/github"));
var import_node_path9 = __toESM(require("path"));
var import_node_os4 = __toESM(require("os"));
var import_promises10 = __toESM(require("fs/promises"));

// src/bun.ts
var core2 = __toESM(require("@actions/core"));
var tc = __toESM(require("@actions/tool-cache"));
var import_node_path2 = __toESM(require("path"));
var import_promises2 = __toESM(require("fs/promises"));

// src/exec.ts
var core = __toESM(require("@actions/core"));
var exec = __toESM(require("@actions/exec"));
async function execCmd(commandLine, args = [], opts = {}) {
  let stdout = "";
  let stderr = "";
  const exitCode = await exec.exec(commandLine, args, {
    ...opts,
    ignoreReturnCode: true,
    listeners: {
      stdout: (data) => {
        stdout += data.toString("utf8");
      },
      stderr: (data) => {
        stderr += data.toString("utf8");
      }
    }
  });
  if (exitCode !== 0 && !opts.ignoreReturnCode) {
    core.debug(stdout);
    core.debug(stderr);
  }
  return { exitCode, stdout, stderr };
}

// src/fsutil.ts
var import_promises = __toESM(require("fs/promises"));
var import_node_fs = require("fs");
var import_node_path = __toESM(require("path"));
var import_node_crypto = __toESM(require("crypto"));
async function fileExists(p) {
  try {
    await import_promises.default.stat(p);
    return true;
  } catch {
    return false;
  }
}
async function mkdirp(p) {
  await import_promises.default.mkdir(p, { recursive: true });
}
async function listFiles(dir) {
  const entries = await import_promises.default.readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isFile()).map((e) => import_node_path.default.join(dir, e.name));
}
async function sha256File(filePath) {
  const hash = import_node_crypto.default.createHash("sha256");
  await new Promise((resolve, reject) => {
    const s = (0, import_node_fs.createReadStream)(filePath);
    s.on("data", (chunk) => hash.update(chunk));
    s.on("error", reject);
    s.on("end", () => resolve());
  });
  return hash.digest("hex");
}

// src/bun.ts
function normalizeBunVersion(v) {
  const trimmed = (v || "").trim();
  if (!trimmed || trimmed === "latest") return { kind: "latest" };
  return { kind: "pinned", version: trimmed.startsWith("v") ? trimmed.slice(1) : trimmed };
}
async function ensureBun(versionInput) {
  const desired = normalizeBunVersion(versionInput);
  const existing = await execCmd("bun", ["--version"], { silent: true, ignoreReturnCode: true });
  if (existing.exitCode === 0) {
    core2.info(`bun already available: ${existing.stdout.trim()}`);
    return;
  }
  const url = desired.kind === "latest" ? "https://github.com/oven-sh/bun/releases/latest/download/bun-linux-x64.zip" : `https://github.com/oven-sh/bun/releases/download/bun-v${desired.version}/bun-linux-x64.zip`;
  core2.info(`Downloading bun (${desired.kind === "latest" ? "latest" : desired.version})...`);
  const zipPath = await tc.downloadTool(url);
  const extracted = await tc.extractZip(zipPath);
  const bunPath = await findBunBinary(extracted);
  core2.addPath(import_node_path2.default.dirname(bunPath));
  const check = await execCmd("bun", ["--version"], { silent: true, ignoreReturnCode: true });
  if (check.exitCode !== 0) {
    throw new Error(`Failed to install bun from ${url}`);
  }
  core2.info(`bun installed: ${check.stdout.trim()}`);
}
async function findBunBinary(root) {
  const direct = import_node_path2.default.join(root, "bun");
  if (await fileExists(direct)) return direct;
  const q = [root];
  while (q.length) {
    const dir = q.pop();
    let entries;
    try {
      entries = await import_promises2.default.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = import_node_path2.default.join(dir, e.name);
      if (e.isDirectory()) q.push(p);
      if (e.isFile() && e.name === "bun") return p;
    }
  }
  try {
    await mkdirp(root);
    const files = await listFiles(root);
    core2.debug(`Files in bun extract root: ${files.join(", ")}`);
  } catch {
  }
  throw new Error(`Could not find bun binary in extracted archive: ${root}`);
}

// src/config.ts
var import_promises3 = __toESM(require("fs/promises"));
var import_node_path3 = __toESM(require("path"));
var import_js_yaml = __toESM(require("js-yaml"));
async function loadOptionalConfig(workdir) {
  const p = import_node_path3.default.join(workdir, ".bunli-releaser.yml");
  if (!await fileExists(p)) return void 0;
  const raw = await import_promises3.default.readFile(p, "utf8");
  const parsed = import_js_yaml.default.load(raw);
  if (!parsed || typeof parsed !== "object") return void 0;
  return parsed;
}

// src/tag.ts
var TAG_RE = /^v(\d+)\.(\d+)\.(\d+)$/;
function parseTag(tag) {
  const trimmed = (tag || "").trim();
  const m = TAG_RE.exec(trimmed);
  if (!m) {
    throw new Error(`Unsupported tag format: "${tag}". Expected "v1.2.3".`);
  }
  return { tag: trimmed, version: `${m[1]}.${m[2]}.${m[3]}` };
}

// src/targets.ts
var DEFAULT_ALL = [
  "darwin-arm64",
  "darwin-x64",
  "linux-arm64",
  "linux-x64",
  "windows-x64"
];
function defaultTargets() {
  return [...DEFAULT_ALL];
}
function parseTargets(input) {
  const raw = (input ?? "").trim();
  if (!raw || raw === "all") return defaultTargets();
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return defaultTargets();
  if (parts.includes("all")) return defaultTargets();
  if (parts.includes("native")) {
    const os5 = mapNodePlatformToOs(process.platform);
    const arch = mapNodeArchToArch(process.arch);
    return [`${os5}-${arch}`];
  }
  const targets = [];
  for (const p of parts) {
    if (!isTargetTriple(p)) {
      throw new Error(
        `Invalid target "${p}". Expected one of: ${DEFAULT_ALL.join(", ")} (or "all").`
      );
    }
    targets.push(p);
  }
  return targets;
}
function normalizeTarget(t) {
  const [os5, arch] = t.split("-");
  return { target: t, os: os5, arch, isWindows: os5 === "windows" };
}
function isTargetTriple(s) {
  return DEFAULT_ALL.includes(s);
}
function mapNodePlatformToOs(p) {
  if (p === "darwin") return "darwin";
  if (p === "linux") return "linux";
  if (p === "win32") return "windows";
  throw new Error(`Unsupported native platform for v1: ${p}`);
}
function mapNodeArchToArch(a) {
  if (a === "arm64") return "arm64";
  if (a === "x64") return "x64";
  throw new Error(`Unsupported native arch for v1: ${a}`);
}

// src/project.ts
var import_promises4 = __toESM(require("fs/promises"));
var import_node_path4 = __toESM(require("path"));

// src/naming.ts
function normalizeArtifactBaseName(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) throw new Error("artifact-name is empty");
  return trimmed.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}
function archiveFileName(opts) {
  const base = `${opts.name}-${opts.version}-${opts.os}-${opts.arch}`;
  return opts.os === "windows" ? `${base}.zip` : `${base}.tar.gz`;
}

// src/project.ts
async function readProjectMeta(workdir, artifactNameInput) {
  const pkgPath = import_node_path4.default.join(workdir, "package.json");
  const raw = await import_promises4.default.readFile(pkgPath, "utf8");
  const pkg = JSON.parse(raw);
  const pkgName = (pkg.name || "").trim();
  const defaultBinary = deriveBinaryName(pkg);
  const binary = normalizeArtifactBaseName(artifactNameInput || defaultBinary || pkgName || "cli");
  const repository = typeof pkg.repository === "string" ? pkg.repository : typeof pkg.repository?.url === "string" ? pkg.repository.url : void 0;
  return {
    name: pkgName || binary,
    description: pkg.description,
    homepage: pkg.homepage,
    repository,
    binary
  };
}
function deriveBinaryName(pkg) {
  if (!pkg.bin) return void 0;
  if (typeof pkg.bin === "string") return pkg.name;
  const keys = Object.keys(pkg.bin);
  if (keys.length === 1) return keys[0];
  return pkg.name;
}

// src/build.ts
var core3 = __toESM(require("@actions/core"));
var import_node_path5 = __toESM(require("path"));
var import_node_os = __toESM(require("os"));
var import_promises5 = __toESM(require("fs/promises"));
async function buildBinaries(opts) {
  const outdir = await import_promises5.default.mkdtemp(import_node_path5.default.join(import_node_os.default.tmpdir(), "bunli-releaser-build-"));
  core3.info(`Build outdir: ${outdir}`);
  await installDeps(opts.workdir);
  const targetsArg = opts.targets.join(",");
  core3.info(`Running: bunx bunli build --targets ${targetsArg} --outdir ${outdir}`);
  const res = await execCmd(
    "bunx",
    ["bunli", "build", "--targets", targetsArg, "--outdir", outdir],
    {
      cwd: opts.workdir,
      env: { ...process.env, BUNLI_RELEASE_VERSION: opts.version }
    }
  );
  if (res.exitCode !== 0) {
    throw new Error(`bunli build failed (exit ${res.exitCode}). stderr:
${res.stderr}`);
  }
  return { outdir };
}
async function installDeps(workdir) {
  const lockb = import_node_path5.default.join(workdir, "bun.lockb");
  const lock = import_node_path5.default.join(workdir, "bun.lock");
  const hasLock = await fileExists(lockb) || await fileExists(lock);
  const args = hasLock ? ["install", "--frozen-lockfile"] : ["install"];
  core3.info(`Running: bun ${args.join(" ")} (cwd=${workdir})`);
  const res = await execCmd("bun", args, { cwd: workdir });
  if (res.exitCode === 0) return;
  if (hasLock && args.includes("--frozen-lockfile")) {
    core3.info("bun install --frozen-lockfile failed; retrying without --frozen-lockfile");
    const retry = await execCmd("bun", ["install"], { cwd: workdir });
    if (retry.exitCode === 0) return;
    throw new Error(`bun install failed (exit ${retry.exitCode}). stderr:
${retry.stderr}`);
  }
  throw new Error(`bun install failed (exit ${res.exitCode}). stderr:
${res.stderr}`);
}
async function findBuiltExecutable(opts) {
  const dir = opts.multiTarget ? import_node_path5.default.join(opts.buildOutdir, opts.target) : opts.buildOutdir;
  if (!await fileExists(dir)) {
    throw new Error(`Expected build output dir not found for target ${opts.target}: ${dir}`);
  }
  const files = (await listFiles(dir)).filter((p) => !p.endsWith(".map"));
  if (files.length !== 1) {
    throw new Error(
      `Expected exactly 1 executable in ${dir} for target ${opts.target}, found ${files.length}: ${files.map((p) => import_node_path5.default.basename(p)).join(", ")}`
    );
  }
  return files[0];
}

// src/packaging.ts
var core4 = __toESM(require("@actions/core"));
var import_promises6 = __toESM(require("fs/promises"));
var import_node_fs2 = require("fs");
var import_node_os2 = __toESM(require("os"));
var import_node_path6 = __toESM(require("path"));
var import_tar = __toESM(require("tar"));
var import_yazl = __toESM(require("yazl"));
async function packageTargetBinary(opts) {
  await mkdirp(opts.outdir);
  const archiveFileNameStr = archiveFileName({
    name: opts.binaryBaseName,
    version: opts.version,
    os: opts.target.os,
    arch: opts.target.arch
  });
  const archivePath = import_node_path6.default.join(opts.outdir, archiveFileNameStr);
  const staged = await stageBinary({
    target: opts.target,
    binaryBaseName: opts.binaryBaseName,
    builtExecutablePath: opts.builtExecutablePath
  });
  if (opts.target.isWindows) {
    await createZip({
      archivePath,
      stagedBinaryPath: staged.stagedBinaryPath,
      binaryFileName: staged.binaryFileName
    });
  } else {
    await createTarGz({
      archivePath,
      stageDir: staged.stageDir,
      binaryFileName: staged.binaryFileName
    });
  }
  core4.info(`Packaged ${opts.target.target}: ${archiveFileNameStr}`);
  return {
    target: opts.target,
    archivePath,
    archiveFileName: archiveFileNameStr
  };
}
async function stageBinary(opts) {
  const stageDir = await import_promises6.default.mkdtemp(import_node_path6.default.join(import_node_os2.default.tmpdir(), "bunli-releaser-stage-"));
  const binaryFileName = opts.target.isWindows ? `${opts.binaryBaseName}.exe` : opts.binaryBaseName;
  const stagedBinaryPath = import_node_path6.default.join(stageDir, binaryFileName);
  await import_promises6.default.copyFile(opts.builtExecutablePath, stagedBinaryPath);
  if (!opts.target.isWindows) {
    await import_promises6.default.chmod(stagedBinaryPath, 493);
  }
  return { stageDir, stagedBinaryPath, binaryFileName };
}
async function createTarGz(opts) {
  await import_tar.default.c(
    {
      gzip: true,
      cwd: opts.stageDir,
      file: opts.archivePath,
      portable: true
    },
    [opts.binaryFileName]
  );
}
async function createZip(opts) {
  await new Promise((resolve, reject) => {
    const zip = new import_yazl.default.ZipFile();
    zip.addFile(opts.stagedBinaryPath, opts.binaryFileName, { mode: 493 });
    zip.end();
    zip.outputStream.pipe((0, import_node_fs2.createWriteStream)(opts.archivePath)).on("error", reject).on("close", resolve);
  });
}

// src/checksums.ts
var import_promises7 = __toESM(require("fs/promises"));
var import_node_path7 = __toESM(require("path"));
async function writeChecksumsFile(opts) {
  const lines = [];
  const sorted = [...opts.assetPaths].sort((a, b) => a.fileName.localeCompare(b.fileName));
  for (const a of sorted) {
    const sum = await sha256File(a.path);
    lines.push(`${sum}  ${a.fileName}`);
  }
  const content = lines.join("\n") + "\n";
  const p = import_node_path7.default.join(opts.outdir, opts.checksumFileName);
  await import_promises7.default.writeFile(p, content, "utf8");
  return p;
}
function parseChecksumsTxt(content) {
  const m = /* @__PURE__ */ new Map();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) continue;
    const sha = parts[0];
    const file = parts[parts.length - 1];
    m.set(file, sha);
  }
  return m;
}

// src/githubRelease.ts
var core5 = __toESM(require("@actions/core"));
var import_promises8 = __toESM(require("fs/promises"));
async function upsertReleaseAndUpload(opts) {
  const release = await getOrCreateRelease(opts);
  const existingAssets = await opts.octokit.rest.repos.listReleaseAssets({
    owner: opts.owner,
    repo: opts.repo,
    release_id: release.id,
    per_page: 100
  });
  const existing = new Set((existingAssets.data || []).map((a) => a.name));
  for (const a of opts.assets) {
    if (existing.has(a.fileName)) {
      throw new Error(
        `Release asset already exists for tag ${opts.tag}: ${a.fileName}. v1 is idempotent-fail by default.`
      );
    }
  }
  for (const a of opts.assets) {
    core5.info(`Uploading release asset: ${a.fileName}`);
    const buf = await import_promises8.default.readFile(a.filePath);
    await opts.octokit.rest.repos.uploadReleaseAsset({
      owner: opts.owner,
      repo: opts.repo,
      release_id: release.id,
      name: a.fileName,
      data: buf,
      headers: {
        "content-type": a.contentType,
        "content-length": buf.length
      }
    });
  }
  return { releaseUrl: release.html_url };
}
async function getOrCreateRelease(opts) {
  try {
    const r = await opts.octokit.rest.repos.getReleaseByTag({
      owner: opts.owner,
      repo: opts.repo,
      tag: opts.tag
    });
    core5.info(`Found existing release for ${opts.tag}`);
    return r.data;
  } catch (e) {
    if (e?.status !== 404) throw e;
  }
  core5.info(`Creating release for ${opts.tag}`);
  const created = await opts.octokit.rest.repos.createRelease({
    owner: opts.owner,
    repo: opts.repo,
    tag_name: opts.tag,
    name: opts.releaseName,
    draft: false,
    prerelease: false,
    generate_release_notes: true
  });
  return created.data;
}

// src/homebrew/tap.ts
var core6 = __toESM(require("@actions/core"));
var import_node_path8 = __toESM(require("path"));
var import_node_os3 = __toESM(require("os"));
var import_promises9 = __toESM(require("fs/promises"));

// src/homebrew/formula.ts
function deriveFormulaName(binary) {
  return (binary || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
function formulaClassName(formulaName) {
  const parts = (formulaName || "").split(/[^a-zA-Z0-9]+/g).filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1));
  const joined = parts.join("");
  if (!joined) return "BunliCli";
  if (/^[0-9]/.test(joined)) return `Bunli${joined}`;
  return joined;
}
function defaultFormulaDesc(meta) {
  return (meta.description || "").trim() || `${meta.binary} CLI`;
}
function defaultHomepage(meta, fallback) {
  return (meta.homepage || "").trim() || fallback;
}
function renderFormula(i) {
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
`;
}
function escapeRuby(s) {
  return (s || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// src/homebrew/tap.ts
async function updateHomebrewTap(opts) {
  const [tapOwner, tapRepo] = splitOwnerRepo(opts.brewTap);
  const tapDir = await import_promises9.default.mkdtemp(import_node_path8.default.join(import_node_os3.default.tmpdir(), "bunli-releaser-tap-"));
  const remoteUrl = `https://x-access-token:${opts.brewToken}@github.com/${tapOwner}/${tapRepo}.git`;
  core6.info(`Cloning Homebrew tap: ${opts.brewTap}`);
  const clone = await execCmd("git", ["clone", remoteUrl, tapDir], { silent: true });
  if (clone.exitCode !== 0) throw new Error(`Failed to clone tap repo. stderr:
${clone.stderr}`);
  const defaultBranch = await getDefaultBranch(tapDir);
  core6.info(`Tap default branch: ${defaultBranch}`);
  if (opts.brewPr) {
    const branch = `bunli-releaser/${opts.projectMeta.binary}-v${opts.version}`;
    const co = await execCmd("git", ["checkout", "-b", branch], { cwd: tapDir });
    if (co.exitCode !== 0) throw new Error(`Failed to create tap branch. stderr:
${co.stderr}`);
  }
  const formulaName = deriveFormulaName(opts.projectMeta.binary);
  const formulaPath = opts.brewFormulaPath || `Formula/${formulaName}.rb`;
  const absFormulaPath = import_node_path8.default.join(tapDir, formulaPath);
  await mkdirp(import_node_path8.default.dirname(absFormulaPath));
  const checksumsRaw = await import_promises9.default.readFile(opts.checksumsTxtPath, "utf8");
  const checksums = parseChecksumsTxt(checksumsRaw);
  const assetBaseUrl = `https://github.com/${opts.projectRepo.owner}/${opts.projectRepo.repo}/releases/download/v${opts.version}`;
  const mk = (asset) => `${assetBaseUrl}/${asset}`;
  const darwinArm = `${opts.projectMeta.binary}-${opts.version}-darwin-arm64.tar.gz`;
  const darwinX64 = `${opts.projectMeta.binary}-${opts.version}-darwin-x64.tar.gz`;
  const linuxArm = `${opts.projectMeta.binary}-${opts.version}-linux-arm64.tar.gz`;
  const linuxX64 = `${opts.projectMeta.binary}-${opts.version}-linux-x64.tar.gz`;
  const required = [darwinArm, darwinX64, linuxArm, linuxX64];
  for (const f of required) {
    if (!checksums.has(f)) {
      throw new Error(`checksums.txt missing sha256 for required Homebrew asset: ${f}`);
    }
  }
  const homepageFallback = `https://github.com/${opts.projectRepo.owner}/${opts.projectRepo.repo}`;
  const rb = renderFormula({
    className: formulaClassName(formulaName),
    formulaName,
    desc: defaultFormulaDesc(opts.projectMeta),
    homepage: defaultHomepage(opts.projectMeta, homepageFallback),
    version: opts.version,
    binary: opts.projectMeta.binary,
    urls: {
      darwinArm64: { url: mk(darwinArm), sha256: checksums.get(darwinArm) },
      darwinX64: { url: mk(darwinX64), sha256: checksums.get(darwinX64) },
      linuxArm64: { url: mk(linuxArm), sha256: checksums.get(linuxArm) },
      linuxX64: { url: mk(linuxX64), sha256: checksums.get(linuxX64) }
    }
  });
  await import_promises9.default.writeFile(absFormulaPath, rb, "utf8");
  core6.info(`Updated formula: ${formulaPath}`);
  await execCmd("git", ["config", "user.name", "bunli-releaser[bot]"], { cwd: tapDir, silent: true });
  await execCmd("git", ["config", "user.email", "bunli-releaser[bot]@users.noreply.github.com"], {
    cwd: tapDir,
    silent: true
  });
  const add = await execCmd("git", ["add", formulaPath], { cwd: tapDir });
  if (add.exitCode !== 0) throw new Error(`git add failed. stderr:
${add.stderr}`);
  const msg = (opts.brewCommitMessage || "").trim() || `chore: update ${opts.projectMeta.binary} to ${opts.version}`;
  const commit = await execCmd("git", ["commit", "-m", msg], { cwd: tapDir, ignoreReturnCode: true });
  if (commit.exitCode !== 0) {
    const status = await execCmd("git", ["status", "--porcelain=v1"], { cwd: tapDir, silent: true });
    if ((status.stdout || "").trim() === "") {
      core6.info("No Homebrew tap changes to commit.");
      return;
    }
    throw new Error(`git commit failed. stderr:
${commit.stderr}`);
  }
  if (!opts.brewPr) {
    const push2 = await execCmd("git", ["push", "origin", defaultBranch], { cwd: tapDir, silent: true });
    if (push2.exitCode !== 0) throw new Error(`git push failed. stderr:
${push2.stderr}`);
    core6.info(`Pushed formula update to ${opts.brewTap}@${defaultBranch}`);
    return;
  }
  const branchName = await currentBranch(tapDir);
  const push = await execCmd("git", ["push", "-u", "origin", branchName], { cwd: tapDir, silent: true });
  if (push.exitCode !== 0) throw new Error(`git push failed. stderr:
${push.stderr}`);
  return {
    pr: {
      owner: tapOwner,
      repo: tapRepo,
      headBranch: branchName,
      baseBranch: defaultBranch,
      title: `chore: update ${opts.projectMeta.binary} to ${opts.version}`,
      body: `Automated update by bunli-releaser for ${opts.projectRepo.owner}/${opts.projectRepo.repo} tag v${opts.version}.`
    }
  };
}
function splitOwnerRepo(s) {
  const trimmed = (s || "").trim();
  const parts = trimmed.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid brew-tap: "${s}". Expected "owner/repo".`);
  }
  return [parts[0], parts[1]];
}
async function getDefaultBranch(dir) {
  const r = await execCmd("git", ["remote", "show", "origin"], { cwd: dir, silent: true });
  const m = /HEAD branch:\s*(.+)\s*/.exec(r.stdout || "");
  return (m?.[1] || "main").trim();
}
async function currentBranch(dir) {
  const r = await execCmd("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: dir, silent: true });
  const b = (r.stdout || "").trim();
  if (!b) throw new Error("Failed to determine current branch for tap repo");
  return b;
}

// src/index.ts
async function run() {
  const githubToken = core7.getInput("github-token", { required: true });
  const bunVersion = (core7.getInput("bun-version") || "").trim() || "1.3.8";
  const workdirInput = core7.getInput("workdir") || ".";
  const targetsInputRaw = (core7.getInput("targets") || "").trim();
  const artifactNameInput = core7.getInput("artifact-name") || void 0;
  const brewTap = core7.getInput("brew-tap", { required: true });
  const brewToken = core7.getInput("brew-token", { required: true });
  const brewFormulaPath = core7.getInput("brew-formula-path") || void 0;
  const brewPr = (core7.getInput("brew-pr") || "false").toLowerCase() === "true";
  const brewCommitMessage = core7.getInput("brew-commit-message") || void 0;
  const repoRoot = process.env.GITHUB_WORKSPACE || process.cwd();
  const workdir = import_node_path9.default.resolve(repoRoot, workdirInput);
  const config = await loadOptionalConfig(workdir);
  const tagName = resolveTagName();
  const parsed = parseTag(tagName);
  core7.setOutput("version", parsed.version);
  core7.setOutput("tag", parsed.tag);
  await ensureBun(bunVersion);
  const cfgTargets = config?.build?.targets?.join(",");
  const targets = parseTargets(targetsInputRaw || cfgTargets || "all");
  const projectMeta = await readProjectMeta(workdir, artifactNameInput || config?.project?.binary);
  core7.info(`Binary name: ${projectMeta.binary}`);
  const build = await buildBinaries({ workdir, targets, version: parsed.version });
  const outdir = await import_promises10.default.mkdtemp(import_node_path9.default.join(import_node_os4.default.tmpdir(), "bunli-releaser-out-"));
  await mkdirp(outdir);
  const multiTarget = targets.length > 1;
  const packaged = [];
  for (const t of targets) {
    const nt = normalizeTarget(t);
    const exe = await findBuiltExecutable({ buildOutdir: build.outdir, target: t, multiTarget });
    packaged.push(
      await packageTargetBinary({
        target: nt,
        version: parsed.version,
        binaryBaseName: projectMeta.binary,
        builtExecutablePath: exe,
        outdir
      })
    );
  }
  const checksumPath = await writeChecksumsFile({
    outdir,
    checksumFileName: "checksums.txt",
    assetPaths: packaged.map((p) => ({ fileName: p.archiveFileName, path: p.archivePath }))
  });
  const owner = github.context.repo.owner;
  const repo = github.context.repo.repo;
  const octokit = github.getOctokit(githubToken);
  const assets = [
    ...packaged.map((p) => ({
      filePath: p.archivePath,
      fileName: p.archiveFileName,
      contentType: p.target.isWindows ? "application/zip" : "application/gzip"
    })),
    { filePath: checksumPath, fileName: "checksums.txt", contentType: "text/plain" }
  ];
  const release = await upsertReleaseAndUpload({
    octokit,
    owner,
    repo,
    tag: parsed.tag,
    releaseName: `${projectMeta.binary} ${parsed.version}`,
    assets
  });
  core7.setOutput("release-url", release.releaseUrl);
  const hb = await updateHomebrewTap({
    brewTap,
    brewToken,
    brewFormulaPath,
    brewCommitMessage,
    brewPr,
    version: parsed.version,
    projectRepo: { owner, repo },
    projectMeta,
    checksumsTxtPath: checksumPath
  });
  if (brewPr && hb && "pr" in hb) {
    const brewOctokit = github.getOctokit(brewToken);
    await brewOctokit.rest.pulls.create({
      owner: hb.pr.owner,
      repo: hb.pr.repo,
      title: hb.pr.title,
      head: `${hb.pr.owner}:${hb.pr.headBranch}`,
      base: hb.pr.baseBranch,
      body: hb.pr.body
    });
    core7.info(
      `Opened Homebrew tap PR: ${hb.pr.owner}/${hb.pr.repo} (${hb.pr.headBranch} -> ${hb.pr.baseBranch})`
    );
  }
}
function resolveTagName() {
  const refName = (process.env.GITHUB_REF_NAME || "").trim();
  if (refName) return refName;
  const ref = (process.env.GITHUB_REF || "").trim();
  const m = /^refs\/tags\/(.+)$/.exec(ref);
  if (m?.[1]) return m[1];
  throw new Error(
    `Could not resolve tag name from environment. GITHUB_REF_NAME="${process.env.GITHUB_REF_NAME}", GITHUB_REF="${process.env.GITHUB_REF}".`
  );
}
run().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  core7.setFailed(msg);
});
