"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Image,
  PenTool,
  Menu,
  X,
  LogIn,
  LogOut,
  User,
  FileOutput,
  Archive,
  Crown,
  LayoutDashboard,
} from "lucide-react";

const tools = [
  {
    name: "Remplir PDF",
    href: "/pdf-fill",
    icon: FileText,
    color: "text-blue-600",
  },
  {
    name: "PDF → Image",
    href: "/pdf-to-image",
    icon: Image,
    color: "text-green-600",
  },
  {
    name: "Image → PDF",
    href: "/image-to-pdf",
    icon: FileOutput,
    color: "text-purple-600",
  },
  {
    name: "Compresser",
    href: "/compress-pdf",
    icon: Archive,
    color: "text-red-600",
  },
  {
    name: "Signer PDF",
    href: "/sign-pdf",
    icon: PenTool,
    color: "text-orange-600",
  },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<{
    name: string;
    email: string;
    plan?: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.href = "/";
  };

  return (
    <nav className="sticky top-0 z-50 glass border-b border-gray-200/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="w-9 h-9 rounded-xl gradient-bg flex items-center justify-center shadow-lg shadow-primary-600/20 group-hover:shadow-primary-600/40 transition-shadow">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">SwaPDF</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-0.5">
            {tools.map((tool) => {
              const Icon = tool.icon;
              const isActive = pathname === tool.href;
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-primary-50 text-primary-700"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? tool.color : ""}`} />
                  <span>{tool.name}</span>
                </Link>
              );
            })}
            <Link
              href="/pricing"
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                pathname === "/pricing"
                  ? "bg-amber-50 text-amber-700"
                  : "text-amber-600 hover:text-amber-700 hover:bg-amber-50"
              }`}
            >
              <Crown className="w-4 h-4" />
              <span>Tarifs</span>
            </Link>
          </div>

          {/* User Menu */}
          <div className="hidden md:flex items-center space-x-3">
            {user ? (
              <div className="flex items-center space-x-2">
                <Link
                  href="/dashboard"
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg transition-colors ${
                    pathname === "/dashboard"
                      ? "bg-primary-50 text-primary-700"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="text-sm font-medium">{user.name}</span>
                  {user.plan && user.plan !== "free" && (
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
                      {user.plan}
                    </span>
                  )}
                </Link>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Déconnexion"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center space-x-2 btn-primary text-sm !px-4 !py-2"
              >
                <LogIn className="w-4 h-4" />
                <span>Connexion</span>
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-200 bg-white animate-fade-in">
          <div className="px-4 py-3 space-y-1">
            {tools.map((tool) => {
              const Icon = tool.icon;
              const isActive = pathname === tool.href;
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? "bg-primary-50 text-primary-700"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${tool.color}`} />
                  <span>{tool.name}</span>
                </Link>
              );
            })}
            <Link
              href="/pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium text-amber-600 hover:bg-amber-50"
            >
              <Crown className="w-5 h-5" />
              <span>Tarifs</span>
            </Link>
            <div className="pt-3 border-t border-gray-100">
              {user ? (
                <>
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium text-primary-600 hover:bg-primary-50"
                  >
                    <LayoutDashboard className="w-5 h-5" />
                    <span>Tableau de bord</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 w-full"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Déconnexion</span>
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium text-primary-600 hover:bg-primary-50"
                >
                  <LogIn className="w-5 h-5" />
                  <span>Connexion</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
