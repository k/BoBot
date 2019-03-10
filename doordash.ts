import * as request from "request-promise-native";
import * as queryString from 'query-string';
import { DateTime } from "luxon";

import { web } from "./slack";
import { createOrderInfo, getOrderInfo, updateAccounting } from './dynamodb';

export const accounting = async(event) => {
  console.log(event);
  const { payload } = queryString.parse(
    event.body
  );
  if (typeof payload != 'string') {
    throw new Error("Unexpected result from Slack API");
  }
  const { 
    actions,
    original_message,
    callback_id,
    message_ts: ts,
    channel: { id: channel_id },
    team: { id: team_id } 
  } = JSON.parse(payload);
  console.log(ts)
  console.log(channel_id)
  if (actions.length > 0 && actions[0].selected_options.length > 0) {
    const action = actions[0];
    const { Item: orderInfo } = await getOrderInfo(callback_id);
    if (!orderInfo) {
      throw new Error("Order not found");
    }
    const { value: user_id } = action.selected_options[0];
    orderInfo.accounting[user_id] = !orderInfo.accounting[user_id];
    const { Attributes: updatedOrderInfo } = await updateAccounting(orderInfo);
    if (!updatedOrderInfo) {
      throw new Error("Updating order failed");
    }
    const update_message = createBillMessage(updatedOrderInfo.url, callback_id, updatedOrderInfo.order_json, updatedOrderInfo.accounting);
    console.log(update_message);
    const slack = await web(team_id);
    await slack.chat.update({
      ts,
      channel: channel_id,
      ...update_message
    });

    return {
      statusCode: 200,
    };
  }
  return {
    statusCode: 200,
  };
}

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
  const { url, timestamp, slack_team_id, slack_channel_id } = event;
  try {
    const order = await getCartOrderJson(url);
    if (DateTime.local().diff(DateTime.fromISO(timestamp)).as("hours") > 6) {
      const slack = await web(slack_team_id);
      slack.chat.postMessage({
        channel: slack_channel_id,
        text: `This order has been going on too long so I will stop monitoring it: ${url}}`
      });
    }

    if (getTip(order) != null && getTax(order) != null) {
      return { ...event, didCheckout: 1 };
    }
  } catch (error) {
    console.log(error);
  }
  return { ...event, didCheckout: 0, };
};

// getBill expects to have an event that looks like this:
// {
//  "url": https://some.doordash.link
// }
// and will return what each person owes the order aggregator
// in the printObject lines.
export const getBill = async (event) => {
  try {
    const { 
      url,  
      slack_team_domain,
      slack_team_id,
      slack_channel_id,
      vendor,

    } = event;
    const cart_order_json = await getCartOrderJson(url);
    const id = vendor + "." + cart_order_json.url_code;
    createOrderInfo({ 
      url, 
      slack_team_domain,
      slack_team_id,
      slack_channel_id,
      vendor,
      id,
      order_json: cart_order_json,
      accounting: {} 
    });
    const slack = await web(slack_team_id)
    await slack.chat.postMessage({
      channel: slack_channel_id,
      ...createBillMessage(url, id, cart_order_json, accounting)
    });
  } catch (error) {
    console.log(error);
    throw error;
  }
};

function createBillMessage(url, callback_id, cart_order_json, accounting) {
  const text = [
    "Boba has been ordered! Receipt is below",
    "-------------------------",
    totalsDisplayString(cart_order_json),
    "-------------------------",
    ordersDisplayStringWithAccounting(cart_order_json, accounting),
    "-------------------------",
    "Message me to send feedback!"
  ].join("\n");
  const type: "select" | "button" = "select";
  return { 
    text,
    attachments: [{
      title: 'Check the status of the order here!',
      title_link: url
    },
    {
      text: "Please pay the host promptly. Mark yourself as paid below",
      callback_id,
      actions: [{
        type,
        name: "orderers",
        text: "Select your name",
        options: ordererOptions(cart_order_json)
      }]
    }]
  };
}

// Returns cart order json from doordash url
const getCartOrderJson = async url => {
  const body = await request(url);
  console.log(body)
  const matches = ORDER_CART_REGEX_PATTERN.exec(body);
  console.log(matches)
  if (!matches) {
    throw new Error("Doordash order cart contents not found!");
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

// Similar to ordersDisplayString, but shows who hasn't paid yet based on an
// accounting_object. This accounting object should be retrieved from the data
// store.
function ordersDisplayStringWithAccounting(cart_order_json, accounting_object) {
  return getOrders(cart_order_json)
    .map(order => {
            const name = getName(order.consumer);
            const subtotal = calculateConsumerSubtotal(order);
      const order_costs = calculcateOrderCosts(cart_order_json);
            const total = calculateConsumerTotal(subtotal, order_costs);
            const fees = total - subtotal;
      const paidStatus = accounting_object[order.id] ? " ✅" : " ❌";
      return `${name} owes ${formatter.format(
        subtotal / 100
      )} + ${formatter.format(fees / 100)} = ${formatter.format(
        total / 100
      )} ${paidStatus}`;
    })
    .join("\n");
}

function ordererOptions(cart_order_json) {
  return getOrders(cart_order_json)
    .map(order => ({
      text: getName(order.consumer),
      value: order.id + ""
    }));
}

async function markUserAsPaid(userId) {
  console.log(userId);
}

function printObject(obj) {
  Object.keys(obj).forEach(key => {
    console.log(`${key}: ${obj[key]}`);
  });
}
