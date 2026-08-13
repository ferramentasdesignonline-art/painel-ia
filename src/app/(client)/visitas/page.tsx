import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "lucide-react"

export default function VisitasPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agendamentos e Visitas</h1>
          <p className="text-muted-foreground">Acompanhe os clientes que agendaram visitas ao showroom.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-600" />
            Em construção
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">
            A gestão de visitas com calendário integrado está em desenvolvimento. Em breve, a IA poderá agendar visitas automaticamente e elas aparecerão aqui.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
