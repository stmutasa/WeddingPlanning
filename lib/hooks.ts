"use client";

import useSWR, { useSWRConfig } from "swr";
import { useCallback } from "react";
import { fetcher } from "./api";
import type {
  AiModelsDto,
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
/**
 * Whether the assistant can actually answer right now: switched on in
 * Settings and with a usable model on one of the two providers. Screens ask
 * this before offering an AI affordance, so a keyless server shows the
 * manual path from the first paint rather than after a failed call.
 */
export function useAiEnabled(): { ready: boolean; enabled: boolean; reason: string | null } {
  const { data } = useSWR<AiModelsDto>("/api/ai/models", fetcher);
  if (!data) return { ready: false, enabled: false, reason: null };
  if (!data.enabled) return { ready: true, enabled: false, reason: "The assistant is switched off in Settings." };
  if (!data.primary && !data.backup) {
    return { ready: true, enabled: false, reason: "No AI provider key is configured on this server." };
  }
  return { ready: true, enabled: true, reason: null };
}

export function useRefreshAll() {
  const { mutate } = useSWRConfig();
  return useCallback(() => {
    void mutate(() => true, undefined, { revalidate: true });
  }, [mutate]);
}
