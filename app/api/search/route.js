import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({ 
        error: 'Query is required',
        results: [] 
      }, { status: 400 });
    }

    console.log('Search query:', query);

    // Try SerpAPI first (if API key exists)
    const SERP_API_KEY = process.env.SERP_API_KEY;
    
    if (SERP_API_KEY) {
      console.log('Using SerpAPI...');
      try {
        const serpUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${SERP_API_KEY}&num=10`;
        
        const response = await fetch(serpUrl);
        
        if (response.ok) {
          const data = await response.json();
          const results = (data.organic_results || []).map(item => ({
            title: item.title,
            url: item.link,
            description: item.snippet || ''
          }));
          
          console.log('SerpAPI success, results:', results.length);
          return NextResponse.json({ results });
        } else {
          console.error('SerpAPI error:', response.status);
        }
      } catch (serpError) {
        console.error('SerpAPI exception:', serpError.message);
      }
    }

    // Try Google Custom Search (if API key exists)
    const GOOGLE_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
    const SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;
    
    if (GOOGLE_API_KEY && SEARCH_ENGINE_ID) {
      console.log('Using Google Custom Search...');
      try {
        const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}`;
        
        const response = await fetch(googleUrl);
        
        if (response.ok) {
          const data = await response.json();
          const results = (data.items || []).slice(0, 10).map(item => ({
            title: item.title,
            url: item.link,
            description: item.snippet || ''
          }));
          
          console.log('Google Custom Search success, results:', results.length);
          return NextResponse.json({ results });
        } else {
          console.error('Google Custom Search error:', response.status);
        }
      } catch (googleError) {
        console.error('Google Custom Search exception:', googleError.message);
      }
    }

    // Fallback: Use a simple mock search or return helpful message
    console.log('No API keys configured, returning mock results...');
    
    // Return mock results with helpful message
    const mockResults = [
      {
        title: `Search API Not Configured - Showing mock result for: ${query}`,
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        description: 'To enable real search results, add SERP_API_KEY or GOOGLE_SEARCH_API_KEY to your environment variables. Click here to search on Google instead.'
      },
      {
        title: 'How to Enable Search',
        url: 'https://serpapi.com',
        description: 'Sign up for a free SerpAPI account (100 searches/month) and add SERP_API_KEY to your Vercel environment variables.'
      },
      {
        title: 'Alternative: Google Custom Search',
        url: 'https://programmablesearchengine.google.com',
        description: 'Or use Google Custom Search API - create a search engine and add GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID.'
      }
    ];

    return NextResponse.json({ 
      results: mockResults,
      warning: 'Using mock results - add API keys for real search'
    });

  } catch (error) {
    console.error('Search route error:', error);
    return NextResponse.json({ 
      error: 'Search failed',
      details: error.message,
      results: []
    }, { status: 500 });
  }
}

// Use Node.js runtime for better compatibility
export const runtime = 'nodejs';
