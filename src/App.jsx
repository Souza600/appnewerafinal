import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import './App.css';
import { FaCut, FaUserCircle, FaSignInAlt, FaSignOutAlt, FaCog, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { MdOutlineContentCut } from "react-icons/md";
import { staticServices } from './services.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const App = () => {
  const [view, setView] = useState('home');
  const [selectedBarber, setSelectedBarber] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [clientName, setClientName] = useState('');
  const [barbers, setBarbers] = useState([]);
  const [services, setServices] = useState([]);
  const [availableTimes, setAvailableTimes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminAppointments, setAdminAppointments] = useState([]);
  const [adminView, setAdminView] = useState('appointments');

  const ADMIN_USERNAME = 'ADM123';
  const ADMIN_PASSWORD = '12345';

  const backgroundImages = ['/l4dq00mz.jpeg', '/lt7h3jnf.jpeg', '/967bq6ij.jpeg'];
  const [currentBg, setCurrentBg] = useState(0);

  // Função auxiliar pra limpar formulário
  const resetForm = () => {
    setSelectedBarber(null);
    setSelectedServices([]);
    setSelectedDate('');
    setSelectedTime('');
    setClientName('');
  };

  // Buscar barbeiros e serviços
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setError('');
      try {
        const { data: barbersData, error: barbersError } = await supabase.from('barbeiros').select('*');
        if (barbersError) throw barbersError;
        setBarbers(barbersData);
        setServices(staticServices);
      } catch (err) {
        console.error('Erro ao buscar dados iniciais:', err);
        setError('Erro ao carregar dados. Tente novamente.');
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();

    const interval = setInterval(() => {
      setCurrentBg((prev) => (prev + 1) % backgroundImages.length);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedBarber && selectedDate) fetchAvailableTimes();
  }, [selectedBarber, selectedDate]);

  const generateTimeSlots = () => {
    return [
      '08:00', '08:40', '09:20', '10:00', '10:40', '11:20',
      '14:00', '14:40', '15:20', '16:00', '16:40', '17:20', '18:00', '18:40', '19:20'
    ];
  };

  const fetchAvailableTimes = async () => {
    setLoading(true);
    setError('');
    try {
      const allPossibleTimes = generateTimeSlots();
      const { data, error } = await supabase
        .from('horarios')
        .select('*')
        .eq('barbeiro_id', selectedBarber.id)
        .eq('data', selectedDate)
        .eq('ocupado', true);

      if (error) throw error;

      const occupiedTimes = data ? data.map(h => h.hora.substring(0, 5)) : [];
      const available = allPossibleTimes.filter(t => !occupiedTimes.includes(t));
      setAvailableTimes(available);
    } catch (err) {
      console.error('Erro ao buscar horários disponíveis:', err);
      setAvailableTimes(generateTimeSlots());
    } finally {
      setLoading(false);
    }
  };

  const handleServiceSelect = (service) => {
    setSelectedServices((prev) =>
      prev.some(s => s.id === service.id)
        ? prev.filter((s) => s.id !== service.id)
        : [...prev, service]
    );
  };

  const calculateTotal = () => selectedServices.reduce((sum, s) => sum + s.price, 0);

  const handleConfirmAppointment = async () => {
    setLoading(true);
    setError('');
    try {
      // Inserir cliente
      let client_id;
      const { data: existingClient } = await supabase
        .from('clientes')
        .select('id')
        .eq('nome', clientName)
        .maybeSingle();

      if (existingClient) {
        client_id = existingClient.id;
      } else {
        const { data: newClient } = await supabase
          .from('clientes')
          .insert([{ nome: clientName }])
          .select('id')
          .single();
        client_id = newClient.id;
      }

      // Marcar horário ocupado
      const { data: existingSlot } = await supabase
        .from('horarios')
        .select('id')
        .eq('barbeiro_id', selectedBarber.id)
        .eq('data', selectedDate)
        .eq('hora', `${selectedTime}:00`)
        .maybeSingle();

      if (existingSlot) {
        await supabase.from('horarios').update({ ocupado: true, cliente_id: client_id }).eq('id', existingSlot.id);
      } else {
        await supabase.from('horarios').insert([{
          barbeiro_id: selectedBarber.id,
          data: selectedDate,
          hora: `${selectedTime}:00`,
          ocupado: true,
          cliente_id: client_id
        }]);
      }

      // Buscar telefone do barbeiro
const { data: barberData, error: barberError } = await supabase
  .from('barbeiros')
  .select('telefone, nome')
  .eq('id', selectedBarber.id)
  .single();

if (barberError || !barberData) {
  console.error('Erro ao buscar telefone do barbeiro:', barberError);
  alert('Erro ao obter o telefone do barbeiro.');
  return;
}

const telefoneClean = barberData.telefone.replace(/\D/g, '');
const servicosTexto = selectedServices.map(s => s.name).join(', ');
const dataFormatada = new Date(selectedDate).toLocaleDateString('pt-BR');

const mensagem = `Olá ${barberData.nome}! Acabei de confirmar meu agendamento para o dia ${dataFormatada} às ${selectedTime} com os serviços: ${servicosTexto}.`;

const whatsappUrl = `https://wa.me/55${telefoneClean}?text=${encodeURIComponent(mensagem)}`;

// 🔥 Redirecionamento garantido
setTimeout(() => {
  try {
    window.open(whatsappUrl, '_blank');
  } catch (redirectError) {
    console.error('Erro ao abrir WhatsApp:', redirectError);
    alert('Não foi possível abrir o WhatsApp. Verifique o número.');
  }
}, 500);

resetForm();
setView('home');

  // Simulação de funções admin
  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminUsername === ADMIN_USERNAME && adminPassword === ADMIN_PASSWORD) {
      setAdminLoggedIn(true);
      setView('adminDashboard');
    } else setError('Usuário ou senha inválidos.');
  };

  const handleAdminLogout = () => {
    setAdminLoggedIn(false);
    setView('home');
  };

  const fetchAdminAppointments = async () => {
    const { data } = await supabase
      .from('horarios')
      .select('*, barbeiros(nome), clientes(nome)')
      .order('data', { ascending: true });
    setAdminAppointments(data || []);
  };

  // === COMPONENTES ===
  const renderHome = () => (
    <div className="min-h-screen flex flex-col items-center justify-center text-center relative overflow-hidden"
      style={{
        backgroundImage: `url(${backgroundImages[currentBg]})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
      <div className="absolute inset-0 bg-black opacity-75"></div>
      <div className="relative z-10 flex flex-col items-center p-4">
        <img src="/newera_logo_refined.png" alt="Logo" className="w-24 mb-4 animate-float" />
        <h1 className="text-3xl font-bold text-primary mb-2">NewEra BarberSHOP</h1>
        <p className="text-lg text-white mb-6">Tradição renovada em cada corte</p>
        <button onClick={() => setView('barbers')} className="button button-primary mb-4 w-full max-w-xs">
          <FaCut className="mr-2" /> Agendar Horário
        </button>
        <button onClick={() => setView('adminLogin')} className="button button-outline w-full max-w-xs">
          <FaSignInAlt className="mr-2" /> Área Administrativa
        </button>
      </div>
    </div>
  );

  // ... (restante renderBarbers, renderServices, renderSchedule, renderAdminLogin, renderAdminDashboard — mantém o mesmo)

  switch (view) {
    case 'barbers': return renderBarbers();
    case 'services': return renderServices();
    case 'schedule': return renderSchedule();
    case 'adminLogin': return renderAdminLogin();
    case 'adminDashboard': return renderAdminDashboard();
    default: return renderHome();
  }
};

export default App;
