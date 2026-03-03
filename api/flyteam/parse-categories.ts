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

        $('ul.nav.navbar-nav > li').each((i, el) => {
            const topLink = $(el).children('a').first();
            const topName = topLink.text().trim();
            const topUrl = topLink.attr('href');

            if (!topName || !topUrl || !topUrl.startsWith('http')) return;

            const subLinks = $(el).find('.dropdown-inner ul li a');
            if (subLinks.length > 0) {
                subLinks.each((j, sub) => {
                    const subName = $(sub).text().trim();
                    const subUrl = $(sub).attr('href');
                    if (subUrl && subUrl.startsWith('http')) {
                        categories.push({ name: `${topName} > ${subName}`, url: subUrl });
                    }
                });

                if (topUrl && topUrl.startsWith('http')) {
                    categories.push({ name: `${topName} (Все)`, url: topUrl });
                }
            } else {
                categories.push({ name: topName, url: topUrl });
            }
        });

        return res.status(200).json({ categories });
    } catch (error: any) {
        console.error('Error parsing categories:', error);
        return res.status(500).json({ error: error.message || 'Unknown error occurred' });
    }
}
