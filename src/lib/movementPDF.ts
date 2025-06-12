import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface MovementData {
  id: string;
  movementType: 'factory_supply' | 'incoming_transfer' | 'outgoing_transfer';
  department: 'Boulangerie' | 'Boutique';
  referenceNumber: string;
  date: Date;
  operatorName: string;
  vehicleRegistration: string;
  supplyCode?: string;
  sourceAgency?: string;
  destinationAgency?: string;
  comments: string;
  products: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
  }>;
  totalQuantity: number;
  status: string;
  createdByName: string;
  company: string;
  agency: string;
  createdAt: Date;
}

export const generateMovementPDF = async (movement: MovementData) => {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('BON DE LIVRAISON / TRANSFERT', 105, 20, { align: 'center' });
  
  // Company info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(movement.company, 20, 35);
  
  // Movement type and department
  const movementTypeLabel = getMovementTypeLabel(movement.movementType);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`${movementTypeLabel} - DÉPARTEMENT ${movement.department.toUpperCase()}`, 20, 50);
  
  // Reference and date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Référence: ${movement.referenceNumber}`, 20, 60);
  doc.text(`Date: ${format(movement.date, 'dd/MM/yyyy HH:mm', { locale: fr })}`, 120, 60);
  
  // Movement details
  let yPos = 75;
  
  // Origin and destination
  const origin = getOrigin(movement);
  const destination = getDestination(movement);
  
  doc.setFont('helvetica', 'bold');
  doc.text('EXPÉDITEUR:', 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(origin, 50, yPos);
  
  yPos += 10;
  doc.setFont('helvetica', 'bold');
  doc.text('DESTINATAIRE:', 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(destination, 50, yPos);
  
  yPos += 15;
  
  // Transport details
  doc.setFont('helvetica', 'bold');
  doc.text('DÉTAILS DU TRANSPORT', 20, yPos);
  yPos += 10;
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Opérateur: ${movement.operatorName}`, 20, yPos);
  doc.text(`Véhicule: ${movement.vehicleRegistration}`, 120, yPos);
  yPos += 10;
  
  if (movement.supplyCode) {
    doc.text(`Code d'approvisionnement: ${movement.supplyCode}`, 20, yPos);
    yPos += 10;
  }
  
  yPos += 10;
  
  // Products table
  const tableData = movement.products.map(product => [
    product.productName,
    product.quantity.toString(),
    product.unit
  ]);
  
  // Add total row
  tableData.push([
    'TOTAL',
    movement.totalQuantity.toString(),
    '-'
  ]);
  
  (doc as any).autoTable({
    startY: yPos,
    head: [['Produit', 'Quantité', 'Unité']],
    body: tableData,
    styles: {
      fontSize: 10,
      cellPadding: 5
    },
    headStyles: {
      fillColor: [139, 69, 19],
      textColor: 255,
      fontStyle: 'bold'
    },
    footStyles: {
      fillColor: [240, 240, 240],
      textColor: 0,
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 40, halign: 'right' },
      2: { cellWidth: 30, halign: 'center' }
    }
  });
  
  // Comments
  if (movement.comments) {
    const finalY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFont('helvetica', 'bold');
    doc.text('COMMENTAIRES:', 20, finalY);
    doc.setFont('helvetica', 'normal');
    
    // Split long comments into multiple lines
    const splitComments = doc.splitTextToSize(movement.comments, 170);
    doc.text(splitComments, 20, finalY + 10);
  }
  
  // Signatures section
  const pageHeight = doc.internal.pageSize.height;
  const signatureY = pageHeight - 60;
  
  doc.setFont('helvetica', 'bold');
  doc.text('SIGNATURES', 20, signatureY);
  
  // Signature boxes
  doc.setFont('helvetica', 'normal');
  doc.text('Expéditeur:', 20, signatureY + 15);
  doc.text('Date: _______________', 20, signatureY + 25);
  doc.text('Signature:', 20, signatureY + 35);
  doc.rect(60, signatureY + 30, 60, 15); // Signature box
  
  doc.text('Destinataire:', 130, signatureY + 15);
  doc.text('Date: _______________', 130, signatureY + 25);
  doc.text('Signature:', 130, signatureY + 35);
  doc.rect(170, signatureY + 30, 60, 15); // Signature box
  
  // Footer
  doc.setFontSize(8);
  doc.text(`Document généré le ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })}`, 20, pageHeight - 10);
  doc.text(`Par: ${movement.createdByName}`, 120, pageHeight - 10);
  
  // Save the PDF
  const fileName = `mouvement-${movement.referenceNumber}-${format(movement.date, 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
};

const getMovementTypeLabel = (type: string): string => {
  switch (type) {
    case 'factory_supply':
      return 'APPROVISIONNEMENT USINE';
    case 'incoming_transfer':
      return 'TRANSFERT ENTRANT';
    case 'outgoing_transfer':
      return 'TRANSFERT SORTANT';
    default:
      return type.toUpperCase();
  }
};

const getOrigin = (movement: MovementData): string => {
  switch (movement.movementType) {
    case 'factory_supply':
      return 'USINE DE PRODUCTION';
    case 'incoming_transfer':
      return movement.sourceAgency || 'AGENCE SOURCE';
    case 'outgoing_transfer':
      return movement.agency;
    default:
      return 'NON DÉFINI';
  }
};

const getDestination = (movement: MovementData): string => {
  switch (movement.movementType) {
    case 'factory_supply':
    case 'incoming_transfer':
      return movement.agency;
    case 'outgoing_transfer':
      return movement.destinationAgency || 'AGENCE DESTINATION';
    default:
      return 'NON DÉFINI';
  }
};