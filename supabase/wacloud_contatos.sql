-- Rode no SQL Editor do Supabase do WhatsApp Cloud (o mesmo das tabelas wacloud_*)

-- 1) Vínculo instância <-> cliente do SaaS
alter table wacloud_instancias add column if not exists cliente_id text;
alter table wacloud_instancias add column if not exists ativo boolean default true;
create index if not exists idx_wacloud_instancias_cliente on wacloud_instancias(cliente_id);

-- 2) Contatos importados do /chat/find da Uazapi
create table if not exists wacloud_contatos (
  id uuid primary key default gen_random_uuid(),
  instancia_id uuid,
  nome_instancia text not null,
  wa_chatid text not null,
  wa_chatlid text,
  telefone_contato text,
  nome_contato text,
  imagem_preview text,
  is_group boolean default false,
  ultima_mensagem text,
  ultimo_tipo text,
  ultimo_timestamp timestamptz,
  nao_lidas integer default 0,
  atualizado_em timestamptz default now(),
  created_at timestamptz default now(),
  unique (nome_instancia, wa_chatid)
);
create index if not exists idx_wacloud_contatos_ts on wacloud_contatos(nome_instancia, ultimo_timestamp desc);
