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

    do {
      console.log(`Fetching page ${requestCount + 1}, current items: ${allItems.length}`);

      const pageSize = Math.min(50, maxResults - allItems.length);
      const params = new URLSearchParams({
        part: 'snippet',
        eventType: 'live',
        type: 'video',
        order: 'viewCount',
        maxResults: pageSize.toString(), // YouTube API max is 50 per request
        key: process.env.YOUTUBE_API_KEY!,
        relevanceLanguage: 'en',
        ...(nextPageToken && { pageToken: nextPageToken })
      });

      const url = `https://www.googleapis.com/youtube/v3/search?${params}`;
      console.log(`Request URL (without key): ${url.replace(process.env.YOUTUBE_API_KEY!, 'REDACTED')}`);

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const data = await response.json() as YouTubeApiResponse;
      allItems = [...allItems, ...data.items];
      nextPageToken = data.nextPageToken;
      requestCount++;

      console.log(`Page ${requestCount} complete. Total items: ${allItems.length}, Next page token: ${nextPageToken || 'none'}`);

    } while (nextPageToken && allItems.length < maxResults);

    console.log(`Final results: ${allItems.length} items fetched`);

    return allItems.map((stream) => ({
      stream_url: `https://www.youtube.com/watch?v=${stream.id.videoId}`,
      title: stream.snippet.title
    }));
  } catch (error) {
    console.error('Error fetching YouTube live streams:', error);
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
    console.error('Error registering stream:', error);
    throw error;
  }
}

export async function filterOnlyNews(streams: { stream_url: string; title: string }[]) {
  const newsStreams = await Promise.all(
    streams.map(stream => isNewsStream({ title: stream.title }))
  );
  const filteredStreams = streams.filter((stream, index) => newsStreams[index]);
  return filteredStreams;
}

export async function resetAllTracking() {
  try {
    const response = await fetch(`${API_BASE_URL}/streams/reset-tracking`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error resetting tracking status:', error);
    throw error;
  }
}