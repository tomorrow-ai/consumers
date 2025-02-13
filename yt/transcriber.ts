import { AssemblyAI } from "assemblyai";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "child_process";
import { existsSync, mkdirSync } from "node:fs";

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000'

const assembly = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY!,
});

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
  console.log(
    `Starting transcription process for stream url: ${streamUrl}`,
  );

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
      console.log(
        `Stream ${streamUrl}: Waiting for audio chunks... Current size: ${audioChunks.reduce((acc, chunk) => acc + chunk.length, 0)} bytes`,
      );
      return;
    }

    const totalSize = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    if (totalSize < minChunkSize) {
      console.log(
        `Stream ${streamUrl}: Not enough audio data yet. Current size: ${totalSize} bytes`,
      );
      return;
    }

    isProcessing = true;
    console.log(
      `Stream ${streamUrl}: Processing ${totalSize} bytes of audio data`,
    );

    const combinedBuffer = Buffer.concat(audioChunks);
    audioChunks = [];

    try {
      const tempPcmPath = join(process.cwd(), "temp", `${randomUUID()}.pcm`);
      const tempWavPath = join(process.cwd(), "temp", `${randomUUID()}.wav`);

      await writeFile(tempPcmPath, combinedBuffer);

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
          else reject(new Error(`FFmpeg exited with code ${code}`));
        });
        ffmpeg.on("error", reject);
      });

      const transcript = await assembly.transcripts.transcribe({
        audio: tempWavPath,
      });

      if (transcript.text) {
        console.log(`Stream ${streamUrl} caption: ${transcript.text}`);

        try {
          await sendCaptionToServer(streamUrl, transcript.text);
        } catch (error) {
          console.error('Failed to send caption to server:', error);
        }
      }

      await Promise.all([unlink(tempPcmPath), unlink(tempWavPath)]);
    } catch (error) {
      console.error(`Error transcribing audio for stream ${streamUrl}:`, error);
    } finally {
      isProcessing = false;
    }
  }, intervalMs);

  proc.stdout.on("data", (data: Buffer) => {
    audioChunks.push(data);
  });

  proc.stderr.on("data", (data: Buffer) => {
    console.log(`Stream ${streamUrl}:`, data.toString());
  });

  proc.on("error", (error: Error) => {
    console.error(`Stream ${streamUrl} process error:`, error);
  });

  proc.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
    clearInterval(intervalId);
    delete activeProcesses[streamUrl];
    console.log(
      `Process exited for stream URL: ${streamUrl} with code ${code} and signal ${signal}`,
    );
  });

  proc.on("close", (code: number | null) => {
    console.log(`Stream ${streamUrl} process closed with code ${code}`);
  });
};

