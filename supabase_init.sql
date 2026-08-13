-- Script para criar as tabelas base do SaaS (Multi-Tenant) no Supabase

-- 1. Tabela de Master Admins
CREATE TABLE public."sistema-dash-ia-admins" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ativar RLS para a tabela admins
ALTER TABLE public."sistema-dash-ia-admins" ENABLE ROW LEVEL SECURITY;

-- 2. Tabela de Clientes SaaS (Concessionárias)
CREATE TABLE public."sistema-dash-ia_clientes" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  email text NOT NULL,
  active boolean DEFAULT true,
  tabela_leads text NOT NULL,
  tabela_bloqueios text NOT NULL,
  tabela_memoria text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ativar RLS para a tabela clientes
ALTER TABLE public."sistema-dash-ia_clientes" ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Segurança (Row Level Security) básicas
-- Admins podem ler tudo
CREATE POLICY "Admins podem ver clientes" ON public."sistema-dash-ia_clientes"
  FOR SELECT USING (
    (SELECT auth.uid()) IN (SELECT auth_user_id FROM public."sistema-dash-ia-admins")
  );

-- O próprio cliente pode ver seu registro
CREATE POLICY "Cliente pode ver seu proprio registro" ON public."sistema-dash-ia_clientes"
  FOR SELECT USING (auth.uid() = auth_user_id);

-- Apenas funções server-side com service_role (ignorando RLS) farão inserções
-- Então não precisamos de políticas públicas de INSERT/UPDATE por enquanto
