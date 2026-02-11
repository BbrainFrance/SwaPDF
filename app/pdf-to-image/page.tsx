"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Image,
  Download,
  FileText,
  Settings,
  Package,
  Check,
  RotateCcw,
  ZoomIn,
  Loader2,
  ChevronDown,
  ImageIcon,
  Sparkles,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { FileUpload } from "@/components/file-upload";
import { Loading } from "@/components/loading";

// ─── Types ────────────────────────────────────────────────────────────────────

type OutputFormat = "jpg" | "png";
type DpiOption = 72 | 150 | 300;

interface ConvertedPage {
  pageNumber: number;
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PdfToImagePage() {
  // File state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentConvertingPage, setCurrentConvertingPage] = useState(0);

  // Settings state
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("jpg");
  const [dpi, setDpi] = useState<DpiOption>(150);
  const [showSettings, setShowSettings] = useState(true);

  // Results state
  const [convertedPages, setConvertedPages] = useState<ConvertedPage[]>([]);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  // Preview state
  const [previewPage, setPreviewPage] = useState<ConvertedPage | null>(null);

  // Refs
  const resultsRef = useRef<HTMLDivElement>(null);

  // ─── Initialize PDF.js worker ─────────────────────────────────────────────

  useEffect(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }, []);

  // ─── DPI to scale factor ──────────────────────────────────────────────────

  const dpiToScale = useCallback((selectedDpi: DpiOption): number => {
    // PDF default is 72 DPI, so scale = selectedDpi / 72
    return selectedDpi / 72;
  }, []);

  // ─── Convert PDF to images ────────────────────────────────────────────────

  const convertPdfToImages = useCallback(async () => {
    if (!pdfFile) return;

    setIsConverting(true);
    setConversionProgress(0);
    setCurrentConvertingPage(0);
    setConvertedPages([]);

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;
      setTotalPages(numPages);

      const scale = dpiToScale(dpi);
      const mimeType = outputFormat === "jpg" ? "image/jpeg" : "image/png";
      const quality = outputFormat === "jpg" ? 0.92 : undefined;
      const pages: ConvertedPage[] = [];

      for (let i = 1; i <= numPages; i++) {
        setCurrentConvertingPage(i);
        setConversionProgress(Math.round(((i - 1) / numPages) * 100));

        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d")!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // White background for JPG (transparency not supported)
        if (outputFormat === "jpg") {
          context.fillStyle = "#FFFFFF";
          context.fillRect(0, 0, canvas.width, canvas.height);
        }

        await page.render({ canvasContext: context, viewport }).promise;

        const dataUrl = canvas.toDataURL(mimeType, quality);

        // Convert dataUrl to Blob
        const response = await fetch(dataUrl);
        const blob = await response.blob();

        pages.push({
          pageNumber: i,
          dataUrl,
          blob,
          width: Math.round(viewport.width),
          height: Math.round(viewport.height),
        });
      }

      setConvertedPages(pages);
      setConversionProgress(100);

      // Scroll to results after a brief delay
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    } catch (error) {
      console.error("Erreur lors de la conversion :", error);
    } finally {
      setIsConverting(false);
    }
  }, [pdfFile, dpi, outputFormat, dpiToScale]);

  // ─── Download single page ────────────────────────────────────────────────

  const downloadSinglePage = useCallback(
    (page: ConvertedPage) => {
      const extension = outputFormat === "jpg" ? "jpg" : "png";
      const baseName = pdfFile
        ? pdfFile.name.replace(/\.pdf$/i, "")
        : "document";
      const fileName = `${baseName}_page_${page.pageNumber}.${extension}`;

      saveAs(page.blob, fileName);
    },
    [outputFormat, pdfFile]
  );

  // ─── Download all as ZIP ──────────────────────────────────────────────────

  const downloadAllAsZip = useCallback(async () => {
    if (convertedPages.length === 0) return;

    setIsDownloadingZip(true);

    try {
      const zip = new JSZip();
      const extension = outputFormat === "jpg" ? "jpg" : "png";
      const baseName = pdfFile
        ? pdfFile.name.replace(/\.pdf$/i, "")
        : "document";

      const folder = zip.folder(`${baseName}_images`);

      if (folder) {
        for (const page of convertedPages) {
          const fileName = `${baseName}_page_${page.pageNumber}.${extension}`;
          folder.file(fileName, page.blob);
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `${baseName}_images.zip`);
    } catch (error) {
      console.error("Erreur lors de la création du ZIP :", error);
    } finally {
      setIsDownloadingZip(false);
    }
  }, [convertedPages, outputFormat, pdfFile]);

  // ─── Handle file upload ───────────────────────────────────────────────────

  const handleFileSelected = useCallback((files: File[]) => {
    if (files.length === 0) return;
    setPdfFile(files[0]);
    setConvertedPages([]);
    setConversionProgress(0);
    setTotalPages(0);
    setPreviewPage(null);
  }, []);

  // ─── Reset ────────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setPdfFile(null);
    setConvertedPages([]);
    setConversionProgress(0);
    setTotalPages(0);
    setCurrentConvertingPage(0);
    setIsConverting(false);
    setPreviewPage(null);
  }, []);

  // ─── DPI label helper ─────────────────────────────────────────────────────

  const getDpiLabel = (value: DpiOption): string => {
    switch (value) {
      case 72:
        return "72 DPI — Écran (rapide)";
      case 150:
        return "150 DPI — Bonne qualité";
      case 300:
        return "300 DPI — Haute qualité (impression)";
    }
  };

  // ─── Format file size ─────────────────────────────────────────────────────

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / 1024 / 1024).toFixed(2)} Mo`;
  };

  // ─── Render ───────────────────────────────────────────────────────────────

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
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                  <Image className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    PDF vers Image
                  </h1>
                  <p className="text-gray-500 mt-1">
                    Convertissez chaque page de votre PDF en image JPG ou PNG de
                    haute qualité
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
                {convertedPages.length > 0 && (
                  <button
                    onClick={downloadAllAsZip}
                    disabled={isDownloadingZip}
                    className="btn-primary flex items-center space-x-2 !py-2.5 !px-4"
                  >
                    <Package className="w-4 h-4" />
                    <span>
                      {isDownloadingZip
                        ? "Création du ZIP..."
                        : "Télécharger tout (ZIP)"}
                    </span>
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
        {!pdfFile && !isConverting && (
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
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                  <ImageIcon className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">
                  JPG &amp; PNG
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Exportez vos pages en JPG ou PNG selon vos besoins
                </p>
              </div>
              <div className="card p-5 text-center">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                  <ZoomIn className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Qualité ajustable
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Choisissez la résolution : 72, 150 ou 300 DPI
                </p>
              </div>
              <div className="card p-5 text-center">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center mx-auto mb-3">
                  <Package className="w-5 h-5 text-purple-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Téléchargement ZIP
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Téléchargez toutes les pages dans une seule archive
                </p>
              </div>
            </div>
          </div>
        )}

        {/* File selected — Settings & Convert */}
        {pdfFile && convertedPages.length === 0 && !isConverting && (
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
                    {formatFileSize(pdfFile.size)}
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

            {/* Settings panel */}
            <div className="card overflow-hidden">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <Settings className="w-5 h-5 text-gray-500" />
                  <span className="text-base font-semibold text-gray-900">
                    Paramètres de conversion
                  </span>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                    showSettings ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showSettings && (
                <div className="px-6 pb-6 space-y-6 border-t border-gray-100 pt-5 animate-fade-in">
                  {/* Output format */}
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-3 block">
                      Format de sortie
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setOutputFormat("jpg")}
                        className={`relative flex items-center space-x-3 px-4 py-4 rounded-xl border-2 transition-all ${
                          outputFormat === "jpg"
                            ? "border-primary-500 bg-primary-50/60 shadow-sm shadow-primary-500/10"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        {outputFormat === "jpg" && (
                          <div className="absolute top-2.5 right-2.5 w-5 h-5 bg-primary-600 rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            outputFormat === "jpg"
                              ? "bg-primary-100 text-primary-600"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          <ImageIcon className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-gray-900">
                            JPG
                          </p>
                          <p className="text-xs text-gray-500">
                            Taille réduite, idéal pour le web
                          </p>
                        </div>
                      </button>

                      <button
                        onClick={() => setOutputFormat("png")}
                        className={`relative flex items-center space-x-3 px-4 py-4 rounded-xl border-2 transition-all ${
                          outputFormat === "png"
                            ? "border-primary-500 bg-primary-50/60 shadow-sm shadow-primary-500/10"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        {outputFormat === "png" && (
                          <div className="absolute top-2.5 right-2.5 w-5 h-5 bg-primary-600 rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            outputFormat === "png"
                              ? "bg-primary-100 text-primary-600"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          <Image className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-gray-900">
                            PNG
                          </p>
                          <p className="text-xs text-gray-500">
                            Sans perte, transparence possible
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* DPI / Quality */}
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-3 block">
                      Résolution (DPI)
                    </label>
                    <div className="space-y-2">
                      {([72, 150, 300] as DpiOption[]).map((option) => (
                        <button
                          key={option}
                          onClick={() => setDpi(option)}
                          className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-all ${
                            dpi === option
                              ? "border-primary-500 bg-primary-50/60 shadow-sm shadow-primary-500/10"
                              : "border-gray-200 hover:border-gray-300 bg-white"
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <div
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                                dpi === option
                                  ? "border-primary-600"
                                  : "border-gray-300"
                              }`}
                            >
                              {dpi === option && (
                                <div className="w-2 h-2 rounded-full bg-primary-600" />
                              )}
                            </div>
                            <span
                              className={`text-sm font-medium ${
                                dpi === option
                                  ? "text-primary-700"
                                  : "text-gray-700"
                              }`}
                            >
                              {getDpiLabel(option)}
                            </span>
                          </div>
                          {option === 150 && (
                            <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                              Recommandé
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Convert button */}
            <button
              onClick={convertPdfToImages}
              className="btn-primary w-full flex items-center justify-center space-x-3 !py-4 text-base"
            >
              <Sparkles className="w-5 h-5" />
              <span>
                Convertir en {outputFormat.toUpperCase()} ({dpi} DPI)
              </span>
            </button>
          </div>
        )}

        {/* Conversion progress */}
        {isConverting && (
          <div className="animate-fade-in max-w-2xl mx-auto">
            <div className="card p-8">
              <div className="flex flex-col items-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                </div>

                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Conversion en cours...
                  </h3>
                  <p className="text-sm text-gray-500">
                    Page {currentConvertingPage} sur {totalPages || "..."}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="w-full">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500">
                      Progression
                    </span>
                    <span className="text-xs font-bold text-primary-600">
                      {conversionProgress}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${conversionProgress}%` }}
                    />
                  </div>
                </div>

                <p className="text-xs text-gray-400">
                  Format : {outputFormat.toUpperCase()} • Résolution : {dpi} DPI
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {convertedPages.length > 0 && !isConverting && (
          <div ref={resultsRef} className="animate-slide-up space-y-6">
            {/* Results header */}
            <div className="card p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                    <Check className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Conversion terminée !
                    </h3>
                    <p className="text-sm text-gray-500">
                      {convertedPages.length} page
                      {convertedPages.length > 1 ? "s" : ""} convertie
                      {convertedPages.length > 1 ? "s" : ""} en{" "}
                      {outputFormat.toUpperCase()} ({dpi} DPI)
                    </p>
                  </div>
                </div>

                <button
                  onClick={downloadAllAsZip}
                  disabled={isDownloadingZip}
                  className="btn-primary flex items-center space-x-2 !py-2.5 !px-5"
                >
                  {isDownloadingZip ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Package className="w-4 h-4" />
                  )}
                  <span>
                    {isDownloadingZip
                      ? "Création du ZIP..."
                      : `Télécharger tout (${convertedPages.length} images)`}
                  </span>
                </button>
              </div>
            </div>

            {/* Pages grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {convertedPages.map((page) => (
                <div
                  key={page.pageNumber}
                  className="card group overflow-hidden"
                >
                  {/* Thumbnail */}
                  <div
                    className="relative aspect-[3/4] bg-gray-50 cursor-pointer overflow-hidden"
                    onClick={() => setPreviewPage(page)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={page.dataUrl}
                      alt={`Page ${page.pageNumber}`}
                      className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
                    />

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <div className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
                          <ZoomIn className="w-5 h-5 text-gray-700" />
                        </div>
                      </div>
                    </div>

                    {/* Page badge */}
                    <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {page.pageNumber}
                    </div>
                  </div>

                  {/* Info & Download */}
                  <div className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-700 truncate">
                          Page {page.pageNumber}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {page.width}×{page.height}px •{" "}
                          {formatFileSize(page.blob.size)}
                        </p>
                      </div>
                      <button
                        onClick={() => downloadSinglePage(page)}
                        className="p-2 rounded-xl hover:bg-primary-50 text-gray-400 hover:text-primary-600 transition-colors flex-shrink-0"
                        title="Télécharger cette page"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom download bar */}
            {convertedPages.length > 1 && (
              <div className="card p-5">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                      <Package className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        Télécharger toutes les images
                      </p>
                      <p className="text-xs text-gray-500">
                        {convertedPages.length} images en{" "}
                        {outputFormat.toUpperCase()} • Archive ZIP
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={downloadAllAsZip}
                    disabled={isDownloadingZip}
                    className="btn-primary flex items-center space-x-2 !py-2.5 !px-5"
                  >
                    {isDownloadingZip ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span>
                      {isDownloadingZip
                        ? "Création en cours..."
                        : "Télécharger tout (ZIP)"}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full-screen preview modal */}
      {previewPage && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPreviewPage(null)}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] w-full animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setPreviewPage(null)}
              className="absolute -top-3 -right-3 z-10 w-10 h-10 bg-white rounded-full shadow-xl flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
            >
              <span className="text-xl font-light">&times;</span>
            </button>

            {/* Image */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
              <div className="overflow-auto max-h-[80vh] bg-gray-100 flex items-center justify-center p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewPage.dataUrl}
                  alt={`Page ${previewPage.pageNumber}`}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-md"
                />
              </div>

              {/* Footer */}
              <div className="px-5 py-4 flex items-center justify-between border-t border-gray-100">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Page {previewPage.pageNumber}
                  </p>
                  <p className="text-xs text-gray-500">
                    {previewPage.width}×{previewPage.height}px •{" "}
                    {formatFileSize(previewPage.blob.size)} •{" "}
                    {outputFormat.toUpperCase()}
                  </p>
                </div>
                <button
                  onClick={() => downloadSinglePage(previewPage)}
                  className="btn-primary flex items-center space-x-2 !py-2.5 !px-4 text-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Télécharger</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
