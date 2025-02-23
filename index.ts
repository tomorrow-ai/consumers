import { startYoutubeLiveTranscriptions, scheduleGoogleTrendsTracking, startAudioProcessingQueue } from "./orchestrator";
import { config } from "dotenv";
config();

startYoutubeLiveTranscriptions();
scheduleGoogleTrendsTracking();
startAudioProcessingQueue();

setInterval(
  () => {
    console.log("[Consumers] Service heartbeat");
  },
  1000 * 60 * 60,
);
