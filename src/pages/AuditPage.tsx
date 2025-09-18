import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Shield, FileText, Search, RefreshCw } from 'lucide-react';

interface AuditLog {
  id: number;
  session_id: string;
  masked_user_email: string;
  messages: any[];
  llm_response_json: any;
  action_suggested: any;
  agent_decision: any;
  created_at: string;
}

const AuditPage = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const authenticate = () => {
    if (password) {
      fetchAuditLogs(password);
    }
  };

  const fetchAuditLogs = async (authPassword?: string) => {
    const pwd = authPassword || password;
    
    try {
      const response = await fetch(`/admin/audit?password=${encodeURIComponent(pwd)}`);
      
      if (!response.ok) {
        if (response.status === 401) {
          setIsAuthenticated(false);
          toast({
            title: "Access Denied",
            description: "Invalid password",
            variant: "destructive",
          });
          return;
        }
        throw new Error('Failed to fetch audit logs');
      }

      const data = await response.json();
      setLogs(data);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast({
        title: "Error",
        description: "Failed to load audit logs",
        variant: "destructive",
      });
    }
  };

  const filteredLogs = logs.filter(log => 
    !searchTerm || 
    log.session_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.masked_user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    JSON.stringify(log.messages).toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="w-12 h-12 mx-auto mb-2 text-primary" />
            <CardTitle>Audit Access</CardTitle>
            <CardDescription>
              Enter admin password to view audit logs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="password">Admin Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && authenticate()}
                placeholder="Admin password"
              />
            </div>
            <Button onClick={authenticate} className="w-full">
              Access Audit Logs
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
            <h1 className="text-3xl font-bold">Audit Logs</h1>
            <p className="text-muted-foreground">Customer support conversation history and actions</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => fetchAuditLogs()} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button 
              onClick={() => setIsAuthenticated(false)}
              variant="ghost"
            >
              Logout
            </Button>
          </div>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Search className="w-5 h-5 mt-2 text-muted-foreground" />
              <Input
                placeholder="Search logs by session ID, email, or message content..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Conversations</p>
                  <p className="text-2xl font-bold">{logs.length}</p>
                </div>
                <FileText className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">With Actions</p>
                  <p className="text-2xl font-bold">{logs.filter(l => l.action_suggested).length}</p>
                </div>
                <Shield className="w-8 h-8 text-warning" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Agent Reviewed</p>
                  <p className="text-2xl font-bold">{logs.filter(l => l.agent_decision).length}</p>
                </div>
                <Badge className="w-8 h-8 text-success" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Logs List */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Conversations ({filteredLogs.length})</CardTitle>
            <CardDescription>
              Last 50 support conversations with full audit trail
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {filteredLogs.map((log) => (
                  <Card key={log.id} className="p-4">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex gap-2">
                            <Badge variant="outline">
                              {log.session_id.substring(0, 8)}...
                            </Badge>
                            {log.masked_user_email && (
                              <Badge variant="secondary">
                                {log.masked_user_email}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(log.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          {log.action_suggested && (
                            <Badge variant="destructive">Action Suggested</Badge>
                          )}
                          {log.agent_decision && (
                            <Badge variant="default">Agent Reviewed</Badge>
                          )}
                        </div>
                      </div>

                      {/* Messages */}
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Messages:</h4>
                        <div className="bg-muted rounded-md p-3 text-sm">
                          {log.messages.map((msg, index) => (
                            <div key={index} className="mb-2 last:mb-0">
                              <strong>{msg.role === 'user' ? 'Customer' : 'Bot'}:</strong> {msg.content}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* LLM Response */}
                      {log.llm_response_json && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">AI Analysis:</h4>
                          <div className="bg-primary-light rounded-md p-3 text-sm">
                            <div className="flex gap-2 mb-2">
                              <Badge variant="outline">
                                Intent: {log.llm_response_json.intent}
                              </Badge>
                              <Badge variant="outline">
                                Confidence: {Math.round((log.llm_response_json.confidence || 0) * 100)}%
                              </Badge>
                            </div>
                            <p>{log.llm_response_json.response_text}</p>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      {log.action_suggested && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Suggested Action:</h4>
                          <div className="bg-warning-light rounded-md p-3 text-sm">
                            <pre>{JSON.stringify(log.action_suggested, null, 2)}</pre>
                          </div>
                        </div>
                      )}

                      {/* Agent Decision */}
                      {log.agent_decision && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Agent Decision:</h4>
                          <div className="bg-success-light rounded-md p-3 text-sm">
                            <pre>{JSON.stringify(log.agent_decision, null, 2)}</pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}

                {filteredLogs.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No audit logs found</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuditPage;