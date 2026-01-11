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

// 🎨 PALETA DE CORES PREMIUM
const COLORS = {
  BLACK: "#000000",
  GOLD: "#D4AF37",
  DARK_GRAY: "#1a1a1a",
  LIGHT_GRAY: "#2d2d2d",
  WHITE: "#FFFFFF",
};

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
    console.log("🔄 Buscando agendamentos...");
    setLoading(true);
    try {
      const { data: horariosData, error: horariosError } = await supabase
        .from("horarios")
        .select("*")
        .eq("ocupado", true)
        .order("data", { ascending: true })
        .order("hora", { ascending: true });

      if (horariosError) throw horariosError;

      const { data: barbeirosData } = await supabase
        .from("barbeiros")
        .select("id, nome, telefone");

      const { data: clientesData } = await supabase
        .from("clientes")
        .select("id, nome, telefone");

      const result = (horariosData || []).map(horario => {
        const barbeiro = (barbeirosData || []).find(b => b.id === horario.barbeiro_id);
        const cliente = (clientesData || []).find(c => c.id === horario.cliente_id);

        console.log(`Processando ID ${horario.id}: barbeiro=${barbeiro?.nome}, cliente=${cliente?.nome}`);

        return {
          ...horario,
          barbeiros: barbeiro || { nome: "—" },
          clientes: cliente || { nome: "Sem nome" }
        };
      });

      console.log("✅ Total processado:", result.length, result);
      setAdminAppointments(result);
    } catch (err) {
      console.error("❌ Erro:", err);
      toast.error("Erro ao carregar agendamentos.");
    } finally {
      setLoading(false);
    }
  };

  const handleReleaseSlot = async (horarioId) => {
    console.log("🔓 Liberando ID:", horarioId);
    try {
      const { error } = await supabase
        .from("horarios")
        .update({ ocupado: false, cliente_id: null })
        .eq("id", horarioId);

      if (error) throw error;

      toast.success("Horário liberado com sucesso.");
      setAdminAppointments(prev => prev.filter(item => item.id !== horarioId));
      await new Promise(resolve => setTimeout(resolve, 800));
      await fetchAdminAppointments();
    } catch (err) {
      console.error("❌ Erro ao liberar:", err);
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
    await supabase.from("servicos").update({ preco: newPrice }).eq("id", serviceId);
    setServices(services.map((s) => s.id === serviceId ? { ...s, preco: newPrice } : s));
    handleCancelEditPrice();
    toast.success("Preço atualizado");
  };

  const filteredAdminAppointments = adminAppointments.filter(
    (a) => (adminFilterBarberId ? a.barbeiro_id === Number(adminFilterBarberId) : true)
  );

  const horariosDisponiveis = [
    "08:00:00", "08:40:00", "09:20:00", "10:00:00", "10:40:00", "11:20:00", "12:00:00",
    "14:00:00", "14:40:00", "15:20:00", "16:00:00", "16:40:00", "17:20:00",
    "18:00:00", "18:40:00", "19:20:00", "20:00:00"
  ];

  const fetchAvailableTimes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("horarios")
      .select("hora")
      .eq("barbeiro_id", selectedBarber.id)
      .eq("data", selectedDate)
      .eq("ocupado", true);
    const occupied = data ? data.map(r => r.hora) : [];
    setAvailableTimes(horariosDisponiveis.map((t) => ({
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
      const horaParaRpc = `${selectedTime.length === 5 ? selectedTime + ':00' : selectedTime}`;
      const { data, error } = await supabase.rpc('book_slot', {
        _barbeiro_id: Number(selectedBarber.id),
        _data: selectedDate,
        _hora: horaParaRpc,
        _cliente_nome: clientName.trim()
      });

      if (error) {
        toast.error("Erro ao agendar: " + (error.message || error));
        setLoading(false);
        return;
      }

      if (!data) {
        toast.error("Horário não pôde ser agendado. Tente outro horário.");
        setLoading(false);
        return;
      }

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
      toast.error("Erro ao agendar (catch).");
    }
    setLoading(false);
  };

  // 🏠 HOME - PRETO + DOURADO PREMIUM
  const renderHome = () => (
    <div
      className="relative min-h-screen flex flex-col justify-center items-center text-center overflow-hidden"
      style={{
        backgroundImage: `url(${BG_IMAGES[currentBg]})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: COLORS.BLACK,
      }}
    >
      {/* Overlay escuro */}
      <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.85)" }}></div>
      
      {/* Logo como watermark */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: "url(/newera_logo_refined.jpg)",
          backgroundSize: "50%",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: 0.12,
          zIndex: 1,
        }}
      ></div>

      {/* Conteúdo */}
      <div className="relative z-10 flex flex-col items-center p-6 max-w-md w-full">
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <img
            src="/logo.png"
            alt="Logotipo NewEra Barbershop"
            style={{
              maxWidth: 380,
              minWidth: 120,
              width: "85%",
              height: "auto",
              display: "block"
            }}
          />
        </div>

        <p
          className="font-light mb-8"
          style={{
            color: COLORS.WHITE,
            fontSize: "1.8rem",
            fontWeight: 700,
            fontFamily: "'Poppins', Arial, sans-serif",
            letterSpacing: "0.01em",
            textShadow: "0 2px 4px rgba(0,0,0,0.5)",
            whiteSpace: "nowrap"
          }}
        >
          Corte - Atitude - Respeito
        </p>

        {/* Botão Agendar - DOURADO */}
        <button
          onClick={() => setView("services")}
          className="w-full mb-3 py-4 px-6 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition-all duration-300 transform hover:scale-105"
          style={{
            background: `linear-gradient(to right, ${COLORS.GOLD}, #C9A961)`,
            color: COLORS.BLACK,
            boxShadow: `0 10px 25px -5px rgba(212, 175, 55, 0.3)`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = `0 15px 35px -5px rgba(212, 175, 55, 0.5)`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = `0 10px 25px -5px rgba(212, 175, 55, 0.3)`;
          }}
        >
          <FaCut /> Agendar Horário
        </button>

        {/* Botão Admin - BORDA DOURADA */}
        <button
          onClick={() => setView("adminLogin")}
          className="w-full py-3 px-6 rounded-lg font-semibold text-sm mb-4 transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2"
          style={{
            backgroundColor: "transparent",
            border: `2px solid ${COLORS.GOLD}`,
            color: COLORS.GOLD,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(212, 175, 55, 0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <FaSignInAlt /> Área Administrativa
        </button>

        {/* Link Endereço - DOURADO */}
        <a
          href="https://www.google.com/maps?q=Av.+Colombo+Machado+Sales,+660,+sala+03"
          target="_blank"
          rel="noopener noreferrer"
          className="mb-2 flex items-center justify-center gap-2 text-sm sm:text-base transition-all duration-300 group"
          style={{ color: COLORS.WHITE }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover:scale-110"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            style={{ color: COLORS.GOLD }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 21s6-5.373 6-10a6 6 0 10-12 0c0 4.627 6 10 6 10z"
            />
            <circle cx="12" cy="11" r="2.5" />
          </svg>
          <span className="underline underline-offset-2 text-center group-hover:text-yellow-300">
            Av. Colombo Machado Sales, 660 sala 03
          </span>
        </a>
      </div>
    </div>
  );

  // 🎨 SERVIÇOS - PRETO + DOURADO (TOTALMENTE REFORMULADO)
  const renderServices = () => (
    <div className="min-h-screen p-4 sm:p-6 text-white"
      style={{
        background: `linear-gradient(135deg, ${COLORS.BLACK} 0%, ${COLORS.DARK_GRAY} 100%)`,
      }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <button
          onClick={() => setView("home")}
          className="mb-12 font-semibold transition-all flex items-center gap-2 hover:gap-3"
          style={{ color: COLORS.GOLD }}
        >
          ← Voltar
        </button>

        <div className="text-center mb-16">
          <h1 className="text-5xl sm:text-6xl font-black mb-4" style={{ color: COLORS.WHITE }}>
            Customize Seu Corte
          </h1>
          <p className="text-lg text-gray-300" style={{ maxWidth: "600px", margin: "0 auto" }}>
            Escolha seu barbeiro e os serviços que deseja. Crie a experiência perfeita para você.
          </p>
        </div>

        {/* BARBEIROS */}
        <div className="mb-16">
          <h2 className="text-3xl font-black mb-6" style={{ color: COLORS.GOLD }}>
            🎯 Escolha seu Barbeiro
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {barbers.map((barber) => (
              <button
                key={barber.id}
                onClick={() => setSelectedBarber(barber)}
                className="group p-8 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 border-2 relative overflow-hidden"
                style={{
                  backgroundColor: selectedBarber?.id === barber.id ? COLORS.GOLD : COLORS.LIGHT_GRAY,
                  color: selectedBarber?.id === barber.id ? COLORS.BLACK : COLORS.WHITE,
                  borderColor: selectedBarber?.id === barber.id ? COLORS.GOLD : "transparent",
                  boxShadow: selectedBarber?.id === barber.id ? `0 15px 40px -10px rgba(212, 175, 55, 0.5)` : `0 10px 30px -10px rgba(0,0,0,0.4)`,
                }}
              >
                <div className="flex items-center justify-center gap-3 text-lg">
                  <FaUserCircle className="text-2xl" />
                  {barber.nome}
                </div>
                {selectedBarber?.id === barber.id && (
                  <div className="absolute top-2 right-2" style={{ color: COLORS.BLACK }}>
                    ✓
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* SERVIÇOS */}
        <div className="mb-16">
          <h2 className="text-3xl font-black mb-6" style={{ color: COLORS.GOLD }}>
            ✨ Selecione seus Serviços
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map((service) => {
              const selected = selectedServices.some((s) => s.id === service.id);
              return (
                <button
                  key={service.id}
                  onClick={() => handleServiceSelect(service)}
                  className="group p-6 rounded-xl transition-all duration-300 transform hover:scale-105 border-2 text-left relative overflow-hidden"
                  style={{
                    backgroundColor: selected ? COLORS.GOLD : COLORS.LIGHT_GRAY,
                    color: selected ? COLORS.BLACK : COLORS.WHITE,
                    borderColor: selected ? COLORS.GOLD : "transparent",
                    boxShadow: selected ? `0 15px 40px -10px rgba(212, 175, 55, 0.5)` : `0 10px 30px -10px rgba(0,0,0,0.4)`,
                  }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-lg">{service.nome}</h3>
                    </div>
                    <div 
                      className="text-2xl transition-transform"
                      style={{
                        color: selected ? COLORS.BLACK : COLORS.GOLD,
                        transform: selected ? "scale(1.2)" : "scale(1)",
                      }}
                    >
                      {selected ? "✓" : "○"}
                    </div>
                  </div>
                  <p className="text-sm opacity-75 mb-2"> </p>
                  <p className="text-2xl font-black" style={{ color: selected ? COLORS.BLACK : COLORS.GOLD }}>
                    R$ {Number(service.preco ?? service.price ?? 0).toFixed(2)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* DATA, HORA, NOME */}
        {selectedBarber && (
          <div className="mb-16 p-8 rounded-xl" style={{
            backgroundColor: COLORS.LIGHT_GRAY,
            border: `2px solid ${COLORS.GOLD}`,
            boxShadow: `0 20px 50px -10px rgba(212, 175, 55, 0.2)`,
          }}>
            <h2 className="text-3xl font-black mb-8" style={{ color: COLORS.GOLD }}>
              📅 Finalize sua Reserva
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              {/* Data */}
              <div>
                <label className="block font-bold mb-3 text-lg" style={{ color: COLORS.GOLD }}>
                  Data do Agendamento
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full p-4 rounded-lg text-lg font-semibold transition-all"
                  style={{
                    backgroundColor: COLORS.BLACK,
                    border: `2px solid ${COLORS.GOLD}`,
                    color: COLORS.WHITE,
                  }}
                  onFocus={(e) => {
                    e.target.style.boxShadow = `0 0 15px rgba(212, 175, 55, 0.3)`;
                  }}
                  onBlur={(e) => {
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>

              {/* Nome */}
              <div>
                <label className="block font-bold mb-3 text-lg" style={{ color: COLORS.GOLD }}>
                  Seu Nome Completo
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ex: João Silva"
                  className="w-full p-4 rounded-lg text-lg font-semibold transition-all"
                  style={{
                    backgroundColor: COLORS.BLACK,
                    border: `2px solid ${COLORS.GOLD}`,
                    color: COLORS.WHITE,
                  }}
                  onFocus={(e) => {
                    e.target.style.boxShadow = `0 0 15px rgba(212, 175, 55, 0.3)`;
                  }}
                  onBlur={(e) => {
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>
            </div>

            {/* Horários */}
            {selectedDate && (
              <div>
                <label className="block font-bold mb-4 text-lg" style={{ color: COLORS.GOLD }}>
                  🕐 Horários Disponíveis
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {availableTimes.map((slot) => (
                    <button
                      key={slot.time}
                      onClick={() => setSelectedTime(slot.time)}
                      disabled={slot.ocupado}
                      className="p-4 rounded-lg font-bold transition-all transform hover:scale-110"
                      style={{
                        backgroundColor: slot.ocupado ? "#3a2a2a" : selectedTime === slot.time ? COLORS.GOLD : COLORS.BLACK,
                        color: slot.ocupado ? "#888" : selectedTime === slot.time ? COLORS.BLACK : COLORS.GOLD,
                        border: `2px solid ${slot.ocupado ? "#5a4a4a" : selectedTime === slot.time ? COLORS.GOLD : COLORS.GOLD}`,
                        cursor: slot.ocupado ? "not-allowed" : "pointer",
                        opacity: slot.ocupado ? 0.4 : 1,
                        boxShadow: selectedTime === slot.time ? `0 10px 20px -5px rgba(212, 175, 55, 0.4)` : "none",
                      }}
                    >
                      {slot.time.slice(0, 5)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TOTAL E CONFIRMAR */}
        {selectedServices.length > 0 && (
          <div className="sticky bottom-0 left-0 right-0 p-6 rounded-t-2xl" style={{
            backgroundColor: COLORS.BLACK,
            border: `2px solid ${COLORS.GOLD}`,
            boxShadow: `0 -10px 40px -5px rgba(212, 175, 55, 0.3)`,
          }}>
            <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="text-center sm:text-left">
                <p className="text-gray-400 text-sm mb-1">Valor Total do Agendamento</p>
                <p className="text-4xl sm:text-5xl font-black" style={{ color: COLORS.GOLD }}>
                  R$ {calculateTotal().toFixed(2)}
                </p>
              </div>
              <button
                onClick={handleConfirmAppointment}
                disabled={!selectedBarber || !selectedDate || !selectedTime || !clientName}
                className="w-full sm:w-auto px-12 py-4 rounded-lg font-bold text-lg transition-all transform hover:scale-105"
                style={{
                  background: `linear-gradient(to right, ${COLORS.GOLD}, #C9A961)`,
                  color: COLORS.BLACK,
                  opacity: !selectedBarber || !selectedDate || !selectedTime || !clientName ? 0.5 : 1,
                  cursor: !selectedBarber || !selectedDate || !selectedTime || !clientName ? "not-allowed" : "pointer",
                  boxShadow: `0 10px 30px -5px rgba(212, 175, 55, 0.4)`,
                }}
              >
                {loading ? "Processando..." : "✓ Confirmar Agendamento"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // 🔑 ADMIN LOGIN
  const renderAdminLogin = () => (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: COLORS.BLACK }}>
      <div className="w-full max-w-md p-8 rounded-lg"
        style={{
          backgroundColor: COLORS.LIGHT_GRAY,
          border: `2px solid ${COLORS.GOLD}`,
          boxShadow: `0 20px 40px -10px rgba(212, 175, 55, 0.2)`,
        }}>
        <button
          onClick={() => setView("home")}
          className="mb-8 font-semibold transition-all"
          style={{ color: COLORS.GOLD }}
        >
          ← Voltar
        </button>

        <h2 className="text-3xl font-black mb-8" style={{ color: COLORS.WHITE }}>Área Administrativa</h2>

        <form onSubmit={handleAdminLogin} className="space-y-6">
          <div>
            <label className="block font-bold mb-2" style={{ color: COLORS.GOLD }}>Usuário</label>
            <input
              type="text"
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
              className="w-full p-4 rounded-lg"
              style={{
                backgroundColor: "#1a1a1a",
                border: `2px solid ${COLORS.LIGHT_GRAY}`,
                color: COLORS.WHITE,
              }}
            />
          </div>

          <div>
            <label className="block font-bold mb-2" style={{ color: COLORS.GOLD }}>Senha</label>
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full p-4 rounded-lg"
              style={{
                backgroundColor: "#1a1a1a",
                border: `2px solid ${COLORS.LIGHT_GRAY}`,
                color: COLORS.WHITE,
              }}
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 rounded-lg font-bold transition-all"
            style={{
              background: `linear-gradient(to right, ${COLORS.GOLD}, #C9A961)`,
              color: COLORS.BLACK,
            }}
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );

  // 📊 ADMIN DASHBOARD
  const renderAdminDashboard = () => (
    <div className="min-h-screen p-4 sm:p-6"
      style={{ backgroundColor: COLORS.BLACK }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8 flex-col sm:flex-row gap-4">
          <h2 className="text-4xl font-black" style={{ color: COLORS.WHITE }}>Dashboard</h2>
          <button
            onClick={handleAdminLogout}
            className="flex items-center gap-2 font-bold px-6 py-3 rounded-lg transition-all"
            style={{
              backgroundColor: "#8B0000",
              color: COLORS.WHITE,
            }}
          >
            <FaSignOutAlt /> Sair
          </button>
        </div>

        <div className="mb-8">
          <label className="block font-bold mb-3" style={{ color: COLORS.GOLD }}>Filtrar por Barbeiro</label>
          <select
            value={adminFilterBarberId}
            onChange={(e) => setAdminFilterBarberId(e.target.value)}
            className="w-full sm:w-64 p-3 rounded-lg"
            style={{
              backgroundColor: COLORS.LIGHT_GRAY,
              border: `2px solid ${COLORS.LIGHT_GRAY}`,
              color: COLORS.WHITE,
            }}
          >
            <option value="">Todos os Barbeiros</option>
            {barbers.map((b) => (
              <option key={b.id} value={b.id}>{b.nome}</option>
            ))}
          </select>
        </div>

        {/* Tabela de Agendamentos */}
        <div className="rounded-lg overflow-hidden"
          style={{
            backgroundColor: COLORS.LIGHT_GRAY,
            border: `2px solid ${COLORS.LIGHT_GRAY}`,
          }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ background: `linear-gradient(to right, ${COLORS.GOLD}, #C9A961)` }}>
                <tr>
                  <th className="px-6 py-4 text-left font-bold" style={{ color: COLORS.BLACK }}>Barbeiro</th>
                  <th className="px-6 py-4 text-left font-bold" style={{ color: COLORS.BLACK }}>Cliente</th>
                  <th className="px-6 py-4 text-left font-bold" style={{ color: COLORS.BLACK }}>Data</th>
                  <th className="px-6 py-4 text-left font-bold" style={{ color: COLORS.BLACK }}>Hora</th>
                  <th className="px-6 py-4 text-left font-bold" style={{ color: COLORS.BLACK }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdminAppointments.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center" style={{ color: "#888" }}>
                      Nenhum agendamento encontrado
                    </td>
                  </tr>
                ) : (
                  filteredAdminAppointments.map((appointment) => (
                    <tr key={appointment.id} className="border-t transition-all hover:bg-opacity-50"
                      style={{
                        borderColor: COLORS.LIGHT_GRAY,
                        backgroundColor: "rgba(0,0,0,0.3)",
                      }}>
                      <td className="px-6 py-4" style={{ color: COLORS.WHITE }}>{appointment.barbeiros.nome}</td>
                      <td className="px-6 py-4" style={{ color: COLORS.WHITE }}>{appointment.clientes.nome}</td>
                      <td className="px-6 py-4" style={{ color: "#ccc" }}>{appointment.data}</td>
                      <td className="px-6 py-4" style={{ color: "#ccc" }}>{appointment.hora.slice(0, 5)}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleReleaseSlot(appointment.id)}
                          className="font-bold px-4 py-2 rounded transition-all"
                          style={{
                            backgroundColor: "#8B0000",
                            color: COLORS.WHITE,
                          }}
                        >
                          Liberar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Toaster position="top-center" />
      {view === "home" && renderHome()}
      {view === "services" && renderServices()}
      {view === "adminLogin" && renderAdminLogin()}
      {view === "adminDashboard" && adminLoggedIn && renderAdminDashboard()}
    </>
  );
}
