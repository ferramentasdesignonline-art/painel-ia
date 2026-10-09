-- Rode no SQL Editor do Supabase do WhatsApp Cloud

create table if not exists wacloud_mensagens (
  id uuid primary key default gen_random_uuid(),
  nome_instancia text not null,
  telefone_contato text,
  nome_contato text,
  mensagem text,
  tipo_mensagem text,
  timestamp_whatsapp timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_wacloud_mensagens_instancia on wacloud_mensagens(nome_instancia);
create index if not exists idx_wacloud_mensagens_telefone on wacloud_mensagens(telefone_contato);
create index if not exists idx_wacloud_mensagens_ts on wacloud_mensagens(timestamp_whatsapp desc);
