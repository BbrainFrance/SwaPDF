"use client";

import { useRef, useState, useEffect } from "react";
import { Eraser, Save, RotateCcw, Palette } from "lucide-react";

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  width?: number;
  height?: number;
  initialData?: string;
}

const COLORS = ["#000000", "#1e40af", "#dc2626", "#059669"];

export function SignaturePad({
  onSave,
  width = 600,
  height = 200,
  initialData,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(2);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (initialData) {
      const img = new window.Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        setHasDrawn(true);
      };
      img.src = initialData;
    }
  }, [initialData]);

  const getCoords = (
    e: React.MouseEvent | React.TouchEvent
  ): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl);
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="signature-canvas w-full touch-none"
          style={{ maxWidth: `${width}px` }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-400 text-sm">
              Dessinez votre signature ici
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Colors */}
        <div className="flex items-center space-x-2">
          <Palette className="w-4 h-4 text-gray-400" />
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full border-2 transition-all ${
                color === c
                  ? "border-primary-500 scale-110"
                  : "border-gray-200 hover:border-gray-400"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        {/* Line width */}
        <div className="flex items-center space-x-2">
          <input
            type="range"
            min="1"
            max="6"
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="w-20 accent-primary-600"
          />
          <span className="text-xs text-gray-500">{lineWidth}px</span>
        </div>

        <div className="flex-1" />

        {/* Actions */}
        <button
          onClick={clearCanvas}
          className="flex items-center space-x-1.5 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
        >
          <Eraser className="w-4 h-4" />
          <span>Effacer</span>
        </button>

        <button
          onClick={() => {
            clearCanvas();
            if (initialData) {
              const canvas = canvasRef.current;
              if (!canvas) return;
              const ctx = canvas.getContext("2d");
              if (!ctx) return;
              const img = new window.Image();
              img.onload = () => {
                ctx.drawImage(img, 0, 0);
                setHasDrawn(true);
              };
              img.src = initialData;
            }
          }}
          className="flex items-center space-x-1.5 px-3 py-2 text-sm text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Réinitialiser</span>
        </button>

        <button
          onClick={handleSave}
          disabled={!hasDrawn}
          className="flex items-center space-x-1.5 btn-primary !px-4 !py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          <span>Sauvegarder</span>
        </button>
      </div>
    </div>
  );
}
