import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect, useCallback } from "react";
import { FileText, Send, Bot, User, CheckCircle, XCircle, Star } from "lucide-react";

export interface DemoMessage {
  role: "system" | "user" | "assistant" | "score";
  text: string;
  citation?: string;
  scoreValue?: string;
  delay: number;
}

interface FeatureDemoProps {
  title: string;
  messages: DemoMessage[];
  placeholder?: string;
}

export default function FeatureDemo({ title, messages, placeholder = "Type a message..." }: FeatureDemoProps) {
  const [visibleMessages, setVisibleMessages] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingIndex, setTypingIndex] = useState(-1);

  const reset = useCallback(() => {
    setVisibleMessages(0);
    setTypedText("");
    setIsTyping(false);
    setTypingIndex(-1);
  }, []);

  // Reset when messages change (tab switch)
  useEffect(() => {
    reset();
  }, [messages, reset]);

  // Sequencing engine
  useEffect(() => {
    if (visibleMessages >= messages.length || isTyping) return;

    const msg = messages[visibleMessages];

    // Calculate delay — first message gets its own delay, rest are cumulative gaps
    const delay = visibleMessages === 0 ? msg.delay : msg.delay;

    const timer = setTimeout(() => {
      if (msg.role === "assistant") {
        setIsTyping(true);
        setTypingIndex(visibleMessages);
        setTypedText("");
        let i = 0;
        const typeTimer = setInterval(() => {
          if (i < msg.text.length) {
            setTypedText(msg.text.slice(0, i + 1));
            i++;
          } else {
            clearInterval(typeTimer);
            setIsTyping(false);
            setTypingIndex(-1);
            setVisibleMessages((v) => v + 1);
          }
        }, 14);
        return () => clearInterval(typeTimer);
      } else {
        setVisibleMessages((v) => v + 1);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [visibleMessages, isTyping, messages]);

  // Restart loop
  useEffect(() => {
    if (visibleMessages >= messages.length && !isTyping) {
      const timer = setTimeout(reset, 4000);
      return () => clearTimeout(timer);
    }
  }, [visibleMessages, isTyping, messages.length, reset]);

  return (
    <div className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-md shadow-2xl shadow-black/5 dark:shadow-black/30 overflow-hidden">
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-muted/30">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400/60" />
          <div className="w-3 h-3 rounded-full bg-yellow-400/60" />
          <div className="w-3 h-3 rounded-full bg-green-400/60" />
        </div>
        <span className="text-xs text-muted-foreground/60 ml-2 font-mono">
          {title}
        </span>
      </div>

      {/* Chat area */}
      <div className="p-4 space-y-3 min-h-[240px] max-h-[320px] overflow-hidden">
        <AnimatePresence mode="popLayout">
          {messages.slice(0, visibleMessages).map((msg, i) => (
            <MessageBubble key={`${title}-${i}`} msg={msg} />
          ))}

          {/* Currently typing */}
          {isTyping && typingIndex >= 0 && (
            <motion.div
              key={`${title}-typing`}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
              className="flex items-start gap-2"
            >
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="space-y-1.5 max-w-[85%]">
                <div className="bg-muted/60 rounded-2xl rounded-tl-sm px-3.5 py-2 text-sm">
                  {typedText}
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className="inline-block w-[2px] h-4 bg-foreground/60 ml-0.5 align-text-bottom"
                  />
                </div>
                {messages[typingIndex].citation && typedText.length === messages[typingIndex].text.length && (
                  <span className="text-[10px] text-muted-foreground/50 font-mono px-1">
                    {messages[typingIndex].citation}
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input bar */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/50 px-3 py-2">
          <span className="text-sm text-muted-foreground/40 flex-1">
            {placeholder}
          </span>
          <Send className="h-4 w-4 text-muted-foreground/30" />
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: DemoMessage }) {
  if (msg.role === "system") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex items-center gap-2 justify-center py-1"
      >
        <FileText className="h-3 w-3 text-green-500" />
        <span className="text-xs text-muted-foreground/70 font-mono">
          {msg.text}
        </span>
      </motion.div>
    );
  }

  if (msg.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25 }}
        className="flex items-start gap-2 justify-end"
      >
        <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-3.5 py-2 text-sm max-w-[85%]">
          {msg.text}
        </div>
        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </motion.div>
    );
  }

  if (msg.role === "score") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex items-start gap-2"
      >
        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Star className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="max-w-[85%] space-y-1">
          <div className="bg-muted/60 rounded-2xl rounded-tl-sm px-3.5 py-2 text-sm">
            {msg.text}
          </div>
          {msg.scoreValue && (
            <div className="flex items-center gap-1 px-1">
              <span className="text-[10px] font-mono text-muted-foreground/50">
                Score: {msg.scoreValue}
              </span>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // assistant — completed (not currently typing)
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className="flex items-start gap-2"
    >
      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Bot className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="space-y-1.5 max-w-[85%]">
        <div className="bg-muted/60 rounded-2xl rounded-tl-sm px-3.5 py-2 text-sm">
          {msg.text}
        </div>
        {msg.citation && (
          <span className="text-[10px] text-muted-foreground/50 font-mono px-1">
            {msg.citation}
          </span>
        )}
      </div>
    </motion.div>
  );
}
