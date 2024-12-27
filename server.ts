import { serve } from "https://deno.land/std@0.195.0/http/server.ts";


/*
NOTE:
* This server is bery simple and is infact not needed. It is possible to code the API requests and everything else into the websites JS and HTML (JS portions).
* This server was kept to see how I can runa  simple server as a backdrop and Plan B for the website. In this program the server caches Gold, Server and MAJOR_CURRENCIES.
* Thus allowing the API to go down and/or be unresponsive while still letting the user continue their calculations with the major currencies being used.
* Also this server can be ran using DENO2. Simply input deno run --allow-net server.ts and then running the index.html (i used Live Server extensions)
*/



const HEXARATE_BASE_URL = "https://hexarate.paikama.co/api/rates/latest/USD"; //Using this new API
//  that doesnt have limits so a high amount of people can have the most accurate rates. This can be replaced with other APIs that are more well known however they cost money.
const GOLD_API_XAU_URL = "https://api.gold-api.com/price/XAU"; //gold api
const GOLD_API_XAG_URL = "https://api.gold-api.com/price/XAG"; //silver api
const MITHQAL_TO_GRAM = 3.641667; //Bahai mithqal to gram conversion rate rounded - not used in this version
const MAJOR_CURRENCIES = ["USD", "SAR", "EUR", "GBP", "JPY", "INR", "CAD"]; //currencies server will fetch and store

//   caches for prices and conversion rates
const CONVERSION_CACHE: Record<string, number> = {}; // Cache for currency rates
let GOLD_PRICE_USD: number | null = null; // Gold price in USD per gram
let SILVER_PRICE_USD: number | null = null; // Silver price in USD per gram

// caches for conversion rates
async function fetchConversionRates() {
  for (const currency of MAJOR_CURRENCIES) {
    try {
      const response = await fetch(`${HEXARATE_BASE_URL}?target=${currency}`, {
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        console.error(`SERVER: Unable to fetch ${currency}: ${response.statusText}`);
        continue;
      }
      const data = await response.json();
      CONVERSION_CACHE[currency] = data.data.mid;
    } catch (error) {
      console.error(`SERVER: Unable to fetch ${currency}, ERROR:`, error);
    }
  }
  console.log("SERVER: Currency rates updated:", CONVERSION_CACHE);
}


async function fetchMetalPrices() { //Uses Gold and Silver prices in USD as a base to then convert to other currencies
  try {
    //gold prices
    const goldResponse = await fetch(GOLD_API_XAU_URL);
    if (goldResponse.ok) {
      const goldData = await goldResponse.json();
      GOLD_PRICE_USD = goldData.price / 31.1035; // Accurate conversion of OZ to GRAMS
    } else {
      console.error(`SERVER: Unable to fetch gold, ERROR: ${goldResponse.statusText}`);
    }

    // Fetch silver price
    const silverResponse = await fetch(GOLD_API_XAG_URL);
    if (silverResponse.ok) {
      const silverData = await silverResponse.json();
      SILVER_PRICE_USD = silverData.price / 31.1035; // Accurate conversion of OZ to GRAMS
    } else {
      console.error(`SERVER: Unable to fetch silver, ERROR: ${silverResponse.statusText}`);
    }

    console.log(`SERVER: Gold price: $${GOLD_PRICE_USD?.toFixed(2)} per gram`);
    console.log(`SERVER: Silver price: $${SILVER_PRICE_USD?.toFixed(2)} per gram`);
  } catch (error) {
    console.error("SERVER: Unable to fetch both, ERROR:", error);
  }
}


await fetchConversionRates(); //Fetch at server start/run
await fetchMetalPrices();

// Refresh Hourly
setInterval(fetchConversionRates, 3600 * 1000);
setInterval(fetchMetalPrices, 3600 * 1000);

//Incoming requests
async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname === "/api/conversion" && request.method === "GET") {
    const amount = parseFloat(url.searchParams.get("amount") || "0");
    const usdPrice = parseFloat(url.searchParams.get("usd_price") || "0");
    const currency = url.searchParams.get("currency");

    if (!amount || !usdPrice || !currency) {
      return new Response("ERROR", { status: 400 });
    }

    const conversionRate = CONVERSION_CACHE[currency];
    if (!conversionRate) {
      return new Response(`SERVER: Conversion rate for ${currency} not available`, { status: 404 });
    }

    const usdEquivalent = amount * usdPrice; //Calculate the mithqal value
    const convertedValue = usdEquivalent * conversionRate;

    return new Response(
      JSON.stringify({ amount, usdPrice, currency, convertedValue }, null, 2),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  if (pathname === "/api/metals" && request.method === "GET") {
    if (GOLD_PRICE_USD === null || SILVER_PRICE_USD === null) {
      return new Response("SERVER: Silver and Gold prices not available", { status: 503 });
    }
    return new Response(
      JSON.stringify(
        { goldPricePerGram: GOLD_PRICE_USD, silverPricePerGram: SILVER_PRICE_USD },
        null,
        2
      ),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response("Not Found", { status: 404 });
}

//starts the Server
console.log("Server running on http://localhost:8000");
await serve(handleRequest, { port: 8000 });
