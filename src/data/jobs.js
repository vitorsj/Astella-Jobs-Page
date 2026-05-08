export const COMPANIES = [
  { id: "rd",     name: "RD Station",    stage: "Series D", source: "Gupy" },
  { id: "olist",  name: "Olist",         stage: "Series E", source: "Lever" },
  { id: "csim",   name: "Conta Simples", stage: "Series B", source: "Gupy" },
  { id: "dr",     name: "Dr. Consulta",  stage: "Series C", source: "LinkedIn" },
  { id: "tag",    name: "Tag Imóveis",   stage: "Series A", source: "Lever" },
  { id: "asaas",  name: "Asaas",         stage: "Series B", source: "Gupy" },
  { id: "trinks", name: "Trinks",        stage: "Seed",     source: "LinkedIn" },
  { id: "wpp",    name: "Worc",          stage: "Seed",     source: "LinkedIn" },
];

export const COMPANY = Object.fromEntries(COMPANIES.map(c => [c.id, c]));

export const JOBS = [
  { id: 1,  company: "rd",     title: { pt: "Engenheiro(a) de Software Pleno",  en: "Software Engineer, Mid-level" },     area: "Engineering", level: "Mid",    loc: "São Paulo",      mode: "Híbrido",    posted: "2d", url: "https://rdstation.gupy.io/jobs/1" },
  { id: 2,  company: "rd",     title: { pt: "Product Manager — Marketing Hub",  en: "Product Manager — Marketing Hub" },  area: "Product",     level: "Senior", loc: "Florianópolis",  mode: "Híbrido",    posted: "5d", url: "https://rdstation.gupy.io/jobs/2" },
  { id: 3,  company: "rd",     title: { pt: "Data Engineer",                    en: "Data Engineer" },                    area: "Data",        level: "Senior", loc: "Remoto",         mode: "Remoto",     posted: "1d", url: "https://rdstation.gupy.io/jobs/3" },
  { id: 4,  company: "olist",  title: { pt: "Designer de Produto Sênior",       en: "Senior Product Designer" },          area: "Design",      level: "Senior", loc: "Curitiba",       mode: "Híbrido",    posted: "3d", url: "https://olist.lever.co/jobs/4" },
  { id: 5,  company: "olist",  title: { pt: "Engenheiro(a) Backend",            en: "Backend Engineer" },                 area: "Engineering", level: "Mid",    loc: "Remoto",         mode: "Remoto",     posted: "1d", url: "https://olist.lever.co/jobs/5" },
  { id: 6,  company: "olist",  title: { pt: "Tech Lead — Pagamentos",           en: "Tech Lead — Payments" },             area: "Engineering", level: "Lead",   loc: "São Paulo",      mode: "Híbrido",    posted: "6d", url: "https://olist.lever.co/jobs/6" },
  { id: 7,  company: "csim",   title: { pt: "Account Executive",                en: "Account Executive" },                area: "Sales",       level: "Mid",    loc: "São Paulo",      mode: "Presencial", posted: "4d", url: "https://contasimples.gupy.io/jobs/7" },
  { id: 8,  company: "csim",   title: { pt: "Customer Success Manager",         en: "Customer Success Manager" },         area: "CS",          level: "Mid",    loc: "Remoto",         mode: "Remoto",     posted: "2d", url: "https://contasimples.gupy.io/jobs/8" },
  { id: 9,  company: "dr",     title: { pt: "Médico(a) Clínico Geral",          en: "General Practitioner" },             area: "Operations",  level: "Senior", loc: "São Paulo",      mode: "Presencial", posted: "1d", url: "https://drconsulta.linkedin.com/jobs/9" },
  { id: 10, company: "dr",     title: { pt: "Coordenador(a) de Operações",      en: "Operations Coordinator" },           area: "Operations",  level: "Lead",   loc: "São Paulo",      mode: "Presencial", posted: "8d", url: "https://drconsulta.linkedin.com/jobs/10" },
  { id: 11, company: "tag",    title: { pt: "Analista de Marketing",             en: "Marketing Analyst" },               area: "Marketing",   level: "Junior", loc: "São Paulo",      mode: "Híbrido",    posted: "2d", url: "https://tagimoveis.lever.co/jobs/11" },
  { id: 12, company: "asaas",  title: { pt: "Engenheiro(a) de Plataforma Sr",   en: "Senior Platform Engineer" },         area: "Engineering", level: "Senior", loc: "Joinville",      mode: "Híbrido",    posted: "3d", url: "https://asaas.gupy.io/jobs/12" },
  { id: 13, company: "asaas",  title: { pt: "PM — Banking",                     en: "Product Manager — Banking" },        area: "Product",     level: "Senior", loc: "Remoto",         mode: "Remoto",     posted: "5d", url: "https://asaas.gupy.io/jobs/13" },
  { id: 14, company: "trinks", title: { pt: "Engenheiro(a) Frontend",           en: "Frontend Engineer" },                area: "Engineering", level: "Mid",    loc: "Rio de Janeiro", mode: "Remoto",     posted: "1d", url: "https://trinks.linkedin.com/jobs/14" },
  { id: 15, company: "wpp",    title: { pt: "Founding Engineer",                en: "Founding Engineer" },                area: "Engineering", level: "Lead",   loc: "São Paulo",      mode: "Híbrido",    posted: "9d", url: "https://worc.linkedin.com/jobs/15" },
  { id: 16, company: "rd",     title: { pt: "SDR Bilíngue",                     en: "Bilingual SDR" },                   area: "Sales",       level: "Junior", loc: "Florianópolis",  mode: "Presencial", posted: "7d", url: "https://rdstation.gupy.io/jobs/16" },
  { id: 17, company: "olist",  title: { pt: "Data Analyst",                     en: "Data Analyst" },                    area: "Data",        level: "Mid",    loc: "Remoto",         mode: "Remoto",     posted: "4d", url: "https://olist.lever.co/jobs/17" },
];
