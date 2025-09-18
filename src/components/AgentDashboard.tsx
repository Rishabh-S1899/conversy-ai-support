import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { 
  Shield, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  MessageSquare,
  Package,
  RefreshCw
} from 'lucide-react';

interface Escalation {
  id: number;
  session_id: string;
  order_id?: string;
  action_type: string;
  action_payload: any;
  conversation_context: any[];
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export const AgentDashboard: React.FC = () => {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [selectedEscalation, setSelectedEscalation] = useState<Escalation | null>(null);
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const authenticate = () => {
    if (password) {
      localStorage.setItem('agent_token', password);
      setIsAuthenticated(true);
      fetchEscalations();
    }
  };

  const fetchEscalations = async () => {
    const token = localStorage.getItem('agent_token');
    if (!token) return;

    try {
      const response = await fetch('/api/agent/pending', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          setIsAuthenticated(false);
          localStorage.removeItem('agent_token');
          return;
        }
        throw new Error('Failed to fetch escalations');
      }

      const data = await response.json();
      setEscalations(data);
    } catch (error) {
      console.error('Error fetching escalations:', error);
      toast({
        title: "Error",
        description: "Failed to load escalations",
        variant: "destructive",
      });
    }
  };

  const handleAction = async (escalationId: number, action: 'approve' | 'reject', notes?: string) => {
    const token = localStorage.getItem('agent_token');
    if (!token) return;

    setIsLoading(true);

    try {
      const response = await fetch('/api/agent/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          escalation_id: escalationId,
          action,
          agent_notes: notes,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process action');
      }

      const data = await response.json();

      toast({
        title: "Success",
        description: `Action ${action}d successfully`,
      });

      // Refresh escalations
      fetchEscalations();
      setSelectedEscalation(null);
    } catch (error) {
      console.error('Error processing action:', error);
      toast({
        title: "Error",
        description: "Failed to process action",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('agent_token');
    if (token) {
      setPassword(token);
      setIsAuthenticated(true);
      fetchEscalations();
    }
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="w-12 h-12 mx-auto mb-2 text-primary" />
            <CardTitle>Agent Access</CardTitle>
            <CardDescription>
              Enter your agent password to access the support dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && authenticate()}
                placeholder="Agent password"
              />
            </div>
            <Button onClick={authenticate} className="w-full">
              Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Support Agent Dashboard</h1>
            <p className="text-muted-foreground">Review and approve customer support actions</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchEscalations} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button 
              onClick={() => {
                setIsAuthenticated(false);
                localStorage.removeItem('agent_token');
              }}
              variant="ghost"
            >
              Logout
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending Escalations</p>
                  <p className="text-2xl font-bold">{escalations.filter(e => e.status === 'pending').length}</p>
                </div>
                <Clock className="w-8 h-8 text-warning" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Escalations</p>
                  <p className="text-2xl font-bold">{escalations.length}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Quick Actions</p>
                  <p className="text-sm text-muted-foreground">Review & Approve</p>
                </div>
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Escalations List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Pending Escalations
              </CardTitle>
              <CardDescription>
                Click on an escalation to review details and take action
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {escalations.filter(e => e.status === 'pending').map((escalation) => (
                    <Card 
                      key={escalation.id}
                      className={`p-4 cursor-pointer transition-colors ${
                        selectedEscalation?.id === escalation.id 
                          ? 'bg-accent' 
                          : 'hover:bg-accent/50'
                      }`}
                      onClick={() => setSelectedEscalation(escalation)}
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <Badge variant="outline">
                              {escalation.action_type.replace('_', ' ')}
                            </Badge>
                            {escalation.order_id && (
                              <Badge variant="secondary" className="ml-2">
                                {escalation.order_id}
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(escalation.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Session: {escalation.session_id.substring(0, 8)}...
                        </p>
                      </div>
                    </Card>
                  ))}
                  
                  {escalations.filter(e => e.status === 'pending').length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No pending escalations</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Escalation Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Escalation Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedEscalation ? (
                <div className="space-y-6">
                  {/* Action Summary */}
                  <div className="space-y-3">
                    <h3 className="font-semibold">Requested Action</h3>
                    <Card className="p-4 bg-warning-light">
                      <div className="space-y-2">
                        <Badge variant="outline">
                          {selectedEscalation.action_type.replace('_', ' ')}
                        </Badge>
                        <pre className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {JSON.stringify(selectedEscalation.action_payload, null, 2)}
                        </pre>
                      </div>
                    </Card>
                  </div>

                  {/* Conversation Context */}
                  <div className="space-y-3">
                    <h3 className="font-semibold">Conversation History</h3>
                    <ScrollArea className="h-48 border rounded-md p-3">
                      <div className="space-y-2">
                        {selectedEscalation.conversation_context.map((msg: any, index: number) => (
                          <div key={index} className={`text-sm p-2 rounded ${
                            msg.type === 'user' ? 'bg-chat-user text-chat-user-foreground' : 'bg-chat-bot text-chat-bot-foreground'
                          }`}>
                            <strong>{msg.type}:</strong> {msg.content}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleAction(selectedEscalation.id, 'approve')}
                      disabled={isLoading}
                      className="flex-1"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve & Execute
                    </Button>
                    <Button
                      onClick={() => handleAction(selectedEscalation.id, 'reject')}
                      disabled={isLoading}
                      variant="destructive"
                      className="flex-1"
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select an escalation to review details</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};