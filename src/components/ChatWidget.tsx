import React, { useState, useRef, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { ChatMessage } from './ChatMessage';
import { Send, Package, RefreshCw, AlertTriangle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface Message {
  id: string;
  type: 'user' | 'bot' | 'system';
  content: string;
  timestamp: Date;
  confidence?: number;
  intent?: string;
  actions?: Array<{type: string; [key: string]: any}>;
  kb_matches?: Array<{title: string; content: string}>;
}

export const ChatWidget: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'bot',
      content: 'Hello! I\'m here to help you with your orders, returns, refunds, and any questions about our policies. How can I assist you today?',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [orderLookup, setOrderLookup] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(uuidv4());
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: uuidv4(),
      type: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          order_id: orderLookup || undefined,
          user_email: userEmail || undefined,
          session_id: sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();

      const botMessage: Message = {
        id: uuidv4(),
        type: 'bot',
        content: data.response_text,
        timestamp: new Date(),
        confidence: data.confidence,
        intent: data.intent,
        actions: data.actions,
        kb_matches: data.kb_matches,
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: uuidv4(),
        type: 'system',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setInput('');
    }
  };

  const handleActionRequest = async (action: any) => {
    try {
      const response = await fetch('/api/escalate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          order_id: orderLookup || action.order_id,
          action,
          conversation_context: messages.slice(-5), // Last 5 messages for context
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create escalation');
      }

      const data = await response.json();

      const systemMessage: Message = {
        id: uuidv4(),
        type: 'system',
        content: data.message,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, systemMessage]);

      toast({
        title: "Request Submitted",
        description: "Your request has been sent to our support team for review.",
      });
    } catch (error) {
      console.error('Error creating escalation:', error);
      toast({
        title: "Error",
        description: "Failed to submit request. Please try again.",
        variant: "destructive",
      });
    }
  };

  const lookupOrder = async () => {
    if (!orderLookup.trim()) return;

    try {
      const response = await fetch(`/api/orders/${orderLookup}`);
      
      if (!response.ok) {
        throw new Error('Order not found');
      }

      const order = await response.json();

      const orderMessage: Message = {
        id: uuidv4(),
        type: 'system',
        content: `Order Found: ${order.order_id}\nStatus: ${order.status}\nItems: ${order.items.map((item: any) => `${item.sku} (${item.qty})`).join(', ')}\n${order.tracking_number ? `Tracking: ${order.tracking_number}` : 'No tracking available yet'}`,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, orderMessage]);
      setUserEmail(order.user_email);
    } catch (error) {
      console.error('Error looking up order:', error);
      const errorMessage: Message = {
        id: uuidv4(),
        type: 'system',
        content: 'Order not found. Please check the order ID and try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto h-[600px] flex flex-col bg-background border border-border rounded-lg shadow-chat">
      {/* Header */}
      <div className="p-4 border-b border-border bg-primary text-primary-foreground rounded-t-lg">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Package className="w-5 h-5" />
          Customer Support Chat
        </h2>
        <p className="text-sm opacity-90">Get help with orders, returns, and more</p>
      </div>

      {/* Quick Order Lookup */}
      <div className="p-3 border-b border-border bg-surface">
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="order-lookup" className="text-xs">Quick Order Lookup</Label>
            <Input
              id="order-lookup"
              placeholder="Enter order ID (e.g., ORD-1001)"
              value={orderLookup}
              onChange={(e) => setOrderLookup(e.target.value)}
              className="text-sm"
            />
          </div>
          <Button 
            onClick={lookupOrder}
            size="sm" 
            className="mt-4"
            disabled={!orderLookup.trim()}
          >
            Lookup
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              onActionRequest={handleActionRequest}
            />
          ))}
          {isLoading && (
            <div className="flex justify-start mb-4">
              <div className="flex gap-3 max-w-[80%]">
                <div className="w-8 h-8 rounded-full bg-chat-bot text-chat-bot-foreground flex items-center justify-center">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                </div>
                <Card className="p-4 bg-chat-bot text-chat-bot-foreground">
                  <p className="text-sm">Thinking...</p>
                </Card>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Input
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            size="sm"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send • Powered by GPT
        </p>
      </div>
    </div>
  );
};