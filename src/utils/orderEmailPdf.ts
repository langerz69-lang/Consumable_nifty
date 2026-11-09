import { jsPDF } from 'jspdf';
import { OrderItem } from '../types';

export interface OrderPdfData {
  orderId: string;
  areaName: string;
  recipientEmail?: string;
  userName?: string;
  items: OrderItem[];
  totalCost: number;
  totalAdrScore?: number;
  createdAt?: number;
}

export function generateAndDownloadOrderPdf(data: OrderPdfData) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const timestamp = data.createdAt ? new Date(data.createdAt).toLocaleString() : new Date().toLocaleString();
  const shortId = data.orderId.slice(0, 8);

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('CONSUMABLES HUB - ORDER DISPATCH NOTE', 14, 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Official Area Order Request • ${timestamp}`, 14, 25);

  // Meta details card
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(14, 38, 182, 30, 2, 2, 'FD');

  doc.setTextColor(30, 41, 59); // slate-800
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Production Area: ${data.areaName}`, 18, 47);
  doc.text(`Order Reference: #${shortId}`, 18, 54);

  doc.setFont('helvetica', 'normal');
  doc.text(`Notification Email: ${data.recipientEmail || 'N/A'}`, 110, 47);
  doc.text(`Submitted By: ${data.userName || 'Production Worker'}`, 110, 54);
  doc.text(`Date & Time: ${timestamp}`, 18, 61);

  // Table Header
  let startY = 76;
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(14, startY, 182, 8, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('ITEM DESCRIPTION', 18, startY + 5.5);
  doc.text('C-NUMBER', 95, startY + 5.5);
  doc.text('QTY', 135, startY + 5.5);
  doc.text('UNIT PRICE', 152, startY + 5.5);
  doc.text('SUBTOTAL', 178, startY + 5.5);

  // Table Body
  let currentY = startY + 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);

  data.items.forEach((item, index) => {
    // Alternating background
    if (index % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(14, currentY, 182, 8, 'F');
    }

    const itemSubtotal = (item.unitCost || 0) * item.quantity;
    const cNo = item.cNumber || 'N/A';

    doc.text(item.name.substring(0, 42), 18, currentY + 5.5);
    doc.setFont('courier', 'bold');
    doc.text(cNo, 95, currentY + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.text(String(item.quantity), 137, currentY + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`£${(item.unitCost || 0).toFixed(2)}`, 152, currentY + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`£${itemSubtotal.toFixed(2)}`, 178, currentY + 5.5);

    currentY += 8;
  });

  // Table Bottom Border
  doc.setDrawColor(203, 213, 225);
  doc.line(14, currentY, 196, currentY);

  // Total Box
  currentY += 6;
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(126, currentY, 70, 16, 2, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('TOTAL ORDER COST', 132, currentY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`£${data.totalCost.toFixed(2)}`, 132, currentY + 12);

  // Sign-off section
  currentY += 28;
  doc.setDrawColor(203, 213, 225);
  doc.line(18, currentY + 12, 85, currentY + 12);
  doc.line(115, currentY + 12, 182, currentY + 12);

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Production Area Supervisor Signature', 18, currentY + 16);
  doc.text('Logistics Fulfillment Signature', 115, currentY + 16);

  // Save PDF
  const cleanAreaName = data.areaName.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Order_${cleanAreaName}_${shortId}.pdf`;
  doc.save(filename);
  return filename;
}

export function getOrderEmailMailtoUrl(data: OrderPdfData): string {
  const email = data.recipientEmail || '';
  const shortId = data.orderId.slice(0, 8);
  const subject = `[Order Request] Consumables Order - ${data.areaName} (#${shortId})`;

  const itemsText = data.items
    .map((item, i) => `${i + 1}. ${item.name} | C-Number: ${item.cNumber || 'N/A'} | Qty: ${item.quantity} | Price: £${((item.unitCost || 0) * item.quantity).toFixed(2)}`)
    .join('\n');

  const body = `Hello,

An automated consumables order request has been generated for ${data.areaName}.

ORDER DETAILS:
- Production Area: ${data.areaName}
- Order Reference: #${shortId}
- Placed By: ${data.userName || 'Production Worker'}
- Date & Time: ${data.createdAt ? new Date(data.createdAt).toLocaleString() : new Date().toLocaleString()}

ORDER ITEMS:
${itemsText}

TOTAL ORDER VALUE: £${data.totalCost.toFixed(2)}

(Note: Please find attached official PDF Order Document.)

Thank you,
${data.areaName} Production Team`;

  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function openOrderEmailClient(data: OrderPdfData) {
  if (!data.recipientEmail) return;
  const mailtoUrl = getOrderEmailMailtoUrl(data);
  window.location.href = mailtoUrl;
}

export function generatePdfAndOpenEmail(data: OrderPdfData) {
  // 1. Download PDF Document
  const filename = generateAndDownloadOrderPdf(data);
  
  // 2. Open Email Client with pre-filled recipient, subject & body
  if (data.recipientEmail) {
    openOrderEmailClient(data);
  }

  return filename;
}
