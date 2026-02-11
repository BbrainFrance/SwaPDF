"use client";

import { useState, useCallback, useRef } from "react";
import {
  ImageIcon,
  FileOutput,
  Download,
  Trash2,
  ArrowUp,
  ArrowDown,
  Settings,
  Plus,
  Loader2,
  RotateCcw,
  Check,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { saveAs } from "file-saver";
import { FileUpload } from "@/components/file-upload";
import { Loading } from "@/components/loading";

// ─── Types ────────────────────────────────────────────────────────────────────

type PageSize = "a4" | "letter" | "custom";
type Orientation = "portrait" | "landscape";
type FitMode = "fit" | "fill" | "stretch";

interface ImageItem {
  id: string;
  file: File;
  preview: string;
  width: number;
  height: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZES: Record<string, { width: number; height: number; label: string }> = {
  a4: { width: 595.28, height: 841.89, label: "A4 (210 × 297 mm)" },
  letter: { width: 612, height: 792, label: "Letter (216 × 279 mm)" },
};

const MM_TO_PT = 2.835;

const ACCEPTED_FORMATS =
  ".jpg,.jpeg,.png,.webp,.gif,.bmp,image/jpeg,image/png,image/webp,image/gif,image/bmp";

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImageToPdfPage() {
  // Images state
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  // Settings state
  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [marginMm, setMarginMm] = useState(10);
  const [fitMode, setFitMode] = useState<FitMode>("fit");
  const [customWidthMm, setCustomWidthMm] = useState(210);
  const [customHeightMm, setCustomHeightMm] = useState(297);
  const [showSettings, setShowSettings] = useState(true);

  // Refs
  const addMoreInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // ─── Generate unique ID ─────────────────────────────────────────────────

  const generateId = () =>
    `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // ─── Load image preview & dimensions ────────────────────────────────────

  const loadImagePreview = useCallback(
    (file: File): Promise<ImageItem> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          const img = new window.Image();
          img.onload = () => {
            resolve({
              id: generateId(),
              file,
              preview: dataUrl,
              width: img.naturalWidth,
              height: img.naturalHeight,
            });
          };
          img.onerror = () => reject(new Error(`Impossible de charger ${file.name}`));
          img.src = dataUrl;
        };
        reader.onerror = () => reject(new Error(`Impossible de lire ${file.name}`));
        reader.readAsDataURL(file);
      });
    },
    []
  );

  // ─── Handle files from FileUpload ───────────────────────────────────────

  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      const newImages: ImageItem[] = [];
      for (const file of files) {
        try {
          const item = await loadImagePreview(file);
          newImages.push(item);
        } catch (err) {
          console.error(err);
        }
      }
      setImages(newImages);
      setPdfBlob(null);
    },
    [loadImagePreview]
  );

  // ─── Handle adding more files ───────────────────────────────────────────

  const handleAddMore = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files) return;
      const files = Array.from(e.target.files);
      const newItems: ImageItem[] = [];
      for (const file of files) {
        try {
          const item = await loadImagePreview(file);
          newItems.push(item);
        } catch (err) {
          console.error(err);
        }
      }
      setImages((prev) => [...prev, ...newItems]);
      setPdfBlob(null);
      e.target.value = "";
    },
    [loadImagePreview]
  );

  // ─── Reorder ────────────────────────────────────────────────────────────

  const moveImage = useCallback((index: number, direction: "up" | "down") => {
    setImages((prev) => {
      const newArr = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newArr.length) return prev;
      [newArr[index], newArr[targetIndex]] = [newArr[targetIndex], newArr[index]];
      return newArr;
    });
    setPdfBlob(null);
  }, []);

  // ─── Remove image ──────────────────────────────────────────────────────

  const removeImage = useCallback((id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    setPdfBlob(null);
  }, []);

  // ─── Get page dimensions in points ─────────────────────────────────────

  const getPageDimensions = useCallback((): {
    width: number;
    height: number;
  } => {
    let w: number, h: number;

    if (pageSize === "custom") {
      w = customWidthMm * MM_TO_PT;
      h = customHeightMm * MM_TO_PT;
    } else {
      const size = PAGE_SIZES[pageSize];
      w = size.width;
      h = size.height;
    }

    if (orientation === "landscape") {
      [w, h] = [Math.max(w, h), Math.min(w, h)];
    } else {
      [w, h] = [Math.min(w, h), Math.max(w, h)];
    }

    return { width: w, height: h };
  }, [pageSize, orientation, customWidthMm, customHeightMm]);

  // ─── Convert image to embeddable format ─────────────────────────────────

  const convertToEmbeddable = useCallback(
    async (
      file: File
    ): Promise<{ bytes: Uint8Array; type: "jpg" | "png" }> => {
      const isJpg = file.type === "image/jpeg";
      const isPng = file.type === "image/png";

      if (isJpg || isPng) {
        const buffer = await file.arrayBuffer();
        return { bytes: new Uint8Array(buffer), type: isJpg ? "jpg" : "png" };
      }

      // Convert other formats (WEBP, GIF, BMP) to PNG via canvas
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new window.Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(
              async (blob) => {
                if (blob) {
                  const buffer = await blob.arrayBuffer();
                  resolve({ bytes: new Uint8Array(buffer), type: "png" });
                } else {
                  reject(new Error("Échec de la conversion de l'image"));
                }
              },
              "image/png"
            );
          };
          img.onerror = () =>
            reject(new Error("Impossible de charger l'image"));
          img.src = e.target?.result as string;
        };
        reader.onerror = () =>
          reject(new Error("Impossible de lire le fichier"));
        reader.readAsDataURL(file);
      });
    },
    []
  );

  // ─── Convert images to PDF ──────────────────────────────────────────────

  const convertToPdf = useCallback(async () => {
    if (images.length === 0) return;

    setIsConverting(true);
    setConversionProgress(0);
    setPdfBlob(null);

    try {
      const pdfDoc = await PDFDocument.create();
      const { width: pageWidth, height: pageHeight } = getPageDimensions();
      const margin = marginMm * MM_TO_PT;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2;

      for (let i = 0; i < images.length; i++) {
        setConversionProgress(Math.round((i / images.length) * 100));

        const imageItem = images[i];
        const { bytes, type } = await convertToEmbeddable(imageItem.file);

        let embeddedImage;
        if (type === "jpg") {
          embeddedImage = await pdfDoc.embedJpg(bytes);
        } else {
          embeddedImage = await pdfDoc.embedPng(bytes);
        }

        const imgWidth = embeddedImage.width;
        const imgHeight = embeddedImage.height;

        const page = pdfDoc.addPage([pageWidth, pageHeight]);

        let drawX: number,
          drawY: number,
          drawWidth: number,
          drawHeight: number;

        if (fitMode === "stretch") {
          drawWidth = contentWidth;
          drawHeight = contentHeight;
          drawX = margin;
          drawY = margin;
        } else if (fitMode === "fit") {
          const scaleX = contentWidth / imgWidth;
          const scaleY = contentHeight / imgHeight;
          const scale = Math.min(scaleX, scaleY);
          drawWidth = imgWidth * scale;
          drawHeight = imgHeight * scale;
          drawX = margin + (contentWidth - drawWidth) / 2;
          drawY = margin + (contentHeight - drawHeight) / 2;
        } else {
          // fill
          const scaleX = contentWidth / imgWidth;
          const scaleY = contentHeight / imgHeight;
          const scale = Math.max(scaleX, scaleY);
          drawWidth = imgWidth * scale;
          drawHeight = imgHeight * scale;
          drawX = margin + (contentWidth - drawWidth) / 2;
          drawY = margin + (contentHeight - drawHeight) / 2;
        }

        page.drawImage(embeddedImage, {
          x: drawX,
          y: drawY,
          width: drawWidth,
          height: drawHeight,
        });
      }

      setConversionProgress(100);

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
      setPdfBlob(blob);

      // Scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 300);
    } catch (error) {
      console.error("Erreur lors de la conversion :", error);
    } finally {
      setIsConverting(false);
    }
  }, [images, getPageDimensions, marginMm, fitMode, convertToEmbeddable]);

  // ─── Download PDF ──────────────────────────────────────────────────────

  const downloadPdf = useCallback(() => {
    if (!pdfBlob) return;
    saveAs(pdfBlob, "images-converti.pdf");
  }, [pdfBlob]);

  // ─── Reset ──────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setImages([]);
    setPdfBlob(null);
    setIsConverting(false);
    setConversionProgress(0);
  }, []);

  // ─── Format file size ─────────────────────────────────────────────────

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / 1024 / 1024).toFixed(2)} Mo`;
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in min-h-screen">
      {/* ──── Header ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-bg opacity-5" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    Image vers PDF
                  </h1>
                  <p className="text-gray-500 mt-1">
                    Convertissez vos images en un document PDF de haute qualité
                  </p>
                </div>
              </div>
            </div>

            {images.length > 0 && (
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleReset}
                  className="btn-secondary flex items-center space-x-2 !py-2.5 !px-4"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Recommencer</span>
                </button>
                {pdfBlob && (
                  <button
                    onClick={downloadPdf}
                    className="btn-primary flex items-center space-x-2 !py-2.5 !px-4"
                  >
                    <Download className="w-4 h-4" />
                    <span>Télécharger le PDF</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ──── Main Content ────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {/* ── Upload Area (no images yet) ────────────────────────────────── */}
        {images.length === 0 && !isConverting && (
          <div className="animate-slide-up max-w-2xl mx-auto">
            <div className="card p-8">
              <FileUpload
                accept={ACCEPTED_FORMATS}
                multiple
                onFilesSelected={handleFilesSelected}
                label="Glissez vos images ici"
                description="JPG, PNG, WEBP, GIF, BMP — ou cliquez pour parcourir"
                icon="image"
              />
            </div>

            {/* Feature cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
              <div className="card p-5 text-center">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                  <ImageIcon className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Multi-formats
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  JPG, PNG, WEBP, GIF et BMP supportés
                </p>
              </div>
              <div className="card p-5 text-center">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center mx-auto mb-3">
                  <Settings className="w-5 h-5 text-purple-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Personnalisable
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Taille de page, orientation, marges et ajustement
                </p>
              </div>
              <div className="card p-5 text-center">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                  <FileOutput className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">
                  PDF de qualité
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Générez un PDF propre avec toutes vos images
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Images loaded — Management interface ───────────────────────── */}
        {images.length > 0 && !isConverting && (
          <div className="animate-slide-up">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* ─ Left: Image list (2/3 width) ─────────────────────────── */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {images.length} image{images.length > 1 ? "s" : ""}{" "}
                    sélectionnée{images.length > 1 ? "s" : ""}
                  </h2>
                  <div>
                    <input
                      ref={addMoreInputRef}
                      type="file"
                      accept={ACCEPTED_FORMATS}
                      multiple
                      onChange={handleAddMore}
                      className="hidden"
                    />
                    <button
                      onClick={() => addMoreInputRef.current?.click()}
                      className="btn-secondary flex items-center space-x-2 !py-2 !px-3 text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Ajouter des images</span>
                    </button>
                  </div>
                </div>

                {/* Thumbnail grid with reorder / remove */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {images.map((img, index) => (
                    <div
                      key={img.id}
                      className="card !p-0 overflow-hidden group"
                    >
                      {/* Thumbnail */}
                      <div className="relative aspect-square bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.preview}
                          alt={img.file.name}
                          className="w-full h-full object-cover"
                        />

                        {/* Page badge */}
                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {index + 1}
                        </div>

                        {/* Delete overlay button */}
                        <button
                          onClick={() => removeImage(img.id)}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500/80 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Info + actions */}
                      <div className="p-2.5">
                        <p className="text-xs font-semibold text-gray-700 truncate">
                          {img.file.name}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {img.width}×{img.height}px •{" "}
                          {formatFileSize(img.file.size)}
                        </p>

                        {/* Reorder buttons */}
                        <div className="flex items-center justify-end space-x-1 mt-2">
                          <button
                            onClick={() => moveImage(index, "up")}
                            disabled={index === 0}
                            className={`p-1.5 rounded-lg transition-colors ${
                              index === 0
                                ? "text-gray-300 cursor-not-allowed"
                                : "text-gray-400 hover:text-primary-600 hover:bg-primary-50"
                            }`}
                            title="Monter"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => moveImage(index, "down")}
                            disabled={index === images.length - 1}
                            className={`p-1.5 rounded-lg transition-colors ${
                              index === images.length - 1
                                ? "text-gray-300 cursor-not-allowed"
                                : "text-gray-400 hover:text-primary-600 hover:bg-primary-50"
                            }`}
                            title="Descendre"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => removeImage(img.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ─ Right: Settings panel (1/3 width) ────────────────────── */}
              <div className="space-y-4">
                <div className="card overflow-hidden sticky top-4">
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <Settings className="w-5 h-5 text-gray-500" />
                      <span className="text-base font-semibold text-gray-900">
                        Paramètres
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                        showSettings ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {showSettings && (
                    <div className="px-6 pb-6 space-y-5 border-t border-gray-100 pt-5 animate-fade-in">
                      {/* Page Size */}
                      <div>
                        <label className="text-sm font-semibold text-gray-700 mb-2 block">
                          Taille de page
                        </label>
                        <select
                          value={pageSize}
                          onChange={(e) =>
                            setPageSize(e.target.value as PageSize)
                          }
                          className="input-field"
                        >
                          <option value="a4">A4 (210 × 297 mm)</option>
                          <option value="letter">Letter (216 × 279 mm)</option>
                          <option value="custom">Personnalisé</option>
                        </select>
                      </div>

                      {/* Custom dimensions */}
                      {pageSize === "custom" && (
                        <div className="grid grid-cols-2 gap-3 animate-fade-in">
                          <div>
                            <label className="text-xs font-medium text-gray-500 mb-1 block">
                              Largeur (mm)
                            </label>
                            <input
                              type="number"
                              value={customWidthMm}
                              onChange={(e) =>
                                setCustomWidthMm(Number(e.target.value))
                              }
                              min={50}
                              max={1000}
                              className="input-field"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 mb-1 block">
                              Hauteur (mm)
                            </label>
                            <input
                              type="number"
                              value={customHeightMm}
                              onChange={(e) =>
                                setCustomHeightMm(Number(e.target.value))
                              }
                              min={50}
                              max={1000}
                              className="input-field"
                            />
                          </div>
                        </div>
                      )}

                      {/* Orientation */}
                      <div>
                        <label className="text-sm font-semibold text-gray-700 mb-2 block">
                          Orientation
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => setOrientation("portrait")}
                            className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium ${
                              orientation === "portrait"
                                ? "border-primary-500 bg-primary-50/60 text-primary-700"
                                : "border-gray-200 hover:border-gray-300 bg-white text-gray-600"
                            }`}
                          >
                            <div
                              className={`w-4 h-5 rounded-sm border-2 ${
                                orientation === "portrait"
                                  ? "border-primary-500"
                                  : "border-gray-400"
                              }`}
                            />
                            <span>Portrait</span>
                          </button>
                          <button
                            onClick={() => setOrientation("landscape")}
                            className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium ${
                              orientation === "landscape"
                                ? "border-primary-500 bg-primary-50/60 text-primary-700"
                                : "border-gray-200 hover:border-gray-300 bg-white text-gray-600"
                            }`}
                          >
                            <div
                              className={`w-5 h-4 rounded-sm border-2 ${
                                orientation === "landscape"
                                  ? "border-primary-500"
                                  : "border-gray-400"
                              }`}
                            />
                            <span>Paysage</span>
                          </button>
                        </div>
                      </div>

                      {/* Margins */}
                      <div>
                        <label className="text-sm font-semibold text-gray-700 mb-2 block">
                          Marges ({marginMm} mm)
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={50}
                          value={marginMm}
                          onChange={(e) => setMarginMm(Number(e.target.value))}
                          className="w-full accent-primary-600"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                          <span>0 mm</span>
                          <span>50 mm</span>
                        </div>
                      </div>

                      {/* Fit Mode */}
                      <div>
                        <label className="text-sm font-semibold text-gray-700 mb-2 block">
                          Ajustement de l&apos;image
                        </label>
                        <div className="space-y-2">
                          {(
                            [
                              {
                                value: "fit" as FitMode,
                                label: "Ajuster",
                                desc: "L'image entière est visible, sans rognage",
                              },
                              {
                                value: "fill" as FitMode,
                                label: "Remplir",
                                desc: "Remplit la page, peut rogner les bords",
                              },
                              {
                                value: "stretch" as FitMode,
                                label: "Étirer",
                                desc: "Étire pour remplir toute la zone",
                              },
                            ] as const
                          ).map((option) => (
                            <button
                              key={option.value}
                              onClick={() => setFitMode(option.value)}
                              className={`w-full flex items-center px-4 py-3 rounded-xl border-2 transition-all text-left ${
                                fitMode === option.value
                                  ? "border-primary-500 bg-primary-50/60"
                                  : "border-gray-200 hover:border-gray-300 bg-white"
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                <div
                                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                    fitMode === option.value
                                      ? "border-primary-600"
                                      : "border-gray-300"
                                  }`}
                                >
                                  {fitMode === option.value && (
                                    <div className="w-2 h-2 rounded-full bg-primary-600" />
                                  )}
                                </div>
                                <div>
                                  <p
                                    className={`text-sm font-medium ${
                                      fitMode === option.value
                                        ? "text-primary-700"
                                        : "text-gray-700"
                                    }`}
                                  >
                                    {option.label}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    {option.desc}
                                  </p>
                                </div>
                              </div>
                              {option.value === "fit" && (
                                <span className="ml-auto text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex-shrink-0">
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
                {!pdfBlob && (
                  <button
                    onClick={convertToPdf}
                    disabled={images.length === 0}
                    className="btn-primary w-full flex items-center justify-center space-x-3 !py-4 text-base"
                  >
                    <Sparkles className="w-5 h-5" />
                    <span>
                      Convertir en PDF ({images.length} image
                      {images.length > 1 ? "s" : ""})
                    </span>
                  </button>
                )}

                {/* Download button */}
                {pdfBlob && (
                  <div className="space-y-3">
                    <button
                      onClick={downloadPdf}
                      className="btn-primary w-full flex items-center justify-center space-x-3 !py-4 text-base"
                    >
                      <Download className="w-5 h-5" />
                      <span>Télécharger le PDF</span>
                    </button>
                    <button
                      onClick={() => setPdfBlob(null)}
                      className="btn-secondary w-full flex items-center justify-center space-x-3 !py-3 text-sm"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Modifier et reconvertir</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Success banner after conversion */}
            {pdfBlob && (
              <div ref={resultsRef} className="mt-6 card p-6 animate-fade-in">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                      <Check className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        PDF créé avec succès !
                      </h3>
                      <p className="text-sm text-gray-500">
                        {images.length} image{images.length > 1 ? "s" : ""} •{" "}
                        {formatFileSize(pdfBlob.size)} •{" "}
                        {pageSize === "custom"
                          ? `${customWidthMm}×${customHeightMm} mm`
                          : PAGE_SIZES[pageSize].label}{" "}
                        •{" "}
                        {orientation === "portrait" ? "Portrait" : "Paysage"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={downloadPdf}
                    className="btn-primary flex items-center space-x-2 !py-2.5 !px-5"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      Télécharger ({formatFileSize(pdfBlob.size)})
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Conversion progress ────────────────────────────────────────── */}
        {isConverting && (
          <div className="animate-fade-in max-w-2xl mx-auto">
            <div className="card p-8">
              <div className="flex flex-col items-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                </div>

                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Création du PDF en cours...
                  </h3>
                  <p className="text-sm text-gray-500">
                    Traitement de {images.length} image
                    {images.length > 1 ? "s" : ""}...
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
                  {images.length} image{images.length > 1 ? "s" : ""} •{" "}
                  {pageSize === "custom"
                    ? `${customWidthMm}×${customHeightMm} mm`
                    : pageSize.toUpperCase()}{" "}
                  • {orientation === "portrait" ? "Portrait" : "Paysage"} •{" "}
                  {fitMode === "fit"
                    ? "Ajuster"
                    : fitMode === "fill"
                      ? "Remplir"
                      : "Étirer"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
