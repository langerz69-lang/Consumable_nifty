import React, { useState } from 'react';
import { OrderPdfData, generateAndDownloadOrderPdf, getOrderEmailMailtoUrl } from '../utils/orderEmailPdf';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { X, Mail, Download, Check, Copy, FileText, Send, AlertCircle } from 'lucide-react';

interface OrderEmailPdfModalProps {
  data: OrderPdfData;
  onClose: () => void;
}

export default function OrderEmailPdfModal({ data, onClose }: OrderEmailPdfModalProps) {
  const [recipientEmail, setRecipientEmail] = useState(data.recipientEmail || '');
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const [copied, setCopied] = useState(false);

  const updatedData: OrderPdfData = {
    ...data,
    recipientEmail: recipientEmail.trim()
  };

  const mailtoUrl = getOrderEmailMailtoUrl(updatedData);

  const handleDownloadPdf = () => {
    generateAndDownloadOrderPdf(updatedData);
    setPdfDownloaded(true);
  };

  const handleCopyBody = () => {
    const shortId = data.orderId.slice(0, 8);
    const itemsText = data.items
      .map((item, i) => `${i + 1}. ${item.name} | C-Number: ${item.cNumber || 'N/A'} | Qty: ${item.quantity} | Price: £${((item.unitCost || 0) * item.quantity).toFixed(2)}`)
      .join('\n');

    const copyText = `SUBJECT: [Order Request] Consumables Order - ${data.areaName} (#${shortId})

RECIPIENT: ${recipientEmail || 'spares@shenley.co.uk'}

BODY:
Hello,

An automated consumables order request has been generated for ${data.areaName}.

ORDER DETAILS:
- Production Area: ${data.areaName}
- Order Reference: #${shortId}
- Placed By: ${data.userName || 'Production Worker'}
- Date & Time: ${data.createdAt ? new Date(data.createdAt).toLocaleString() : new Date().toLocaleString()}

ORDER ITEMS:
${itemsText}

TOTAL ORDER VALUE: £${data.totalCost.toFixed(2)}

(Note: Please find attached official PDF Order Document.)`;

    navigator.clipboard.writeText(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 text-white rounded-lg">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Email Order &amp; PDF Dispatch</h3>
              <p className="text-xs text-slate-300">Order #{data.orderId.slice(0, 8)} • {data.areaName}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-800">
          
          {/* Target Email Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
              Recipient Email Address
            </label>
            <Input 
              type="email" 
              value={recipientEmail} 
              onChange={e => setRecipientEmail(e.target.value)} 
              placeholder="e.g. spares@shenley.co.uk" 
              className="text-xs font-mono bg-slate-50 border-slate-300"
            />
            <p className="text-[11px] text-slate-500">
              The order document and pre-filled email draft will be addressed to this recipient.
            </p>
          </div>

          {/* Action Step 1: Download PDF */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-md font-bold text-xs ${pdfDownloaded ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                  Step 1
                </div>
                <span className="font-bold text-xs text-slate-900">Download Official PDF Order Document</span>
              </div>
              <Button 
                size="sm" 
                onClick={handleDownloadPdf}
                className={`text-xs font-bold gap-1.5 h-8 ${pdfDownloaded ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}
              >
                {pdfDownloaded ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                {pdfDownloaded ? 'PDF Downloaded' : 'Download Order PDF'}
              </Button>
            </div>
            <p className="text-[11px] text-slate-500">
              Generates a formatted PDF containing item descriptions, C-Numbers, unit prices, and total value (£{data.totalCost.toFixed(2)}).
            </p>
          </div>

          {/* Action Step 2: Open Email Client Draft */}
          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-200 text-blue-900 rounded-md font-bold text-xs">
                  Step 2
                </div>
                <span className="font-bold text-xs text-blue-950">Open Pre-Filled Email Draft</span>
              </div>
              <a 
                href={mailtoUrl}
                target="_top"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all"
              >
                <Send className="h-3.5 w-3.5" />
                Open Email Client
              </a>
            </div>
            <p className="text-[11px] text-blue-800">
              Launches your default email app (Outlook, Apple Mail, Thunderbird, etc.) with <strong>{recipientEmail || 'recipient'}</strong>, subject line, and structured body text pre-filled.
            </p>
          </div>

          {/* Fail-safe: Copy Email Text */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Using Webmail (Gmail/Outlook Web)?</span>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleCopyBody}
              className="gap-1.5 text-xs h-7 border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
              {copied ? 'Email Details Copied!' : 'Copy Email Text'}
            </Button>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <Button size="sm" variant="outline" onClick={onClose} className="text-xs font-semibold">
            Done
          </Button>
        </div>

      </div>
    </div>
  );
}
