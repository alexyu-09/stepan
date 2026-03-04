-- Add export_status column to flyteam_products table
ALTER TABLE public.flyteam_products 
ADD COLUMN IF NOT EXISTS export_status TEXT DEFAULT 'Выгружать';

-- Add comment to the column for clarity
COMMENT ON COLUMN public.flyteam_products.export_status IS 'Status for exporting to external systems (Выгружать or Не выгружать)';
