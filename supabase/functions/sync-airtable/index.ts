import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Candidate {
  id: string
  name: string
  email: string
  role: string
  status: string
  phone?: string
  location?: string
  linkedin_url?: string
  experience_years?: number
  skills?: string[]
  job_id?: string
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

    // Fetch all candidates from database
    const { data: candidates, error: fetchError } = await supabaseClient
      .from('candidates')
      .select('*')

    if (fetchError) {
      console.error('Error fetching candidates:', fetchError)
      throw fetchError
    }

    console.log(`Found ${candidates?.length || 0} candidates to sync`)

    // Sync each candidate to Airtable
    const syncResults = []
    
    for (const candidate of candidates || []) {
      try {
        const airtableRecord = {
          fields: {
            'Name': candidate.name,
            'Email': candidate.email,
            'Role': candidate.role,
            'Status': candidate.status,
            'Phone': candidate.phone || '',
            'Location': candidate.location || '',
            'LinkedIn': candidate.linkedin_url || '',
            'Experience Years': candidate.experience_years || 0,
            'Skills': candidate.skills ? candidate.skills.join(', ') : '',
            'Candidate ID': candidate.id,
          }
        }

        const response = await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Candidates`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(airtableRecord),
          }
        )

        const result = await response.json()
        
        if (!response.ok) {
          console.error(`Failed to sync candidate ${candidate.id}:`, result)
          syncResults.push({ id: candidate.id, success: false, error: result })
        } else {
          console.log(`Successfully synced candidate ${candidate.id}`)
          syncResults.push({ id: candidate.id, success: true })
        }
      } catch (error) {
        console.error(`Error syncing candidate ${candidate.id}:`, error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        syncResults.push({ id: candidate.id, success: false, error: errorMessage })
      }
    }

    const successCount = syncResults.filter(r => r.success).length
    
    return new Response(
      JSON.stringify({
        message: `Synced ${successCount} of ${candidates?.length || 0} candidates to Airtable`,
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
