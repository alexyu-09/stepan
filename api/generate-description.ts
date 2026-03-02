import type { VercelRequest, VercelResponse } from '@vercel/node';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `Ты — копирайтер маркетплейса. Напиши короткое коммерческое описание товара на русском языке.

Правила:
- 2-4 предложения, 150-300 символов
- Выделяй ключевые характеристики товара (если можешь определить из названия)
- Упомяни назначение товара
- Стиль: информативный, профессиональный, для карточки товара
- НЕ используй восклицательные знаки чрезмерно
- НЕ добавляй цену, контакты, доставку
- НЕ используй слова "купить", "заказать"
- Отвечай ТОЛЬКО текстом описания, без заголовков и маркировки`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
    }

    const { products } = req.body as {
        products: { name: string; brand?: string; sku?: string }[];
    };

    if (!products || !Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ error: 'Missing or empty "products" array in request body' });
    }

    // Limit batch size to prevent timeouts
    const batch = products.slice(0, 20);

    try {
        // For batches, we build a single prompt with all products for efficiency
        if (batch.length === 1) {
            const p = batch[0];
            const userPrompt = buildSinglePrompt(p.name, p.brand, p.sku);
            const description = await callGemini(userPrompt);
            return res.status(200).json({
                descriptions: [{ name: p.name, description }]
            });
        }

        // Batch mode: ask Gemini to generate descriptions for multiple products
        const userPrompt = buildBatchPrompt(batch);
        const rawResponse = await callGemini(userPrompt);
        const descriptions = parseBatchResponse(rawResponse, batch);

        return res.status(200).json({ descriptions });
    } catch (err: any) {
        console.error('Description generation error:', err);
        return res.status(500).json({
            error: 'Description generation failed',
            details: err.message
        });
    }
}

function buildSinglePrompt(name: string, brand?: string, sku?: string): string {
    let prompt = `Товар: ${name}`;
    if (brand) prompt += `\nБренд: ${brand}`;
    if (sku) prompt += `\nАртикул: ${sku}`;
    return prompt;
}

function buildBatchPrompt(products: { name: string; brand?: string; sku?: string }[]): string {
    let prompt = `Напиши описания для следующих ${products.length} товаров. Для каждого товара пиши описание на отдельной строке в формате:\n`;
    prompt += `[1] описание первого товара\n[2] описание второго товара\nи так далее.\n\nТовары:\n`;

    products.forEach((p, i) => {
        prompt += `[${i + 1}] ${p.name}`;
        if (p.brand) prompt += ` (бренд: ${p.brand})`;
        prompt += '\n';
    });

    return prompt;
}

function parseBatchResponse(
    raw: string,
    products: { name: string; brand?: string; sku?: string }[]
): { name: string; description: string }[] {
    const lines = raw.split('\n').filter(l => l.trim());
    const result: { name: string; description: string }[] = [];

    for (let i = 0; i < products.length; i++) {
        // Try to find line starting with [i+1]
        const prefix = `[${i + 1}]`;
        let desc = lines.find(l => l.trim().startsWith(prefix));

        if (desc) {
            desc = desc.replace(prefix, '').trim();
        } else if (lines[i]) {
            // Fallback: use line by index
            desc = lines[i].replace(/^\[\d+\]\s*/, '').trim();
        } else {
            desc = '';
        }

        result.push({ name: products[i].name, description: desc });
    }

    return result;
}

async function callGemini(userPrompt: string): Promise<string> {
    const body = {
        contents: [
            {
                parts: [
                    { text: SYSTEM_PROMPT + '\n\n' + userPrompt }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
        }
    };

    const resp = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(`Gemini API returned ${resp.status}: ${errorText}`);
    }

    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        throw new Error('No text in Gemini response');
    }

    return text.trim();
}
