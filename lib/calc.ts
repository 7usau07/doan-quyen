import { Order, COST_PER_KG } from "./mockData"

export const calcRevenue = (orders: Order[]) =>
  orders.reduce((s, o) => s + o.price, 0)

export const calcCost = (orders: Order[]) =>
  orders.reduce((s, o) => s + o.weight * COST_PER_KG, 0)

export const calcProfit = (orders: Order[]) =>
  calcRevenue(orders) - calcCost(orders)