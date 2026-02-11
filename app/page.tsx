import { FileText, Image, PenTool, Shield, Zap, Lock, FileOutput } from "lucide-react";
import { ToolCard } from "@/components/tool-card";

const tools = [
  {
    title: "Remplir PDF",
    description:
      "Remplissez les champs de vos formulaires PDF directement dans votre navigateur. Sélectionnez les champs et saisissez vos informations.",
    href: "/pdf-fill",
    icon: FileText,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    title: "PDF vers Image",
    description:
      "Convertissez vos fichiers PDF en images JPG ou PNG de haute qualité. Chaque page devient une image individuelle.",
    href: "/pdf-to-image",
    icon: Image,
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  {
    title: "Image vers PDF",
    description:
      "Transformez vos images JPG, PNG et autres en un document PDF unique. Organisez l'ordre des pages facilement.",
    href: "/image-to-pdf",
    icon: FileOutput,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  {
    title: "Signer PDF",
    description:
      "Apposez votre signature numérique avec horodatage. Sauvegardez vos signatures pour les réutiliser.",
    href: "/sign-pdf",
    icon: PenTool,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
];

const features = [
  {
    icon: Zap,
    title: "Rapide & Local",
    description:
      "Tout le traitement se fait dans votre navigateur. Aucun fichier n'est envoyé sur un serveur.",
  },
  {
    icon: Lock,
    title: "Sécurisé",
    description:
      "Vos documents restent privés et ne quittent jamais votre appareil pendant le traitement.",
  },
  {
    icon: Shield,
    title: "Gratuit",
    description:
      "Tous les outils sont gratuits et sans limite. Créez un compte pour sauvegarder vos signatures.",
  },
];

export default function Home() {
  return (
    <div className="animate-fade-in">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-bg opacity-5" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center space-x-2 bg-primary-50 text-primary-700 px-4 py-2 rounded-full text-sm font-medium mb-8">
              <Zap className="w-4 h-4" />
              <span>100% gratuit et sécurisé</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-gray-900 leading-tight tracking-tight">
              Tous vos outils
              <br />
              <span className="gradient-text">PDF en un seul endroit</span>
            </h1>

            <p className="mt-6 text-xl text-gray-500 leading-relaxed max-w-2xl mx-auto">
              Remplissez, convertissez, signez et éditez vos documents PDF
              directement dans votre navigateur. Simple, rapide et sécurisé.
            </p>
          </div>
        </div>
      </section>

      {/* Tools Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {tools.map((tool) => (
            <ToolCard key={tool.href} {...tool} />
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">
              Pourquoi choisir SwaPDF ?
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              Des outils pensés pour la simplicité et la confidentialité
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="text-center p-8">
                  <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-5">
                    <Icon className="w-7 h-7 text-primary-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-500 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
