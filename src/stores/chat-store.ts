import { create } from "zustand";

interface ChatStore {
  isOpen: boolean;
  activeConversationId: string | null;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  setActiveConversation: (id: string | null) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  isOpen: false,
  activeConversationId: null,
  openChat: () => set({ isOpen: true }),
  closeChat: () => set({ isOpen: false }),
  toggleChat: () => set((s) => ({ isOpen: !s.isOpen })),
  setActiveConversation: (id) => set({ activeConversationId: id }),
}));
