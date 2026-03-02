const { read, utils } = require('xlsx');
const fs = require('fs');
const path = require('path');

try {
    const filePath = path.join(__dirname, 'Пропи Hobbywing.xlsx');
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = read(fileBuffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = utils.sheet_to_json(worksheet, { header: 1 });
    fs.writeFileSync('/tmp/excel_dump.json', JSON.stringify(jsonData.slice(0, 50), null, 2));
    console.log('Success: dumped first 50 rows');
} catch (err) {
    console.error('Error reading excel:', err);
}
