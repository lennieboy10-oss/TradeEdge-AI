import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MT4_EA = `//--- ChartIQ AI Trading Expert Advisor for MetaTrader 4
#property copyright "ChartIQ AI"
#property link      "https://trade-edge-ai.vercel.app"
#property version   "1.00"
#property strict

extern string APIKey       = "";     // Your ChartIQ API key
extern int    MinConfidence = 80;   // Minimum confidence to trade (75-95)
extern double MaxLotSize    = 0.10; // Maximum lot size per trade
extern bool   AutoTrade     = true; // Enable/disable auto-trading

datetime g_lastCheck = 0;
string   g_lastExpiry = "";

int OnInit() {
   EventSetTimer(60);
   Print("ChartIQ AI EA v1.00 — Initialised. AutoTrade=", AutoTrade);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) {
   EventKillTimer();
   Print("ChartIQ AI EA — Stopped.");
}

void OnTimer() {
   if(!AutoTrade) return;
   if(StringLen(APIKey) < 8) {
      Print("ChartIQ AI: No API key set. Enter your key in EA inputs.");
      return;
   }
   CheckForSignals();
}

string GetJsonValue(const string &json, const string key) {
   string searchKey = "\\"" + key + "\\":";
   int pos = StringFind(json, searchKey);
   if(pos < 0) return("");
   pos += StringLen(searchKey);
   while(pos < StringLen(json) && StringGetChar(json, pos) == ' ') pos++;
   bool isStr = (StringGetChar(json, pos) == '"');
   if(isStr) pos++;
   int end = pos;
   while(end < StringLen(json)) {
      ushort c = StringGetChar(json, end);
      if(isStr  && c == '"') break;
      if(!isStr && (c == ',' || c == '}')) break;
      end++;
   }
   return(StringSubstr(json, pos, end - pos));
}

void CheckForSignals() {
   string headers = "Content-Type: application/json\\r\\nAuthorization: Bearer " + APIKey + "\\r\\n";
   char post[], result[];
   string resultHeaders;

   int res = WebRequest(
      "GET",
      "https://trade-edge-ai.vercel.app/api/mt/signal",
      headers, 5000, post, result, resultHeaders
   );

   if(res != 200) {
      if(res == -1) Print("ChartIQ AI: WebRequest failed. Add trade-edge-ai.vercel.app to allowed URLs.");
      return;
   }

   string response = CharArrayToString(result);
   if(StringFind(response, "\\"hasSignal\\":true") < 0) return;

   // Deduplicate by expiry
   string expiry = GetJsonValue(response, "expiry");
   if(expiry == g_lastExpiry) return;

   ProcessSignal(response);
   g_lastExpiry = expiry;
}

void ProcessSignal(const string &response) {
   int    confidence = (int)StringToInteger(GetJsonValue(response, "confidence"));
   if(confidence < MinConfidence) return;

   string asset     = GetJsonValue(response, "asset");
   string direction = GetJsonValue(response, "direction");
   double entryP    = StringToDouble(GetJsonValue(response, "entry"));
   double slP       = StringToDouble(GetJsonValue(response, "stopLoss"));
   double tpP       = StringToDouble(GetJsonValue(response, "takeProfit"));

   if(Symbol() != asset) {
      Print("ChartIQ AI: Signal for ", asset, " but chart is ", Symbol(), ". Attach EA to correct chart.");
      return;
   }

   bool isBuy  = (direction == "BUY" || direction == "LONG");
   int  opType = isBuy ? OP_BUYLIMIT : OP_SELLLIMIT;
   double lot  = MathMin(MaxLotSize, 0.10);

   string comment = "ChartIQ AI " + direction + " " + IntegerToString(confidence) + "%";
   datetime expDT = TimeCurrent() + 86400;

   int ticket = OrderSend(
      Symbol(), opType, lot, entryP,
      3, slP, tpP,
      comment, 0, expDT,
      isBuy ? clrGreen : clrRed
   );

   if(ticket > 0) {
      Print("ChartIQ AI: Order placed #", ticket, " | ", direction, " | Confidence: ", confidence, "%");
      ConfirmTrade(ticket, asset, direction, entryP, slP, tpP, lot, confidence);
   } else {
      Print("ChartIQ AI: Order failed. Error: ", GetLastError());
   }
}

void ConfirmTrade(int ticket, string asset, string direction,
                  double entry, double sl, double tp,
                  double lot, int confidence) {
   string body = "{";
   body += "\\"ticket\\":" + IntegerToString(ticket) + ",";
   body += "\\"asset\\":\\"" + asset + "\\",";
   body += "\\"direction\\":\\"" + direction + "\\",";
   body += "\\"entry\\":" + DoubleToString(entry, 5) + ",";
   body += "\\"stopLoss\\":" + DoubleToString(sl, 5) + ",";
   body += "\\"takeProfit\\":" + DoubleToString(tp, 5) + ",";
   body += "\\"lotSize\\":" + DoubleToString(lot, 2) + ",";
   body += "\\"confidence\\":" + IntegerToString(confidence) + ",";
   body += "\\"platform\\":\\"MT4\\"";
   body += "}";

   char post[], result[];
   StringToCharArray(body, post, 0, StringLen(body));
   string headers = "Content-Type: application/json\\r\\nAuthorization: Bearer " + APIKey + "\\r\\n";
   string resultHeaders;
   WebRequest("POST", "https://trade-edge-ai.vercel.app/api/mt/confirm",
              headers, 5000, post, result, resultHeaders);
}
`;

const MT5_EA = `//--- ChartIQ AI Trading Expert Advisor for MetaTrader 5
#property copyright "ChartIQ AI"
#property link      "https://trade-edge-ai.vercel.app"
#property version   "1.00"

#include <Trade\\Trade.mqh>

input string APIKey        = "";     // Your ChartIQ API key
input int    MinConfidence = 80;    // Minimum confidence to trade (75-95)
input double MaxLotSize    = 0.10; // Maximum lot size per trade
input bool   AutoTrade     = true;  // Enable/disable auto-trading

CTrade   trade;
string   g_lastExpiry = "";

int OnInit() {
   EventSetTimer(60);
   Print("ChartIQ AI EA v1.00 — Initialised. AutoTrade=", AutoTrade);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) {
   EventKillTimer();
   Print("ChartIQ AI EA — Stopped.");
}

void OnTimer() {
   if(!AutoTrade) return;
   if(StringLen(APIKey) < 8) {
      Print("ChartIQ AI: No API key set. Enter your key in EA inputs.");
      return;
   }
   CheckForSignals();
}

string ExtractJson(const string &json, const string key) {
   string searchKey = "\\"" + key + "\\":";
   int pos = StringFind(json, searchKey);
   if(pos < 0) return("");
   pos += StringLen(searchKey);
   while(pos < StringLen(json) && StringGetCharacter(json, pos) == ' ') pos++;
   bool isStr = (StringGetCharacter(json, pos) == '"');
   if(isStr) pos++;
   int end = pos;
   while(end < StringLen(json)) {
      ushort c = StringGetCharacter(json, end);
      if(isStr  && c == '"') break;
      if(!isStr && (c == ',' || c == '}')) break;
      end++;
   }
   return(StringSubstr(json, pos, end - pos));
}

void CheckForSignals() {
   char post[], result[];
   string headers = "Content-Type: application/json\\r\\nAuthorization: Bearer " + APIKey + "\\r\\n";
   string resultHeaders;

   int res = WebRequest(
      "GET",
      "https://trade-edge-ai.vercel.app/api/mt/signal",
      headers, 5000, post, result, resultHeaders
   );

   if(res != 200) {
      if(res == -1) Print("ChartIQ AI: WebRequest failed. Add trade-edge-ai.vercel.app to allowed URLs in Tools → Options → Expert Advisors.");
      return;
   }

   string response = CharArrayToString(result);
   if(StringFind(response, "\\"hasSignal\\":true") < 0) return;

   string expiry = ExtractJson(response, "expiry");
   if(expiry == g_lastExpiry) return;

   ProcessSignal(response);
   g_lastExpiry = expiry;
}

void ProcessSignal(const string &response) {
   int confidence = (int)StringToInteger(ExtractJson(response, "confidence"));
   if(confidence < MinConfidence) return;

   string asset     = ExtractJson(response, "asset");
   string direction = ExtractJson(response, "direction");
   double entryP    = StringToDouble(ExtractJson(response, "entry"));
   double slP       = StringToDouble(ExtractJson(response, "stopLoss"));
   double tpP       = StringToDouble(ExtractJson(response, "takeProfit"));

   if(Symbol() != asset) {
      Print("ChartIQ AI: Signal for ", asset, " but chart is ", Symbol(), ". Attach EA to correct chart.");
      return;
   }

   bool   isBuy = (direction == "BUY" || direction == "LONG");
   double lot   = MathMin(MaxLotSize, 0.10);
   string comment = "ChartIQ AI " + direction + " " + IntegerToString(confidence) + "%";

   bool placed = false;
   if(isBuy)
      placed = trade.BuyLimit(lot, entryP, Symbol(), slP, tpP, ORDER_TIME_DAY, 0, comment);
   else
      placed = trade.SellLimit(lot, entryP, Symbol(), slP, tpP, ORDER_TIME_DAY, 0, comment);

   if(placed) {
      ulong ticket = trade.ResultOrder();
      Print("ChartIQ AI: Order placed #", ticket, " | ", direction, " | Confidence: ", confidence, "%");
      ConfirmTrade(ticket, asset, direction, entryP, slP, tpP, lot, confidence);
   } else {
      Print("ChartIQ AI: Order failed. Error: ", GetLastError(), " | Retcode: ", trade.ResultRetcode());
   }
}

void ConfirmTrade(ulong ticket, string asset, string direction,
                  double entry, double sl, double tp,
                  double lot, int confidence) {
   string body = "{";
   body += "\\"ticket\\":" + IntegerToString(ticket) + ",";
   body += "\\"asset\\":\\"" + asset + "\\",";
   body += "\\"direction\\":\\"" + direction + "\\",";
   body += "\\"entry\\":" + DoubleToString(entry, 5) + ",";
   body += "\\"stopLoss\\":" + DoubleToString(sl, 5) + ",";
   body += "\\"takeProfit\\":" + DoubleToString(tp, 5) + ",";
   body += "\\"lotSize\\":" + DoubleToString(lot, 2) + ",";
   body += "\\"confidence\\":" + IntegerToString(confidence) + ",";
   body += "\\"platform\\":\\"MT5\\"";
   body += "}";

   char post[], result[];
   StringToCharArray(body, post, 0, StringLen(body));
   string headers = "Content-Type: application/json\\r\\nAuthorization: Bearer " + APIKey + "\\r\\n";
   string resultHeaders;
   WebRequest("POST", "https://trade-edge-ai.vercel.app/api/mt/confirm",
              headers, 5000, post, result, resultHeaders);
}
`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const version = searchParams.get("version") ?? "mt4";
  const isMT5   = version === "mt5";

  const content  = isMT5 ? MT5_EA : MT4_EA;
  const filename = isMT5 ? "ChartIQ_AI_MT5.mq5" : "ChartIQ_AI_MT4.mq4";

  return new NextResponse(content, {
    headers: {
      "Content-Type":        "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
