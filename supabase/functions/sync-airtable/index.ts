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
  job_id?: string
  status: string
  airtable_id: string
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

    // Get first active job for assignment
    const { data: jobs } = await supabaseClient
      .from('jobs')
      .select('id')
      .eq('status', 'active')
      .limit(1)

    const defaultJobId = jobs?.[0]?.id

    // Sync each record to Supabase
    const syncResults = []
    
    for (const record of records) {
      try {
        const fields = record.fields
        const airtableId = record.id

        // Combina esperienza e referenze
        const esperienzaReferenze = [
          fields.riassunto_esperienze ? `ESPERIENZA:\n${fields.riassunto_esperienze}` : '',
          fields.riassunto_referenze ? `REFERENZE:\n${fields.riassunto_referenze}` : ''
        ].filter(Boolean).join('\n\n')

        const lavoratore: Lavoratore = {
          nome: fields.lavoratore || 'Nome non specificato',
          eta: fields.eta_lavoratore,
          foto_url: fields.foto_lavoratore?.[0]?.url,
          travel_time: fields.travel_time_tra_cap,
          descrizione_personale: fields.chi_sono,
          riassunto_esperienza_referenze: esperienzaReferenze || undefined,
          feedback_ai: fields.ai_agent_profiler,
          job_id: defaultJobId,
          status: 'pending',
          airtable_id: airtableId
        }

        // Check if record already exists
        const { data: existing } = await supabaseClient
          .from('lavoratori_selezionati')
          .select('id')
          .eq('airtable_id', airtableId)
          .maybeSingle()

        if (existing) {
          // Update existing record
          const { error } = await supabaseClient
            .from('lavoratori_selezionati')
            .update(lavoratore)
            .eq('airtable_id', airtableId)

          if (error) {
            console.error(`Failed to update lavoratore ${airtableId}:`, error)
            syncResults.push({ id: airtableId, success: false, error })
          } else {
            console.log(`Successfully updated lavoratore ${airtableId}`)
            syncResults.push({ id: airtableId, success: true, action: 'updated' })
          }
        } else {
          // Insert new record
          const { error } = await supabaseClient
            .from('lavoratori_selezionati')
            .insert(lavoratore)

          if (error) {
            console.error(`Failed to insert lavoratore ${airtableId}:`, error)
            syncResults.push({ id: airtableId, success: false, error })
          } else {
            console.log(`Successfully inserted lavoratore ${airtableId}`)
            syncResults.push({ id: airtableId, success: true, action: 'inserted' })
          }
        }
      } catch (error) {
        console.error(`Error syncing record ${record.id}:`, error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        syncResults.push({ id: record.id, success: false, error: errorMessage })
      }
    }

    const successCount = syncResults.filter(r => r.success).length
    
    return new Response(
      JSON.stringify({
        message: `Synced ${successCount} of ${records.length} lavoratori from Airtable`,
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
