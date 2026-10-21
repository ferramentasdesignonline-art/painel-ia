"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ArrowDown, Users, TrendingUp, Trophy } from "lucide-react";

export type FunnelStage = {
  id: string;
  nome: string;
  count: number;
  conversionRate: number | null;
  cor?: string;
};

export type FunnelData = {
  stages: FunnelStage[];
  total: number;
  globalConversionRate: number;
  totalVendas: number;
};

interface VisualFunnelProps {
  funnel?: FunnelData | null;
  loading?: boolean;
}

const STAGE_CONFIGS: Record<number, { width: string; gradient: string; border: string }> = {
  0: { width: "w-[100%]", gradient: "from-blue-600 via-indigo-600 to-blue-700", border: "border-blue-400/40" },
  1: { width: "w-[84%]", gradient: "from-cyan-600 via-teal-600 to-cyan-700", border: "border-cyan-400/40" },
  2: { width: "w-[68%]", gradient: "from-purple-600 via-indigo-600 to-purple-700", border: "border-purple-400/40" },
  3: { width: "w-[52%]", gradient: "from-amber-500 via-orange-500 to-amber-600", border: "border-amber-400/40" },
  4: { width: "w-[38%]", gradient: "from-emerald-600 via-green-600 to-emerald-700", border: "border-emerald-400/40" },
};

export function VisualFunnel({ funnel, loading }: VisualFunnelProps) {
  if (loading || !funnel || !funnel.stages || funnel.stages.length === 0) {
    return (
      <Card className="border-none soft-shadow p-6 rounded-3xl bg-white">
        <div className="h-64 flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
            <span className="text-xs font-semibold text-gray-400">Carregando funil comercial...</span>
          </div>
        </div>
      </Card>
    );
  }

  const { stages, total, globalConversionRate, totalVendas } = funnel;

  return (
    <Card className="border-none soft-shadow p-6 rounded-3xl bg-white overflow-hidden font-poppins">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-gray-100 gap-2">
        <div>
          <CardTitle className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
            Funil de Conversão Comercial
          </CardTitle>
          <CardDescription className="text-xs font-medium text-gray-500 mt-0.5">
            Evolução dos leads pelas etapas do atendimento até o fechamento
          </CardDescription>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-6">
        {/* Lado Esquerdo: Funil Vertical Cônico */}
        <div className="lg:col-span-8 flex flex-col items-center justify-center py-2">
          {stages.map((stage, idx) => {
            const config = STAGE_CONFIGS[idx] || {
              width: "w-[60%]",
              gradient: "from-gray-600 to-gray-700",
              border: "border-gray-400",
            };

            return (
              <React.Fragment key={stage.id}>
                {/* Seta de Transição e Taxa de Conversão */}
                {idx > 0 && (
                  <div className="flex items-center gap-1.5 my-1.5 animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-[11px] font-bold text-indigo-700 shadow-2xs">
                      <ArrowDown className="w-3 h-3 text-indigo-600" />
                      <span>{stage.conversionRate !== null ? `${stage.conversionRate}%` : "0%"} de conversão</span>
                    </div>
                  </div>
                )}

                {/* Camada do Funil */}
                <div
                  className={`relative ${config.width} transition-all duration-300 hover:scale-[1.01]`}
                >
                  <div
                    className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${config.gradient} p-3 text-white shadow-md border ${config.border} flex flex-col items-center justify-center`}
                  >
                    {/* Efeito 3D sutil */}
                    <div className="absolute inset-0 bg-white/10 opacity-30 pointer-events-none rounded-2xl [mask-image:radial-gradient(ellipse_at_top,transparent_20%,black)]" />
                    
                    <span className="text-[11px] font-black uppercase tracking-widest text-white/90 drop-shadow-xs">
                      {stage.nome}
                    </span>
                    <span className="text-2xl font-black tracking-tight text-white mt-0.5 drop-shadow-sm">
                      {stage.count.toLocaleString("pt-BR")}
                    </span>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Lado Direito: Resumo de Métricas Globais */}
        <div className="lg:col-span-4 flex flex-col gap-4 justify-center">
          {/* Card Total */}
          <div className="bg-gray-50/70 border border-gray-100 rounded-2xl p-4.5 flex items-center justify-between shadow-2xs hover:bg-gray-50 transition-colors">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Total de Leads
              </span>
              <span className="text-2xl font-black text-gray-900 tracking-tight">
                {total.toLocaleString("pt-BR")}
              </span>
              <span className="text-[11px] text-gray-500 font-medium block">
                Volume de entrada no período
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-100/60 text-blue-600 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </div>

          {/* Card Conversão Geral */}
          <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4.5 flex items-center justify-between shadow-2xs hover:bg-amber-50/70 transition-colors">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                Taxa de Conversão Geral
              </span>
              <span className="text-2xl font-black text-amber-900 tracking-tight">
                {globalConversionRate}%
              </span>
              <span className="text-[11px] text-amber-800/80 font-medium block">
                Leads que fecharam negócio
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          {/* Card Vendas / Clientes */}
          <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4.5 flex items-center justify-between shadow-2xs hover:bg-emerald-50/70 transition-colors">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                Vendas / Clientes
              </span>
              <span className="text-2xl font-black text-emerald-900 tracking-tight">
                {totalVendas.toLocaleString("pt-BR")}
              </span>
              <span className="text-[11px] text-emerald-800/80 font-medium block">
                Contratos e compras concluídas
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
