// app/api/metadata/route.js
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ 
        error: 'URL is required',
        title: 'Untitled' 
      }, { status: 400 });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ 
        error: 'Invalid URL',
        title: 'Untitled',
        url 
      }, { status: 400 });
    }

    console.log('Fetching metadata for:', url);

    // Fetch with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.error('Fetch failed with status:', response.status);
        return NextResponse.json({ 
          title: url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0],
          url 
        });
      }

      const html = await response.text();

      // Extract title using multiple methods
      let title = '';

      // Try Open Graph title
      const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
      if (ogTitleMatch) {
        title = ogTitleMatch[1];
      }

      // Try Twitter title
      if (!title) {
        const twitterTitleMatch = html.match(/<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i);
        if (twitterTitleMatch) {
          title = twitterTitleMatch[1];
        }
      }

      // Try regular title tag
      if (!title) {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
          title = titleMatch[1];
        }
      }

      // Decode HTML entities
      if (title) {
        title = title
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .replace(/&nbsp;/g, ' ')
          .trim();
      }

      // Fallback to domain name if no title found
      if (!title) {
        title = url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
      }

      console.log('Metadata extracted successfully:', title);

      return NextResponse.json({ 
        title: title || 'Untitled',
        url 
      });

    } catch (fetchError) {
      clearTimeout(timeout);
      
      if (fetchError.name === 'AbortError') {
        console.error('Request timeout for:', url);
        return NextResponse.json({ 
          title: url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0],
          url 
        });
      }

      throw fetchError;
    }

  } catch (error) {
    console.error('Metadata route error:', error);
    
    // Return a friendly fallback instead of failing
    const url = new URL(request.url).searchParams.get('url') || '';
    const fallbackTitle = url ? url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : 'Untitled';
    
    return NextResponse.json({ 
      title: fallbackTitle,
      url: url || '',
      warning: 'Could not fetch full metadata'
    });
  }
}

// Use Node.js runtime for better compatibility
export const runtime = 'nodejs';