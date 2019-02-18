'use strict';

const request = require('request');

// This pattern is used to parse the doordash bill for the JSON
// string that includes order information, i.e.
// - tip
// - total order amount
// - per person subtotals
// - etc.
const ORDER_CART_REGEX_PATTERN =
    /view\.order_cart\s*\=\s*JSON\.parse\((.*)\);\n/gm;

// getBill expects to have an event that looks like this:
// {
//  "url": https://some.doordash.link
// }
// and will return what each person owes the order aggregator
// in the printObject lines.
module.exports.getBill = (event, context, callback) => {
  console.log('typeof', typeof event);
  console.log(event);

  try {
    // Doordash url

    const url = event.url;
    console.log('here\'s the url', url);

    request(url, function(error, response, body) {
      // Parse response body to get cart order details in a JSON object.
      const matches = ORDER_CART_REGEX_PATTERN.exec(body);
      const cart_order_text = matches[1];
      const cart_order_json = JSON.parse(JSON.parse(cart_order_text));

      // Parse and display high-level order cost details.
      var order_costs = {
        tip: getTip(cart_order_json),
        tax: getTax(cart_order_json),
        service_fee: getServiceFee(cart_order_json),
        delivery_fee: getDeliveryFee(cart_order_json),
        subtotal: getSubtotal(cart_order_json),
        total: getTotal(cart_order_json)
      };
      printObject(order_costs);

      // Calculate and display order costs per person.
      const orders = getOrders(cart_order_json);
      for (var i in orders) {
        var order = orders[i];
        var subtotal = calculateConsumerSubtotal(order);
        var order_info = {
          name: getName(order.consumer),
          consumer_subtotal: formatter.format(subtotal / 100),
          consumer_total: formatter.format(
              calculateConsumerTotal(subtotal, order_costs) / 100)
        };
        printObject(order_info);
      }
    });
  } catch (error) {
    console.log(error);
    callback(error);
  }
};

// Create our currency formatter.
var formatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
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
  return consumer.first_name + ' ' + consumer.last_name;
}

function calculateConsumerSubtotal(order) {
  const order_items = order.order_items;
  var subtotal = 0;
  for (var i in order_items) {
    const item = order_items[i];
    subtotal += item.single_price_monetary_fields.unit_amount;
  }
  return subtotal;
}

function calculateConsumerTotal(consumer_subtotal, order_costs) {
  const ratio = consumer_subtotal / order_costs.subtotal;
  const shared_costs = order_costs.tip + order_costs.tax +
      order_costs.service_fee + order_costs.delivery_fee;
  return ratio * shared_costs + consumer_subtotal;
}

function printObject(obj) {
  Object.keys(obj).forEach(key => {
    console.log(key + ': ' + obj[key]);
  });
}
