"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _this = this;
Object.defineProperty(exports, "__esModule", { value: true });
var request = require("request-promise-native");
var slack_1 = require("./slack");
exports.accounting = function (event) { return __awaiter(_this, void 0, void 0, function () {
    return __generator(this, function (_a) {
        console.log(event);
        return [2 /*return*/, event.body.original_message];
    });
}); };
// This pattern is used to parse the doordash bill for the JSON
// string that includes order information, i.e.
// - tip
// - total order amount
// - per person subtotals
// - etc.
var ORDER_CART_REGEX_PATTERN = /view\.order_cart\s*\=\s*JSON\.parse\((.*)\);\n/gm;
// didCheckout expects to have an event that looks like this:
// {
//  "url": https://some.doordash.link
// }
// and will return { didCheckout: 1 } if the order has been checked out
//
exports.didCheckout = function (event, context) { return __awaiter(_this, void 0, void 0, function () {
    var url, order;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                url = event.url;
                return [4 /*yield*/, getCartOrderJson(url)];
            case 1:
                order = _a.sent();
                console.log(order);
                if (getTip(order) != null && getTax(order) != null) {
                    return [2 /*return*/, { url: url, didCheckout: 1 }];
                }
                return [2 /*return*/, { url: url, didCheckout: 0 }];
        }
    });
}); };
// getBill expects to have an event that looks like this:
// {
//  "url": https://some.doordash.link
// }
// and will return what each person owes the order aggregator
// in the printObject lines.
exports.getBill = function (event, context) { return __awaiter(_this, void 0, void 0, function () {
    var url, cart_order_json, text, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log(event);
                _a.label = 1;
            case 1:
                _a.trys.push([1, 4, , 5]);
                url = event.url;
                return [4 /*yield*/, getCartOrderJson(url)];
            case 2:
                cart_order_json = _a.sent();
                text = [
                    totalsDisplayString(cart_order_json),
                    "---------------",
                    ordersDisplayString(cart_order_json)
                ].join("\n");
                return [4 /*yield*/, slack_1.webhook.send({
                        text: text,
                        attachments: ordererAttachments(cart_order_json)
                    })];
            case 3:
                _a.sent();
                return [3 /*break*/, 5];
            case 4:
                error_1 = _a.sent();
                console.log(error_1);
                throw error_1;
            case 5: return [2 /*return*/];
        }
    });
}); };
// Returns cart order json from doordash url
var getCartOrderJson = function (url) { return __awaiter(_this, void 0, void 0, function () {
    var body, matches, cart_order_text;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, request(url)];
            case 1:
                body = _a.sent();
                console.log(body);
                matches = ORDER_CART_REGEX_PATTERN.exec(body);
                if (!matches) {
                    throw new Error("Doordash order cart contents not found!");
                }
                cart_order_text = matches[1];
                return [2 /*return*/, JSON.parse(JSON.parse(cart_order_text))];
        }
    });
}); };
// Create our currency formatter.
var formatter = new Intl.NumberFormat("en-US", {
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
    return consumer.first_name + " " + consumer.last_name;
}
function calculateConsumerSubtotal(order) {
    var order_items = order.order_items;
    var subtotal = 0;
    for (var i in order_items) {
        var item = order_items[i];
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
    var ratio = consumer_subtotal / order_costs.subtotal;
    var shared_costs = order_costs.tip +
        order_costs.tax +
        order_costs.service_fee +
        order_costs.delivery_fee;
    return ratio * shared_costs + consumer_subtotal;
}
function totalsDisplayString(cart_order_json) {
    var _a = calculcateOrderCosts(cart_order_json), tip = _a.tip, tax = _a.tax, service_fee = _a.service_fee, delivery_fee = _a.delivery_fee, subtotal = _a.subtotal, total = _a.total;
    return [
        "Tip:          " + formatter.format(tip / 100),
        "Tax:          " + formatter.format(tax / 100),
        "Service Fee:  " + formatter.format(service_fee / 100),
        "Delivery Fee: " + formatter.format(delivery_fee / 100),
        "Subtotal:     " + formatter.format(subtotal / 100),
        "Total:        " + formatter.format(total / 100)
    ].join("\n");
}
function ordersDisplayString(cart_order_json) {
    return getOrders(cart_order_json)
        .map(function (order) {
        var subtotal = calculateConsumerSubtotal(order);
        var order_costs = calculcateOrderCosts(cart_order_json);
        var total = calculateConsumerTotal(subtotal, order_costs);
        var fees = total - subtotal;
        return getName(order.consumer) + " owes " + formatter.format(subtotal / 100) + " + " + formatter.format(fees / 100) + " = " + formatter.format(total / 100);
    })
        .join("\n");
}
// Similar to ordersDisplayString, but shows who hasn't paid yet based on an
// accounting_object. This accounting object should be retrieved from the data
// store.
function ordersDisplayStringWithAccounting(cart_order_json, accounting_object) {
    return getOrders(cart_order_json)
        .map(function (order) {
        var name = getName(order.consumer);
        var subtotal = calculateConsumerSubtotal(order);
        var order_costs = calculcateOrderCosts(cart_order_json);
        var total = calculateConsumerTotal(subtotal, order_costs);
        var fees = total - subtotal;
        var paidStatus = accounting_object[name] ? "" : "HAS NOT PAID!!";
        return name + " owes " + formatter.format(subtotal / 100) + " + " + formatter.format(fees / 100) + " = " + formatter.format(total / 100) + " -- " + paidStatus;
    })
        .join("\n");
}
function ordererAttachments(cart_order_json) {
    return getOrders(cart_order_json)
        .map(function (order) { return ({
        text: getName(order),
        value: order.id
    }); });
}
function printObject(obj) {
    Object.keys(obj).forEach(function (key) {
        console.log(key + ": " + obj[key]);
    });
}
//# sourceMappingURL=doordash.js.map