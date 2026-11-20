"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { CreateUserModal } from "./CreateUserModal";

export function CreateUserButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg"
      >
        <UserPlus size={16} />
        <span>Create User</span>
      </button>

      <CreateUserModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
