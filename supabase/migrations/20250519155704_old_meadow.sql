/*
  # Sales Management System Schema

  1. New Tables
    - sales
      - Stores all sales transactions with comprehensive metadata
      - Includes customer information, line items, payment details
      - Tracks fulfillment status and store/employee data
    
  2. Security
    - Enable RLS on sales table
    - Add policies for authenticated users
    
  3. Indexes
    - Created indexes for common query patterns
    - Added composite indexes for performance optimization
*/

-- Create sales table
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by_uid text NOT NULL,
  created_by_name text NOT NULL,
  
  -- Customer information
  customer_id text NOT NULL,
  customer_name text,
  customer_email text,
  customer_phone text,
  
  -- Payment details
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'credit', 'debit')),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed')),
  payment_transaction_id text,
  paid_amount numeric CHECK (paid_amount >= 0),
  
  -- Summary
  subtotal numeric NOT NULL CHECK (subtotal >= 0),
  tax_rate numeric NOT NULL DEFAULT 0.1 CHECK (tax_rate >= 0),
  tax_amount numeric NOT NULL CHECK (tax_amount >= 0),
  discount_type text CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric CHECK (discount_value >= 0),
  discount_amount numeric CHECK (discount_amount >= 0),
  total numeric NOT NULL CHECK (total >= 0),
  
  -- Fulfillment
  fulfillment_status text NOT NULL DEFAULT 'pending' 
    CHECK (fulfillment_status IN ('pending', 'processing', 'completed', 'cancelled')),
  store_id text NOT NULL,
  store_name text NOT NULL,
  sales_person_id text NOT NULL,
  sales_person_name text NOT NULL,
  
  CONSTRAINT fk_created_by FOREIGN KEY (created_by_uid) REFERENCES auth.users(id),
  CONSTRAINT fk_store FOREIGN KEY (store_id) REFERENCES stores(id),
  CONSTRAINT fk_sales_person FOREIGN KEY (sales_person_id) REFERENCES auth.users(id)
);

-- Create sales items table for line items
CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  subtotal numeric NOT NULL CHECK (subtotal >= 0),
  
  CONSTRAINT fk_product FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON sales(payment_status);
CREATE INDEX IF NOT EXISTS idx_sales_fulfillment_status ON sales(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_sales_store_id ON sales(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_sales_person_id ON sales(sales_person_id);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sales_store_date ON sales(store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sales_person_date ON sales(sales_person_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sales_status_date ON sales(fulfillment_status, created_at);

-- Enable RLS
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view sales they created"
  ON sales
  FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by_uid);

CREATE POLICY "Users can insert their own sales"
  ON sales
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by_uid);

CREATE POLICY "Users can update their own sales"
  ON sales
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by_uid);

-- Policies for sale items
CREATE POLICY "Users can view their sale items"
  ON sale_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales
      WHERE sales.id = sale_items.sale_id
      AND sales.created_by_uid = auth.uid()
    )
  );

CREATE POLICY "Users can insert items to their sales"
  ON sale_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales
      WHERE sales.id = sale_items.sale_id
      AND sales.created_by_uid = auth.uid()
    )
  );

-- Create function to update sales updated_at timestamp
CREATE OR REPLACE FUNCTION update_sales_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_sales_updated_at
  BEFORE UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_updated_at();