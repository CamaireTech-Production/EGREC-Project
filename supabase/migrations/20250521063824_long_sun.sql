/*
  # Add User Profile Fields

  1. Changes
    - Add company field to users table
    - Add agency field to users table
    - Add phone field to users table
    - Add updatedAt field to users table

  2. Security
    - Maintain existing RLS policies
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'company'
  ) THEN
    ALTER TABLE users ADD COLUMN company text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'agency'
  ) THEN
    ALTER TABLE users ADD COLUMN agency text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'phone'
  ) THEN
    ALTER TABLE users ADD COLUMN phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'updatedAt'
  ) THEN
    ALTER TABLE users ADD COLUMN updatedAt timestamptz DEFAULT now();
  END IF;
END $$;