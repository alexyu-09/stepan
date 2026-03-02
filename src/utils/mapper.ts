import { TARGET_COLUMNS } from '../constants/schema';
import { generateSku, generateAlias, translateToRU, translateToUA, extractBrand, generateDescriptionsBatch } from './generators';

export interface RawRow {
    [key: string]: any;
}

export const mapToSchema = async (rawRows: RawRow[], skuPrefix: string): Promise<any[][]> => {
    // First row is headers
    const result: any[][] = [TARGET_COLUMNS];

    // Pre-detect columns once to optimize performance
    let priceKey = '';
    let brandKey = '';

    if (rawRows.length > 0) {
        const firstRow = rawRows[0];
        const keys = Object.keys(firstRow);
        priceKey = keys.find(k => {
            if (!k) return false;
            const l = k.toLowerCase();
            return l.includes('цена') || l.includes('ціна') || l.includes('price');
        }) || '';
        brandKey = keys.find(k => {
            if (!k) return false;
            const l = k.toLowerCase();
            return l.includes('бренд') || l.includes('brand');
        }) || '';
    }

    // --- Phase 1: Collect product data for batch description generation ---
    const productList: { name: string; brand?: string; sku?: string; rowIndex: number }[] = [];

    for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];
        const keys = Object.keys(row);
        const nameKey = row['__mapped_name'] ? '__mapped_name' :
            keys.find(key => {
                if (!key) return false;
                const k = key.toLowerCase();
                return k.includes('название') || k.includes('назва') || k.includes('name') || k.includes('товар');
            }) ||
            keys.find(key => key && key.toLowerCase().includes('арт'));

        const name = nameKey ? String(row[nameKey]) : '';
        if (name) {
            const mappedBrand = row['__mapped_brand'] || (brandKey ? row[brandKey] : undefined);
            const brand = mappedBrand ? String(mappedBrand) : extractBrand(name);
            const sku = generateSku(name, skuPrefix);
            productList.push({ name, brand, sku, rowIndex: i });
        }
    }

    // --- Phase 2: Batch-generate descriptions via AI ---
    let descriptionMap = new Map<string, string>();
    if (productList.length > 0) {
        try {
            descriptionMap = await generateDescriptionsBatch(
                productList.map(p => ({ name: p.name, brand: p.brand, sku: p.sku }))
            );
        } catch (error) {
            console.warn('Batch description generation failed, descriptions will be empty:', error);
        }
    }

    // --- Phase 3: Process rows with translations and descriptions ---
    const rowPromises = rawRows.map(async (row) => {
        const newRow = new Array(TARGET_COLUMNS.length).fill('');

        // Find name column (prioritize manual mapping)
        const keys = Object.keys(row);
        const nameKey = row['__mapped_name'] ? '__mapped_name' :
            keys.find(key => {
                if (!key) return false;
                const k = key.toLowerCase();
                return k.includes('название') || k.includes('назва') || k.includes('name') || k.includes('товар');
            }) ||
            keys.find(key => key && key.toLowerCase().includes('арт')); // Only if no better match

        const name = nameKey ? String(row[nameKey]) : '';
        const targetLang = row['__target_name_lang'] || 'RU';

        if (name) {
            const sku = generateSku(name, skuPrefix);
            // Column A, B, C: SKU, Parent SKU, Display SKU (Indices 0, 1, 2)
            newRow[0] = sku;
            newRow[1] = sku;
            newRow[2] = sku;

            // Assign name to chosen language column and auto-translate to the other
            if (targetLang === 'UA') {
                newRow[4] = name; // Column F: Название(UA) (Index 4)
                newRow[3] = await translateToRU(name); // Column E: Название(RU) (Index 3)
            } else {
                newRow[3] = name; // Column E: Название(RU) (Index 3)
                newRow[4] = await translateToUA(name); // Column F: Название(UA) (Index 4)
            }

            // Column H: Алиас (Alias) - Index 7
            newRow[7] = generateAlias(name);
            // Column N: Валюта (Currency) - Index 13
            newRow[13] = 'UAH';
            // Column O: Отображать (Display) - Index 14
            newRow[14] = '1';
            // Column P: Наличие (Availability) - Index 15
            newRow[15] = 'В наявності';
            // Column AF: Состояние товара - Index 30
            newRow[30] = 'Новое';

            // --- AI-Generated Descriptions (Indices 18, 19) ---
            const descriptionRU = descriptionMap.get(name) || '';
            if (descriptionRU) {
                newRow[18] = descriptionRU; // Index 18: Описание товара(RU)
                newRow[19] = await translateToUA(descriptionRU); // Index 19: Описание товара(UA)
            }

            // Index 39: Примітки(RU)
            newRow[39] = `<p><span style="background-color:#f1c40f;">От 50-100 шт спец цена&nbsp;</span><br /><br /><span style="background-color:#f1c40f;">Достпна оплата по безналу</span></p><p><span style="background-color:#f1c40f;">Для больших заказов - оптовые цены и наличие уточняте у менеджера.</span></p>`;
            // Index 40: Примітки(UA)
            newRow[40] = `<p><span style="background-color:#f1c40f;">Від 50-100 шт спец ціна</span></p><p><span style="background-color:#f1c40f;">Достпна оплата по безготівці</span></p><p><span style="background-color:#f1c40f;">Для великих замовлень &ndash; оптові ціни та наявність уточнюйте у менеджера.</span></p>`;
        }

        // Try to map price and brand
        const mappedPrice = row['__mapped_price'] || (priceKey ? row[priceKey] : undefined);
        if (mappedPrice !== undefined && mappedPrice !== '') {
            const numericPrice = typeof mappedPrice === 'number' ? mappedPrice : parseFloat(String(mappedPrice).replace(',', '.').replace(/[^\d.]/g, ''));
            if (!isNaN(numericPrice)) {
                newRow[11] = Math.round(numericPrice); // Index 11: Цена (Price)
            } else {
                newRow[11] = mappedPrice;
            }
        }

        const mappedBrand = row['__mapped_brand'] || (brandKey ? row[brandKey] : undefined);
        if (mappedBrand) {
            newRow[8] = mappedBrand; // Index 8: Бренд (Brand)
        } else if (name) {
            newRow[8] = extractBrand(name);
        }

        return newRow;
    });

    const processedRows = await Promise.all(rowPromises);
    result.push(...processedRows);

    return result;
};

