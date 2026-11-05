-- =====================================================================
-- SETUP COMPLETO AUTOMÁTICO — CATÁLOGO DIGITAL ALFA ELETRÔNICOS
-- Cole este script no SQL Editor do Supabase e clique em "Run"
-- Link direto: https://supabase.com/dashboard/project/hygbyvzkwqclyjodsjto/sql/new
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELAS
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

CREATE TABLE IF NOT EXISTS public.product_images (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id    UUID        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  storage_path  TEXT        NOT NULL,
  display_order INTEGER     NOT NULL DEFAULT 0,
  is_primary    BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.store_settings (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_name          TEXT        NOT NULL DEFAULT 'Alfa Eletrônicos',
  store_description   TEXT        DEFAULT 'Tecnologia, estilo e conveniência para o seu dia a dia.',
  logo_path           TEXT,
  whatsapp_number     TEXT        DEFAULT '5511999999999',
  primary_color       TEXT        DEFAULT '#111111',
  hero_title          TEXT        DEFAULT E'Tudo o que você precisa,\nem um só lugar.',
  hero_description    TEXT        DEFAULT 'Eletrônicos, acessórios, perfumes e muito mais, com qualidade e as melhores opções.',
  contact_email       TEXT,
  contact_address     TEXT,
  footer_text         TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. BUCKETS DE STORAGE (criados automaticamente como públicos)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('product-images', 'product-images', true),
  ('store-assets', 'store-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. POLÍTICAS DE ACESSO (RLS) — liberadas para leitura e edição
ALTER TABLE public.categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_categories" ON public.categories;
CREATE POLICY "allow_all_categories" ON public.categories FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_products" ON public.products;
CREATE POLICY "allow_all_products" ON public.products FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_product_images" ON public.product_images;
CREATE POLICY "allow_all_product_images" ON public.product_images FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_store_settings" ON public.store_settings;
CREATE POLICY "allow_all_store_settings" ON public.store_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_storage_objects" ON storage.objects;
CREATE POLICY "allow_all_storage_objects" ON storage.objects FOR ALL TO anon, authenticated
  USING (bucket_id IN ('product-images', 'store-assets'))
  WITH CHECK (bucket_id IN ('product-images', 'store-assets'));

-- 4. CONFIGURAÇÕES INICIAIS DA LOJA
INSERT INTO public.store_settings (
  store_name,
  store_description,
  whatsapp_number,
  primary_color,
  hero_title,
  hero_description
)
SELECT
  'Alfa Eletrônicos',
  'Tecnologia, estilo e conveniência para o seu dia a dia.',
  '5511999999999',
  '#111111',
  E'Tudo o que você precisa,\nem um só lugar.',
  'Eletrônicos, acessórios, perfumes e muito mais, com qualidade e as melhores opções.'
WHERE NOT EXISTS (SELECT 1 FROM public.store_settings);

-- 5. CATEGORIAS INICIAIS
INSERT INTO public.categories (name, slug, description, display_order, is_active)
VALUES
  ('Celulares', 'celulares', 'Smartphones de última geração com garantia e procedência.', 1, true),
  ('Capinhas e Acessórios', 'capinhas-e-acessorios', 'Proteção e estilo para o seu smartphone.', 2, true),
  ('Carregadores e Cabos', 'carregadores-e-cabos', 'Carregamento turbo, cabos reforçados e power banks.', 3, true),
  ('Fones e Áudio', 'fones-e-audio', 'Fones Bluetooth, headphones e caixas de som.', 4, true),
  ('Informática', 'informatica', 'Periféricos, cabos, armazenamento e acessórios para PC.', 5, true),
  ('Perfumes', 'perfumes', 'Fragrâncias importadas e selecionadas.', 6, true),
  ('Chocolates', 'chocolates', 'Chocolates importados e opções para presente.', 7, true),
  ('Outros', 'outros', 'Smartwatches, presentes e utilidades tecnológicas.', 8, true)
ON CONFLICT (slug) DO NOTHING;

-- 6. PRODUTOS DE VITRINE INICIAIS
DO $$
DECLARE
  cat_celulares UUID;
  cat_fones UUID;
  cat_outros UUID;
  cat_carregadores UUID;
  cat_perfumes UUID;
  p1 UUID;
  p2 UUID;
  p3 UUID;
  p4 UUID;
  p5 UUID;
  p6 UUID;
BEGIN
  SELECT id INTO cat_celulares FROM public.categories WHERE slug = 'celulares' LIMIT 1;
  SELECT id INTO cat_fones FROM public.categories WHERE slug = 'fones-e-audio' LIMIT 1;
  SELECT id INTO cat_outros FROM public.categories WHERE slug = 'outros' LIMIT 1;
  SELECT id INTO cat_carregadores FROM public.categories WHERE slug = 'carregadores-e-cabos' LIMIT 1;
  SELECT id INTO cat_perfumes FROM public.categories WHERE slug = 'perfumes' LIMIT 1;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE slug = 'smartphone-galaxy-s24') THEN
    INSERT INTO public.products (name, slug, short_description, description, category_id, price, show_price, availability, is_published, is_featured, display_order)
    VALUES ('Smartphone Galaxy S24', 'smartphone-galaxy-s24', 'Tecnologia de ponta ao seu alcance.', 'Smartphone com tela Dynamic AMOLED 2X de 120Hz, conjunto triplo de câmeras de alta resolução e bateria para o dia todo.', cat_celulares, 4999.00, true, 'available', true, true, 1)
    RETURNING id INTO p1;
    INSERT INTO public.product_images (product_id, storage_path, display_order, is_primary)
    VALUES (p1, '/showcase/prod-s24.png', 0, true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE slug = 'fone-bluetooth-pro') THEN
    INSERT INTO public.products (name, slug, short_description, description, category_id, price, show_price, availability, is_published, is_featured, display_order)
    VALUES ('Fone Bluetooth Pro', 'fone-bluetooth-pro', 'Som de alta qualidade.', 'Fone de ouvido sem fio com cancelamento ativo de ruído, estojo de recarga e encaixe ergonômico.', cat_fones, 299.00, true, 'available', true, true, 2)
    RETURNING id INTO p2;
    INSERT INTO public.product_images (product_id, storage_path, display_order, is_primary)
    VALUES (p2, '/showcase/prod-earbuds.png', 0, true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE slug = 'smartwatch-ultra') THEN
    INSERT INTO public.products (name, slug, short_description, description, category_id, price, show_price, availability, is_published, is_featured, display_order)
    VALUES ('Smartwatch Ultra', 'smartwatch-ultra', 'Conecte-se em todos os momentos.', 'Relógio inteligente com monitoramento completo de saúde e esportes, notificações e bateria de longa duração.', cat_outros, 799.00, true, 'available', true, true, 3)
    RETURNING id INTO p3;
    INSERT INTO public.product_images (product_id, storage_path, display_order, is_primary)
    VALUES (p3, '/showcase/prod-watch.png', 0, true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE slug = 'carregador-turbo') THEN
    INSERT INTO public.products (name, slug, short_description, description, category_id, price, show_price, availability, is_published, is_featured, display_order)
    VALUES ('Carregador Turbo', 'carregador-turbo', 'Carregamento rápido e seguro.', 'Fonte carregadora turbo USB-C de alta potência com proteção contra sobrecarga e aquecimento.', cat_carregadores, 99.00, true, 'available', true, true, 4)
    RETURNING id INTO p4;
    INSERT INTO public.product_images (product_id, storage_path, display_order, is_primary)
    VALUES (p4, '/showcase/prod-charger.png', 0, true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE slug = 'perfume-importado-eau-de-parfum') THEN
    INSERT INTO public.products (name, slug, short_description, description, category_id, price, show_price, availability, is_published, is_featured, display_order)
    VALUES ('Perfume Importado Eau de Parfum', 'perfume-importado-eau-de-parfum', 'Fragrância marcante e sofisticada.', 'Perfume importado original Eau de Parfum 100ml com notas amadeiradas e âmbar dourado, alta fixação e projeção de longa duração.', cat_perfumes, 489.00, true, 'available', true, true, 5)
    RETURNING id INTO p5;
    INSERT INTO public.product_images (product_id, storage_path, display_order, is_primary)
    VALUES (p5, '/showcase/prod-perfume.png', 0, true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE slug = 'power-bank-10000mah') THEN
    INSERT INTO public.products (name, slug, short_description, description, category_id, price, show_price, availability, is_published, is_featured, display_order)
    VALUES ('Power Bank 10000mAh', 'power-bank-10000mah', 'Energia onde você estiver.', 'Carregador portátil slim de 10.000mAh com visor digital de porcentagem de bateria e carregamento rápido.', cat_carregadores, 149.00, true, 'available', false, 6)
    RETURNING id INTO p6;
    INSERT INTO public.product_images (product_id, storage_path, display_order, is_primary)
    VALUES (p6, '/showcase/prod-powerbank.png', 0, true);
  END IF;
END $$;

