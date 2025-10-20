const AIRTABLE_API_KEY = import.meta.env.VITE_AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID;

interface AirtableRecord {
  id: string;
  fields: Record<string, any>;
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

export interface Lavoratore {
  id: string;
  nome: string;
  eta: number | null;
  foto_url: string | null;
  travel_time: string | null;
  travel_time_tra_cap: string | null;
  travel_time_flag: string | null;
  anni_esperienza_colf: number | null;
  anni_esperienza_babysitter: number | null;
  anni_esperienza_badante: number | null;
  descrizione_personale: string | null;
  riassunto_esperienze_completo: string | null;
  mansioni_esperienze?: string[];
  feedback_ai: string | null;
  processo: string | null;
  processo_res: string | null;
  email_processo_res_famiglia: string | null;
  annuncio_luogo_riferimento_pubblico: string | null;
  annuncio_orario_di_lavoro: string | null;
  annuncio_nucleo_famigliare: string | null;
  mansioni_richieste_transformed_ai: string | null;
  mansioni_richieste: string | null;
  chi_sono: string | null;
  riassunto_profilo_breve: string | null;
  intervista_llm_transcript_history: string | null;
  descrizione_ricerca_famiglia: string | null;
  job_id: string | null;
  status: string;
  stato_selezione: string | null;
  stato_processo_res: string | null;
  match_disponibilità_famiglia_lavoratore: string | null;
  disponibilità_settimanale_recap: string | null;
  feedback_recruiter: string | null;
  indirizzo_lavoratore: string | null;
  indirizzo_famiglia: string | null;
  lavoratore_record_id: string | null;
  lavoratore_record_field: string | null;
}

function buildQueryString(params?: Record<string, string | undefined>): string {
  const searchParams = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, value);
      }
    }
  }
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

async function fetchAirtableTable(
  tableName: string,
  params?: Record<string, string | undefined>,
  sort?: AirtableSort[],
  fields?: string[]
): Promise<AirtableRecord[]> {
  const searchParams = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, value);
      }
    }
  }
  if (fields) {
    fields.forEach((field, index) => {
      searchParams.append(`fields[${index}]`, field);
    });
  }
  if (sort) {
    sort.forEach((item, index) => {
      searchParams.append(`sort[${index}][field]`, item.field);
      if (item.direction) {
        searchParams.append(`sort[${index}][direction]`, item.direction);
      }
    });
  }

  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableName}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Airtable API error:', response.status, response.statusText);
    console.error('Error response body:', errorBody);
    throw new Error(`Airtable API error: ${response.statusText}`);
  }

  const data: AirtableResponse = await response.json();

  return data.records;
}

interface AirtableSort {
  field: string;
  direction?: 'asc' | 'desc';
}

async function fetchAirtableView(
  tableName: string,
  viewName: string,
  params?: Record<string, string | undefined>,
  sort?: AirtableSort[]
): Promise<AirtableRecord[]> {
  const queryParams = new URLSearchParams({ view: viewName });
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value);
      }
    }
  }
  if (sort) {
    sort.forEach((item, index) => {
      queryParams.append(`sort[${index}][field]`, item.field);
      if (item.direction) {
        queryParams.append(`sort[${index}][direction]`, item.direction);
      }
    });
  }
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableName}?${queryParams.toString()}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Airtable API error:', response.status, response.statusText);
    console.error('Error response body:', errorBody);
    throw new Error(`Airtable API error: ${response.statusText}`);
  }

  const data: AirtableResponse = await response.json();

  return data.records;
}

const POSSIBLE_LAVORATORE_ID_FIELDS = ['lavoratore_id', 'lavoratori_id', 'id_lavoratore', 'lavoratore', 'id'];

function escapeFormulaValue(value: string): string {
  return value.replace(/'/g, "\\'");
}

export interface RecruiterProcessSummary {
  id: string;
  nome: string;
  processIds: string[];
}

export interface ProcessoInfo {
  tipo_lavoro: string;
  recruiter: string;
  recruiterId: string;
  tipo_rapporto: string;
  momento_giornata: string;
  email_famiglia: string;
  record_id_processo_value: string;
}

export interface WorkerSelection {
  id: string;
  processoId: string | null;
  processoTitle: string | null;
  statoProcesso: string | null;
  recruiterId: string | null;
}

export async function fetchRecruiterProcesses(): Promise<{
  recruiters: RecruiterProcessSummary[];
  processoInfo: Record<string, ProcessoInfo>;
}> {
  const operatoriRecords = await fetchAirtableTable('operatori', undefined, undefined, ['nome', 'record_id']);

  // Create a map of operatori record ID to nome
  const operatoriIdToNome = new Map<string, string>();
  for (const op of operatoriRecords) {
    const nome = Array.isArray(op.fields.nome) ? op.fields.nome[0] : op.fields.nome;
    if (nome) {
      operatoriIdToNome.set(op.id, nome);
    }
  }

  const processoResRecords = await fetchAirtableView(
    'processo_res',
    '[🔐 No Edit] baze_swipe',
    {
      filterByFormula:
        "OR({stato_res}='fare ricerca',FIND('fare ricerca', ARRAYJOIN({stato_res}, ','))>0)",
    }
  );

  const recruiterProcessMap = new Map<string, RecruiterProcessSummary>();
  const processoInfoMap = new Map<string, ProcessoInfo>();

  for (const processo of processoResRecords) {
    const recruiterField = processo.fields.recruiter_ricerca_e_selezione;
    const recruiterId = Array.isArray(recruiterField) ? recruiterField[0] : recruiterField;
    const processoId = processo.id;
    const tipoLavoro = Array.isArray(processo.fields.tipo_lavoro)
      ? processo.fields.tipo_lavoro[0]
      : processo.fields.tipo_lavoro;
    const tipoRapporto = Array.isArray(processo.fields.tipo_rapporto)
      ? processo.fields.tipo_rapporto[0]
      : processo.fields.tipo_rapporto;
    const momentoGiornata = Array.isArray(processo.fields.momento_giornata)
      ? processo.fields.momento_giornata[0]
      : processo.fields.momento_giornata;
    const emailFamiglia = Array.isArray(processo.fields.email_famiglia)
      ? processo.fields.email_famiglia[0]
      : processo.fields.email_famiglia;

    const stato = processo.fields.stato_res;
    const statoValue = Array.isArray(stato) ? stato[0] : stato;
    if (statoValue && String(statoValue).toLowerCase() !== 'fare ricerca') {
      continue;
    }

    if (!recruiterId) {
      continue;
    }

    const recruiterNome = operatoriIdToNome.get(recruiterId);
    if (!recruiterNome) {
      continue;
    }

    const processoIdentifierRaw = processo.fields.record_id_processo;
    const processoIdentifier = Array.isArray(processoIdentifierRaw)
      ? processoIdentifierRaw[0]
      : processoIdentifierRaw;

    processoInfoMap.set(processoId, {
      tipo_lavoro: tipoLavoro || '',
      recruiter: recruiterNome,
      recruiterId,
      tipo_rapporto: tipoRapporto || '',
      momento_giornata: momentoGiornata || '',
      email_famiglia: emailFamiglia || '',
      record_id_processo_value: processoIdentifier ? String(processoIdentifier) : processoId,
    });

    if (!recruiterProcessMap.has(recruiterId)) {
      recruiterProcessMap.set(recruiterId, {
        id: recruiterId,
        nome: recruiterNome,
        processIds: [],
      });
    }

    recruiterProcessMap.get(recruiterId)!.processIds.push(processoId);
  }

  const recruiters = Array.from(recruiterProcessMap.values()).sort((a, b) => a.nome.localeCompare(b.nome));

  return {
    recruiters,
    processoInfo: Object.fromEntries(processoInfoMap),
  };
}

export async function fetchCandidates(
  recruiterNameFilter?: string,
  processoIdentifierFilter?: string,
  recruiterIdFilter?: string
): Promise<Lavoratore[]> {
  const lavoratoriFormulaParts: string[] = [];
  if (recruiterNameFilter) {
    const recruiterEscaped = escapeFormulaValue(recruiterNameFilter);
    lavoratoriFormulaParts.push(
      `OR(
        {recruiter_processo_res}='${recruiterEscaped}',
        FIND('${recruiterEscaped}', ARRAYJOIN({recruiter_processo_res}, ','))>0
      )`
    );
  }
  if (processoIdentifierFilter) {
    const processoEscaped = escapeFormulaValue(processoIdentifierFilter);
    lavoratoriFormulaParts.push(
      `OR(
        FIND('${processoEscaped}', ARRAYJOIN({processo_res}, ','))>0,
        {record_id_processo}='${processoEscaped}'
      )`
    );
  }

  lavoratoriFormulaParts.push(
    "OR({stato_selezione}='Candidato - Good fit',{stato_selezione}='Prospetto',{stato_selezione}='Candidato - Poor fit')"
  );

  const lavoratoriQuery: Record<string, string | undefined> = {
    pageSize: '20',
    filterByFormula: lavoratoriFormulaParts.length === 1
      ? lavoratoriFormulaParts[0]
      : `AND(${lavoratoriFormulaParts.join(',')})`
  };

  const lavoratoriRecords = await fetchAirtableView(
    'lavoratori_selezionati',
    '[🔒] Lovable Tinder Database',
    lavoratoriQuery,
    [
      { field: 'travel_time_tra_cap', direction: 'asc' }
    ]
  );

  // Collect lavoratore IDs for esperienze filtering
  const lavoratoreIdsForEsperienze = new Set<string>();
  for (const record of lavoratoriRecords) {
    const fields = record.fields;
    for (const fieldName of POSSIBLE_LAVORATORE_ID_FIELDS) {
      if (fields[fieldName]) {
        const rawValue = fields[fieldName];
        const normalized = Array.isArray(rawValue) ? rawValue[0] : rawValue;
        if (normalized) {
          lavoratoreIdsForEsperienze.add(String(normalized));
          break;
        }
      }
    }
  }

  let esperienzeRecords: AirtableRecord[] = [];
  if (lavoratoreIdsForEsperienze.size > 0) {
    const esperienzeFormulaParts = Array.from(lavoratoreIdsForEsperienze).map((id) =>
      `FIND('${escapeFormulaValue(id)}', ARRAYJOIN({id_lavoratore}))>0`
    );
    const esperienzeFormula = esperienzeFormulaParts.length === 1
      ? esperienzeFormulaParts[0]
      : `OR(${esperienzeFormulaParts.join(',')})`;

    esperienzeRecords = await fetchAirtableTable('esperienze_lavoratore', {
      filterByFormula: esperienzeFormula,
    });
  }

  // Create esperienze map
  const esperienzeMap = new Map<string, string[]>();
  for (const expRecord of esperienzeRecords) {
    const idLavoratore = expRecord.fields.id_lavoratore;
    const idLavoratoreNormalized = Array.isArray(idLavoratore) ? idLavoratore[0] : idLavoratore;

    if (idLavoratoreNormalized) {
      if (!esperienzeMap.has(idLavoratoreNormalized)) {
        esperienzeMap.set(idLavoratoreNormalized, []);
      }

      const mansioni = expRecord.fields.manzioni || expRecord.fields.mansioni;
      if (mansioni) {
        esperienzeMap.get(idLavoratoreNormalized)?.push(mansioni);
      }
    }
  }

  // Filter and convert records to lavoratori
  const lavoratori: Lavoratore[] = [];

  console.log('🔍 Total lavoratoriRecords:', lavoratoriRecords.length);
  console.log('🔍 recruiterNameFilter:', recruiterNameFilter);
  console.log('🔍 processoIdentifierFilter:', processoIdentifierFilter);

  for (const record of lavoratoriRecords) {

    const fields = record.fields;
    const processoRaw = fields.processo_res;
    const processo = Array.isArray(processoRaw) ? processoRaw[0] : processoRaw;

    if (processoIdentifierFilter && processo !== processoIdentifierFilter) {
      continue;
    }

    if (recruiterIdFilter) {
      const recruiterField = fields.recruiter_processo_res;
      const recruiterLinkedIds = Array.isArray(recruiterField)
        ? recruiterField
        : recruiterField
          ? [recruiterField]
          : [];
      if (!recruiterLinkedIds.includes(recruiterIdFilter)) {
        continue;
      }
    }

    // Get nome from reference field
    let nome = 'Nome non specificato';
    if (fields.nome_lavoratore) {
      nome = Array.isArray(fields.nome_lavoratore) ? fields.nome_lavoratore[0] : fields.nome_lavoratore;
    } else if (fields.lavoratore) {
      nome = Array.isArray(fields.lavoratore) ? fields.lavoratore[0] : fields.lavoratore;
    }

    // Extract value from match_disponibilità_famiglia_lavoratore if it's an object
    let matchDisponibilita = null;
    if (fields.match_disponibilità_famiglia_lavoratore) {
      const matchField = fields.match_disponibilità_famiglia_lavoratore;
      if (typeof matchField === 'object' && matchField.value) {
        matchDisponibilita = matchField.value;
      } else {
        matchDisponibilita = matchField;
      }
    }

    let lavoratoreId = null;
    let lavoratoreIdFieldUsed: string | null = null;
    for (const fieldName of POSSIBLE_LAVORATORE_ID_FIELDS) {
      if (fields[fieldName]) {
        const rawValue = fields[fieldName];
        lavoratoreId = Array.isArray(rawValue) ? rawValue[0] : rawValue;
        lavoratoreIdFieldUsed = fieldName;
        break;
      }
    }

    // Get mansioni and flatten them into a single array
    const mansioniArrays = lavoratoreId ? esperienzeMap.get(lavoratoreId) || [] : [];
    const mansioniList = mansioniArrays.flat();

    const lavoratore: Lavoratore = {
      id: record.id,
      nome,
      eta: Array.isArray(fields.eta_lavoratore) ? fields.eta_lavoratore[0] : fields.eta_lavoratore,
      foto_url: fields.foto_lavoratore?.[0]?.url || null,
      travel_time: fields.travel_time_tra_cap || null,
      travel_time_tra_cap: fields.travel_time_tra_cap || null,
      travel_time_flag: Array.isArray(fields.travel_time_flag)
        ? fields.travel_time_flag[0]
        : fields.travel_time_flag,
      anni_esperienza_colf: Array.isArray(fields.anni_esperienza_colf)
        ? fields.anni_esperienza_colf[0]
        : fields.anni_esperienza_colf,
      anni_esperienza_babysitter: Array.isArray(fields.anni_esperienza_babysitter)
        ? fields.anni_esperienza_babysitter[0]
        : fields.anni_esperienza_babysitter ?? null,
      anni_esperienza_badante: Array.isArray(fields.anni_esperienza_badante)
        ? fields.anni_esperienza_badante[0]
        : fields.anni_esperienza_badante ?? null,
      descrizione_personale: fields.chi_sono || null,
      riassunto_esperienze_completo: fields.riassunto_esperienze_completo || null,
      mansioni_esperienze: mansioniList,
      feedback_ai: fields.ai_agent_profiler || null,
      processo: Array.isArray(fields.processo) ? fields.processo[0] : fields.processo,
      processo_res: processo,
      email_processo_res_famiglia: Array.isArray(fields.email_processo_res_famiglia)
        ? fields.email_processo_res_famiglia[0]
        : fields.email_processo_res_famiglia,
      annuncio_luogo_riferimento_pubblico: Array.isArray(fields.annuncio_luogo_riferimento_pubblico)
        ? fields.annuncio_luogo_riferimento_pubblico[0]
        : fields.annuncio_luogo_riferimento_pubblico,
      annuncio_orario_di_lavoro: Array.isArray(fields.annuncio_orario_di_lavoro)
        ? fields.annuncio_orario_di_lavoro[0]
        : fields.annuncio_orario_di_lavoro,
      annuncio_nucleo_famigliare: Array.isArray(fields.annuncio_nucleo_famigliare)
        ? fields.annuncio_nucleo_famigliare[0]
        : fields.annuncio_nucleo_famigliare,
      mansioni_richieste_transformed_ai: fields.mansioni_richieste_transformed_ai || null,
      mansioni_richieste: Array.isArray(fields['mansioni_richieste (from processo_res)'])
        ? fields['mansioni_richieste (from processo_res)'][0]
        : fields['mansioni_richieste (from processo_res)'],
      chi_sono: fields['chi_sono (from lavoratore)']
        ? Array.isArray(fields['chi_sono (from lavoratore)'])
          ? fields['chi_sono (from lavoratore)'][0]
          : fields['chi_sono (from lavoratore)']
        : null,
      riassunto_profilo_breve: fields.riassunto_profilo_breve || null,
      intervista_llm_transcript_history: fields.intervista_llm_transcript_history || null,
      descrizione_ricerca_famiglia: fields['descrizione_ricerca_famiglia (from processo_res)']
        ? Array.isArray(fields['descrizione_ricerca_famiglia (from processo_res)'])
          ? fields['descrizione_ricerca_famiglia (from processo_res)'][0]
          : fields['descrizione_ricerca_famiglia (from processo_res)']
        : null,
      match_disponibilità_famiglia_lavoratore: matchDisponibilita,
      disponibilità_settimanale_recap: fields.disponibilità_settimanale_recap || null,
      feedback_recruiter: fields.feedback_recruiter || null,
      indirizzo_lavoratore: fields.indirizzo_lavoratore || null,
      indirizzo_famiglia: fields['indirizzo_famiglia (from processo_res)']
        ? Array.isArray(fields['indirizzo_famiglia (from processo_res)'])
          ? fields['indirizzo_famiglia (from processo_res)'][0]
          : fields['indirizzo_famiglia (from processo_res)']
        : null,
      status: 'pending',
      job_id: null,
      stato_selezione: Array.isArray(fields.stato_selezione)
        ? fields.stato_selezione[0]
        : fields.stato_selezione,
      stato_processo_res: Array.isArray(fields.stato_processo_res)
        ? fields.stato_processo_res[0]
        : fields.stato_processo_res,
      lavoratore_record_id: lavoratoreId,
      lavoratore_record_field: lavoratoreIdFieldUsed,
    };

    lavoratori.push(lavoratore);
  }

  console.log('✅ Final lavoratori count:', lavoratori.length);

  const selectionPriority: Record<string, number> = {
    'Candidato - Good fit': 0,
    Prospetto: 1,
    'Candidato - Poor fit': 2,
  };

  lavoratori.sort((a, b) => {
    const priorityA = selectionPriority[a.stato_selezione ?? ''] ?? 99;
    const priorityB = selectionPriority[b.stato_selezione ?? ''] ?? 99;
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    const parseTime = (value: string | null) => {
      if (!value) return Number.POSITIVE_INFINITY;
      if (typeof value !== 'string') {
        value = String(value);
      }
      const match = value.match(/(\d+)\s*min/i);
      if (match) return Number(match[1]);
      const num = Number(value.replace(/[^\d.]/g, ''));
      return Number.isFinite(num) ? num : Number.POSITIVE_INFINITY;
    };

    return parseTime(a.travel_time) - parseTime(b.travel_time);
  });

  return lavoratori;
}

export async function fetchWorkerSelections(
  lavoratoreId: string,
  lavoratoreField?: string | null
): Promise<WorkerSelection[]> {
  const escapedId = escapeFormulaValue(lavoratoreId);
  let filterFormula: string | undefined;
  if (lavoratoreField) {
    filterFormula = `FIND('${escapedId}', ARRAYJOIN({${lavoratoreField}}, ','))>0`;
  }

  let records: AirtableRecord[] = [];
  try {
    records = await fetchAirtableView(
      'lavoratori_selezionati',
      '[🔒] Lovable Tinder Database',
      filterFormula ? { filterByFormula: filterFormula } : undefined
    );
  } catch (error) {
    console.warn('Worker selection filter failed, falling back to full fetch:', error);
    records = await fetchAirtableView('lavoratori_selezionati', '[🔒] Lovable Tinder Database');
  }

  const normalizedId = lavoratoreId.toLowerCase();

  const filtered = records.filter((record) => {
    for (const field of POSSIBLE_LAVORATORE_ID_FIELDS) {
      const raw = record.fields[field];
      if (!raw) continue;
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.some((value) => String(value).toLowerCase() === normalizedId)) {
        return true;
      }
    }
    return false;
  });

  return filtered.map((record) => {
    const fields = record.fields;
    const processoResRaw = fields.processo_res;
    const processoRes = Array.isArray(processoResRaw)
      ? processoResRaw[0]
      : processoResRaw;
    const processoTitleRaw = fields.processo_title;
    let processoTitleValue = Array.isArray(processoTitleRaw)
      ? processoTitleRaw[0]
      : processoTitleRaw;
    if (typeof processoTitleValue === 'string') {
      const parts = processoTitleValue.split('|').map((part) => part.trim());
      const filteredParts = parts.filter((part) => part.length > 0);
      if (filteredParts.length > 1) {
        processoTitleValue = filteredParts.slice(0, -1).join(' | ');
      } else if (filteredParts.length === 1) {
        processoTitleValue = filteredParts[0];
      }
    }
    const statoRaw = fields.stato_processo_res;
    const stato = Array.isArray(statoRaw) ? statoRaw[0] : statoRaw;
    const recruiterField = fields.recruiter_processo_res;
    const recruiterId = Array.isArray(recruiterField)
      ? recruiterField[0]
      : recruiterField;

    return {
      id: record.id,
      processoId: processoRes ? String(processoRes) : null,
      processoTitle: processoTitleValue ? String(processoTitleValue) : null,
      statoProcesso: stato ? String(stato) : null,
      recruiterId: recruiterId ? String(recruiterId) : null,
    };
  });
}

export async function updateCandidateSelectionStatus(
  recordId: string,
  newStatus: string
): Promise<void> {
  if (!recordId) {
    throw new Error('Record ID mancante');
  }

  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/lavoratori_selezionati/${recordId}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        stato_selezione: newStatus,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Airtable update error:', response.status, response.statusText);
    console.error('Error response body:', errorBody);
    throw new Error('Impossibile aggiornare lo stato su Airtable');
  }
}
