import type { ServiceSlug } from "@/modules/lp/types";

type LocationGroup = {
  postcodeArea: string;
  locations: string[];
};

export type LocationEntry = {
  label: string;
  slug: string;
  postcodeArea: string;
};

export const locationGroups: LocationGroup[] = [
  {
    postcodeArea: "HA",
    locations: ["Ruislip", "Eastcote", "Harrow", "Stanmore", "Edgware", "Harefield"],
  },
  {
    postcodeArea: "W",
    locations: ["Ealing", "West Ealing", "Acton", "Chiswick", "Hammersmith"],
  },
  {
    postcodeArea: "WD",
    locations: ["Watford", "Rickmansworth"],
  },
  {
    postcodeArea: "UB",
    locations: ["Perivale", "Uxbridge", "Pinner", "Northwood", "Hillingdon", "Ickenham", "Greenford", "Denham", "Hayes"],
  },
  {
    postcodeArea: "SL",
    locations: ["Slough", "Iver", "Chalfont St Peter", "Chalfont St Giles", "Beaconsfield", "Windsor", "Maidenhead", "Marlow"],
  },
  {
    postcodeArea: "TW",
    locations: ["Heathrow", "Twickenham", "Sunbury-On-Thames"],
  },
  {
    postcodeArea: "HP",
    locations: ["High Wycombe", "Chesham", "Amersham"],
  },
  {
    postcodeArea: "GU",
    locations: ["Cobham", "Woking", "Guildford", "Camberley", "Farnborough", "Aldershot", "West Byfleet", "Chertsey"],
  },
  {
    postcodeArea: "KT",
    locations: [
      "Kingston-Upon-Thames",
      "Epsom",
      "Esher",
      "Weybridge",
      "Richmond",
      "Surbiton",
      "Walton-On-Thames",
      "Oxshott",
      "Ashtead",
      "Leatherhead",
      "Fetcham",
      "Chessington",
    ],
  },
];

export function normalizeLocationSlug(location: string) {
  return location
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const locationEntries = locationGroups.flatMap((group) =>
  group.locations.map((location) => ({
    label: location,
    slug: normalizeLocationSlug(location),
    postcodeArea: group.postcodeArea,
  })),
);

const locationEntryMap = new Map(locationEntries.map((location) => [location.slug, location]));

export function getAllLocationEntries() {
  return locationEntries;
}

export function getLocationEntry(location: string) {
  return locationEntryMap.get(normalizeLocationSlug(location));
}

export function buildLpPath(service: ServiceSlug, locationSlug: string) {
  return `/lp/${service}/${locationSlug}`;
}
