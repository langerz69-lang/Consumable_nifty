import React, { useState, useRef } from 'react';
import { api } from '../lib/api';
import { Product, Category, Supplier } from '../types';
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
  Database,
  Info,
  CheckCircle2,
  Settings
} from 'lucide-react';

interface CSVImportModalProps {
  onClose: () => void;
  onImportComplete: () => void;
  existingProducts: Product[];
  existingCategories: Category[];
  existingSuppliers: Supplier[];
}

interface FieldMapping {
  key: string;
  label: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean';
  description: string;
}

const FIELDS_TO_MAP: FieldMapping[] = [
  { key: 'name', label: 'Product Name', required: true, type: 'string', description: 'The name of the consumable' },
  { key: 'cNumber', label: 'C-Number', required: true, type: 'string', description: 'Unique identification code (e.g., C-10293)' },
  { key: 'sku', label: 'SKU / Part Number', required: false, type: 'string', description: 'Stock Keeping Unit (optional)' },
  { key: 'categoryName', label: 'Category Name', required: false, type: 'string', description: 'Name of category (will auto-create if not found)' },
  { key: 'supplierName', label: 'Supplier Name', required: false, type: 'string', description: 'Name of supplier (will auto-create if not found)' },
  { key: 'binLocation', label: 'Bin Location', required: false, type: 'string', description: 'Aisle, shelf, or bin location code' },
  { key: 'packSize', label: 'Pack Size', required: false, type: 'string', description: 'Packaging, e.g., 50 pack, 10 rolls' },
  { key: 'consumedPerUnit', label: 'Consumed Per Unit', required: false, type: 'string', description: 'Standard usage, e.g., 2 per shift' },
  { key: 'stockLevel', label: 'Qty on Hand', required: false, type: 'number', description: 'Current physical stock quantity' },
  { key: 'minStockThreshold', label: 'Min Stock Threshold', required: false, type: 'number', description: 'Low stock warning limit' },
  { key: 'maxStockThreshold', label: 'Max Stock Threshold', required: false, type: 'number', description: 'Maximum storage limit' },
  { key: 'unitCost', label: 'Unit Cost (£)', required: false, type: 'number', description: 'Cost per single unit' },
  { key: 'purchaseRate', label: 'Purchase Rate (£)', required: false, type: 'number', description: 'Bulk price paid per pack' },
  { key: 'unitsPerPurchase', label: 'Units Per Purchase', required: false, type: 'number', description: 'Quantity of items in a purchase pack' },
  { key: 'adrScore', label: 'ADR Compliance Score', required: false, type: 'number', description: 'Dangerous goods safety score' }
];

export function parseCSV(text: string): string[][] {
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
        i++; // skip next quote
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

export default function CSVImportModal({
  onClose,
  onImportComplete,
  existingProducts,
  existingCategories,
  existingSuppliers
}: CSVImportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, number>>({});
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update'>('skip');
  const [isDragging, setIsDragging] = useState(false);
  
  // Progress/Import statistics
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStats, setImportStats] = useState({
    added: 0,
    updated: 0,
    skipped: 0,
    categoriesCreated: 0,
    suppliersCreated: 0,
    total: 0
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Download template CSV function
  const downloadTemplate = () => {
    const templateContent = [
      'Name,C-Number,SKU,Category,Supplier,Bin Location,Pack Size,Consumed Per Unit,Qty on Hand,Min Stock,Max Stock,Unit Cost,Purchase Rate,Units Per Purchase,ADR Score',
      'Heavy Duty Nitrile Gloves,C-23485,GLV-HD-L,Safety PPE,Apex Industrial Solutions,Aisle 4 Shelf 2,100 pack,2 per shift,150,50,500,0.15,15.00,100,0',
      'Industrial Degreaser Solvent,C-12948,CHM-DEG-05,,Chemical Supplies LTD,Aisle 9 Shelf 1,5L canister,0.1 per unit,25,10,100,12.50,12.50,1,3',
      'Safety Eye Shield Clear,C-99824,PPE-EYE-01,Safety PPE,Apex Industrial Solutions,Aisle 2 Shelf 1,Single,1 per month,85,20,200,2.10,2.10,1,0'
    ].join('\n');

    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'consumables_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processCSVFile = (text: string, name: string) => {
    const rows = parseCSV(text);
    if (rows.length < 2) {
      alert('The CSV file appears to be empty or contains no data rows besides the header.');
      return;
    }
    
    const fileHeaders = rows[0];
    const dataRows = rows.slice(1);
    
    setCsvText(text);
    setFileName(name);
    setHeaders(fileHeaders);
    setCsvRows(dataRows);

    // Auto-detect mappings based on header names
    const autoMapped: Record<string, number> = {};
    fileHeaders.forEach((header, index) => {
      const h = header.toLowerCase().trim();
      
      if (h.includes('c-number') || h.includes('cnumber') || h === 'c' || h.includes('c number') || h.includes('code')) {
        autoMapped['cNumber'] = index;
      } else if (h.includes('sku') || h.includes('part number') || h.includes('partno')) {
        autoMapped['sku'] = index;
      } else if (h.includes('name') || h.includes('title') || h === 'product' || h.includes('description')) {
        autoMapped['name'] = index;
      } else if (h.includes('category')) {
        autoMapped['categoryName'] = index;
      } else if (h.includes('supplier') || h.includes('vendor')) {
        autoMapped['supplierName'] = index;
      } else if (h.includes('bin') || h.includes('location') || h.includes('rack')) {
        autoMapped['binLocation'] = index;
      } else if (h.includes('pack size') || h.includes('packsize') || h.includes('size')) {
        autoMapped['packSize'] = index;
      } else if (h.includes('consumed') || h.includes('consumption')) {
        autoMapped['consumedPerUnit'] = index;
      } else if (h.includes('stock') || h.includes('qty') || h.includes('quantity') || h.includes('on hand') || h.includes('level') || h === 'count') {
        autoMapped['stockLevel'] = index;
      } else if (h.includes('min') || h.includes('threshold') || h.includes('reorder') || h.includes('warning')) {
        autoMapped['minStockThreshold'] = index;
      } else if (h.includes('max') || h.includes('target')) {
        autoMapped['maxStockThreshold'] = index;
      } else if (h.includes('unit cost') || h.includes('unitcost') || h.includes('cost per') || h === 'cost' || h === 'price') {
        autoMapped['unitCost'] = index;
      } else if (h.includes('purchase rate') || h.includes('purchaserate') || h.includes('rate')) {
        autoMapped['purchaseRate'] = index;
      } else if (h.includes('units per purchase') || h.includes('pack qty') || h.includes('multiplier')) {
        autoMapped['unitsPerPurchase'] = index;
      } else if (h.includes('adr score') || h.includes('adrscore') || h.includes('dangerous') || h.includes('compliance')) {
        autoMapped['adrScore'] = index;
      }
    });

    setColumnMapping(autoMapped);
    setStep(2);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processCSVFile(text, file.name);
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        processCSVFile(text, file.name);
      };
      reader.readAsText(file);
    } else {
      alert('Please upload a valid CSV file.');
    }
  };

  const handleMappingChange = (fieldKey: string, columnIndexStr: string) => {
    const val = columnIndexStr === 'ignore' ? undefined : parseInt(columnIndexStr);
    setColumnMapping(prev => {
      const copy = { ...prev };
      if (val === undefined) {
        delete copy[fieldKey];
      } else {
        copy[fieldKey] = val;
      }
      return copy;
    });
  };

  // Validate mappings and move to step 3 (Preview)
  const proceedToPreview = () => {
    // Check that required fields are mapped
    const missing = FIELDS_TO_MAP.filter(f => f.required && columnMapping[f.key] === undefined);
    if (missing.length > 0) {
      alert(`Please map all required fields: ${missing.map(f => f.label).join(', ')}`);
      return;
    }
    setStep(3);
  };

  // Calculate stats for preview
  const getValidationReport = () => {
    let validCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;

    const existingProductsByCNumber = new Map<string, Product>();
    const existingProductsByName = new Map<string, Product>();
    existingProducts.forEach(p => {
      if (p.cNumber) existingProductsByCNumber.set(p.cNumber.toLowerCase().trim(), p);
      if (p.name) existingProductsByName.set(p.name.toLowerCase().trim(), p);
    });

    csvRows.forEach(row => {
      const nameVal = row[columnMapping['name']]?.trim();
      const cNumberVal = row[columnMapping['cNumber']]?.trim();

      if (!nameVal || !cNumberVal) {
        invalidCount++;
        return;
      }

      const alreadyExists = 
        existingProductsByCNumber.has(cNumberVal.toLowerCase()) || 
        existingProductsByName.has(nameVal.toLowerCase());

      if (alreadyExists) {
        duplicateCount++;
      } else {
        validCount++;
      }
    });

    return { validCount, duplicateCount, invalidCount, total: csvRows.length };
  };

  const executeImport = async () => {
    setIsImporting(true);
    setImportProgress(0);

    const existingProductsByCNumber = new Map<string, Product>();
    const existingProductsByName = new Map<string, Product>();
    existingProducts.forEach(p => {
      if (p.cNumber) existingProductsByCNumber.set(p.cNumber.toLowerCase().trim(), p);
      if (p.name) existingProductsByName.set(p.name.toLowerCase().trim(), p);
    });

    const categoryCache = new Map<string, string>();
    const supplierCache = new Map<string, string>();
    
    existingCategories.forEach(c => categoryCache.set(c.name.toLowerCase().trim(), c.id));
    existingSuppliers.forEach(s => supplierCache.set(s.name.toLowerCase().trim(), s.id));

    const productsToUpsert: Partial<Product>[] = [];
    
    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let catsCreated = 0;
    let supsCreated = 0;

    // Default Fallbacks
    let uncategorizedId = categoryCache.get('uncategorized');
    let unknownSupplierId = supplierCache.get('unknown supplier');

    try {
      if (!uncategorizedId) {
        const createdCat = await api.createCategory('Uncategorized');
        uncategorizedId = createdCat.id;
        categoryCache.set('uncategorized', uncategorizedId);
        catsCreated++;
      }
      if (!unknownSupplierId) {
        const createdSup = await api.createSupplier('Unknown Supplier');
        unknownSupplierId = createdSup.id;
        supplierCache.set('unknown supplier', unknownSupplierId);
        supsCreated++;
      }

      // Process rows
      for (const row of csvRows) {
        const nameVal = row[columnMapping['name']]?.trim();
        const cNumberVal = row[columnMapping['cNumber']]?.trim();

        if (!nameVal || !cNumberVal) {
          skippedCount++;
          continue;
        }

        // Check duplicate
        const existingProduct = 
          existingProductsByCNumber.get(cNumberVal.toLowerCase()) || 
          existingProductsByName.get(nameVal.toLowerCase());

        if (existingProduct) {
          if (duplicateStrategy === 'skip') {
            skippedCount++;
            continue;
          }
        }

        // 1. Resolve Category
        let rowCategoryId = uncategorizedId;
        const mappedCatIdx = columnMapping['categoryName'];
        if (mappedCatIdx !== undefined && row[mappedCatIdx]?.trim()) {
          const catName = row[mappedCatIdx].trim();
          const catKey = catName.toLowerCase();
          if (categoryCache.has(catKey)) {
            rowCategoryId = categoryCache.get(catKey)!;
          } else {
            const createdCat = await api.createCategory(catName);
            rowCategoryId = createdCat.id;
            categoryCache.set(catKey, rowCategoryId);
            catsCreated++;
          }
        }

        // 2. Resolve Supplier
        let rowSupplierId = unknownSupplierId;
        const mappedSupIdx = columnMapping['supplierName'];
        if (mappedSupIdx !== undefined && row[mappedSupIdx]?.trim()) {
          const supName = row[mappedSupIdx].trim();
          const supKey = supName.toLowerCase();
          if (supplierCache.has(supKey)) {
            rowSupplierId = supplierCache.get(supKey)!;
          } else {
            const createdSup = await api.createSupplier(supName);
            rowSupplierId = createdSup.id;
            supplierCache.set(supKey, rowSupplierId);
            supsCreated++;
          }
        }

        // 3. Extract mapped variables
        const getValue = (key: string, defaultValue: any) => {
          const idx = columnMapping[key];
          if (idx === undefined) return defaultValue;
          const val = row[idx]?.trim();
          if (val === undefined || val === '') return defaultValue;
          return val;
        };

        const getNumber = (key: string, defaultValue: number) => {
          const val = getValue(key, null);
          if (val === null) return defaultValue;
          const num = parseFloat(val.replace(/[^\d.-]/g, ''));
          return isNaN(num) ? defaultValue : num;
        };

        // 4. Construct Product Entity
        const adrVal = getNumber('adrScore', 0);
        const isAdr = adrVal > 0;

        const productPayload: Partial<Product> = {
          id: existingProduct ? existingProduct.id : undefined,
          name: nameVal,
          cNumber: cNumberVal,
          sku: getValue('sku', ''),
          categoryId: rowCategoryId,
          supplierId: rowSupplierId,
          binLocation: getValue('binLocation', 'Unassigned'),
          packSize: getValue('packSize', '1'),
          consumedPerUnit: getValue('consumedPerUnit', '1'),
          stockLevel: getNumber('stockLevel', 0),
          minStockThreshold: getNumber('minStockThreshold', 10),
          maxStockThreshold: getNumber('maxStockThreshold', 100),
          unitCost: getNumber('unitCost', 0),
          purchaseRate: getNumber('purchaseRate', 0),
          unitsPerPurchase: getNumber('unitsPerPurchase', 1),
          isAdr,
          adrScore: adrVal,
          isArchived: false,
          allowedAreaIds: existingProduct?.allowedAreaIds || [],
          areaConfigs: existingProduct?.areaConfigs || {}
        };

        if (existingProduct) {
          updatedCount++;
        } else {
          addedCount++;
        }
        productsToUpsert.push(productPayload);
      }

      setImportProgress(40);
      await api.batchUpsertProducts(productsToUpsert);
      setImportProgress(100);

      setImportStats({
        added: addedCount,
        updated: updatedCount,
        skipped: skippedCount,
        categoriesCreated: catsCreated,
        suppliersCreated: supsCreated,
        total: csvRows.length
      });
      setStep(4);
    } catch (err) {
      console.error('Import Failed:', err);
      alert('There was an error importing the CSV file to the database. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  const report = getValidationReport();

  return (
    <div id="csv-import-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col motion-preset-fade">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Database className="h-5 w-5 text-indigo-600" />
              CSV Product Catalog Importer
            </h2>
            <p className="text-sm text-slate-500 mt-1">Easily batch-import hundreds of consumables</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isImporting} className="rounded-full p-2 h-9 w-9">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Wizard Progress Stepper */}
        <div className="bg-slate-50/50 border-b border-slate-100 px-6 py-3 flex items-center gap-6 text-xs font-semibold text-slate-400">
          <div className={`flex items-center gap-1.5 ${step === 1 ? 'text-indigo-600' : 'text-slate-500'}`}>
            <span className={`h-5 w-5 rounded-full flex items-center justify-center border ${step === 1 ? 'border-indigo-600 bg-indigo-50 font-bold' : 'border-slate-300'}`}>1</span>
            Upload File
          </div>
          <ChevronRight className="h-3 w-3" />
          <div className={`flex items-center gap-1.5 ${step === 2 ? 'text-indigo-600' : step > 2 ? 'text-emerald-600' : ''}`}>
            <span className={`h-5 w-5 rounded-full flex items-center justify-center border ${step === 2 ? 'border-indigo-600 bg-indigo-50 font-bold' : step > 2 ? 'border-emerald-500 bg-emerald-50 font-bold text-emerald-600' : 'border-slate-300'}`}>
              {step > 2 ? <Check className="h-3 w-3" /> : '2'}
            </span>
            Map Columns
          </div>
          <ChevronRight className="h-3 w-3" />
          <div className={`flex items-center gap-1.5 ${step === 3 ? 'text-indigo-600' : step > 3 ? 'text-emerald-600' : ''}`}>
            <span className={`h-5 w-5 rounded-full flex items-center justify-center border ${step === 3 ? 'border-indigo-600 bg-indigo-50 font-bold' : step > 3 ? 'border-emerald-500 bg-emerald-50 font-bold text-emerald-600' : 'border-slate-300'}`}>
              {step > 3 ? <Check className="h-3 w-3" /> : '3'}
            </span>
            Verify & Import
          </div>
          <ChevronRight className="h-3 w-3" />
          <div className={`flex items-center gap-1.5 ${step === 4 ? 'text-indigo-600' : ''}`}>
            <span className={`h-5 w-5 rounded-full flex items-center justify-center border ${step === 4 ? 'border-indigo-600 bg-indigo-50 font-bold' : 'border-slate-300'}`}>4</span>
            Done
          </div>
        </div>

        {/* Content Section */}
        <div className="p-6 overflow-y-auto flex-1 min-h-[300px]">
          
          {/* STEP 1: Upload File */}
          {step === 1 && (
            <div className="space-y-6">
              <div 
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                  isDragging ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 hover:border-slate-300 bg-slate-50/20'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept=".csv" 
                  className="hidden" 
                />
                <Upload className="h-10 w-10 text-indigo-500 mx-auto mb-4" />
                <h3 className="text-base font-semibold text-slate-800">Drag and drop your CSV file here</h3>
                <p className="text-sm text-slate-500 mt-1">or click to browse your computer (.csv files only)</p>
                <div className="mt-4 flex justify-center">
                  <Badge variant="secondary" className="px-3 py-1 font-mono text-xs">UTF-8 Encoded CSV</Badge>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 flex gap-3">
                <Info className="h-5 w-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-slate-600 space-y-1">
                  <h4 className="font-semibold text-slate-800">Need a starting template?</h4>
                  <p>Download our beautifully pre-structured CSV template to make mapping flawless. You can paste your existing 500 product lines directly in.</p>
                  <button 
                    onClick={downloadTemplate} 
                    className="text-indigo-600 hover:text-indigo-700 font-bold text-xs mt-2 underline flex items-center gap-1 cursor-pointer"
                  >
                    <FileText className="h-3 w-3" /> Download CSV Import Template
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Column Mapping */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-slate-50 border border-slate-100 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-500" />
                  <span className="font-semibold text-slate-800 text-sm">{fileName}</span>
                  <span className="text-slate-400 text-xs">({csvRows.length} rows loaded)</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => setStep(1)} className="text-xs h-8">Change File</Button>
              </div>

              <div>
                <h3 className="font-semibold text-slate-800 text-sm mb-2">Map CSV Columns to Product Fields</h3>
                <p className="text-xs text-slate-500">We auto-detected columns that look similar, but you can manually verify or adjust. Unmapped optional fields will use safe system defaults.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[350px] overflow-y-auto pr-2">
                {FIELDS_TO_MAP.map(field => {
                  const mappedIdx = columnMapping[field.key];
                  const selectVal = mappedIdx !== undefined ? mappedIdx.toString() : 'ignore';

                  return (
                    <div key={field.key} className="flex flex-col gap-1.5 p-3 rounded-lg border border-slate-150 bg-white hover:border-slate-200 transition-colors">
                      <div className="flex justify-between items-start">
                        <label className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                          {field.label}
                          {field.required && <span className="text-red-500 text-xs font-bold">*Required</span>}
                        </label>
                        <select 
                          value={selectVal} 
                          onChange={(e) => handleMappingChange(field.key, e.target.value)}
                          className={`h-8 text-xs rounded-md border px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-[180px] truncate ${
                            field.required && mappedIdx === undefined 
                              ? 'border-red-300 bg-red-50/20 text-red-700' 
                              : mappedIdx !== undefined 
                                ? 'border-emerald-300 bg-emerald-50/10 text-emerald-800 font-medium' 
                                : 'border-slate-250 text-slate-500'
                          }`}
                        >
                          <option value="ignore">{field.required ? '-- Select Column --' : 'Ignore / Use Default'}</option>
                          {headers.map((hdr, idx) => (
                            <option key={idx} value={idx}>{idx + 1}. {hdr}</option>
                          ))}
                        </select>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{field.description}</p>
                    </div>
                  );
                })}
              </div>

              {/* Data Preview Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600 border-b border-slate-200">
                  Visual Mapping Preview (First 3 lines of CSV)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100/50 border-b border-slate-200 font-semibold text-slate-700">
                        <th className="p-2.5">Row</th>
                        {FIELDS_TO_MAP.filter(f => columnMapping[f.key] !== undefined).map(f => (
                          <th key={f.key} className="p-2.5 whitespace-nowrap">{f.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.slice(0, 3).map((row, rIdx) => (
                        <tr key={rIdx} className="border-b border-slate-100 last:border-b-0 text-slate-600 hover:bg-slate-50/30">
                          <td className="p-2.5 font-mono text-slate-400">#{rIdx + 1}</td>
                          {FIELDS_TO_MAP.filter(f => columnMapping[f.key] !== undefined).map(f => {
                            const idx = columnMapping[f.key]!;
                            return (
                              <td key={f.key} className="p-2.5 truncate max-w-[150px]" title={row[idx]}>
                                {row[idx] || <span className="text-slate-350 italic">empty</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Preview and Configuration */}
          {step === 3 && !isImporting && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-indigo-100 bg-indigo-50/20">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="h-10 w-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wider">Total Rows</p>
                      <p className="text-2xl font-bold text-slate-800">{report.total} lines</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-emerald-100 bg-emerald-50/10">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="h-10 w-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-emerald-500 font-semibold uppercase tracking-wider">New Additions</p>
                      <p className="text-2xl font-bold text-slate-800">{report.validCount} items</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-amber-100 bg-amber-50/20">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="h-10 w-10 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
                      <Settings className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-amber-500 font-semibold uppercase tracking-wider">Duplicate Matches</p>
                      <p className="text-2xl font-bold text-slate-800">{report.duplicateCount} items</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {report.invalidCount > 0 && (
                <div className="bg-red-50 border border-red-150 rounded-lg p-3.5 flex gap-2.5 text-sm text-red-800">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                  <div>
                    <span className="font-semibold">Skipped Records Alert:</span> {report.invalidCount} rows in your CSV have missing or unmapped required identifiers (Product Name or C-Number). These lines will be automatically skipped during import.
                  </div>
                </div>
              )}

              {/* Duplicate Handling Selector */}
              <div className="border border-slate-200 rounded-xl p-5 space-y-4 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-indigo-500" />
                  <h3 className="font-semibold text-slate-800 text-sm">Conflict & Duplicate Resolution Strategy</h3>
                </div>
                
                <p className="text-xs text-slate-500">
                  When a product in your CSV matches an item already in your catalog (either by C-Number or exact Name match):
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div 
                    onClick={() => setDuplicateStrategy('skip')}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      duplicateStrategy === 'skip' 
                        ? 'border-indigo-600 bg-indigo-50/10 shadow-sm' 
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-800">Skip Existing (Recommended)</span>
                      <input 
                        type="radio" 
                        checked={duplicateStrategy === 'skip'} 
                        onChange={() => setDuplicateStrategy('skip')}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500" 
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                      Maintains database purity. Safe import that only appends new items. Does NOT modify or touch any of your existing {report.duplicateCount} items.
                    </p>
                  </div>

                  <div 
                    onClick={() => setDuplicateStrategy('update')}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      duplicateStrategy === 'update' 
                        ? 'border-indigo-600 bg-indigo-50/10 shadow-sm' 
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-800">Update Existing (Merge)</span>
                      <input 
                        type="radio" 
                        checked={duplicateStrategy === 'update'} 
                        onChange={() => setDuplicateStrategy('update')}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500" 
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                      Overwrites matched items with values from the CSV. Safe because no existing items are ever deleted, but details are synchronized.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3.5: Importing Progress */}
          {isImporting && (
            <div className="py-12 flex flex-col items-center justify-center space-y-6">
              <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
              <div className="text-center space-y-2">
                <h3 className="text-base font-bold text-slate-800">Writing to Database...</h3>
                <p className="text-sm text-slate-500 max-w-sm">
                  We are uploading products in secure transactional batches of 400 lines to ensure performance and quota limits.
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full max-w-md bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/55">
                <div 
                  className="bg-indigo-600 h-full transition-all duration-300 ease-out rounded-full" 
                  style={{ width: `${importProgress}%` }}
                />
              </div>
              <span className="text-xs font-mono text-slate-400 font-bold">{importProgress}% Completed</span>
            </div>
          )}

          {/* STEP 4: Success Report */}
          {step === 4 && (
            <div className="py-6 flex flex-col items-center justify-center space-y-6 text-center motion-preset-bounce">
              <div className="h-14 w-14 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 border border-emerald-200 shadow-sm">
                <Check className="h-8 w-8" />
              </div>
              
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-slate-800">Catalogue Import Complete!</h3>
                <p className="text-sm text-slate-500">Products were safely successfully loaded to Firestore.</p>
              </div>

              <div className="border border-slate-150 rounded-xl bg-slate-50/50 p-6 grid grid-cols-2 sm:grid-cols-3 gap-6 max-w-md w-full text-left">
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Newly Created</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">+{importStats.added}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Merged / Updated</p>
                  <p className="text-2xl font-bold text-indigo-600 mt-1">+{importStats.updated}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Skipped / Ignored</p>
                  <p className="text-2xl font-bold text-slate-500 mt-1">{importStats.skipped}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Categories Created</p>
                  <p className="text-lg font-bold text-slate-700 mt-1">+{importStats.categoriesCreated}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Suppliers Created</p>
                  <p className="text-lg font-bold text-slate-700 mt-1">+{importStats.suppliersCreated}</p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
          {step === 1 && (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button disabled className="gap-2">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={proceedToPreview} className="gap-2">
                Preview <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          )}

          {step === 3 && !isImporting && (
            <>
              <Button variant="outline" onClick={() => setStep(2)}>Adjust Mapping</Button>
              <Button onClick={executeImport} className="gap-2 bg-emerald-600 hover:bg-emerald-700 border-emerald-700 shadow-sm">
                <Database className="h-4 w-4" /> Start Importing
              </Button>
            </>
          )}

          {step === 4 && (
            <Button onClick={onImportComplete} className="bg-slate-900 hover:bg-slate-800 text-white shadow-md">
              Finish & Refresh
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}
