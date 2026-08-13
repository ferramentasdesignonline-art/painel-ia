import { KanbanBoard } from '@/components/funil/KanbanBoard';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Funil de Leads | Design Online - IA',
  description: 'Gerencie seus leads e acompanhe o progresso da IA em tempo real.',
};

export default function FunilPage() {
  return (
    <div className="h-[calc(100vh-140px)] flex flex-col">
      <KanbanBoard />
    </div>
  );
}
