import printJS from 'print-js';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ProductionSheetData {
  numero: string;
  dateProduction: string;
  responsable: string;
  agency: string;
  createdBy: string;
  materialsUsed: Array<{
    materialName?: string;
    quantity: number;
    unitPrice: number;
    unit?: string; // Ajout de l'unité pour la gestion des conversions
  }>;
  productsProduced: Array<{
    productName?: string;
    quantity: number;
    unitPrice: number;
    weightPerUnit: number;
  }>;
  totals: {
    materialsTotalWeight: number;
    materialsTotalCost: number;
    productionTotalQuantity: number;
    productionTotalWeight: number;
    productionTotalAmount: number;
    profitabilityRate: number;
    weightDifference: number;
  };
  company?: string;
}

export const generateProductionSheetHTML = (data: ProductionSheetData) => {
  const date = format(new Date(data.dateProduction), 'dd MMMM yyyy', { locale: fr });

  // Fonction pour obtenir l'unité d'affichage
  const getDisplayUnit = (material: any): string => {
    return material.unit === 'g' ? 'g' : 'kg';
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Fiche de Production - ${data.numero}</title>
      <style>
        @page {
          size: landscape;
          margin: 1cm;
        }
        body {
          font-family: 'Arial', sans-serif;
          margin: 0;
          padding: 0;
          color: #333;
        }
        .container {
          max-width: 100%;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          text-align: center;
          margin-bottom: 20px;
        }
        .header h1 {
          margin: 0;
          color: #8B4513;
          font-size: 24px;
        }
        .header p {
          margin: 5px 0;
        }
        .info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .info-item {
          flex: 1;
        }
        .info-item h3 {
          margin: 0 0 5px 0;
          font-size: 14px;
        }
        .info-item p {
          margin: 0;
          font-size: 14px;
        }
        .columns {
          display: flex;
          gap: 20px;
        }
        .column {
          flex: 1;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 12px;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        th {
          background-color: #f3f4f6;
          font-weight: bold;
        }
        .text-right {
          text-align: right;
        }
        .summary {
          background-color: #f9fafb;
          padding: 15px;
          border-radius: 8px;
          margin-top: 20px;
          font-size: 12px;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 10px;
        }
        .summary-item {
          display: flex;
          flex-direction: column;
        }
        .summary-label {
          color: #4b5563;
          font-size: 11px;
        }
        .summary-value {
          font-weight: bold;
          font-size: 12px;
        }
        .green {
          color: #059669;
        }
        .red {
          color: #dc2626;
        }
        h2 {
          color: #8B4513;
          font-size: 16px;
          margin-top: 0;
          margin-bottom: 10px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>FICHE DE PRODUCTION</h1>
          <p>${data.company || 'EGREC BOULANGERIE'}</p>
          <p>N° ${data.numero} - Agence: ${data.agency}</p>
          <p>Date: ${date} - Responsable: ${data.responsable}</p>
        </div>

        <div class="columns">
          <div class="column">
            <h2>Matières Premières Utilisées</h2>
            <table>
              <thead>
                <tr>
                  <th>Désignation</th>
                  <th class="text-right">Quantité</th>
                  <th class="text-right">Prix Unit.</th>
                  <th class="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${data.materialsUsed.map(material => `
                  <tr>
                    <td>${material.materialName || ''}</td>
                    <td class="text-right">${material.quantity.toFixed(2)} ${getDisplayUnit(material)}</td>
                    <td class="text-right">${material.unitPrice.toFixed(2)} Fcfa/${getDisplayUnit(material)}</td>
                    <td class="text-right">${(material.quantity * material.unitPrice).toFixed(2)} Fcfa</td>
                  </tr>
                `).join('')}
                <tr>
                  <td><strong>Total</strong></td>
                  <td class="text-right"><strong>${data.totals.materialsTotalWeight.toFixed(2)} kg</strong></td>
                  <td class="text-right"></td>
                  <td class="text-right"><strong>${data.totals.materialsTotalCost.toFixed(2)} Fcfa</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="column">
            <h2>Produits Fabriqués</h2>
            <table>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th class="text-right">Quantité</th>
                  <th class="text-right">Poids Unit.</th>
                  <th class="text-right">Prix Unit.</th>
                  <th class="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${data.productsProduced.map(product => `
                  <tr>
                    <td>${product.productName || ''}</td>
                    <td class="text-right">${product.quantity}</td>
                    <td class="text-right">${product.weightPerUnit.toFixed(2)} kg</td>
                    <td class="text-right">${product.unitPrice.toFixed(2)} Fcfa</td>
                    <td class="text-right">${(product.quantity * product.unitPrice).toFixed(2)} Fcfa</td>
                  </tr>
                `).join('')}
                <tr>
                  <td><strong>Total</strong></td>
                  <td class="text-right"><strong>${data.totals.productionTotalQuantity}</strong></td>
                  <td class="text-right"><strong>${data.totals.productionTotalWeight.toFixed(2)} kg</strong></td>
                  <td class="text-right"></td>
                  <td class="text-right"><strong>${data.totals.productionTotalAmount.toFixed(2)} Fcfa</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="summary">
          <div class="summary-grid">
            <div class="summary-item">
              <span class="summary-label">Poids matières</span>
              <span class="summary-value">${data.totals.materialsTotalWeight.toFixed(2)} kg</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Poids production</span>
              <span class="summary-value">${data.totals.productionTotalWeight.toFixed(2)} kg</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Différence</span>
              <span class="summary-value ${data.totals.weightDifference > 0 ? 'green' : data.totals.weightDifference < 0 ? 'red' : ''}">
                ${data.totals.weightDifference > 0 ? '+' : ''}${data.totals.weightDifference.toFixed(2)} kg
              </span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Coût matières</span>
              <span class="summary-value">${data.totals.materialsTotalCost.toFixed(2)} Fcfa</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Valeur production</span>
              <span class="summary-value">${data.totals.productionTotalAmount.toFixed(2)} Fcfa</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Rentabilité</span>
              <span class="summary-value ${data.totals.profitabilityRate > 30 ? 'green' : 'red'}">
                ${data.totals.profitabilityRate.toFixed(2)}%
              </span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Rendement</span>
              <span class="summary-value">
                ${((data.totals.productionTotalWeight / data.totals.materialsTotalWeight) * 100).toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const printProductionSheet = async (data: ProductionSheetData) => {
  try {
    const sheetHTML = generateProductionSheetHTML(data);
    
    // Create a temporary iframe to handle printing
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    
    document.body.appendChild(printFrame);
    
    const frameDoc = printFrame.contentWindow?.document;
    if (!frameDoc) {
      throw new Error('Failed to access iframe document');
    }
    
    // Write the HTML content to the iframe
    frameDoc.open();
    frameDoc.write(sheetHTML);
    frameDoc.close();
    
    // Wait for images and resources to load
    setTimeout(() => {
      try {
        // Print the iframe content
        printFrame.contentWindow?.print();
        
        // Remove the iframe after printing (or after a timeout)
        setTimeout(() => {
          document.body.removeChild(printFrame);
        }, 1000);
      } catch (error) {
        console.error('Print error:', error);
        document.body.removeChild(printFrame);
        throw error;
      }
    }, 500);
    
    return true;
  } catch (error) {
    console.error('Error in printProductionSheet:', error);
    throw error;
  }
};