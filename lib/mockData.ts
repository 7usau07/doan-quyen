export type Order = {
  id: string
  customer: string
  weight: number
  price: number
  paid: boolean
  date: string
}

export const COST_PER_KG = 9000000

const orders: Order[] = [
  {
    id: "1",
    customer: "Anh Minh",
    weight: 0.1,
    price: 1500000,
    paid: true,
    date: "2026-02-20",
  },
  {
    id: "2",
    customer: "Chị Lan",
    weight: 0.2,
    price: 2250000,
    paid: false,
    date: "2026-02-21",
  },
]

export const getOrders = () => orders