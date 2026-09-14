import type { CategoryDto, EventDto, FunderDto, PersonDto, VendorDto } from "@/lib/api-types";

export interface CatalogBundle {
  events: EventDto[];
  categories: CategoryDto[];
  funders: FunderDto[];
  vendors: VendorDto[];
  people: PersonDto[];
}
