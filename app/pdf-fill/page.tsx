"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  FileText,
  Download,
  Plus,
  Type,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  MousePointer,
  X,
  CheckSquare,
  List,
  Edit3,
  Layers,
  RotateCcw,
} from "lucide-react";
import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFName, rgb } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import { FileUpload } from "@/components/file-upload";
import { Loading } from "@/components/loading";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormField {
  name: string;
  type: "text" | "checkbox" | "dropdown";
  value: string;
  options?: string[];
  page: number;
  rect?: { x: number; y: number; width: number; height: number };
}

interface TextAnnotation {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
  page: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PdfFillPage() {
  // File & PDF state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocument | null>(null);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form fields state
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [annotations, setAnnotations] = useState<TextAnnotation[]>([]);

  // UI state
  const [addTextMode, setAddTextMode] = useState(false);
  const [newAnnotationText, setNewAnnotationText] = useState("Texte");
  const [newAnnotationFontSize, setNewAnnotationFontSize] = useState(14);
  const [newAnnotationColor, setNewAnnotationColor] = useState("#000000");
  const [showFieldsSidebar, setShowFieldsSidebar] = useState(true);
  const [activeTab, setActiveTab] = useState<"fields" | "annotations">("fields");
  const [zoom, setZoom] = useState(1.5);

  // Refs
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const pageCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

  // ─── Initialize PDF.js worker ─────────────────────────────────────────────

  useEffect(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }, []);

  // ─── Render PDF pages to canvas images ────────────────────────────────────

  const renderPdfPages = useCallback(
    async (arrayBuffer: ArrayBuffer) => {
      try {
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) });
        const pdf = await loadingTask.promise;
        const pages = pdf.numPages;
        setTotalPages(pages);

        const images: string[] = [];

        for (let i = 1; i <= pages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: zoom });

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d")!;
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({ canvasContext: context, viewport }).promise;
          images.push(canvas.toDataURL("image/png"));
        }

        setPageImages(images);
      } catch (error) {
        console.error("Erreur lors du rendu PDF :", error);
      }
    },
    [zoom]
  );

  // ─── Extract AcroForm fields ──────────────────────────────────────────────

  const extractFormFields = useCallback(async (pdfDocument: PDFDocument) => {
    const form = pdfDocument.getForm();
    const fields = form.getFields();
    const extracted: FormField[] = [];

    for (const field of fields) {
      const name = field.getName();
      const widgets = field.acroField.getWidgets();

      let page = 0;
      let rect: FormField["rect"] = undefined;

      if (widgets.length > 0) {
        const widget = widgets[0];
        const r = widget.getRectangle();
        rect = { x: r.x, y: r.y, width: r.width, height: r.height };

        // Try to find which page this field belongs to
        const pages = pdfDocument.getPages();
        const annotsKey = PDFName.of("Annots");
        for (let i = 0; i < pages.length; i++) {
          const annotsRef = pages[i].node.get(annotsKey);
          if (annotsRef) {
            page = i;
            break;
          }
        }
      }

      if (field instanceof PDFTextField) {
        extracted.push({
          name,
          type: "text",
          value: field.getText() || "",
          page,
          rect,
        });
      } else if (field instanceof PDFCheckBox) {
        extracted.push({
          name,
          type: "checkbox",
          value: field.isChecked() ? "true" : "false",
          page,
          rect,
        });
      } else if (field instanceof PDFDropdown) {
        const options = field.getOptions();
        const selected = field.getSelected();
        extracted.push({
          name,
          type: "dropdown",
          value: selected.length > 0 ? selected[0] : "",
          options,
          page,
          rect,
        });
      }
    }

    setFormFields(extracted);
  }, []);

  // ─── Handle file upload ───────────────────────────────────────────────────

  const handleFileSelected = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      const file = files[0];
      setPdfFile(file);
      setIsLoading(true);
      setFormFields([]);
      setAnnotations([]);
      setCurrentPage(0);

      try {
        const arrayBuffer = await file.arrayBuffer();
        setPdfBytes(arrayBuffer);

        // Load with pdf-lib for form fields
        const pdfDocument = await PDFDocument.load(arrayBuffer, {
          ignoreEncryption: true,
        });
        setPdfDoc(pdfDocument);

        // Extract form fields
        await extractFormFields(pdfDocument);

        // Render pages
        await renderPdfPages(arrayBuffer);
      } catch (error) {
        console.error("Erreur lors du chargement du PDF :", error);
      } finally {
        setIsLoading(false);
      }
    },
    [extractFormFields, renderPdfPages]
  );

  // ─── Update form field value ──────────────────────────────────────────────

  const updateFieldValue = useCallback(
    (index: number, value: string) => {
      setFormFields((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], value };
        return updated;
      });
    },
    []
  );

  // ─── Handle click on PDF to add annotation ────────────────────────────────

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, pageIndex: number) => {
      if (!addTextMode) return;

      const container = e.currentTarget;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const annotation: TextAnnotation = {
        id: `ann-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        x,
        y,
        text: newAnnotationText,
        fontSize: newAnnotationFontSize,
        color: newAnnotationColor,
        page: pageIndex,
      };

      setAnnotations((prev) => [...prev, annotation]);
    },
    [addTextMode, newAnnotationText, newAnnotationFontSize, newAnnotationColor]
  );

  // ─── Remove annotation ───────────────────────────────────────────────────

  const removeAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // ─── Update annotation text ───────────────────────────────────────────────

  const updateAnnotationText = useCallback((id: string, text: string) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, text } : a))
    );
  }, []);

  // ─── Apply fields and download ────────────────────────────────────────────

  const handleDownload = useCallback(async () => {
    if (!pdfBytes) return;

    setIsProcessing(true);

    try {
      // Reload the PDF from original bytes
      const pdfDocument = await PDFDocument.load(pdfBytes, {
        ignoreEncryption: true,
      });
      const form = pdfDocument.getForm();

      // Apply form field values
      for (const field of formFields) {
        try {
          if (field.type === "text") {
            const textField = form.getTextField(field.name);
            textField.setText(field.value);
          } else if (field.type === "checkbox") {
            const checkBox = form.getCheckBox(field.name);
            if (field.value === "true") {
              checkBox.check();
            } else {
              checkBox.uncheck();
            }
          } else if (field.type === "dropdown") {
            const dropdown = form.getDropdown(field.name);
            if (field.value) {
              dropdown.select(field.value);
            }
          }
        } catch (err) {
          console.warn(`Impossible de remplir le champ "${field.name}" :`, err);
        }
      }

      // Add text annotations
      const pages = pdfDocument.getPages();
      for (const annotation of annotations) {
        if (annotation.page < pages.length) {
          const page = pages[annotation.page];
          const { width, height } = page.getSize();

          // Convert screen coordinates to PDF coordinates
          // The image is rendered at the zoom scale, so we need to divide
          const pdfX = annotation.x / zoom;
          // PDF Y is from bottom, screen Y is from top
          const pdfY = height - annotation.y / zoom;

          // Parse hex color to RGB
          const hexColor = annotation.color.replace("#", "");
          const r = parseInt(hexColor.substring(0, 2), 16) / 255;
          const g = parseInt(hexColor.substring(2, 4), 16) / 255;
          const b = parseInt(hexColor.substring(4, 6), 16) / 255;

          page.drawText(annotation.text, {
            x: pdfX,
            y: pdfY,
            size: annotation.fontSize,
            color: rgb(r, g, b),
          });
        }
      }

      // Flatten form (optional: makes fields non-editable)
      try {
        form.flatten();
      } catch {
        // Some forms can't be flattened, that's ok
      }

      const modifiedPdfBytes = await pdfDocument.save();
      const blob = new Blob([modifiedPdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = pdfFile
        ? pdfFile.name.replace(".pdf", "_rempli.pdf")
        : "document_rempli.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erreur lors du téléchargement :", error);
    } finally {
      setIsProcessing(false);
    }
  }, [pdfBytes, pdfFile, formFields, annotations, zoom]);

  // ─── Re-render pages when zoom changes ────────────────────────────────────

  useEffect(() => {
    if (pdfBytes && pageImages.length > 0) {
      renderPdfPages(pdfBytes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  // ─── Reset everything ─────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setPdfFile(null);
    setPdfDoc(null);
    setPdfBytes(null);
    setPageImages([]);
    setFormFields([]);
    setAnnotations([]);
    setCurrentPage(0);
    setTotalPages(0);
    setAddTextMode(false);
  }, []);

  // ─── Annotations for current page ────────────────────────────────────────

  const currentPageAnnotations = annotations.filter(
    (a) => a.page === currentPage
  );

  // ─── Get field icon ───────────────────────────────────────────────────────

  const getFieldIcon = (type: FormField["type"]) => {
    switch (type) {
      case "text":
        return <Type className="w-4 h-4" />;
      case "checkbox":
        return <CheckSquare className="w-4 h-4" />;
      case "dropdown":
        return <List className="w-4 h-4" />;
      default:
        return <Type className="w-4 h-4" />;
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in min-h-screen">
      {/* Header */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-bg opacity-5" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    Remplir un PDF
                  </h1>
                  <p className="text-gray-500 mt-1">
                    Remplissez les champs de formulaire et ajoutez du texte
                    librement sur vos documents PDF
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
                <button
                  onClick={handleDownload}
                  disabled={isProcessing}
                  className="btn-primary flex items-center space-x-2 !py-2.5 !px-4"
                >
                  <Download className="w-4 h-4" />
                  <span>{isProcessing ? "Traitement..." : "Télécharger le PDF"}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {/* Upload Area */}
        {!pdfFile && !isLoading && (
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
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                  <Edit3 className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Champs de formulaire
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Détection automatique des champs AcroForm
                </p>
              </div>
              <div className="card p-5 text-center">
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mx-auto mb-3">
                  <MousePointer className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Texte libre
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Cliquez n&apos;importe où pour ajouter du texte
                </p>
              </div>
              <div className="card p-5 text-center">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center mx-auto mb-3">
                  <Download className="w-5 h-5 text-purple-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Téléchargement
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Exportez votre PDF rempli en un clic
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="card p-12">
            <Loading message="Chargement et analyse du PDF en cours..." />
          </div>
        )}

        {/* PDF Editor View */}
        {pdfFile && !isLoading && pageImages.length > 0 && (
          <div className="animate-slide-up">
            {/* Toolbar */}
            <div className="card p-4 mb-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                {/* Left: Page navigation */}
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(0, prev - 1))
                    }
                    disabled={currentPage === 0}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm font-medium text-gray-700">
                    Page {currentPage + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentPage((prev) =>
                        Math.min(totalPages - 1, prev + 1)
                      )
                    }
                    disabled={currentPage === totalPages - 1}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Center: Tools */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setAddTextMode(!addTextMode)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      addTextMode
                        ? "bg-primary-600 text-white shadow-lg shadow-primary-600/25"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    <span>Ajouter du texte</span>
                  </button>

                  <button
                    onClick={() => setShowFieldsSidebar(!showFieldsSidebar)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      showFieldsSidebar
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <Eye className="w-4 h-4" />
                    <span>Panneau latéral</span>
                  </button>
                </div>

                {/* Right: Zoom */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">Zoom :</span>
                  <select
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value={0.75}>75%</option>
                    <option value={1}>100%</option>
                    <option value={1.25}>125%</option>
                    <option value={1.5}>150%</option>
                    <option value={2}>200%</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Add Text Options (shown when in add text mode) */}
            {addTextMode && (
              <div className="card p-4 mb-6 border-primary-200 bg-primary-50/30 animate-fade-in">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center space-x-2">
                    <MousePointer className="w-4 h-4 text-primary-600" />
                    <span className="text-sm font-medium text-primary-700">
                      Mode ajout de texte actif — Cliquez sur le PDF pour
                      positionner votre texte
                    </span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <label className="text-xs text-gray-600">Texte :</label>
                      <input
                        type="text"
                        value={newAnnotationText}
                        onChange={(e) => setNewAnnotationText(e.target.value)}
                        className="input-field !py-1.5 !px-3 !w-40 text-sm"
                        placeholder="Votre texte..."
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <label className="text-xs text-gray-600">Taille :</label>
                      <input
                        type="number"
                        value={newAnnotationFontSize}
                        onChange={(e) =>
                          setNewAnnotationFontSize(
                            Math.max(6, Math.min(72, parseInt(e.target.value) || 14))
                          )
                        }
                        className="input-field !py-1.5 !px-3 !w-20 text-sm"
                        min={6}
                        max={72}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <label className="text-xs text-gray-600">
                        Couleur :
                      </label>
                      <input
                        type="color"
                        value={newAnnotationColor}
                        onChange={(e) => setNewAnnotationColor(e.target.value)}
                        className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer"
                      />
                    </div>
                    <button
                      onClick={() => setAddTextMode(false)}
                      className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Split View */}
            <div className="flex gap-6">
              {/* PDF Preview */}
              <div
                className={`flex-1 transition-all duration-300 ${
                  showFieldsSidebar ? "" : "w-full"
                }`}
              >
                <div className="card p-4">
                  <div
                    ref={canvasContainerRef}
                    className="relative overflow-auto max-h-[75vh] rounded-xl bg-gray-50"
                  >
                    {/* Current page */}
                    <div
                      className="relative inline-block"
                      onClick={(e) => handleCanvasClick(e, currentPage)}
                      style={{
                        cursor: addTextMode ? "crosshair" : "default",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={pageImages[currentPage]}
                        alt={`Page ${currentPage + 1}`}
                        className="block rounded-lg shadow-md"
                        draggable={false}
                      />

                      {/* Annotation overlays */}
                      {currentPageAnnotations.map((annotation) => (
                        <div
                          key={annotation.id}
                          className="absolute group"
                          style={{
                            left: `${annotation.x}px`,
                            top: `${annotation.y}px`,
                            transform: "translate(0, -100%)",
                          }}
                        >
                          <span
                            style={{
                              fontSize: `${annotation.fontSize * (zoom / 1.5)}px`,
                              color: annotation.color,
                              fontFamily: "Helvetica, Arial, sans-serif",
                              whiteSpace: "nowrap",
                              userSelect: "none",
                              pointerEvents: "auto",
                            }}
                          >
                            {annotation.text}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeAnnotation(annotation.id);
                            }}
                            className="absolute -top-2 -right-5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}

                      {/* Add text mode overlay indicator */}
                      {addTextMode && (
                        <div className="absolute inset-0 border-2 border-dashed border-primary-400 rounded-lg pointer-events-none bg-primary-50/10" />
                      )}
                    </div>
                  </div>

                  {/* Page thumbnails */}
                  {totalPages > 1 && (
                    <div className="mt-4 flex space-x-2 overflow-x-auto pb-2">
                      {pageImages.map((img, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentPage(index)}
                          className={`flex-shrink-0 relative rounded-lg overflow-hidden border-2 transition-all ${
                            currentPage === index
                              ? "border-primary-500 shadow-lg shadow-primary-500/20"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img}
                            alt={`Miniature page ${index + 1}`}
                            className="w-16 h-20 object-cover object-top"
                          />
                          <div
                            className={`absolute bottom-0 inset-x-0 text-center text-[10px] py-0.5 font-medium ${
                              currentPage === index
                                ? "bg-primary-600 text-white"
                                : "bg-gray-800/60 text-white"
                            }`}
                          >
                            {index + 1}
                          </div>
                          {/* Badge for annotations */}
                          {annotations.filter((a) => a.page === index).length >
                            0 && (
                            <div className="absolute top-1 right-1 w-4 h-4 bg-orange-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold">
                              {
                                annotations.filter((a) => a.page === index)
                                  .length
                              }
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar */}
              {showFieldsSidebar && (
                <div className="w-[380px] flex-shrink-0 animate-fade-in">
                  <div className="card overflow-hidden sticky top-4">
                    {/* Tabs */}
                    <div className="flex border-b border-gray-100">
                      <button
                        onClick={() => setActiveTab("fields")}
                        className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3.5 text-sm font-medium transition-colors ${
                          activeTab === "fields"
                            ? "text-primary-600 border-b-2 border-primary-600 bg-primary-50/50"
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <Layers className="w-4 h-4" />
                        <span>
                          Champs{" "}
                          {formFields.length > 0 && (
                            <span className="ml-1 bg-primary-100 text-primary-700 text-xs px-1.5 py-0.5 rounded-full">
                              {formFields.length}
                            </span>
                          )}
                        </span>
                      </button>
                      <button
                        onClick={() => setActiveTab("annotations")}
                        className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3.5 text-sm font-medium transition-colors ${
                          activeTab === "annotations"
                            ? "text-primary-600 border-b-2 border-primary-600 bg-primary-50/50"
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <Type className="w-4 h-4" />
                        <span>
                          Annotations{" "}
                          {annotations.length > 0 && (
                            <span className="ml-1 bg-orange-100 text-orange-700 text-xs px-1.5 py-0.5 rounded-full">
                              {annotations.length}
                            </span>
                          )}
                        </span>
                      </button>
                    </div>

                    {/* Fields Tab */}
                    {activeTab === "fields" && (
                      <div className="p-4 max-h-[65vh] overflow-y-auto">
                        {formFields.length === 0 ? (
                          <div className="text-center py-12">
                            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                              <Layers className="w-7 h-7 text-gray-400" />
                            </div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-1">
                              Aucun champ détecté
                            </h3>
                            <p className="text-xs text-gray-500 leading-relaxed max-w-[240px] mx-auto">
                              Ce PDF ne contient pas de champs de formulaire
                              AcroForm. Vous pouvez ajouter du texte librement
                              en utilisant le bouton &quot;Ajouter du
                              texte&quot;.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {formFields.map((field, index) => (
                              <div
                                key={`${field.name}-${index}`}
                                className="p-3 rounded-xl border border-gray-100 hover:border-gray-200 bg-gray-50/50 hover:bg-white transition-all"
                              >
                                {/* Field header */}
                                <div className="flex items-center space-x-2 mb-2">
                                  <div
                                    className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                                      field.type === "text"
                                        ? "bg-blue-100 text-blue-600"
                                        : field.type === "checkbox"
                                        ? "bg-green-100 text-green-600"
                                        : "bg-purple-100 text-purple-600"
                                    }`}
                                  >
                                    {getFieldIcon(field.type)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-gray-700 truncate">
                                      {field.name}
                                    </p>
                                    <p className="text-[10px] text-gray-400 capitalize">
                                      {field.type === "text"
                                        ? "Champ texte"
                                        : field.type === "checkbox"
                                        ? "Case à cocher"
                                        : "Liste déroulante"}
                                    </p>
                                  </div>
                                </div>

                                {/* Field input */}
                                {field.type === "text" && (
                                  <input
                                    type="text"
                                    value={field.value}
                                    onChange={(e) =>
                                      updateFieldValue(index, e.target.value)
                                    }
                                    placeholder="Saisir une valeur..."
                                    className="input-field !py-2 !px-3 text-sm"
                                  />
                                )}

                                {field.type === "checkbox" && (
                                  <label className="flex items-center space-x-3 cursor-pointer mt-1">
                                    <div className="relative">
                                      <input
                                        type="checkbox"
                                        checked={field.value === "true"}
                                        onChange={(e) =>
                                          updateFieldValue(
                                            index,
                                            e.target.checked ? "true" : "false"
                                          )
                                        }
                                        className="sr-only peer"
                                      />
                                      <div className="w-10 h-5 bg-gray-200 peer-checked:bg-primary-600 rounded-full transition-colors" />
                                      <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm peer-checked:translate-x-5 transition-transform" />
                                    </div>
                                    <span className="text-sm text-gray-700">
                                      {field.value === "true"
                                        ? "Coché"
                                        : "Non coché"}
                                    </span>
                                  </label>
                                )}

                                {field.type === "dropdown" && (
                                  <select
                                    value={field.value}
                                    onChange={(e) =>
                                      updateFieldValue(index, e.target.value)
                                    }
                                    className="input-field !py-2 !px-3 text-sm"
                                  >
                                    <option value="">
                                      — Sélectionner —
                                    </option>
                                    {field.options?.map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Annotations Tab */}
                    {activeTab === "annotations" && (
                      <div className="p-4 max-h-[65vh] overflow-y-auto">
                        {annotations.length === 0 ? (
                          <div className="text-center py-12">
                            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                              <Type className="w-7 h-7 text-gray-400" />
                            </div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-1">
                              Aucune annotation
                            </h3>
                            <p className="text-xs text-gray-500 leading-relaxed max-w-[240px] mx-auto">
                              Utilisez le bouton &quot;Ajouter du texte&quot;
                              puis cliquez sur le PDF pour placer du texte.
                            </p>
                            <button
                              onClick={() => setAddTextMode(true)}
                              className="mt-4 inline-flex items-center space-x-2 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                              <span>Ajouter du texte</span>
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {annotations.map((annotation, index) => (
                              <div
                                key={annotation.id}
                                className="p-3 rounded-xl border border-gray-100 hover:border-gray-200 bg-gray-50/50 hover:bg-white transition-all"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex items-center space-x-2">
                                    <div
                                      className="w-4 h-4 rounded-full border-2 border-white shadow-sm flex-shrink-0"
                                      style={{
                                        backgroundColor: annotation.color,
                                      }}
                                    />
                                    <span className="text-xs text-gray-400">
                                      Page {annotation.page + 1} •{" "}
                                      {annotation.fontSize}px
                                    </span>
                                  </div>
                                  <button
                                    onClick={() =>
                                      removeAnnotation(annotation.id)
                                    }
                                    className="p-1 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  value={annotation.text}
                                  onChange={(e) =>
                                    updateAnnotationText(
                                      annotation.id,
                                      e.target.value
                                    )
                                  }
                                  className="input-field !py-2 !px-3 text-sm"
                                />
                              </div>
                            ))}

                            {/* Add more button */}
                            <button
                              onClick={() => setAddTextMode(true)}
                              className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:text-primary-600 hover:border-primary-300 transition-colors flex items-center justify-center space-x-2"
                            >
                              <Plus className="w-4 h-4" />
                              <span>Ajouter une annotation</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sidebar footer */}
                    <div className="border-t border-gray-100 p-4">
                      <button
                        onClick={handleDownload}
                        disabled={isProcessing}
                        className="btn-primary w-full flex items-center justify-center space-x-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>
                          {isProcessing
                            ? "Traitement en cours..."
                            : "Télécharger le PDF rempli"}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
