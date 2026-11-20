"use client";

import { useState } from "react";
import { X, FileJson } from "lucide-react";

interface AuditDataModalProps {
  dataBefore: any;
  dataAfter: any;
}

export function AuditDataModal({ dataBefore, dataAfter }: AuditDataModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  const hasData = dataBefore || dataAfter;

  if (!hasData) {
    return <span className="text-gray-500 text-xs">No data</span>;
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors bg-blue-900/20 px-2 py-1 rounded"
      >
        <FileJson size={14} />
        <span>View Data</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl bg-[#0F0C16] border border-[#2A1F36] rounded-2xl shadow-2xl overflow-hidden relative flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-4 border-b border-[#2A1F36]">
              <h2 className="text-lg font-serif text-white flex items-center space-x-2">
                <FileJson size={18} className="text-blue-400" />
                <span>Audit Log Details</span>
              </h2>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 flex flex-col md:flex-row gap-6">
              {dataBefore && (
                <div className="flex-1 border border-[#3A2B4A] rounded-xl overflow-hidden bg-[#15101E]">
                  <div className="bg-[#1A1325] p-3 border-b border-[#3A2B4A]">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Before</span>
                  </div>
                  <pre className="p-4 text-xs font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(dataBefore, null, 2)}
                  </pre>
                </div>
              )}
              
              {dataAfter && (
                <div className="flex-1 border border-[#3A2B4A] rounded-xl overflow-hidden bg-[#15101E]">
                  <div className="bg-[#1A1325] p-3 border-b border-[#3A2B4A]">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">After</span>
                  </div>
                  <pre className="p-4 text-xs font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(dataAfter, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-[#2A1F36] flex justify-end">
              <button 
                onClick={() => setIsOpen(false)}
                className="bg-[#2A1F36] hover:bg-[#3A2B4A] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
