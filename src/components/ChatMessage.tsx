import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Bot, User, AlertTriangle, CheckCircle } from 'lucide-react';

interface ChatMessageProps {
  message: {
    id: string;
    type: 'user' | 'bot' | 'system';
    content: string;
    timestamp: Date;
    confidence?: number;
    intent?: string;
    actions?: Array<{type: string; [key: string]: any}>;
    kb_matches?: Array<{title: string; content: string}>;
  };
  onActionRequest?: (action: any) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onActionRequest }) => {
  const isUser = message.type === 'user';
  const isSystem = message.type === 'system';

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-3`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-chat-user text-chat-user-foreground' : 
          isSystem ? 'bg-chat-system text-chat-system-foreground' :
          'bg-chat-bot text-chat-bot-foreground'
        }`}>
          {isUser ? (
            <User className="w-4 h-4" />
          ) : (
            <Bot className="w-4 h-4" />
          )}
        </div>

        {/* Message Content */}
        <Card className={`p-4 ${
          isUser ? 'bg-chat-user text-chat-user-foreground' : 
          isSystem ? 'bg-chat-system text-chat-system-foreground' :
          'bg-chat-bot text-chat-bot-foreground'
        } shadow-chat`}>
          <div className="space-y-3">
            {/* Main message */}
            <p className="text-sm leading-relaxed">{message.content}</p>

            {/* Bot-specific metadata */}
            {!isUser && !isSystem && (
              <div className="space-y-2">
                {/* Confidence and intent */}
                {(message.confidence !== undefined || message.intent) && (
                  <div className="flex gap-2 text-xs">
                    {message.confidence !== undefined && (
                      <Badge variant={message.confidence > 0.7 ? "default" : "secondary"}>
                        {Math.round(message.confidence * 100)}% confident
                      </Badge>
                    )}
                    {message.intent && (
                      <Badge variant="outline">
                        {message.intent}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Knowledge base citations */}
                {message.kb_matches && message.kb_matches.length > 0 && (
                  <div className="text-xs space-y-1 border-t border-border/20 pt-2">
                    <p className="font-medium text-muted-foreground">Sources:</p>
                    {message.kb_matches.map((match, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {match.title}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Actions */}
                {message.actions && message.actions.some(action => action.type !== 'none') && (
                  <div className="space-y-2 border-t border-border/20 pt-2">
                    {message.actions.map((action, index) => {
                      if (action.type === 'none') return null;
                      
                      return (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => onActionRequest?.(action)}
                        >
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Request Action: {action.type.replace('_', ' ')}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Timestamp */}
            <div className="text-xs text-muted-foreground">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};