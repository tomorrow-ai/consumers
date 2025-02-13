import { startYoutubeLiveTranscriptions } from "./orchestrator";

import { config } from "dotenv";
config();

startYoutubeLiveTranscriptions();

setInterval(
  () => {
    // keep alive
  },
  1000 * 60 * 60,
);
