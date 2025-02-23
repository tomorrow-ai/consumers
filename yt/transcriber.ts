import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "child_process";
import { existsSync, mkdirSync, promises as fs } from "node:fs";

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000'

const activeProcesses: Record<string, any> = {};

async function sendCaptionToServer(streamUrl: string, text: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/streams/captions/${encodeURIComponent(streamUrl)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending caption to server:', error);
    throw error;
  }
}

export function transcribeStream(streamUrl: string) {
  console.log(`[YT Transcriber] Started monitoring stream: ${streamUrl}`);

  const tempDir = join(process.cwd(), "temp");
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir);
  }

  const command = `streamlink --stdout '${streamUrl}' worst | ffmpeg -loglevel quiet -i pipe:0 -f f32le -ar 16000 -ac 1 pipe:1`;
  const proc = spawn(command, { shell: true });
  activeProcesses[streamUrl] = proc;

  let audioChunks: Buffer[] = [];
  let isProcessing = false;

  const intervalMs = 30000;
  const minChunkSize = 16000 * 4 * 30;

  const intervalId = setInterval(async () => {
    if (audioChunks.length === 0 || isProcessing) {
      return; // Silent wait for more data
    }

    const totalSize = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    if (totalSize < minChunkSize) {
      return; // Silent wait for minimum chunk size
    }

    isProcessing = true;

    const combinedBuffer = Buffer.concat(audioChunks);
    audioChunks = [];

    try {
      const tempPcmPath = join(process.cwd(), "temp", `${randomUUID()}.pcm`);
      const tempWavPath = join(process.cwd(), "temp", `${randomUUID()}.wav`);

      await fs.writeFile(tempPcmPath, combinedBuffer);

      const ffmpeg = spawn("ffmpeg", [
        "-loglevel",
        "quiet",
        "-f",
        "f32le",
        "-ar",
        "16000",
        "-ac",
        "1",
        "-i",
        tempPcmPath,
        "-f",
        "wav",
        tempWavPath,
      ]);

      await new Promise((resolve, reject) => {
        ffmpeg.on("close", (code: number | null) => {
          if (code === 0) resolve(null);
          else reject(new Error(`FFmpeg conversion failed with code ${code}`));
        });
        ffmpeg.on("error", reject);
      });

      const baseName = randomUUID();
      const permanentWavPath = join(process.cwd(), "temp", baseName + ".wav");
      const metadataPath = join(process.cwd(), "temp", baseName + ".json");

      await fs.rename(tempWavPath, permanentWavPath);
      const metadata = {
        streamUrl,
      };

      await fs.writeFile(metadataPath, JSON.stringify(metadata));
      console.log(`[YT Transcriber] Queued audio segment for processing`);

      await fs.unlink(tempPcmPath);
    } catch (error) {
      console.error(`[YT Transcriber] Error processing audio segment:`, error);
    } finally {
      isProcessing = false;
    }
  }, intervalMs);

  proc.stdout.on("data", (data: Buffer) => {
    audioChunks.push(data);
  });

  proc.stderr.on("data", (data: Buffer) => {
    // Only log stderr if it contains important information
    if (data.toString().includes('error') || data.toString().includes('warning')) {
      console.warn(`[YT Transcriber] Stream warning:`, data.toString().trim());
    }
  });

  proc.on("error", (error: Error) => {
    console.error(`[YT Transcriber] Stream error:`, error);
  });

  proc.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
    clearInterval(intervalId);
    delete activeProcesses[streamUrl];
    if (code !== 0) {
      console.log(`[YT Transcriber] Stream monitoring ended with code ${code}`);
    }
  });

  proc.on("close", (code: number | null) => {
    if (code !== 0) {
      console.log(`[YT Transcriber] Stream connection closed with code ${code}`);
    }
  });
};