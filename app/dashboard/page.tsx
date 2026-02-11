"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  PenTool,
  Image,
  Download,
  Trash2,
  Crown,
  Zap,
  Clock,
  BarChart3,
  Shield,
  ArrowRight,
  User,
  Calendar,
  FileOutput,
  Archive,
} from "lucide-react";
import { Loading } from "@/components/loading";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserInfo {
  userId: string;
  email: string;
  name: string;
  plan: string;
}

interface UsageInfo {
  authenticated: boolean;
  plan: string;
  todayCount: number;
  dailyLimit: number;
  canProcess: boolean;
  canUseTimestamp: boolean;
}

interface DocumentEntry {
  id: string;
  filename: string;
  originalName: string;
  type: string;
  action: string;
  size: number;
  createdAt: string;
}

interface SignatureEntry {
  id: string;
  name: string;
  data: string;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    fill: "Remplissage",
    convert: "Conversion",
    sign: "Signature",
    compress: "Compression",
  };
  return map[action] || action;
}

function actionColor(action: string): string {
  const map: Record<string, string> = {
    fill: "bg-blue-100 text-blue-700",
    convert: "bg-green-100 text-green-700",
    sign: "bg-orange-100 text-orange-700",
    compress: "bg-purple-100 text-purple-700",
  };
  return map[action] || "bg-gray-100 text-gray-700";
}

function actionIcon(action: string) {
  const map: Record<string, typeof FileText> = {
    fill: FileText,
    convert: Image,
    sign: PenTool,
    compress: Archive,
  };
  return map[action] || FileText;
}

function planBadge(plan: string) {
  if (plan === "pro") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700">
        <Crown className="w-3 h-3" />
        Pro
      </span>
    );
  }
  if (plan === "business") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
        <Shield className="w-3 h-3" />
        Business
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
      Gratuit
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [signatures, setSignatures] = useState<SignatureEntry[]>([]);
  const [deletingSignatureId, setDeletingSignatureId] = useState<string | null>(null);

  // ── Fetch all data ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const [meRes, usageRes, docsRes, sigsRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/usage"),
        fetch("/api/documents"),
        fetch("/api/signatures"),
      ]);

      // Not authenticated → redirect
      if (!meRes.ok) {
        router.push("/login");
        return;
      }

      const meData = await meRes.json();
      if (!meData.user) {
        router.push("/login");
        return;
      }

      setUser(meData.user);

      if (usageRes.ok) {
        const usageData = await usageRes.json();
        if (!usageData.authenticated) {
          router.push("/login");
          return;
        }
        setUsage(usageData);
      }

      if (docsRes.ok) {
        const docsData = await docsRes.json();
        setDocuments(docsData.documents || []);
        setTotalDocuments(docsData.totalDocuments || 0);
      }

      if (sigsRes.ok) {
        const sigsData = await sigsRes.json();
        setSignatures(sigsData.signatures || []);
      }
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Delete signature ────────────────────────────────────────────────────────

  const handleDeleteSignature = async (id: string) => {
    if (deletingSignatureId) return;
    setDeletingSignatureId(id);

    try {
      const res = await fetch(`/api/signatures?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setSignatures((prev) => prev.filter((s) => s.id !== id));
      }
    } catch {
      // silently fail
    } finally {
      setDeletingSignatureId(null);
    }
  };

  // ── Loading state ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loading message="Chargement du tableau de bord..." size="lg" />
      </div>
    );
  }

  if (!user) return null;

  const isFree = (user.plan || "free") === "free";
  const dailyLimit = usage?.dailyLimit ?? 2;
  const todayCount = usage?.todayCount ?? 0;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in">
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-bg opacity-5" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-2xl gradient-bg flex items-center justify-center shadow-lg shadow-primary-600/20">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                    Bonjour, {user.name} !
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-500">{user.email}</span>
                    {planBadge(user.plan)}
                  </div>
                </div>
              </div>
            </div>

            <Link
              href="/"
              className="btn-primary inline-flex items-center gap-2 text-sm w-fit"
            >
              <Zap className="w-4 h-4" />
              Utiliser les outils
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-8">
        {/* ── Stats cards ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Documents today */}
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Documents aujourd&apos;hui
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">
                  {todayCount}
                  {isFree && (
                    <span className="text-base font-normal text-gray-400">
                      {" "}
                      / {dailyLimit}
                    </span>
                  )}
                </p>
                {isFree && todayCount >= dailyLimit && (
                  <p className="text-xs text-red-500 font-medium mt-1">
                    Limite atteinte
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Current plan */}
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                user.plan === "pro"
                  ? "bg-violet-50"
                  : user.plan === "business"
                  ? "bg-orange-50"
                  : "bg-gray-50"
              }`}>
                <Crown className={`w-6 h-6 ${
                  user.plan === "pro"
                    ? "text-violet-600"
                    : user.plan === "business"
                    ? "text-orange-600"
                    : "text-gray-400"
                }`} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Plan actuel</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5 capitalize">
                  {user.plan === "free"
                    ? "Gratuit"
                    : user.plan === "pro"
                    ? "Pro"
                    : "Business"}
                </p>
                {!isFree && (
                  <p className="text-xs text-green-600 font-medium mt-1">
                    Documents illimités
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Signatures saved */}
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                <PenTool className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Signatures sauvegardées
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">
                  {signatures.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Free plan CTA ────────────────────────────────────────────────────── */}
        {isFree && (
          <div className="relative overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 via-purple-50 to-fuchsia-50 p-6 sm:p-8">
            <div className="absolute top-0 right-0 w-64 h-64 bg-violet-200/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <Crown className="w-6 h-6 text-violet-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Passez au plan Pro
                  </h3>
                  <p className="text-sm text-gray-600 mt-1 max-w-md">
                    Débloquez un nombre illimité de documents par jour, les signatures
                    horodatées et bien plus encore.
                  </p>
                </div>
              </div>
              <Link
                href="/pricing"
                className="btn-primary inline-flex items-center gap-2 text-sm whitespace-nowrap bg-violet-600 hover:bg-violet-700 shadow-violet-600/25 hover:shadow-violet-600/30"
              >
                <Crown className="w-4 h-4" />
                Voir les tarifs
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* ── Document history ─────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-bold text-gray-900">
                Historique des documents
              </h2>
              {totalDocuments > 0 && (
                <span className="text-sm text-gray-400 font-medium">
                  ({totalDocuments} au total)
                </span>
              )}
            </div>
          </div>

          {documents.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-gray-300" />
              </div>
              <h3 className="text-base font-semibold text-gray-700 mb-1">
                Aucun document pour l&apos;instant
              </h3>
              <p className="text-sm text-gray-400 max-w-sm mx-auto mb-6">
                Commencez à utiliser les outils SwaPDF pour voir votre historique
                apparaître ici.
              </p>
              <Link
                href="/"
                className="btn-secondary inline-flex items-center gap-2 text-sm"
              >
                <Zap className="w-4 h-4" />
                Découvrir les outils
              </Link>
            </div>
          ) : (
            <div className="card overflow-hidden">
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Nom original
                      </th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Taille
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {documents.map((doc) => {
                      const ActionIcon = actionIcon(doc.action);
                      return (
                        <tr
                          key={doc.id}
                          className="hover:bg-gray-50/50 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-gray-400" />
                              {formatDateTime(doc.createdAt)}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <span className="font-medium text-gray-800 truncate max-w-[250px]">
                                {doc.originalName}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${actionColor(
                                doc.action
                              )}`}
                            >
                              <ActionIcon className="w-3 h-3" />
                              {actionLabel(doc.action)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-xs font-mono text-gray-600 uppercase">
                              {doc.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-gray-500">
                            {formatFileSize(doc.size)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden divide-y divide-gray-100">
                {documents.map((doc) => {
                  const ActionIcon = actionIcon(doc.action);
                  return (
                    <div key={doc.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="font-medium text-gray-800 text-sm truncate">
                            {doc.originalName}
                          </span>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${actionColor(
                            doc.action
                          )}`}
                        >
                          <ActionIcon className="w-3 h-3" />
                          {actionLabel(doc.action)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(doc.createdAt)}
                        </span>
                        <span className="uppercase font-mono">{doc.type}</span>
                        <span>{formatFileSize(doc.size)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* ── Signatures ───────────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PenTool className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-bold text-gray-900">
                Mes signatures
              </h2>
              {signatures.length > 0 && (
                <span className="text-sm text-gray-400 font-medium">
                  ({signatures.length})
                </span>
              )}
            </div>
            {signatures.length > 0 && (
              <Link
                href="/sign-pdf"
                className="btn-secondary inline-flex items-center gap-2 text-xs !px-3 !py-1.5"
              >
                <PenTool className="w-3.5 h-3.5" />
                Signer un PDF
              </Link>
            )}
          </div>

          {signatures.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
                <PenTool className="w-8 h-8 text-orange-300" />
              </div>
              <h3 className="text-base font-semibold text-gray-700 mb-1">
                Aucune signature sauvegardée
              </h3>
              <p className="text-sm text-gray-400 max-w-sm mx-auto mb-6">
                Créez et sauvegardez vos signatures pour les réutiliser à tout
                moment lors de la signature de vos PDF.
              </p>
              <Link
                href="/sign-pdf"
                className="btn-primary inline-flex items-center gap-2 text-sm"
              >
                <PenTool className="w-4 h-4" />
                Créer une signature
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {signatures.map((sig) => (
                <div key={sig.id} className="card p-4 group">
                  {/* Signature preview */}
                  <div className="relative bg-gray-50 rounded-xl border border-gray-100 p-4 mb-3 flex items-center justify-center min-h-[120px]">
                    <img
                      src={sig.data}
                      alt={sig.name}
                      className="max-h-[90px] max-w-full object-contain"
                      draggable={false}
                    />

                    {/* Delete overlay */}
                    <button
                      onClick={() => handleDeleteSignature(sig.id)}
                      disabled={deletingSignatureId === sig.id}
                      className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-white/90 border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all duration-200 disabled:opacity-50"
                      title="Supprimer cette signature"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Info */}
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {sig.name}
                      </p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {formatDate(sig.createdAt)}
                      </p>
                    </div>
                    <Link
                      href="/sign-pdf"
                      className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center text-primary-600 hover:bg-primary-100 transition-colors"
                      title="Utiliser cette signature"
                    >
                      <Download className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
