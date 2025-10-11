import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Lavoratore {
  nome: string
  eta?: number
  foto_url?: string
  travel_time?: string
  descrizione_personale?: string
  riassunto_esperienza_referenze?: string
  feedback_ai?: string
  processo_res?: string
  job_id?: string
  status: string
  airtable_id: string
  stato_selezione?: string
  stato_processo_res?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const AIRTABLE_API_KEY = Deno.env.get('AIRTABLE_API_KEY')
    const AIRTABLE_BASE_ID = Deno.env.get('AIRTABLE_BASE_ID')
    
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      throw new Error('Missing Airtable credentials')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch records from Airtable using the "Nicolò" view
    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/lavoratori_selezionati?view=Nicolò`
    const airtableResponse = await fetch(airtableUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      }
    })

    if (!airtableResponse.ok) {
      throw new Error(`Airtable API error: ${airtableResponse.statusText}`)
    }

    const airtableData = await airtableResponse.json()
    const records = airtableData.records || []

    console.log(`Found ${records.length} records in Airtable`)

    // Group by processo_res to get unique processes
    const processoMap = new Map()
    for (const record of records) {
      const processoRes = record.fields.processo_res
      if (processoRes && !processoMap.has(processoRes)) {
        processoMap.set(processoRes, record)
      }
    }

    console.log(`Found ${processoMap.size} unique processo_res values`)

    // Get first active job for assignment
    const { data: jobs } = await supabaseClient
      .from('jobs')
      .select('id')
      .eq('status', 'active')
      .limit(1)

    const defaultJobId = jobs?.[0]?.id

    // Sync each unique processo_res to Supabase
    const syncResults = []
    
    for (const [processoRes, record] of processoMap) {
      try {
        const fields = record.fields
        const airtableId = record.id

        console.log(`Processing processo_res: ${processoRes}, record: ${airtableId}`)

        // Combina esperienza e referenze
        const esperienzaReferenze = [
          fields.riassunto_esperienze ? `ESPERIENZA:\n${fields.riassunto_esperienze}` : '',
          fields.riassunto_referenze ? `REFERENZE:\n${fields.riassunto_referenze}` : ''
        ].filter(Boolean).join('\n\n')

        const lavoratore: Lavoratore = {
          nome: fields.lavoratore || 'Nome non specificato',
          eta: Array.isArray(fields.eta_lavoratore) ? fields.eta_lavoratore[0] : fields.eta_lavoratore,
          foto_url: fields.foto_lavoratore?.[0]?.url,
          travel_time: fields.travel_time_tra_cap,
          descrizione_personale: fields.chi_sono,
          riassunto_esperienza_referenze: esperienzaReferenze || undefined,
          feedback_ai: fields.ai_agent_profiler,
          processo_res: processoRes,
          job_id: defaultJobId,
          status: 'pending',
          airtable_id: airtableId,
          stato_selezione: fields.stato_selezione,
          stato_processo_res: fields.stato_processo_res
        }

        // Check if record already exists by processo_res
        const { data: existing } = await supabaseClient
          .from('lavoratori_selezionati')
          .select('id')
          .eq('processo_res', processoRes)
          .maybeSingle()

        if (existing) {
          // Update existing record
          const { error } = await supabaseClient
            .from('lavoratori_selezionati')
            .update(lavoratore)
            .eq('processo_res', processoRes)

          if (error) {
            console.error(`Failed to update lavoratore ${processoRes}:`, error)
            syncResults.push({ id: processoRes, success: false, error })
          } else {
            console.log(`Successfully updated lavoratore ${processoRes}`)
            syncResults.push({ id: processoRes, success: true, action: 'updated' })
          }
        } else {
          // Insert new record
          const { error } = await supabaseClient
            .from('lavoratori_selezionati')
            .insert(lavoratore)

          if (error) {
            console.error(`Failed to insert lavoratore ${processoRes}:`, error)
            syncResults.push({ id: processoRes, success: false, error })
          } else {
            console.log(`Successfully inserted lavoratore ${processoRes}`)
            syncResults.push({ id: processoRes, success: true, action: 'inserted' })
          }
        }
      } catch (error) {
        console.error(`Error syncing processo_res ${processoRes}:`, error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        syncResults.push({ id: processoRes, success: false, error: errorMessage })
      }
    }

    const successCount = syncResults.filter(r => r.success).length
    
    return new Response(
      JSON.stringify({
        message: `Synced ${successCount} of ${processoMap.size} unique lavoratori from Airtable (${records.length} total records)`,
        results: syncResults,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in sync-airtable function:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
