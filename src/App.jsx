 import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import './App.css';
import { FaCut, FaUserCircle, FaSignInAlt, FaSignOutAlt, FaCog, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { MdOutlineContentCut } from "react-icons/md";
import { staticServices } from './services.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const App = async () => {
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
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminAppointments, setAdminAppointments] = useState([]);
  const [adminView, setAdminView] = useState('appointments');

  const ADMIN_USERNAME = 'ADM123';
  const ADMIN_PASSWORD = '12345';

  const backgroundImages = ['/l4dq00mz.jpeg', '/lt7h3jnf.jpeg', '/967bq6ij.jpeg'];
  const [currentBg, setCurrentBg] = useState(0);

  const resetForm = () => {
    setSelectedBarber(null);
    setSelectedServices([]);
    setSelectedDate('');
    setSelectedTime('');
    setClientName('');
  };

  // === INICIALIZAÇÃO ===
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
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

  const generateTimeSlots = () => [
    '08:00', '08:40', '09:20', '10:00', '10:40', '11:20',
    '14:00', '14:40', '15:20', '16:00', '16:40', '17:20', '18:00', '18:40', '19:20'
  ];

  const fetchAvailableTimes = async () => {
    setLoading(true);
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

  // Confirma agendamento no Supabase
const { data: result, error: supabaseError } = await supabase
  .rpc('book_slot', {
    _barbeiro_id: barberId,
    _data: date,
    _hora: selected,
    _cliente_nome: clienteNome
  });

if (error) {
  alert('Erro ao confirmar agendamento: ' + error.message);
  return;
}

// Verifica se o Supabase confirmou
if (result && result[0]?.success) {
  // 🔎 Busca o telefone do barbeiro no banco
  const { data: barbeiroData, error: barbeiroError } = await supabase
    .from('barbeiros')
    .select('telefone, nome')
    .eq('id', barberId)
    .single();

  if (barbeiroError || !barbeiroData?.telefone) {
    alert('Erro ao abrir o WhatsApp do barbeiro. Verifique o número cadastrado.');
    return;
  }

  // 🧹 Limpa caracteres e monta o link
  const telefoneLimpo = barbeiroData.telefone.replace(/\D/g, '');
  const mensagem = `Olá, acabei de confirmar meu agendamento para o dia ${date} às ${selected}.`;
  const url = `https://wa.me/55${telefoneLimpo}?text=${encodeURIComponent(mensagem)}`;

  // 🚀 Redirecionamento automático
  window.location.href = url;

} else {
  alert(result?.[0]?.message || 'Falha ao confirmar agendamento.');
}

 

  // === FUNÇÕES ADMIN ===
  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminUsername === ADMIN_USERNAME && adminPassword === ADMIN_PASSWORD) {
      setAdminLoggedIn(true);
      setView('adminDashboard');
    } else {
      setError('Usuário ou senha inválidos.');
    }
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

  // === TELAS ===
  const renderHome = () => (
    <div
      className="min-h-screen flex flex-col items-center justify-center text-center relative overflow-hidden"
      style={{
        backgroundImage: `url(${backgroundImages[currentBg]})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
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
  )

  // Aqui viriam os outros renderizadores (barbers, services, schedule, adminLogin, adminDashboard)
  // Mantenha exatamente como já estavam antes.
const renderBarbers = () => (
  <div className="min-h-screen bg-background text-text p-4 flex flex-col items-center">
    <h2 className="text-2xl font-bold text-primary mb-6">Escolha seu Barbeiro</h2>
    {loading && <div className="loading-spinner"></div>}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
      {barbers.map((barber) => (
        <div
          key={barber.id}
          className="barber-card flex flex-col items-center p-4 cursor-pointer hover:scale-105 transition-transform"
          onClick={() => {
            setSelectedBarber(barber);
            setView('services');
          }}
        >
          <FaUserCircle className="text-primary text-5xl mb-2" />
          <h3 className="text-xl font-semibold mb-1">{barber.nome}</h3>
        </div>
      ))}
    </div>
    <button onClick={() => setView('home')} className="button button-outline mt-6 w-full max-w-xs">
      Voltar
    </button>
  </div>
);
 const renderServices = () => (
  <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-800 to-zinc-900 text-white p-4 flex flex-col items-center">
    <h2 className="text-3xl font-bold text-primary mb-6 text-center">
      Escolha os Serviços
    </h2>

    {loading && <div className="loading-spinner"></div>}

    <div className="grid grid-cols-2 gap-4 w-full max-w-2xl mb-8">
      {services.map((service) => {
        const selected = selectedServices.some((s) => s.id === service.id);
        return (
          <div
            key={service.id}
            onClick={() => handleServiceSelect(service)}
            className={`relative cursor-pointer p-6 rounded-2xl transition-all duration-200 transform hover:scale-105 ${
              selected
                ? 'bg-gradient-to-br from-amber-500 to-yellow-600 shadow-[0_0_20px_rgba(255,193,7,0.6)] scale-105'
                : 'bg-zinc-800 hover:bg-zinc-700'
            }`}
          >
            <MdOutlineContentCut className="text-4xl mb-3 text-white opacity-90" />
            <h3 className="text-lg font-semibold mb-1">{service.name}</h3>
            <p className="text-sm opacity-80">R$ {service.price.toFixed(2)}</p>
            {selected && (
              <FaCheckCircle className="absolute top-3 right-3 text-green-300 text-xl animate-pulse" />
            )}
          </div>
        );
      })}
    </div>

    <div className="w-full max-w-md flex justify-between items-center mb-6 p-3 bg-zinc-800 rounded-xl shadow-lg">
      <p className="text-lg font-semibold">
        Total: <span className="text-amber-400">R$ {calculateTotal().toFixed(2)}</span>
      </p>
      <button
        onClick={() => setView('schedule')}
        className={`px-6 py-3 rounded-xl text-white font-semibold ${
          selectedServices.length > 0
            ? 'bg-amber-500 hover:bg-amber-600 transition-all'
            : 'bg-gray-600 cursor-not-allowed'
        }`}
        disabled={selectedServices.length === 0}
      >
        Continuar
      </button>
    </div>

    <button
      onClick={() => setView('barbers')}
      className="button button-outline mt-4 w-full max-w-xs"
    >
      Voltar
    </button>
  </div>
);

const renderSchedule = () => (
  <div className="min-h-screen bg-background text-text p-4 flex flex-col items-center">
    <h2 className="text-2xl font-bold text-primary mb-6">Agende seu Horário</h2>
    {loading && <div className="loading-spinner"></div>}

    <div className="w-full max-w-md mb-4">
      <label htmlFor="date" className="label mb-2">Data:</label>
      <input
        type="date"
        id="date"
        className="input w-full"
        value={selectedDate}
        onChange={(e) => setSelectedDate(e.target.value)}
        min={new Date().toISOString().split('T')[0]}
      />
    </div>

    {selectedDate && (
      <div className="w-full max-w-md mb-6">
        <label className="label mb-2">Horários Disponíveis:</label>
        {availableTimes.length === 0 && !loading && (
          <p className="text-text-muted">Nenhum horário disponível para esta data.</p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {availableTimes.map((time) => (
            <button
              key={time}
              className={`button ${selectedTime === time ? 'button-primary' : 'button-outline'}`}
              onClick={() => setSelectedTime(time)}
            >
              {time}
            </button>
          ))}
        </div>
      </div>
    )}

    <div className="w-full max-w-md mb-4">
      <label htmlFor="clientName" className="label mb-2">Seu Nome Completo:</label>
      <input
        type="text"
        id="clientName"
        className="input w-full"
        value={clientName}
        onChange={(e) => setClientName(e.target.value)}
        placeholder="Nome e Sobrenome"
      />
    </div>

    <div className="w-full max-w-md flex justify-between items-center mt-4">
      <button onClick={() => setView('services')} className="button button-outline">
        Voltar
      </button>
      <button
        onClick={handleConfirmAppointment}
        className="button button-primary"
        disabled={!selectedDate || !selectedTime || !clientName || loading}
      >
        Confirmar Agendamento
      </button>
    </div>
  </div>
);

  switch (view) {
    case 'barbers': return renderBarbers();
    case 'services': return renderServices();
    case 'schedule': return renderSchedule();
    case 'adminLogin': return renderAdminLogin();
    case 'adminDashboard': return renderAdminDashboard();
    default: return renderHome();
  }
}

export default App;

