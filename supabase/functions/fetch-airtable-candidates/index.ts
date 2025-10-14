import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AirtableRecord {
  id: string
  fields: Record<string, any>
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
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
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

    console.log(`[AUDIT] Airtable fetch initiated by user ${user.id} at ${new Date().toISOString()}`)

    // Get query parameters
    const url = new URL(req.url)
    const processoRes = url.searchParams.get('processo_res')

    const AIRTABLE_API_KEY = Deno.env.get('AIRTABLE_API_KEY')
    const AIRTABLE_BASE_ID = Deno.env.get('AIRTABLE_BASE_ID')
    
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      throw new Error('Missing Airtable credentials')
    }

    // Fetch records from Airtable using the "[🔒] Lovable Tinder Database" view
    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/lavoratori_selezionati?view=${encodeURIComponent('[🔒] Lovable Tinder Database')}`
    
    console.log(`Fetching from Airtable view: [🔒] Lovable Tinder Database`)
    
    const airtableResponse = await fetch(airtableUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      }
    })

    if (!airtableResponse.ok) {
      const errorBody = await airtableResponse.text()
      console.error('Airtable API error:', airtableResponse.status, airtableResponse.statusText)
      console.error('Error response body:', errorBody)
      throw new Error(`Airtable API error: ${airtableResponse.statusText}`)
    }

    const airtableData = await airtableResponse.json()
    const records: AirtableRecord[] = airtableData.records || []

    console.log(`Found ${records.length} total records in Airtable`)

    // Group by processo_res to get unique processes
    const processoMap = new Map<string, AirtableRecord>()
    for (const record of records) {
      const processo = record.fields.processo_res
      if (processo && !processoMap.has(processo)) {
        processoMap.set(processo, record)
      }
    }

    console.log(`Found ${processoMap.size} unique processo_res values`)

    // Convert to lavoratori format
    const lavoratori = []
    for (const [processo, record] of processoMap) {
      // Filter by processo_res if specified
      if (processoRes && processoRes !== 'all' && processo !== processoRes) {
        continue
      }

      const fields = record.fields

      // Get nome from reference field
      let nome = 'Nome non specificato'
      if (fields.nome_lavoratore) {
        nome = Array.isArray(fields.nome_lavoratore) ? fields.nome_lavoratore[0] : fields.nome_lavoratore
      } else if (fields.lavoratore) {
        nome = Array.isArray(fields.lavoratore) ? fields.lavoratore[0] : fields.lavoratore
      }

      const lavoratore = {
        id: record.id,
        nome,
        eta: Array.isArray(fields.eta_lavoratore) ? fields.eta_lavoratore[0] : fields.eta_lavoratore,
        foto_url: fields.foto_lavoratore?.[0]?.url || null,
        travel_time: fields.travel_time_tra_cap || null,
        travel_time_tra_cap: fields.travel_time_tra_cap || null,
        travel_time_flag: Array.isArray(fields.travel_time_flag) ? fields.travel_time_flag[0] : fields.travel_time_flag,
        anni_esperienza_colf: Array.isArray(fields.anni_esperienza_colf) ? fields.anni_esperienza_colf[0] : fields.anni_esperienza_colf,
        descrizione_personale: fields.chi_sono || null,
        riassunto_esperienze_completo: fields.riassunto_esperienze_completo || null,
        feedback_ai: fields.ai_agent_profiler || null,
        processo_res: processo,
        email_processo_res_famiglia: Array.isArray(fields.email_processo_res_famiglia) ? fields.email_processo_res_famiglia[0] : fields.email_processo_res_famiglia,
        annuncio_luogo_riferimento_pubblico: Array.isArray(fields.annuncio_luogo_riferimento_pubblico) ? fields.annuncio_luogo_riferimento_pubblico[0] : fields.annuncio_luogo_riferimento_pubblico,
        annuncio_orario_di_lavoro: Array.isArray(fields.annuncio_orario_di_lavoro) ? fields.annuncio_orario_di_lavoro[0] : fields.annuncio_orario_di_lavoro,
        annuncio_nucleo_famigliare: Array.isArray(fields.annuncio_nucleo_famigliare) ? fields.annuncio_nucleo_famigliare[0] : fields.annuncio_nucleo_famigliare,
        mansioni_richieste_transformed_ai: fields.mansioni_richieste_transformed_ai || null,
        mansioni_richieste: Array.isArray(fields['mansioni_richieste (from processo_res)']) ? fields['mansioni_richieste (from processo_res)'][0] : fields['mansioni_richieste (from processo_res)'],
        chi_sono: fields['chi_sono (from lavoratore)'] ? (Array.isArray(fields['chi_sono (from lavoratore)']) ? fields['chi_sono (from lavoratore)'][0] : fields['chi_sono (from lavoratore)']) : null,
        riassunto_profilo_breve: fields.riassunto_profilo_breve || null,
        intervista_llm_transcript_history: fields.intervista_llm_transcript_history || null,
        descrizione_ricerca_famiglia: fields['descrizione_ricerca_famiglia (from processo_res)'] ? (Array.isArray(fields['descrizione_ricerca_famiglia (from processo_res)']) ? fields['descrizione_ricerca_famiglia (from processo_res)'][0] : fields['descrizione_ricerca_famiglia (from processo_res)']) : null,
        match_disponibilità_famiglia_lavoratore: fields.match_disponibilità_famiglia_lavoratore || null,
        status: 'pending',
        airtable_id: record.id,
        stato_selezione: Array.isArray(fields.stato_selezione) ? fields.stato_selezione[0] : fields.stato_selezione,
        stato_processo_res: Array.isArray(fields.stato_processo_res) ? fields.stato_processo_res[0] : fields.stato_processo_res,
      }

      lavoratori.push(lavoratore)
    }

    console.log(`Returning ${lavoratori.length} lavoratori`)

    return new Response(
      JSON.stringify({ lavoratori }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in fetch-airtable-candidates function:', error)
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
