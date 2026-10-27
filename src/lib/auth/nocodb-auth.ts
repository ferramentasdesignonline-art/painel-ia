const NOCODB_URL = (process.env.NOCODB_URL || "https://evolution-nocodb.4lap5g.easypanel.host").replace(/\/+$/, "");
const NOCODB_TOKEN = process.env.NOCODB_API_TOKEN || "9Qz7ETxba8JnXq3B0e9ybHaSiDar6hLqYBIIkg7u";
const SISTEMA_BASE_ID = "phlpcm1vv49x1ka";

let sistemaTableMapCache: Record<string, string> | null = null;

export async function getSistemaTableMap(): Promise<Record<string, string>> {
  if (sistemaTableMapCache) return sistemaTableMapCache;

  try {
    const res = await fetch(`${NOCODB_URL}/api/v2/meta/bases/${SISTEMA_BASE_ID}/tables`, {
      headers: { "xc-token": NOCODB_TOKEN },
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      const map: Record<string, string> = {};
      for (const t of (data.list || [])) {
        if (t.title) map[t.title.toLowerCase().trim()] = t.id;
        if (t.table_name) map[t.table_name.toLowerCase().trim()] = t.id;
      }
      sistemaTableMapCache = map;
      return map;
    }
  } catch (err) {
    console.error("Erro ao buscar mapa de tabelas do Sistema Dash IA no NocoDB:", err);
  }

  // Fallback para IDs conhecidos da base phlpcm1vv49x1ka
  return {
    "sistema-dash-ia-admins": "m8ud3tl4c480iaj",
    "sistema-dash-ia_clientes": "mjdblijq92ayvua",
    "sistema-dash-ia_funis": "my69qadj49wz4yw",
    "sistema-dash-ia_etapas_funil": "m01vrpxdyz0nmce",
    "sistema-dash-ia_analises": "mhpfeq6riok04jb",
  };
}

export type AuthResult = {
  success: boolean;
  role?: 'master_admin' | 'client';
  user?: {
    userId: string | number;
    email: string;
    nome: string;
    role: 'master_admin' | 'client';
    clientId?: string | number;
    slug?: string;
    uuid_antigo?: string;
    config?: any;
  };
  error?: string;
};

export async function authenticateWithNocoDB(emailInput: string, passwordInput: string): Promise<AuthResult> {
  const cleanEmail = emailInput.trim().toLowerCase();
  const tableMap = await getSistemaTableMap();

  const adminsTableId = tableMap["sistema-dash-ia-admins"] || "m8ud3tl4c480iaj";
  const clientesTableId = tableMap["sistema-dash-ia_clientes"] || "mjdblijq92ayvua";

  // 1. Verifica se é Admin
  try {
    const adminUrl = `${NOCODB_URL}/api/v2/tables/${adminsTableId}/records?where=(email,eq,${encodeURIComponent(cleanEmail)})&limit=1`;
    const adminRes = await fetch(adminUrl, {
      headers: { "xc-token": NOCODB_TOKEN },
      cache: "no-store",
    });

    if (adminRes.ok) {
      const adminData = await adminRes.json();
      const admin = adminData.list?.[0];
      if (admin) {
        if (admin.senha === passwordInput) {
          return {
            success: true,
            role: 'master_admin',
            user: {
              userId: admin.Id || admin.id,
              email: admin.email,
              nome: admin.nome || 'Administrador',
              role: 'master_admin',
            },
          };
        } else {
          return { success: false, error: 'Senha incorreta para Administrador' };
        }
      }
    }
  } catch (err) {
    console.error("Erro ao autenticar admin no NocoDB:", err);
  }

  // 2. Verifica se é Cliente
  try {
    const clientUrl = `${NOCODB_URL}/api/v2/tables/${clientesTableId}/records?where=(email,eq,${encodeURIComponent(cleanEmail)})&limit=1`;
    const clientRes = await fetch(clientUrl, {
      headers: { "xc-token": NOCODB_TOKEN },
      cache: "no-store",
    });

    if (clientRes.ok) {
      const clientData = await clientRes.json();
      const cliente = clientData.list?.[0];
      if (cliente) {
        if (!cliente.senha || !cliente.senha.trim()) {
          return { success: false, error: 'Senha não configurada para este cliente no painel.' };
        }

        if (cliente.senha === passwordInput) {
          return {
            success: true,
            role: 'client',
            user: {
              userId: cliente.Id || cliente.id,
              clientId: cliente.Id || cliente.id,
              email: cliente.email,
              nome: cliente.nome,
              slug: cliente.slug,
              uuid_antigo: cliente.uuid_antigo,
              role: 'client',
              config: cliente,
            },
          };
        } else {
          return { success: false, error: 'Senha incorreta' };
        }
      }
    }
  } catch (err) {
    console.error("Erro ao autenticar cliente no NocoDB:", err);
  }

  return { success: false, error: 'Usuário não encontrado' };
}

export async function getNocoDBClientById(clientId: string | number): Promise<any | null> {
  const tableMap = await getSistemaTableMap();
  const clientesTableId = tableMap["sistema-dash-ia_clientes"] || "mjdblijq92ayvua";

  try {
    // Se for número (Id do NocoDB)
    const isNum = !isNaN(Number(clientId));
    const url = isNum
      ? `${NOCODB_URL}/api/v2/tables/${clientesTableId}/records/${clientId}`
      : `${NOCODB_URL}/api/v2/tables/${clientesTableId}/records?where=(uuid_antigo,eq,${encodeURIComponent(String(clientId))})&limit=1`;

    const res = await fetch(url, {
      headers: { "xc-token": NOCODB_TOKEN },
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      return isNum ? data : (data.list?.[0] || null);
    }
  } catch (err) {
    console.error("Erro getNocoDBClientById:", err);
  }
  return null;
}

export async function getNocoDBClientByEmail(email: string): Promise<any | null> {
  const tableMap = await getSistemaTableMap();
  const clientesTableId = tableMap["sistema-dash-ia_clientes"] || "mjdblijq92ayvua";

  try {
    const cleanEmail = email.trim().toLowerCase();
    const url = `${NOCODB_URL}/api/v2/tables/${clientesTableId}/records?where=(email,eq,${encodeURIComponent(cleanEmail)})&limit=1`;
    const res = await fetch(url, {
      headers: { "xc-token": NOCODB_TOKEN },
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      return data.list?.[0] || null;
    }
  } catch (err) {
    console.error("Erro getNocoDBClientByEmail:", err);
  }
  return null;
}
