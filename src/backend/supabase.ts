import {
  createRandomStoredGenome,
  normalizeStoredGenome,
  type FishGenomeRecord,
  type StoredGenome
} from '../evolution/genomes';

export interface ActiveFishSlotRecord {
  slot_index: number;
  fish_id: string;
  activated_at: string;
  fish: FishGenomeRecord;
}

interface FishGenomeRow {
  id: string;
  genome: unknown;
  generation: number;
  parent_a: string | null;
  parent_b: string | null;
  fitness: number;
  created_at: string;
}

interface ActiveFishSlotRow {
  slot_index: number;
  fish_id: string | null;
  activated_at: string;
  fish_genomes: FishGenomeRow | FishGenomeRow[] | null;
}

const ACTIVE_SLOT_COUNT = 7;
const env = import.meta.env as ImportMetaEnv & Record<string, string | undefined>;
const supabaseUrl = normalizeEnvValue(env.VITE_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? '');
const supabaseAnonKey = normalizeEnvValue(env.VITE_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '');

export function hasSupabaseConfig(): boolean {
  return supabaseUrl.length > 0 && supabaseAnonKey.length > 0;
}

export async function loadActiveFishSlots(): Promise<ActiveFishSlotRecord[]> {
  ensureConfig();
  const rows = await request<ActiveFishSlotRow[]>(
    '/rest/v1/active_fish_slots?select=slot_index,fish_id,activated_at,fish_genomes(id,genome,generation,parent_a,parent_b,fitness,created_at)&order=slot_index.asc'
  );

  const slots = rows.flatMap((row) => {
    const fish = Array.isArray(row.fish_genomes) ? row.fish_genomes[0] : row.fish_genomes;
    if (!row.fish_id || !fish) return [];
    return [{
      slot_index: row.slot_index,
      fish_id: row.fish_id,
      activated_at: row.activated_at,
      fish: normalizeFishGenomeRow(fish)
    }];
  });

  if (slots.length === ACTIVE_SLOT_COUNT) return slots;
  return bootstrapMissingSlots(slots);
}

export async function fetchFishPopulation(): Promise<FishGenomeRecord[]> {
  ensureConfig();
  const rows = await request<FishGenomeRow[]>('/rest/v1/fish_genomes?select=id,genome,generation,parent_a,parent_b,fitness,created_at&order=created_at.desc&limit=200');
  return rows.map(normalizeFishGenomeRow);
}

export async function createFishGenome(input: {
  genome?: StoredGenome;
  generation?: number;
  parentA?: string | null;
  parentB?: string | null;
  fitness?: number;
} = {}): Promise<FishGenomeRecord> {
  ensureConfig();
  const rows = await request<FishGenomeRow[]>('/rest/v1/fish_genomes?select=id,genome,generation,parent_a,parent_b,fitness,created_at', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      genome: input.genome ?? createRandomStoredGenome(),
      generation: input.generation ?? 0,
      parent_a: input.parentA ?? null,
      parent_b: input.parentB ?? null,
      fitness: input.fitness ?? 0
    })
  });
  return normalizeFishGenomeRow(rows[0]);
}

export async function updateFishFitness(id: string, fitness: number): Promise<void> {
  ensureConfig();
  await request(`/rest/v1/fish_genomes?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ fitness })
  });
}

export async function activateFishSlot(slotIndex: number, fishId: string): Promise<void> {
  ensureConfig();
  await request('/rest/v1/active_fish_slots?on_conflict=slot_index', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      slot_index: slotIndex,
      fish_id: fishId,
      activated_at: new Date().toISOString()
    })
  });
}

export async function recordSiteVisitor(visitorId: string): Promise<void> {
  ensureConfig();
  await request('/rest/v1/site_visitors?on_conflict=visitor_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      visitor_id: visitorId,
      last_seen_at: new Date().toISOString()
    })
  });
}

async function bootstrapMissingSlots(existing: ActiveFishSlotRecord[]): Promise<ActiveFishSlotRecord[]> {
  const slotsByIndex = new Map(existing.map((slot) => [slot.slot_index, slot]));

  for (let slotIndex = 1; slotIndex <= ACTIVE_SLOT_COUNT; slotIndex++) {
    if (slotsByIndex.has(slotIndex)) continue;
    const fish = await createFishGenome();
    await activateFishSlot(slotIndex, fish.id);
    slotsByIndex.set(slotIndex, {
      slot_index: slotIndex,
      fish_id: fish.id,
      activated_at: new Date().toISOString(),
      fish
    });
  }

  return Array.from(slotsByIndex.values()).sort((a, b) => a.slot_index - b.slot_index);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = new URL(path, `${supabaseUrl}/`);
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
      ...init.headers
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed: ${response.status} ${await response.text()}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function normalizeFishGenomeRow(row: FishGenomeRow): FishGenomeRecord {
  return {
    ...row,
    genome: normalizeStoredGenome(row.genome)
  };
}

function ensureConfig(): void {
  if (!hasSupabaseConfig()) {
    throw new Error('Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
}

function normalizeEnvValue(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, '').replace(/\/$/, '');
}
