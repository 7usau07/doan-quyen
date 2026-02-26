"use client"
import { useState } from "react"

export default function AddOrder({ onAdd }: any) {
  const [customer, setCustomer] = useState("")
  const [weight, setWeight] = useState(0)
  const [sellPrice, setSellPrice] = useState(0)
  const [costPrice, setCostPrice] = useState(0)

  const handleAdd = () => {
    onAdd({
      id: Date.now(),
      customer,
      weight,
      sellPrice,
      costPrice,
      date: new Date().toISOString(),
      paid: false,
      note: ""
    })
  }

  return (
    <div className="bg-white p-4 rounded-xl shadow space-y-2">
      <input placeholder="Tên khách" onChange={e=>setCustomer(e.target.value)} className="border p-2 w-full"/>
      <input placeholder="Kg" type="number" onChange={e=>setWeight(Number(e.target.value))} className="border p-2 w-full"/>
      <input placeholder="Giá bán" type="number" onChange={e=>setSellPrice(Number(e.target.value))} className="border p-2 w-full"/>
      <input placeholder="Giá nhập" type="number" onChange={e=>setCostPrice(Number(e.target.value))} className="border p-2 w-full"/>

      <button onClick={handleAdd} className="bg-green-500 text-white px-4 py-2 rounded-lg">
        Thêm đơn
      </button>
    </div>
  )
}