import * as cheerio from 'cheerio';

export const config = {
    maxDuration: 60,
};

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to fetch category url: ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const products: Array<{ name: string; url: string; price: string }> = [];

        $('.product-layout').each((i, el) => {
            const titleEl = $(el).find('.caption h4 a');
            const name = titleEl.text().trim();
            const productUrl = titleEl.attr('href');
            const price = $(el).find('.price').text().replace(/\s+/g, ' ').trim();

            if (name && productUrl) {
                products.push({ name, url: productUrl, price });
            }
        });

        // Determine total pages by looking at pagination text if necessary (or just return next page link)
        let nextPage = '';
        $('.pagination li a').each((i, el) => {
            if ($(el).text().includes('>')) {
                nextPage = $(el).attr('href') || '';
            }
        });

        return res.status(200).json({ products, nextPage });
    } catch (error: any) {
        console.error('Error parsing catalog:', error);
        return res.status(500).json({ error: error.message || 'Unknown error occurred' });
    }
}
