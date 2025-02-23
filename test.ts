import { fetchAndUpdateTrends } from './google/trends';
import { config } from 'dotenv';

// Load env vars from the correct location
config();

async function test() {
  try {
    console.log('[Test] Starting Google Trends consumer test');
    console.log('[Test] Environment check:');
    console.log('  API_BASE_URL:', process.env.API_BASE_URL);
    console.log('  SERPAPI_KEY:', process.env.SERPAPI_KEY ? '✓' : '✗');

    await fetchAndUpdateTrends();
    console.log('[Test] Completed successfully');
  } catch (error) {
    console.error('[Test] Failed:', error);
  }
}

test(); 