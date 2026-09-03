import type { Capability } from "@/lib/permissions";

export type NavItem = {
  label: string;
  href: string;
  icon: string; // lucide icon name
  capability?: Capability;
  /** Match nested routes under this href. */
  exact?: boolean;
};

export type NavGroup = { label?: string; items: NavItem[] };

/** Settings sub-navigation, shared by the settings nav component and the
 *  route-existence test so both stay in lockstep with the real pages. */
export const SETTINGS_NAV: NavGroup[] = [
  {
    label: "Store",
    items: [
      { label: "General", href: "/admin/settings", icon: "Settings" },
      { label: "Brand", href: "/admin/settings/brand", icon: "Palette" },
      { label: "Design", href: "/admin/settings/design", icon: "Wand2" },
      { label: "Domain", href: "/admin/settings/domain", icon: "Globe" },
    ],
  },
  {
    label: "Commerce",
    items: [
      { label: "Payments", href: "/admin/settings/payments", icon: "CreditCard" },
      { label: "Shipping", href: "/admin/settings/shipping", icon: "Truck" },
      { label: "Taxes", href: "/admin/settings/taxes", icon: "Receipt" },
    ],
  },
  {
    label: "Platform",
    items: [
      { label: "Notifications", href: "/admin/settings/notifications", icon: "Bell" },
      { label: "AI assistant", href: "/admin/settings/ai", icon: "Sparkles" },
      { label: "Users & roles", href: "/admin/settings/team", icon: "Users", capability: "team:manage" },
      { label: "Data", href: "/admin/settings/data", icon: "Database" },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Plan & billing", href: "/admin/settings/billing", icon: "CreditCard", capability: "billing:manage" },
      { label: "Your profile", href: "/admin/settings/profile", icon: "User" },
    ],
  },
];

export const ADMIN_NAV: NavGroup[] = [
  {
    items: [
      { label: "Overview", href: "/admin", icon: "LayoutDashboard", exact: true, capability: "analytics:read" },
      { label: "AI Assistant", href: "/admin/assistant", icon: "Sparkles", capability: "ai:use" },
    ],
  },
  {
    label: "Sell",
    items: [
      { label: "Orders", href: "/admin/orders", icon: "ShoppingBag", capability: "orders:read" },
      { label: "Products", href: "/admin/products", icon: "Package", capability: "catalog:read" },
      { label: "Collections", href: "/admin/collections", icon: "Layers", capability: "catalog:read" },
      { label: "Categories", href: "/admin/categories", icon: "FolderTree", capability: "catalog:read" },
      { label: "Customers", href: "/admin/customers", icon: "Users", capability: "customers:read" },
      { label: "Discounts", href: "/admin/discounts", icon: "Tag", capability: "marketing:read" },
      { label: "Reviews", href: "/admin/reviews", icon: "Star", capability: "content:read" },
    ],
  },
  {
    label: "Storefront",
    items: [
      { label: "Store", href: "/admin/store", icon: "Store", capability: "storefront:read" },
      { label: "Themes", href: "/admin/store/themes", icon: "Palette", capability: "storefront:read" },
      { label: "Content", href: "/admin/content", icon: "FileText", capability: "content:read" },
      { label: "Media", href: "/admin/media", icon: "Image", capability: "content:read" },
    ],
  },
  {
    label: "Grow",
    items: [
      { label: "Analytics", href: "/admin/analytics", icon: "BarChart3", capability: "analytics:read" },
      { label: "A/B Testing", href: "/admin/experiments", icon: "FlaskConical", capability: "experiments:read" },
      { label: "Emails", href: "/admin/emails", icon: "Mail", capability: "marketing:read" },
    ],
  },
  {
    label: "Platform",
    items: [
      { label: "Integrations", href: "/admin/integrations", icon: "Plug", capability: "integrations:read" },
      { label: "Activity", href: "/admin/activity", icon: "History", capability: "settings:read" },
      { label: "Settings", href: "/admin/settings", icon: "Settings", capability: "settings:read" },
    ],
  },
];
