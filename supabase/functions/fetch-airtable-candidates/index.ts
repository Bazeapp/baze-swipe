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
    const recruiterFilter = url.searchParams.get('recruiter')

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

    // Fetch operatori table to get recruiters
    const operatoriUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/operatori`
    console.log('Fetching operatori table from Airtable')
    
    const operatoriResponse = await fetch(operatoriUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      }
    })

    if (!operatoriResponse.ok) {
      console.error('Airtable operatori API error:', operatoriResponse.status)
      throw new Error(`Airtable operatori API error: ${operatoriResponse.statusText}`)
    }

    const operatoriData = await operatoriResponse.json()
    const operatoriRecords: AirtableRecord[] = operatoriData.records || []
    console.log(`Found ${operatoriRecords.length} operatori records`)

    // Fetch processo_res table
    const processoResUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/processo_res`
    console.log('Fetching processo_res table from Airtable')
    
    const processoResResponse = await fetch(processoResUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      }
    })

    if (!processoResResponse.ok) {
      console.error('Airtable processo_res API error:', processoResResponse.status)
      throw new Error(`Airtable processo_res API error: ${processoResResponse.statusText}`)
    }

    const processoResData = await processoResResponse.json()
    const processoResRecords: AirtableRecord[] = processoResData.records || []
    console.log(`Found ${processoResRecords.length} processo_res records`)

    // Filter processo_res by stato_res = "raccolta candidature"
    const activeProcesses = processoResRecords.filter(p => {
      const stato = Array.isArray(p.fields.stato_res) ? p.fields.stato_res[0] : p.fields.stato_res
      return stato === 'raccolta candidature'
    })
    console.log(`Found ${activeProcesses.length} processes with stato_res = "raccolta candidature"`)

    // Extract recruiters from active processes
    const recruitersInActiveProcesses = new Set<string>()
    const processoInfoMap = new Map<string, { tipo_lavoro: string, recruiter: string }>()
    
    for (const processo of activeProcesses) {
      const recruiterField = processo.fields.recruiter_ricerca_e_selezione
      const recruiter = Array.isArray(recruiterField) ? recruiterField[0] : recruiterField
      const processoId = processo.id
      const tipoLavoro = Array.isArray(processo.fields.tipo_lavoro) ? processo.fields.tipo_lavoro[0] : processo.fields.tipo_lavoro
      
      if (recruiter) {
        recruitersInActiveProcesses.add(recruiter)
      }
      
      if (tipoLavoro) {
        processoInfoMap.set(processoId, { tipo_lavoro: tipoLavoro, recruiter: recruiter || '' })
      }
    }

    // Get recruiter names from operatori table that have active processes
    const recruiters = operatoriRecords
      .map(op => {
        const nome = Array.isArray(op.fields.nome) ? op.fields.nome[0] : op.fields.nome
        return nome
      })
      .filter(nome => nome && recruitersInActiveProcesses.has(nome))
      .sort()
    
    console.log(`Found ${recruiters.length} unique recruiters with active processes:`, recruiters)

    // Group by processo_res to get unique processes
    const processoMap = new Map<string, AirtableRecord>()
    for (const record of records) {
      // Filter by recruiter if specified
      if (recruiterFilter) {
        const recruiterField = record.fields.recruiter_ricerca_e_selezione
        const recruiter = Array.isArray(recruiterField) ? recruiterField[0] : recruiterField
        if (recruiter !== recruiterFilter) {
          continue
        }
      }

      // Normalize processo_res - extract first element if array
      const processoRaw = record.fields.processo_res
      const processo = Array.isArray(processoRaw) ? processoRaw[0] : processoRaw
      if (processo && !processoMap.has(processo)) {
        processoMap.set(processo, record)
      }
    }

    console.log(`Found ${processoMap.size} unique processo_res values (after recruiter filter)`)

    // Fetch esperienze_lavoratore table
    const esperienzeUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/esperienze_lavoratore`
    console.log('Fetching esperienze_lavoratore from Airtable')
    
    const esperienzeResponse = await fetch(esperienzeUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      }
    })

    let esperienzeMap = new Map<string, any[]>()
    if (esperienzeResponse.ok) {
      const esperienzeData = await esperienzeResponse.json()
      const esperienzeRecords: AirtableRecord[] = esperienzeData.records || []
      console.log(`Found ${esperienzeRecords.length} esperienze records`)
      
      // Group mansioni by id_lavoratore (singular)
      for (const expRecord of esperienzeRecords) {
        const idLavoratore = expRecord.fields.id_lavoratore
        const idLavoratoreNormalized = Array.isArray(idLavoratore) ? idLavoratore[0] : idLavoratore
        
        // Debug logging
        console.log('Exp record fields:', JSON.stringify(Object.keys(expRecord.fields)))
        console.log('id_lavoratore raw:', JSON.stringify(idLavoratore))
        console.log('id_lavoratore normalized:', idLavoratoreNormalized)
        
        if (idLavoratoreNormalized) {
          if (!esperienzeMap.has(idLavoratoreNormalized)) {
            esperienzeMap.set(idLavoratoreNormalized, [])
          }
          
          const mansioni = expRecord.fields.manzioni || expRecord.fields.mansioni
          console.log('mansioni found:', mansioni)
          if (mansioni) {
            esperienzeMap.get(idLavoratoreNormalized)?.push(mansioni)
          }
        }
      }
      console.log('Esperienze map size:', esperienzeMap.size)
      console.log('Esperienze map keys:', Array.from(esperienzeMap.keys()))
    } else {
      console.warn('Could not fetch esperienze_lavoratore:', esperienzeResponse.statusText)
    }

    // Convert to lavoratori format
    const lavoratori = []
    
    console.log('========================================')
    console.log('🚀 Starting to convert records')
    console.log('========================================')
    
    for (const [processo, record] of processoMap) {
      // Filter by processo_res if specified
      if (processoRes && processoRes !== 'all' && processo !== processoRes) {
        continue
      }

      // Limit to 5 results
      if (lavoratori.length >= 5) {
        break
      }

      const fields = record.fields
      
      // DUMP ALL FIELDS RAW
      console.log('\n========== NUOVO RECORD ==========')
      console.log('Airtable Record ID:', record.id)
      console.log('Processo:', processo)
      console.log('\n📋 TUTTI I CAMPI (raw JSON):')
      console.log(JSON.stringify(fields, null, 2))
      console.log('\n🔑 Campi chiave per matching:')
      console.log('  - lavoratore:', fields.lavoratore)
      console.log('  - lavoratore_id:', fields.lavoratore_id) 
      console.log('  - lavoratori_id:', fields.lavoratori_id)
      console.log('  - id_lavoratore:', fields.id_lavoratore)
      console.log('========================================\n')

      // Get nome from reference field
      let nome = 'Nome non specificato'
      if (fields.nome_lavoratore) {
        nome = Array.isArray(fields.nome_lavoratore) ? fields.nome_lavoratore[0] : fields.nome_lavoratore
      } else if (fields.lavoratore) {
        nome = Array.isArray(fields.lavoratore) ? fields.lavoratore[0] : fields.lavoratore
      }

      // Extract value from match_disponibilità_famiglia_lavoratore if it's an object
      let matchDisponibilita = null
      if (fields.match_disponibilità_famiglia_lavoratore) {
        const matchField = fields.match_disponibilità_famiglia_lavoratore
        if (typeof matchField === 'object' && matchField.value) {
          matchDisponibilita = matchField.value
        } else {
          matchDisponibilita = matchField
        }
      }

      // Get lavoratore_id for matching with esperienze
      // Try all possible field names that might contain the worker ID
      const possibleIdFields = [
        'lavoratore_id',      // singular
        'lavoratori_id',      // plural
        'id_lavoratore',      // inverted
        'lavoratore',         // just the name
        'id'                  // generic id
      ]
      
      let lavoratoreId = null
      let matchedFieldName = null
      
      for (const fieldName of possibleIdFields) {
        if (fields[fieldName]) {
          const rawValue = fields[fieldName]
          lavoratoreId = Array.isArray(rawValue) ? rawValue[0] : rawValue
          matchedFieldName = fieldName
          break
        }
      }
      
      console.log('MATCHING INFO:')
      console.log('  - Found ID in field:', matchedFieldName)
      console.log('  - Lavoratore ID:', lavoratoreId)
      console.log('  - Map has this key?', lavoratoreId ? esperienzeMap.has(lavoratoreId) : false)
      console.log('  - Map size:', esperienzeMap.size)
      
      // Get mansioni and flatten them into a single array
      const mansioniArrays = lavoratoreId ? esperienzeMap.get(lavoratoreId) || [] : []
      const mansioniList = mansioniArrays.flat()  // Flatten array of arrays
      
      console.log('  - Mansioni arrays found:', mansioniArrays.length)
      console.log('  - Total mansioni after flatten:', mansioniList.length)
      if (mansioniList.length > 0) {
        console.log('  - Sample mansioni:', mansioniList.slice(0, 3))
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
        mansioni_esperienze: mansioniList,
        feedback_ai: fields.ai_agent_profiler || null,
        processo: Array.isArray(fields.processo) ? fields.processo[0] : fields.processo,
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
        match_disponibilità_famiglia_lavoratore: matchDisponibilita,
        disponibilità_settimanale_recap: fields.disponibilità_settimanale_recap || null,
        feedback_recruiter: fields.feedback_recruiter || null,
        indirizzo_lavoratore: fields.indirizzo_lavoratore || null,
        indirizzo_famiglia: fields['indirizzo_famiglia (from processo_res)'] ? (Array.isArray(fields['indirizzo_famiglia (from processo_res)']) ? fields['indirizzo_famiglia (from processo_res)'][0] : fields['indirizzo_famiglia (from processo_res)']) : null,
        status: 'pending',
        airtable_id: record.id,
        stato_selezione: Array.isArray(fields.stato_selezione) ? fields.stato_selezione[0] : fields.stato_selezione,
        stato_processo_res: Array.isArray(fields.stato_processo_res) ? fields.stato_processo_res[0] : fields.stato_processo_res,
      }

      lavoratori.push(lavoratore)
    }

    console.log(`Returning ${lavoratori.length} lavoratori, ${recruiters.length} recruiters, and ${processoInfoMap.size} processo info`)

    return new Response(
      JSON.stringify({ 
        lavoratori, 
        recruiters,
        processoInfo: Object.fromEntries(processoInfoMap)
      }),
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
