export interface KtrAreaRow {
  id: string;
  name: string;
  locationDescription: string | null;
  streamUrl: string | null;
  isActive: boolean;
  assignedEmployee: { id: string; name: string } | null;
  detectionCount: number;
}

export interface OfficerOption {
  id: string;
  name: string;
}
