// src/App.jsx
import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import "./App.css";
import {
  FaCut,
  FaUserCircle,
  FaSignInAlt,
  FaSignOutAlt,
  FaCheckCircle,
  FaTimesCircle,
  FaEdit,
} from "react-icons/fa";
import { MdOutlineContentCut } from "react-icons/md";
import { Toaster, toast } from "sonner";
import { staticServices } from "./services.js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
  // -------------------------
  // Estados principais
  // -------------------------
  const [view, setView] = useState("home"); // home, barbers, services, schedule, adminLogin, adminDashboard
  const [barbers, setBarbers] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedBarber, setSelectedBarber] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [clientName, setClientName] = useState("");
  const [availableTimes, setAvailableTimes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // admin
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminAppointments, setAdminAppointments] = useState([]);
  const [adminFilterBarberId, setAdminFilterBarberId] = useState("");
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [editingPriceValue, setEditingPriceValue] = useState("");

  const ADMIN_USERNAME = "ADM123";
  const ADMIN_PASSWORD = "12345";

  const backgroundImages = [
    "/l4dq00mz.jpeg",
    "/lt7h3jnf.jpeg",
    "/967bq6ij.jpeg",
  ];
  const [currentBg, setCurrentBg] = useState(0);

  // -------------------------
  // Inicialização
  // -------------------------
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const { data: barbersData, error: barbersErr } = await supabase
          .from("barbeiros")
          .select("*")
          .order("id", { ascending: true });

        if (barbersErr) throw barbersErr;
        setBarbers(barbersData || []);
        setServices(staticServices || []);

        // carrega serviços reais do banco (se houver)
        const { data: servDB, error: servErr } = await supabase
          .from("servicos")
          .select("*")
          .order("id", { ascending: true });
        if (!servErr && Array.isArray(servDB) && servDB.length > 0) {
          setServices(servDB);
        }
      } catch (err) {
        console.error("Init error:", err);
        setError("Erro ao carregar dados iniciais.");
      } finally {
        setLoading(false);
      }
    };
    init();

    const interval = setInterval(
      () => setCurrentBg((prev) => (prev + 1) % backgroundImages.length),
      10000
    );
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedBarber && selectedDate) fetchAvailableTimes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBarber, selectedDate]);

  // -------------------------
  // Horários
  // -------------------------
  const generateTimeSlots = () => [
    "08:00",
    "08:40",
    "09:20",
    "10:00",
    "10:40",
    "11:20",
    "14:00",
    "14:40",
    "15:20",
    "16:00",
    "16:40",
    "17:20",
    "18:00",
    "18:40",
    "19:20",
  ];

  const fetchAvailableTimes = async () => {
    if (!selectedBarber || !selectedDate) {
      setAvailableTimes(generateTimeSlots());
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("horarios")
        .select("hora")
        .eq("barbeiro_id", selectedBarber.id)
        .eq("data", selectedDate)
        .eq("ocupado", true);

      if (error) throw error;
      const occupiedTimes = data ? data.map((r) => r.hora.substring(0, 5)) : [];
      const available = generateTimeSlots().filter(
        (t) => !occupiedTimes.includes(t)
      );
      setAvailableTimes(available);
    } catch (err) {
      console.error("fetchAvailableTimes error:", err);
      setAvailableTimes(generateTimeSlots());
    } finally {
      setLoading(false);
    }
  };

  // -------------------------
  // Serviços e seleção
  // -------------------------
  const handleServiceSelect = (service) => {
    setSelectedServices((prev) =>
      prev.some((s) => s.id === service.id)
        ? prev.filter((s) => s.id !== service.id)
        : [...prev, service]
    );
  };

  const calculateTotal = () =>
    selectedServices.reduce((sum, s) => sum + Number(s.preco ?? s.price ?? 0), 0);

  // -------------------------
  // Agendamento: chama RPC book_slot e redireciona WhatsApp
  // -------------------------
  const handleConfirmAppointment = async () => {
    if (!selectedBarber) return toast.error("Selecione um barbeiro.");
    if (!selectedDate) return toast.error("Escolha uma data.");
    if (!selectedTime) return toast.error("Escolha um horário.");
    if (!clientName || clientName.trim().length < 2)
      return toast.error("Informe seu nome completo.");

    setLoading(true);
    try {
      // normaliza hora para RPC (HH:MM:SS)
      const horaParaRpc =
        selectedTime.includes(":") && selectedTime.length === 5
          ? `${selectedTime}:00`
          : selectedTime;

      const { data: result, error: rpcError } = await supabase.rpc(
        "book_slot",
        {
          _barbeiro_id: selectedBarber.id,
          _data: selectedDate,
          _hora: horaParaRpc,
          _cliente_nome: clientName.trim(),
        }
      );

      if (rpcError) {
        console.error("RPC error:", rpcError);
        toast.error("Erro ao confirmar agendamento.");
        return;
      }

      const rpcResult = Array.isArray(result) ? result[0] : result;
      if (!rpcResult || !rpcResult.success) {
        toast.error(rpcResult?.message || "Falha ao confirmar agendamento.");
        return;
      }

      // pega telefone do barbeiro
      const { data: barbeiroData, error: barberErr } = await supabase
        .from("barbeiros")
        .select("telefone, nome")
        .eq("id", selectedBarber.id)
        .single();

      if (barberErr) {
        toast.warning("Agendamento confirmado, mas não foi possível abrir WhatsApp.");
        return;
      }

      const rawTel = (barbeiroData?.telefone || "").toString().trim();
      const tel = rawTel.replace(/\D/g, "");
      if (!tel) {
        toast.warning("Telefone do barbeiro não cadastrado.");
        return;
      }

      const numero = tel.startsWith("55") ? tel : `55${tel}`;
      const msg = `Olá, acabei de confirmar meu agendamento para o dia ${selectedDate} às ${selectedTime}.`;
      const url = `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`;

      toast.success("Agendamento confirmado! Redirecionando...");
      // pequeno delay pra exibir toast
      setTimeout(() => {
        window.location.href = url;
      }, 1300);
    } catch (err) {
      console.error("Handle confirm appointment error:", err);
      toast.error("Erro inesperado ao confirmar agendamento.");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------
  // ADMIN: login, listagem, liberar horário, editar preço
  // -------------------------
  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminUsername === ADMIN_USERNAME && adminPassword === ADMIN_PASSWORD) {
      setAdminLoggedIn(true);
      setView("adminDashboard");
      toast.success("Login do admin realizado.");
      fetchAdminAppointments(); // carregar
    } else {
      toast.error("Usuário ou senha inválidos.");
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
    try {
      // buscar horários (join com barbeiros e clientes)
      const { data, error } = await supabase
        .from("horarios")
        .select("id, barbeiro_id, data, hora, ocupado, cliente_id, clientes(nome), barbeiros(nome)")
        .order("data", { ascending: true })
        .order("hora", { ascending: true });

      if (error) throw error;
      setAdminAppointments(data || []);
    } catch (err) {
      console.error("fetchAdminAppointments error:", err);
      toast.error("Erro ao carregar agendamentos do admin.");
    } finally {
      setLoading(false);
    }
  };

  const filteredAdminAppointments = adminAppointments.filter((a) =>
    adminFilterBarberId ? a.barbeiro_id === Number(adminFilterBarberId) : true
  );

  const handleReleaseSlot = async (horarioId) => {
    // atualiza ocupado para false (mantendo registro)
    try {
      const { error } = await supabase
        .from("horarios")
        .update({ ocupado: false })
        .eq("id", horarioId);

      if (error) throw error;
      toast.success("Horário liberado.");
      // atualizar listagem
      fetchAdminAppointments();
    } catch (err) {
      console.error("handleReleaseSlot error:", err);
      toast.error("Erro ao liberar horário.");
    }
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
    try {
      const { error } = await supabase
        .from("servicos")
        .update({ preco: newPrice })
        .eq("id", serviceId);

      if (error) throw error;
      toast.success("Preço atualizado.");
      // atualizar lista local de serviços
      const updated = services.map((s) =>
        s.id === serviceId ? { ...s, preco: newPrice } : s
      );
      setServices(updated);
      handleCancelEditPrice();
    } catch (err) {
      console.error("handleSaveServicePrice error:", err);
      toast.error("Erro ao atualizar preço.");
    }
  };

  // -------------------------
  // Renderers - telas
  // -------------------------
  const renderHome = () => (
    <div
      className="min-h-screen flex flex-col items-center justify-center text-center relative overflow-hidden"
      style={{
        backgroundImage: `url(${backgroundImages[currentBg]})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-black opacity-75"></div>
      <div className="relative z-10 flex flex-col items-center p-6 max-w-md w-full">
        <img
          src="/newera_logo_refined.png"
          alt="Logo"
          className="w-28 mb-4 animate-float mx-auto"
        />
        <h1 className="text-3xl font-bold text-primary mb-2">NewEra BarberSHOP</h1>
        <p className="text-lg text-white mb-6">Tradição renovada em cada corte</p>

        <button
          onClick={() => setView("barbers")}
          className="button button-primary mb-3 w-full"
        >
          <FaCut className="mr-2" /> Agendar Horário
        </button>

        <button
          onClick={() => setView("adminLogin")}
          className="button button-outline w-full"
        >
          <FaSignInAlt className="mr-2" /> Área Administrativa
        </button>
      </div>
    </div>
  );

  const renderBarbers = () => (
    <div className="min-h-screen bg-background text-text p-6 flex flex-col items-center">
      <h2 className="text-2xl font-bold text-primary mb-6">Escolha seu Barbeiro</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
        {barbers.map((barber) => (
          <div
            key={barber.id}
            className="barber-card p-4 rounded-xl cursor-pointer hover:scale-105 transition"
            onClick={() => {
              setSelectedBarber(barber);
              setView("services");
            }}
          >
            <div className="flex items-center gap-3">
              <FaUserCircle className="text-primary text-4xl" />
              <div>
                <h3 className="text-lg font-semibold">{barber.nome}</h3>
                {barber.telefone && <p className="text-sm opacity-80">{barber.telefone}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => setView("home")} className="button button-outline mt-6">
        Voltar
      </button>
    </div>
  );

  const renderServices = () => (
    <div className="min-h-screen p-6 flex flex-col items-center bg-gradient-to-b from-zinc-900 via-zinc-800 to-zinc-900 text-white">
      <h2 className="text-3xl font-bold mb-6">Escolha os Serviços</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-4xl mb-8">
        {services.map((service) => {
          const selected = selectedServices.some((s) => s.id === service.id);
          const price = service.preco ?? service.price ?? 0;
          return (
            <div
              key={service.id}
              onClick={() => handleServiceSelect(service)}
              className={`p-6 rounded-2xl cursor-pointer transition transform ${
                selected ? "bg-amber-500 scale-105" : "bg-zinc-800 hover:bg-zinc-700"
              }`}
            >
              <MdOutlineContentCut className="text-4xl mb-3 opacity-90" />
              <h3 className="text-lg font-semibold mb-1">{service.nome}</h3>
              <p className="text-sm opacity-80">R$ {Number(price).toFixed(2)}</p>
              {selected && <FaCheckCircle className="absolute top-3 right-3 text-green-300" />}
            </div>
          );
        })}
      </div>

      <div className="w-full max-w-md flex justify-between items-center mb-6 p-3 bg-zinc-800 rounded-xl">
        <p className="text-lg font-semibold">
          Total: <span className="text-amber-400">R$ {calculateTotal().toFixed(2)}</span>
        </p>
        <button
          onClick={() => setView("schedule")}
          disabled={selectedServices.length === 0}
          className={`px-6 py-3 rounded-xl text-white font-semibold ${
            selectedServices.length > 0 ? "bg-amber-500" : "bg-gray-600"
          }`}
        >
          Continuar
        </button>
      </div>

      <button onClick={() => setView("barbers")} className="button button-outline">
        Voltar
      </button>
    </div>
  );

  const renderSchedule = () => (
    <div className="min-h-screen bg-background text-text p-6 flex flex-col items-center">
      <h2 className="text-2xl font-bold mb-6">Agende seu Horário</h2>

      <div className="w-full max-w-md mb-4">
        <label className="label mb-2">Data:</label>
        <input
          type="date"
          className="input w-full"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          min={new Date().toISOString().split("T")[0]}
        />
      </div>

      {selectedDate && (
        <div className="w-full max-w-md mb-6">
          <label className="label mb-2">Horários Disponíveis:</label>
          {availableTimes.length === 0 && !loading && (
            <p className="text-text-muted">Nenhum horário disponível para esta data.</p>
          )}
          <div className="grid grid-cols-3 gap-3">
            {availableTimes.map((time) => (
              <button
                key={time}
                className={`button ${selectedTime === time ? "button-primary" : "button-outline"}`}
                onClick={() => setSelectedTime(time)}
              >
                {time}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="w-full max-w-md mb-4">
        <label className="label mb-2">Seu Nome Completo:</label>
        <input
          type="text"
          className="input w-full"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Nome e Sobrenome"
        />
      </div>

      <div className="w-full max-w-md flex justify-between items-center mt-4">
        <button onClick={() => setView("services")} className="button button-outline">
          Voltar
        </button>
        <button
          onClick={handleConfirmAppointment}
          className="button button-primary"
          disabled={!selectedDate || !selectedTime || !clientName || loading}
        >
          {loading ? "Agendando..." : "Confirmar Agendamento"}
        </button>
      </div>
    </div>
  );

  // --------- ADMIN UI ----------
  const renderAdminLogin = () => (
    <div className="min-h-screen p-6 flex items-center justify-center bg-background">
      <div className="w-full max-w-md bg-zinc-900 p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold mb-4">Login Administrativo</h2>
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

  const renderAdminDashboard = () => (
    <div className="min-h-screen p-6 bg-background text-text">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Painel Administrativo</h2>
        <div className="flex items-center gap-3">
          <select
            className="input"
            value={adminFilterBarberId}
            onChange={(e) => setAdminFilterBarberId(e.target.value)}
          >
            <option value="">Todos os Barbeiros</option>
            {barbers.map((b) => (
              <option key={b.id} value={b.id}>{b.nome}</option>
            ))}
          </select>
          <button onClick={fetchAdminAppointments} className="button button-outline">Atualizar</button>
          <button onClick={handleAdminLogout} className="button button-outline"><FaSignOutAlt /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Agendamentos */}
        <div className="bg-zinc-900 p-4 rounded-xl shadow">
          <h3 className="text-lg font-semibold mb-3">Agendamentos</h3>
          <div className="space-y-3 max-h-[60vh] overflow-auto">
            {filteredAdminAppointments.map((item) => (
              <div key={item.id} className="p-3 bg-zinc-800 rounded flex items-center justify-between">
                <div>
                  <div className="text-sm opacity-80">{item.barbeiros?.nome ?? "—"}</div>
                  <div className="font-medium">{item.clientes?.nome ?? "Cliente sem nome"}</div>
                  <div className="text-sm opacity-70">{item.data} • {item.hora}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-sm">{item.ocupado ? <span className="text-amber-300">Ocupado</span> : <span className="text-green-300">Livre</span>}</div>
                  {item.ocupado && (
                    <div className="flex gap-2">
                      <button onClick={() => handleReleaseSlot(item.id)} className="button button-small">Liberar</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Serviços - editar preço */}
        <div className="bg-zinc-900 p-4 rounded-xl shadow">
          <h3 className="text-lg font-semibold mb-3">Serviços (Editar Preços)</h3>
          <div className="space-y-3">
            {services.map((s) => (
              <div key={s.id} className="p-3 bg-zinc-800 rounded flex items-center justify-between">
                <div>
                  <div className="font-medium">{s.nome}</div>
                  <div className="text-sm opacity-70">R$ {(s.preco ?? s.price ?? 0).toFixed(2)}</div>
                </div>
                <div className="flex items-center gap-2">
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
                      <button onClick={() => handleSaveServicePrice(s.id)} className="button button-primary">Salvar</button>
                      <button onClick={handleCancelEditPrice} className="button button-outline">Cancelar</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleStartEditPrice(s)} className="button button-small"><FaEdit /></button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // -------------------------
  // Switch view
  // -------------------------
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
