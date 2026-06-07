import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Send, Bot, User, RefreshCw, Copy, ThumbsUp, ThumbsDown,
  Lightbulb, TrendingUp, FileText, BarChart3, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const SUGGESTED_PROMPTS = [
  { icon: TrendingUp, text: "Show me revenue trends for Q1 2026", category: "Finance" },
  { icon: FileText, text: "Which invoices are overdue this month?", category: "Finance" },
  { icon: BarChart3, text: "What is our current stock coverage ratio?", category: "Inventory" },
  { icon: Lightbulb, text: "Summarise construction project health", category: "Construction" },
  { icon: TrendingUp, text: "Top 5 customers by revenue this year", category: "Sales" },
  { icon: BarChart3, text: "Show me VAT payable for current period", category: "Finance" },
];

const DEMO_RESPONSES: Record<string, string> = {
  default: `I can help you analyse data across all ERP modules — Finance, Sales, Purchase, Inventory, HR, Real Estate, and Construction.

Here are some things I can do:
• **Analyse trends** — revenue, expenses, stock levels, project progress
• **Generate summaries** — financial periods, project status, vendor performance
• **Answer queries** — outstanding invoices, reorder alerts, overdue payments
• **Create reports** — P&L, cash flow, BOQ completion, occupancy rates

What would you like to know?`,
  revenue: `**Q1 2026 Revenue Summary**

Total revenue this quarter reached **AED 18.4M**, up **12.3%** from Q4 2025.

| Month | Revenue | Growth |
|-------|---------|--------|
| January | AED 5.8M | +8.1% |
| February | AED 6.1M | +13.2% |
| March | AED 6.5M | +15.6% |

**Top performing categories:**
1. Software Licenses — AED 7.2M (39%)
2. Professional Services — AED 5.8M (32%)
3. Hardware — AED 3.4M (18%)

Would you like a detailed breakdown by customer or region?`,
  invoices: `**Overdue Invoices — May 2026**

Found **8 overdue invoices** totalling **AED 2,847,500**.

| Ref | Customer | Amount | Overdue By |
|-----|----------|--------|------------|
| INV-2026-0412 | Emaar Properties | AED 840,000 | 45 days |
| INV-2026-0389 | DAMAC Holdings | AED 620,000 | 32 days |
| INV-2026-0401 | Nakheel LLC | AED 480,000 | 28 days |
| + 5 more | ... | AED 907,500 | 7–21 days |

**Recommended action:** Send automated reminders to top 3 customers. Escalate Emaar invoice to collections.

Shall I draft the payment reminder emails?`,
  stock: `**Stock Coverage Analysis**

Current overall stock coverage: **18.4 days** (target: 21 days).

⚠️ **Critical items below reorder point (6 items):**
- Dell PowerEdge R750 — 0 units (out of stock)
- Cisco Catalyst 9300 — 2 units (reorder at 5)
- HP LaserJet Enterprise — 1 unit (reorder at 3)

✅ **Healthy stock items:** 47 items
📦 **Total inventory value:** AED 4.28M

Would you like me to generate purchase orders for the critical items?`,
};

function getResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("revenue") || lower.includes("q1")) return DEMO_RESPONSES.revenue;
  if (lower.includes("invoice") || lower.includes("overdue")) return DEMO_RESPONSES.invoices;
  if (lower.includes("stock") || lower.includes("inventory")) return DEMO_RESPONSES.stock;
  return DEMO_RESPONSES.default;
}

function TypingIndicator() {
  return (
    <div className="flex gap-1 items-center px-1">
      {[0, 1, 2].map(i => (
        <motion.span key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
      ))}
    </div>
  );
}

export function AIAssistantView() {
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: DEMO_RESPONSES.default,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = React.useState("");
  const [isTyping, setIsTyping] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = React.useCallback(async (text: string) => {
    if (!text.trim() || isTyping) return;
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
    const aiMsg: Message = {
      id: `a-${Date.now()}`,
      role: "assistant",
      content: getResponse(text),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages(prev => [...prev, aiMsg]);
    setIsTyping(false);
  }, [isTyping]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([{
      id: "welcome",
      role: "assistant",
      content: DEMO_RESPONSES.default,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-h-[900px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">AI Assistant</h1>
            <p className="text-xs text-muted-foreground">Powered by your ERP data</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={clearChat} className="gap-1.5 text-muted-foreground h-8">
          <RefreshCw className="h-3.5 w-3.5" />Clear
        </Button>
      </div>

      {/* Suggested prompts (shown when only welcome message) */}
      {messages.length === 1 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          {SUGGESTED_PROMPTS.map((p, i) => {
            const Icon = p.icon;
            return (
              <motion.button key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                onClick={() => sendMessage(p.text)}
                className="flex items-start gap-2.5 p-3 rounded-xl bg-card border border-border hover:border-primary/40 hover:bg-muted/30 text-left transition-all group">
                <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-medium leading-tight">{p.text}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{p.category}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "")}>
              <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                msg.role === "assistant" ? "bg-gradient-to-br from-primary to-purple-500" : "bg-muted")}>
                {msg.role === "assistant" ? <Sparkles className="h-4 w-4 text-white" /> : <User className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div className={cn("max-w-[78%]", msg.role === "user" ? "items-end" : "items-start", "flex flex-col gap-1")}>
                <div className={cn("rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-card border border-border rounded-tl-sm")}>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[10px] text-muted-foreground">{msg.timestamp}</span>
                  {msg.role === "assistant" && (
                    <>
                      <button className="text-muted-foreground hover:text-foreground transition-colors"><Copy className="h-3 w-3" /></button>
                      <button className="text-muted-foreground hover:text-success transition-colors"><ThumbsUp className="h-3 w-3" /></button>
                      <button className="text-muted-foreground hover:text-destructive transition-colors"><ThumbsDown className="h-3 w-3" /></button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isTyping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
              <TypingIndicator />
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-card border border-border rounded-2xl p-3 flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask anything about your business data…"
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground max-h-32"
          style={{ lineHeight: "1.5" }}
        />
        <Button onClick={() => sendMessage(input)} disabled={!input.trim() || isTyping}
          size="sm" className="h-8 w-8 p-0 rounded-xl shrink-0">
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
      <p className="text-center text-[10px] text-muted-foreground mt-2">
        AI responses are based on your ERP data. Always verify critical decisions.
      </p>
    </div>
  );
}

