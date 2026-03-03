import * as cheerio from 'cheerio';

export const config = {
    maxDuration: 60,
};

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const response = await fetch('https://flyteam.com.ua/');

        if (!response.ok) {
            throw new Error(`Failed to fetch flyteam: ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const categories: Array<{ name: string; url: string }> = [];

        $('ul.nav.navbar-nav > li > a').each((i, el) => {
            const name = $(el).text().trim();
            const url = $(el).attr('href');

            // Filter out non-category links if any, usually valid ones start with http
            if (name && url && url.startsWith('http')) {
                categories.push({ name, url });
            }
        });

        return res.status(200).json({ categories });
    } catch (error: any) {
        console.error('Error parsing categories:', error);
        return res.status(500).json({ error: error.message || 'Unknown error occurred' });
    }
}
