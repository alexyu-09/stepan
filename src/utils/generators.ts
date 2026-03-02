import translate from 'translate';

// Configure translation engine
// Using 'google' (default) which often works for small/medium volumes without a key
// but can be switched to 'libre' or other engines if needed.
translate.engine = 'google';

const ruToEn: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    'і': 'i', 'ї': 'yi', 'є': 'ye', 'ґ': 'g'
};

export const transliterate = (text: string): string => {
    return text.split('').map(char => {
        const lowerChar = char.toLowerCase();
        const trans = ruToEn[lowerChar] || lowerChar;
        return char === char.toUpperCase() && lowerChar !== trans ? trans.toUpperCase() : trans;
    }).join('');
};

export const slugify = (text: string): string => {
    return transliterate(text)
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
};

export const generateSku = (name: string, prefix: string): string => {
    let cleanName = slugify(name);
    cleanName = cleanName.replace(/^(akcumulyator|akumulyator|akkumulyator|regulyator-napryazheniya|regulyator-zhivlennya|motor-beskollektornyj|motor-bezkolektornyj)\b-?/i, '');
    const sku = prefix ? `${prefix}-${cleanName}` : cleanName;
    return sku.toUpperCase();
};

export const generateAlias = (name: string): string => {
    return slugify(name);
};

export const extractBrand = (name: string): string => {
    if (!name) return '';
    const latinMatch = name.match(/[a-zA-Z]{2,}/);
    if (latinMatch) return latinMatch[0];
    const firstWord = name.split(/[\s,]+/)[0];
    return firstWord || '';
};

// Internal cache to avoid redundant API calls during bulk processing
const translationCache: Record<string, string> = {
    'аккумулятор': 'акумулятор',
    'акумулятор': 'аккумулятор'
};

// Cache for AI-generated descriptions
const descriptionCache: Record<string, string> = {};

/**
 * Generates a template-based description as a fallback.
 */
const generateTemplateDescription = (name: string, brand?: string): string => {
    const brandPart = brand ? ` от ${brand}` : '';
    return `${name}${brandPart}. Высокое качество и надёжность. Идеальное решение для профессионального использования. Полные характеристики уточняйте у менеджера.`;
};

/**
 * Generates product descriptions in batch using Google Gemini AI.
 * Sends up to 20 products per request for efficiency.
 * Returns a Map of product name -> description (RU).
 */
export const generateDescriptionsBatch = async (
    products: { name: string; brand?: string; sku?: string }[]
): Promise<Map<string, string>> => {
    const resultMap = new Map<string, string>();

    if (products.length === 0) return resultMap;

    // Separate cached and uncached products
    const uncached: { name: string; brand?: string; sku?: string }[] = [];
    for (const p of products) {
        const cacheKey = `desc:${p.name}`;
        if (descriptionCache[cacheKey]) {
            resultMap.set(p.name, descriptionCache[cacheKey]);
        } else {
            uncached.push(p);
        }
    }

    if (uncached.length === 0) return resultMap;

    // Process in chunks of 20
    const CHUNK_SIZE = 20;
    for (let i = 0; i < uncached.length; i += CHUNK_SIZE) {
        const chunk = uncached.slice(i, i + CHUNK_SIZE);
        try {
            const apiBase = import.meta.env.DEV ? '' : '';
            const resp = await fetch(`${apiBase}/api/generate-description`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ products: chunk }),
            });

            if (!resp.ok) {
                throw new Error(`API returned ${resp.status}`);
            }

            const data = await resp.json();
            if (data.descriptions && Array.isArray(data.descriptions)) {
                for (const item of data.descriptions) {
                    if (item.description) {
                        const cacheKey = `desc:${item.name}`;
                        descriptionCache[cacheKey] = item.description;
                        resultMap.set(item.name, item.description);
                    }
                }
            }
        } catch (error) {
            console.warn(`Description batch generation failed for chunk ${i / CHUNK_SIZE + 1}:`, error);
            // Fallback to template for this chunk
            for (const p of chunk) {
                const fallback = generateTemplateDescription(p.name, p.brand);
                const cacheKey = `desc:${p.name}`;
                descriptionCache[cacheKey] = fallback;
                resultMap.set(p.name, fallback);
            }
        }
    }

    // Fill any remaining products that didn't get a description with template
    for (const p of products) {
        if (!resultMap.has(p.name)) {
            const fallback = generateTemplateDescription(p.name, p.brand);
            resultMap.set(p.name, fallback);
        }
    }

    return resultMap;
};

/**
 * Specialized translation function that uses an external library.
 * It translates Russian text to Ukrainian.
 */
export const translateToUA = async (text: string): Promise<string> => {
    if (!text || text.length < 2) return text;

    const cacheKey = `ru-ua:${text}`;
    if (translationCache[cacheKey]) return translationCache[cacheKey];

    try {
        // We use the 'translate' library for robust machine translation
        const translated = await translate(text, { from: 'ru', to: 'uk' });
        translationCache[cacheKey] = translated;
        return translated;
    } catch (error) {
        console.warn('Translation to UA failed, using original text:', error);
        return text;
    }
};

/**
 * Specialized translation function that uses an external library.
 * It translates Ukrainian text to Russian.
 */
export const translateToRU = async (text: string): Promise<string> => {
    if (!text || text.length < 2) return text;

    const cacheKey = `ua-ru:${text}`;
    if (translationCache[cacheKey]) return translationCache[cacheKey];

    try {
        const translated = await translate(text, { from: 'uk', to: 'ru' });
        translationCache[cacheKey] = translated;
        return translated;
    } catch (error) {
        console.warn('Translation to RU failed, using original text:', error);
        return text;
    }
};

