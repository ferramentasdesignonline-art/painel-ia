-- Execute no SQL Editor do Supabase para criar o bucket de mídias temporárias

INSERT INTO storage.buckets (id, name, public) 
VALUES ('wacloud_midias', 'wacloud_midias', true)
ON CONFLICT (id) DO NOTHING;

-- Permitir que qualquer um possa ler os arquivos (necessário para o WhatsApp baixar)
CREATE POLICY "Public Access" ON storage.objects 
FOR SELECT USING (bucket_id = 'wacloud_midias');

-- Permitir que a nossa aplicação (mesmo anônima, pois o front-end envia direto) faça upload
CREATE POLICY "Upload Access" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'wacloud_midias');

-- Permitir deletar
CREATE POLICY "Delete Access" ON storage.objects 
FOR DELETE USING (bucket_id = 'wacloud_midias');
