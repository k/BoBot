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
var luxon_1 = require("luxon");
var queryString = require("query-string");
var aws_sdk_1 = require("aws-sdk");
var slack_1 = require("./slack");
var stepfunctions = new aws_sdk_1.StepFunctions();
var startExecution = function (params) {
    return new Promise(function (resolve, reject) {
        stepfunctions.startExecution(params, function (err, data) {
            if (err != null) {
                reject(err);
            }
            else {
                resolve(data);
            }
        });
    });
};
exports.startBoba = function (event, context) { return __awaiter(_this, void 0, void 0, function () {
    var _a, text, user_id, user_name, team_domain, args, url, time, zone, timestamp, message, error_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 5, , 6]);
                console.log(event);
                _a = queryString.parse(event.body), text = _a.text, user_id = _a.user_id, user_name = _a.user_name, team_domain = _a.team_domain;
                if (typeof text !== "string" ||
                    typeof user_id !== "string" ||
                    typeof user_name !== "string" ||
                    typeof team_domain !== "string") {
                    throw new Error("Error from slack");
                }
                args = text.split(" ");
                url = args[0];
                time = args[1];
                return [4 /*yield*/, slack_1.getTimeZone(user_id)];
            case 1:
                zone = _b.sent();
                timestamp = luxon_1.DateTime.fromFormat(time, "h:mma", { zone: zone }).toISO();
                message = args.splice(2);
                console.log(url);
                return [4 /*yield*/, slack_1.webhook.send({
                        attachments: [
                            {
                                fallback: "New Boba Order started by " + user_name + "! Order here: " + url,
                                color: "#36a64f",
                                pretext: "<!channel> It's about time for some boba",
                                author_name: user_name,
                                author_link: "http://" + team_domain + ".slack.com/team/" + user_id,
                                title: "New Boba Order!",
                                title_link: url,
                                text: "Order by clicking the url above",
                                fields: [
                                    {
                                        title: "Order Closes at",
                                        value: time,
                                        short: false
                                    }
                                ],
                                footer: "Boba",
                                footer_icon: "https://s3.amazonaws.com/k33.me/images/boba-icon.png",
                                ts: "" + Math.round(new Date().getTime() / 1000)
                            }
                        ]
                    })];
            case 2:
                _b.sent();
                return [4 /*yield*/, startExecution({
                        stateMachineArn: process.env.TIMER_ARN,
                        input: JSON.stringify({ timestamp: timestamp })
                    })];
            case 3:
                _b.sent();
                return [4 /*yield*/, startExecution({
                        stateMachineArn: process.env.POLLER_ARN,
                        input: JSON.stringify({ url: url, timestamp: timestamp })
                    })];
            case 4:
                _b.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: "Order started, I let everyone in the channel know!"
                    }];
            case 5:
                error_1 = _b.sent();
                console.log(error_1);
                throw error_1;
            case 6: return [2 /*return*/];
        }
    });
}); };
exports.sendNotification = function (event, context) { return __awaiter(_this, void 0, void 0, function () {
    var error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                console.log(event);
                return [4 /*yield*/, slack_1.webhook.send({ text: event.text })];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_2 = _a.sent();
                console.log(error_2);
                throw error_2;
            case 3: return [2 /*return*/];
        }
    });
}); };
//# sourceMappingURL=handler.js.map