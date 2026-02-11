"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  X,
  Zap,
  Crown,
  Building2,
  Star,
  Shield,
  ArrowRight,
  HelpCircle,
} from "lucide-react";

/* ───────────────────────── Data ───────────────────────── */

const plans = [
  {
    id: "free",
    name: "Gratuit",
    price: "0",
    period: "/mois",
    description: "Idéal pour un usage occasionnel de vos documents PDF.",
    icon: Zap,
    iconBg: "bg-gray-100",
    iconColor: "text-gray-600",
    popular: false,
    features: [
      "2 documents par jour",
      "Remplissage de PDF",
      "Conversion PDF ↔ Image",
      "Compression PDF standard",
      "Signature sans horodatage",
    ],
    cta: "Commencer gratuitement",
    ctaStyle: "btn-secondary w-full justify-center",
  },
  {
    id: "pro",
    name: "Pro",
    price: "9",
    period: "/mois",
    description:
      "Pour les professionnels qui travaillent quotidiennement avec des PDF.",
    icon: Crown,
    iconBg: "bg-primary-100",
    iconColor: "text-primary-600",
    popular: true,
    features: [
      "Documents illimités",
      "Toutes les fonctionnalités gratuites",
      "Signature avec horodatage certifié",
      "Compression avancée",
      "Historique complet des documents",
      "Sauvegarde illimitée des signatures",
      "Support prioritaire",
    ],
    cta: "Choisir Pro",
    ctaStyle: "btn-primary w-full justify-center",
  },
  {
    id: "business",
    name: "Business",
    price: "29",
    period: "/mois",
    description:
      "Solution complète pour les équipes et entreprises exigeantes.",
    icon: Building2,
    iconBg: "bg-accent-100",
    iconColor: "text-accent-600",
    popular: false,
    features: [
      "Tout le plan Pro",
      "Multi-utilisateurs (jusqu'à 10)",
      "Tampons d'entreprise multiples",
      "API d'intégration",
      "Marque blanche",
      "Support dédié",
      "SLA garanti",
    ],
    cta: "Contacter",
    ctaStyle: "btn-secondary w-full justify-center",
  },
];

/* Comparison table rows: [label, free, pro, business] — true/false = check/x, string = text */
type CellValue = boolean | string;

const comparisonSections: {
  title: string;
  rows: [string, CellValue, CellValue, CellValue][];
}[] = [
  {
    title: "Documents",
    rows: [
      ["Documents par jour", "2", "Illimité", "Illimité"],
      ["Remplissage de PDF", true, true, true],
      ["Conversion PDF ↔ Image", true, true, true],
      ["Compression PDF", "Standard", "Avancée", "Avancée"],
      ["Historique des documents", false, true, true],
    ],
  },
  {
    title: "Signature",
    rows: [
      ["Signature électronique", true, true, true],
      ["Horodatage certifié", false, true, true],
      ["Sauvegarde des signatures", "3 max", "Illimitée", "Illimitée"],
    ],
  },
  {
    title: "Collaboration & Entreprise",
    rows: [
      ["Multi-utilisateurs", false, false, "Jusqu'à 10"],
      ["Tampons d'entreprise", false, false, true],
      ["API d'intégration", false, false, true],
      ["Marque blanche", false, false, true],
    ],
  },
  {
    title: "Support",
    rows: [
      ["Support email", true, true, true],
      ["Support prioritaire", false, true, true],
      ["Support dédié", false, false, true],
      ["SLA garanti", false, false, true],
    ],
  },
];

const faqs = [
  {
    q: "Puis-je utiliser SwaPDF gratuitement ?",
    a: "Oui ! Le plan Gratuit vous donne accès aux fonctionnalités essentielles : remplissage de PDF, conversion PDF ↔ Image, compression standard et signature électronique. Vous êtes limité à 2 documents par jour.",
  },
  {
    q: "Comment fonctionne la période d'essai du plan Pro ?",
    a: "Le plan Pro sera bientôt disponible. Dès son lancement, vous bénéficierez d'une période d'essai gratuite de 14 jours, sans engagement ni carte bancaire requise.",
  },
  {
    q: "Mes documents sont-ils sécurisés ?",
    a: "Absolument. Tout le traitement PDF se fait directement dans votre navigateur. Vos fichiers ne sont jamais envoyés sur nos serveurs. Seules les métadonnées (historique, signatures sauvegardées) sont stockées de manière chiffrée.",
  },
  {
    q: "Puis-je changer de plan à tout moment ?",
    a: "Oui, vous pouvez passer d'un plan à un autre à tout moment. Si vous passez à un plan supérieur, la différence sera calculée au prorata. Si vous revenez au plan Gratuit, votre abonnement restera actif jusqu'à la fin de la période en cours.",
  },
  {
    q: "Qu'est-ce que l'horodatage certifié ?",
    a: "L'horodatage certifié est une preuve juridique de la date et l'heure exactes auxquelles un document a été signé. Il est conforme au règlement eIDAS et est accepté dans toute l'Union européenne.",
  },
  {
    q: "Le plan Business inclut-il une facturation centralisée ?",
    a: "Oui. Le plan Business offre une facturation unique pour toute l'équipe, un tableau de bord administrateur, et la possibilité d'ajouter ou retirer des utilisateurs facilement.",
  },
];

/* ───────────────────────── Helpers ───────────────────────── */

function CellDisplay({ value }: { value: CellValue }) {
  if (value === true)
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100">
        <Check className="w-4 h-4 text-green-600" />
      </span>
    );
  if (value === false)
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100">
        <X className="w-4 h-4 text-gray-400" />
      </span>
    );
  return <span className="text-sm font-medium text-gray-700">{value}</span>;
}

/* ───────────────────────── Page ───────────────────────── */

export default function PricingPage() {
  const [showProTooltip, setShowProTooltip] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="animate-fade-in">
      {/* ────────── Hero ────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-bg opacity-5" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-4 text-center">
          <div className="inline-flex items-center space-x-2 bg-primary-50 text-primary-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Star className="w-4 h-4" />
            <span>Tarification simple et transparente</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 leading-tight tracking-tight">
            Le bon plan pour
            <br />
            <span className="gradient-text">chaque besoin</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Commencez gratuitement, puis évoluez à votre rythme.
            <br className="hidden sm:block" />
            Pas de surprise, pas de frais cachés.
          </p>
        </div>
      </section>

      {/* ────────── Pricing Cards ────────── */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isPro = plan.id === "pro";
            const isBusiness = plan.id === "business";

            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl border-2 p-8 flex flex-col transition-all duration-300 ${
                  isPro
                    ? "border-primary-500 bg-white shadow-2xl shadow-primary-500/10 md:-mt-4 md:mb-4 scale-[1.02] md:scale-105"
                    : "border-gray-200 bg-white shadow-sm hover:shadow-lg hover:border-gray-300"
                }`}
              >
                {/* Popular badge */}
                {isPro && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center space-x-1.5 bg-gradient-to-r from-primary-600 to-accent-600 text-white text-sm font-bold px-5 py-1.5 rounded-full shadow-lg shadow-primary-600/30">
                      <Crown className="w-4 h-4" />
                      <span>Populaire</span>
                    </span>
                  </div>
                )}

                {/* Icon + Name */}
                <div className="flex items-center space-x-3 mb-4 mt-2">
                  <div
                    className={`w-11 h-11 rounded-xl ${plan.iconBg} flex items-center justify-center`}
                  >
                    <Icon className={`w-6 h-6 ${plan.iconColor}`} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {plan.name}
                  </h3>
                </div>

                {/* Price */}
                <div className="flex items-end space-x-1 mb-2">
                  <span
                    className={`text-5xl font-black tracking-tight ${
                      isPro ? "gradient-text" : "text-gray-900"
                    }`}
                  >
                    {plan.price}€
                  </span>
                  <span className="text-gray-400 font-medium mb-1.5">
                    {plan.period}
                  </span>
                </div>

                <p className="text-gray-500 text-sm leading-relaxed mb-6">
                  {plan.description}
                </p>

                {/* Divider */}
                <div className="h-px bg-gray-100 mb-6" />

                {/* Features */}
                <ul className="space-y-3.5 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start space-x-3">
                      <span
                        className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                          isPro
                            ? "bg-primary-100 text-primary-600"
                            : "bg-green-100 text-green-600"
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" strokeWidth={3} />
                      </span>
                      <span className="text-sm text-gray-700 leading-snug">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {plan.id === "free" && (
                  <Link
                    href="/login"
                    className={`${plan.ctaStyle} inline-flex items-center space-x-2 text-center`}
                  >
                    <span>Commencer gratuitement</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}

                {plan.id === "pro" && (
                  <div className="relative">
                    <button
                      onClick={() => setShowProTooltip(!showProTooltip)}
                      className={`${plan.ctaStyle} inline-flex items-center space-x-2`}
                    >
                      <span>Choisir Pro</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    {/* Tooltip */}
                    {showProTooltip && (
                      <>
                        {/* Backdrop */}
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowProTooltip(false)}
                        />
                        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 animate-fade-in">
                          <div className="bg-gray-900 text-white rounded-xl px-5 py-4 shadow-2xl text-center">
                            <div className="flex items-center justify-center space-x-2 mb-2">
                              <Shield className="w-5 h-5 text-primary-400" />
                              <span className="font-bold text-sm">
                                Bientôt disponible
                              </span>
                            </div>
                            <p className="text-gray-300 text-xs leading-relaxed">
                              Le plan Pro arrive très prochainement. Créez votre
                              compte gratuit dès maintenant pour être informé en
                              priorité du lancement !
                            </p>
                            <Link
                              href="/login"
                              className="mt-3 inline-flex items-center space-x-1 text-primary-400 hover:text-primary-300 text-xs font-semibold transition-colors"
                              onClick={() => setShowProTooltip(false)}
                            >
                              <span>Créer un compte</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          </div>
                          {/* Arrow */}
                          <div className="flex justify-center">
                            <div className="w-3 h-3 bg-gray-900 rotate-45 -mt-1.5" />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {isBusiness && (
                  <a
                    href="mailto:contact@swapdf.com"
                    className={`${plan.ctaStyle} inline-flex items-center space-x-2 text-center`}
                  >
                    <span>Contacter</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ────────── Comparison Table ────────── */}
      <section className="bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
              Comparez les plans en détail
            </h2>
            <p className="mt-4 text-gray-500 text-lg">
              Toutes les fonctionnalités, côte à côte
            </p>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              {/* Header */}
              <thead>
                <tr>
                  <th className="text-left py-4 pr-6 w-1/3" />
                  {plans.map((plan) => (
                    <th
                      key={plan.id}
                      className={`text-center py-4 px-4 w-[22%] ${
                        plan.popular
                          ? "bg-primary-50/60 rounded-t-2xl"
                          : ""
                      }`}
                    >
                      <div className="text-lg font-bold text-gray-900">
                        {plan.name}
                      </div>
                      <div className="text-sm text-gray-500 font-medium mt-0.5">
                        {plan.price}€{plan.period}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {comparisonSections.map((section) => (
                  <>
                    {/* Section header */}
                    <tr key={`section-${section.title}`}>
                      <td
                        colSpan={4}
                        className="pt-8 pb-3 text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-200"
                      >
                        {section.title}
                      </td>
                    </tr>
                    {/* Rows */}
                    {section.rows.map(([label, free, pro, business]) => (
                      <tr
                        key={String(label)}
                        className="border-b border-gray-100 last:border-b-0"
                      >
                        <td className="py-4 pr-6 text-sm text-gray-600">
                          {label}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex justify-center">
                            <CellDisplay value={free} />
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center bg-primary-50/30">
                          <div className="flex justify-center">
                            <CellDisplay value={pro} />
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex justify-center">
                            <CellDisplay value={business} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile comparison — accordion per plan */}
          <div className="md:hidden space-y-6">
            {plans.map((plan) => {
              const planIdx = plans.indexOf(plan);
              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl border-2 overflow-hidden ${
                    plan.popular
                      ? "border-primary-500"
                      : "border-gray-200"
                  }`}
                >
                  <div
                    className={`px-5 py-4 ${
                      plan.popular ? "bg-primary-50" : "bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-gray-900">
                          {plan.name}
                        </span>
                        <span className="ml-2 text-sm text-gray-500">
                          {plan.price}€{plan.period}
                        </span>
                      </div>
                      {plan.popular && (
                        <span className="text-xs font-bold text-primary-600 bg-primary-100 px-2.5 py-1 rounded-full">
                          Populaire
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="px-5 py-4 space-y-2">
                    {comparisonSections.map((section) => (
                      <div key={section.title}>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-3">
                          {section.title}
                        </div>
                        {section.rows.map(([label, ...vals]) => (
                          <div
                            key={String(label)}
                            className="flex items-center justify-between py-1.5"
                          >
                            <span className="text-sm text-gray-600">
                              {label}
                            </span>
                            <CellDisplay value={vals[planIdx]} />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ────────── FAQ ────────── */}
      <section className="border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <div className="inline-flex items-center space-x-2 bg-accent-50 text-accent-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <HelpCircle className="w-4 h-4" />
              <span>Questions fréquentes</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
              Vous avez des questions ?
            </h2>
            <p className="mt-3 text-gray-500 text-lg">
              Retrouvez les réponses aux questions les plus posées
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <div
                  key={i}
                  className={`rounded-2xl border transition-all duration-300 ${
                    isOpen
                      ? "border-primary-200 bg-primary-50/40 shadow-sm"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="w-full flex items-center justify-between px-6 py-5 text-left"
                  >
                    <span
                      className={`font-semibold pr-4 ${
                        isOpen ? "text-primary-700" : "text-gray-900"
                      }`}
                    >
                      {faq.q}
                    </span>
                    <span
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                        isOpen
                          ? "bg-primary-100 text-primary-600 rotate-45"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                    </span>
                  </button>

                  {/* Collapsible answer */}
                  <div
                    className={`overflow-hidden transition-all duration-300 ${
                      isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                    }`}
                  >
                    <div className="px-6 pb-5 text-gray-600 leading-relaxed text-sm">
                      {faq.a}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom CTA */}
          <div className="mt-12 text-center">
            <p className="text-gray-500 mb-4">
              Vous ne trouvez pas la réponse à votre question ?
            </p>
            <a
              href="mailto:contact@swapdf.com"
              className="btn-secondary inline-flex items-center space-x-2"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Contactez-nous</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
