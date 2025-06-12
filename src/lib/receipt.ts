import printJS from 'print-js';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CartItem } from '../types';

export const generateReceiptHTML = (
  items: CartItem[],
  total: number,
  subtotal: number,
  tax: number,
  cashReceived: number,
  changeDue: number,
  storeName: string = 'EGREC BOULANGERIE',
  storeLocation: string | null = null
) => {
  const now = new Date();
  const date = format(now, 'dd/MM/yyyy', { locale: fr });
  const time = format(now, 'HH:mm', { locale: fr });

  return `
    <div style="font-family: 'Courier New', monospace; width: 300px; padding: 20px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="margin: 0;">${storeName}</h2>
        ${storeLocation ? `<p style="margin: 5px 0;">${storeLocation}</p>` : ''}
        <p style="margin: 5px 0;">TVA: FR 12 345 678 901</p>
      </div>

      <div style="margin-bottom: 20px;">
        <p style="margin: 5px 0;">Date: ${date}</p>
        <p style="margin: 5px 0;">Heure: ${time}</p>
        <p style="margin: 5px 0;">Ticket #: ${Math.floor(Math.random() * 10000)}</p>
      </div>

      <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 10px 0; margin-bottom: 10px;">
        ${items.map(item => `
          <div style="display: flex; justify-content: space-between; margin: 5px 0;">
            <div>
              ${item.product.name} x${item.quantity}
            </div>
            <div>
              ${Math.round(item.product.price * item.quantity)} Fcfa
            </div>
          </div>
        `).join('')}
      </div>

      <div style="margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; margin: 5px 0;">
          <div>Sous-total HT:</div>
          <div>${Math.round(subtotal / 1.1)} Fcfa</div>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 5px 0;">
          <div>TVA (10%):</div>
          <div>${Math.round(tax)} Fcfa</div>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 5px 0; font-weight: bold;">
          <div>TOTAL TTC:</div>
          <div>${Math.round(total)} Fcfa</div>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 5px 0;">
          <div>Espèces:</div>
          <div>${cashReceived} Fcfa</div>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 5px 0;">
          <div>Monnaie:</div>
          <div>${Math.round(changeDue)} Fcfa</div>
        </div>
      </div>

      <div style="text-align: center; margin-top: 20px;">
        <p style="margin: 5px 0;">Merci de votre visite !</p>
        <p style="margin: 5px 0;">À bientôt !</p>
      </div>
    </div>
  `;
};

export const printReceipt = (
  items: CartItem[],
  total: number,
  subtotal: number,
  tax: number,
  cashReceived: number,
  changeDue: number,
  storeName?: string,
  storeLocation?: string | null
) => {
  const receiptHTML = generateReceiptHTML(
    items,
    total,
    subtotal,
    tax,
    cashReceived,
    changeDue,
    storeName,
    storeLocation
  );

  // Create a temporary container for the receipt
  const container = document.createElement('div');
  container.innerHTML = receiptHTML;
  document.body.appendChild(container);

  // Print the receipt
  printJS({
    printable: container,
    type: 'html',
    documentTitle: 'Ticket de caisse',
    style: `
      @page { 
        size: 80mm 297mm;
        margin: 0;
      }
      @media print {
        body {
          width: 80mm;
        }
      }
    `,
  });

  // Clean up
  document.body.removeChild(container);
};