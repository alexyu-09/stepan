import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Upload, FileText, Download, Trash2, AlertCircle, Settings, Table as TableIcon, Layers, Globe, Search, Edit2, Check, X, History as HistoryIcon, Save, Clock, Calendar, Image, Package, CheckCircle2, Loader2 } from 'lucide-react';
import { useFileProcessing, type ColumnMap } from './hooks/useFileProcessing';
import { MOCK_DATA } from './constants/mockData';
import { CATEGORIES } from './constants/categories';
import { saveCurrentSession, loadCurrentSession, clearCurrentSession, addToHistory, getHistory, deleteHistoryItem, type SavedSession } from './utils/storage';

const HistoryModal = ({ isOpen, onClose, items, onRestore, onDelete }: {
  isOpen: boolean,
  onClose: () => void,
  items: SavedSession[],
  onRestore: (item: SavedSession) => void,
  onDelete: (id: string) => void
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'var(--primary)', padding: '6px', borderRadius: '6px' }}>
              <HistoryIcon size={18} color="#fff" />
            </div>
            <h3 style={{ margin: 0 }}>История версий</h3>
          </div>
          <button className="btn-icon" onClick={onClose} style={{ color: 'var(--text-secondary)' }}><X size={20} /></button>
        </div>

        <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
              <Clock size={40} style={{ marginBottom: '1rem', opacity: 0.2 }} />
              <p>Сохраненные версии не найдены.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {items.map((item) => (
                <div key={item.id} className="card" style={{ padding: '1rem', marginBottom: 0, border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FileText size={14} color="var(--primary)" />
                      {item.filename}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Calendar size={12} />
                      {new Date(item.timestamp).toLocaleString()}
                      <span className="tag" style={{ padding: '2px 6px', fontSize: '0.65rem' }}>{item.data.length - 1} строк</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-primary" onClick={() => onRestore(item)} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                      Восстановить
                    </button>
                    <button className="btn-icon" onClick={() => onDelete(item.id)} style={{ color: 'var(--error)' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Components ---

const EditableCell = ({ value, onSave, className, isSku, isAlias, options, style }: {
  value: any,
  onSave: (val: string) => void,
  className?: string,
  isSku?: boolean,
  isAlias?: boolean,
  options?: string[],
  style?: React.CSSProperties
}) => {
  const [val, setVal] = useState(String(value || ''));
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    setVal(String(value || ''));
  }, [value]);

  const handleBlur = () => {
    setIsEditing(false);
    if (val !== String(value || '')) {
      onSave(val);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
    if (e.key === 'Escape') {
      setVal(String(value || ''));
      setIsEditing(false);
    }
  };

  if (isEditing) {
    if (options) {
      return (
        <td className={className} style={{ ...style, padding: '0' }}>
          <select
            autoFocus
            className="editable-input"
            value={val}
            onChange={(e) => {
              setVal(e.target.value);
              onSave(e.target.value);
              setIsEditing(false);
            }}
            onBlur={() => setIsEditing(false)}
            onKeyDown={handleKeyDown}
            style={{ height: '100%', borderRadius: '0' }}
          >
            <option value="">-- Выберите категорию --</option>
            {options.map((opt, i) => (
              <option key={i} value={opt}>{opt}</option>
            ))}
          </select>
        </td>
      );
    }

    return (
      <td className={className} style={{ ...style, padding: '4px 8px' }}>
        <input
          autoFocus
          className="editable-input"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      </td>
    );
  }

  return (
    <td
      className={`editable-cell ${className || ''}`}
      onClick={() => setIsEditing(true)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title="Нажмите для редактирования"
      style={{ ...style, cursor: 'pointer', position: 'relative' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', height: '100%' }}>
        <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {isSku ? <span className="tag tag-sku">{val}</span> :
            isAlias ? <span className="tag tag-alias">{val}</span> :
              (val || '-')}
        </div>
        {isHovered && !isEditing && <Edit2 size={12} style={{ opacity: 0.5, flexShrink: 0 }} />}
      </div>
    </td>
  );
};

type SavedImage = {
  sku: string;
  filename: string;
  url: string;
  blobUrl: string;
  timestamp: number;
};

const ImageSearchModal = ({ isOpen, onClose, query, sku, onApprove }: {
  isOpen: boolean,
  onClose: () => void,
  query: string,
  sku: string,
  onApprove: (url: string) => void
}) => {
  const [images, setImages] = useState<{ url: string; thumbnail: string; title: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    if (isOpen && query) {
      searchImages();
    }
    return () => {
      setImages([]);
      setSelectedIndex(null);
      setError('');
      setShowManual(false);
      setManualUrl('');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, query]);

  const searchImages = async () => {
    setLoading(true);
    setError('');
    try {
      // Try API endpoint first (works on Vercel deployment)
      const apiBase = import.meta.env.DEV ? '' : '';
      const resp = await fetch(`${apiBase}/api/search-images?q=${encodeURIComponent(query)}`);
      if (!resp.ok) throw new Error(`API returned ${resp.status}`);
      const data = await resp.json();
      if (data.images && data.images.length > 0) {
        setImages(data.images.slice(0, 8));
      } else {
        setError('Изображения не найдены. Попробуйте вставить URL вручную.');
        setShowManual(true);
      }
    } catch (err: any) {
      console.error('Image search failed:', err);
      setError('Не удалось загрузить изображения. Используйте ручной ввод URL или Google Поиск.');
      setShowManual(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectImage = async (img: { url: string; thumbnail: string }, index: number) => {
    setSelectedIndex(index);
    setSaving(true);
    try {
      onApprove(img.url);
      // Small delay for visual feedback
      await new Promise(r => setTimeout(r, 400));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleManualApprove = () => {
    if (manualUrl.trim()) {
      onApprove(manualUrl.trim());
      onClose();
    }
  };

  const handleGoogleSearch = () => {
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '720px', width: '95%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'linear-gradient(135deg, var(--primary), #7c3aed)', padding: '8px', borderRadius: '10px' }}>
              <Image size={20} color="#fff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Назначить фото товара</h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Выберите изображение для сохранения</div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} style={{ color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        {/* Info block */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          padding: '0.75rem 1rem',
          borderRadius: '10px',
          marginBottom: '1.25rem',
          border: '1px solid var(--border-color)',
          display: 'flex',
          gap: '1.5rem',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Файл</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent)' }}>{sku}.jpg</div>
          </div>
          <div style={{ width: '1px', height: '30px', background: 'var(--border-color)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Запрос</div>
            <div style={{ fontSize: '0.85rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{query}</div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <Loader2 size={36} className="spin-icon" style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Поиск изображений...</div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            padding: '1rem',
            borderRadius: '10px',
            color: 'var(--text-secondary)',
            marginBottom: '1rem',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <AlertCircle size={18} color="var(--error)" />
            {error}
          </div>
        )}

        {/* Image Grid */}
        {!loading && images.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', fontWeight: 600 }}>
              Найдено {images.length} изображений — нажмите для сохранения:
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: '0.75rem'
            }}>
              {images.map((img, i) => (
                <div
                  key={i}
                  onClick={() => !saving && handleSelectImage(img, i)}
                  style={{
                    position: 'relative',
                    aspectRatio: '1',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: selectedIndex === i ? '3px solid var(--success)' : '2px solid var(--border-color)',
                    cursor: saving ? 'wait' : 'pointer',
                    background: '#000',
                    transition: 'all 0.2s ease',
                    boxShadow: selectedIndex === i ? '0 0 20px rgba(16, 185, 129, 0.3)' : 'none',
                    transform: selectedIndex === i ? 'scale(0.95)' : 'scale(1)',
                  }}
                  onMouseEnter={(e) => { if (selectedIndex !== i) e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.transform = 'scale(1.03)'; }}
                  onMouseLeave={(e) => { if (selectedIndex !== i) e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = selectedIndex === i ? 'scale(0.95)' : 'scale(1)'; }}
                >
                  <img
                    src={img.thumbnail || img.url}
                    alt={img.title || `Результат ${i + 1}`}
                    loading="lazy"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  {selectedIndex === i && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(16, 185, 129, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {saving ? <Loader2 size={28} className="spin-icon" color="#fff" /> : <CheckCircle2 size={32} color="#fff" />}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        {!loading && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: showManual ? '1rem' : 0 }}>
            <button
              className="btn btn-secondary"
              onClick={handleGoogleSearch}
              style={{ flex: 1, padding: '10px', fontSize: '0.8rem' }}
            >
              <Search size={16} /> Google Картинки
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setShowManual(!showManual)}
              style={{ flex: 1, padding: '10px', fontSize: '0.8rem', background: showManual ? 'rgba(81, 90, 218, 0.15)' : undefined }}
            >
              <Edit2 size={16} /> Вставить URL
            </button>
            {images.length > 0 && (
              <button
                className="btn btn-secondary"
                onClick={searchImages}
                style={{ padding: '10px', fontSize: '0.8rem' }}
                title="Искать заново"
              >
                <Search size={16} />
              </button>
            )}
          </div>
        )}

        {/* Manual URL input (collapsible) */}
        {showManual && !loading && (
          <div className="fade-in" style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '1rem',
          }}>
            <label className="input-label" style={{ fontSize: '0.8rem' }}>Прямая ссылка на изображение</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                className="input-field"
                placeholder="https://example.com/image.jpg"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualApprove()}
                style={{ fontSize: '0.85rem' }}
              />
              <button
                className="btn btn-primary"
                onClick={handleManualApprove}
                disabled={!manualUrl.trim()}
                style={{ whiteSpace: 'nowrap', padding: '8px 16px' }}
              >
                <Check size={16} /> Сохранить
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function App() {
  const [skuPrefix, setSkuPrefix] = useState('S-IV');
  const [startRow, setStartRow] = useState(0); // 0-indexed
  const [file, setFile] = useState<File | null>(null);
  const [sheetUrl, setSheetUrl] = useState('');
  const [importMethod, setImportMethod] = useState<'file' | 'google'>('file');
  const [mapping, setMapping] = useState<ColumnMap>({ name: undefined as any, targetName: 'RU' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mockRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<HTMLDivElement>(null);

  const { processFile, processGoogleSheet, rawRows, setRawRows, data, setData, loading, error, exportToExcel, reset, removeRow, updateCell, updateColumn } = useFileProcessing();

  const [searchModal, setSearchModal] = useState<{ open: boolean, query: string, sku: string, rowIndex: number } | null>(null);
  const [bulkEditCol, setBulkEditCol] = useState<{ colIndex: number, header: string } | null>(null);
  const [bulkValue, setBulkValue] = useState('');
  const [history, setHistoryItems] = useState<SavedSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [savedImages, setSavedImages] = useState<SavedImage[]>([]);
  const [downloadingZip, setDownloadingZip] = useState(false);

  const lastProcessedKey = useRef<string>('');

  // Load history and last session on mount
  useEffect(() => {
    const init = async () => {
      const hist = await getHistory();
      setHistoryItems(hist);

      const session = await loadCurrentSession();
      if (session) {
        setIsRestoring(true);
        setSkuPrefix(session.skuPrefix);
        setStartRow(session.startRow);
        setMapping(session.mapping);
        setRawRows(session.rawRows);
        setData(session.data);
        // Mark these parameters as already processed so the effect skips overwriting
        lastProcessedKey.current = JSON.stringify({
          rawRowsRef: session.rawRows, // Check reference if possible
          prefix: session.skuPrefix,
          start: session.startRow,
          map: session.mapping
        });
        setTimeout(() => setIsRestoring(false), 500);
      }
    };
    init();
  }, [setRawRows, setData]);

  // Auto-save session
  useEffect(() => {
    if (data && !isRestoring) {
      saveCurrentSession({
        id: 'current',
        data,
        rawRows,
        mapping,
        skuPrefix,
        startRow,
        filename: file?.name || 'Google Sheet Import',
        timestamp: Date.now()
      });
    }
  }, [data, rawRows, mapping, skuPrefix, startRow, file, isRestoring]);

  const loadHistoryList = async () => {
    const hist = await getHistory();
    setHistoryItems(hist);
  };

  const syncScroll = (e: React.UIEvent<HTMLDivElement>, targetRef: React.RefObject<HTMLDivElement | null>) => {
    if (targetRef.current && Math.abs(targetRef.current.scrollLeft - e.currentTarget.scrollLeft) >= 1) {
      targetRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const getColWidth = (index: number) => {
    if (index === -1) return 80; // Actions/Ref col
    const actualIdx = index; // 0-indexed column from schema
    if (actualIdx === 0) return 180; // SKU
    if (actualIdx === 3 || actualIdx === 4) return 350; // Names
    if (actualIdx === 7) return 200; // Alias
    if (actualIdx === 17) return 250; // Photo
    if (actualIdx === 42 || actualIdx === 43) return 400; // Notes (HTML)
    return 160; // Default
  };

  const TABLE_WIDTH = useMemo(() => {
    // 6 specific widths + 37 default widths (TOTAL 44 columns + 1 ID col)
    // Indices: 0, 3, 4, 7, 17, 42, 43 are custom. (7 columns)
    // 44 total columns - 7 custom = 37 default
    const sum = getColWidth(-1) + getColWidth(0) + getColWidth(3) + getColWidth(4) + getColWidth(7) + getColWidth(17) + getColWidth(42) + getColWidth(43) + (37 * getColWidth(1));
    return `${sum}px`;
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setSheetUrl('');
      // processFile handles setting rawRows and processing
      processFile(selectedFile, skuPrefix, startRow, mapping);
    }
  };

  const handleSheetImport = () => {
    if (sheetUrl) {
      setFile(null);
      processGoogleSheet(sheetUrl, skuPrefix, startRow, mapping);
    }
  };

  // Effect: Process mapping when key inputs change, but skip if we just restored/loaded
  useEffect(() => {
    if (!rawRows || rawRows.length === 0 || isRestoring) {
      return;
    }

    const currentKey = JSON.stringify({
      rawRowsRef: rawRows,
      prefix: skuPrefix,
      start: startRow,
      map: mapping
    });

    if (currentKey !== lastProcessedKey.current) {
      console.log('App effect: Triggering processFile due to param change');
      processFile(rawRows, skuPrefix, startRow, mapping);
      lastProcessedKey.current = currentKey;
    }
  }, [startRow, mapping, skuPrefix, rawRows, processFile, isRestoring]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      setFile(selectedFile);
      processFile(selectedFile, skuPrefix, startRow, mapping);
    }
  }, [processFile, skuPrefix, startRow, mapping]);

  const onDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleExport = () => {
    // Simpler timestamp for file name to prevent extension issues
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.getHours().toString().padStart(2, '0') + '-' + now.getMinutes().toString().padStart(2, '0');
    exportToExcel(`PriceList_${dateStr}_${timeStr}`);
  };

  const handleReset = () => {
    setFile(null);
    setStartRow(0);
    setMapping({ name: 0, targetName: 'RU' });
    if (fileInputRef.current) fileInputRef.current.value = '';
    clearCurrentSession();
    reset();
    lastProcessedKey.current = '';
  };

  const saveToHistory = async () => {
    if (!data) return;
    await addToHistory({
      data,
      rawRows,
      mapping,
      skuPrefix,
      startRow,
      filename: file?.name || 'Экспорт_Прайса',
      timestamp: Date.now()
    });
    loadHistoryList();
    alert('Результат сохранен в историю!');
  };

  const restoreFromHistory = (item: SavedSession) => {
    setIsRestoring(true);
    setSkuPrefix(item.skuPrefix);
    setStartRow(item.startRow);
    setMapping(item.mapping);
    setRawRows(item.rawRows);
    setData(item.data);
    setShowHistory(false);
    setTimeout(() => setIsRestoring(false), 500);
  };

  // --- Image download helpers ---
  const fetchImageAsBlob = async (url: string): Promise<Blob> => {
    // Try proxy endpoint first for CORS bypass
    try {
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
      const resp = await fetch(proxyUrl);
      if (resp.ok) return await resp.blob();
    } catch { /* fall through */ }
    // Direct fetch fallback
    const resp = await fetch(url, { mode: 'cors' });
    return await resp.blob();
  };

  const addSavedImage = async (sku: string, url: string) => {
    const filename = `${sku}.jpg`;
    // Check if already saved (update if so)
    setSavedImages(prev => {
      const existing = prev.find(img => img.sku === sku);
      if (existing) {
        // Revoke old blob URL to free memory
        URL.revokeObjectURL(existing.blobUrl);
      }
      return prev.filter(img => img.sku !== sku);
    });

    try {
      const blob = await fetchImageAsBlob(url);
      const blobUrl = URL.createObjectURL(blob);
      setSavedImages(prev => [...prev, { sku, filename, url, blobUrl, timestamp: Date.now() }]);
    } catch (err) {
      console.error('Failed to fetch image for save:', err);
      // Still add it with the original URL as a fallback
      setSavedImages(prev => [...prev, { sku, filename, url, blobUrl: url, timestamp: Date.now() }]);
    }
  };

  const downloadSingleImage = async (img: SavedImage) => {
    try {
      let blob: Blob;
      if (img.blobUrl.startsWith('blob:')) {
        const resp = await fetch(img.blobUrl);
        blob = await resp.blob();
      } else {
        blob = await fetchImageAsBlob(img.url);
      }
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = img.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('Download failed:', err);
      // Fallback: open in new tab
      window.open(img.url, '_blank');
    }
  };

  const downloadAllAsZip = async () => {
    if (savedImages.length === 0) return;
    setDownloadingZip(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const folder = zip.folder('product-images');

      for (const img of savedImages) {
        try {
          let blob: Blob;
          if (img.blobUrl.startsWith('blob:')) {
            const resp = await fetch(img.blobUrl);
            blob = await resp.blob();
          } else {
            blob = await fetchImageAsBlob(img.url);
          }
          folder!.file(img.filename, blob);
        } catch (err) {
          console.error(`Failed to add ${img.filename} to zip:`, err);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      link.download = `product-images_${dateStr}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('ZIP creation failed:', err);
      alert('Ошибка при создании архива');
    } finally {
      setDownloadingZip(false);
    }
  };

  const removeSavedImage = (sku: string) => {
    setSavedImages(prev => {
      const img = prev.find(i => i.sku === sku);
      if (img && img.blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(img.blobUrl);
      }
      return prev.filter(i => i.sku !== sku);
    });
  };

  // Preview of headers based on current startRow
  const currentHeaders = useMemo(() => {
    if (!rawRows || !rawRows[startRow]) return [];
    return rawRows[startRow];
  }, [rawRows, startRow]);

  return (
    <div className="container fade-in">
      <header className="header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.5rem' }}>
          <h1 style={{ fontSize: '1.8rem' }}>Конвертер Прайсов</h1>
          <button className="btn btn-secondary" onClick={() => setShowHistory(true)} style={{ background: 'rgba(255,255,255,0.05)' }}>
            <HistoryIcon size={18} /> История
          </button>
        </div>
        <p>Конвертация сырых данных в оптимизированные прайс-листы с автогенерацией SKU и Алиасов.</p>
      </header>

      <div className="grid">
        {/* Step 1: Upload & Config */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'var(--primary)', padding: '8px', borderRadius: '8px', display: 'flex' }}>
              <Upload size={20} color="#fff" />
            </div>
            <h3 style={{ margin: 0 }}>1. Загрузка файла</h3>
          </div>

          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '10px', marginBottom: '1.5rem' }}>
            <button
              className={`btn ${importMethod === 'file' ? 'btn-primary' : ''}`}
              onClick={() => setImportMethod('file')}
              style={{ flex: 1, padding: '8px', fontSize: '0.85rem', boxShadow: 'none', background: importMethod === 'file' ? '' : 'transparent' }}
            >
              <Upload size={14} /> Выбрать файл
            </button>
            <button
              className={`btn ${importMethod === 'google' ? 'btn-primary' : ''}`}
              onClick={() => setImportMethod('google')}
              style={{ flex: 1, padding: '8px', fontSize: '0.85rem', boxShadow: 'none', background: importMethod === 'google' ? '' : 'transparent' }}
            >
              <Globe size={14} /> Google Таблицы
            </button>
          </div>

          {importMethod === 'file' ? (
            <div
              className="upload-area"
              onDrop={onDrop}
              onDragOver={onDragOver}
              onClick={() => fileInputRef.current?.click()}
              style={{ marginBottom: '1.5rem' }}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
                accept=".csv,.xlsx,.xls"
              />
              {file ? (
                <div className="fade-in">
                  <FileText size={48} color="var(--primary)" style={{ marginBottom: '1rem' }} />
                  <div style={{ fontWeight: 600 }}>{file.name}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Нажмите, чтобы заменить файл</div>
                </div>
              ) : (
                <div>
                  <Upload size={48} color="var(--text-secondary)" style={{ marginBottom: '1rem' }} />
                  <div style={{ fontWeight: 600 }}>Перетащите файл сюда</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Excel или CSV</div>
                </div>
              )}
            </div>
          ) : (
            <div className="fade-in" style={{ marginBottom: '1.5rem' }}>
              <div className="input-group">
                <label className="input-label">Ссылка на таблицу</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                  />
                  <button className="btn btn-primary" onClick={handleSheetImport} disabled={!sheetUrl}>
                    Загрузить
                  </button>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  Убедитесь, что таблица доступна по ссылке (Anyone with the link can view).
                </p>
              </div>
            </div>
          )}

          {/* Removed Articul Prefix from here */}

          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px', color: 'var(--error)', marginTop: '1rem', display: 'flex', alignItems: 'start', gap: '0.5rem' }}>
              <AlertCircle size={18} style={{ marginTop: '2px' }} />
              <div style={{ fontSize: '0.9rem' }}>{error}</div>
            </div>
          )}

          {data && (
            <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', flexDirection: 'column' }}>
              <button className="btn btn-primary" onClick={handleExport} style={{ width: '100%' }}>
                <Download size={18} /> Скачать Excel
              </button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-secondary" onClick={saveToHistory} style={{ flex: 1 }}>
                  <Save size={18} /> Сохранить в историю
                </button>
                <button className="btn btn-secondary" onClick={handleReset} style={{ color: 'var(--error)' }}>
                  <Trash2 size={18} /> Очистить
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Advanced Row/Column Mapping */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'var(--accent)', padding: '8px', borderRadius: '8px', display: 'flex' }}>
              <Settings size={20} color="#fff" />
            </div>
            <h3 style={{ margin: 0 }}>2. Маппинг колонок</h3>
            {loading && <div className="tag" style={{ background: 'var(--primary)', marginLeft: 'auto' }}>Обработка...</div>}
          </div>

          {!rawRows ? (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
              Сначала загрузите файл для настройки маппинга.
            </div>
          ) : (
            <div className="fade-in">
              <div className="input-group">
                <label className="input-label">Данные начинаются со строки (Заголовок)</label>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <input
                    type="number"
                    className="input-field"
                    value={isNaN(startRow) ? '' : startRow + 1}
                    min={1}
                    max={rawRows.length}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setStartRow(isNaN(val) ? 0 : Math.max(0, val - 1));
                    }}
                    style={{ width: '80px' }}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Для этого файла рекомендуется строка 24.
                  </span>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Название колонки: "Наименование" (обязательно)</label>
                <select
                  className="input-field"
                  value={mapping.name}
                  onChange={(e) => setMapping({ ...mapping, name: parseInt(e.target.value) })}
                >
                  {currentHeaders.map((header, i) => (
                    <option key={i} value={i}>
                      Кол {i + 1}: {header ? String(header).slice(0, 30) : `(Пусто)`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Целевой язык для маппинга</label>
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input
                      type="radio"
                      name="targetLang"
                      checked={mapping.targetName === 'RU'}
                      onChange={() => setMapping({ ...mapping, targetName: 'RU' })}
                    />
                    Русский (RU)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input
                      type="radio"
                      name="targetLang"
                      checked={mapping.targetName === 'UA'}
                      onChange={() => setMapping({ ...mapping, targetName: 'UA' })}
                    />
                    Украинский (UA)
                  </label>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Колонка "Цена" (опционально)</label>
                <select
                  className="input-field"
                  value={mapping.price}
                  onChange={(e) => setMapping({ ...mapping, price: e.target.value === "" ? undefined : parseInt(e.target.value) })}
                >
                  <option value="">Авто-определение</option>
                  {currentHeaders.map((header, i) => (
                    <option key={i} value={i}>
                      Кол {i + 1}: {header ? String(header).slice(0, 30) : `(Пусто)`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Бренд/Поставщик (опционально)</label>
                <select
                  className="input-field"
                  value={mapping.brand}
                  onChange={(e) => setMapping({ ...mapping, brand: e.target.value === "" ? undefined : parseInt(e.target.value) })}
                >
                  <option value="">Авто-определение</option>
                  {currentHeaders.map((header, i) => (
                    <option key={i} value={i}>
                      Кол {i + 1}: {header ? String(header).slice(0, 30) : `(Пусто)`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Raw Data Preview - Always show if rawRows exist to confirm data is there */}
      {rawRows && (
        <div className="card fade-in" style={{ marginTop: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <TableIcon size={20} color="var(--text-secondary)" />
            <h3 style={{ margin: 0 }}>Проверка целостности данных</h3>
            <span className="tag" style={{ marginLeft: 'auto' }}>Всего {rawRows.length} строк</span>
          </div>
          <div className="table-container" style={{ maxHeight: '350px', overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <th style={{ width: '40px', background: 'var(--panel-bg)' }}>#</th>
                  {rawRows && rawRows[startRow] && rawRows[startRow].map((_, idx) => {
                    const isName = mapping.name === idx;
                    const isPrice = mapping.price === idx;
                    const isBrand = mapping.brand === idx;
                    return (
                      <th key={idx} style={{
                        fontSize: '0.65rem',
                        color: isName ? 'var(--primary)' : isPrice ? 'var(--success)' : isBrand ? 'var(--accent)' : 'var(--text-secondary)',
                        background: 'var(--panel-bg)',
                        borderBottom: isName ? '2px solid var(--primary)' : 'none',
                        minWidth: '120px'
                      }}>
                        {isName ? '[ИСТОЧНИК ИМЕНИ]' : isPrice ? '[ИСТОЧНИК ЦЕНЫ]' : isBrand ? '[ИСТОЧНИК БРЕНДА]' : `Колонка ${idx + 1}`}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rawRows.slice(0, 50).map((row, i) => (
                  <tr key={i} style={i === startRow ? { background: 'rgba(81, 90, 218, 0.15)', boxShadow: 'inset 4px 0 0 var(--primary)' } : {}}>
                    <td style={{ width: '40px', color: 'var(--text-secondary)', fontSize: '0.7rem' }}>{i + 1}</td>
                    {Array.isArray(row) ? row.map((cell, j) => (
                      <td key={j} style={{
                        opacity: i < startRow ? 0.3 : 1,
                        fontSize: '0.8rem',
                        background: mapping.name === j ? 'rgba(81, 90, 218, 0.05)' : 'transparent',
                        fontWeight: mapping.name === j ? 600 : 400
                      }}>
                        {String(cell || '')}
                      </td>
                    )) : <td>Это не массив</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Final Preview Section */}
      <div className="card fade-in" style={{
        marginTop: '2.5rem',
        borderTop: data ? '4px solid var(--success)' : '4px solid var(--primary)',
        background: data ? 'rgba(16, 185, 129, 0.05)' : 'rgba(81, 90, 218, 0.03)',
        padding: '1.5rem 0' // Remove side padding to allow full-width scroll
      }}>
        <div style={{ padding: '0 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ background: data ? 'var(--success)' : 'var(--primary)', padding: '8px', borderRadius: '8px', display: 'flex' }}>
              <Layers size={20} color="#fff" />
            </div>
            <h3 style={{ margin: 0 }}>Шаг 3: Результаты обработки (Превью)</h3>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div className="input-group" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <label className="input-label" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>Префикс Артикула:</label>
              <input
                type="text"
                className="input-field"
                style={{ width: '100px', padding: '6px 12px' }}
                value={skuPrefix}
                onChange={(e) => setSkuPrefix(e.target.value)}
                placeholder="S-IV"
              />
            </div>
            {data && <span className="tag" style={{ background: 'var(--success)', color: '#fff' }}>{data.length - 1} товаров готово</span>}
          </div>
        </div>

        {/* Reference Layout (Mock) */}
        <div style={{ padding: '0 2rem' }}>
          <div className="section-divider">
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', opacity: 0.6 }}>ЭТАЛОН К СОПОСТАВЛЕНИЮ</span>
          </div>
          <div
            className="table-container"
            ref={mockRef}
            onScroll={(e) => syncScroll(e, dataRef)}
            style={{ overflowX: 'auto', maxHeight: '150px', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-color)', marginBottom: '1rem' }}
          >
            <table className="fixed-table" style={{ width: TABLE_WIDTH }}>
              <thead>
                <tr>
                  <th style={{ width: getColWidth(-1), minWidth: getColWidth(-1), textAlign: 'center' }}>Ref</th>
                  {MOCK_DATA[0].map((header, i) => {
                    const isNameCol = i === 3;
                    const width = getColWidth(i);
                    return (
                      <th
                        key={i}
                        className={isNameCol ? 'sticky-name-col' : ''}
                        style={{ width, minWidth: width, background: '#1c1e24' }}
                      >
                        {header}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                <tr style={{ opacity: 0.7 }}>
                  <td style={{ textAlign: 'center', width: getColWidth(-1), minWidth: getColWidth(-1) }}><Globe size={14} /></td>
                  {MOCK_DATA[1].map((cell, j) => {
                    const isNameCol = j === 3;
                    const width = getColWidth(j);
                    return (
                      <td
                        key={j}
                        className={isNameCol ? 'sticky-name-col' : ''}
                        style={{ fontSize: '0.8rem', width, minWidth: width }}
                      >
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {j === 0 ? <span className="tag tag-sku">{cell}</span> :
                            j === 7 ? <span className="tag tag-alias">{cell}</span> :
                              String(cell || '-')}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* User Data Preview */}
        {data && Array.isArray(data) && data.length > 0 && (
          <div style={{ padding: '0 2rem' }}>
            <div className="section-divider">
              <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--success)' }}>ВАШИ ОБРАБОТАННЫЕ ДАННЫЕ</span>
            </div>
            <div
              className="table-container"
              ref={dataRef}
              onScroll={(e) => syncScroll(e, mockRef)}
              style={{ overflowX: 'auto', maxHeight: '500px' }}
            >
              <table className="fixed-table" style={{ width: TABLE_WIDTH }}>
                <thead>
                  <tr>
                    <th style={{ width: getColWidth(-1), minWidth: getColWidth(-1), textAlign: 'center' }}>Действия</th>
                    {data && data[0] && data[0].map((header, i) => {
                      const isNameCol = i === 3;
                      const width = getColWidth(i);

                      return (
                        <th key={i} className={isNameCol ? 'sticky-name-col' : ''} style={{ width, minWidth: width }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{header}</span>
                            <button className="btn-icon" onClick={() => {
                              setBulkEditCol({ colIndex: i, header });
                              setBulkValue('');
                            }} style={{ opacity: 0.6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                              <Edit2 size={14} />
                            </button>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {data.slice(1, 1000).map((row: any[], i: number) => {
                    if (!Array.isArray(row)) return null;
                    const rowIndex = i + 1;
                    const sku = row[0];
                    const name = row[3] || row[4]; // RU or UA name
                    return (
                      <tr key={rowIndex}>
                        <td style={{ textAlign: 'center', width: getColWidth(-1), minWidth: getColWidth(-1) }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button
                              className="btn-icon"
                              onClick={() => setSearchModal({ open: true, query: name || sku, sku, rowIndex })}
                              title="Search photo"
                              style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}
                            >
                              <Search size={16} />
                            </button>
                            <button
                              className="btn-icon"
                              onClick={() => removeRow(rowIndex)}
                              title="Delete this row"
                              style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--error)' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                        {row.map((cell: any, j: number) => {
                          const isNameCol = j === 3;
                          const isOtherNameCol = j === 4;
                          const width = getColWidth(j);

                          return (
                            <EditableCell
                              key={j}
                              value={cell}
                              onSave={(val) => updateCell(rowIndex, j, val)}
                              className={`${isNameCol ? 'sticky-name-col' : ''} ${isNameCol || isOtherNameCol ? 'cell-name' : ''}`}
                              isSku={j === 0}
                              isAlias={j === 7}
                              options={j === 9 ? CATEGORIES : undefined}
                              style={{ width, minWidth: width }}
                            />
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {searchModal && (
          <ImageSearchModal
            isOpen={searchModal.open}
            onClose={() => setSearchModal(null)}
            query={searchModal.query}
            sku={searchModal.sku}
            onApprove={(url: string) => {
              // Update the Photo column (index 17) with the SKU name
              updateCell(searchModal.rowIndex, 17, `${searchModal.sku}.jpg`);
              // Save the image for download
              addSavedImage(searchModal.sku, url);
            }}
          />
        )}

        {bulkEditCol && (
          <div className="modal-overlay" onClick={() => setBulkEditCol(null)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
              <h3>Применить ко всем: {bulkEditCol.header}</h3>
              <div className="input-group">
                {bulkEditCol.colIndex === 9 ? (
                  <select
                    className="input-field"
                    value={bulkValue}
                    onChange={(e) => setBulkValue(e.target.value)}
                    autoFocus
                  >
                    <option value="">-- Выберите категорию --</option>
                    {CATEGORIES.map((opt, i) => (
                      <option key={i} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Введите значение для всех строк"
                    value={bulkValue}
                    onChange={(e) => setBulkValue(e.target.value)}
                    autoFocus
                  />
                )}
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => {
                  updateColumn(bulkEditCol.colIndex, bulkValue);
                  setBulkEditCol(null);
                }}>Применить</button>
                <button className="btn btn-secondary" onClick={() => setBulkEditCol(null)}>Отмена</button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Saved Images Gallery */}
        {savedImages.length > 0 && (
          <div className="card fade-in" style={{
            marginTop: '2.5rem',
            borderTop: '4px solid #7c3aed',
            background: 'rgba(124, 58, 237, 0.03)',
            padding: '2rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ background: 'linear-gradient(135deg, #7c3aed, var(--primary))', padding: '8px', borderRadius: '10px', display: 'flex' }}>
                  <Package size={20} color="#fff" />
                </div>
                <div>
                  <h3 style={{ margin: 0 }}>Шаг 4: Сохранённые изображения</h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Скачайте отдельно или все сразу в архиве
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="tag" style={{ background: 'rgba(124, 58, 237, 0.15)', color: '#a78bfa' }}>
                  {savedImages.length} {savedImages.length === 1 ? 'файл' : savedImages.length < 5 ? 'файла' : 'файлов'}
                </span>
                <button
                  className="btn btn-primary"
                  onClick={downloadAllAsZip}
                  disabled={downloadingZip}
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed, var(--primary))',
                    padding: '10px 20px',
                    fontSize: '0.85rem',
                  }}
                >
                  {downloadingZip ? (
                    <><Loader2 size={16} className="spin-icon" /> Создание архива...</>
                  ) : (
                    <><Download size={16} /> Скачать все (ZIP)</>
                  )}
                </button>
              </div>
            </div>

            {/* Image Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '1rem',
            }}>
              {savedImages.map((img) => (
                <div
                  key={img.sku}
                  className="fade-in"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '14px',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.4)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(124, 58, 237, 0.15)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  {/* Image Preview */}
                  <div style={{
                    height: '140px',
                    background: '#0a0a0a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    <img
                      src={img.blobUrl}
                      alt={img.filename}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).parentElement!.innerHTML = '<div style="color: #666; font-size: 0.8rem;">Не удалось загрузить</div>';
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      background: 'rgba(16, 185, 129, 0.9)',
                      borderRadius: '50%',
                      width: '22px',
                      height: '22px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <CheckCircle2 size={14} color="#fff" />
                    </div>
                  </div>

                  {/* Info & Actions */}
                  <div style={{ padding: '0.75rem' }}>
                    <div style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: 'var(--accent)',
                      marginBottom: '0.5rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {img.filename}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => downloadSingleImage(img)}
                        style={{ flex: 1, padding: '6px', fontSize: '0.7rem', borderRadius: '8px' }}
                      >
                        <Download size={12} /> Скачать
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => removeSavedImage(img.sku)}
                        style={{
                          padding: '6px',
                          background: 'transparent',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          cursor: 'pointer',
                          color: 'var(--error)',
                          borderRadius: '8px',
                        }}
                        title="Удалить"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!data && (
          <div style={{ padding: '0 2rem', marginTop: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic' }}>
            Загрузите файл или укажите ссылку на Google Таблицу, чтобы увидеть обработанные данные.
          </div>
        )}
        {showHistory && (
          <HistoryModal
            isOpen={showHistory}
            onClose={() => setShowHistory(false)}
            items={history}
            onRestore={restoreFromHistory}
            onDelete={async (id) => {
              await deleteHistoryItem(id);
              loadHistoryList();
            }}
          />
        )}
      </div>
    </div>
  );
}

export default App;
