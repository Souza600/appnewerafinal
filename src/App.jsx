import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import './App.css';
import { FaCut, FaUserCircle, FaSignInAlt, FaSignOutAlt, FaCog, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { MdOutlineContentCut } from "react-icons/md";
import { staticServices } from './services.js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
);

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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: barbersData } = await supabase.from('barbeiros').select('*');
        setBarbers(barbersData || []);
        setServices(staticServices);
      } catch (err) {
        setError('Erro ao carregar barbeiros.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();

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
    '14:00', '14:40', '15:20', '16:00', '16:40', '17:20',
    '18:00', '18:40', '19:20'
  ];

  const fetchAvailableTimes = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('horarios')
        .select('hora')
        .eq('barbeiro_id', selectedBarber.id)
        .eq('data', selectedDate)
        .eq('ocupado', true);

      const occupied = data?.map((h) => h.hora.substring(0, 5)) || [];
      const available = generateTimeSlots().filter((t) => !occupied.includes(t));
      setAvailableTimes(available);
    } catch (err) {
      setAvailableTimes(generateTimeSlots());
    } finally {
      setLoading(false);
    }
  };

  const handleServiceSelect = (service) => {
    setSelectedServices((prev) =>
      prev.some((s) => s.id === service.id)
        ? prev.filter((s) => s.id !== service.id)
        : [...prev, service]
    );
  };

  const handleConfirmAppointment = async () => {
    setLoading(true);
    try {
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

      const { data: existingSlot } = await supabase
        .from('horarios')
        .select('id')
        .eq('barbeiro_id', selectedBarber.id)
        .eq('data', selectedDate)
        .eq('hora', `${selectedTime}:00`)
        .maybeSingle();

      if (existingSlot) {
        await supabase.from('horarios').update({
          ocupado: true, cliente_id: client_id
        }).eq('id', existingSlot.id);
      } else {
        await supabase.from('horarios').insert([{
          barbeiro_id: selectedBarber.id,
          data: selectedDate,
          hora: `${selectedTime}:00`,
          ocupado: true,
          cliente_id: client_id
        }]);
      }

      const { data: barberData } = await supabase
        .from('barbeiros')
        .select('telefone')
        .eq('id', selectedBarber.id)
        .single();

      const telefone = barberData.telefone.replace(/\D/g, '');
      const servicosTexto = selectedServices.map(s => s.name).join(', ');
      const dataFormatada = new Date(selectedDate).toLocaleDateString('pt-BR');
      const mensagem = `Olá, acabei de confirmar meu agendamento para o dia ${dataFormatada} às ${selectedTime} com os serviços ${servicosTexto}.`;
      const url = `https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}`;

      alert('Redirecionando para o WhatsApp...');
      window.location.href = url;
      resetForm();
      setView('home');
    } catch (err) {
      setError('Erro ao confirmar agendamento.');
    } finally {
      setLoading(false);
    }
  };

  const renderHome = () => (
    <div className="min-h-screen flex flex-col items-center justify-center text-center relative"
      style={{
        backgroundImage: `url(${backgroundImages[currentBg]})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
      <div className="absolute inset-0 bg-black opacity-75"></div>
      <div className="relative z-10 flex flex-col items-center p-4">
        <img src="/newera_logo_refined.png" alt="Logo" className="w-24 mb-4 animate-float" />
        <h1 className="text-3xl font-bold text-primary mb-2">NewEra BarberSHOP</h1>
        <button onClick={() => setView('barbers')} className="button button-primary mb-4 w-full max-w-xs">
          <FaCut className="mr-2" /> Agendar Horário
        </button>
        <button onClick={() => setView('adminLogin')} className="button button-outline w-full max-w-xs">
          <FaSignInAlt className="mr-2" /> Área Administrativa
        </button>
      </div>
    </div>
  );

  const renderBarbers = () => (
    <div className="min-h-screen bg-background text-text p-4 flex flex-col items-center">
      <h2 className="text-2xl font-bold text-primary mb-6">Escolha seu Barbeiro</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
        {barbers.map((b) => (
          <div key={b.id} className="barber-card p-4" onClick={() => { setSelectedBarber(b); setView('services'); }}>
            <FaUserCircle className="text-primary text-5xl mb-2" />
            <h3>{b.nome}</h3>
          </div>
        ))}
      </div>
      <button onClick={() => setView('home')} className="button button-outline mt-6">Voltar</button>
    </div>
  );

  const renderServices = () => (
    <div className="min-h-screen bg-background text-text p-4 flex flex-col items-center">
      <h2 className="text-2xl font-bold text-primary mb-6">Selecione os Serviços</h2>
      <div className="grid grid-cols-2 gap-3 w-full max-w-xl mb-6">
        {services.map((service) => (
          <div key={service.id} onClick={() => handleServiceSelect(service)}
            className={`service-card ${selectedServices.some(s => s.id === service.id) ? 'selected' : ''}`}>
            <MdOutlineContentCut className="text-primary text-3xl mb-2" />
            <h3>{service.name}</h3>
            <p>R$ {service.price.toFixed(2)}</p>
          </div>
        ))}
      </div>
      <button onClick={() => setView('schedule')} className="button button-primary">Continuar</button>
      <button onClick={() => setView('barbers')} className="button button-outline mt-4">Voltar</button>
    </div>
  );

  const renderSchedule = () => (
    <div className="min-h-screen bg-background text-text p-4 flex flex-col items-center">
      <h2 className="text-2xl font-bold text-primary mb-6">Escolha Data e Horário</h2>
      <input type="date" className="input w-full max-w-xs mb-4" value={selectedDate}
        onChange={(e) => setSelectedDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
      <div className="grid grid-cols-3 gap-3 w-full max-w-md mb-6">
        {availableTimes.map((time) => (
          <button key={time} onClick={() => setSelectedTime(time)}
            className={`button ${selectedTime === time ? 'button-primary' : 'button-outline'}`}>{time}</button>
        ))}
      </div>
      <input type="text" className="input w-full max-w-xs mb-4" placeholder="Seu nome completo"
        value={clientName} onChange={(e) => setClientName(e.target.value)} />
      <button onClick={handleConfirmAppointment} className="button button-primary"
        disabled={!selectedDate || !selectedTime || !clientName || loading}>Confirmar</button>
      <button onClick={() => setView('services')} className="button button-outline mt-4">Voltar</button>
    </div>
  );

  // Simplificando — login admin etc. podem ser mantidos como estão

  switch (view) {
    case 'barbers': return renderBarbers();
    case 'services': return renderServices();
    case 'schedule': return renderSchedule();
    default: return renderHome();
  }
};

export default App;
