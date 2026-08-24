// Canonical dealer inventory writes must never use the legacy global VIN conflict
// target. A VIN belongs to a dealership's catalog, and the same vehicle can
// legitimately appear at another dealership later (or within a dealer group).
//
// The scoped lookup is backwards-compatible while the database migration from
// UNIQUE(vin) to UNIQUE(dealership_id, vin) rolls out: before migration, a
// cross-dealer collision fails safely instead of reassigning ownership.
export async function upsertDealerInventory(client, record) {
  if (!record?.dealership_id || !record?.vin) {
    return { data: null, error: new Error('dealership_id and vin are required') }
  }

  const findExisting = () => client
    .from('inventory')
    .select('id')
    .eq('dealership_id', record.dealership_id)
    .eq('vin', record.vin)
    .limit(1)
    .maybeSingle()

  const { data: existing, error: lookupError } = await findExisting()
  if (lookupError) return { data: null, error: lookupError }

  if (existing?.id) {
    return client
      .from('inventory')
      .update(record)
      .eq('id', existing.id)
      .eq('dealership_id', record.dealership_id)
      .select('id')
      .single()
  }

  const inserted = await client.from('inventory').insert(record).select('id').single()
  if (!inserted.error || inserted.error.code !== '23505') return inserted

  // A simultaneous pull may have inserted this dealer/VIN after our lookup.
  const { data: raced, error: retryLookupError } = await findExisting()
  if (retryLookupError || !raced?.id) return inserted
  return client
    .from('inventory')
    .update(record)
    .eq('id', raced.id)
    .eq('dealership_id', record.dealership_id)
    .select('id')
    .single()
}
