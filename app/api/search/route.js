import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Using DuckDuckGo Instant Answer API (free, no API key needed)
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    );

    const data = await response.json();

    // Extract results
    const results = [];

    // Add main result if available
    if (data.AbstractURL && data.AbstractText) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL,
        description: data.AbstractText,
      });
    }

    // Add related topics
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      data.RelatedTopics.forEach((topic) => {
        if (topic.FirstURL && topic.Text) {
          results.push({
            title: topic.Text.split(' - ')[0] || topic.Text.substring(0, 100),
            url: topic.FirstURL,
            description: topic.Text,
          });
        }
      });
    }

    // If no results from DuckDuckGo, create a Google search suggestion
    if (results.length === 0) {
      results.push({
        title: `Search Google for "${query}"`,
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        description: 'Open Google search in new tab',
      });
    }

    // Limit to 10 results
    return NextResponse.json({ results: results.slice(0, 10) });

  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Search failed', results: [] },
      { status: 500 }
    );
  }
}