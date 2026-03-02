import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const imageUrl = req.query.url as string;
    if (!imageUrl) return res.status(400).json({ error: 'Missing query parameter "url"' });

    try {
        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/*,*/*;q=0.8',
                'Referer': new URL(imageUrl).origin,
            },
            redirect: 'follow',
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: `Failed to fetch image: ${response.statusText}` });
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const buffer = Buffer.from(await response.arrayBuffer());

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(buffer);
    } catch (err: any) {
        console.error('Image proxy error:', err);
        return res.status(500).json({ error: 'Failed to proxy image', details: err.message });
    }
}
