import React, { useState, useRef } from 'react';
import { api } from '../lib/api';
import { Product, Area } from '../types';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { Badge } from './ui/Badge';
import { 
  X, 
  Upload, 
  FileText, 
  Check, 
  AlertCircle, 
  Loader2, 
  ChevronRight, 
  ArrowRight,
  Info,
  HelpCircle,
  Files,
  Trash2
} from 'lucide-react';

interface AreaCSVImportModalProps {
  onClose: () => void;
  onImportComplete: () => void;
  existingProducts: Product[];
  existingAreas: Area[];
}

interface FieldMapping {
  key: string;
  label: string;
  required: boolean;
  type: 'string' | 'number';
  description: string;
}

const FIELDS_TO_MAP: FieldMapping[] = [
  { 
    key: 'areaName', 
    label: 'Area Name Source', 
    required: true, 
    type: 'string', 
    description: 'Where should we get the Area Name? Map to a CSV column OR use the CSV filename.' 
  },
  { 
    key: 'productMatch', 
    label: 'Product Identifier', 
    required: true, 
    type: 'string', 
    description: 'Matched against C-Number, Product Name, or SKU in the inventory.' 
  },
  { 
    key: 'maxOrderQuantity', 
    label: 'Max Order Qty', 
    required: false, 
    type: 'number', 
    description: 'Maximum limit allowed per order. Defaults to 10 if omitted.' 
  }
];

interface ParsedFile {
  id: string;
  name: string;
  cleanName: string; // filename without extension
  headers: string[];
  rows: string[][];
}

interface CombinedRow {
  fileId: string;
  fileName: string;
  cleanAreaName: string;
  rowIdx: number; // 1-based index in its own file
  data: string[];
}

function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let insideQuote = false;
  let entry = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        entry += '"';
        i++; 
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      row.push(entry);
      entry = '';
    } else if ((char === '\n' || char === '\r') && !insideQuote) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(entry);
      result.push(row);
      row = [];
      entry = '';
    } else {
      entry += char;
    }
  }

  if (entry || row.length > 0) {
    row.push(entry);
    result.push(row);
  }

  return result
    .map(r => r.map(c => c.trim()))
    .filter(r => r.length > 0 && r.some(c => c !== ''));
}

export default function AreaCSVImportModal({
  onClose,
  onImportComplete,
  existingProducts,
  existingAreas
}: AreaCSVImportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [uploadedFiles, setUploadedFiles] = useState<ParsedFile[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Verification results
  const [combinedRows, setCombinedRows] = useState<CombinedRow[]>([]);
  const [matchedCount, setMatchedCount] = useState<number>(0);
  const [unmatchedRows, setUnmatchedRows] = useState<{ rowIdx: number; value: string; area: string; fileName: string }[]>([]);
  const [uniqueAreas, setUniqueAreas] = useState<Set<string>>(new Set());
  const [areasToCreate, setAreasToCreate] = useState<string[]>([]);

  // Execution stats
  const [importProgress, setImportProgress] = useState<number>(0);
  const [importStats, setImportStats] = useState({
    configured: 0,
    areasCreated: 0,
    skipped: 0,
    total: 0
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (files: File[]) => {
    const csvFiles = files.filter(f => f.name.endsWith('.csv'));
    if (csvFiles.length === 0) {
      setError('No valid CSV files found.');
      return;
    }

    setError(null);

    const loadPromises = csvFiles.map(file => {
      return new Promise<ParsedFile | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          if (!text) {
            resolve(null);
            return;
          }

          const parsed = parseCSV(text);
          if (parsed.length < 2) {
            resolve(null);
            return;
          }

          const cleanName = file.name.replace(/\.[^/.]+$/, ""); // strip extension

          resolve({
            id: Math.random().toString(36).substring(2, 9),
            name: file.name,
            cleanName,
            headers: parsed[0],
            rows: parsed.slice(1)
          });
        };
        reader.onerror = () => resolve(null);
        reader.readAsText(file);
      });
    });

    Promise.all(loadPromises).then(results => {
      const validResults = results.filter((r): r is ParsedFile => r !== null);
      if (validResults.length === 0) {
        setError('Could not successfully parse any of the uploaded files.');
        return;
      }

      setUploadedFiles(prev => {
        const merged = [...prev];
        validResults.forEach(newFile => {
          if (!merged.some(m => m.name === newFile.name)) {
            merged.push(newFile);
          }
        });
        return merged;
      });
    });
  };

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleProceedToMapping = () => {
    if (uploadedFiles.length === 0) {
      setError('Please upload at least one CSV file.');
      return;
    }

    setError(null);

    // Dynamic heuristics mapping using the first file's headers
    const mainHeaders = uploadedFiles[0].headers;
    const autoMapped: Record<string, string> = {
      areaName: 'filename' // default fallback: use CSV file name
    };

    mainHeaders.forEach((h, index) => {
      const lowerH = h.toLowerCase();
      if (lowerH.includes('area') || lowerH.includes('dept') || lowerH.includes('department') || lowerH.includes('location')) {
        autoMapped['areaName'] = index.toString();
      } else if (lowerH.includes('c-number') || lowerH.includes('cnumber') || lowerH.includes('code') || lowerH.includes('item') || lowerH.includes('product') || lowerH.includes('consumable') || lowerH.includes('name')) {
        autoMapped['productMatch'] = index.toString();
      } else if (lowerH.includes('qty') || lowerH.includes('quantity') || lowerH.includes('max') || lowerH.includes('limit') || lowerH.includes('cap')) {
        autoMapped['maxOrderQuantity'] = index.toString();
      }
    });

    setColumnMapping(autoMapped);
    setStep(2);
  };

  const handleMappingChange = (fieldKey: string, val: string) => {
    setColumnMapping(prev => {
      const updated = { ...prev };
      if (val === 'ignore') {
        delete updated[fieldKey];
      } else {
        updated[fieldKey] = val;
      }
      return updated;
    });
  };

  const handleVerifyMapping = () => {
    const missingRequired = FIELDS_TO_MAP.filter(f => f.required && columnMapping[f.key] === undefined);
    if (missingRequired.length > 0) {
      setError(`Please map the required field(s): ${missingRequired.map(f => f.label).join(', ')}`);
      return;
    }

    setError(null);

    const areaMappingVal = columnMapping['areaName'];
    const matchMappingVal = columnMapping['productMatch'];
    const qtyMappingVal = columnMapping['maxOrderQuantity'];

    const areasFound = new Set<string>();
    const unmatched: { rowIdx: number; value: string; area: string; fileName: string }[] = [];
    const rowsList: CombinedRow[] = [];
    let matched = 0;

    uploadedFiles.forEach(file => {
      file.rows.forEach((row, idx) => {
        // Resolve Area Name
        let areaVal = '';
        if (areaMappingVal === 'filename') {
          areaVal = file.cleanName;
        } else {
          const colIdx = parseInt(areaMappingVal);
          if (!isNaN(colIdx) && row[colIdx]) {
            areaVal = row[colIdx].trim();
          }
        }

        const matchIdx = parseInt(matchMappingVal);
        const productVal = !isNaN(matchIdx) && row[matchIdx] ? row[matchIdx].trim() : '';

        if (!areaVal || !productVal) return;

        areasFound.add(areaVal);

        rowsList.push({
          fileId: file.id,
          fileName: file.name,
          cleanAreaName: areaVal,
          rowIdx: idx + 2,
          data: row
        });

        // Search product
        const targetStr = productVal.toLowerCase();
        const hasMatch = existingProducts.some(p => 
          p.cNumber.toLowerCase() === targetStr || 
          p.name.toLowerCase() === targetStr || 
          p.sku.toLowerCase() === targetStr
        );

        if (hasMatch) {
          matched++;
        } else {
          unmatched.push({
            rowIdx: idx + 2,
            value: productVal,
            area: areaVal,
            fileName: file.name
          });
        }
      });
    });

    setCombinedRows(rowsList);
    setUniqueAreas(areasFound);
    setMatchedCount(matched);
    setUnmatchedRows(unmatched);

    // Calculate new areas to create
    const existingNames = new Set(existingAreas.map(a => a.name.toLowerCase().trim()));
    const toCreate: string[] = [];
    areasFound.forEach(areaName => {
      if (!existingNames.has(areaName.toLowerCase().trim())) {
        toCreate.push(areaName);
      }
    });
    setAreasToCreate(toCreate);

    setStep(3);
  };

  const handleExecuteImport = async () => {
    setStep(4);
    setImportProgress(0);

    try {
      const areaMappingVal = columnMapping['areaName'];
      const matchMappingVal = columnMapping['productMatch'];
      const qtyMappingVal = columnMapping['maxOrderQuantity'];

      // 1. Create missing Areas first
      const areaMapByName = new Map<string, string>();
      existingAreas.forEach(a => areaMapByName.set(a.name.toLowerCase().trim(), a.id));

      let areasCreatedCount = 0;
      for (const areaName of areasToCreate) {
        const cleanName = areaName.trim();
        const createdArea = await api.createArea({ name: cleanName });
        areaMapByName.set(cleanName.toLowerCase(), createdArea.id);
        areasCreatedCount++;
      }

      // 2. Map and index products
      const productsMapByCNumber = new Map<string, Product>();
      const productsMapByName = new Map<string, Product>();
      const productsMapBySKU = new Map<string, Product>();

      existingProducts.forEach(p => {
        if (p.cNumber) productsMapByCNumber.set(p.cNumber.toLowerCase().trim(), p);
        if (p.name) productsMapByName.set(p.name.toLowerCase().trim(), p);
        if (p.sku) productsMapBySKU.set(p.sku.toLowerCase().trim(), p);
      });

      // Aggregate edits
      const productModifications = new Map<string, {
        allowedAreaIds: Set<string>;
        areaConfigs: Record<string, { maxOrderQuantity: number }>;
      }>();

      let configuredCount = 0;
      let skippedCount = 0;

      combinedRows.forEach(row => {
        const areaNameVal = row.cleanAreaName;
        const matchIdx = parseInt(matchMappingVal);
        const productVal = !isNaN(matchIdx) && row.data[matchIdx] ? row.data[matchIdx].trim() : '';

        if (!areaNameVal || !productVal) {
          skippedCount++;
          return;
        }

        const targetAreaId = areaMapByName.get(areaNameVal.toLowerCase().trim());
        if (!targetAreaId) {
          skippedCount++;
          return;
        }

        const matchKey = productVal.toLowerCase().trim();
        const product = productsMapByCNumber.get(matchKey) || 
                        productsMapByName.get(matchKey) || 
                        productsMapBySKU.get(matchKey);

        if (!product) {
          skippedCount++;
          return;
        }

        // Qty extraction
        let maxQty = 10;
        const qtyIdx = parseInt(qtyMappingVal);
        if (!isNaN(qtyIdx) && row.data[qtyIdx]) {
          const parsedQty = parseInt(row.data[qtyIdx].replace(/[^\d]/g, ''));
          if (!isNaN(parsedQty) && parsedQty > 0) {
            maxQty = parsedQty;
          }
        }

        if (!productModifications.has(product.id)) {
          productModifications.set(product.id, {
            allowedAreaIds: new Set(product.allowedAreaIds || []),
            areaConfigs: { ...(product.areaConfigs || {}) }
          });
        }

        const mod = productModifications.get(product.id)!;
        mod.allowedAreaIds.add(targetAreaId);
        mod.areaConfigs[targetAreaId] = { maxOrderQuantity: maxQty };
        configuredCount++;
      });

      // 3. Write updates via api.updateProduct
      const updateEntries = Array.from(productModifications.entries());
      const totalOps = updateEntries.length;

      for (let i = 0; i < totalOps; i++) {
        const [productId, mod] = updateEntries[i];
        await api.updateProduct(productId, {
          allowedAreaIds: Array.from(mod.allowedAreaIds),
          areaConfigs: mod.areaConfigs
        });
        const progress = Math.min(100, Math.round(((i + 1) / totalOps) * 100));
        setImportProgress(progress);
      }

      setImportStats({
        configured: configuredCount,
        areasCreated: areasCreatedCount,
        skipped: skippedCount,
        total: combinedRows.length
      });
      setImportProgress(100);
      onImportComplete();
    } catch (err) {
      console.error('Multiple Area Import Failed:', err);
      setError('Bulk import failed. Please check files and try again.');
      setStep(3);
    }
  };

  // Extract reference headers from first file or empty
  const primaryHeaders = uploadedFiles.length > 0 ? uploadedFiles[0].headers : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl flex flex-col max-h-[85vh] border border-slate-100 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 bg-slate-50">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Import Area Lists (Multi-Upload)</h3>
            <p className="text-xs text-slate-500">Upload multiple Area lists at once. Map columns or use filenames as Area names.</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-500 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: UPLOAD & MULTI-FILE LIST */}
          {step === 1 && (
            <div className="space-y-4">
              <div 
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragActive 
                    ? 'border-slate-800 bg-slate-50' 
                    : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50/50'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept=".csv"
                  multiple
                />
                <div className="mx-auto h-12 w-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 mb-4 border border-slate-200">
                  <Upload className="h-5 w-5" />
                </div>
                <p className="text-sm font-bold text-slate-800">Drag & drop your CSV file(s) here</p>
                <p className="text-xs text-slate-500 mt-1">or click to browse multiple files from your device</p>
                <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
                  <Files className="h-3.5 w-3.5 text-slate-400" /> You can upload separate CSV files for each area at the same time
                </div>
              </div>

              {/* Uploaded Files Queue */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Uploaded Files ({uploadedFiles.length})</span>
                  <div className="border border-slate-150 rounded-lg divide-y divide-slate-100 bg-white max-h-[180px] overflow-y-auto">
                    {uploadedFiles.map(file => (
                      <div key={file.id} className="p-3 flex items-center justify-between hover:bg-slate-50/55">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{file.name}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{file.rows.length} records • clean name: <span className="font-semibold text-slate-700">"{file.cleanName}"</span></p>
                          </div>
                        </div>
                        <button 
                          onClick={() => removeFile(file.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action */}
              <div className="pt-2 flex justify-end">
                <Button 
                  size="sm" 
                  onClick={handleProceedToMapping}
                  disabled={uploadedFiles.length === 0}
                  className="gap-1.5"
                >
                  Configure Mappings <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: FIELD MAPPING */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Map CSV Columns</span>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200 flex items-center gap-1.5">
                  <Files className="h-3 w-3 text-slate-400" /> {uploadedFiles.length} Files Queued
                </span>
              </div>

              <div className="space-y-3.5">
                {FIELDS_TO_MAP.map(field => {
                  const currentVal = columnMapping[field.key] || '';
                  return (
                    <div key={field.key} className="p-4 rounded-xl border border-slate-150 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="space-y-0.5 max-w-sm">
                        <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                          {field.label}
                          {field.required ? (
                            <Badge className="bg-red-100 hover:bg-red-100 text-red-700 text-[10px] border-none font-semibold px-1.5 py-0">Required</Badge>
                          ) : (
                            <span className="text-slate-400 font-normal text-xs">(Optional)</span>
                          )}
                        </label>
                        <p className="text-xs text-slate-500">{field.description}</p>
                      </div>

                      <select 
                        value={currentVal || 'ignore'} 
                        onChange={(e) => handleMappingChange(field.key, e.target.value)}
                        className="h-9 text-xs rounded-lg border border-slate-200 px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 min-w-[200px]"
                      >
                        {field.key === 'areaName' ? (
                          <>
                            <option value="filename">Use CSV Filename (e.g. "{uploadedFiles[0]?.cleanName || 'Area'}")</option>
                            <option disabled>──────────</option>
                          </>
                        ) : (
                          <option value="ignore">
                            {field.required ? '-- Choose Column --' : '-- Ignore Column --'}
                          </option>
                        )}
                        {primaryHeaders.map((hdr, idx) => (
                          <option key={idx} value={idx.toString()}>{idx + 1}. {hdr}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 flex justify-between">
                <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button size="sm" onClick={handleVerifyMapping}>
                  Verify & Review <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & REVIEW */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <h4 className="text-sm font-bold text-slate-800">Ready to Import</h4>
                <Badge className="bg-blue-100 text-blue-800 font-semibold border-none px-2 text-[10px]">Review</Badge>
              </div>

              {/* Quick Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-150">
                  <p className="text-[10px] text-slate-500 font-medium">TOTAL ROWS IN QUEUE</p>
                  <p className="text-xl font-bold text-slate-800 mt-0.5">{combinedRows.length}</p>
                </div>
                <div className="bg-green-50/50 p-3 rounded-lg border border-green-150">
                  <p className="text-[10px] text-green-700 font-medium">MATCHED PRODUCTS</p>
                  <p className="text-xl font-bold text-green-800 mt-0.5">{matchedCount}</p>
                </div>
                <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-150">
                  <p className="text-[10px] text-amber-700 font-medium">AREAS IDENTIFIED</p>
                  <p className="text-xl font-bold text-amber-800 mt-0.5">{uniqueAreas.size}</p>
                </div>
              </div>

              {/* Informative notice */}
              {areasToCreate.length > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-xs flex items-start gap-2.5">
                  <Info className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
                  <div>
                    <span className="font-bold">Auto-Creating Areas:</span> The following {areasToCreate.length} areas are not currently in your system and will be automatically created:
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {areasToCreate.map((name, i) => (
                        <span key={i} className="bg-white px-2 py-0.5 rounded border border-blue-200 text-blue-800 font-medium text-[10px]">
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Warnings list */}
              {unmatchedRows.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500" /> Skipped Rows ({unmatchedRows.length} items not found in Master Inventory)
                  </span>
                  <div className="max-h-[160px] overflow-y-auto border border-slate-150 rounded-lg text-xs divide-y divide-slate-100 bg-white">
                    {unmatchedRows.map((item, idx) => (
                      <div key={idx} className="p-2 flex justify-between items-center hover:bg-slate-50">
                        <span className="font-medium text-slate-700">
                          <span className="text-[10px] text-slate-400 mr-2">[{item.fileName}]</span>
                          Row {item.rowIdx}: <code className="bg-slate-100 px-1 py-0.5 rounded">{item.value}</code>
                        </span>
                        <span className="text-slate-400">Area: {item.area}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500 italic">Please make sure the product identifiers in your CSVs match existing names, C-Numbers, or SKUs in your master inventory.</p>
                </div>
              )}

              <div className="pt-2 flex justify-between">
                <Button variant="outline" size="sm" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button size="sm" onClick={handleExecuteImport} className="gap-1.5">
                  Start Bulk Import <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: IMPORTING PROGRESS & COMPLETED */}
          {step === 4 && (
            <div className="space-y-6 py-4">
              {importProgress < 100 ? (
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <Loader2 className="h-10 w-10 animate-spin text-slate-700" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-bold text-slate-800">Processing Area Catalog updates...</p>
                    <p className="text-xs text-slate-500">Writing changes to database</p>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                    <div 
                      className="bg-slate-800 h-full transition-all duration-300"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded border border-slate-150 shadow-sm">{importProgress}% completed</span>
                </div>
              ) : (
                <div className="space-y-5 text-center">
                  <div className="flex justify-center">
                    <div className="h-12 w-12 bg-green-50 border-2 border-green-200 rounded-full flex items-center justify-center text-green-600 shadow-sm">
                      <Check className="h-6 w-6" />
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-base font-bold text-slate-800">Bulk Import Successful!</p>
                    <p className="text-xs text-slate-500">All uploaded consumable lists have been imported, mapping them to their corresponding production areas.</p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-150 bg-slate-50 max-w-sm mx-auto text-left space-y-2.5">
                    <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Results Summary</span>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <span className="text-slate-500">Created Areas:</span>
                      <span className="font-bold text-slate-800 text-right">{importStats.areasCreated}</span>
                      
                      <span className="text-slate-500">Configured Products:</span>
                      <span className="font-bold text-slate-800 text-right">{importStats.configured}</span>
                      
                      <span className="text-slate-500">Skipped/No Match:</span>
                      <span className="font-bold text-slate-800 text-right">{importStats.skipped}</span>
                      
                      <div className="col-span-2 border-t border-slate-200/60 my-1"></div>

                      <span className="font-bold text-slate-600">Total Rows:</span>
                      <span className="font-bold text-slate-800 text-right">{importStats.total}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button size="sm" onClick={onClose} className="w-full sm:w-auto">
                      Done & Close
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
