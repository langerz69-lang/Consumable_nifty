import React, { useState, useRef } from 'react';
import { api } from '../lib/api';
import { Supplier, Product } from '../types';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { Badge } from './ui/Badge';
import { parseCSV } from './CSVImportModal';
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
  Settings,
  RefreshCw
} from 'lucide-react';

interface SupplierCSVImportModalProps {
  onClose: () => void;
  onImportComplete: () => void;
  existingSuppliers: Supplier[];
}

export default function SupplierCSVImportModal({
  onClose,
  onImportComplete,
  existingSuppliers
}: SupplierCSVImportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, number>>({});
  const [isDragging, setIsDragging] = useState(false);
  
  // Progress/Import statistics
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStats, setImportStats] = useState({
    suppliersCreated: 0,
    suppliersUpdated: 0,
    productsLinked: 0,
    total: 0
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Download template CSV function
  const downloadTemplate = () => {
    const templateContent = [
      'Supplier Name,Supplier Code',
      'Gates,69e702b34e87fadbd86b1545',
      'Apex Industrial Solutions,70a312c34e87fadbd86b3346',
      'Industrial Materials Ltd,55b119c84e27fabbd34b1234'
    ].join('\n');

    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'suppliers_import_template.csv');
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
      
      if (h.includes('name') || h === 'supplier' || h.includes('title') || h === 'company') {
        autoMapped['name'] = index;
      } else if (h.includes('code') || h.includes('id') || h.includes('key') || h.includes('ref')) {
        autoMapped['code'] = index;
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
    if (columnMapping['name'] === undefined) {
      alert('Please map the Supplier Name field.');
      return;
    }
    if (columnMapping['code'] === undefined) {
      alert('Please map the Supplier Code / ID field.');
      return;
    }
    setStep(3);
  };

  // Execute Import and migration
  const executeImport = async () => {
    setIsImporting(true);
    setImportProgress(0);

    try {
      // 1. Fetch current products & suppliers from DB
      const [allProducts, allSuppliers] = await Promise.all([
        api.getProducts(),
        api.getSuppliers()
      ]);

      const existingSuppliersById = new Map<string, Supplier>();
      allSuppliers.forEach(s => existingSuppliersById.set(s.id, s));

      const csvSupplierMap = new Map<string, string>(); // code -> name
      for (const row of csvRows) {
        const nameVal = row[columnMapping['name']]?.trim();
        const codeVal = row[columnMapping['code']]?.trim();
        if (nameVal && codeVal) {
          csvSupplierMap.set(codeVal, nameVal);
        }
      }

      // Map dummy supplier IDs to the real legacy supplier code
      const dummyToRealSupplierIdMap = new Map<string, string>();
      const suppliersToDelete = new Set<string>();

      allSuppliers.forEach(s => {
        for (const [codeVal] of csvSupplierMap.entries()) {
          const sName = s.name?.trim().toLowerCase();
          const targetCode = codeVal.toLowerCase();
          if (sName === targetCode || s.id === codeVal) {
            if (s.id !== codeVal) {
              dummyToRealSupplierIdMap.set(s.id, codeVal);
              suppliersToDelete.add(s.id);
            }
          }
        }
      });

      let created = 0;
      let updated = 0;
      let productsLinked = 0;

      const supplierEntries = Array.from(csvSupplierMap.entries());
      const totalSteps = supplierEntries.length + allProducts.length;
      let stepCounter = 0;

      // 2. Process Suppliers
      for (const [codeVal, nameVal] of supplierEntries) {
        stepCounter++;
        const supplierExists = existingSuppliersById.has(codeVal);

        if (supplierExists) {
          await api.createSupplier({ id: codeVal, name: nameVal });
          updated++;
        } else {
          await api.createSupplier({ id: codeVal, name: nameVal });
          created++;
        }
        setImportProgress(Math.min(100, Math.round((stepCounter / totalSteps) * 100)));
      }

      // 3. Scan products and link them
      for (const prod of allProducts) {
        stepCounter++;
        let needsUpdate = false;
        const updatePayload: any = {};

        if (prod.supplierId && csvSupplierMap.has(prod.supplierId)) {
          needsUpdate = true;
          updatePayload.supplierId = prod.supplierId;
          const realName = csvSupplierMap.get(prod.supplierId)!;
          if (prod.supplier !== realName) {
            updatePayload.supplier = realName;
          }
        }

        if (prod.supplierId && dummyToRealSupplierIdMap.has(prod.supplierId)) {
          needsUpdate = true;
          const realCode = dummyToRealSupplierIdMap.get(prod.supplierId)!;
          const realName = csvSupplierMap.get(realCode)!;
          updatePayload.supplierId = realCode;
          updatePayload.supplier = realName;
        }

        if (prod.supplier && csvSupplierMap.has(prod.supplier)) {
          needsUpdate = true;
          const realCode = prod.supplier;
          const realName = csvSupplierMap.get(realCode)!;
          updatePayload.supplierId = realCode;
          updatePayload.supplier = realName;
        }

        if (needsUpdate) {
          await api.updateProduct(prod.id, updatePayload);
          productsLinked++;
        }
        setImportProgress(Math.min(100, Math.round((stepCounter / totalSteps) * 100)));
      }

      setImportProgress(100);

      setImportStats({
        suppliersCreated: created,
        suppliersUpdated: updated,
        productsLinked: productsLinked,
        total: csvRows.length
      });
      setStep(4);
    } catch (err) {
      console.error('Supplier Import Failed:', err);
      alert('There was an error importing the supplier CSV. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div id="supplier-csv-import-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[92vh] flex flex-col motion-preset-fade">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-indigo-600" />
              Supplier CSV Importer & Linker
            </h2>
            <p className="text-sm text-slate-500 mt-1">Map legacy system codes directly to supplier names</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isImporting} className="rounded-full p-2 h-9 w-9">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Wizard Progress Stepper */}
        <div className="bg-slate-50/50 border-b border-slate-100 px-6 py-3 flex items-center gap-6 text-xs font-semibold text-slate-400">
          <div className={`flex items-center gap-1.5 ${step === 1 ? 'text-indigo-600' : 'text-slate-500'}`}>
            <span className="h-5 w-5 rounded-full flex items-center justify-center border border-slate-300">1</span>
            Upload CSV
          </div>
          <ChevronRight className="h-3 w-3" />
          <div className={`flex items-center gap-1.5 ${step === 2 ? 'text-indigo-600' : 'text-slate-500'}`}>
            <span className="h-5 w-5 rounded-full flex items-center justify-center border border-slate-300">2</span>
            Map Fields
          </div>
          <ChevronRight className="h-3 w-3" />
          <div className={`flex items-center gap-1.5 ${step === 3 ? 'text-indigo-600' : 'text-slate-500'}`}>
            <span className="h-5 w-5 rounded-full flex items-center justify-center border border-slate-300">3</span>
            Review Links
          </div>
          <ChevronRight className="h-3 w-3" />
          <div className={`flex items-center gap-1.5 ${step === 4 ? 'text-indigo-600' : 'text-slate-500'}`}>
            <span className="h-5 w-5 rounded-full flex items-center justify-center border border-slate-300">4</span>
            Done
          </div>
        </div>

        {/* Content Section */}
        <div className="p-6 overflow-y-auto flex-1 min-h-[250px]">
          
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
                <h3 className="text-base font-semibold text-slate-800">Drag and drop your Supplier CSV file</h3>
                <p className="text-sm text-slate-500 mt-1">or click to browse your computer (.csv)</p>
              </div>

              <div className="bg-indigo-50/40 border border-indigo-100 rounded-lg p-4 flex gap-3">
                <Info className="h-5 w-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-slate-600 space-y-1">
                  <h4 className="font-bold text-slate-800">How does this auto-replacement work?</h4>
                  <p>When you map the <b>Supplier Name</b> (e.g. <i>Gates</i>) and <b>Supplier Code</b> (e.g. <i>69e702b34e87fadbd86b1545</i>), this importer saves the supplier name with that exact code as its ID. Any existing product referring to that code will instantly show the correct supplier name!</p>
                  <button 
                    onClick={downloadTemplate} 
                    className="text-indigo-600 hover:text-indigo-700 font-bold text-xs mt-2 underline flex items-center gap-1 cursor-pointer"
                  >
                    <FileText className="h-3 w-3" /> Download Supplier CSV Template
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Field Mapping */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="flex justify-between items-center bg-slate-50 border border-slate-100 rounded-lg px-4 py-2 text-sm">
                <span className="font-medium text-slate-700 truncate">{fileName} ({csvRows.length} rows)</span>
                <Button variant="outline" size="sm" onClick={() => setStep(1)} className="text-xs h-7">Change</Button>
              </div>

              <div className="space-y-4">
                {/* Map Supplier Name */}
                <div className="p-4 rounded-lg border border-slate-150 bg-white">
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      Supplier Name <span className="text-red-500 text-xs">*Required</span>
                    </label>
                    <select 
                      value={columnMapping['name'] !== undefined ? columnMapping['name'].toString() : 'ignore'} 
                      onChange={(e) => handleMappingChange('name', e.target.value)}
                      className="h-8 text-xs rounded-md border border-slate-200 px-2 py-1 bg-white focus:outline-none"
                    >
                      <option value="ignore">-- Select Column --</option>
                      {headers.map((hdr, idx) => (
                        <option key={idx} value={idx}>{idx + 1}. {hdr}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-slate-500">The clear textual name of the supplier (e.g. "Gates", "Apex Solutions").</p>
                </div>

                {/* Map Supplier Code */}
                <div className="p-4 rounded-lg border border-slate-150 bg-white">
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      Supplier Code / ID <span className="text-red-500 text-xs">*Required</span>
                    </label>
                    <select 
                      value={columnMapping['code'] !== undefined ? columnMapping['code'].toString() : 'ignore'} 
                      onChange={(e) => handleMappingChange('code', e.target.value)}
                      className="h-8 text-xs rounded-md border border-slate-200 px-2 py-1 bg-white focus:outline-none"
                    >
                      <option value="ignore">-- Select Column --</option>
                      {headers.map((hdr, idx) => (
                        <option key={idx} value={idx}>{idx + 1}. {hdr}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-slate-500">The code or MongoDB/Firestore ID previously used in your files (e.g. "69e702b34e87fadbd86b1545").</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Preview and Links */}
          {step === 3 && !isImporting && (
            <div className="space-y-4">
              <div className="bg-indigo-50/30 border border-indigo-100 rounded-xl p-4 flex gap-3 text-sm text-indigo-900">
                <Database className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Ready to Link Database Records!</span>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    We will process <b>{csvRows.length} supplier rows</b>. Every supplier document will be created using its code as the Firestore Document ID. We will scan all existing inventory products, and any product using these codes will be updated instantly to display the correct supplier name.
                  </p>
                </div>
              </div>

              {/* Mini visual mapping table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600 border-b border-slate-200">
                  Sample Mapping from CSV
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100/50 border-b border-slate-200 font-semibold text-slate-700">
                        <th className="p-2">Legacy Code (ID)</th>
                        <th className="p-2">Correct Supplier Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.slice(0, 4).map((row, rIdx) => (
                        <tr key={rIdx} className="border-b border-slate-100 last:border-b-0 text-slate-600 font-mono">
                          <td className="p-2 text-red-600 font-medium">{row[columnMapping['code']]}</td>
                          <td className="p-2 text-slate-800 font-bold font-sans">{row[columnMapping['name']]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3.5: Progress Bar */}
          {isImporting && (
            <div className="py-10 flex flex-col items-center justify-center space-y-5">
              <Loader2 className="h-9 w-9 text-indigo-600 animate-spin" />
              <div className="text-center space-y-1">
                <h4 className="text-sm font-bold text-slate-800">Processing Supplier Mapping & Product Relationships...</h4>
                <p className="text-xs text-slate-400">Rewriting references in Firestore...</p>
              </div>
              <div className="w-full max-w-sm bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${importProgress}%` }} />
              </div>
              <span className="text-xs font-mono text-slate-400 font-bold">{importProgress}% Complete</span>
            </div>
          )}

          {/* STEP 4: Success Report */}
          {step === 4 && (
            <div className="py-6 flex flex-col items-center justify-center space-y-5 text-center">
              <div className="h-12 w-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 border border-emerald-200 shadow-sm">
                <Check className="h-6 w-6" />
              </div>
              
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-800">Suppliers Re-mapped & Synchronized!</h3>
                <p className="text-sm text-slate-500">The codes have been successfully translated to official supplier records.</p>
              </div>

              <div className="border border-slate-150 rounded-xl bg-slate-50/50 p-5 grid grid-cols-3 gap-4 max-w-md w-full text-left">
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">Suppliers Created</p>
                  <p className="text-xl font-bold text-emerald-600 mt-1">+{importStats.suppliersCreated}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">Suppliers Updated</p>
                  <p className="text-xl font-bold text-indigo-600 mt-1">+{importStats.suppliersUpdated}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">Products Linked</p>
                  <p className="text-xl font-bold text-slate-700 mt-1">+{importStats.productsLinked}</p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
          {step === 1 && (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button disabled>Continue</Button>
            </>
          )}

          {step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={proceedToPreview}>Preview Links</Button>
            </>
          )}

          {step === 3 && !isImporting && (
            <>
              <Button variant="outline" onClick={() => setStep(2)}>Adjust Map</Button>
              <Button onClick={executeImport} className="bg-emerald-600 hover:bg-emerald-700">
                Execute Replacement
              </Button>
            </>
          )}

          {step === 4 && (
            <Button onClick={onImportComplete} className="bg-slate-950 hover:bg-slate-800">
              Finish & Reload
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}
