import * as core from '@actions/core'
import * as exec from '@actions/exec'

export async function execCmd(
  commandLine: string,
  args: string[] = [],
  opts: exec.ExecOptions = {}
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  let stdout = ''
  let stderr = ''
  const exitCode = await exec.exec(commandLine, args, {
    ...opts,
    ignoreReturnCode: true,
    listeners: {
      stdout: (data: Buffer) => {
        stdout += data.toString('utf8')
      },
      stderr: (data: Buffer) => {
        stderr += data.toString('utf8')
      }
    }
  })

  if (exitCode !== 0 && !opts.ignoreReturnCode) {
    core.debug(stdout)
    core.debug(stderr)
  }

  return { exitCode, stdout, stderr }
}

