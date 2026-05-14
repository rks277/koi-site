with seed_koi(slot_index, variety, seed, size_factor) as (
  values
    (1, 'kohaku', 14012731, 0.060),
    (2, 'sanke', 24023741, 0.056),
    (3, 'asagi', 34034759, 0.064),
    (4, 'platinum', 44045771, 0.052),
    (5, 'kohaku', 54056783, 0.070),
    (6, 'sanke', 64067891, 0.058),
    (7, 'ogon', 74078903, 0.062)
),
inserted as (
  insert into public.fish_genomes (genome, generation, fitness)
  select
    jsonb_build_object(
      'seed', seed,
      'sizeFactor', size_factor,
      'parameters', jsonb_build_object(
        'bodyLength', 1.20 + random() * 0.30,
        'bodyThickness', 0.12 + random() * 0.04,
        'taperStrength', 0.85 + random() * 0.30,
        'headSize', 0.85 + random() * 0.25,
        'spineCurvature', -0.10 + random() * 0.20,
        'spineNoise', random() * 0.04,
        'pectoralFinSize', 0.85 + random() * 0.45,
        'pectoralFinSpread', 0.55 + random() * 0.35,
        'tailSize', 0.85 + random() * 0.35,
        'tailForkDepth', 0.20 + random() * 0.30,
        'finRoundness', 0.55 + random() * 0.30,
        'swimAmplitude', 0.06 + random() * 0.04,
        'swimFrequency', 4.0 + random() * 1.5,
        'bodyStiffness', 0.55 + random() * 0.30,
        'motionPhase', random() * 6.283185307179586,
        'markingCount', 3 + floor(random() * 3),
        'markingSize', 0.22 + random() * 0.14,
        'variety', variety,
        'inkJitter', 0.4 + random() * 0.5,
        'strokeTaper', 0.6 + random() * 0.4
      )
    ),
    0,
    0
  from seed_koi
  returning id, created_at
),
numbered as (
  select
    id,
    row_number() over (order by created_at, id) as slot_index
  from inserted
)
insert into public.active_fish_slots (slot_index, fish_id, activated_at)
select slot_index, id, now()
from numbered
on conflict (slot_index) do update
set fish_id = excluded.fish_id,
    activated_at = excluded.activated_at;
