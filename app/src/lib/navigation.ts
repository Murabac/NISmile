import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeftRight,
  Award,
  BarChart3,
  Boxes,
  CalendarDays,
  FileSpreadsheet,
  LayoutDashboard,
  MessageSquare,
  Package,
  Percent,
  Settings,
  Receipt,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
  Wallet,
} from 'lucide-react'
import type { BranchKind } from './branches/types.ts'
import type { StaffRole } from './database.types.ts'

const allRoles: StaffRole[] = [
  'owner',
  'branch_manager',
  'receptionist',
  'dentist',
  'storekeeper',
]

export type Screen = {
  id: string
  label: string
  path: string
  icon: LucideIcon
  roles: StaffRole[]
  /** When set, screen is only shown for that branch kind. Omitted = both. */
  branchKinds?: BranchKind[]
  highlight?: boolean
  promo?: boolean
  allowsAllBranches?: boolean
}

export const screens: Screen[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/',
    icon: LayoutDashboard,
    roles: allRoles,
    allowsAllBranches: true,
  },
  {
    id: 'pos',
    label: 'Point of Sale',
    path: '/pos',
    icon: ShoppingCart,
    roles: ['owner', 'branch_manager', 'receptionist', 'dentist'],
    branchKinds: ['clinic'],
    highlight: true,
  },
  {
    id: 'wholesale',
    label: 'Wholesale Orders',
    path: '/wholesale',
    icon: Package,
    roles: ['owner', 'branch_manager'],
    branchKinds: ['warehouse'],
    highlight: true,
  },
  {
    id: 'sales',
    label: 'Sales',
    path: '/sales',
    icon: Receipt,
    roles: ['owner', 'branch_manager', 'receptionist', 'dentist'],
  },
  {
    id: 'stock',
    label: 'Stock',
    path: '/stock',
    icon: Boxes,
    roles: ['owner', 'branch_manager', 'storekeeper'],
  },
  {
    id: 'transfers',
    label: 'Transfers',
    path: '/transfers',
    icon: ArrowLeftRight,
    roles: ['owner', 'branch_manager', 'storekeeper'],
  },
  {
    id: 'purchases',
    label: 'Purchases',
    path: '/purchases',
    icon: Truck,
    roles: ['owner', 'branch_manager', 'storekeeper'],
  },
  {
    id: 'expenses',
    label: 'Expenses',
    path: '/expenses',
    icon: Wallet,
    roles: ['owner', 'branch_manager', 'receptionist'],
  },
  {
    id: 'services',
    label: 'Services',
    path: '/services',
    icon: Sparkles,
    roles: ['owner', 'branch_manager', 'dentist'],
    branchKinds: ['clinic'],
  },
  {
    id: 'customers',
    label: 'Customers',
    path: '/customers',
    icon: Users,
    roles: ['owner', 'branch_manager', 'receptionist'],
  },
  {
    id: 'appointments',
    label: 'Appointments',
    path: '/appointments',
    icon: CalendarDays,
    roles: ['owner', 'branch_manager', 'receptionist', 'dentist'],
    branchKinds: ['clinic'],
  },
  {
    id: 'promotions',
    label: 'Promotions',
    path: '/promotions',
    icon: Percent,
    roles: ['owner'],
    promo: true,
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    path: '/whatsapp',
    icon: MessageSquare,
    // Technical queue / templates / Process due — owner only.
    // Other roles send WhatsApp from POS, Customers, Appointments, Promotions buttons.
    roles: ['owner'],
  },
  {
    id: 'reports',
    label: 'Reports',
    path: '/reports',
    icon: BarChart3,
    roles: ['owner', 'branch_manager'],
    allowsAllBranches: true,
  },
  {
    id: 'staff-performance',
    label: 'Staff performance',
    path: '/staff-performance',
    icon: Award,
    roles: ['owner'],
    allowsAllBranches: true,
  },
  {
    id: 'import',
    label: 'Import',
    path: '/import',
    icon: FileSpreadsheet,
    roles: ['owner', 'branch_manager'],
  },
  {
    id: 'settings',
    label: 'Settings',
    path: '/settings',
    icon: Settings,
    roles: ['owner'],
  },
]

export function screensForRole(role: StaffRole, branchKind?: BranchKind | null) {
  return screens.filter((screen) => {
    if (!screen.roles.includes(role)) return false
    if (!screen.branchKinds || screen.branchKinds.length === 0) return true
    // Owner "All branches": show clinic screens; wholesale needs a warehouse selected.
    if (!branchKind) return !screen.branchKinds.includes('warehouse')
    return screen.branchKinds.includes(branchKind)
  })
}

export function screenByPath(path: string) {
  return screens.find((screen) => screen.path === path)
}

export function screenAllowedForBranch(
  screen: Screen | undefined,
  branchKind: BranchKind | null,
): boolean {
  if (!screen) return true
  if (!screen.branchKinds || screen.branchKinds.length === 0) return true
  if (!branchKind) return !screen.branchKinds.includes('warehouse')
  return screen.branchKinds.includes(branchKind)
}

export function roleLabel(role: StaffRole) {
  const labels: Record<StaffRole, string> = {
    owner: 'Owner',
    branch_manager: 'Branch Manager',
    receptionist: 'Receptionist',
    dentist: 'Dentist',
    storekeeper: 'Storekeeper',
  }
  return labels[role]
}
