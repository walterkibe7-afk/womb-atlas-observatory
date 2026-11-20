"use client";

import { useState } from "react";
import { X, UserPlus, Loader2 } from "lucide-react";
import { createUser } from "@/actions/admin";
import { useRouter } from "next/navigation";

export function CreateUserModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("participant");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await createUser({
        email,
        name,
        password: password || undefined,
        role
      });

      if (!result.success) {
        setError(result.error || "Failed to create user");
        setIsLoading(false);
      } else {
        // Reset and close
        setEmail("");
        setName("");
        setPassword("");
        setRole("participant");
        setIsLoading(false);
        onClose();
        router.refresh(); // Refresh the page to show the new user
      }
    } catch (err) {
      setError("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0F0C16] border border-[#2A1F36] rounded-2xl shadow-2xl overflow-hidden relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-blue-900/30 border border-blue-900 flex items-center justify-center text-blue-400">
              <UserPlus size={18} />
            </div>
            <div>
              <h2 className="text-xl font-serif text-white">Create User</h2>
              <p className="text-xs text-gray-400">Add a new admin, steward or participant</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-900/20 border border-red-900 rounded-xl text-red-400 text-xs text-center">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Full Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                required
                className="w-full bg-[#1C1525] border border-[#2A1F36] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                required
                className="w-full bg-[#1C1525] border border-[#2A1F36] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Role</label>
              <select 
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-[#1C1525] border border-[#2A1F36] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors appearance-none"
              >
                <option value="participant">Participant</option>
                <option value="steward">Steward</option>
                <option value="admin">Administrator</option>
                <option value="analyst">Analyst</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Password (Leave blank for OAuth only)</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#1C1525] border border-[#2A1F36] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="pt-4 flex space-x-3">
              <button 
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl text-sm font-medium border border-[#2A1F36] text-gray-300 hover:text-white hover:border-[#3A2B4A] transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 px-4 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex justify-center items-center"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create User"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
