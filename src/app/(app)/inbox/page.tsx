import { ChatPreviewPanel } from "@/components/chat-preview-panel";

export default function InboxPage() {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="dashboard-title">Inbox</h2>
        <p className="dashboard-subtitle">Monitor ongoing conversations and response flow quality.</p>
      </div>
      <ChatPreviewPanel />
    </section>
  );
}
