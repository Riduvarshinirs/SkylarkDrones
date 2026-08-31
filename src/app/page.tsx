import { Header } from "@/components/layout/Header";
import { ChatShell } from "@/components/chat/ChatShell";
import { OperationsIntelligence } from "@/components/dashboard/OperationsIntelligence";
import { SalesIntelligence } from "@/components/dashboard/SalesIntelligence";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

export default function HomePage() {
  return (
    <div className="flex h-full min-h-screen flex-col bg-paper">
      <Header />
      <main className="flex min-h-0 flex-1 flex-col">
        <ErrorBoundary>
          <SalesIntelligence />
          <OperationsIntelligence />
          <ChatShell />
        </ErrorBoundary>
      </main>
    </div>
  );
}
