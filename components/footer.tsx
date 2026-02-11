import { FileText } from "lucide-react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold gradient-text">
                PDF Tools
              </span>
            </div>
            <p className="text-gray-500 text-sm max-w-md">
              Votre boîte à outils PDF complète. Remplissez, convertissez,
              signez et éditez vos documents en toute simplicité.
            </p>
          </div>

          {/* Tools */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Outils
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/pdf-fill"
                  className="text-sm text-gray-500 hover:text-primary-600 transition-colors"
                >
                  Remplir PDF
                </Link>
              </li>
              <li>
                <Link
                  href="/pdf-to-image"
                  className="text-sm text-gray-500 hover:text-primary-600 transition-colors"
                >
                  PDF vers Image
                </Link>
              </li>
              <li>
                <Link
                  href="/image-to-pdf"
                  className="text-sm text-gray-500 hover:text-primary-600 transition-colors"
                >
                  Image vers PDF
                </Link>
              </li>
              <li>
                <Link
                  href="/sign-pdf"
                  className="text-sm text-gray-500 hover:text-primary-600 transition-colors"
                >
                  Signer PDF
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Informations
            </h3>
            <ul className="space-y-2">
              <li>
                <span className="text-sm text-gray-500">
                  Traitement 100% local
                </span>
              </li>
              <li>
                <span className="text-sm text-gray-500">
                  Vos fichiers restent privés
                </span>
              </li>
              <li>
                <span className="text-sm text-gray-500">Gratuit</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-100">
          <p className="text-sm text-gray-400 text-center">
            &copy; {new Date().getFullYear()} PDF Tools. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
}
