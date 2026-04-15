require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: diogos } = await supabase.from('funcionarios').select('*, jornada:jornadas(*, detalhes:jornada_detalhes(*))').ilike('full_name', '%Diogo%');
  const diogo = diogos[0];
  
  const { data: pontos } = await supabase.from('pontos')
      .select('*').eq('funcionario_id', diogo.id).gte('data_hora', '2026-04-01T00:00:00').lte('data_hora', '2026-04-30T23:59:59').order('data_hora', { ascending: true });
  
  const parseTime = (str) => {
    if(!str) return null;
    const [h, m] = str.split(':').map(Number);
    const d = new Date('1970-01-01T00:00:00Z');
    d.setUTCHours(h, m, 0, 0);
    return d;
  };
  const adjust = (a, s, t) => {
    if(!a || !s || !t) return a;
    const ad = new Date(`1970-01-01T${a}:00Z`);
    const sd = new Date(`1970-01-01T${s}Z`);
    if (Math.abs((ad-sd)/60000) <= t) return s;
    return a;
  };

  const dates = {};
  pontos.forEach(p => {
      const dt = p.data_hora.split('T')[0];
      if(!dates[dt]) dates[dt] = {};
      const f = {'Entrada':'entrada','Inicio_Intervalo':'inicio_intervalo','Fim_Intervalo':'fim_intervalo','Saida':'saida'}[p.tipo_registro];
      dates[dt][f] = p.data_hora.split('T')[1].substring(0,5);
  });

  const jDiaMap = {};
  if(diogo.jornada && diogo.jornada.detalhes) {
    diogo.jornada.detalhes.forEach(j => jDiaMap[j.dia_semana] = j);
  }

  let totalTrab = 0;
  let totalExig = 0;
  let sPuro = 0;
  
  console.log("Calculando Diogo Abril 2026...");
  
  for(let i=1; i<=15; i++) {
     const dStr = `2026-04-${String(i).padStart(2,'0')}`;
     const d = new Date(`${dStr}T00:00:00Z`);
     const dw = d.getUTCDay();
     const jD = jDiaMap[dw];
     
     let minsExig = 0;
     const isWorkday = jD && jD.horario_entrada && jD.horario_saida;
     if (isWorkday) {
        const e = jD.horario_entrada.split(':').map(Number);
        const s = jD.horario_saida.split(':').map(Number);
        const si = jD.horario_saida_intervalo ? jD.horario_saida_intervalo.split(':').map(Number) : [0,0];
        const vi = jD.horario_volta_intervalo ? jD.horario_volta_intervalo.split(':').map(Number) : [0,0];
        minsExig = ((s[0]*60+s[1]) - (e[0]*60+e[1])) - ((vi[0]*60+vi[1]) - (si[0]*60+si[1]));
     }
     
     let minsTrab = 0;
     const pb = dates[dStr];
     let hp = false;
     
     if (pb && (pb.entrada || pb.saida)) {
         hp = true;
         // Tolerance 10 or from object
         const t = diogo.jornada?.tolerancia_minutos || 0;
         const ent = adjust(pb.entrada, jD?.horario_entrada, t);
         const sai = adjust(pb.saida, jD?.horario_saida, t);
         const iInt = adjust(pb.inicio_intervalo, jD?.horario_saida_intervalo, t);
         const fInt = adjust(pb.fim_intervalo, jD?.horario_volta_intervalo, t);
         
         const e = parseTime(ent); const s = parseTime(sai);
         const iI = parseTime(iInt); const fI = parseTime(fInt);
         
         let m = 0; let tr = 0;
         if (e && iI) m = iI - e;
         if (fI && s) tr = s - fI;
         let tot = Math.floor((m+tr)/60000);
         if (tot <= 0 && e && s) tot = Math.floor((s-e)/60000);
         if (tot < 0) tot = 0;
         minsTrab = tot;
     }

     if (isWorkday) totalExig += minsExig;
     totalTrab += minsTrab;
     
     let dSPuro = 0;
     if (hp) {
         dSPuro = minsTrab - minsExig;
     } else if (isWorkday) {
         dSPuro = -minsExig;
     }
     sPuro += dSPuro;
     
     console.log(`${dStr} (${dw}) | Exig: ${minsExig} | Trab: ${minsTrab} | CalcDia: ${dSPuro} | BAtéAgora: ${sPuro} | Pontos:`, pb);
  }
}
run();
