"use client"

import React from "react"
import { Sparkles, Database, CheckCircle2 } from "lucide-react"

interface SimulacaoConfigCardProps {
  webhookUrl: string
  onChangeWebhookUrl: (val: string) => void
  uf: string
  onChangeUf: (val: string) => void
  cidade: string
  onChangeCidade: (val: string) => void
  zeroKm: boolean
  onChangeZeroKm: (val: boolean) => void
  minReturn: number
  onChangeMinReturn: (val: number) => void
  maxReturn: number
  onChangeMaxReturn: (val: number) => void
}

export function SimulacaoConfigCard({
  webhookUrl,
  onChangeWebhookUrl,
  uf,
  onChangeUf,
  cidade,
  onChangeCidade,
  zeroKm,
  onChangeZeroKm,
  minReturn,
  onChangeMinReturn,
  maxReturn,
  onChangeMaxReturn,
}: SimulacaoConfigCardProps) {
  return (
    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3.5">
      {/* Cabeçalho da seção */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600 border border-amber-200/60">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h5 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Configuração da Simulação (n8n / Credere)
              </h5>
              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                100% Automático
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              O JSON completo é montado e gravado no banco de dados (<code className="font-mono text-indigo-600">config_simulacao</code>) para a sua automação do n8n consultar diretamente.
            </p>
          </div>
        </div>
      </div>

      {/* Grid de campos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50/70 p-3.5 rounded-xl border border-gray-200/80">
        {/* Webhook URL */}
        <div className="md:col-span-2">
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            URL do Webhook da Simulação no n8n
          </label>
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => onChangeWebhookUrl(e.target.value)}
            className="block w-full rounded-lg border-gray-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 text-xs p-2.5 bg-white border font-mono placeholder:text-gray-400"
            placeholder="https://n8n-webhook.vpsdesignonline.com.br/webhook/simulacao-loja"
          />
          <p className="text-[10px] text-gray-400 mt-1">
            Endpoint no seu n8n onde a Credere enviará a notificação de retorno da simulação.
          </p>
        </div>

        {/* Estado UF */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            Estado de Licenciamento (UF)
          </label>
          <input
            type="text"
            maxLength={2}
            value={uf}
            onChange={(e) => onChangeUf(e.target.value.toUpperCase())}
            className="block w-full rounded-lg border-gray-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 text-xs p-2 bg-white border font-mono uppercase font-bold"
            placeholder="MG"
          />
        </div>

        {/* Cidade */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            Cidade de Licenciamento
          </label>
          <input
            type="text"
            value={cidade}
            onChange={(e) => onChangeCidade(e.target.value)}
            className="block w-full rounded-lg border-gray-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 text-xs p-2 bg-white border"
            placeholder="Ex: João Monlevade"
          />
        </div>

        {/* Retorno Mínimo */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            Retorno Mínimo (min_return)
          </label>
          <input
            type="number"
            min={0}
            max={20}
            value={minReturn}
            onChange={(e) => onChangeMinReturn(Number(e.target.value))}
            className="block w-full rounded-lg border-gray-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 text-xs p-2 bg-white border font-mono font-bold"
          />
          <p className="text-[10px] text-gray-400 mt-0.5">
            Aplicado automaticamente em todas as parcelas (12x a 60x). Padrão: 3
          </p>
        </div>

        {/* Retorno Máximo */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            Retorno Máximo (max_return)
          </label>
          <input
            type="number"
            min={0}
            max={20}
            value={maxReturn}
            onChange={(e) => onChangeMaxReturn(Number(e.target.value))}
            className="block w-full rounded-lg border-gray-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 text-xs p-2 bg-white border font-mono font-bold"
          />
          <p className="text-[10px] text-gray-400 mt-0.5">
            Aplicado automaticamente em todas as parcelas (12x a 60x). Padrão: 6
          </p>
        </div>

        {/* Veículo Zero KM */}
        <div className="md:col-span-2 flex items-center justify-between p-2.5 bg-white rounded-lg border border-gray-200">
          <div>
            <span className="text-xs font-semibold text-gray-800">Veículo Zero KM?</span>
            <p className="text-[10px] text-gray-500">
              Define se a simulação é para veículo 0km (true) ou seminovo (false).
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={zeroKm}
              onChange={(e) => onChangeZeroKm(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>
      </div>

      {/* Box de confirmação da automação */}
      <div className="flex items-center gap-2 p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100 text-indigo-900 text-xs">
        <Database className="w-4 h-4 text-indigo-600 shrink-0" />
        <p className="text-[11px] text-indigo-950/80 leading-relaxed">
          <strong>Sincronização Ativa:</strong> Ao salvar, o JSON completo é montado com as variáveis do n8n e os bancos ativos da Credere. Sempre que uma credencial bancária for salva ou alterada, o JSON no banco de dados se atualiza sozinho.
        </p>
      </div>
    </div>
  )
}
