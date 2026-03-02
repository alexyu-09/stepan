import { useState, useCallback } from 'react';
import { read, utils, writeFile } from 'xlsx';
import Papa from 'papaparse';
import { mapToSchema, type RawRow } from '../utils/mapper';

export interface ColumnMap {
    name: number | string;
    targetName: 'RU' | 'UA'; // Which column to put the product name in
    price?: number | string;
    brand?: number | string;
}

export const useFileProcessing = () => {
    const [data, setData] = useState<any[][] | null>(null);
    const [rawRows, setRawRows] = useState<any[][] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const parseFile = useCallback(async (file: File): Promise<any[][]> => {
        return new Promise((resolve, reject) => {
            const isCsv = file.name.endsWith('.csv');
            if (isCsv) {
                Papa.parse(file, {
                    header: false, // Parse as array of arrays to handle custom header rows
                    complete: (results) => resolve(results.data as any[][]),
                    error: (err) => reject(err),
                });
            } else {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = new Uint8Array(e.target?.result as ArrayBuffer);
                        const workbook = read(data, { type: 'array' });
                        const firstSheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[firstSheetName];
                        const jsonData = utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
                        resolve(jsonData);
                    } catch (err) {
                        reject(err);
                    }
                };
                reader.onerror = (err) => reject(err);
                reader.readAsArrayBuffer(file);
            }
        });
    }, []);

    const processFile = useCallback(async (file: File | any[][], skuPrefix: string, startRow: number = 0, mapping?: ColumnMap) => {
        setLoading(true);
        setError(null);

        try {
            console.log('processFile starting...', { isFile: file instanceof File, skuPrefix, startRow, mapping });

            let rows: any[][];
            if (file instanceof File) {
                console.log('Parsing local file...');
                rows = await parseFile(file);
                console.log('Parsed rows count:', rows.length);
                // Important: Update rawRows state separately
                setRawRows(rows);
            } else {
                console.log('Using existing rawRows, count:', file.length);
                rows = file;
            }

            if (!rows || rows.length === 0) {
                console.warn('No rows found to process');
                setData(null);
                return;
            }

            // Slice from startRow (0-indexed)
            const dataRows = rows.slice(startRow);
            console.log('Data rows after slice:', dataRows.length);

            if (dataRows.length === 0) {
                console.warn('Data rows empty after slice from startRow:', startRow);
                setData(null);
                return;
            }

            // Convert array of arrays to RawRow objects for the mapper
            const headers = (rows[startRow] || []).map(h => String(h || ''));
            console.log('Headers detected:', headers);

            // If no mapping provided, try to auto-detect just for this run (don't update state to avoid loop)
            const actualMapping = { ...mapping };
            if (actualMapping.name === undefined) {
                console.log('Auto-detecting name column in processFile...');
                for (let i = 0; i < Math.min(rows.length, 10); i++) {
                    const potentialHeaders = (rows[i] || []).map(h => String(h || '').toLowerCase());
                    const idx = potentialHeaders.findIndex(h => h.includes('назва') || h.includes('название') || h.includes('name') || h.includes('товар'));
                    if (idx !== -1) {
                        actualMapping.name = idx;
                        break;
                    }
                }
                if (actualMapping.name === undefined) actualMapping.name = 0;
            }

            const formattedRows: RawRow[] = dataRows.slice(1)
                .filter(row => Array.isArray(row) && row.some(cell => cell !== null && cell !== undefined && cell !== ''))
                .map(row => {
                    const obj: RawRow = {};
                    if (Array.isArray(row)) {
                        row.forEach((cell, i) => {
                            const key = headers[i] || `Column_${i}`;
                            obj[key] = cell;
                        });

                        // If manual mapping is provided, inject it into the object with standard keys
                        if (actualMapping) {
                            if (typeof actualMapping.name === 'number' && row[actualMapping.name] !== undefined) {
                                obj['__mapped_name'] = row[actualMapping.name];
                                obj['__target_name_lang'] = actualMapping.targetName;
                            }
                            if (typeof actualMapping.price === 'number' && row[actualMapping.price] !== undefined) {
                                obj['__mapped_price'] = row[actualMapping.price];
                            }
                            if (typeof actualMapping.brand === 'number' && row[actualMapping.brand] !== undefined) {
                                obj['__mapped_brand'] = row[actualMapping.brand];
                            }
                        }
                    }
                    return obj;
                });

            console.log('Formatted rows count for mapping:', formattedRows.length);
            const mappedData = await mapToSchema(formattedRows, skuPrefix);
            console.log('Mapping complete, resulting rows:', mappedData.length);

            if (!mappedData || !Array.isArray(mappedData) || mappedData.length === 0) {
                throw new Error('Mapping resulted in empty or invalid data');
            }

            setData(mappedData);
        } catch (err) {
            console.error('CRITICAL ERROR in processFile:', err);
            setError(err instanceof Error ? err.message : 'Unknown error during file processing');
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [parseFile]);

    const exportToExcel = (filename: string) => {
        if (!data || data.length === 0) return;
        try {
            const worksheet = utils.aoa_to_sheet(data);
            const workbook = utils.book_new();
            utils.book_append_sheet(workbook, worksheet, 'Price List');

            // Standard library helper for downloading handles various browser quirks
            const finalFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
            console.log('Exporting with XLSX.writeFile:', finalFilename);
            writeFile(workbook, finalFilename);
        } catch (err) {
            console.error('Export failed:', err);
            setError('Failed to export. Please try again.');
        }
    };

    const processGoogleSheet = useCallback(async (url: string, skuPrefix: string, startRow: number = 0, mapping?: ColumnMap) => {
        setLoading(true);
        setError(null);

        try {
            // Extract sheet ID from URL
            const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
            if (!match) throw new Error('Invalid Google Sheets URL. Please copy the full browser URL.');

            const sheetId = match[1];
            // Get GID if specified, otherwise default to first sheet
            const gidMatch = url.match(/gid=([0-9]+)/);
            const gid = gidMatch ? `&gid=${gidMatch[1]}` : '';

            const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gid}`;

            const response = await fetch(exportUrl);
            if (!response.ok) throw new Error('Could not access the sheet. Make sure "Anyone with the link" has access.');

            const csvText = await response.text();

            return new Promise<void>((resolve, reject) => {
                Papa.parse(csvText, {
                    header: false,
                    complete: async (results) => {
                        const rows = results.data as any[][];
                        setRawRows(rows);
                        const dataRows = rows.slice(startRow);

                        const headers = (rows[startRow] || []).map(h => String(h || ''));
                        const formattedRows: RawRow[] = dataRows.slice(1)
                            .filter(row => Array.isArray(row) && row.some(cell => cell !== null && cell !== undefined && cell !== ''))
                            .map(row => {
                                const obj: RawRow = {};
                                row.forEach((cell, i) => {
                                    const key = headers[i] || `Column_${i}`;
                                    obj[key] = cell;
                                });
                                if (mapping) {
                                    if (typeof mapping.name === 'number' && row[mapping.name] !== undefined) obj['__mapped_name'] = row[mapping.name];
                                    if (typeof mapping.price === 'number' && row[mapping.price] !== undefined) obj['__mapped_price'] = row[mapping.price];
                                    if (typeof mapping.brand === 'number' && row[mapping.brand] !== undefined) obj['__mapped_brand'] = row[mapping.brand];
                                    obj['__target_name_lang'] = mapping.targetName;
                                }
                                return obj;
                            });

                        const mappedData = await mapToSchema(formattedRows, skuPrefix);
                        setData(mappedData);
                        setLoading(false);
                        resolve();
                    },
                    error: (err: any) => {
                        setError(err.message);
                        setLoading(false);
                        reject(err);
                    }
                });
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            setLoading(false);
        }
    }, []);

    const reset = () => {
        setData(null);
        setRawRows(null);
        setError(null);
    };

    const removeRow = (index: number) => {
        setData(prev => {
            if (!prev) return null;
            const newData = [...prev];
            newData.splice(index, 1);
            return newData;
        });
    };

    const updateCell = (rowIndex: number, colIndex: number, value: any) => {
        setData(prev => {
            if (!prev) return null;
            const newData = [...prev];
            newData[rowIndex] = [...newData[rowIndex]];
            newData[rowIndex][colIndex] = value;
            return newData;
        });
    };

    const updateColumn = (colIndex: number, value: any) => {
        setData(prev => {
            if (!prev) return null;
            return prev.map((row, i) => {
                if (i === 0) return row; // Keep header
                const newRow = [...row];
                newRow[colIndex] = value;
                return newRow;
            });
        });
    };

    return { processFile, processGoogleSheet, rawRows, setRawRows, data, setData, loading, error, exportToExcel, reset, removeRow, updateCell, updateColumn };
};
