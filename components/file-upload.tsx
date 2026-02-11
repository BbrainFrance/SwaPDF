"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileText, Image, X, AlertCircle } from "lucide-react";

interface FileUploadProps {
  accept: string;
  multiple?: boolean;
  maxSize?: number; // in MB
  onFilesSelected: (files: File[]) => void;
  label?: string;
  description?: string;
  icon?: "pdf" | "image" | "any";
}

export function FileUpload({
  accept,
  multiple = false,
  maxSize = 50,
  onFilesSelected,
  label = "Glissez vos fichiers ici",
  description = "ou cliquez pour parcourir",
  icon = "any",
}: FileUploadProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFiles = useCallback(
    (files: File[]): File[] => {
      setError(null);
      const valid: File[] = [];

      for (const file of files) {
        if (file.size > maxSize * 1024 * 1024) {
          setError(
            `Le fichier "${file.name}" dépasse la taille maximale de ${maxSize} Mo`
          );
          continue;
        }
        valid.push(file);
      }

      return valid;
    },
    [maxSize]
  );

  const handleFiles = useCallback(
    (files: File[]) => {
      const valid = validateFiles(files);
      if (valid.length > 0) {
        setSelectedFiles((prev) => (multiple ? [...prev, ...valid] : valid));
        onFilesSelected(multiple ? [...selectedFiles, ...valid] : valid);
      }
    },
    [validateFiles, multiple, onFilesSelected, selectedFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragActive(false);
      const files = Array.from(e.dataTransfer.files);
      handleFiles(files);
    },
    [handleFiles]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const files = Array.from(e.target.files);
        handleFiles(files);
      }
    },
    [handleFiles]
  );

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    onFilesSelected(newFiles);
  };

  const IconComponent =
    icon === "pdf" ? FileText : icon === "image" ? Image : Upload;

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`drop-zone p-12 text-center ${isDragActive ? "drop-zone-active" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          className="hidden"
        />

        <div className="flex flex-col items-center space-y-4">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${
              isDragActive
                ? "bg-primary-100 text-primary-600"
                : "bg-gray-100 text-gray-400"
            }`}
          >
            <IconComponent className="w-8 h-8" />
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-700">{label}</p>
            <p className="text-sm text-gray-500 mt-1">{description}</p>
            <p className="text-xs text-gray-400 mt-2">
              Taille maximale : {maxSize} Mo
            </p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-3 flex items-center space-x-2 text-red-600 bg-red-50 px-4 py-3 rounded-xl">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Selected files */}
      {selectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <FileText className="w-5 h-5 text-primary-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {(file.size / 1024 / 1024).toFixed(2)} Mo
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(index);
                }}
                className="p-1.5 hover:bg-red-50 rounded-lg transition-colors group"
              >
                <X className="w-4 h-4 text-gray-400 group-hover:text-red-500" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
