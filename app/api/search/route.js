// app/api/search/route.js
// Alternative: Using SerpAPI (requires API key) or a simpler approach

import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // OPTION A: Using SerpAPI (recommended - sign up at serpapi.com for free tier)
    const SERP_API_KEY = process.env.SERP_API_KEY;
    
    if (SERP_API_KEY) {
      const serpUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${SERP_API_KEY}&num=10`;
      
      const response = await fetch(serpUrl);
      
      if (response.ok) {
        const data = await response.json();
        const results = (data.organic_results || []).map(item => ({
          title: item.title,
          url: item.link,
          description: item.snippet
        }));
        
        return NextResponse.json({ results });
      }
    }

    // OPTION B: Fallback - DuckDuckGo HTML scraping (no API key needed, but less reliable)
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    
    const response = await fetch(ddgUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error('Search request failed');
    }

    const html = await response.text();
    
    // Parse DuckDuckGo results (basic regex parsing)
    const results = [];
    const resultRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([^<]+)</g;
    
    let match;
    while ((match = resultRegex.exec(html)) !== null && results.length < 10) {
      results.push({
        title: match[2].trim(),
        url: decodeURIComponent(match[1]),
        description: match[3].trim()
      });
    }

    return NextResponse.json({ results });

  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ 
      error: 'Search failed',
      details: error.message,
      results: [] 
    }, { status: 500 });
  }
}

// Add runtime config for Vercel
export const runtime = 'edge'; // Use edge runtime for faster responses