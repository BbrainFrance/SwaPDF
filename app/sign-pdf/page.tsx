"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  PenTool,
  Download,
  Save,
  Trash2,
  Clock,
  FileText,
  Plus,
  Check,
  User,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  MousePointer,
  Move,
  X,
  LogIn,
  Maximize2,
  Loader2,
  RotateCcw,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { saveAs } from "file-saver";
import { FileUpload } from "@/components/file-upload";
import { SignaturePad } from "@/components/signature-pad";
import { Loading } from "@/components/loading";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SavedSignature {
  id: string;
  name: string;
  data: string;
  createdAt: string;
}

interface PlacedSignature {
  id: string;
  pageNumber: number;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  signatureDataUrl: string;
  timestamp: string;
}

type SidebarTab = "new" | "saved" | "placed";

// ─── Component ──────────────────────────────────────────────────────────────

export default function SignPdfPage() {
  // ── PDF state ─────────────────────────────────────────────────────────────
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);

  // ── Canvas refs ───────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // ── Signature state ───────────────────────────────────────────────────────
  const [activeSignatureData, setActiveSignatureData] = useState<string | null>(
    null
  );
  const [placedSignatures, setPlacedSignatures] = useState<PlacedSignature[]>(
    []
  );
  const [selectedPlacedId, setSelectedPlacedId] = useState<string | null>(null);
  const [isPlacingMode, setIsPlacingMode] = useState(false);
  const [pendingSignatureData, setPendingSignatureData] = useState<
    string | null
  >(null);

  // ── Saved signatures ─────────────────────────────────────────────────────
  const [savedSignatures, setSavedSignatures] = useState<SavedSignature[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [isLoadingSignatures, setIsLoadingSignatures] = useState(false);
  const [savingName, setSavingName] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ── Sidebar ───────────────────────────────────────────────────────────────
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("new");

  // ── Download ──────────────────────────────────────────────────────────────
  const [isGenerating, setIsGenerating] = useState(false);

  // ── Drag / resize state ───────────────────────────────────────────────────
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragOriginalRef = useRef({ x: 0, y: 0, w: 0 });

  // ═════════════════════════════════════════════════════════════════════════
  // PDF.js worker init
  // ═════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }, []);

  // ═════════════════════════════════════════════════════════════════════════
  // Auth check & fetch saved signatures
  // ═════════════════════════════════════════════════════════════════════════

  const fetchSavedSignatures = useCallback(async () => {
    setIsLoadingSignatures(true);
    try {
      const res = await fetch("/api/signatures");
      if (res.status === 401) {
        setIsLoggedIn(false);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setSavedSignatures(data.signatures || []);
        setIsLoggedIn(true);
      }
    } catch {
      // network error — silently ignore
    } finally {
      setIsLoadingSignatures(false);
    }
  }, []);

  useEffect(() => {
    fetchSavedSignatures();
  }, [fetchSavedSignatures]);

  // ═════════════════════════════════════════════════════════════════════════
  // Load PDF from uploaded file
  // ═════════════════════════════════════════════════════════════════════════

  const handleFileSelected = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setPdfFile(file);
    setIsLoadingPdf(true);
    setCurrentPage(1);
    setPlacedSignatures([]);
    setSelectedPlacedId(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setPdfDoc(doc);
      setNumPages(doc.numPages);
    } catch (err) {
      console.error("Erreur lors du chargement du PDF :", err);
    } finally {
      setIsLoadingPdf(false);
    }
  }, []);

  // ═════════════════════════════════════════════════════════════════════════
  // Render the current page to canvas
  // ═════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let cancelled = false;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        if (cancelled) return;

        const baseScale = 1.5;
        const viewport = page.getViewport({ scale: baseScale * zoom });

        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (err) {
        if (!cancelled) console.error("Erreur rendu page :", err);
      }
    };

    renderPage();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, currentPage, zoom]);

  // ═════════════════════════════════════════════════════════════════════════
  // Click on canvas to place signature
  // ═════════════════════════════════════════════════════════════════════════

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isPlacingMode || !activeSignatureData || !canvasRef.current) return;

      // Ignore if we were dragging / resizing
      if (isDragging || isResizing) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const xPercent = clickX / rect.width;
      const yPercent = clickY / rect.height;

      const now = new Date();
      const dd = String(now.getDate()).padStart(2, "0");
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const yyyy = now.getFullYear();
      const hh = String(now.getHours()).padStart(2, "0");
      const mi = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      const timestamp = `Signé le ${dd}/${mm}/${yyyy} à ${hh}:${mi}:${ss}`;

      const newSig: PlacedSignature = {
        id: crypto.randomUUID(),
        pageNumber: currentPage,
        xPercent: Math.max(0, Math.min(xPercent - 0.1, 0.8)),
        yPercent: Math.max(0, Math.min(yPercent - 0.025, 0.9)),
        widthPercent: 0.2,
        signatureDataUrl: activeSignatureData,
        timestamp,
      };

      setPlacedSignatures((prev) => [...prev, newSig]);
      setSelectedPlacedId(newSig.id);
      setIsPlacingMode(false);
      setSidebarTab("placed");
    },
    [isPlacingMode, activeSignatureData, currentPage, isDragging, isResizing]
  );

  // ═════════════════════════════════════════════════════════════════════════
  // Drag / Resize placed signatures
  // ═════════════════════════════════════════════════════════════════════════

  const handleSigMouseDown = useCallback(
    (e: React.MouseEvent, sigId: string, type: "move" | "resize") => {
      e.preventDefault();
      e.stopPropagation();

      const sig = placedSignatures.find((s) => s.id === sigId);
      if (!sig) return;

      setSelectedPlacedId(sigId);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      dragOriginalRef.current = {
        x: sig.xPercent,
        y: sig.yPercent,
        w: sig.widthPercent,
      };

      if (type === "move") {
        setIsDragging(true);
      } else {
        setIsResizing(true);
      }
    },
    [placedSignatures]
  );

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const dx = (e.clientX - dragStartRef.current.x) / rect.width;
      const dy = (e.clientY - dragStartRef.current.y) / rect.height;

      setPlacedSignatures((prev) =>
        prev.map((sig) => {
          if (sig.id !== selectedPlacedId) return sig;
          if (isDragging) {
            return {
              ...sig,
              xPercent: Math.max(
                0,
                Math.min(dragOriginalRef.current.x + dx, 0.95)
              ),
              yPercent: Math.max(
                0,
                Math.min(dragOriginalRef.current.y + dy, 0.95)
              ),
            };
          }
          if (isResizing) {
            return {
              ...sig,
              widthPercent: Math.max(
                0.05,
                Math.min(dragOriginalRef.current.w + dx, 0.7)
              ),
            };
          }
          return sig;
        })
      );
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isResizing, selectedPlacedId]);

  // ═════════════════════════════════════════════════════════════════════════
  // Signature actions
  // ═════════════════════════════════════════════════════════════════════════

  const handleUseSignature = useCallback((dataUrl: string) => {
    setActiveSignatureData(dataUrl);
    setIsPlacingMode(true);
  }, []);

  const handleSaveSignature = async (dataUrl: string) => {
    if (!savingName.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/signatures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: savingName.trim(), data: dataUrl }),
      });
      if (res.ok) {
        await fetchSavedSignatures();
        setSavingName("");
        setShowSaveForm(false);
      }
    } catch {
      // error
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSavedSignature = async (id: string) => {
    try {
      const res = await fetch(`/api/signatures?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSavedSignatures((prev) => prev.filter((s) => s.id !== id));
      }
    } catch {
      // error
    }
  };

  const removePlacedSignature = useCallback(
    (id: string) => {
      setPlacedSignatures((prev) => prev.filter((s) => s.id !== id));
      if (selectedPlacedId === id) setSelectedPlacedId(null);
    },
    [selectedPlacedId]
  );

  // ═════════════════════════════════════════════════════════════════════════
  // Computed: signatures on the current page
  // ═════════════════════════════════════════════════════════════════════════

  const currentPageSignatures = useMemo(
    () => placedSignatures.filter((s) => s.pageNumber === currentPage),
    [placedSignatures, currentPage]
  );

  // ═════════════════════════════════════════════════════════════════════════
  // Download signed PDF (pdf-lib)
  // ═════════════════════════════════════════════════════════════════════════

  const handleDownload = useCallback(async () => {
    if (!pdfFile || placedSignatures.length === 0) return;

    setIsGenerating(true);

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdfDocLib = await PDFDocument.load(arrayBuffer);
      const helveticaFont = await pdfDocLib.embedFont(StandardFonts.Helvetica);
      const pages = pdfDocLib.getPages();

      // Group placed signatures by page number
      const sigsByPage = new Map<number, PlacedSignature[]>();
      for (const sig of placedSignatures) {
        const list = sigsByPage.get(sig.pageNumber) || [];
        list.push(sig);
        sigsByPage.set(sig.pageNumber, list);
      }

      const sigEntries = Array.from(sigsByPage.entries());
      for (let si = 0; si < sigEntries.length; si++) {
        const [pageNum, sigs] = sigEntries[si];
        const page = pages[pageNum - 1];
        if (!page) continue;

        const { width: pageWidth, height: pageHeight } = page.getSize();

        for (const sig of sigs) {
          // Embed the signature image
          const base64 = sig.signatureDataUrl.split(",")[1];
          const imageBytes = Uint8Array.from(atob(base64), (c) =>
            c.charCodeAt(0)
          );

          let sigImage;
          if (sig.signatureDataUrl.includes("image/png")) {
            sigImage = await pdfDocLib.embedPng(imageBytes);
          } else {
            sigImage = await pdfDocLib.embedJpg(imageBytes);
          }

          const sigWidth = sig.widthPercent * pageWidth;
          const sigAspect = sigImage.height / sigImage.width;
          const sigHeight = sigWidth * sigAspect;

          // PDF coordinates: origin at bottom-left
          const x = sig.xPercent * pageWidth;
          const y = pageHeight - sig.yPercent * pageHeight - sigHeight;

          page.drawImage(sigImage, {
            x,
            y,
            width: sigWidth,
            height: sigHeight,
          });

          // Draw timestamp text below the signature
          const fontSize = Math.max(7, Math.min(sigWidth * 0.055, 12));
          page.drawText(sig.timestamp, {
            x,
            y: y - fontSize - 3,
            size: fontSize,
            font: helveticaFont,
            color: rgb(0.35, 0.35, 0.35),
          });
        }
      }

      const pdfBytes = await pdfDocLib.save();
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const baseName = pdfFile.name.replace(/\.pdf$/i, "");
      saveAs(blob, `${baseName}_signe.pdf`);
    } catch (err) {
      console.error("Erreur lors de la génération du PDF signé :", err);
    } finally {
      setIsGenerating(false);
    }
  }, [pdfFile, placedSignatures]);

  // ═════════════════════════════════════════════════════════════════════════
  // Reset
  // ═════════════════════════════════════════════════════════════════════════

  const handleReset = useCallback(() => {
    setPdfFile(null);
    setPdfDoc(null);
    setNumPages(0);
    setCurrentPage(1);
    setZoom(1);
    setPlacedSignatures([]);
    setSelectedPlacedId(null);
    setActiveSignatureData(null);
    setIsPlacingMode(false);
    setPendingSignatureData(null);
    setSidebarTab("new");
  }, []);

  // ═════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═════════════════════════════════════════════════════════════════════════

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Pages that have at least one signature
  const pagesWithSignatures = useMemo(() => {
    const pages = new Set<number>();
    placedSignatures.forEach((s) => pages.add(s.pageNumber));
    return pages;
  }, [placedSignatures]);

  // ═════════════════════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════════════════════

  return (
    <div className="animate-fade-in min-h-screen">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-bg opacity-5" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center">
                <PenTool className="w-6 h-6 text-violet-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Signer un PDF
                </h1>
                <p className="text-gray-500 mt-1">
                  Ajoutez votre signature manuscrite et un horodatage sur vos
                  documents PDF
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {pdfFile && (
                <button
                  onClick={handleReset}
                  className="btn-secondary flex items-center space-x-2 !py-2.5 !px-4"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Nouveau fichier</span>
                </button>
              )}

              {pdfFile && placedSignatures.length > 0 && (
                <button
                  onClick={handleDownload}
                  disabled={isGenerating}
                  className="btn-primary flex items-center space-x-2 !py-2.5 !px-5"
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>
                    {isGenerating
                      ? "Génération en cours..."
                      : "Télécharger le PDF signé"}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {/* ── Upload area (no file) ─────────────────────────────────────── */}
        {!pdfFile && !isLoadingPdf && (
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

            {/* Info cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
              <div className="card p-5 text-center">
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center mx-auto mb-3">
                  <PenTool className="w-5 h-5 text-violet-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Signature manuscrite
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Dessinez votre signature directement dans le navigateur
                </p>
              </div>
              <div className="card p-5 text-center">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Horodatage automatique
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Date et heure ajoutées automatiquement à chaque signature
                </p>
              </div>
              <div className="card p-5 text-center">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                  <Save className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Sauvegarde en ligne
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Enregistrez vos signatures pour les réutiliser facilement
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Loading PDF ───────────────────────────────────────────────── */}
        {isLoadingPdf && <Loading message="Chargement du PDF en cours..." />}

        {/* ── Editor (PDF loaded) ───────────────────────────────────────── */}
        {pdfDoc && pdfFile && (
          <div className="animate-fade-in">
            {/* ── Toolbar ─────────────────────────────────────────────── */}
            <div className="card mb-4 px-4 py-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                {/* Page navigation */}
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Page précédente"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>

                  <div className="flex items-center space-x-1.5">
                    {Array.from({ length: Math.min(numPages, 10) }, (_, i) => {
                      const pageNum = i + 1;
                      const hasSig = pagesWithSignatures.has(pageNum);
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`relative w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                            currentPage === pageNum
                              ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {pageNum}
                          {hasSig && (
                            <div
                              className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
                                currentPage === pageNum
                                  ? "bg-white"
                                  : "bg-violet-500"
                              }`}
                            />
                          )}
                        </button>
                      );
                    })}
                    {numPages > 10 && (
                      <span className="text-xs text-gray-400 px-1">
                        ... {numPages} pages
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(numPages, p + 1))
                    }
                    disabled={currentPage >= numPages}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Page suivante"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                  </button>
                </div>

                {/* Zoom controls */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(1)))}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Dézoomer"
                  >
                    <ZoomOut className="w-4 h-4 text-gray-600" />
                  </button>
                  <span className="text-sm font-medium text-gray-600 min-w-[50px] text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.1).toFixed(1)))}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Zoomer"
                  >
                    <ZoomIn className="w-4 h-4 text-gray-600" />
                  </button>
                </div>

                {/* Placing mode indicator */}
                {isPlacingMode && (
                  <div className="flex items-center space-x-2 bg-violet-50 text-violet-700 px-3 py-1.5 rounded-xl text-sm font-medium animate-fade-in">
                    <MousePointer className="w-4 h-4" />
                    <span>Cliquez sur le PDF pour placer la signature</span>
                    <button
                      onClick={() => {
                        setIsPlacingMode(false);
                        setActiveSignatureData(null);
                      }}
                      className="ml-1 p-0.5 hover:bg-violet-200 rounded transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* File info */}
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <FileText className="w-4 h-4" />
                  <span className="truncate max-w-[180px]">
                    {pdfFile.name}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Main editor layout ──────────────────────────────────── */}
            <div className="flex gap-4" style={{ minHeight: "72vh" }}>
              {/* ── Left: PDF preview ────────────────────────────────── */}
              <div className="flex-1 card p-4 overflow-auto">
                <div
                  ref={overlayRef}
                  className="relative inline-block"
                  onClick={handleCanvasClick}
                  style={{ lineHeight: 0 }}
                >
                  <canvas
                    ref={canvasRef}
                    className={`max-w-full h-auto rounded-lg shadow-md transition-shadow ${
                      isPlacingMode
                        ? "cursor-crosshair ring-2 ring-violet-400 ring-offset-2"
                        : ""
                    }`}
                    style={{ display: "block" }}
                  />

                  {/* Placed signatures overlay on current page */}
                  {currentPageSignatures.map((sig) => {
                    const isSelected = selectedPlacedId === sig.id;
                    return (
                      <div
                        key={sig.id}
                        className={`absolute select-none ${
                          isSelected
                            ? "z-20"
                            : "z-10 hover:z-20"
                        }`}
                        style={{
                          left: `${sig.xPercent * 100}%`,
                          top: `${sig.yPercent * 100}%`,
                          width: `${sig.widthPercent * 100}%`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPlacedId(sig.id);
                        }}
                      >
                        {/* Signature border */}
                        <div
                          className={`relative rounded-lg border-2 transition-colors ${
                            isSelected
                              ? "border-violet-500 shadow-lg shadow-violet-500/20"
                              : "border-transparent hover:border-violet-300"
                          }`}
                        >
                          {/* Drag handle – entire signature area */}
                          <div
                            className="cursor-move"
                            onMouseDown={(e) =>
                              handleSigMouseDown(e, sig.id, "move")
                            }
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={sig.signatureDataUrl}
                              alt="Signature"
                              className="w-full h-auto pointer-events-none rounded"
                              draggable={false}
                            />
                          </div>

                          {/* Timestamp below signature */}
                          <div
                            className="text-center whitespace-nowrap overflow-hidden pointer-events-none px-1 pb-0.5"
                            style={{
                              fontSize: "clamp(6px, 0.65vw, 10px)",
                              color: "#4b5563",
                              lineHeight: "1.4",
                            }}
                          >
                            {sig.timestamp}
                          </div>

                          {/* Move icon on hover */}
                          <div
                            className={`absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-violet-500 rounded-full flex items-center justify-center text-white shadow-md transition-opacity ${
                              isSelected
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100"
                            }`}
                            style={{ pointerEvents: "none" }}
                          >
                            <Move className="w-3 h-3" />
                          </div>

                          {/* Controls when selected */}
                          {isSelected && (
                            <>
                              {/* Resize handle bottom-right */}
                              <div
                                className="absolute -bottom-2.5 -right-2.5 w-6 h-6 bg-violet-500 rounded-full flex items-center justify-center cursor-se-resize text-white hover:bg-violet-600 transition-colors shadow-md"
                                onMouseDown={(e) =>
                                  handleSigMouseDown(e, sig.id, "resize")
                                }
                              >
                                <Maximize2 className="w-3 h-3" />
                              </div>

                              {/* Delete button top-right */}
                              <button
                                className="absolute -top-2.5 -right-2.5 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors shadow-md z-30"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removePlacedSignature(sig.id);
                                }}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Right: Sidebar ───────────────────────────────────── */}
              <div className="w-[340px] flex-shrink-0">
                <div className="card overflow-hidden sticky top-4">
                  {/* Tabs */}
                  <div className="flex border-b border-gray-100">
                    {(
                      [
                        {
                          key: "new" as SidebarTab,
                          label: "Nouvelle",
                          icon: Plus,
                        },
                        {
                          key: "saved" as SidebarTab,
                          label: "Mes signatures",
                          icon: User,
                        },
                        {
                          key: "placed" as SidebarTab,
                          label: "Placées",
                          icon: Check,
                          badge: placedSignatures.length || undefined,
                        },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setSidebarTab(tab.key)}
                        className={`flex-1 flex items-center justify-center space-x-1.5 px-2 py-3.5 text-xs font-medium transition-all relative ${
                          sidebarTab === tab.key
                            ? "text-violet-600"
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <tab.icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                        {"badge" in tab && tab.badge ? (
                          <span className="ml-0.5 bg-violet-100 text-violet-700 text-[10px] font-bold w-5 h-5 rounded-full inline-flex items-center justify-center">
                            {tab.badge}
                          </span>
                        ) : null}
                        {sidebarTab === tab.key && (
                          <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-violet-500 rounded-full" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Tab content */}
                  <div
                    className="p-4 overflow-y-auto"
                    style={{ maxHeight: "calc(72vh - 48px)" }}
                  >
                    {/* ── TAB: Nouvelle signature ────────────────────── */}
                    {sidebarTab === "new" && (
                      <div className="space-y-4 animate-fade-in">
                        <p className="text-sm text-gray-600 leading-relaxed">
                          Dessinez votre signature ci-dessous, puis cliquez sur
                          «&nbsp;Sauvegarder&nbsp;» pour la placer sur le PDF.
                        </p>

                        <SignaturePad
                          width={500}
                          height={180}
                          onSave={(dataUrl) => {
                            setPendingSignatureData(dataUrl);
                            handleUseSignature(dataUrl);
                          }}
                        />

                        {/* Save to account option */}
                        {pendingSignatureData && isLoggedIn && (
                          <div className="border-t border-gray-100 pt-3 animate-fade-in">
                            {!showSaveForm ? (
                              <button
                                onClick={() => setShowSaveForm(true)}
                                className="btn-secondary w-full flex items-center justify-center space-x-2 !py-2 !px-3 text-sm"
                              >
                                <Save className="w-4 h-4" />
                                <span>Enregistrer dans mon compte</span>
                              </button>
                            ) : (
                              <div className="space-y-2 animate-fade-in">
                                <input
                                  type="text"
                                  placeholder="Nom de la signature (ex: Ma signature)"
                                  value={savingName}
                                  onChange={(e) =>
                                    setSavingName(e.target.value)
                                  }
                                  className="input-field !py-2 text-sm"
                                  autoFocus
                                />
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() =>
                                      handleSaveSignature(
                                        pendingSignatureData!
                                      )
                                    }
                                    disabled={
                                      !savingName.trim() || isSaving
                                    }
                                    className="btn-primary flex-1 !py-2 !px-3 text-sm flex items-center justify-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {isSaving ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Check className="w-4 h-4" />
                                    )}
                                    <span>Enregistrer</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setShowSaveForm(false);
                                      setSavingName("");
                                    }}
                                    className="btn-secondary !py-2 !px-3 text-sm"
                                  >
                                    Annuler
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {pendingSignatureData && isLoggedIn === false && (
                          <div className="flex items-start space-x-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-700 animate-fade-in">
                            <User className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>
                              <a
                                href="/login"
                                className="font-semibold underline hover:text-amber-800"
                              >
                                Connectez-vous
                              </a>{" "}
                              pour enregistrer vos signatures et les réutiliser
                              plus tard.
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── TAB: Mes signatures (saved) ────────────────── */}
                    {sidebarTab === "saved" && (
                      <div className="space-y-3 animate-fade-in">
                        {/* Not logged in */}
                        {isLoggedIn === false && (
                          <div className="flex flex-col items-center py-8 space-y-4 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                              <User className="w-7 h-7 text-gray-400" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-700">
                                Connexion requise
                              </p>
                              <p className="text-xs text-gray-500 mt-1 max-w-[220px]">
                                Connectez-vous à votre compte pour enregistrer
                                et réutiliser vos signatures.
                              </p>
                            </div>
                            <a
                              href="/login"
                              className="btn-primary !py-2.5 !px-5 text-sm flex items-center space-x-2"
                            >
                              <LogIn className="w-4 h-4" />
                              <span>Se connecter</span>
                            </a>
                          </div>
                        )}

                        {/* Loading */}
                        {isLoggedIn && isLoadingSignatures && (
                          <Loading
                            message="Chargement des signatures..."
                            size="sm"
                          />
                        )}

                        {/* Empty state */}
                        {isLoggedIn &&
                          !isLoadingSignatures &&
                          savedSignatures.length === 0 && (
                            <div className="text-center py-8">
                              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                                <PenTool className="w-7 h-7 text-gray-300" />
                              </div>
                              <p className="text-sm font-medium text-gray-600">
                                Aucune signature enregistrée
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                Dessinez une signature dans l&apos;onglet
                                «&nbsp;Nouvelle&nbsp;» et enregistrez-la.
                              </p>
                            </div>
                          )}

                        {/* Saved signatures list */}
                        {isLoggedIn &&
                          !isLoadingSignatures &&
                          savedSignatures.map((sig) => (
                            <div
                              key={sig.id}
                              className="group border border-gray-200 rounded-xl p-3 hover:border-violet-300 hover:shadow-sm transition-all"
                            >
                              <div className="bg-gray-50 rounded-lg p-2 mb-2.5">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={sig.data}
                                  alt={sig.name}
                                  className="w-full h-16 object-contain"
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-gray-700 truncate">
                                    {sig.name}
                                  </p>
                                  <p className="text-[10px] text-gray-400">
                                    {formatDate(sig.createdAt)}
                                  </p>
                                </div>
                                <div className="flex items-center space-x-1 ml-2">
                                  <button
                                    onClick={() =>
                                      handleUseSignature(sig.data)
                                    }
                                    className="p-2 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                                    title="Utiliser cette signature"
                                  >
                                    <PenTool className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleDeleteSavedSignature(sig.id)
                                    }
                                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                    title="Supprimer cette signature"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* ── TAB: Signatures placées ────────────────────── */}
                    {sidebarTab === "placed" && (
                      <div className="space-y-3 animate-fade-in">
                        {/* Empty state */}
                        {placedSignatures.length === 0 && (
                          <div className="text-center py-8">
                            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                              <MousePointer className="w-7 h-7 text-gray-300" />
                            </div>
                            <p className="text-sm font-medium text-gray-600">
                              Aucune signature placée
                            </p>
                            <p className="text-xs text-gray-400 mt-1 max-w-[220px] mx-auto">
                              Dessinez ou sélectionnez une signature, puis
                              cliquez sur le PDF pour la placer.
                            </p>
                          </div>
                        )}

                        {/* Placed signatures list */}
                        {placedSignatures.length > 0 && (
                          <>
                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                              {placedSignatures.length} signature
                              {placedSignatures.length > 1 ? "s" : ""} placée
                              {placedSignatures.length > 1 ? "s" : ""}
                            </p>

                            {placedSignatures.map((sig, idx) => (
                              <div
                                key={sig.id}
                                className={`border rounded-xl p-3 transition-all cursor-pointer ${
                                  selectedPlacedId === sig.id
                                    ? "border-violet-400 bg-violet-50/60 shadow-sm"
                                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                                }`}
                                onClick={() => {
                                  setSelectedPlacedId(sig.id);
                                  setCurrentPage(sig.pageNumber);
                                }}
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex items-center space-x-2">
                                    <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                                      <span className="text-[10px] font-bold text-violet-700">
                                        {idx + 1}
                                      </span>
                                    </div>
                                    <span className="text-sm font-medium text-gray-700">
                                      Page {sig.pageNumber}
                                    </span>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removePlacedSignature(sig.id);
                                    }}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                    title="Supprimer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                {/* Signature preview */}
                                <div className="bg-white rounded-lg p-1.5 border border-gray-100 mb-2">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={sig.signatureDataUrl}
                                    alt="Signature"
                                    className="w-full h-10 object-contain"
                                  />
                                </div>

                                {/* Timestamp */}
                                <div className="flex items-center space-x-1.5 text-[10px] text-gray-500">
                                  <Clock className="w-3 h-3 flex-shrink-0" />
                                  <span>{sig.timestamp}</span>
                                </div>

                                {/* Width slider when selected */}
                                {selectedPlacedId === sig.id && (
                                  <div className="mt-3 pt-3 border-t border-gray-200/60 animate-fade-in">
                                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
                                      Taille de la signature
                                    </label>
                                    <input
                                      type="range"
                                      min="5"
                                      max="60"
                                      value={Math.round(
                                        sig.widthPercent * 100
                                      )}
                                      onChange={(e) => {
                                        const newWidth =
                                          Number(e.target.value) / 100;
                                        setPlacedSignatures((prev) =>
                                          prev.map((s) =>
                                            s.id === sig.id
                                              ? {
                                                  ...s,
                                                  widthPercent: newWidth,
                                                }
                                              : s
                                          )
                                        );
                                      }}
                                      className="w-full accent-violet-600"
                                    />
                                    <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                                      <span>Petit</span>
                                      <span className="font-medium text-violet-600">
                                        {Math.round(sig.widthPercent * 100)}%
                                      </span>
                                      <span>Grand</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}

                            {/* Download button */}
                            <div className="pt-2">
                              <button
                                onClick={handleDownload}
                                disabled={isGenerating}
                                className="btn-primary w-full flex items-center justify-center space-x-2 !py-3 text-sm"
                              >
                                {isGenerating ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Download className="w-4 h-4" />
                                )}
                                <span>
                                  {isGenerating
                                    ? "Génération en cours..."
                                    : "Télécharger le PDF signé"}
                                </span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
