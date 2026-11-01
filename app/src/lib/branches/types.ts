export type BranchRegion = 'somaliland' | 'ethiopia'

export type Branch = {
  id: string
  name: string
  region: BranchRegion
  address: string | null
  phone: string | null
  tax_id: string | null
  zaad: string | null
  edahab: string | null
  mycash: string | null
  active: boolean
  created_at: string
}

export type BranchInput = {
  name: string
  region: BranchRegion
  address?: string | null
  phone?: string | null
  tax_id?: string | null
  zaad?: string | null
  edahab?: string | null
  mycash?: string | null
}

export type DeleteBranchResult = {
  id: string
  mode: 'deleted' | 'deactivated'
  message: string
}
