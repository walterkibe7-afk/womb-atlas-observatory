"use client";

import { X } from "lucide-react";
import { useChatStore } from "@/stores/chat-store";
import { ChatInterface } from "./ChatInterface";

export function ChatPanel() {
  const { isOpen, closeChat } = useChatStore();

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/40 z-40 transition-opacity"
          onClick={closeChat}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md z-50 bg-[var(--color-background)] border-l border-[var(--color-border)] shadow-2xl transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Close button */}
        <button
          onClick={closeChat}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-lg hover:bg-[var(--color-surface-hover)] text-muted hover:text-fg transition-colors"
        >
          <X size={18} />
        </button>

        {isOpen && <ChatInterface compact showHistory={false} />}
      </div>
    </>
  );
}
