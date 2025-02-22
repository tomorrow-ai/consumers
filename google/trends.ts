import { getJson } from 'serpapi';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface TrendItem {
  query: string;
  start_timestamp: number;
  end_timestamp: number;
  active: boolean;
  search_volume: number;
  increase_percentage: number;
  categories: string[];
  trend_breakdown: string[];
  serpapi_google_trends_link: string;
}

interface TrendingSearchResponse {
  trending_searches: TrendItem[];
}

export async function getTrendingSearches(region: string = 'US') {
  try {
    const response = await new Promise<TrendingSearchResponse>((resolve, reject) => {
      getJson({
        engine: "google_trends_trending_now",
        geo: region,
        api_key: process.env.SERPAPI_KEY
      }, (json) => {
        resolve(json as TrendingSearchResponse);
      });
    });
    return response.trending_searches;
  } catch (error) {
    console.error('Error fetching trending searches:', error);
    throw error;
  }
}

export async function fetchAndUpdateTrends() {
  try {
    const trends = await getTrendingSearches();

    // Post each trend to the server
    for (const trend of trends) {
      const startTimestamp = new Date(trend.start_timestamp * 1000);
      const endTimestamp = trend.end_timestamp ? new Date(trend.end_timestamp * 1000) : null;

      await fetch(`${process.env.API_BASE_URL}/trends`, {
        method: 'POST',
        body: JSON.stringify({
          query: trend.query,
          searchVolume: trend.search_volume,
          increasePercentage: trend.increase_percentage,
          categories: trend.categories,
          trendBreakdown: trend.trend_breakdown,
          active: trend.active,
          startTimestamp,
          endTimestamp
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    console.log(`Successfully updated ${trends.length} trends`);
  } catch (error) {
    console.error('Error updating trends:', error);
  }
}

if (require.main === module) {
  fetchAndUpdateTrends().catch(console.error);
}