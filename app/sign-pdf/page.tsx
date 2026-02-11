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
  Upload,
  Type,
  Stamp,
  Image as ImageIcon,
  Crown,
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

interface PlacedItem {
  id: string;
  type: "signature" | "stamp";
  pageNumber: number;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  dataUrl: string;
  timestamp: string;
}

type SidebarTab = "new" | "saved" | "placed";
type CreationMode = "draw" | "type" | "upload" | "stamp";

// ─── Handwriting fonts ──────────────────────────────────────────────────────

const HANDWRITING_FONTS = [
  { name: "Dancing Script", family: "'Dancing Script', cursive" },
  { name: "Caveat", family: "'Caveat', cursive" },
  { name: "Great Vibes", family: "'Great Vibes', cursive" },
  { name: "Sacramento", family: "'Sacramento', cursive" },
  { name: "Pacifico", family: "'Pacifico', cursive" },
  { name: "Satisfy", family: "'Satisfy', cursive" },
];

const SIGNATURE_COLORS = [
  { name: "Noir", value: "#000000" },
  { name: "Bleu foncé", value: "#1e3a5f" },
  { name: "Bleu", value: "#1e40af" },
  { name: "Rouge", value: "#991b1b" },
];

// ─── Helper: render text to canvas dataURL ──────────────────────────────────

function textToSignatureDataUrl(
  text: string,
  fontFamily: string,
  color: string,
  fontSize: number = 64
): string {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  ctx.font = `${fontSize}px ${fontFamily}`;
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = fontSize * 1.4;

  canvas.width = textWidth + 40;
  canvas.height = textHeight + 20;

  // Transparent background
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 20, canvas.height / 2);

  return canvas.toDataURL("image/png");
}

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

  // ── Placed items state ────────────────────────────────────────────────────
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);
  const [selectedPlacedId, setSelectedPlacedId] = useState<string | null>(null);
  const [isPlacingMode, setIsPlacingMode] = useState(false);
  const [placingType, setPlacingType] = useState<"signature" | "stamp">("signature");
  const [activeDataUrl, setActiveDataUrl] = useState<string | null>(null);
  const [pendingSignatureData, setPendingSignatureData] = useState<string | null>(null);

  // ── Saved signatures ─────────────────────────────────────────────────────
  const [savedSignatures, setSavedSignatures] = useState<SavedSignature[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [isLoadingSignatures, setIsLoadingSignatures] = useState(false);
  const [savingName, setSavingName] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ── Sidebar & creation mode ──────────────────────────────────────────────
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("new");
  const [creationMode, setCreationMode] = useState<CreationMode>("draw");

  // ── Plan & usage ──────────────────────────────────────────────────────────
  const [userPlan, setUserPlan] = useState<string>("free");
  const [canUseTimestamp, setCanUseTimestamp] = useState(false);

  // ── Text signature state ─────────────────────────────────────────────────
  const [sigText, setSigText] = useState("");
  const [sigFont, setSigFont] = useState(HANDWRITING_FONTS[0].family);
  const [sigColor, setSigColor] = useState(SIGNATURE_COLORS[0].value);
  const [sigFontSize, setSigFontSize] = useState(64);

  // ── Upload signature / stamp state ────────────────────────────────────────
  const [uploadedSignaturePreview, setUploadedSignaturePreview] = useState<string | null>(null);
  const [uploadedStampPreview, setUploadedStampPreview] = useState<string | null>(null);
  const uploadSigRef = useRef<HTMLInputElement>(null);
  const uploadStampRef = useRef<HTMLInputElement>(null);

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

    // Fetch usage/plan info
    fetch("/api/usage")
      .then((res) => res.json())
      .then((data) => {
        setUserPlan(data.plan || "free");
        setCanUseTimestamp(data.canUseTimestamp || false);
      })
      .catch(() => {});
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
      // network error
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
    setPlacedItems([]);
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
  // Click on canvas to place item
  // ═════════════════════════════════════════════════════════════════════════

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isPlacingMode || !activeDataUrl || !canvasRef.current) return;
      if (isDragging || isResizing) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const xPercent = clickX / rect.width;
      const yPercent = clickY / rect.height;

      let timestamp = "";
      if (canUseTimestamp) {
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, "0");
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const yyyy = now.getFullYear();
        const hh = String(now.getHours()).padStart(2, "0");
        const mi = String(now.getMinutes()).padStart(2, "0");
        const ss = String(now.getSeconds()).padStart(2, "0");
        timestamp = placingType === "signature"
          ? `Signé le ${dd}/${mm}/${yyyy} à ${hh}:${mi}:${ss}`
          : `Certifié le ${dd}/${mm}/${yyyy} à ${hh}:${mi}:${ss}`;
      }

      const newItem: PlacedItem = {
        id: crypto.randomUUID(),
        type: placingType,
        pageNumber: currentPage,
        xPercent: Math.max(0, Math.min(xPercent - 0.1, 0.8)),
        yPercent: Math.max(0, Math.min(yPercent - 0.025, 0.9)),
        widthPercent: placingType === "stamp" ? 0.15 : 0.2,
        dataUrl: activeDataUrl,
        timestamp,
      };

      setPlacedItems((prev) => [...prev, newItem]);
      setSelectedPlacedId(newItem.id);
      setIsPlacingMode(false);
      setSidebarTab("placed");
    },
    [isPlacingMode, activeDataUrl, currentPage, isDragging, isResizing, placingType, canUseTimestamp]
  );

  // ═════════════════════════════════════════════════════════════════════════
  // Drag / Resize placed items
  // ═════════════════════════════════════════════════════════════════════════

  const handleItemMouseDown = useCallback(
    (e: React.MouseEvent, itemId: string, type: "move" | "resize") => {
      e.preventDefault();
      e.stopPropagation();

      const item = placedItems.find((s) => s.id === itemId);
      if (!item) return;

      setSelectedPlacedId(itemId);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      dragOriginalRef.current = {
        x: item.xPercent,
        y: item.yPercent,
        w: item.widthPercent,
      };

      if (type === "move") {
        setIsDragging(true);
      } else {
        setIsResizing(true);
      }
    },
    [placedItems]
  );

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const dx = (e.clientX - dragStartRef.current.x) / rect.width;
      const dy = (e.clientY - dragStartRef.current.y) / rect.height;

      setPlacedItems((prev) =>
        prev.map((item) => {
          if (item.id !== selectedPlacedId) return item;
          if (isDragging) {
            return {
              ...item,
              xPercent: Math.max(0, Math.min(dragOriginalRef.current.x + dx, 0.95)),
              yPercent: Math.max(0, Math.min(dragOriginalRef.current.y + dy, 0.95)),
            };
          }
          if (isResizing) {
            return {
              ...item,
              widthPercent: Math.max(0.05, Math.min(dragOriginalRef.current.w + dx, 0.7)),
            };
          }
          return item;
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
  // Place / Save / Delete actions
  // ═════════════════════════════════════════════════════════════════════════

  const handleUseItem = useCallback((dataUrl: string, type: "signature" | "stamp") => {
    setActiveDataUrl(dataUrl);
    setPlacingType(type);
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
      const res = await fetch(`/api/signatures?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setSavedSignatures((prev) => prev.filter((s) => s.id !== id));
      }
    } catch {
      // error
    }
  };

  const removePlacedItem = useCallback(
    (id: string) => {
      setPlacedItems((prev) => prev.filter((s) => s.id !== id));
      if (selectedPlacedId === id) setSelectedPlacedId(null);
    },
    [selectedPlacedId]
  );

  // ═════════════════════════════════════════════════════════════════════════
  // Upload handlers
  // ═════════════════════════════════════════════════════════════════════════

  const handleUploadSignature = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setUploadedSignaturePreview(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadStamp = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setUploadedStampPreview(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // ═════════════════════════════════════════════════════════════════════════
  // Text signature preview
  // ═════════════════════════════════════════════════════════════════════════

  const textSignaturePreview = useMemo(() => {
    if (!sigText.trim()) return null;
    return textToSignatureDataUrl(sigText, sigFont, sigColor, sigFontSize);
  }, [sigText, sigFont, sigColor, sigFontSize]);

  // ═════════════════════════════════════════════════════════════════════════
  // Computed
  // ═════════════════════════════════════════════════════════════════════════

  const currentPageItems = useMemo(
    () => placedItems.filter((s) => s.pageNumber === currentPage),
    [placedItems, currentPage]
  );

  const pagesWithItems = useMemo(() => {
    const pages = new Set<number>();
    placedItems.forEach((s) => pages.add(s.pageNumber));
    return pages;
  }, [placedItems]);

  // ═════════════════════════════════════════════════════════════════════════
  // Download signed PDF
  // ═════════════════════════════════════════════════════════════════════════

  const handleDownload = useCallback(async () => {
    if (!pdfFile || placedItems.length === 0) return;

    setIsGenerating(true);

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdfDocLib = await PDFDocument.load(arrayBuffer);
      const helveticaFont = await pdfDocLib.embedFont(StandardFonts.Helvetica);
      const pages = pdfDocLib.getPages();

      const itemsByPage = new Map<number, PlacedItem[]>();
      for (const item of placedItems) {
        const list = itemsByPage.get(item.pageNumber) || [];
        list.push(item);
        itemsByPage.set(item.pageNumber, list);
      }

      const entries = Array.from(itemsByPage.entries());
      for (let ei = 0; ei < entries.length; ei++) {
        const [pageNum, items] = entries[ei];
        const page = pages[pageNum - 1];
        if (!page) continue;

        const { width: pageWidth, height: pageHeight } = page.getSize();

        for (const item of items) {
          const base64 = item.dataUrl.split(",")[1];
          const imageBytes = Uint8Array.from(atob(base64), (c) =>
            c.charCodeAt(0)
          );

          let embeddedImage;
          if (item.dataUrl.includes("image/png")) {
            embeddedImage = await pdfDocLib.embedPng(imageBytes);
          } else {
            embeddedImage = await pdfDocLib.embedJpg(imageBytes);
          }

          const itemWidth = item.widthPercent * pageWidth;
          const aspect = embeddedImage.height / embeddedImage.width;
          const itemHeight = itemWidth * aspect;

          const x = item.xPercent * pageWidth;
          const y = pageHeight - item.yPercent * pageHeight - itemHeight;

          page.drawImage(embeddedImage, {
            x,
            y,
            width: itemWidth,
            height: itemHeight,
          });

          // Timestamp below (Pro only)
          if (item.timestamp) {
            const fontSize = Math.max(7, Math.min(itemWidth * 0.055, 12));
            page.drawText(item.timestamp, {
              x,
              y: y - fontSize - 3,
              size: fontSize,
              font: helveticaFont,
              color: rgb(0.35, 0.35, 0.35),
            });
          }
        }
      }

      const pdfBytes = await pdfDocLib.save();
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], {
        type: "application/pdf",
      });
      const baseName = pdfFile.name.replace(/\.pdf$/i, "");
      saveAs(blob, `${baseName}_signe.pdf`);
    } catch (err) {
      console.error("Erreur lors de la génération du PDF signé :", err);
    } finally {
      setIsGenerating(false);
    }
  }, [pdfFile, placedItems]);

  // ═════════════════════════════════════════════════════════════════════════
  // Reset
  // ═════════════════════════════════════════════════════════════════════════

  const handleReset = useCallback(() => {
    setPdfFile(null);
    setPdfDoc(null);
    setNumPages(0);
    setCurrentPage(1);
    setZoom(1);
    setPlacedItems([]);
    setSelectedPlacedId(null);
    setActiveDataUrl(null);
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
                  Signature manuscrite, texte, image ou tampon d&apos;entreprise avec horodatage
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

              {pdfFile && placedItems.length > 0 && (
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
                    {isGenerating ? "Génération..." : "Télécharger le PDF signé"}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {/* ── Upload area ─────────────────────────────────────────────────── */}
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

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
              <div className="card p-5 text-center">
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center mx-auto mb-3">
                  <PenTool className="w-5 h-5 text-violet-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">Dessiner</h3>
                <p className="text-xs text-gray-500 mt-1">Signature manuscrite</p>
              </div>
              <div className="card p-5 text-center">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                  <Type className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">Écrire</h3>
                <p className="text-xs text-gray-500 mt-1">Style manuscrit</p>
              </div>
              <div className="card p-5 text-center">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">Importer</h3>
                <p className="text-xs text-gray-500 mt-1">Image de signature</p>
              </div>
              <div className="card p-5 text-center">
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mx-auto mb-3">
                  <Stamp className="w-5 h-5 text-orange-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">Tampon</h3>
                <p className="text-xs text-gray-500 mt-1">Cachet d&apos;entreprise</p>
              </div>
            </div>
          </div>
        )}

        {isLoadingPdf && <Loading message="Chargement du PDF en cours..." />}

        {/* ── Editor ─────────────────────────────────────────────────────── */}
        {pdfDoc && pdfFile && (
          <div className="animate-fade-in">
            {/* Toolbar */}
            <div className="card mb-4 px-4 py-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                {/* Page navigation */}
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  <div className="flex items-center space-x-1.5">
                    {Array.from({ length: Math.min(numPages, 10) }, (_, i) => {
                      const pageNum = i + 1;
                      const hasItem = pagesWithItems.has(pageNum);
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
                          {hasItem && (
                            <div
                              className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
                                currentPage === pageNum ? "bg-white" : "bg-violet-500"
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
                    onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                    disabled={currentPage >= numPages}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                  </button>
                </div>

                {/* Zoom */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(1)))}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <ZoomOut className="w-4 h-4 text-gray-600" />
                  </button>
                  <span className="text-sm font-medium text-gray-600 min-w-[50px] text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.1).toFixed(1)))}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <ZoomIn className="w-4 h-4 text-gray-600" />
                  </button>
                </div>

                {/* Placing mode indicator */}
                {isPlacingMode && (
                  <div className="flex items-center space-x-2 bg-violet-50 text-violet-700 px-3 py-1.5 rounded-xl text-sm font-medium animate-fade-in">
                    <MousePointer className="w-4 h-4" />
                    <span>
                      Cliquez sur le PDF pour placer {placingType === "stamp" ? "le tampon" : "la signature"}
                    </span>
                    <button
                      onClick={() => {
                        setIsPlacingMode(false);
                        setActiveDataUrl(null);
                      }}
                      className="ml-1 p-0.5 hover:bg-violet-200 rounded transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <FileText className="w-4 h-4" />
                  <span className="truncate max-w-[180px]">{pdfFile.name}</span>
                </div>
              </div>
            </div>

            {/* Main layout */}
            <div className="flex gap-4" style={{ minHeight: "72vh" }}>
              {/* Left: PDF preview */}
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

                  {/* Placed items overlay */}
                  {currentPageItems.map((item) => {
                    const isSelected = selectedPlacedId === item.id;
                    const isStamp = item.type === "stamp";
                    return (
                      <div
                        key={item.id}
                        className={`absolute select-none ${isSelected ? "z-20" : "z-10 hover:z-20"}`}
                        style={{
                          left: `${item.xPercent * 100}%`,
                          top: `${item.yPercent * 100}%`,
                          width: `${item.widthPercent * 100}%`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPlacedId(item.id);
                        }}
                      >
                        <div
                          className={`relative rounded-lg border-2 transition-colors ${
                            isSelected
                              ? isStamp
                                ? "border-orange-500 shadow-lg shadow-orange-500/20"
                                : "border-violet-500 shadow-lg shadow-violet-500/20"
                              : "border-transparent hover:border-violet-300"
                          }`}
                        >
                          <div
                            className="cursor-move"
                            onMouseDown={(e) => handleItemMouseDown(e, item.id, "move")}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.dataUrl}
                              alt={isStamp ? "Tampon" : "Signature"}
                              className="w-full h-auto pointer-events-none rounded"
                              draggable={false}
                            />
                          </div>

                          {item.timestamp && (
                            <div
                              className="text-center whitespace-nowrap overflow-hidden pointer-events-none px-1 pb-0.5"
                              style={{
                                fontSize: "clamp(6px, 0.65vw, 10px)",
                                color: "#4b5563",
                                lineHeight: "1.4",
                              }}
                            >
                              {item.timestamp}
                            </div>
                          )}

                          <div
                            className={`absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center text-white shadow-md transition-opacity ${
                              isStamp ? "bg-orange-500" : "bg-violet-500"
                            } ${isSelected ? "opacity-100" : "opacity-0"}`}
                            style={{ pointerEvents: "none" }}
                          >
                            <Move className="w-3 h-3" />
                          </div>

                          {isSelected && (
                            <>
                              <div
                                className={`absolute -bottom-2.5 -right-2.5 w-6 h-6 rounded-full flex items-center justify-center cursor-se-resize text-white shadow-md transition-colors ${
                                  isStamp
                                    ? "bg-orange-500 hover:bg-orange-600"
                                    : "bg-violet-500 hover:bg-violet-600"
                                }`}
                                onMouseDown={(e) => handleItemMouseDown(e, item.id, "resize")}
                              >
                                <Maximize2 className="w-3 h-3" />
                              </div>
                              <button
                                className="absolute -top-2.5 -right-2.5 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors shadow-md z-30"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removePlacedItem(item.id);
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

              {/* Right: Sidebar */}
              <div className="w-[360px] flex-shrink-0">
                <div className="card overflow-hidden sticky top-20">
                  {/* Tabs */}
                  <div className="flex border-b border-gray-100">
                    {(
                      [
                        { key: "new" as SidebarTab, label: "Créer", icon: Plus },
                        { key: "saved" as SidebarTab, label: "Mes signatures", icon: User },
                        {
                          key: "placed" as SidebarTab,
                          label: "Placées",
                          icon: Check,
                          badge: placedItems.length || undefined,
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
                  <div className="p-4 overflow-y-auto" style={{ maxHeight: "calc(72vh - 48px)" }}>
                    {/* ── TAB: Créer ─────────────────────────────────────── */}
                    {sidebarTab === "new" && (
                      <div className="space-y-4 animate-fade-in">
                        {/* Timestamp Pro badge */}
                        {!canUseTimestamp && (
                          <div className="flex items-center space-x-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
                            <Crown className="w-4 h-4 flex-shrink-0" />
                            <span>
                              <a href="/pricing" className="font-semibold underline">Plan Pro</a> requis pour la signature horodatée.
                            </span>
                          </div>
                        )}
                        {canUseTimestamp && (
                          <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs text-emerald-700">
                            <Clock className="w-4 h-4 flex-shrink-0" />
                            <span>Horodatage certifié activé avec votre plan <strong className="capitalize">{userPlan}</strong>.</span>
                          </div>
                        )}
                        {/* Creation mode selector */}
                        <div className="grid grid-cols-4 gap-1.5">
                          <button
                            onClick={() => setCreationMode("draw")}
                            className={`flex flex-col items-center space-y-1.5 p-3 rounded-xl text-xs font-medium transition-all ${
                              creationMode === "draw"
                                ? "bg-violet-50 text-violet-700 ring-2 ring-violet-200"
                                : "text-gray-500 hover:bg-gray-50"
                            }`}
                          >
                            <PenTool className="w-4 h-4" />
                            <span>Dessiner</span>
                          </button>
                          <button
                            onClick={() => setCreationMode("type")}
                            className={`flex flex-col items-center space-y-1.5 p-3 rounded-xl text-xs font-medium transition-all ${
                              creationMode === "type"
                                ? "bg-blue-50 text-blue-700 ring-2 ring-blue-200"
                                : "text-gray-500 hover:bg-gray-50"
                            }`}
                          >
                            <Type className="w-4 h-4" />
                            <span>Écrire</span>
                          </button>
                          <button
                            onClick={() => setCreationMode("upload")}
                            className={`flex flex-col items-center space-y-1.5 p-3 rounded-xl text-xs font-medium transition-all ${
                              creationMode === "upload"
                                ? "bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200"
                                : "text-gray-500 hover:bg-gray-50"
                            }`}
                          >
                            <Upload className="w-4 h-4" />
                            <span>Importer</span>
                          </button>
                          <button
                            onClick={() => setCreationMode("stamp")}
                            className={`flex flex-col items-center space-y-1.5 p-3 rounded-xl text-xs font-medium transition-all ${
                              creationMode === "stamp"
                                ? "bg-orange-50 text-orange-700 ring-2 ring-orange-200"
                                : "text-gray-500 hover:bg-gray-50"
                            }`}
                          >
                            <Stamp className="w-4 h-4" />
                            <span>Tampon</span>
                          </button>
                        </div>

                        {/* ── Mode: Dessiner ──────────────────────────────── */}
                        {creationMode === "draw" && (
                          <div className="space-y-3 animate-fade-in">
                            <p className="text-xs text-gray-500">
                              Dessinez votre signature puis cliquez «&nbsp;Sauvegarder&nbsp;» pour la placer.
                            </p>
                            <SignaturePad
                              width={500}
                              height={180}
                              onSave={(dataUrl) => {
                                setPendingSignatureData(dataUrl);
                                handleUseItem(dataUrl, "signature");
                              }}
                            />

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
                                      placeholder="Nom de la signature"
                                      value={savingName}
                                      onChange={(e) => setSavingName(e.target.value)}
                                      className="input-field !py-2 text-sm"
                                      autoFocus
                                    />
                                    <div className="flex space-x-2">
                                      <button
                                        onClick={() => handleSaveSignature(pendingSignatureData!)}
                                        disabled={!savingName.trim() || isSaving}
                                        className="btn-primary flex-1 !py-2 !px-3 text-sm flex items-center justify-center space-x-1.5 disabled:opacity-50"
                                      >
                                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                        <span>Enregistrer</span>
                                      </button>
                                      <button
                                        onClick={() => { setShowSaveForm(false); setSavingName(""); }}
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
                                  <a href="/login" className="font-semibold underline hover:text-amber-800">
                                    Connectez-vous
                                  </a>{" "}
                                  pour enregistrer vos signatures.
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* ── Mode: Écrire (texte manuscrit) ──────────────── */}
                        {creationMode === "type" && (
                          <div className="space-y-4 animate-fade-in">
                            <p className="text-xs text-gray-500">
                              Tapez votre texte et choisissez un style de signature manuscrite.
                            </p>

                            <input
                              type="text"
                              placeholder="Votre nom ou signature..."
                              value={sigText}
                              onChange={(e) => setSigText(e.target.value)}
                              className="input-field"
                              autoFocus
                            />

                            {/* Font selector */}
                            <div>
                              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                                Style de police
                              </label>
                              <div className="grid grid-cols-2 gap-2">
                                {HANDWRITING_FONTS.map((font) => (
                                  <button
                                    key={font.name}
                                    onClick={() => setSigFont(font.family)}
                                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                                      sigFont === font.family
                                        ? "border-blue-500 bg-blue-50"
                                        : "border-gray-200 hover:border-gray-300"
                                    }`}
                                  >
                                    <span
                                      className="text-lg text-gray-800 block truncate"
                                      style={{ fontFamily: font.family }}
                                    >
                                      {sigText || "Signature"}
                                    </span>
                                    <span className="text-[10px] text-gray-400 mt-0.5 block">
                                      {font.name}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Color */}
                            <div>
                              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                                Couleur
                              </label>
                              <div className="flex space-x-2">
                                {SIGNATURE_COLORS.map((c) => (
                                  <button
                                    key={c.value}
                                    onClick={() => setSigColor(c.value)}
                                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                                      sigColor === c.value
                                        ? "border-blue-500 scale-110"
                                        : "border-gray-200 hover:border-gray-400"
                                    }`}
                                    style={{ backgroundColor: c.value }}
                                    title={c.name}
                                  />
                                ))}
                              </div>
                            </div>

                            {/* Size */}
                            <div>
                              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                                Taille : {sigFontSize}px
                              </label>
                              <input
                                type="range"
                                min="32"
                                max="120"
                                value={sigFontSize}
                                onChange={(e) => setSigFontSize(Number(e.target.value))}
                                className="w-full accent-blue-600"
                              />
                            </div>

                            {/* Preview */}
                            {textSignaturePreview && (
                              <div className="border border-gray-200 rounded-xl p-3 bg-white">
                                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Aperçu</p>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={textSignaturePreview}
                                  alt="Aperçu signature"
                                  className="max-w-full h-auto max-h-24 mx-auto"
                                />
                              </div>
                            )}

                            <button
                              onClick={() => {
                                if (textSignaturePreview) {
                                  setPendingSignatureData(textSignaturePreview);
                                  handleUseItem(textSignaturePreview, "signature");
                                }
                              }}
                              disabled={!sigText.trim()}
                              className="btn-primary w-full flex items-center justify-center space-x-2 !py-2.5 text-sm disabled:opacity-50"
                            >
                              <MousePointer className="w-4 h-4" />
                              <span>Placer sur le PDF</span>
                            </button>

                            {/* Save to account */}
                            {textSignaturePreview && isLoggedIn && (
                              <button
                                onClick={() => {
                                  setPendingSignatureData(textSignaturePreview);
                                  setShowSaveForm(true);
                                  setCreationMode("draw");
                                }}
                                className="btn-secondary w-full flex items-center justify-center space-x-2 !py-2 text-sm"
                              >
                                <Save className="w-4 h-4" />
                                <span>Enregistrer dans mon compte</span>
                              </button>
                            )}
                          </div>
                        )}

                        {/* ── Mode: Importer une signature ────────────────── */}
                        {creationMode === "upload" && (
                          <div className="space-y-4 animate-fade-in">
                            <p className="text-xs text-gray-500">
                              Importez une image de votre signature (PNG, JPG). Les images avec fond transparent fonctionnent le mieux.
                            </p>

                            <input
                              ref={uploadSigRef}
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              onChange={handleUploadSignature}
                              className="hidden"
                            />

                            {!uploadedSignaturePreview ? (
                              <button
                                onClick={() => uploadSigRef.current?.click()}
                                className="w-full drop-zone p-8 text-center"
                              >
                                <div className="flex flex-col items-center space-y-3">
                                  <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                                    <ImageIcon className="w-6 h-6 text-emerald-600" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-gray-700">
                                      Importer une image de signature
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      PNG, JPG ou WEBP
                                    </p>
                                  </div>
                                </div>
                              </button>
                            ) : (
                              <div className="space-y-3">
                                <div className="border border-gray-200 rounded-xl p-4 bg-white">
                                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Aperçu</p>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={uploadedSignaturePreview}
                                    alt="Signature importée"
                                    className="max-w-full h-auto max-h-32 mx-auto"
                                  />
                                </div>

                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => {
                                      setPendingSignatureData(uploadedSignaturePreview);
                                      handleUseItem(uploadedSignaturePreview, "signature");
                                    }}
                                    className="btn-primary flex-1 flex items-center justify-center space-x-2 !py-2.5 text-sm"
                                  >
                                    <MousePointer className="w-4 h-4" />
                                    <span>Placer</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setUploadedSignaturePreview(null);
                                      if (uploadSigRef.current) uploadSigRef.current.value = "";
                                    }}
                                    className="btn-secondary !py-2.5 !px-3 text-sm"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>

                                {isLoggedIn && (
                                  <button
                                    onClick={() => {
                                      setPendingSignatureData(uploadedSignaturePreview);
                                      setShowSaveForm(true);
                                      setCreationMode("draw");
                                    }}
                                    className="btn-secondary w-full flex items-center justify-center space-x-2 !py-2 text-sm"
                                  >
                                    <Save className="w-4 h-4" />
                                    <span>Enregistrer dans mon compte</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* ── Mode: Tampon d'entreprise ───────────────────── */}
                        {creationMode === "stamp" && (
                          <div className="space-y-4 animate-fade-in">
                            <p className="text-xs text-gray-500">
                              Importez le tampon ou cachet de votre entreprise (PNG avec transparence recommandé).
                            </p>

                            <input
                              ref={uploadStampRef}
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              onChange={handleUploadStamp}
                              className="hidden"
                            />

                            {!uploadedStampPreview ? (
                              <button
                                onClick={() => uploadStampRef.current?.click()}
                                className="w-full drop-zone p-8 text-center"
                              >
                                <div className="flex flex-col items-center space-y-3">
                                  <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center">
                                    <Stamp className="w-6 h-6 text-orange-600" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-gray-700">
                                      Importer un tampon d&apos;entreprise
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      PNG avec transparence recommandé
                                    </p>
                                  </div>
                                </div>
                              </button>
                            ) : (
                              <div className="space-y-3">
                                <div className="border border-gray-200 rounded-xl p-4 bg-white">
                                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Aperçu du tampon</p>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={uploadedStampPreview}
                                    alt="Tampon"
                                    className="max-w-full h-auto max-h-32 mx-auto"
                                  />
                                </div>

                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleUseItem(uploadedStampPreview, "stamp")}
                                    className="btn-primary flex-1 flex items-center justify-center space-x-2 !py-2.5 text-sm"
                                  >
                                    <MousePointer className="w-4 h-4" />
                                    <span>Placer le tampon</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setUploadedStampPreview(null);
                                      if (uploadStampRef.current) uploadStampRef.current.value = "";
                                    }}
                                    className="btn-secondary !py-2.5 !px-3 text-sm"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── TAB: Mes signatures ────────────────────────────── */}
                    {sidebarTab === "saved" && (
                      <div className="space-y-3 animate-fade-in">
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
                                Connectez-vous pour enregistrer et réutiliser vos signatures.
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

                        {isLoggedIn && isLoadingSignatures && (
                          <Loading message="Chargement..." size="sm" />
                        )}

                        {isLoggedIn && !isLoadingSignatures && savedSignatures.length === 0 && (
                          <div className="text-center py-8">
                            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                              <PenTool className="w-7 h-7 text-gray-300" />
                            </div>
                            <p className="text-sm font-medium text-gray-600">
                              Aucune signature enregistrée
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              Créez une signature et enregistrez-la dans l&apos;onglet «&nbsp;Créer&nbsp;».
                            </p>
                          </div>
                        )}

                        {isLoggedIn &&
                          !isLoadingSignatures &&
                          savedSignatures.map((sig) => (
                            <div
                              key={sig.id}
                              className="group border border-gray-200 rounded-xl p-3 hover:border-violet-300 hover:shadow-sm transition-all"
                            >
                              <div className="bg-gray-50 rounded-lg p-2 mb-2.5">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={sig.data} alt={sig.name} className="w-full h-16 object-contain" />
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-gray-700 truncate">{sig.name}</p>
                                  <p className="text-[10px] text-gray-400">{formatDate(sig.createdAt)}</p>
                                </div>
                                <div className="flex items-center space-x-1 ml-2">
                                  <button
                                    onClick={() => handleUseItem(sig.data, "signature")}
                                    className="p-2 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                                    title="Utiliser"
                                  >
                                    <PenTool className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSavedSignature(sig.id)}
                                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                    title="Supprimer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* ── TAB: Placées ────────────────────────────────────── */}
                    {sidebarTab === "placed" && (
                      <div className="space-y-3 animate-fade-in">
                        {placedItems.length === 0 && (
                          <div className="text-center py-8">
                            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                              <MousePointer className="w-7 h-7 text-gray-300" />
                            </div>
                            <p className="text-sm font-medium text-gray-600">
                              Aucun élément placé
                            </p>
                            <p className="text-xs text-gray-400 mt-1 max-w-[220px] mx-auto">
                              Créez une signature ou un tampon puis cliquez sur le PDF.
                            </p>
                          </div>
                        )}

                        {placedItems.length > 0 && (
                          <>
                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                              {placedItems.length} élément{placedItems.length > 1 ? "s" : ""} placé{placedItems.length > 1 ? "s" : ""}
                            </p>

                            {placedItems.map((item, idx) => {
                              const isStamp = item.type === "stamp";
                              return (
                                <div
                                  key={item.id}
                                  className={`border rounded-xl p-3 transition-all cursor-pointer ${
                                    selectedPlacedId === item.id
                                      ? isStamp
                                        ? "border-orange-400 bg-orange-50/60 shadow-sm"
                                        : "border-violet-400 bg-violet-50/60 shadow-sm"
                                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                                  }`}
                                  onClick={() => {
                                    setSelectedPlacedId(item.id);
                                    setCurrentPage(item.pageNumber);
                                  }}
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center space-x-2">
                                      <div
                                        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                                          isStamp ? "bg-orange-100" : "bg-violet-100"
                                        }`}
                                      >
                                        <span
                                          className={`text-[10px] font-bold ${
                                            isStamp ? "text-orange-700" : "text-violet-700"
                                          }`}
                                        >
                                          {idx + 1}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-sm font-medium text-gray-700">
                                          {isStamp ? "Tampon" : "Signature"} — Page {item.pageNumber}
                                        </span>
                                      </div>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removePlacedItem(item.id);
                                      }}
                                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  <div className="bg-white rounded-lg p-1.5 border border-gray-100 mb-2">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={item.dataUrl}
                                      alt={isStamp ? "Tampon" : "Signature"}
                                      className="w-full h-10 object-contain"
                                    />
                                  </div>

                                  {item.timestamp ? (
                                    <div className="flex items-center space-x-1.5 text-[10px] text-gray-500">
                                      <Clock className="w-3 h-3 flex-shrink-0" />
                                      <span>{item.timestamp}</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center space-x-1.5 text-[10px] text-amber-600">
                                      <Crown className="w-3 h-3 flex-shrink-0" />
                                      <span>Horodatage Pro uniquement</span>
                                    </div>
                                  )}

                                  {selectedPlacedId === item.id && (
                                    <div className="mt-3 pt-3 border-t border-gray-200/60 animate-fade-in">
                                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
                                        Taille
                                      </label>
                                      <input
                                        type="range"
                                        min="5"
                                        max="60"
                                        value={Math.round(item.widthPercent * 100)}
                                        onChange={(e) => {
                                          const newWidth = Number(e.target.value) / 100;
                                          setPlacedItems((prev) =>
                                            prev.map((s) =>
                                              s.id === item.id ? { ...s, widthPercent: newWidth } : s
                                            )
                                          );
                                        }}
                                        className={`w-full ${isStamp ? "accent-orange-600" : "accent-violet-600"}`}
                                      />
                                      <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                                        <span>Petit</span>
                                        <span className={`font-medium ${isStamp ? "text-orange-600" : "text-violet-600"}`}>
                                          {Math.round(item.widthPercent * 100)}%
                                        </span>
                                        <span>Grand</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}

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
                                <span>{isGenerating ? "Génération..." : "Télécharger le PDF signé"}</span>
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
