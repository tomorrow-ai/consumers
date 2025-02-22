import { transcribeStream } from "./yt/transcriber";
import { getTopLiveStreams, filterOnlyNews, registerStream, resetAllTracking } from "./yt/lookup";
import { fetchAndUpdateTrends } from "./google/trends";

export const startYoutubeLiveTranscriptions = async () => {
  await resetAllTracking();
  const streams = await getTopLiveStreams(100);
  console.log(`Found ${streams.length} streams`);
  const newsStreams = await filterOnlyNews(streams);
  console.log(`Found ${newsStreams.length} news streams`);

  for (const stream of newsStreams) {
    try {
      await registerStream(stream);
      transcribeStream(stream.stream_url);
    } catch (error: any) {
      if (!error.message.includes('Duplicate')) {
        console.error(`Failed to process stream ${stream.stream_url}:`, error);
        continue;
      }
    }
  }
}

export const startGoogleTrendsTracking = async () => {
  try {
    await fetchAndUpdateTrends();
  } catch (error) {
    console.error('Failed to fetch and update Google Trends:', error);
  }
}

export const scheduleGoogleTrendsTracking = () => {
  startGoogleTrendsTracking();
  setInterval(startGoogleTrendsTracking, 15 * 60 * 1000);
}

