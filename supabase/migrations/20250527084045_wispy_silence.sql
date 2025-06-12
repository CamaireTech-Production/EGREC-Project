/*
  # Add Agency-Specific Stock Management

  1. Changes
    - Add stockParAgence JSONB field to products table
    - Initialize stockParAgence with current stock value for each agency
    - Update stock management logic to use agency-specific stock

  2. Security
    - Maintain existing RLS policies
*/

-- Add stockParAgence column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'stock_par_agence'
  ) THEN
    ALTER TABLE products ADD COLUMN stock_par_agence JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Function to initialize agency stock
CREATE OR REPLACE FUNCTION initialize_agency_stock()
RETURNS void AS $$
DECLARE
  product_record RECORD;
  agency_record RECORD;
  stock_data JSONB;
BEGIN
  -- For each product
  FOR product_record IN SELECT id, stock FROM products LOOP
    stock_data := '{}'::jsonb;
    
    -- For each agency in the product's company
    FOR agency_record IN 
      SELECT DISTINCT agency_name 
      FROM users 
      WHERE company = (SELECT company FROM products WHERE id = product_record.id)
    LOOP
      -- Set initial stock for agency
      stock_data := stock_data || jsonb_build_object(agency_record.agency_name, product_record.stock);
    END LOOP;
    
    -- Update product with agency stock data
    UPDATE products 
    SET stock_par_agence = stock_data 
    WHERE id = product_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the initialization
SELECT initialize_agency_stock();