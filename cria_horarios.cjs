const axios = require('axios');

const SUPABASE_URL = 'https://ylnnaqrnvghrxdqyzgiz.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlsbm5hcXJudmdocnhkcXl6Z2l6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTUwMzQyMCwiZXhwIjoyMDc1MDc5NDIwfQ.PPVRzDYzso5qZcqMvxX_ds_mrokMNndxo_kIi7gHmjg';

const barbeiros = [1, 2, 3]; // IDs dos barbeiros conforme sua tabela

const startDate = new Date('2025-11-09');
const endDate = new Date('2027-01-01');

function pad(num) { return num < 10 ? '0' + num : num; }

function generateHorariosForDay(date, barbeiro_id) {
  // manhã
  const horarios = [];
  for (let h = 8; h <= 12; h++) {
    horarios.push(`${pad(h)}:00:00`);
    horarios.push(`${pad(h)}:40:00`);
  }
  // tarde/noite
  for (let h = 14; h <= 20; h++) {
    horarios.push(`${pad(h)}:00:00`);
    horarios.push(`${pad(h)}:40:00`);
  }
  return horarios.map(hora => ({
    barbeiro_id,
    cliente_id: null,
    data: date.toISOString().split('T')[0],
    hora,
    ocupado: false,
  }));
}

async function main() {
  let allHorarios = [];
  for(
    let d = new Date(startDate);
    d <= endDate;
    d.setDate(d.getDate() + 1)
  ) {
    // Segunda a sábado (0 = domingo, 6 = sábado)
    if (d.getDay() >= 1 && d.getDay() <= 6) {
      barbeiros.forEach(barbeiro_id => {
        const hs = generateHorariosForDay(new Date(d), barbeiro_id);
        allHorarios.push(...hs);
      });
    }
  }
  // Envia em lotes de até 900 (limite Supabase REST)
  while (allHorarios.length) {
    const lote = allHorarios.splice(0, 900);
    try {
      const resp = await axios.post(
        `${SUPABASE_URL}/rest/v1/horarios`,
        lote,
        {
          headers: {
            apikey: API_KEY,
            Authorization: `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal'
          }
        }
      );
      console.log('Lote inserido:', lote[0]?.data, '-', lote[lote.length-1]?.data);
    } catch (e) {
      console.error('Erro no lote:', e.response?.data || e.message);
    }
  }
}

main();
