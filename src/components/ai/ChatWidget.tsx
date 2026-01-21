'use client';

// ============================================
// TSH Clients Console - AI Chat Widget
// Floating chat interface with Iraqi dialect support
// ============================================

import { useState, useRef, useEffect } from 'react';
import { Send, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface ProductAttachment {
  itemId: string;
  name: string;
  imageUrl: string;
  price?: number;
  stock?: number;
}

interface QuickReply {
  label: string;
  value: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  products?: ProductAttachment[];
  quickReplies?: QuickReply[];
}

// ============================================
// ChatWidget Component
// ============================================

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // Add welcome message when opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: 'هلا وغلا! 👋\nأنا المساعد الذكي حق TSH. شلون أساعدك اليوم؟',
          timestamp: Date.now(),
          quickReplies: [
            { label: 'ابي محول سريع', value: 'ابي محول سريع' },
            { label: 'شنو عندكم بطاريات؟', value: 'شنو عندكم من بطاريات؟' },
            { label: 'وريني جنط فونات', value: 'ابي جنطة للموبايل' },
          ],
        },
      ]);
    }
  }, [isOpen, messages.length]);

  const handleQuickReply = async (value: string) => {
    if (isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: value,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: value,
          sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      if (data.sessionId) {
        setSessionId(data.sessionId);
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message || 'عذراً، حصل خطأ. حاول مرة ثانية.',
        timestamp: Date.now(),
        products: data.products,
        quickReplies: data.quickReplies,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'آسف، صار مشكلة بالاتصال. حاول مرة ثانية. 🙏',
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageText = input;
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      if (data.sessionId) {
        setSessionId(data.sessionId);
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message || 'عذراً، حصل خطأ. حاول مرة ثانية.',
        timestamp: Date.now(),
        products: data.products,
        quickReplies: data.quickReplies,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'آسف، صار مشكلة بالاتصال. حاول مرة ثانية. 🙏',
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className={cn(
            'fixed bottom-6 right-6 z-50',
            'h-14 w-14 rounded-full shadow-lg',
            'bg-gradient-to-br from-gold to-amber-600',
            'hover:scale-110 transition-all duration-300',
            'hover:shadow-xl hover:shadow-gold/50',
            'group'
          )}
          aria-label="Open AI Assistant"
        >
          <Sparkles className="h-6 w-6 text-white group-hover:rotate-12 transition-transform" />
          <span className="sr-only">AI Assistant</span>
        </Button>
      )}

      {/* Chat Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className="max-w-md h-[600px] p-0 flex flex-col gap-0"
          dir="rtl"
        >
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-gold/10 to-amber-50 dark:from-gold/20 dark:to-amber-950">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-gold to-amber-600 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-right font-display text-lg">
                    المساعد الذكي
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground text-right">
                    مساعدك في TSH
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          {/* Messages */}
          <ScrollArea className="flex-1 px-6 py-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="space-y-2">
                  <div
                    className={cn(
                      'flex',
                      message.role === 'user' ? 'justify-start' : 'justify-end'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[80%] rounded-lg px-4 py-2.5',
                        'whitespace-pre-wrap break-words',
                        message.role === 'user'
                          ? 'bg-muted text-right'
                          : 'bg-gradient-to-br from-gold to-amber-600 text-white text-right'
                      )}
                    >
                      <p className="text-sm leading-relaxed">
                        {message.content}
                      </p>
                    </div>
                  </div>

                  {/* Product Images */}
                  {message.products && message.products.length > 0 && (
                    <div className="flex justify-end">
                      <div className="max-w-[80%] space-y-2">
                        {message.products.map((product) => (
                          <div
                            key={product.itemId}
                            className="bg-card border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                          >
                            {product.imageUrl && (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-32 object-contain bg-white"
                              />
                            )}
                            <div className="p-3 text-right">
                              <p className="font-medium text-sm">
                                {product.name}
                              </p>
                              {product.price && (
                                <p className="text-gold font-semibold text-xs mt-1">
                                  {product.price.toLocaleString('ar-IQ')} د.ع
                                </p>
                              )}
                              {product.stock !== undefined && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {product.stock > 0
                                    ? `متوفر ${product.stock}`
                                    : 'غير متوفر'}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Reply Buttons */}
                  {message.quickReplies && message.quickReplies.length > 0 && (
                    <div className="flex justify-end">
                      <div className="max-w-[80%] flex flex-wrap gap-2 justify-end">
                        {message.quickReplies.map((reply, idx) => (
                          <Button
                            key={idx}
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuickReply(reply.value)}
                            disabled={isLoading}
                            className="text-xs border-gold/50 hover:bg-gold/10 hover:border-gold"
                          >
                            {reply.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-lg px-4 py-2.5 bg-gradient-to-br from-gold to-amber-600">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-white/60 animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-2 h-2 rounded-full bg-white/60 animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-2 h-2 rounded-full bg-white/60 animate-bounce" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="px-6 py-4 border-t bg-background">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="اكتب رسالتك هنا..."
                disabled={isLoading}
                className="flex-1 text-right"
                dir="rtl"
              />
              <Button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                size="icon"
                className="bg-gradient-to-br from-gold to-amber-600 hover:from-gold/90 hover:to-amber-600/90"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              اكتب بالعراقي أو بالإنجليزي
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
