import { Header } from "@/components/layout/Header";
import { ChatShell } from "@/components/chat/ChatShell";

export default function HomePage() {
  return (
    <div className="flex h-full min-h-screen flex-col bg-paper">
      <Header />
      <main className="flex min-h-0 flex-1 flex-col">
        <ChatShell />
      </main>
    </div>
  );
}
