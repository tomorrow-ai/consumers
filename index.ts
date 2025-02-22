import { startYoutubeLiveTranscriptions, scheduleGoogleTrendsTracking } from "./orchestrator";

import { config } from "dotenv";
config();

// Start YouTube live transcriptions
startYoutubeLiveTranscriptions();

// Start Google Trends tracking
scheduleGoogleTrendsTracking();

// Keep the process alive
setInterval(
  () => {
    console.log("consumers is running")
  },
  1000 * 60 * 60,
);
