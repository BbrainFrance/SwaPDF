import Link from "next/link";
import { LucideIcon } from "lucide-react";

interface ToolCardProps {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

export function ToolCard({
  title,
  description,
  href,
  icon: Icon,
  color,
  bgColor,
}: ToolCardProps) {
  return (
    <Link href={href} className="block group">
      <div className="card-interactive p-8">
        <div
          className={`w-14 h-14 rounded-2xl ${bgColor} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}
        >
          <Icon className={`w-7 h-7 ${color}`} />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
        <div className="mt-4 flex items-center text-sm font-medium text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <span>Commencer</span>
          <svg
            className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </div>
    </Link>
  );
}
