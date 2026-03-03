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
            throw new Error(`Failed to fetch product url: ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const name = $('h1').first().text().trim();

        let sku = '';
        let availability = '';

        $('ul.list-unstyled li').each((i, el) => {
            const text = $(el).text();
            if (text.includes('Код товару:')) {
                sku = text.replace('Код товару:', '').trim();
            } else if (text.includes('Модель:')) {
                // Alternative to Код товару
                sku = text.replace('Модель:', '').trim();
            }
            if (text.includes('Наявність:')) {
                availability = text.replace('Наявність:', '').trim();
            }
        });

        // Price usually in h2 somewhere in right column
        let price = '';
        $('h2').each((i, el) => {
            const text = $(el).text().trim();
            if (text.includes('грн')) {
                price = text;
            }
        });

        // Try finding exact price class
        if (!price) {
            price = $('.price').first().text().replace(/\s+/g, ' ').trim();
        }

        // Clean price string to contain only digits (since the DB column is NUMERIC)
        price = price.replace(/[^\d.]/g, '');

        const image_url = $('.thumbnails img').first().attr('src') || '';
        const description = $('#tab-description').html()?.trim() || '';

        // Here we can either just return the parsed data, or we could save it to Supabase directly here.
        // For separation of concerns, this API will also handle saving to Supabase if Supabase client is initialized.
        // Since we also want to batch process, let's just return the data first. The client UI can then send it to save to DB, or we can save it server side.
        const productData = {
            name,
            sku,
            availability,
            price,
            image_url,
            description,
            url
        };

        return res.status(200).json({ product: productData });
    } catch (error: any) {
        console.error('Error parsing product:', error);
        return res.status(500).json({ error: error.message || 'Unknown error occurred' });
    }
}
