import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CandidateData {
  name: string
  email: string
  role: string
  phone: string
  location: string
  linkedin_url: string
  experience_years: number
  skills: string[]
  job_id: string
  status: string
}

const firstNames = ['Marco', 'Luca', 'Giovanni', 'Andrea', 'Alessio', 'Matteo', 'Davide', 'Simone', 'Giuseppe', 'Francesco', 
  'Sara', 'Giulia', 'Chiara', 'Elena', 'Francesca', 'Martina', 'Laura', 'Alessandra', 'Sofia', 'Anna']
const lastNames = ['Rossi', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti',
  'Ferrari', 'Esposito', 'Russo', 'Villa', 'Lombardi', 'Moretti', 'Barbieri', 'Fontana', 'Santoro', 'Ferrara']
const cities = ['Milano', 'Roma', 'Torino', 'Firenze', 'Bologna', 'Napoli', 'Venezia', 'Genova', 'Verona', 'Palermo']

const roles = [
  'Senior Frontend Developer',
  'Backend Engineer',
  'Full Stack Developer',
  'DevOps Engineer',
  'Product Manager',
  'UI/UX Designer',
  'Data Scientist',
  'Mobile Developer',
  'QA Engineer',
  'Technical Lead'
]

const skillSets = [
  ['React', 'TypeScript', 'Node.js', 'CSS', 'GraphQL'],
  ['Python', 'Django', 'PostgreSQL', 'Redis', 'Docker'],
  ['Java', 'Spring Boot', 'Kubernetes', 'AWS', 'MongoDB'],
  ['Vue.js', 'Nuxt', 'Firebase', 'Tailwind', 'Jest'],
  ['Angular', 'RxJS', 'NestJS', 'MySQL', 'Azure'],
  ['React Native', 'Swift', 'Kotlin', 'Flutter', 'iOS'],
  ['Machine Learning', 'TensorFlow', 'Python', 'Pandas', 'Jupyter'],
  ['Figma', 'Sketch', 'Adobe XD', 'Prototyping', 'User Research'],
]

function generateCandidate(index: number, jobId: string): CandidateData {
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
  const name = `${firstName} ${lastName}`
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@example.com`
  const role = roles[Math.floor(Math.random() * roles.length)]
  const phone = `+39 ${Math.floor(Math.random() * 900 + 100)} ${Math.floor(Math.random() * 9000000 + 1000000)}`
  const location = cities[Math.floor(Math.random() * cities.length)]
  const linkedin_url = `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}-${index}`
  const experience_years = Math.floor(Math.random() * 10) + 1
  const skills = skillSets[Math.floor(Math.random() * skillSets.length)]

  return {
    name,
    email,
    role,
    phone,
    location,
    linkedin_url,
    experience_years,
    skills,
    job_id: jobId,
    status: 'pending'
  }
}

async function generateProfilePhoto(name: string, index: number): Promise<string | null> {
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured')
      return null
    }

    const gender = index % 2 === 0 ? 'man' : 'woman'
    const age = 25 + Math.floor(Math.random() * 15)
    const prompt = `Professional headshot photo of a ${age} year old Italian ${gender} named ${name}, business casual attire, neutral background, professional lighting, high quality portrait photography, LinkedIn profile style`

    console.log(`Generating photo for ${name}...`)

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        modalities: ['image', 'text']
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`AI gateway error for ${name}:`, response.status, errorText)
      return null
    }

    const data = await response.json()
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url

    if (!imageUrl) {
      console.error(`No image URL returned for ${name}`)
      return null
    }

    return imageUrl
  } catch (error) {
    console.error(`Error generating photo for ${name}:`, error)
    return null
  }
}

async function uploadToStorage(
  supabase: any,
  imageBase64: string,
  fileName: string
): Promise<string | null> {
  try {
    // Convert base64 to blob
    const base64Data = imageBase64.split(',')[1]
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))

    const { data, error } = await supabase.storage
      .from('candidate-photos')
      .upload(fileName, binaryData, {
        contentType: 'image/png',
        upsert: true
      })

    if (error) {
      console.error('Storage upload error:', error)
      return null
    }

    // Return file path instead of public URL (bucket is now private)
    return fileName
  } catch (error) {
    console.error('Error uploading to storage:', error)
    return null
  }
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
      console.error(`[SECURITY] User ${user.id} attempted to populate candidates without admin privileges`)
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions. Admin role required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[AUDIT] Populate candidates initiated by admin user ${user.id} at ${new Date().toISOString()}`)

    const { batchSize = 10 } = await req.json().catch(() => ({ batchSize: 10 }))

    // Get available jobs
    const { data: jobs, error: jobsError } = await supabaseClient
      .from('jobs')
      .select('id')
      .eq('status', 'active')
      .limit(5)

    if (jobsError) {
      console.error('Error fetching jobs:', jobsError)
      throw jobsError
    }

    if (!jobs || jobs.length === 0) {
      throw new Error('No active jobs found')
    }

    // Check how many candidates already exist
    const { count: existingCount } = await supabaseClient
      .from('candidates')
      .select('*', { count: 'exact', head: true })

    const startIndex = existingCount || 0

    console.log(`Found ${jobs.length} jobs, generating ${batchSize} candidates (starting from ${startIndex})...`)

    const results = []
    
    for (let i = 0; i < batchSize; i++) {
      const actualIndex = startIndex + i
      const jobId = jobs[actualIndex % jobs.length].id
      const candidateData = generateCandidate(actualIndex, jobId)
      
      console.log(`Processing candidate ${actualIndex + 1}: ${candidateData.name}`)

      // Generate photo
      const photoBase64 = await generateProfilePhoto(candidateData.name, actualIndex)
      let photoUrl = null

      if (photoBase64) {
        const fileName = `${candidateData.name.toLowerCase().replace(/\s+/g, '-')}-${actualIndex}.png`
        photoUrl = await uploadToStorage(supabaseClient, photoBase64, fileName)
        
        // Reduced delay
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      // Insert candidate with assigned recruiter
      const { data: candidate, error: insertError } = await supabaseClient
        .from('candidates')
        .insert({
          ...candidateData,
          photo_url: photoUrl,
          assigned_recruiter_id: user.id
        })
        .select()
        .single()

      if (insertError) {
        console.error(`Error inserting candidate ${candidateData.name}:`, insertError)
        results.push({ name: candidateData.name, success: false, error: insertError.message })
      } else {
        console.log(`✓ Successfully created candidate: ${candidateData.name}`)
        results.push({ name: candidateData.name, success: true, id: candidate.id })
      }
    }

    const successCount = results.filter(r => r.success).length
    const totalCandidates = (existingCount || 0) + successCount

    return new Response(
      JSON.stringify({
        message: `Created ${successCount} of ${batchSize} candidates (total: ${totalCandidates})`,
        results,
        totalCandidates
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in populate-candidates function:', error)
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
