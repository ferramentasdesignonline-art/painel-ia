"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { User, Building2, Bell, Shield, Save } from "lucide-react"

export default function SettingsPage() {
  const [loading, setLoading] = useState(false)

  const handleSave = () => {
    setLoading(true)
    setTimeout(() => setLoading(false), 1000)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 font-poppins pb-20">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Configurações</h1>
        <p className="text-gray-500 mt-1">Gerencie suas preferências de conta e os dados da sua concessionária.</p>
      </div>

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList className="bg-white p-1 rounded-xl soft-shadow border border-gray-100 h-12 inline-flex">
          <TabsTrigger value="account" className="rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white font-bold transition-all px-6">
            <User className="w-4 h-4 mr-2" />
            Minha Conta
          </TabsTrigger>
          <TabsTrigger value="dealership" className="rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white font-bold transition-all px-6">
            <Building2 className="w-4 h-4 mr-2" />
            Concessionária
          </TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white font-bold transition-all px-6">
            <Bell className="w-4 h-4 mr-2" />
            Notificações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="animate-in fade-in duration-500">
          <Card className="border-none soft-shadow rounded-2xl overflow-hidden">
            <CardHeader className="bg-gray-50/30 border-b border-gray-50">
              <CardTitle className="text-xl font-bold font-poppins text-gray-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-500" />
                Informações Pessoais
              </CardTitle>
              <CardDescription className="font-poppins">Atualize sua senha e e-mail de acesso.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-gray-500">Nome Completo</Label>
                  <Input id="name" defaultValue="Duo Concessionária" className="h-11 rounded-xl border-gray-100 focus:ring-2 focus:ring-indigo-500 font-medium" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-gray-500">E-mail</Label>
                  <Input id="email" defaultValue="contato@duomkt.com.br" disabled className="h-11 rounded-xl bg-gray-50 border-gray-100 cursor-not-allowed font-medium" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pass" className="text-xs font-bold uppercase tracking-wider text-gray-500">Nova Senha</Label>
                  <Input id="pass" type="password" placeholder="••••••••" className="h-11 rounded-xl border-gray-100 focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="pt-4 border-t border-gray-50 flex justify-end">
                <Button onClick={handleSave} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold h-11 px-8 shadow-lg shadow-indigo-100 transition-all">
                  {loading ? "Salvando..." : "Salvar alterações"}
                  {!loading && <Save className="w-4 h-4 ml-2" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dealership" className="animate-in fade-in duration-500">
          <Card className="border-none soft-shadow rounded-2xl overflow-hidden">
            <CardHeader className="bg-gray-50/30 border-b border-gray-50">
              <CardTitle className="text-xl font-bold font-poppins text-gray-900">Dados da Loja</CardTitle>
              <CardDescription className="font-poppins">Configurações visíveis para os clientes e integração IA.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="biz-name" className="text-xs font-bold uppercase tracking-wider text-gray-500">Nome da Concessionária</Label>
                  <Input id="biz-name" defaultValue="Duo Mkt Motors" className="h-11 rounded-xl border-gray-100 focus:ring-2 focus:ring-indigo-500 font-medium" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="biz-addr" className="text-xs font-bold uppercase tracking-wider text-gray-500">Endereço Principal</Label>
                  <Input id="biz-addr" placeholder="Av. Principal, 1000 - Centro" className="h-11 rounded-xl border-gray-100 focus:ring-2 focus:ring-indigo-500 font-medium" />
                </div>
              </div>
              <div className="pt-4 border-t border-gray-50 flex justify-end">
                <Button onClick={handleSave} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold h-11 px-8 shadow-lg shadow-indigo-100 transition-all">
                  {loading ? "Salvando..." : "Salvar dados da empresa"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="animate-in fade-in duration-500">
          <Card className="border-none soft-shadow rounded-2xl overflow-hidden">
            <CardContent className="p-20 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <Bell className="w-8 h-8 text-gray-300" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 font-poppins">Silencioso por aqui</h3>
              <p className="text-gray-500 font-medium max-w-sm">Você ainda não configurou alertas de notificações para novos leads ou follow-ups.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
