import * as request from "request-promise-native";
import { webhook } from "./slack";

// This pattern is used to parse the doordash bill for the JSON
// string that includes order information, i.e.
// - tip
// - total order amount
// - per person subtotals
// - etc.
const ORDER_CART_REGEX_PATTERN = /view\.order_cart\s*\=\s*JSON\.parse\((.*)\);\n/gm;

// didCheckout expects to have an event that looks like this:
// {
//  "url": https://some.doordash.link
// }
// and will return { didCheckout: 1 } if the order has been checked out
//
export const didCheckout = async (event, context) => {
  const { url } = event;
  const order = await getCartOrderJson(url);
  console.log(order);

  if (getTip(order) != null && getTax(order) != null) {
    return { url, didCheckout: 1 };
  }

  return { url, didCheckout: 0 };
};

// getBill expects to have an event that looks like this:
// {
//  "url": https://some.doordash.link
// }
// and will return what each person owes the order aggregator
// in the printObject lines.
export const getBill = async (event, context) => {
  console.log(event);
  try {
    const { url } = event;
    const cart_order_json = await getCartOrderJson(url);

    const text = [
      totalsDisplayString(cart_order_json),
      "---------------",
      ordersDisplayString(cart_order_json)
    ].join("\n");
    await webhook.send({ text });
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Returns cart order json from doordash url
const getCartOrderJson = async url => {
  const body = await request(url);
  console.log(body);
  const matches = ORDER_CART_REGEX_PATTERN.exec(body);
  if (!matches) {
    throw new Error("Doordash order cart contents not found!")
  }
  const cart_order_text = matches[1];
  return JSON.parse(JSON.parse(cart_order_text));
};

// Create our currency formatter.
const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2
  // the default value for minimumFractionDigits depends on the currency
  // and is usually already 2
});

function getTip(order) {
  return order.tip_amount_monetary_fields.unit_amount;
}
function getTax(order) {
  return order.tax_amount_monetary_fields.unit_amount;
}
function getServiceFee(order) {
  return order.applied_service_fee;
}
function getDeliveryFee(order) {
  return order.delivery_fee_details.final_fee.unit_amount;
}
function getSubtotal(order) {
  return order.subtotal;
}
function getTotal(order) {
  return order.total_charged;
}
function getOrders(order) {
  return order.orders;
}
function getName(consumer) {
  return `${consumer.first_name} ${consumer.last_name}`;
}

function calculateConsumerSubtotal(order) {
  const { order_items } = order;
  let subtotal = 0;
  for (const i in order_items) {
    const item = order_items[i];
    subtotal += item.single_price_monetary_fields.unit_amount;
  }
  return subtotal;
}

function calculcateOrderCosts(cart_order_json) {
  return {
    tip: getTip(cart_order_json),
    tax: getTax(cart_order_json),
    service_fee: getServiceFee(cart_order_json),
    delivery_fee: getDeliveryFee(cart_order_json),
    subtotal: getSubtotal(cart_order_json),
    total: getTotal(cart_order_json)
  };
}

function calculateConsumerTotal(consumer_subtotal, order_costs) {
  const ratio = consumer_subtotal / order_costs.subtotal;
  const shared_costs =
    order_costs.tip +
    order_costs.tax +
    order_costs.service_fee +
    order_costs.delivery_fee;
  return ratio * shared_costs + consumer_subtotal;
}

function totalsDisplayString(cart_order_json) {
  const {
    tip,
    tax,
    service_fee,
    delivery_fee,
    subtotal,
    total
  } = calculcateOrderCosts(cart_order_json);
  return [
    `Tip:          ${formatter.format(tip / 100)}`,
    `Tax:          ${formatter.format(tax / 100)}`,
    `Service Fee:  ${formatter.format(service_fee / 100)}`,
    `Delivery Fee: ${formatter.format(delivery_fee / 100)}`,
    `Subtotal:     ${formatter.format(subtotal / 100)}`,
    `Total:        ${formatter.format(total / 100)}`
  ].join("\n");
}

function ordersDisplayString(cart_order_json) {
  return getOrders(cart_order_json)
    .map(order => {
      const subtotal = calculateConsumerSubtotal(order);
      const order_costs = calculcateOrderCosts(cart_order_json);
      const total = calculateConsumerTotal(subtotal, order_costs);
      const fees = total - subtotal;
      return `${getName(order.consumer)} owes ${formatter.format(
        subtotal / 100
      )} + ${formatter.format(fees / 100)} = ${formatter.format(total / 100)}`;
    })
    .join("\n");
}

function printObject(obj) {
  Object.keys(obj).forEach(key => {
    console.log(`${key}: ${obj[key]}`);
  });
}
