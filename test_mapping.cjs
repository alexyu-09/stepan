const { mapToSchema } = require('./src/utils/mapper');
const { TARGET_COLUMNS } = require('./src/constants/schema');
const fs = require('fs');

// Mock generators since we are in CJS
global.transliterate = (t) => t;
global.slugify = (t) => t;
global.generateSku = (n, p) => p + n;
global.generateAlias = (n) => n;
global.translateToRU = (t) => t;
global.translateToUA = (t) => t;

try {
    const rawData = JSON.parse(fs.readFileSync('/tmp/excel_dump.json', 'utf8'));
    console.log('Testing with raw data (50 rows)...');

    // Simulate useFileProcessing's formatting
    const startRow = 1;
    const rows = rawData;
    const dataRows = rows.slice(startRow);
    const headers = (rows[startRow] || []).map(h => String(h || ''));

    const formattedRows = dataRows.slice(1)
        .filter(row => Array.isArray(row) && row.some(cell => cell !== null && cell !== undefined && cell !== ''))
        .map(row => {
            const obj = {};
            row.forEach((cell, i) => {
                const key = headers[i] || `Column_${i}`;
                obj[key] = cell;
            });
            return obj;
        });

    console.log('Formatted rows:', formattedRows.length);
    const result = mapToSchema(formattedRows, 'S-IV');
    console.log('Success! Resulting data length:', result.length);
} catch (err) {
    console.error('CRASH DETECTED:', err);
}
