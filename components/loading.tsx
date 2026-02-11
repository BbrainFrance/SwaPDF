"use client";

import { Loader2 } from "lucide-react";

interface LoadingProps {
  message?: string;
  size?: "sm" | "md" | "lg";
}

export function Loading({
  message = "Traitement en cours...",
  size = "md",
}: LoadingProps) {
  const sizeClasses = {
    sm: "w-5 h-5",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <Loader2 className={`${sizeClasses[size]} text-primary-600 animate-spin`} />
      <p className="text-sm text-gray-500 font-medium">{message}</p>
    </div>
  );
}
