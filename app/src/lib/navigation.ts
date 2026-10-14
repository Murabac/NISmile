import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  CalendarDays,
  FileSpreadsheet,
  LayoutDashboard,
  MessageSquare,
  Percent,
  Settings,
  Receipt,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
} from 'lucide-react'
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
    id: 'services',
    label: 'Services',
    path: '/services',
    icon: Sparkles,
    roles: ['owner', 'branch_manager', 'dentist'],
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
    roles: ['owner', 'branch_manager', 'receptionist'],
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

export function screensForRole(role: StaffRole) {
  return screens.filter((screen) => screen.roles.includes(role))
}

export function screenByPath(path: string) {
  return screens.find((screen) => screen.path === path)
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
