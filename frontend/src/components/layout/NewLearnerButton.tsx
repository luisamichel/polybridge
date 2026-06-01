"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { deleteReset } from "@/lib/api"; // Adjust import path if needed

export default function NewLearnerButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  // We need to ensure this only renders on the client to avoid hydration errors with portals
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleReset = async () => {
    setIsDeleting(true);
    try {
      await deleteReset();
      window.dispatchEvent(new Event("profileUpdated"));
      setIsOpen(false);
      
      router.push("/");
      alert("Ready for a new learner!"); 
    } catch (error) {
      console.error(error);
      alert("Failed to reset data. Check console.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {/* Subtle Header Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-md px-3 py-1.5 text-sm font-medium text-[#5c5346] transition-all duration-200 hover:bg-[#ddd4c0]"
      >
        New Learner
      </button>

      {/* Confirmation Modal - Portaled directly to document.body */}
      {mounted && isOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-[#d4cbb8] bg-[#fdfaf5] p-6 shadow-xl">
            <h2 className="mb-2 text-xl font-semibold text-[#2a2218]">
              Start fresh?
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-[#5c5346]">
              Confirm if you want to try a new profile
            </p>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsOpen(false)}
                disabled={isDeleting}
                className="rounded-md px-4 py-2 text-sm font-medium text-[#5c5346] transition-colors hover:bg-[#ddd4c0]"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={isDeleting}
                className="rounded-md bg-red-500/90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
              >
                {isDeleting ? "Clearing..." : "Yes, clear data"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}