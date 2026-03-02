import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const query = req.query.q as string;
    if (!query) return res.status(400).json({ error: 'Missing query parameter "q"' });

    try {
        // Use DuckDuckGo image search API — free, no API key needed
        const ddgToken = await getDDGToken(query);
        if (!ddgToken) {
            // Fallback: use Google Images scraping
            const images = await scrapeGoogleImages(query);
            return res.status(200).json({ images });
        }

        const images = await searchDDGImages(query, ddgToken);
        return res.status(200).json({ images });
    } catch (err: any) {
        console.error('Image search error:', err);
        return res.status(500).json({ error: 'Image search failed', details: err.message });
    }
}

async function getDDGToken(query: string): Promise<string | null> {
    try {
        const resp = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const text = await resp.text();
        const match = text.match(/vqd=([^&"']+)/);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

async function searchDDGImages(query: string, token: string): Promise<{ url: string; thumbnail: string; title: string }[]> {
    const resp = await fetch(
        `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${token}&f=,,,,,&p=1`,
        {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        }
    );
    const data = await resp.json();
    const results = (data.results || []).slice(0, 8);
    return results.map((r: any) => ({
        url: r.image || r.url,
        thumbnail: r.thumbnail || r.image || r.url,
        title: r.title || ''
    }));
}

async function scrapeGoogleImages(query: string): Promise<{ url: string; thumbnail: string; title: string }[]> {
    const resp = await fetch(
        `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch&ijn=0`,
        {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        }
    );
    const html = await resp.text();

    // Extract image URLs from Google Images HTML
    const images: { url: string; thumbnail: string; title: string }[] = [];

    // Find data blocks that contain image info
    const imgRegex = /\["(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp|gif)[^"]*)"/gi;
    const matches = html.matchAll(imgRegex);

    const seen = new Set<string>();
    for (const match of matches) {
        const url = match[1];
        // Filter out Google's own URLs and thumbnails
        if (url.includes('google.com') || url.includes('gstatic.com') || url.includes('googleapis.com')) continue;
        if (seen.has(url)) continue;
        seen.add(url);
        images.push({ url, thumbnail: url, title: '' });
        if (images.length >= 8) break;
    }

    return images;
}
