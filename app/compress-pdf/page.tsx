"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Archive,
  Download,
  FileText,
  Settings,
  Zap,
  Check,
  RotateCcw,
  Loader2,
  ArrowDown,
  Sparkles,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFDocument } from "pdf-lib";
import { saveAs } from "file-saver";
import { FileUpload } from "@/components/file-upload";
import { Loading } from "@/components/loading";

// ─── Types ────────────────────────────────────────────────────────────────────

type CompressionLevel = "light" | "recommended" | "maximum";

interface CompressionPreset {
  label: string;
  description: string;
  scale: number;
  quality: number;
  icon: React.ReactNode;
  badge?: string;
}

// ─── Presets ──────────────────────────────────────────────────────────────────

const COMPRESSION_PRESETS: Record<CompressionLevel, CompressionPreset> = {
  light: {
    label: "Légère",
    description: "Faible réduction — qualité préservée",
    scale: 1.5,
    quality: 0.8,
    icon: <Archive className="w-5 h-5" />,
  },
  recommended: {
    label: "Recommandée",
    description: "Bon équilibre taille / qualité",
    scale: 1.2,
    quality: 0.6,
    icon: <Zap className="w-5 h-5" />,
    badge: "Recommandé",
  },
  maximum: {
    label: "Maximale",
    description: "Compression maximale — taille minimale",
    scale: 1.0,
    quality: 0.4,
    icon: <ArrowDown className="w-5 h-5" />,
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function CompressPdfPage() {
  // File state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);

  // Settings state
  const [compressionLevel, setCompressionLevel] =
    useState<CompressionLevel>("recommended");

  // Results state
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [compressedSize, setCompressedSize] = useState(0);
  const [originalSize, setOriginalSize] = useState(0);

  // Refs
  const resultsRef = useRef<HTMLDivElement>(null);

  // ─── Initialize PDF.js worker ─────────────────────────────────────────────

  useEffect(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }, []);

  // ─── Format file size ───────────────────────────────────────────────────────

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / 1024 / 1024).toFixed(2)} Mo`;
  };

  // ─── Compression percentage ─────────────────────────────────────────────────

  const getReductionPercentage = (): number => {
    if (originalSize === 0 || compressedSize === 0) return 0;
    return Math.round(((originalSize - compressedSize) / originalSize) * 100);
  };

  // ─── Compress PDF ──────────────────────────────────────────────────────────

  const compressPdf = useCallback(async () => {
    if (!pdfFile) return;

    setIsCompressing(true);
    setCompressionProgress(0);
    setCurrentPage(0);
    setCompressedBlob(null);
    setCompressedSize(0);
    setOriginalSize(pdfFile.size);

    const preset = COMPRESSION_PRESETS[compressionLevel];

    try {
      // 1. Load PDF with pdfjs-dist
      const arrayBuffer = await pdfFile.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;
      setTotalPages(numPages);

      // 2. Create new PDF with pdf-lib
      const newPdfDoc = await PDFDocument.create();

      for (let i = 1; i <= numPages; i++) {
        setCurrentPage(i);
        setCompressionProgress(Math.round(((i - 1) / numPages) * 100));

        // Render page to canvas
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: preset.scale });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d")!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // White background for JPEG
        context.fillStyle = "#FFFFFF";
        context.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: context, viewport }).promise;

        // Export as JPEG dataURL at chosen quality
        const jpegDataUrl = canvas.toDataURL("image/jpeg", preset.quality);

        // Convert dataURL to Uint8Array
        const jpegResponse = await fetch(jpegDataUrl);
        const jpegArrayBuffer = await jpegResponse.arrayBuffer();
        const jpegBytes = new Uint8Array(jpegArrayBuffer);

        // Embed JPEG into new PDF
        const jpegImage = await newPdfDoc.embedJpg(jpegBytes);
        const newPage = newPdfDoc.addPage([viewport.width, viewport.height]);
        newPage.drawImage(jpegImage, {
          x: 0,
          y: 0,
          width: viewport.width,
          height: viewport.height,
        });
      }

      // 3. Save new PDF
      const pdfBytes = await newPdfDoc.save();
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], {
        type: "application/pdf",
      });

      setCompressedBlob(blob);
      setCompressedSize(blob.size);
      setCompressionProgress(100);

      // 4. Track document usage
      try {
        await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: pdfFile.name.replace(/\.pdf$/i, "") + "_compressed.pdf",
            originalName: pdfFile.name,
            type: "pdf",
            action: "compress",
            size: blob.size,
          }),
        });
      } catch {
        // Silently ignore tracking errors
      }

      // Scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 300);
    } catch (error) {
      console.error("Erreur lors de la compression :", error);
    } finally {
      setIsCompressing(false);
    }
  }, [pdfFile, compressionLevel]);

  // ─── Download compressed PDF ────────────────────────────────────────────────

  const downloadCompressedPdf = useCallback(() => {
    if (!compressedBlob || !pdfFile) return;

    const baseName = pdfFile.name.replace(/\.pdf$/i, "");
    const fileName = `${baseName}_compressé.pdf`;
    saveAs(compressedBlob, fileName);
  }, [compressedBlob, pdfFile]);

  // ─── Handle file upload ─────────────────────────────────────────────────────

  const handleFileSelected = useCallback((files: File[]) => {
    if (files.length === 0) return;
    setPdfFile(files[0]);
    setCompressedBlob(null);
    setCompressedSize(0);
    setOriginalSize(0);
    setCompressionProgress(0);
    setTotalPages(0);
  }, []);

  // ─── Reset ──────────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setPdfFile(null);
    setCompressedBlob(null);
    setCompressedSize(0);
    setOriginalSize(0);
    setCompressionProgress(0);
    setTotalPages(0);
    setCurrentPage(0);
    setIsCompressing(false);
  }, []);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in min-h-screen">
      {/* Header */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-bg opacity-5" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center">
                  <Archive className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    Compresser PDF
                  </h1>
                  <p className="text-gray-500 mt-1">
                    Réduisez la taille de vos fichiers PDF sans perdre en
                    lisibilité
                  </p>
                </div>
              </div>
            </div>

            {pdfFile && (
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleReset}
                  className="btn-secondary flex items-center space-x-2 !py-2.5 !px-4"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Nouveau fichier</span>
                </button>
                {compressedBlob && (
                  <button
                    onClick={downloadCompressedPdf}
                    className="btn-primary flex items-center space-x-2 !py-2.5 !px-4"
                  >
                    <Download className="w-4 h-4" />
                    <span>Télécharger</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {/* Upload Area */}
        {!pdfFile && !isCompressing && (
          <div className="animate-slide-up max-w-2xl mx-auto">
            <div className="card p-8">
              <FileUpload
                accept=".pdf,application/pdf"
                onFilesSelected={handleFileSelected}
                label="Glissez votre fichier PDF ici"
                description="ou cliquez pour parcourir vos fichiers"
                icon="pdf"
              />
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
              <div className="card p-5 text-center">
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mx-auto mb-3">
                  <Archive className="w-5 h-5 text-orange-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Compression intelligente
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Réduisez vos PDF jusqu&apos;à 80% de leur taille originale
                </p>
              </div>
              <div className="card p-5 text-center">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                  <Settings className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">
                  3 niveaux de qualité
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Choisissez le niveau de compression adapté à vos besoins
                </p>
              </div>
              <div className="card p-5 text-center">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center mx-auto mb-3">
                  <Zap className="w-5 h-5 text-purple-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">
                  100% dans le navigateur
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Vos fichiers ne quittent jamais votre appareil
                </p>
              </div>
            </div>
          </div>
        )}

        {/* File selected — Settings & Compress */}
        {pdfFile && !compressedBlob && !isCompressing && (
          <div className="animate-slide-up max-w-2xl mx-auto space-y-6">
            {/* File info */}
            <div className="card p-6">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-7 h-7 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {pdfFile.name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Taille originale :{" "}
                    <span className="font-semibold text-gray-700">
                      {formatFileSize(pdfFile.size)}
                    </span>
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm font-medium text-emerald-600">
                    Prêt
                  </span>
                </div>
              </div>
            </div>

            {/* Compression level selector */}
            <div className="card overflow-hidden">
              <div className="flex items-center space-x-3 px-6 py-4 border-b border-gray-100">
                <Settings className="w-5 h-5 text-gray-500" />
                <span className="text-base font-semibold text-gray-900">
                  Niveau de compression
                </span>
              </div>

              <div className="p-6 space-y-3">
                {(
                  Object.entries(COMPRESSION_PRESETS) as [
                    CompressionLevel,
                    CompressionPreset,
                  ][]
                ).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => setCompressionLevel(key)}
                    className={`w-full flex items-center justify-between px-4 py-4 rounded-xl border-2 transition-all ${
                      compressionLevel === key
                        ? "border-primary-500 bg-primary-50/60 shadow-sm shadow-primary-500/10"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          compressionLevel === key
                            ? "bg-primary-100 text-primary-600"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {preset.icon}
                      </div>
                      <div className="text-left">
                        <p
                          className={`text-sm font-semibold ${
                            compressionLevel === key
                              ? "text-primary-700"
                              : "text-gray-900"
                          }`}
                        >
                          {preset.label}
                        </p>
                        <p className="text-xs text-gray-500">
                          {preset.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      {preset.badge && (
                        <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                          {preset.badge}
                        </span>
                      )}
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          compressionLevel === key
                            ? "border-primary-600"
                            : "border-gray-300"
                        }`}
                      >
                        {compressionLevel === key && (
                          <div className="w-2.5 h-2.5 rounded-full bg-primary-600" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Compress button */}
            <button
              onClick={compressPdf}
              className="btn-primary w-full flex items-center justify-center space-x-3 !py-4 text-base"
            >
              <Sparkles className="w-5 h-5" />
              <span>
                Compresser le PDF — {COMPRESSION_PRESETS[compressionLevel].label}
              </span>
            </button>
          </div>
        )}

        {/* Compression progress */}
        {isCompressing && (
          <div className="animate-fade-in max-w-2xl mx-auto">
            <div className="card p-8">
              <div className="flex flex-col items-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                </div>

                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Compression en cours...
                  </h3>
                  <p className="text-sm text-gray-500">
                    Page {currentPage} sur {totalPages || "..."}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="w-full">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500">
                      Progression
                    </span>
                    <span className="text-xs font-bold text-primary-600">
                      {compressionProgress}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${compressionProgress}%` }}
                    />
                  </div>
                </div>

                <p className="text-xs text-gray-400">
                  Niveau :{" "}
                  {COMPRESSION_PRESETS[compressionLevel].label} • Qualité JPEG :{" "}
                  {Math.round(
                    COMPRESSION_PRESETS[compressionLevel].quality * 100
                  )}
                  %
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {compressedBlob && !isCompressing && (
          <div ref={resultsRef} className="animate-slide-up max-w-2xl mx-auto space-y-6">
            {/* Success card */}
            <div className="card p-6">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                  <Check className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Compression terminée !
                  </h3>
                  <p className="text-sm text-gray-500">
                    {totalPages} page{totalPages > 1 ? "s" : ""} traitée
                    {totalPages > 1 ? "s" : ""} — Niveau{" "}
                    {COMPRESSION_PRESETS[compressionLevel].label.toLowerCase()}
                  </p>
                </div>
              </div>

              {/* Before / After comparison */}
              <div className="bg-gray-50 rounded-2xl p-5 space-y-4">
                {/* Original */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-red-500" />
                    </div>
                    <span className="text-sm text-gray-600">
                      Fichier original
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatFileSize(originalSize)}
                  </span>
                </div>

                {/* Arrow */}
                <div className="flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <ArrowDown className="w-4 h-4 text-primary-600" />
                  </div>
                </div>

                {/* Compressed */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <Archive className="w-4 h-4 text-emerald-500" />
                    </div>
                    <span className="text-sm text-gray-600">
                      Fichier compressé
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600">
                    {formatFileSize(compressedSize)}
                  </span>
                </div>

                {/* Reduction percentage */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-center space-x-3">
                    {getReductionPercentage() > 0 ? (
                      <>
                        <div className="flex items-center space-x-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl">
                          <Zap className="w-4 h-4" />
                          <span className="text-sm font-bold">
                            -{getReductionPercentage()}% de réduction
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {formatFileSize(originalSize - compressedSize)}{" "}
                          économisés
                        </span>
                      </>
                    ) : (
                      <div className="flex items-center space-x-2 bg-amber-100 text-amber-700 px-4 py-2 rounded-xl">
                        <span className="text-sm font-medium">
                          Le fichier est déjà optimisé
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Download card */}
            <div className="card p-5">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                    <Download className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Télécharger le PDF compressé
                    </p>
                    <p className="text-xs text-gray-500">
                      {pdfFile?.name.replace(/\.pdf$/i, "")}_compressé.pdf •{" "}
                      {formatFileSize(compressedSize)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={downloadCompressedPdf}
                  className="btn-primary flex items-center space-x-2 !py-2.5 !px-5"
                >
                  <Download className="w-4 h-4" />
                  <span>Télécharger</span>
                </button>
              </div>
            </div>

            {/* Compress another button */}
            <button
              onClick={handleReset}
              className="btn-secondary w-full flex items-center justify-center space-x-2 !py-3"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Compresser un autre fichier</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
