-- Execute no SQL Editor do Supabase do WhatsApp Cloud

ALTER TABLE wacloud_mensagens 
ADD COLUMN IF NOT EXISTS message_id text unique,
ADD COLUMN IF NOT EXISTS enviado_por_mim boolean default false,
ADD COLUMN IF NOT EXISTS url_midia text,
ADD COLUMN IF NOT EXISTS mimetype text;
