import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { api } from "../api"
import Ticket from "../components/Print/Ticket.jsx"
import { io } from "socket.io-client"

export default function Dashboard() {
  const [orders, setOrders] = useState([])
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [openModal, setOpenModal] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("efectivo")
  const [useCredit, setUseCredit] = useState(false) // si se usa cuenta corriente
  const [ticketData, setTicketData] = useState(null)
  const [cashAmount, setCashAmount] = useState('');
  const [digitalAmount, setDigitalAmount] = useState('');
  const [digitalMethod, setDigitalMethod] = useState('TRANSFERENCIA');



  // Cancelados
  const [openCanceledModal, setOpenCanceledModal] = useState(false)
  const [cancelDetail, setCancelDetail] = useState(null)
  const [cancelReasonInput, setCancelReasonInput] = useState("")
  const [orderToCancel, setOrderToCancel] = useState(null)

  const normalizeOrder = (o) => {
    const id = o.id || o._id || o.number || String(Math.random()).slice(2)
    const status = (o.status || "").toString().toUpperCase()
    return { ...o, id, status }
  }

  const fetchOrders = async () => {
    try {
      const { data } = await api.get("/orders")
      const normalized = Array.isArray(data) ? data.map(o => ({
        ...normalizeOrder(o),
        client: o.client && o.client._id ? o.client : null
      })) : []

      setOrders(prev => {
        const canceled = prev.filter(o => o.status === "CANCELADO")
        return [...normalized, ...canceled]
      })
    } catch (err) {
      console.error(err)
    }
  }

  const fetchCanceledOrders = async () => {
    try {
      const { data } = await api.get("/orders/canceled")
      const normalized = Array.isArray(data) ? data.map(o => ({
        ...normalizeOrder(o),
        client: o.client && o.client._id ? o.client : null
      })) : []

      setOrders(prev => {
        const active = prev.filter(o => o.status !== "CANCELADO")
        return [...active, ...normalized]
      })
    } catch (err) {
      console.error("Error al traer pedidos cancelados:", err)
    }
  }


  useEffect(() => {
    fetchOrders()

    const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:5000"
    const socket = io(SOCKET_URL, { transports: ["websocket"], reconnection: true })

    const handleOrderUpdate = (order) => {
      const normalized = normalizeOrder(order)
      setOrders(prev => {
        const exists = prev.some(o => o.id === normalized.id)
        if (exists) return prev.map(o => o.id === normalized.id ? normalized : o)
        return [normalized, ...prev]
      })
    }

    socket.on("newOrder", handleOrderUpdate)
    socket.on("new-order", handleOrderUpdate)
    socket.on("orderUpdated", handleOrderUpdate)
    socket.on("connect", () => console.log("Socket conectado:", socket.id))
    socket.on("connect_error", (err) => console.warn("Socket error:", err))

    return () => {
      socket.off("newOrder", handleOrderUpdate)
      socket.off("new-order", handleOrderUpdate)
      socket.off("orderUpdated", handleOrderUpdate)
      socket.disconnect()
    }
  }, [])

  const handleCobrar = (order) => {
    const client = order.client && order.client._id ? order.client : null

    setSelectedOrder({
      ...order,
      client,
      secondaryAmount: order.secondaryAmount || "",
      secondaryMethod: order.secondaryMethod || "EFECTIVO",
      sharedPayment: order.sharedPayment || false
    });

    setPaymentAmount(order.total || "");
    setCashAmount(order.total || "");
    setDigitalAmount("");
    setDigitalMethod("TRANSFERENCIA");
    setUseCredit(false);
    setPaymentMethod("EFECTIVO");
    setOpenModal(true);
  }

  const handleConfirmPayment = async (print = false) => {
    try {
      if (!selectedOrder) {
        console.error("No hay pedido seleccionado");
        return;
      }

      const payments = [];

      // Caso cuenta corriente
      if (useCredit || (paymentMethod && paymentMethod.toUpperCase() === "CUENTA_CORRIENTE")) {
        const clientId = selectedOrder.client?._id || null;

        if (useCredit && !selectedOrder.client?._id && !selectedOrder.customerName) {
          alert("El pedido no tiene cliente asignado para cuenta corriente.");
          return;
        }

        payments.push({
          method: "CUENTA_CORRIENTE",
          amount: Number(selectedOrder.total) || 0,
          client: clientId
        });

      } else {
        // División efectivo + digital
        const efectivo = Number(cashAmount) || 0;
        const digital = Number(digitalAmount) || 0;
        const totalOrder = Number(selectedOrder.total) || 0;

        if (efectivo + digital !== totalOrder) {
          alert(`La suma de efectivo (${efectivo}) + digital (${digital}) debe ser igual al total (${totalOrder}).`);
          return;
        }

        if (efectivo > 0) payments.push({ method: "EFECTIVO", amount: efectivo });
        if (digital > 0) payments.push({ method: (digitalMethod || "TRANSFERENCIA").toUpperCase(), amount: digital });
      }

      // Enviar al backend
      const body = { action: "cobrar", payments };

      await api.patch(`/orders/${selectedOrder._id}/status`, body);

      // Imprimir ticket si corresponde
      if (print) {
        setTicketData({
          ...selectedOrder,
          paymentMethod: useCredit ? "CUENTA_CORRIENTE" : payments.map(p => p.method).join(" + ")
        });
      }

      // Reset de estados
      setSelectedOrder(null);
      setPaymentMethod("EFECTIVO");
      setPaymentAmount("");
      setUseCredit(false);
      setCashAmount("");
      setDigitalAmount("");
      setDigitalMethod("TRANSFERENCIA");
      setOpenModal(false);

      fetchOrders();
      console.log("Pago registrado correctamente");
    } catch (error) {
      console.error("Error al confirmar pago:", error);

      if (error?.response) {
        console.error("error.response.data:", error.response.data);
      }
      alert("Error al registrar el pago");
    }
  };


  const handleEnviar = async (orderId) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { action: "enviar" })
      fetchOrders()
    } catch (err) {
      console.error(err)
      alert("Error al enviar")
    }
  }

  const handleCancelar = (order) => {
    setOrderToCancel(order)
    setCancelReasonInput("")
  }

  const confirmCancel = async () => {
    if (!orderToCancel) return
    try {
      const { data } = await api.patch(`/orders/${orderToCancel.id}/status`, {
        action: "cancelar",
        description: cancelReasonInput
      })
      setOrders(prev => prev.map(o => o.id === data.id ? data : o))
      setOrderToCancel(null)
    } catch (err) {
      console.error(err)
      alert("Error al cancelar")
    }
  }

  const handleOpenCanceledModal = async () => {
    await fetchCanceledOrders()
    setOpenCanceledModal(true)
  }

  const handleCreditChange = () => {
    setUseCredit(prev => {
      const newValue = !prev
      setPaymentMethod(newValue ? "CUENTA_CORRIENTE" : "EFECTIVO")
      return newValue
    })
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Panel de Pedidos</h1>
        <Button variant="outline" size="sm" onClick={handleOpenCanceledModal}>Cancelados</Button>
      </div>

      {/* Pedidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>En Proceso</CardTitle></CardHeader>
          <CardContent>
            {orders.filter(o => o.status === "PROCESO").map(order => (
              <div key={order.id} className="border-b py-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Pedido #{order.number}</p>
                    <p className="text-sm text-gray-500">{order.customerName}</p>
                    {order.table || order.address ? <p className="text-sm text-gray-400">{order.table ? `Mesa: ${order.table}` : `Dirección: ${order.address}`}</p> : null}
                    <p className="text-sm font-semibold text-gray-700">Total: ${order.total}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleCobrar(order)}>Cobrar</Button>
                    <Button size="sm" variant="secondary" onClick={() => handleEnviar(order.id)}>Enviar</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleCancelar(order)}>X</Button>
                  </div>
                </div>
                <ul className="ml-4 mt-1 text-sm text-gray-600 list-disc">
                  {order.items?.map((item, idx) => (<li key={idx}>{item.qty} x {item.name} — ${item.total}</li>))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Enviados</CardTitle></CardHeader>
          <CardContent>
            {orders.filter(o => o.status === "ENVIADO").map(order => (
              <div key={order.id} className="border-b py-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Pedido #{order.number}</p>
                    <p className="text-sm text-gray-500">{order.customerName}</p>
                    {order.table || order.address ? (
                      <p className="text-sm text-gray-400">
                        {order.table ? `Mesa: ${order.table}` : `Dirección: ${order.address}`}
                      </p>
                    ) : null}
                    <p className="text-sm font-semibold text-gray-700">Total: ${order.total}</p>
                  </div>

                  {/* Botones */}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleCobrar(order)}>Cobrar</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleCancelar(order)}>X</Button>
                  </div>
                </div>

                <ul className="ml-4 mt-1 text-sm text-gray-600 list-disc">
                  {order.items?.map((item, idx) => (
                    <li key={idx}>{item.qty} x {item.name} — ${item.total}</li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Modal de cobro (reemplazo completo) */}
      {openModal && selectedOrder && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-[80%] max-w-[700px] max-h-[90%] overflow-auto">
            <div className="flex justify-between items-center w-full mb-4">
              <h2 className="text-lg font-bold">Cobrar Pedido #{selectedOrder.number}</h2>
              <Button variant="outline" size="sm" onClick={() => setOpenModal(false)}>Cerrar</Button>
            </div>

            {selectedOrder.client && <p className="mb-2 text-sm font-medium">Cliente: {selectedOrder.client.name}</p>}

            <div className="flex flex-col gap-4 w-full">
              <div className="flex flex-wrap gap-4 items-end">
                {/* Monto principal - EFECTIVO */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Monto principal (Efectivo)</label>
                  <Input
                    type="number"
                    placeholder="Monto"
                    value={cashAmount}
                    onChange={e => setCashAmount(e.target.value)}
                    className="text-sm p-1 w-40"
                    disabled={useCredit}
                  />
                </div>

                {/* Método principal (fijo en EFECTIVO) */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Método</label>
                  <select value="EFECTIVO" disabled className="border p-1 rounded w-40 text-sm bg-gray-50">
                    <option>EFECTIVO</option>
                  </select>
                </div>

                {/* Monto secundario - DIGITAL */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Monto secundario (Digital)</label>
                  <Input
                    type="number"
                    placeholder="Monto"
                    value={digitalAmount}
                    onChange={e => setDigitalAmount(e.target.value)}
                    className="text-sm p-1 w-40"
                    disabled={useCredit}
                  />
                </div>

                {/* Método secundario */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Método secundario</label>
                  <select
                    value={digitalMethod}
                    onChange={e => setDigitalMethod(e.target.value)}
                    className="border p-1 rounded w-40 text-sm"
                    disabled={useCredit}
                  >
                    <option value="TRANSFERENCIA">Transferencia</option>
                    <option value="TARJETA">Tarjeta</option>
                    <option value="QR">QR</option>
                  </select>
                </div>
              </div>

              {/* Cuenta corriente */}
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="creditAccount"
                  checked={useCredit}
                  onChange={handleCreditChange}
                />
                <label htmlFor="creditAccount" className="text-sm font-medium">Cuenta corriente (deshabilita otros pagos)</label>
              </div>

              {/* Resumen y botones */}
              <div className="flex flex-col items-center gap-2 mt-4">
                <p className="text-sm font-semibold text-center">
                  Total: ${selectedOrder.total} | Ingresado: ${Number(cashAmount || 0) + Number(digitalAmount || 0)}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-8 px-3 text-sm"
                    disabled={!useCredit && (Number(cashAmount || 0) + Number(digitalAmount || 0) < Number(selectedOrder.total))}
                    onClick={() => handleConfirmPayment(false)}
                  >
                    Cobrar
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 px-3 text-sm"
                    disabled={!useCredit && (Number(cashAmount || 0) + Number(digitalAmount || 0) < Number(selectedOrder.total))}
                    onClick={() => handleConfirmPayment(true)}
                  >
                    Cobrar e Imprimir
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* Modales de cancelación y cancelados (sin cambios) */}
      {orderToCancel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-96">
            <h2 className="text-lg font-bold mb-4">Cancelar Pedido #{orderToCancel.number}</h2>
            <Input placeholder="Motivo de cancelación" value={cancelReasonInput} onChange={e => setCancelReasonInput(e.target.value)} className="mb-4" />
            <div className="flex justify-between">
              <Button onClick={confirmCancel}>Confirmar</Button>
              <Button variant="outline" onClick={() => setOrderToCancel(null)}>Cerrar</Button>
            </div>
          </div>
        </div>
      )}

      {openCanceledModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-4 rounded shadow-lg w-[800px] max-h-[600px] overflow-y-auto relative">
            <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 font-bold" onClick={() => setOpenCanceledModal(false)}>✕</button>
            <h2 className="text-xl font-bold mb-4 text-center">Pedidos Cancelados</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b bg-gray-100">
                  <th className="px-2 py-1 text-left"># Pedido</th>
                  <th className="px-2 py-1 text-left">Cliente</th>
                  <th className="px-2 py-1 text-left">Fecha</th>
                  <th className="px-2 py-1 text-left">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {orders.filter(o => o.status === "CANCELADO").map((order) => (
                  <tr key={order.id} className="border-b cursor-pointer hover:bg-gray-50" onClick={() => setCancelDetail(order)}>
                    <td className="px-2 py-1">{order.number}</td>
                    <td className="px-2 py-1">{order.customerName}</td>
                    <td className="px-2 py-1 text-gray-500 text-xs">{order.canceledAt ? new Date(order.canceledAt).toLocaleString() : "—"}</td>
                    <td className="px-2 py-1 text-red-600 text-xs">{order.cancelReason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {cancelDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-96">
            <h2 className="text-lg font-bold mb-4">Detalle Pedido #{cancelDetail.number}</h2>
            <p><b>Cliente:</b> {cancelDetail.customerName}</p>
            <p><b>Total:</b> ${cancelDetail.total}</p>
            <p><b>Fecha:</b> {cancelDetail.canceledAt ? new Date(cancelDetail.canceledAt).toLocaleString() : "—"}</p>
            <p className="mt-4 text-red-600"><b>Motivo de cancelación:</b></p>
            <p>{cancelDetail.cancelReason}</p>
            <Button className="mt-4 w-full" variant="outline" onClick={() => setCancelDetail(null)}>Cerrar</Button>
          </div>
        </div>
      )}

      {ticketData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-start pt-20 z-50">
          <Ticket orderData={ticketData} onClose={() => setTicketData(null)} />
        </div>
      )}
    </div>
  )
}
