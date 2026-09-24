import {
  Bath,
  Bed,
  Coffee,
  DoorOpen,
  Fan,
  Home,
  Maximize,
  Sofa,
  Tv,
  Waves,
  type LucideIcon,
} from "lucide-react";

export const facilityIconMap: Record<string, LucideIcon> = {
  bathroom: Bath,
  bed: Bed,
  coffee: Coffee,
  door: DoorOpen,
  fan: Fan,
  home: Home,
  space: Maximize,
  living_room: Sofa,
  tv: Tv,
  water_heater: Waves,
};

export function FacilityIcon({ iconName }: { iconName: string | null }) {
  const Icon = (iconName && facilityIconMap[iconName]) || Home;
  return <Icon className="size-3.5" />;
}
