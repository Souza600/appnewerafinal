import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { staticServices } from "./services.js";
import "./App.css";
import {
  FaCut, FaUserCircle, FaSignInAlt, FaSignOutAlt, FaCheckCircle, FaEdit,
} from "react-icons/fa";
import { MdOutlineContentCut } from "react-icons/md";
import { Toaster, toast } from "sonner";

const ADMIN_USER = "Admin12345";
const ADMIN_PASS = "12345";

const BG_IMAGES = [
  "/l4dq00mz.jpg",
  "/lt7h3jnf.jpg",
  "/967bq6ij.jpg",
];

export default function App() {
  const [view, setView] = useState("home");
  const [barbers, setBarbers] = useState([]);
  const [services, setServices] = useState(staticServices);
  const [selectedBarber, setSelectedBarber] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [clientName, setClientName] = useState("");
  const [availableTimes, setAvailableTimes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminAppointments, setAdminAppointments] = useState([]);
  const [adminFilterBarberId, setAdminFilterBarberId] = useState("");
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [editingPriceValue, setEditingPriceValue] = useState("");
  const [currentBg, setCurrentBg] = useState(0);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const { data: bbq } = await supabase.from("barbeiros").select("*").order("id");
      setBarbers(bbq || []);
      setServices(staticServices);
      setLoading(false);
    };
    init();
    const i = setInterval(() => setCurrentBg((v) => (v + 1) % BG_IMAGES.length), 9000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (selectedBarber && selectedDate) fetchAvailableTimes();
  }, [selectedBarber, selectedDate]);

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminUsername === ADMIN_USER && adminPassword === ADMIN_PASS) {
      setAdminLoggedIn(true);
      setView("adminDashboard");
      fetchAdminAppointments();
      toast.success("Login realizado");
    } else {
      toast.error("Usuário ou senha inválidos");
    }
  };

  const handleAdminLogout = () => {
    setAdminLoggedIn(false);
    setAdminUsername("");
    setAdminPassword("");
    setView("home");
  };

  const fetchAdminAppointments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("horarios")
      .select("id, barbeiro_id, data, hora, ocupado, cliente_id, clientes ( nome ), barbeiros ( nome, telefone )")
      .order("data", { ascending: true })
      .order("hora", { ascending: true });
    setAdminAppointments(data || []);
    setLoading(false);
  };

  const handleReleaseSlot = async (horarioId) => {
    await supabase.from("horarios").update({ ocupado: false, cliente_id: null }).eq("id", horarioId);
    toast.success("Horário liberado");
    fetchAdminAppointments();
  };

  const handleStartEditPrice = (service) => {
    setEditingServiceId(service.id);
    setEditingPriceValue((service.preco ?? service.price ?? 0).toString());
  };

  const handleCancelEditPrice = () => {
    setEditingServiceId(null);
    setEditingPriceValue("");
  };

  const handleSaveServicePrice = async (serviceId) => {
    const newPrice = parseFloat(editingPriceValue);
    if (isNaN(newPrice) || newPrice < 0) {
      toast.error("Preço inválido.");
      return;
    }
    await supabase.from("servicos").update({ preco: newPrice }).eq("id", serviceId);
    setServices(services.map((s) => s.id === serviceId ? { ...s, preco: newPrice } : s));
    handleCancelEditPrice();
    toast.success("Preço atualizado");
  };

  const filteredAdminAppointments = adminAppointments.filter(
    (a) => (adminFilterBarberId ? a.barbeiro_id === Number(adminFilterBarberId) : true)
  );

  const generateTimeSlots = () => {
    const slots = [];
    for (let h = 8; h <= 11; h++) for (let m of [0, 40]) slots.push([h, m]);
    slots.push([12, 0]);
    for (let h = 14; h <= 19; h++) for (let m of [0, 40]) slots.push([h, m]);
    slots.push([20, 0]);
    return slots.map(([h, m]) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  };

  const fetchAvailableTimes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("horarios")
      .select("hora")
      .eq("barbeiro_id", selectedBarber.id)
      .eq("data", selectedDate)
      .eq("ocupado", true);
    const occupied = data ? data.map((r) => r.hora.substring(0, 5)) : [];
    setAvailableTimes(generateTimeSlots().map((t) => ({
      time: t,
      ocupado: occupied.includes(t)
    })));
    setLoading(false);
  };

  const handleServiceSelect = (service) => {
    setSelectedServices((prev) =>
      prev.some((s) => s.id === service.id) ?
        prev.filter((s) => s.id !== service.id)
        : [...prev, service]
    );
  };

  const calculateTotal = () =>
    selectedServices.reduce((sum, s) => sum + Number(s.preco ?? s.price ?? 0), 0);

  const handleConfirmAppointment = async () => {
    if (!selectedBarber) return toast.error("Selecione um barbeiro.");
    if (!selectedDate) return toast.error("Escolha uma data.");
    if (!selectedTime) return toast.error("Escolha um horário.");
    if (!clientName || clientName.trim().length < 2)
      return toast.error("Informe seu nome completo.");
    setLoading(true);

    try {
      const horaParaRpc = `${selectedTime}:00`;
      const { error } = await supabase.rpc("book_slot", {
        _barbeiro_id: selectedBarber.id,
        _data: selectedDate,
        _hora: horaParaRpc,
        _cliente_nome: clientName.trim(),
      });
      if (error) throw error;

      const numero = (selectedBarber.telefone || "").replace(/\D/g, "");
      const numeroMsg = numero.startsWith("55") ? numero : `55${numero}`;
      const servicos = selectedServices.map((s) => s.nome).join(", ");
      const valorFinal = calculateTotal().toFixed(2);
      const dataFormatada = new Date(selectedDate + "T00:00:00").toLocaleDateString("pt-BR");

      const msg = `Olá! 👋 Tudo bem?\n\nEstou confirmando o agendamento para o dia *${dataFormatada}* às *${selectedTime}* com o barbeiro *${selectedBarber.nome}*.\n\n💈 *Serviços solicitados:*\n${servicos}\n\n💰 *Valor total:* R$ ${valorFinal}\n\nAguardo a confirmação! 😊`;

      const url = `https://wa.me/${numeroMsg}?text=${encodeURIComponent(msg)}`;
      toast.success("Agendamento confirmado! Redirecionando para o WhatsApp...");
      setTimeout(() => {
        window.location.href = url;
      }, 1300);
    } catch (err) {
      toast.error("Erro ao agendar.");
    }
    setLoading(false);
  };

  // ✅ HOME COM LOGO CORRIGIDA
    const renderHome = () => (
    <div
      className="relative min-h-screen flex flex-col justify-center items-center text-center overflow-hidden"
      style={{
        backgroundImage: `url(${BG_IMAGES[currentBg]})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* ✅ Overlay escuro (fundo) */}
      <div className="absolute inset-0 bg-black/80"></div>
      
      {/* ✅ LOGO COMO BACKGROUND COM OPACIDADE (acima do overlay) */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: "url(/newera_logo_refined.jpg)",
          backgroundSize: "50%", // Ajuste o tamanho (50%, 60%, 70%, etc)
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: 0.12, // Opacidade bem sutil
          zIndex: 1,
        }}
      ></div>

      {/* ✅ Conteúdo principal (acima de tudo) */}
      <div className="relative z-10 flex flex-col items-center p-6 max-w-md w-full">
        {/* ✅ TÍTULO COM FONTE ESTILOSA E BRANCA */}
        <h1 
          className="text-5xl sm:text-6xl md:text-7xl font-bold text-white mb-4 tracking-wider drop-shadow-[0_0_25px_rgba(255,255,255,0.3)]"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          NEWERA
        </h1>
        <h2 
          className="text-3xl sm:text-4xl font-bold text-amber-400 mb-6 tracking-widest drop-shadow-[0_0_20px_rgba(251,191,36,0.6)]"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          BARBERSHOP
        </h2>
        
        <p className="text-base sm:text-lg text-gray-300 mb-8 font-light">
          Tradição renovada em cada corte ✂️
        </p>
        
        <button
          onClick={() => setView("services")}
          className="button button-primary mb-4 w-full text-lg py-4 shadow-2xl hover:shadow-amber-500/50 hover:scale-105 transition-all"
        >
          <FaCut className="mr-2" /> Agendar Horário
        </button>
        
        <button
          onClick={() => setView("adminLogin")}
          className="button button-outline w-full text-sm py-3 hover:scale-105 transition-all"
        >
          <FaSignInAlt className="mr-2" /> Área Administrativa
        </button>
      </div>
    </div>
  );

  // ✅ SERVIÇOS MELHORADO PARA MOBILE
  const renderServices = () => (
    <div className="min-h-screen p-4 sm:p-6 flex flex-col items-center bg-gradient-to-b from-zinc-900 via-zinc-800 to-zinc-900 text-white">
      <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-center">Escolha os Serviços</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 w-full max-w-4xl mb-6">
        {services.map((service) => {
          const selected = selectedServices.some((s) => s.id === service.id);
          const price = service.preco ?? service.price ?? 0;
          return (
            <div
              key={service.id}
              onClick={() => handleServiceSelect(service)}
              className={`relative p-4 sm:p-6 rounded-2xl cursor-pointer transition-all duration-200 border-2 ${
                selected 
                  ? "bg-amber-500 border-amber-600 scale-105 shadow-xl" 
                  : "bg-zinc-800 border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600 hover:scale-105"
              }`}
            >
              <MdOutlineContentCut className="text-3xl sm:text-4xl mb-2 sm:mb-3 opacity-90" />
              <h3 className="text-sm sm:text-lg font-semibold mb-1">{service.nome}</h3>
              <p className="text-xs sm:text-sm opacity-80">R$ {Number(price).toFixed(2)}</p>
              {selected && <FaCheckCircle className="absolute top-2 right-2 sm:top-3 sm:right-3 text-green-300 text-xl" />}
            </div>
          );
        })}
      </div>
      <div className="w-full max-w-md flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 p-4 bg-zinc-800 rounded-xl border border-zinc-700">
        <p className="text-lg sm:text-xl font-semibold">
          Total: <span className="text-amber-400">R$ {calculateTotal().toFixed(2)}</span>
        </p>
        <button
          onClick={() => setView("barbers")}
          disabled={selectedServices.length === 0}
          className={`w-full sm:w-auto px-6 py-3 rounded-xl text-white font-semibold transition-all ${
            selectedServices.length > 0 
              ? "bg-amber-500 hover:bg-amber-600 shadow-lg" 
              : "bg-gray-600 cursor-not-allowed"
          }`}
        >
          Continuar →
        </button>
      </div>
      <button onClick={() => setView("home")} className="button button-outline w-full max-w-md">
        ← Voltar
      </button>
    </div>
  );

  // ✅ BARBEIROS SEM TELEFONE E COM BORDA
  const renderBarbers = () => (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-800 to-zinc-900 text-white p-4 sm:p-6 flex flex-col items-center">
      <h2 className="text-2xl sm:text-3xl font-bold text-primary mb-6">Escolha seu Barbeiro</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl mb-6">
        {barbers.map((barber) => (
          <div
            key={barber.id}
            className="p-5 rounded-2xl cursor-pointer hover:scale-105 transition-all duration-200 border-2 bg-zinc-800 border-zinc-700 hover:bg-zinc-700 hover:border-amber-500 shadow-lg"
            onClick={() => {
              setSelectedBarber(barber);
              setView("schedule");
            }}
          >
            <div className="flex items-center gap-4">
              <FaUserCircle className="text-amber-500 text-5xl flex-shrink-0" />
              <div>
                <h3 className="text-xl font-bold">{barber.nome}</h3>
                {/* ✅ Telefone removido */}
              </div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => setView("services")} className="button button-outline w-full max-w-md">
        ← Voltar
      </button>
    </div>
  );

  // ✅ HORÁRIOS MELHORADO PARA MOBILE
  const renderSchedule = () => (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-800 to-zinc-900 text-white p-4 sm:p-6 flex flex-col items-center">
      <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-center">Agende seu Horário</h2>
      
      {/* Resumo do barbeiro selecionado */}
      {selectedBarber && (
        <div className="w-full max-w-md mb-6 p-4 bg-zinc-800 rounded-xl border border-zinc-700 flex items-center gap-3">
          <FaUserCircle className="text-amber-500 text-4xl" />
          <div>
            <p className="text-sm opacity-70">Barbeiro selecionado:</p>
            <p className="text-lg font-bold">{selectedBarber.nome}</p>
          </div>
        </div>
      )}

      <div className="w-full max-w-md mb-4">
        <label className="block text-sm font-semibold mb-2 text-amber-400">📅 Escolha a Data:</label>
        <input
          type="date"
          className="input w-full text-base"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          min={new Date().toISOString().split("T")[0]}
        />
      </div>
      
      {selectedDate && (
        <div className="w-full max-w-md mb-6">
          <label className="block text-sm font-semibold mb-3 text-amber-400">🕐 Horários Disponíveis:</label>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {availableTimes.map(({ time, ocupado }) => (
              <button
                key={time}
                className={`py-3 px-2 rounded-lg font-semibold transition-all duration-200 text-sm sm:text-base ${
                  selectedTime === time
                    ? "bg-amber-500 text-black shadow-lg scale-105"
                    : ocupado
                    ? "bg-red-600 text-white cursor-not-allowed opacity-50"
                    : "bg-zinc-800 border-2 border-zinc-700 hover:border-amber-500 hover:bg-zinc-700"
                }`}
                disabled={ocupado}
                onClick={() => setSelectedTime(time)}
              >
                {time}
              </button>
            ))}
          </div>
        </div>
      )}
      
      <div className="w-full max-w-md mb-6">
        <label className="block text-sm font-semibold mb-2 text-amber-400">👤 Seu Nome Completo:</label>
        <input
          type="text"
          className="input w-full text-base"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Digite seu nome completo"
        />
      </div>
      
      <div className="w-full max-w-md flex flex-col sm:flex-row justify-between items-center gap-3 mt-4">
        <button onClick={() => setView("barbers")} className="button button-outline w-full sm:w-auto">
          ← Voltar
        </button>
        <button
          onClick={handleConfirmAppointment}
          className="button button-primary w-full sm:w-auto shadow-xl"
          disabled={!selectedDate || !selectedTime || !clientName || loading}
        >
          {loading ? "Agendando..." : "Confirmar Agendamento ✓"}
        </button>
      </div>
    </div>
  );

  // ✅ ADMIN LOGIN
  const renderAdminLogin = () => (
    <div className="min-h-screen p-6 flex items-center justify-center bg-gradient-to-b from-zinc-900 via-zinc-800 to-zinc-900">
      <div className="w-full max-w-md bg-zinc-900 p-6 rounded-xl shadow-lg border border-zinc-700">
        <h2 className="text-2xl font-bold mb-4 text-white">Login Administrativo</h2>
        <form onSubmit={handleAdminLogin} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Usuário"
            className="input"
            value={adminUsername}
            onChange={(e) => setAdminUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="Senha"
            className="input"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
          />
          <div className="flex gap-3">
            <button type="submit" className="button button-primary">Entrar</button>
            <button type="button" onClick={() => setView("home")} className="button button-outline">Voltar</button>
          </div>
        </form>
      </div>
    </div>
  );

  // ✅ ADMIN DASHBOARD
  const renderAdminDashboard = () => (
    <div className="min-h-screen p-4 sm:p-6 bg-gradient-to-b from-zinc-900 via-zinc-800 to-zinc-900 text-white">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
        <h2 className="text-2xl font-bold">Painel Administrativo</h2>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <select
            className="input flex-1 sm:flex-none"
            value={adminFilterBarberId}
            onChange={(e) => setAdminFilterBarberId(e.target.value)}
          >
            <option value="">Todos os Barbeiros</option>
            {barbers.map((b) => (<option key={b.id} value={b.id}>{b.nome}</option>))}
          </select>
          <button onClick={fetchAdminAppointments} className="button button-outline text-sm px-4">Atualizar</button>
          <button onClick={handleAdminLogout} className="button button-outline text-sm px-4"><FaSignOutAlt /></button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agendamentos */}
        <div className="bg-zinc-900 p-4 rounded-xl shadow border border-zinc-700">
          <h3 className="text-lg font-semibold mb-3">Agendamentos</h3>
          <div className="space-y-3 max-h-[60vh] overflow-auto">
            {filteredAdminAppointments.map((item) => (
              <div key={item.id} className="p-3 bg-zinc-800 rounded border border-zinc-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="text-sm opacity-80">{item.barbeiros?.nome ?? "—"}</div>
                  <div className="font-medium">{item.clientes?.nome ?? "Cliente sem nome"}</div>
                  <div className="text-sm opacity-70">{item.data} • {item.hora}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-sm">
                    {item.ocupado ? (
                      <span className="text-amber-300 font-semibold">● Ocupado</span>
                    ) : (
                      <span className="text-green-300 font-semibold">● Livre</span>
                    )}
                  </div>
                  {item.ocupado && (
                    <button 
                      onClick={() => handleReleaseSlot(item.id)} 
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm font-semibold transition-all"
                    >
                      Liberar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Serviços */}
        <div className="bg-zinc-900 p-4 rounded-xl shadow border border-zinc-700">
          <h3 className="text-lg font-semibold mb-3">Serviços (Editar Preços)</h3>
          <div className="space-y-3">
            {services.map((s) => (
              <div key={s.id} className="p-3 bg-zinc-800 rounded border border-zinc-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="font-medium text-base">{s.nome}</div>
                  <div className="text-sm opacity-70">R$ {(s.preco ?? s.price ?? 0).toFixed(2)}</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {editingServiceId === s.id ? (
                    <>
                      <input
                        type="number"
                        className="input w-24"
                        value={editingPriceValue}
                        onChange={(e) => setEditingPriceValue(e.target.value)}
                        min="0"
                        step="0.01"
                      />
                      <button 
                        onClick={() => handleSaveServicePrice(s.id)} 
                        className="px-3 py-1 bg-amber-500 hover:bg-amber-600 rounded text-sm font-semibold"
                      >
                        Salvar
                      </button>
                      <button 
                        onClick={handleCancelEditPrice} 
                        className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => handleStartEditPrice(s)} 
                      className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-sm"
                    >
                      <FaEdit />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ✅ RENDER PRINCIPAL
  return (
    <>
      <Toaster position="top-center" />
      {view === "barbers" && renderBarbers()}
      {view === "services" && renderServices()}
      {view === "schedule" && renderSchedule()}
      {view === "adminLogin" && renderAdminLogin()}
      {view === "adminDashboard" && adminLoggedIn && renderAdminDashboard()}
      {view === "home" && renderHome()}
    </>
  );
}
