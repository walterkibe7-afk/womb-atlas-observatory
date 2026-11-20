"use client";

import { useState } from "react";
import { updateUserRole } from "@/actions/admin";
import { Loader2 } from "lucide-react";

interface EditRoleDropdownProps {
  userId: string;
  currentRole: string;
}

export function EditRoleDropdown({ userId, currentRole }: EditRoleDropdownProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [role, setRole] = useState(currentRole);

  const handleRoleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value;
    setIsUpdating(true);
    setRole(newRole); // Optimistic update
    
    const result = await updateUserRole(userId, newRole);
    
    if (!result.success) {
      alert(result.error || "Failed to update role");
      setRole(currentRole); // Revert on failure
    }
    
    setIsUpdating(false);
  };

  return (
    <div className="relative inline-block text-left">
      {isUpdating && (
        <div className="absolute -left-6 top-1/2 -translate-y-1/2">
          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
        </div>
      )}
      <select
        value={role}
        onChange={handleRoleChange}
        disabled={isUpdating}
        className="bg-[#1C1525] border border-[#3A2B4A] text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500 disabled:opacity-50 appearance-none cursor-pointer"
      >
        <option value="participant">Participant</option>
        <option value="steward">Steward</option>
        <option value="analyst">Analyst</option>
        <option value="admin">Administrator</option>
      </select>
    </div>
  );
}
