import {
  LayoutDashboard,
  Building2,
  Users,
  Wallet,
  HandCoins,
  Receipt,
  Landmark,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type Role = "admin" | "financeiro" | "diretor" | "corretor";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  financeiro: "Financeiro",
  diretor: "Diretor",
  corretor: "Corretor",
};

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Perfis que enxergam o item no menu. */
  roles: Role[];
}

/** Navegação principal do sistema, com os perfis que têm acesso a cada área. */
export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["admin", "financeiro", "diretor"],
  },
  {
    label: "Vendas",
    href: "/vendas",
    icon: Building2,
    roles: ["admin", "financeiro", "diretor"],
  },
  {
    label: "Corretores",
    href: "/corretores",
    icon: Users,
    roles: ["admin", "financeiro", "diretor"],
  },
  {
    label: "Entradas",
    href: "/entradas",
    icon: Wallet,
    roles: ["admin", "financeiro"],
  },
  {
    label: "Adiantamentos",
    href: "/adiantamentos",
    icon: Receipt,
    roles: ["admin", "financeiro"],
  },
  {
    label: "Pagamentos",
    href: "/pagamentos",
    icon: HandCoins,
    roles: ["admin", "financeiro"],
  },
  {
    label: "Financeiro",
    href: "/financeiro",
    icon: Landmark,
    roles: ["admin", "financeiro", "diretor"],
  },
  {
    label: "Relatórios",
    href: "/relatorios",
    icon: BarChart3,
    roles: ["admin", "financeiro", "diretor"],
  },
  {
    label: "Meu extrato",
    href: "/meu-extrato",
    icon: Wallet,
    roles: ["corretor"],
  },
  {
    label: "Configurações",
    href: "/configuracoes",
    icon: Settings,
    roles: ["admin"],
  },
];

/** Filtra os itens de navegação visíveis para um perfil. */
export function navParaPerfil(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

/** Sub-navegação do módulo Financeiro. */
export const FINANCEIRO_SUBNAV = [
  { label: "Caixa", href: "/financeiro/caixa" },
  { label: "A Pagar", href: "/financeiro/a-pagar" },
  { label: "Fluxo de Caixa", href: "/financeiro/fluxo" },
  { label: "Custos Fixos", href: "/financeiro/custos-fixos" },
  { label: "Despesas Variáveis", href: "/financeiro/despesas-variaveis" },
  { label: "Investimentos", href: "/financeiro/investimentos" },
  { label: "Pessoal", href: "/financeiro/pessoal" },
  { label: "Zefer Joinville", href: "/financeiro/joinville" },
];

/** Sub-navegação do módulo Relatórios. */
export const RELATORIOS_SUBNAV = [
  { label: "Por Corretor", href: "/relatorios/por-corretor" },
  { label: "Por Construtora", href: "/relatorios/por-construtora" },
  { label: "Por Empreendimento", href: "/relatorios/por-empreendimento" },
  { label: "Fluxo de Caixa", href: "/relatorios/fluxo-caixa" },
  { label: "DRE Simplificado", href: "/relatorios/dre" },
];
