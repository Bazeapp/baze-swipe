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
  travel_time_tra_cap?: string
  assigned_recruiter_id?: string
  descrizione_personale?: string
  riassunto_esperienze_completo?: string
  feedback_ai?: string
  processo_res?: string
  email_processo_res_famiglia?: string
  annuncio_luogo_riferimento_pubblico?: string
  annuncio_orario_di_lavoro?: string
  annuncio_nucleo_famigliare?: string
  mansioni_richieste_transformed_ai?: string
  mansioni_richieste?: string
  chi_sono?: string
  riassunto_profilo_breve?: string
  intervista_llm_transcript_history?: string
  descrizione_ricerca_famiglia?: string
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
    // Authenticate user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('[SECURITY] Missing authorization header')
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify user token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      console.error('[SECURITY] Invalid or expired token:', authError?.message)
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user has admin role
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (!roleData) {
      console.error(`[SECURITY] User ${user.id} attempted to sync without admin privileges`)
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions. Admin role required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[AUDIT] Airtable sync initiated by admin user ${user.id} at ${new Date().toISOString()}`)

    const AIRTABLE_API_KEY = Deno.env.get('AIRTABLE_API_KEY')
    const AIRTABLE_BASE_ID = Deno.env.get('AIRTABLE_BASE_ID')
    
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      throw new Error('Missing Airtable credentials')
    }

    // Fetch records from Airtable using the "[🔒] Lovable Tinder Database" view
    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/lavoratori_selezionati?view=${encodeURIComponent('[🔒] Lovable Tinder Database')}`
    const airtableResponse = await fetch(airtableUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      }
    })

    if (!airtableResponse.ok) {
      const errorBody = await airtableResponse.text()
      console.error('Airtable API error:', airtableResponse.status, airtableResponse.statusText)
      console.error('Error response body:', errorBody)
      throw new Error(`Airtable API error: ${airtableResponse.statusText} - ${errorBody}`)
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
        console.log('Available fields:', Object.keys(fields))

        // Get nome from reference field - try nome_lavoratore first, then fallback to lavoratore
        let nome = 'Nome non specificato'
        if (fields.nome_lavoratore) {
          nome = Array.isArray(fields.nome_lavoratore) ? fields.nome_lavoratore[0] : fields.nome_lavoratore
        } else if (fields.lavoratore) {
          nome = Array.isArray(fields.lavoratore) ? fields.lavoratore[0] : fields.lavoratore
        }

        const lavoratore: Lavoratore = {
          nome,
          eta: Array.isArray(fields.eta_lavoratore) ? fields.eta_lavoratore[0] : fields.eta_lavoratore,
          foto_url: fields.foto_lavoratore?.[0]?.url,
          travel_time: fields.travel_time_tra_cap,
          travel_time_tra_cap: fields.travel_time_tra_cap,
          assigned_recruiter_id: user.id,
          descrizione_personale: fields.chi_sono,
          riassunto_esperienze_completo: fields.riassunto_esperienze_completo,
          feedback_ai: fields.ai_agent_profiler,
          processo_res: processoRes,
          email_processo_res_famiglia: Array.isArray(fields.email_processo_res_famiglia) ? fields.email_processo_res_famiglia[0] : fields.email_processo_res_famiglia,
          annuncio_luogo_riferimento_pubblico: Array.isArray(fields.annuncio_luogo_riferimento_pubblico) ? fields.annuncio_luogo_riferimento_pubblico[0] : fields.annuncio_luogo_riferimento_pubblico,
          annuncio_orario_di_lavoro: Array.isArray(fields.annuncio_orario_di_lavoro) ? fields.annuncio_orario_di_lavoro[0] : fields.annuncio_orario_di_lavoro,
          annuncio_nucleo_famigliare: Array.isArray(fields.annuncio_nucleo_famigliare) ? fields.annuncio_nucleo_famigliare[0] : fields.annuncio_nucleo_famigliare,
          mansioni_richieste_transformed_ai: fields.mansioni_richieste_transformed_ai,
          mansioni_richieste: Array.isArray(fields['mansioni_richieste (from processo_res)']) ? fields['mansioni_richieste (from processo_res)'][0] : fields['mansioni_richieste (from processo_res)'],
          chi_sono: fields['chi_sono (from lavoratore)'] ? (Array.isArray(fields['chi_sono (from lavoratore)']) ? fields['chi_sono (from lavoratore)'][0] : fields['chi_sono (from lavoratore)']) : null,
          riassunto_profilo_breve: fields.riassunto_profilo_breve || null,
          intervista_llm_transcript_history: fields.intervista_llm_transcript_history || null,
          descrizione_ricerca_famiglia: fields['descrizione_ricerca_famiglia (from processo_res)'] ? (Array.isArray(fields['descrizione_ricerca_famiglia (from processo_res)']) ? fields['descrizione_ricerca_famiglia (from processo_res)'][0] : fields['descrizione_ricerca_famiglia (from processo_res)']) : null,
          job_id: defaultJobId,
          status: 'pending',
          airtable_id: airtableId,
          stato_selezione: Array.isArray(fields.stato_selezione) ? fields.stato_selezione[0] : fields.stato_selezione,
          stato_processo_res: Array.isArray(fields.stato_processo_res) ? fields.stato_processo_res[0] : fields.stato_processo_res
        }

        // Check if record already exists by airtable_id
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
