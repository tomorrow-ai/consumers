import { AssemblyAI } from "assemblyai";
import { join } from "node:path";
import { promises as fs } from "node:fs";
import dotenv from "dotenv";

dotenv.config();

const assembly = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY!,
});

const API_BASE_URL =
  process.env.API_BASE_URL || "http://localhost:5000";

async function sendCaptionToServer(
  streamUrl: string,
  text: string
): Promise<void> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/streams/captions/${encodeURIComponent(
        streamUrl
      )}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      }
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    console.log(`[Audio Processor] Caption processed for ${streamUrl}`);
  } catch (error) {
    console.error("[Audio Processor] Caption upload failed:", error);
    throw error;
  }
}

const tempDir = join(process.cwd(), "temp");

async function processAudioFile(
  wavFilePath: string,
  metadataFilePath: string
) {
  try {
    const metadataContent = await fs.readFile(metadataFilePath, "utf-8");
    const metadata = JSON.parse(metadataContent);
    const filename = wavFilePath.split("/").pop();
    console.log(
      `[Audio Processor] Processing ${filename}`
    );

    const transcript = await assembly.transcripts.transcribe({
      audio: wavFilePath,
    });

    if (transcript.text) {
      await sendCaptionToServer(metadata.streamUrl, transcript.text);
    } else {
      console.log("[Audio Processor] No transcription generated");
    }
  } catch (error) {
    console.error("[Audio Processor] Transcription failed:", error);
  } finally {
    // Cleanup files with existence check
    for (const filePath of [wavFilePath, metadataFilePath]) {
      try {
        const exists = await fs.access(filePath)
          .then(() => true)
          .catch(() => false);

        if (exists) {
          await fs.unlink(filePath);
          const filename = filePath.split("/").pop();
          console.log(`[Audio Processor] Cleaned up ${filename}`);
        }
      } catch (err) {
        console.error("[Audio Processor] Cleanup failed:", err);
      }
    }
  }
}

// Scan temp/ and process enqueued files
async function scanAndProcess() {
  try {
    const files = await fs.readdir(tempDir);
    // We expect WAV files and matching JSON files.
    const wavFiles = files.filter((f) => f.endsWith(".wav"));
    for (const wavFile of wavFiles) {
      const baseName = wavFile.slice(0, -4); // remove '.wav'
      const metadataFile = baseName + ".json";
      const wavPath = join(tempDir, wavFile);
      const metadataPath = join(tempDir, metadataFile);
      try {
        // Check that the metadata file exists
        await fs.access(metadataPath);
        // Process the file pair
        await processAudioFile(wavPath, metadataPath);
      } catch {
        console.log(
          `[Audio Processor] Waiting for metadata: ${wavFile}`
        );
      }
    }
  } catch (error) {
    console.error("[Audio Processor] Directory scan failed:", error);
  }
}

export function startAudioQueueProcessor() {
  setInterval(scanAndProcess, 30000);
  console.log("[Audio Processor] Started (30s scan interval)");
}
