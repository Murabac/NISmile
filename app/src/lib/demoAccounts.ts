import type { StaffRole } from './database.types.ts'

export type DemoAccount = {
  role: StaffRole
  label: string
  name: string
  email: string
  password: string
}

/** Shared password for local role checks. Only used by the login quick buttons. */
export const DEMO_PASSWORD = 'dentaflow-demo'

export const demoAccounts: DemoAccount[] = [
  {
    role: 'owner',
    label: 'Owner',
    name: 'Demo Owner',
    email: 'owner@nismile.local',
    password: DEMO_PASSWORD,
  },
  {
    role: 'branch_manager',
    label: 'Branch Manager',
    name: 'Demo Manager',
    email: 'manager@nismile.local',
    password: DEMO_PASSWORD,
  },
  {
    role: 'receptionist',
    label: 'Receptionist',
    name: 'Demo Receptionist',
    email: 'receptionist@nismile.local',
    password: DEMO_PASSWORD,
  },
  {
    role: 'dentist',
    label: 'Dentist',
    name: 'Demo Dentist',
    email: 'dentist@nismile.local',
    password: DEMO_PASSWORD,
  },
  {
    role: 'storekeeper',
    label: 'Storekeeper',
    name: 'Demo Storekeeper',
    email: 'storekeeper@nismile.local',
    password: DEMO_PASSWORD,
  },
]
