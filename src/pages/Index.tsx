import { ChatWidget } from '@/components/ChatWidget';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Customer Support</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Get instant help with your orders, returns, refunds, and more. Our AI-powered support assistant is here to help 24/7.
            </p>
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-center">
          <ChatWidget />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface mt-16">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>Need additional help? Contact our human support team or visit our FAQ section.</p>
          <div className="flex justify-center gap-4 mt-2">
            <a href="/agent" className="text-primary hover:underline">Agent Dashboard</a>
            <a href="/admin/audit" className="text-primary hover:underline">Audit Logs</a>
            <a href="/metrics" className="text-primary hover:underline">Metrics</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
