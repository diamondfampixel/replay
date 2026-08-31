"use client";

import {
  BarChart3, FlaskConical, FileText, FolderTree, History, Image, Layers, LayoutDashboard,
  Mail, Package, Plug, Settings, ShoppingBag, Sparkles, Star, Store, Tag, Users,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  BarChart3, FlaskConical, FileText, FolderTree, History, Image, Layers, LayoutDashboard,
  Mail, Package, Plug, Settings, ShoppingBag, Sparkles, Star, Store, Tag, Users,
};

export function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? LayoutDashboard;
  return <Icon className={className} aria-hidden="true" />;
}
