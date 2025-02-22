import { fetchAndUpdateTrends } from './google/trends';
import { config } from 'dotenv';

// Load env vars from the correct location
config();

async function test() {
  try {
    console.log('Testing Google Trends consumer...');
    console.log('API_BASE_URL:', process.env.API_BASE_URL);
    console.log('SERPAPI_KEY:', process.env.SERPAPI_KEY ? '✓ Present' : '✗ Missing');

    await fetchAndUpdateTrends();
    console.log('Test completed successfully');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

test(); 