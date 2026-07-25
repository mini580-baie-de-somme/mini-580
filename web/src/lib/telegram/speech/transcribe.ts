import "server-only";

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_SCRIPT = path.join(process.cwd(), "scripts", "transcribe-audio.sh");

function resolveTranscribeScript(): string {
  const fromEnv = process.env.TRANSCRIBE_AUDIO_SCRIPT?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_SCRIPT;
}

export async function transcribeTelegramAudio(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const script = resolveTranscribeScript();
  const ext = path.extname(filename) || ".ogg";
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "tg-stt-"));
  const inputPath = path.join(tmpDir, `input${ext}`);

  try {
    await fs.writeFile(inputPath, buffer);
    const { stdout } = await execFileAsync("bash", [script, inputPath], {
      timeout: 180_000,
      maxBuffer: 1024 * 1024,
      env: process.env,
    });
    const text = stdout.trim();
    if (!text) {
      throw new Error("Transcription vide");
    }
    return text;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Transcription vocale impossible: ${msg}`);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
