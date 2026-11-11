/**
 * src/lib/credere/types.ts
 * Tipos e interfaces oficiais para a integração com a API da Credere
 */

export interface CredereStore {
  id: number;
  name: string;
  display_name?: string;
  cnpj?: string;
  uf?: string;
  city?: string;
  active: boolean;
  account_active?: boolean;
}

export type BankCredentialStatus = 'okay' | 'unauthorized' | 'not_analyzed' | 'inactive' | 'none';

export interface BankCredentialInfo {
  bank_integration_version?: string;
  active?: boolean;
  status?: BankCredentialStatus | string;
  status_updated_at?: string;
  is_shared?: boolean;
  shared_from_store?: string | number | null;
}

export interface BankCatalogItem {
  code: string;
  name: string;
  tradename: string;
  display_name?: string;
  description?: string;
  color?: string;
  available_versions?: string[];
  active_in_catalog?: boolean;
}

export interface BankWithStatus extends BankCatalogItem {
  status: BankCredentialStatus;
  statusLabel: string;
  bank_credential?: BankCredentialInfo | null;
  last_checked_at?: string | null;
}

export interface CredereFieldOption {
  value: string | number;
  label: string;
}

export interface CredereFormField {
  name: string;
  label: string;
  type: 'string' | 'password' | 'integer' | 'choices' | 'boolean' | string;
  required?: boolean;
  sensitive?: boolean;
  format?: string;
  format_hint?: string;
  options?: CredereFieldOption[];
  default_value?: any;
}

export interface CredereBankFieldsResponse {
  bank_integration_versions?: string[];
  current_version?: string;
  fields?: CredereFormField[];
}

export interface CredereSummary {
  conectados: number;
  invalidos: number;
  sem_credencial: number;
  em_verificacao: number;
  inativos: number;
  total: number;
}

export interface CredereSimulationBank {
  febraban_code?: string;
  id?: number;
  name?: string;
  nickname?: string;
  display_name?: string;
}

export interface CredereSimulationCondition {
  id?: number;
  bank?: CredereSimulationBank;
  installments?: number;
  first_installment_value?: number | null;
  last_installment_value?: number | null;
  down_payment?: number;
  financed_amount?: number;
  interest_monthly?: number | null;
  interest_annually?: number | null;
  cet_monthly?: number | null;
  cet_annually?: number | null;
  success?: boolean;
  available?: boolean;
  reason?: string | null;
  pre_approval_status?: number | string | null;
  credit_condition_description?: string | null;
  created_at?: string;
}

export interface CredereSimulationLead {
  id?: number;
  name?: string;
  cpf_cnpj?: string;
  email?: string | null;
  phone_number?: string | null;
  birthdate?: string | null;
  has_cnh?: boolean | null;
  address?: {
    city?: string;
    state?: string;
    street?: string;
    number?: string;
    district?: string;
    zip_code?: string;
  } | null;
}

export interface CredereSimulationVehicle {
  id?: number;
  asset_value?: number;
  manufacture_year?: number;
  model_year?: number;
  licensing_city?: string | null;
  licensing_uf?: string | null;
  license_plate_code?: string | null;
  vehicle_model?: {
    id?: number;
    brand?: string;
    model_name?: string;
    version?: string;
    fipe_code?: string;
    category?: {
      label?: string;
    };
  } | null;
}

export interface CredereSimulation {
  uuid: string;
  created_at: string;
  assets_value?: number;
  commercial?: boolean;
  lead?: CredereSimulationLead;
  vehicle?: CredereSimulationVehicle;
  conditions?: CredereSimulationCondition[];
  seller_cpf?: string | null;
  seller_name?: string | null;
  success?: boolean;
}

export interface CredereSimulationsPaging {
  count: number;
  page: number;
  items: number;
  pages: number;
  next?: number | null;
  prev?: number | null;
}
