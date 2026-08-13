"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Car, Search, RefreshCw } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function EstoquePage() {
  const [vehicles, setVehicles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchEstoque() {
    setLoading(true)
    try {
      const res = await fetch('/api/estoque')
      const json = await res.json()
      if (json.data) {
        setVehicles(json.data)
      }
    } catch (err) {
      console.error("Failed to fetch estoque", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEstoque()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estoque de Veículos</h1>
          <p className="text-muted-foreground">Veja os veículos que sua IA está oferecendo aos clientes.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchEstoque} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar veículo..."
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow>
                <TableHead>Marca</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Versão</TableHead>
                <TableHead>Ano</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead className="text-right">Preço</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    Carregando estoque...
                  </TableCell>
                </TableRow>
              ) : vehicles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    Nenhum veículo encontrado no estoque.
                  </TableCell>
                </TableRow>
              ) : (
                vehicles.map((v, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{v.nome_marca || '-'}</TableCell>
                    <TableCell>{v.nome_modelo || '-'}</TableCell>
                    <TableCell>{v.nome_versao || '-'}</TableCell>
                    <TableCell>{v.ano_modelo || '-'}</TableCell>
                    <TableCell>{v.cor || '-'}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {v.preco ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v.preco) : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
