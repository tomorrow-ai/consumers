import { generateObject } from 'ai'
import { z } from 'zod'
import { openai } from '@ai-sdk/openai'

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000'

interface YouTubeLiveStream {
  id: {
    videoId: string;
  };
  snippet: {
    title: string;
  };
}

interface YouTubeApiResponse {
  items: YouTubeLiveStream[];
  nextPageToken?: string;
}

export async function getTopLiveStreams(maxResults: number = 100) {
  try {
    let allItems: YouTubeLiveStream[] = [];
    let nextPageToken: string | undefined;
    let requestCount = 0;

    console.log(`[YT Lookup] Fetching top ${maxResults} live streams...`);

    do {
      const pageSize = Math.min(50, maxResults - allItems.length);
      const params = new URLSearchParams({
        part: 'snippet',
        eventType: 'live',
        type: 'video',
        order: 'viewCount',
        maxResults: pageSize.toString(),
        key: process.env.YOUTUBE_API_KEY!,
        relevanceLanguage: 'en',
        ...(nextPageToken && { pageToken: nextPageToken })
      });

      const url = `https://www.googleapis.com/youtube/v3/search?${params}`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const data = await response.json() as YouTubeApiResponse;
      allItems = [...allItems, ...data.items];
      nextPageToken = data.nextPageToken;
      requestCount++;

    } while (nextPageToken && allItems.length < maxResults);

    console.log(`[YT Lookup] Found ${allItems.length} live streams`);

    return allItems.map((stream) => ({
      stream_url: `https://www.youtube.com/watch?v=${stream.id.videoId}`,
      title: stream.snippet.title
    }));
  } catch (error) {
    console.error('[YT Lookup] Failed to fetch live streams:', error);
    throw error;
  }
}

export async function isNewsStream(stream: { title: string }) {
  const { object } = await generateObject({
    model: openai("gpt-4o"),
    schema: z.object({
      isNews: z.boolean(),
    }),
    prompt: `Given the following stream title, determine if it is a news stream or about current evens.
    Stream Title: ${stream.title}`,
  });

  return object.isNews;
}

export async function registerStream(stream: { stream_url: string; title: string }): Promise<{ tracking: boolean }> {
  try {
    const response = await fetch(`${API_BASE_URL}/streams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: stream.stream_url,
        title: stream.title,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { tracking: data.tracking };
  } catch (error) {
    console.error('[YT Lookup] Failed to register stream:', error);
    throw error;
  }
}

export async function filterOnlyNews(streams: { stream_url: string; title: string }[]) {
  console.log(`[YT Lookup] Filtering ${streams.length} streams for news content...`);
  const newsStreams = await Promise.all(
    streams.map(stream => isNewsStream({ title: stream.title }))
  );
  const filteredStreams = streams.filter((stream, index) => newsStreams[index]);
  console.log(`[YT Lookup] Found ${filteredStreams.length} news streams`);
  return filteredStreams;
}

export async function resetAllTracking() {
  try {
    console.log('[YT Lookup] Resetting stream tracking status...');
    const response = await fetch(`${API_BASE_URL}/streams/reset-tracking`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('[YT Lookup] Stream tracking reset complete');
    return await response.json();
  } catch (error) {
    console.error('[YT Lookup] Failed to reset tracking status:', error);
    throw error;
  }
}