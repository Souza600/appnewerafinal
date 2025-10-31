import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import './App.css';
import { FaCut, FaCalendarAlt, FaUserCircle, FaWhatsapp, FaSignInAlt, FaSignOutAlt, FaCog, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { MdOutlineContentCut } from "react-icons/md";
import { staticServices } from './services.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const App = () => {
  const [view, setView] = useState('home'); // home, barbers, services, schedule, confirm, adminLogin, adminDashboard
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
  const [adminView, setAdminView] = useState('appointments'); // appointments, services

  const ADMIN_USERNAME = 'ADM123';
  const ADMIN_PASSWORD = '12345';

  const backgroundImages = [
    '/l4dq00mz.jpeg',
    '/lt7h3jnf.jpeg',
    '/967bq6ij.jpeg',
  ];
  const [currentBg, setCurrentBg] = useState(0);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setError('');
      try {
        const { data: barbersData, error: barbersError } = await supabase
          .from('barbeiros')
          .select('*');
        if (barbersError) throw barbersError;
        setBarbers(barbersData);

        // Usar serviços estáticos para garantir funcionamento
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
    }, 10000); // Troca a imagem a cada 10 segundos
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedBarber && selectedDate) {
      fetchAvailableTimes();
    }
  }, [selectedBarber, selectedDate]);

  const fetchAvailableTimes = async () => {
    setLoading(true);
    setError('');
    try {
      // Gerar todos os horários possíveis para o dia
      const allPossibleTimes = generateTimeSlots();

      // Buscar horários ocupados para este barbeiro e data
      const { data, error } = await supabase
        .from('horarios')
        .select('*')
        .eq('barbeiro_id', selectedBarber.id)
        .eq('data', selectedDate)
        .eq('ocupado', true);

      if (error) {
        console.error('Erro ao buscar horários ocupados:', error);
        // Se houver erro na consulta, mostrar todos os horários disponíveis
        setAvailableTimes(allPossibleTimes);
        return;
      }

      // Filtrar os horários já ocupados
      const occupiedTimes = data ? data.map(h => h.hora.substring(0, 5)) : []; // HH:MM
      const available = allPossibleTimes.filter(time => !occupiedTimes.includes(time));

      setAvailableTimes(available);
    } catch (err) {
      console.error('Erro ao buscar horários disponíveis:', err);
      // Em caso de erro, mostrar todos os horários
      const allPossibleTimes = generateTimeSlots();
      setAvailableTimes(allPossibleTimes);
    } finally {
      setLoading(false);
    }
  };

  const generateTimeSlots = () => {
    const slots = [];
    
    // Faixa 1: 08:00 às 12:00 (intervalos de 40 minutos)
    const morningSlots = ['08:00', '08:40', '09:20', '10:00', '10:40', '11:20'];
    
    // Faixa 2: 14:00 às 20:00 (intervalos de 40 minutos)
    const afternoonSlots = ['14:00', '14:40', '15:20', '16:00', '16:40', '17:20', '18:00', '18:40', '19:20'];
    
    slots.push(...morningSlots, ...afternoonSlots);
    return slots;
  };

  const handleServiceSelect = (service) => {
    setSelectedServices((prev) =>
      prev.some(s => s.id === service.id)
        ? prev.filter((s) => s.id !== service.id)
        : [...prev, service]
    );
  };

  const calculateTotal = () => {
    return selectedServices.reduce((sum, service) => sum + service.price, 0);
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
    setSelectedTime(''); // Reset time when date changes
  };

  const handleConfirmAppointment = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Inserir/Atualizar Cliente
      let client_id;
      const { data: existingClient, error: clientSearchError } = await supabase
        .from('clientes')
        .select('id')
        .eq('nome', clientName)
        .single();

      if (clientSearchError && clientSearchError.code !== 'PGRST116') { // PGRST116 means no rows found
        throw clientSearchError;
      }

      if (existingClient) {
        client_id = existingClient.id;
      } else {
        const { data: newClient, error: newClientError } = await supabase
          .from('clientes')
          .insert([{ nome: clientName }])
          .select('id');
        if (newClientError) throw newClientError;
        client_id = newClient[0].id;
      }

      // 2. Inserir ou atualizar horário como ocupado
      const { data: existingSlot, error: slotSearchError } = await supabase
        .from('horarios')
        .select('id')
        .eq('barbeiro_id', selectedBarber.id)
        .eq('data', selectedDate)
        .eq('hora', `${selectedTime}:00`)
        .single();

      if (existingSlot) {
        // Atualizar slot existente
        const { error: updateError } = await supabase
          .from('horarios')
          .update({ ocupado: true, cliente_id: client_id })
          .eq('id', existingSlot.id);
        if (updateError) throw updateError;
      } else {
        // Criar novo slot
        const { error: insertError } = await supabase
          .from('horarios')
          .insert([{
            barbeiro_id: selectedBarber.id,
            data: selectedDate,
            hora: `${selectedTime}:00`,
            ocupado: true,
            cliente_id: client_id
          }]);
        if (insertError) throw insertError;
      }

     // ======= PATCH FINAL REDIRECIONAMENTO WHATSAPP =======
setLoading(true);
setError(null);
setSuccess('Redirecionando para o WhatsApp do barbeiro...');

// Redirecionamento garantido com fallback
setTimeout(() => {
  try {
    const telefoneClean = barberData.telefone.replace(/\D/g, '');
    const servicosTexto = selectedServices.map(s => s.name).join(', ');
    const [year, month, day] = selectedDate.split('-');
    const dataFormatada = new Date(year, month - 1, day).toLocaleDateString('pt-BR');
    const mensagem = `Olá, acabei de confirmar meu agendamento para o dia ${dataFormatada} às ${selectedTime} com você com os serviços ${servicosTexto}.`;
    const whatsappUrl = `https://wa.me/55${telefoneClean}?text=${encodeURIComponent(mensagem)}`;

    console.log('✅ Redirecionando para WhatsApp:', whatsappUrl);
    alert('Redirecionando para o WhatsApp...');

    // Método principal
    window.location.href = whatsappUrl;

    // Fallback em nova aba
    setTimeout(() => {
      if (!document.hidden) {
        window.open(whatsappUrl, '_blank');
      }
    }, 1000);
  } catch (redirectError) {
    console.error('Erro ao redirecionar para WhatsApp:', redirectError);
    alert('Não foi possível abrir o WhatsApp. Verifique o número.');
  }
}, 500);

// Limpeza de estado
setTimeout(() => {
  resetForm();
  setView('home');
  setLoading(false);
}, 1500);


  };

  const handleToggleSlot = async (slotId, currentStatus) => {
    setLoading(true);
    setError('');
    try {
      const newStatus = !currentStatus;
      const updateData = { ocupado: newStatus };
      if (!newStatus) {
        updateData.cliente_id = null; // Liberar slot
      }

      const { error } = await supabase
        .from('horarios')
        .update(updateData)
        .eq('id', slotId);

      if (error) throw error;
      fetchAdminAppointments(); // Recarregar agendamentos
    } catch (err) {
      console.error('Erro ao atualizar slot:', err);
      setError('Erro ao atualizar status do horário.');
    } finally {
      setLoading(false);
    }
  };

  const renderHome = () => (
    <div
      className="min-h-screen flex flex-col items-center justify-center text-center relative overflow-hidden"
      style={{
        backgroundImage: `url(${backgroundImages[currentBg]})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        transition: 'background-image 1s ease-in-out',
      }}
    >
      <div className="absolute inset-0 bg-black opacity-75"></div> {/* Overlay escuro */}
      <div className="relative z-10 flex flex-col items-center justify-center p-4">
        <img
          src="/newera_logo_refined.png"
          alt="NewEra BarberSHOP Logo"
          className="w-24 h-auto mb-4 animate-float" // Ajustado para tamanho menor
        />
        <h1 className="text-3xl font-bold text-primary mb-2">NewEra BarberSHOP</h1>
        <p className="text-lg text-white mb-6">Tradição renovada em cada corte</p>
        <button
          onClick={() => setView('barbers')}
          className="button button-primary mb-4 w-full max-w-xs"
        >
          <FaCut className="mr-2" /> Agendar Horário
        </button>
        <button
          onClick={() => setView('adminLogin')}
          className="button button-outline w-full max-w-xs"
        >
          <FaSignInAlt className="mr-2" /> Área Administrativa
        </button>
      </div>

      <footer className="relative z-10 w-full py-4 text-center text-white text-sm bg-black bg-opacity-50 mt-auto">
        <p>Av. Colombo Machado Sales, 660, sala 2</p>
        <p>Seg-Sáb: 08:00-12:00 / 14:00-20:00</p>
        <p className="mt-1">
          <a href="https://www.instagram.com/_newera.barbershop" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            @_newera.barbershop
          </a>
        </p>
      </footer>
    </div>
  );

  const renderBarbers = () => (
    <div className="min-h-screen bg-background text-text p-4 flex flex-col items-center">
      <h2 className="text-2xl font-bold text-primary mb-6">Escolha seu Barbeiro</h2>
      {loading && <div className="loading-spinner"></div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
        {barbers.map((barber) => (
          <div
            key={barber.id}
            className="barber-card flex flex-col items-center p-4 cursor-pointer"
            onClick={() => {
              setSelectedBarber(barber);
              setView('services');
            }}
          >
            <FaUserCircle className="text-primary text-5xl mb-2" /> {/* Ícone genérico */}
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
    <div className="min-h-screen bg-background text-text p-4 flex flex-col items-center">
      <h2 className="text-2xl font-bold text-primary mb-6">Selecione os Serviços</h2>
      {loading && <div className="loading-spinner"></div>}
      <div className="grid grid-cols-2 gap-3 w-full max-w-xl mb-6">
        {services.map((service) => (
          <div
            key={service.id}
            className={`service-card flex flex-col items-center p-3 cursor-pointer ${selectedServices.some(s => s.id === service.id) ? 'selected' : ''}`}
            onClick={() => handleServiceSelect(service)}
          >
            <MdOutlineContentCut className="text-primary text-3xl mb-2" /> {/* Ícone genérico para serviço */}
            <h3 className="text-lg font-semibold text-center">{service.name}</h3>
            <p className="text-text-muted text-sm">R$ {service.price.toFixed(2)}</p>
            {selectedServices.some(s => s.id === service.id) && (
              <FaCheckCircle className="absolute top-2 right-2 text-primary" />
            )}
          </div>
        ))}
      </div>
      <div className="w-full max-w-md flex justify-between items-center mb-4 p-3 bg-card rounded-lg">
        <p className="text-lg font-semibold">Total: R$ {calculateTotal().toFixed(2)}</p>
        <button
          onClick={() => setView('schedule')}
          className="button button-primary"
          disabled={selectedServices.length === 0}
        >
          Continuar ({selectedServices.length} serviço{selectedServices.length !== 1 ? 's' : ''})
        </button>
      </div>
      <button onClick={() => setView('barbers')} className="button button-outline mt-6 w-full max-w-xs">
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
          onChange={handleDateChange}
          min={new Date().toISOString().split('T')[0]} // Data mínima é hoje
        />
      </div>

      {selectedDate && (
        <div className="w-full max-w-md mb-6">
          <label className="label mb-2">Horários Disponíveis:</label>
          {availableTimes.length === 0 && !loading && <p className="text-text-muted">Nenhum horário disponível para esta data.</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 w-full max-w-2xl">
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

      <div className="w-full max-w-md flex justify-between items-center mb-4">
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

  const renderAdminLogin = () => (
    <div className="min-h-screen bg-background text-text p-4 flex flex-col items-center justify-center">
      <h2 className="text-2xl font-bold text-primary mb-6">Login Administrativo</h2>
      {error && <p className="text-error mb-4">{error}</p>}
      <form onSubmit={handleAdminLogin} className="w-full max-w-xs space-y-4">
        <div>
          <label htmlFor="adminUsername" className="label">Usuário:</label>
          <input
            type="text"
            id="adminUsername"
            className="input w-full"
            value={adminUsername}
            onChange={(e) => setAdminUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="adminPassword" className="label">Senha:</label>
          <input
            type="password"
            id="adminPassword"
            className="input w-full"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="button button-primary w-full" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
      <button onClick={() => setView('home')} className="button button-outline mt-4 w-full max-w-xs">
        Voltar
      </button>
    </div>
  );

  const renderAdminDashboard = () => (
    <div className="min-h-screen bg-background text-text p-4 flex flex-col items-center">
      <header className="w-full flex justify-between items-center py-4 px-2 bg-card rounded-lg mb-6">
        <h2 className="text-xl font-bold text-primary">Painel Admin</h2>
        <button onClick={handleAdminLogout} className="button button-outline-sm">
          <FaSignOutAlt className="mr-2" /> Sair
        </button>
      </header>

      <nav className="w-full max-w-md flex justify-around mb-6">
        <button
          onClick={() => setAdminView('appointments')}
          className={`button ${adminView === 'appointments' ? 'button-primary' : 'button-outline'}`}
        >
          Horários
        </button>
        <button
          onClick={() => setAdminView('services')}
          className={`button ${adminView === 'services' ? 'button-primary' : 'button-outline'}`}
        >
          Serviços
        </button>
      </nav>

      {loading && <div className="loading-spinner"></div>}
      {error && <p className="text-error mb-4">{error}</p>}

      {adminView === 'appointments' && (
        <div className="w-full max-w-xl">
          <h3 className="text-xl font-bold text-primary mb-4">Agendamentos</h3>
          <button onClick={fetchAdminAppointments} className="button button-outline mb-4">
            Atualizar
          </button>
          {adminAppointments.length === 0 && !loading && <p className="text-text-muted">Nenhum agendamento encontrado.</p>}
          <div className="space-y-4">
            {adminAppointments.map((appointment) => (
              <div key={appointment.id} className="bg-card p-4 rounded-lg shadow-md flex flex-col sm:flex-row justify-between items-center">
                <div>
                  <p className="text-lg font-semibold">Data: {new Date(appointment.data).toLocaleDateString('pt-BR')}</p>
                  <p className="text-lg font-semibold">Hora: {appointment.hora.substring(0, 5)}</p>
                  <p>Barbeiro: {appointment.barbeiros?.nome || 'N/A'}</p>
                  <p>Cliente: {appointment.clientes?.nome || 'N/A'}</p>
                  <p>Status: {appointment.ocupado ? 'Ocupado' : 'Livre'}</p>
                </div>
                <button
                  onClick={() => handleToggleSlot(appointment.id, appointment.ocupado)}
                  className={`button ${appointment.ocupado ? 'button-danger' : 'button-success'} mt-2 sm:mt-0`}
                >
                  {appointment.ocupado ? <FaTimesCircle className="mr-2" /> : <FaCheckCircle className="mr-2" />} {appointment.ocupado ? 'Liberar' : 'Ocupar'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {adminView === 'services' && (
        <div className="w-full max-w-xl">
          <h3 className="text-xl font-bold text-primary mb-4">Gerenciar Serviços</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {services.map((service) => (
              <div key={service.id} className="bg-card p-4 rounded-lg shadow-md flex justify-between items-center">
                <div>
                  <p className="text-lg font-semibold">{service.name}</p>
                  <p className="text-text-muted">R$ {service.price.toFixed(2)}</p>
                </div>
                <button className="button button-outline-sm">
                  <FaCog />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  switch (view) {
    case 'barbers':
      return renderBarbers();
    case 'services':
      return renderServices();
    case 'schedule':
      return renderSchedule();
    case 'adminLogin':
      return renderAdminLogin();
    case 'adminDashboard':
      return renderAdminDashboard();
    default:
      return renderHome();
  }
};

export default App;

