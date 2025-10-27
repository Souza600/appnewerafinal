import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ylnnaqrnvghrxdqyzgiz.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlsbm5hcXJudmdocnhkcXl6Z2l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MDM0MjAsImV4cCI6MjA3NTA3OTQyMH0.3GM05cw8qWuoBPKFejytKMlqCUyEe9wnTdlghQy0a9c'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Função para gerar horários disponíveis
export const generateTimeSlots = (barbeiro_id, data) => {
  const slots = []
  
  // Faixa 1: 08:00 às 12:00 (intervalos de 40 minutos)
  // 08:00, 08:40, 09:20, 10:00, 10:40, 11:20
  const morningSlots = ['08:00', '08:40', '09:20', '10:00', '10:40', '11:20']
  
  morningSlots.forEach(hora => {
    slots.push({
      barbeiro_id,
      data,
      hora,
      cliente_id: null,
      ocupado: false
    })
  })
  
  // Faixa 2: 14:00 às 20:00 (intervalos de 40 minutos)
  // 14:00, 14:40, 15:20, 16:00, 16:40, 17:20, 18:00, 18:40, 19:20
  const afternoonSlots = ['14:00', '14:40', '15:20', '16:00', '16:40', '17:20', '18:00', '18:40', '19:20']
  
  afternoonSlots.forEach(hora => {
    slots.push({
      barbeiro_id,
      data,
      hora,
      cliente_id: null,
      ocupado: false
    })
  })
  
  return slots
}

// Função para criar horários para um barbeiro em uma data específica
export const createTimeSlotsForDate = async (barbeiro_id, data) => {
  try {
    // Verificar se já existem horários para esta data e barbeiro
    const { data: existingSlots } = await supabase
      .from('horarios')
      .select('*')
      .eq('barbeiro_id', barbeiro_id)
      .eq('data', data)
    
    if (existingSlots && existingSlots.length > 0) {
      return existingSlots
    }
    
    // Gerar novos horários
    const newSlots = generateTimeSlots(barbeiro_id, data)
    
    // Inserir no banco
    const { data: insertedSlots, error } = await supabase
      .from('horarios')
      .insert(newSlots)
      .select()
    
    if (error) {
      console.error('Erro ao criar horários:', error)
      return []
    }
    
    return insertedSlots
  } catch (error) {
    console.error('Erro ao criar horários:', error)
    return []
  }
}

// Função para buscar horários disponíveis
export const getAvailableTimeSlots = async (barbeiro_id, data) => {
  try {
    // Primeiro, garantir que os horários existam para esta data
    await createTimeSlotsForDate(barbeiro_id, data)
    
    // Buscar horários disponíveis
    const { data: slots, error } = await supabase
      .from('horarios')
      .select('*')
      .eq('barbeiro_id', barbeiro_id)
      .eq('data', data)
      .eq('ocupado', false)
      .order('hora')
    
    if (error) {
      console.error('Erro ao buscar horários:', error)
      return []
    }
    
    return slots || []
  } catch (error) {
    console.error('Erro ao buscar horários:', error)
    return []
  }
}

// Função para agendar um horário
export const bookTimeSlot = async (horario_id, cliente_nome, cliente_telefone = '') => {
  try {
    // Primeiro, criar ou buscar o cliente
    let cliente_id = null
    
    if (cliente_nome) {
      // Verificar se o cliente já existe
      const { data: existingClient } = await supabase
        .from('clientes')
        .select('id')
        .eq('nome', cliente_nome)
        .single()
      
      if (existingClient) {
        cliente_id = existingClient.id
      } else {
        // Criar novo cliente
        const { data: newClient, error: clientError } = await supabase
          .from('clientes')
          .insert({ nome: cliente_nome, telefone: cliente_telefone })
          .select('id')
          .single()
        
        if (clientError) {
          console.error('Erro ao criar cliente:', clientError)
          return { success: false, error: clientError }
        }
        
        cliente_id = newClient.id
      }
    }
    
    // Atualizar o horário como ocupado
    const { data, error } = await supabase
      .from('horarios')
      .update({ 
        ocupado: true, 
        cliente_id: cliente_id 
      })
      .eq('id', horario_id)
      .eq('ocupado', false) // Garantir que o horário ainda está disponível
      .select()
    
    if (error) {
      console.error('Erro ao agendar horário:', error)
      return { success: false, error }
    }
    
    if (!data || data.length === 0) {
      return { success: false, error: 'Horário não está mais disponível' }
    }
    
    return { success: true, data: data[0] }
  } catch (error) {
    console.error('Erro ao agendar horário:', error)
    return { success: false, error }
  }
}

// Função para buscar todos os barbeiros
export const getBarbeiros = async () => {
  try {
    const { data, error } = await supabase
      .from('barbeiros')
      .select('*')
      .order('id')
    
    if (error) {
      console.error('Erro ao buscar barbeiros:', error)
      return []
    }
    
    return data || []
  } catch (error) {
    console.error('Erro ao buscar barbeiros:', error)
    return []
  }
}

// Função para liberar um horário (para o painel administrativo)
export const releaseTimeSlot = async (horario_id) => {
  try {
    const { data, error } = await supabase
      .from('horarios')
      .update({ 
        ocupado: false, 
        cliente_id: null 
      })
      .eq('id', horario_id)
      .select()
    
    if (error) {
      console.error('Erro ao liberar horário:', error)
      return { success: false, error }
    }
    
    return { success: true, data: data[0] }
  } catch (error) {
    console.error('Erro ao liberar horário:', error)
    return { success: false, error }
  }
}

// Função para buscar agendamentos (para o painel administrativo)
export const getAgendamentos = async (barbeiro_id = null, data = null) => {
  try {
    let query = supabase
      .from('horarios')
      .select(`
        *,
        barbeiros (nome, telefone),
        clientes (nome, telefone)
      `)
      .eq('ocupado', true)
      .order('data')
      .order('hora')
    
    if (barbeiro_id) {
      query = query.eq('barbeiro_id', barbeiro_id)
    }
    
    if (data) {
      query = query.eq('data', data)
    }
    
    const { data: agendamentos, error } = await query
    
    if (error) {
      console.error('Erro ao buscar agendamentos:', error)
      return []
    }
    
    return agendamentos || []
  } catch (error) {
    console.error('Erro ao buscar agendamentos:', error)
    return []
  }
}
