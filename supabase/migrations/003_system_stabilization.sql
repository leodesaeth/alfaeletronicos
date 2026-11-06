-- =============================================================
-- Catálogo Digital Alfa — Migração 003: Estabilização de Estoque,
-- Metadados Financeiros e Movimentações
-- NexaFlow para Alfa Eletrônicos
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ADIÇÃO DE COLUNAS DE CONTROLE EM public.products
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'stock_quantity') THEN
    ALTER TABLE public.products ADD COLUMN stock_quantity INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'low_stock_threshold') THEN
    ALTER TABLE public.products ADD COLUMN low_stock_threshold INTEGER DEFAULT 2;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'cost_price') THEN
    ALTER TABLE public.products ADD COLUMN cost_price NUMERIC(10,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'compare_at_price') THEN
    ALTER TABLE public.products ADD COLUMN compare_at_price NUMERIC(10,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'supplier') THEN
    ALTER TABLE public.products ADD COLUMN supplier TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'whatsapp_clicks') THEN
    ALTER TABLE public.products ADD COLUMN whatsapp_clicks INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'last_clicked_at') THEN
    ALTER TABLE public.products ADD COLUMN last_clicked_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'variations') THEN
    ALTER TABLE public.products ADD COLUMN variations JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 2. ADIÇÃO DE COLUNAS EM public.store_settings
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'whatsapp_message_template') THEN
    ALTER TABLE public.store_settings ADD COLUMN whatsapp_message_template TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'hero_image_url') THEN
    ALTER TABLE public.store_settings ADD COLUMN hero_image_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'financial_config') THEN
    ALTER TABLE public.store_settings ADD COLUMN financial_config JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- 3. TABELA: stock_movements (Movimentações de Estoque & Vendas)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id      UUID        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name    TEXT        NOT NULL,
  type            TEXT        NOT NULL CHECK (type IN ('in', 'out', 'adjustment')),
  reason          TEXT        NOT NULL DEFAULT 'sale',
  payment_method  TEXT,
  quantity        INTEGER     NOT NULL,
  previous_stock  INTEGER     NOT NULL DEFAULT 0,
  new_stock       INTEGER     NOT NULL DEFAULT 0,
  unit_price      NUMERIC(10,2) DEFAULT 0,
  unit_cost       NUMERIC(10,2) DEFAULT 0,
  total_value     NUMERIC(10,2) DEFAULT 0,
  profit_value    NUMERIC(10,2) DEFAULT 0,
  supplier        TEXT,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON public.stock_movements(type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON public.stock_movements(created_at DESC);

-- 4. TABELA: store_expenses (Despesas e DRE da Loja)
CREATE TABLE IF NOT EXISTS public.store_expenses (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  description   TEXT        NOT NULL,
  category      TEXT        NOT NULL DEFAULT 'fixa',
  amount        NUMERIC(10,2) NOT NULL,
  date          DATE        NOT NULL DEFAULT CURRENT_DATE,
  due_date      DATE,
  status        TEXT        NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'pending')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_expenses_date ON public.store_expenses(date DESC);

-- 5. TABELA: customer_receivables (Controle de Fiados e A Receber)
CREATE TABLE IF NOT EXISTS public.customer_receivables (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_name   TEXT        NOT NULL,
  customer_phone  TEXT,
  description     TEXT,
  amount          NUMERIC(10,2) NOT NULL,
  due_date        DATE        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_customer_receivables_status ON public.customer_receivables(status);

-- 6. TABELA: extra_incomes (Receitas Extras / Serviços)
CREATE TABLE IF NOT EXISTS public.extra_incomes (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  description     TEXT        NOT NULL,
  category        TEXT        NOT NULL DEFAULT 'service',
  amount          NUMERIC(10,2) NOT NULL,
  cost_amount     NUMERIC(10,2) DEFAULT 0,
  payment_method  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. BUCKETS DE STORAGE (Garante existência e acesso público aos assets)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('product-images', 'product-images', true),
  ('store-assets', 'store-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 8. POLÍTICAS DE STORAGE (Liberar upload, visualização e deleção de fotos para anon e authenticated)
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view store assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload store assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update store assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete store assets" ON storage.objects;
DROP POLICY IF EXISTS "allow_all_storage_objects" ON storage.objects;

CREATE POLICY "allow_all_storage_objects" ON storage.objects
  FOR ALL TO anon, authenticated
  USING (bucket_id IN ('product-images', 'store-assets'))
  WITH CHECK (bucket_id IN ('product-images', 'store-assets'));

-- 9. HABILITAR RLS E LIBERAR OPERAÇÕES NAS TABELAS (Enquanto autenticação estiver em fase de transição)
ALTER TABLE public.categories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_expenses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_receivables  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extra_incomes        ENABLE ROW LEVEL SECURITY;

-- Limpeza de políticas restritivas anteriores
DROP POLICY IF EXISTS "admin_all_categories" ON public.categories;
DROP POLICY IF EXISTS "public_read_active_categories" ON public.categories;
DROP POLICY IF EXISTS "allow_all_categories" ON public.categories;
CREATE POLICY "allow_all_categories" ON public.categories FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_write_products" ON public.products;
DROP POLICY IF EXISTS "admin_update_products" ON public.products;
DROP POLICY IF EXISTS "admin_delete_products" ON public.products;
DROP POLICY IF EXISTS "admin_read_all_products" ON public.products;
DROP POLICY IF EXISTS "public_read_published_products" ON public.products;
DROP POLICY IF EXISTS "allow_all_products" ON public.products;
CREATE POLICY "allow_all_products" ON public.products FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_write_product_images" ON public.product_images;
DROP POLICY IF EXISTS "admin_delete_product_images" ON public.product_images;
DROP POLICY IF EXISTS "admin_read_all_product_images" ON public.product_images;
DROP POLICY IF EXISTS "public_read_product_images" ON public.product_images;
DROP POLICY IF EXISTS "allow_all_product_images" ON public.product_images;
CREATE POLICY "allow_all_product_images" ON public.product_images FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_store_settings" ON public.store_settings;
CREATE POLICY "allow_all_store_settings" ON public.store_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_stock_movements" ON public.stock_movements;
CREATE POLICY "allow_all_stock_movements" ON public.stock_movements FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_store_expenses" ON public.store_expenses;
CREATE POLICY "allow_all_store_expenses" ON public.store_expenses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_customer_receivables" ON public.customer_receivables;
CREATE POLICY "allow_all_customer_receivables" ON public.customer_receivables FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_extra_incomes" ON public.extra_incomes;
CREATE POLICY "allow_all_extra_incomes" ON public.extra_incomes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

