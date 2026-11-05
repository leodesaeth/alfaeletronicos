-- =============================================================
-- Catálogo Digital Alfa — Migração 001: Schema Inicial
-- NexaFlow para Alfa Eletrônicos
-- =============================================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- TABELA: categories
-- =============================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT        NOT NULL,
  slug          TEXT        NOT NULL UNIQUE,
  description   TEXT,
  image_path    TEXT,
  parent_id     UUID        REFERENCES public.categories(id) ON DELETE SET NULL,
  display_order INTEGER     NOT NULL DEFAULT 0,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_slug     ON public.categories(slug);
CREATE INDEX idx_categories_active   ON public.categories(is_active);
CREATE INDEX idx_categories_order    ON public.categories(display_order);
CREATE INDEX idx_categories_parent   ON public.categories(parent_id);

-- =============================================================
-- TABELA: products
-- =============================================================
CREATE TABLE IF NOT EXISTS public.products (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT        NOT NULL,
  slug              TEXT        NOT NULL UNIQUE,
  short_description TEXT,
  description       TEXT,
  category_id       UUID        REFERENCES public.categories(id) ON DELETE SET NULL,
  price             NUMERIC(10,2),
  show_price        BOOLEAN     NOT NULL DEFAULT true,
  availability      TEXT        NOT NULL DEFAULT 'available'
                    CHECK (availability IN ('available', 'unavailable', 'on_request')),
  is_published      BOOLEAN     NOT NULL DEFAULT false,
  is_featured       BOOLEAN     NOT NULL DEFAULT false,
  display_order     INTEGER     NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_slug        ON public.products(slug);
CREATE INDEX idx_products_published   ON public.products(is_published);
CREATE INDEX idx_products_featured    ON public.products(is_featured);
CREATE INDEX idx_products_category    ON public.products(category_id);
CREATE INDEX idx_products_order       ON public.products(display_order);
CREATE INDEX idx_products_search      ON public.products USING gin(
  to_tsvector('portuguese', COALESCE(name,'') || ' ' || COALESCE(short_description,'') || ' ' || COALESCE(description,''))
);

-- =============================================================
-- TABELA: product_images
-- =============================================================
CREATE TABLE IF NOT EXISTS public.product_images (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id    UUID        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  storage_path  TEXT        NOT NULL,
  display_order INTEGER     NOT NULL DEFAULT 0,
  is_primary    BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_images_product ON public.product_images(product_id);
CREATE INDEX idx_product_images_primary ON public.product_images(product_id, is_primary);

-- =============================================================
-- TABELA: store_settings
-- =============================================================
CREATE TABLE IF NOT EXISTS public.store_settings (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_name          TEXT        NOT NULL DEFAULT 'Alfa Eletrônicos',
  store_description   TEXT        DEFAULT 'Sua loja de eletrônicos e acessórios',
  logo_path           TEXT,
  whatsapp_number     TEXT,
  primary_color       TEXT        DEFAULT '#1769FF',
  hero_title          TEXT        DEFAULT 'Encontre os melhores eletrônicos',
  hero_description    TEXT        DEFAULT 'Explore nosso catálogo completo de produtos com qualidade e confiança.',
  contact_email       TEXT,
  contact_address     TEXT,
  footer_text         TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inserir configuração padrão
INSERT INTO public.store_settings (store_name) VALUES ('Alfa Eletrônicos')
ON CONFLICT DO NOTHING;

-- =============================================================
-- FUNÇÃO: update_updated_at_column
-- =============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_settings_updated_at
  BEFORE UPDATE ON public.store_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================
-- ROW LEVEL SECURITY — Habilitar em todas as tabelas
-- =============================================================
ALTER TABLE public.categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- POLÍTICAS: categories
-- =============================================================
-- Público pode ler apenas categorias ativas
CREATE POLICY "public_read_active_categories"
  ON public.categories FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Admins (authenticated) podem fazer tudo
CREATE POLICY "admin_all_categories"
  ON public.categories FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =============================================================
-- POLÍTICAS: products
-- =============================================================
-- Público pode ler apenas produtos publicados
CREATE POLICY "public_read_published_products"
  ON public.products FOR SELECT
  TO anon
  USING (is_published = true);

-- Admins podem ler todos os produtos
CREATE POLICY "admin_read_all_products"
  ON public.products FOR SELECT
  TO authenticated
  USING (true);

-- Admins podem inserir, atualizar e deletar
CREATE POLICY "admin_write_products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "admin_update_products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "admin_delete_products"
  ON public.products FOR DELETE
  TO authenticated
  USING (true);

-- =============================================================
-- POLÍTICAS: product_images
-- =============================================================
-- Público pode ver imagens de produtos publicados
CREATE POLICY "public_read_product_images"
  ON public.product_images FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.is_published = true
    )
  );

-- Admins podem ver todas as imagens
CREATE POLICY "admin_read_all_product_images"
  ON public.product_images FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "admin_write_product_images"
  ON public.product_images FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "admin_update_product_images"
  ON public.product_images FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "admin_delete_product_images"
  ON public.product_images FOR DELETE
  TO authenticated
  USING (true);

-- =============================================================
-- POLÍTICAS: store_settings
-- =============================================================
-- Público pode ler configurações (necessário para o catálogo)
CREATE POLICY "public_read_store_settings"
  ON public.store_settings FOR SELECT
  TO anon, authenticated
  USING (true);

-- Apenas admins podem modificar
CREATE POLICY "admin_write_store_settings"
  ON public.store_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
