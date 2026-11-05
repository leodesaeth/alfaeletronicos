-- =============================================================
-- Catálogo Digital Alfa — Migração 002: Storage Policies
-- =============================================================

-- ATENÇÃO: Execute este script no SQL Editor do Supabase
-- APÓS ter criado os buckets via Dashboard ou API:
--   - product-images (público)
--   - store-assets (público)

-- =============================================================
-- POLÍTICAS DE STORAGE: product-images
-- =============================================================

-- Qualquer pessoa pode visualizar imagens de produtos
CREATE POLICY "Public can view product images"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'product-images' );

-- Apenas admins autenticados podem fazer upload
CREATE POLICY "Admins can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'product-images' );

-- Apenas admins autenticados podem atualizar imagens
CREATE POLICY "Admins can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'product-images' );

-- Apenas admins autenticados podem deletar imagens
CREATE POLICY "Admins can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'product-images' );

-- =============================================================
-- POLÍTICAS DE STORAGE: store-assets
-- =============================================================

-- Qualquer pessoa pode visualizar assets da loja (logo, etc.)
CREATE POLICY "Public can view store assets"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'store-assets' );

-- Apenas admins autenticados podem fazer upload
CREATE POLICY "Admins can upload store assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'store-assets' );

-- Apenas admins autenticados podem atualizar assets
CREATE POLICY "Admins can update store assets"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'store-assets' );

-- Apenas admins autenticados podem deletar assets
CREATE POLICY "Admins can delete store assets"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'store-assets' );
