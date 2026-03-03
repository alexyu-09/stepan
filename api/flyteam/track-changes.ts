import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export const config = {
    maxDuration: 60, // Maximum allowed by Vercel Hobby is 10s, Pro 60s
};

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 1. Fetch products from DB
        const { data: products, error: dbError } = await supabase
            .from('flyteam_products')
            .select('*');

        if (dbError) throw dbError;
        if (!products || products.length === 0) {
            return res.status(200).json({ changes: [], message: 'No products to track in DB.' });
        }

        const changes = [];

        // Process in small batches or sequentially to avoid hitting limits
        for (const product of products) {
            if (!product.url) continue;

            try {
                const response = await fetch(product.url);
                if (!response.ok) continue;

                const html = await response.text();
                const $ = cheerio.load(html);

                let newAvailability = '';
                let newPrice = '';

                $('ul.list-unstyled li').each((i, el) => {
                    const text = $(el).text();
                    if (text.includes('Наявність:')) {
                        newAvailability = text.replace('Наявність:', '').trim();
                    }
                });

                $('h2').each((i, el) => {
                    const text = $(el).text().trim();
                    if (text.includes('грн')) {
                        newPrice = text;
                    }
                });

                if (!newPrice) {
                    newPrice = $('.price').first().text().replace(/\s+/g, ' ').trim();
                }

                // Compare
                if (product.availability !== newAvailability || product.price !== newPrice) {
                    changes.push({
                        id: product.id,
                        url: product.url,
                        name: product.name,
                        oldAvailability: product.availability,
                        newAvailability: newAvailability,
                        oldPrice: product.price,
                        newPrice: newPrice
                    });

                    // Update DB
                    await supabase
                        .from('flyteam_products')
                        .update({
                            availability: newAvailability,
                            price: newPrice,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', product.id);
                }

            } catch (fetchErr) {
                console.error(`Error tracking product ${product.url}:`, fetchErr);
            }
        }

        return res.status(200).json({ changes, message: `Checked ${products.length} products.` });
    } catch (error: any) {
        console.error('Error tracking changes:', error);
        return res.status(500).json({ error: error.message || 'Unknown error occurred' });
    }
}
