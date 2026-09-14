"use client";

import useSWR, { useSWRConfig } from "swr";
import { useCallback } from "react";
import { fetcher } from "./api";
import type {
  AppSettingsDto,
  CategoryDto,
  EventDto,
  FunderDto,
  PersonDto,
  UserSettingsDto,
  VendorDto,
  WeddingDto,
} from "./api-types";

/**
 * The reference data every screen needs (events, categories, funders,
 * vendors, the two people). SWR dedupes these across components, so each
 * one is fetched once per page even though several cards ask for it.
 */
export function useCatalog() {
  const events = useSWR<EventDto[]>("/api/events", fetcher);
  const categories = useSWR<CategoryDto[]>("/api/categories", fetcher);
  const funders = useSWR<FunderDto[]>("/api/funders", fetcher);
  const vendors = useSWR<VendorDto[]>("/api/vendors", fetcher);
  const people = useSWR<PersonDto[]>("/api/people", fetcher);

  return {
    events: events.data ?? [],
    categories: categories.data ?? [],
    funders: funders.data ?? [],
    vendors: vendors.data ?? [],
    people: people.data ?? [],
    loading: !events.data || !categories.data || !funders.data,
  };
}

export function useMe() {
  const { data, mutate } = useSWR<UserSettingsDto>("/api/settings/me", fetcher);
  return { me: data, timezone: data?.timezone, mutate };
}

export function useWedding() {
  const { data, mutate } = useSWR<WeddingDto>("/api/wedding", fetcher);
  return { wedding: data, mutate };
}

export function useAppSettings() {
  const { data, mutate } = useSWR<AppSettingsDto>("/api/settings/app", fetcher);
  return { appSettings: data, mutate };
}

/**
 * Revalidate everything after a write. One expense touches the budget, the
 * activity feed, the settle-up and the event rows, so screens ask for a
 * blanket refresh rather than naming each key.
 */
export function useRefreshAll() {
  const { mutate } = useSWRConfig();
  return useCallback(() => {
    void mutate(() => true, undefined, { revalidate: true });
  }, [mutate]);
}
