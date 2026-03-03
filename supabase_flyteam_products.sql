-- SQL Migration for Flyteam Scraper Module

-- Create the products table
CREATE TABLE IF NOT EXISTS public.flyteam_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT UNIQUE NOT NULL,
    category TEXT,
    sku TEXT,
    name TEXT NOT NULL,
    price NUMERIC,
    availability TEXT,
    image_url TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add updated_at trigger for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_flyteam_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_flyteam_products_updated_at ON public.flyteam_products;

CREATE TRIGGER trg_flyteam_products_updated_at
BEFORE UPDATE ON public.flyteam_products
FOR EACH ROW
EXECUTE FUNCTION update_flyteam_products_updated_at();

-- Add RLS policies (optional, but good practice. Allows anon to read, service role to do everything)
ALTER TABLE public.flyteam_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to flyteam_products"
ON public.flyteam_products FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow service role full access to flyteam_products"
ON public.flyteam_products FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
