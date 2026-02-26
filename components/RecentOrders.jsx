export default function RecentOrders() {
  const orders = [
    { id: 1, name: "Anh Hùng", kg: 0.5, money: 7500000 },
    { id: 2, name: "Chị Lan", kg: 1, money: 14500000 },
  ];

  return (
    <div className="bg-white p-5 rounded-2xl shadow">
      <h2 className="font-semibold mb-3">Đơn gần đây</h2>

      {orders.map((o) => (
        <div key={o.id} className="flex justify-between border-b py-2">
          <span>{o.name}</span>
          <span>{o.kg} kg</span>
          <span>{o.money.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}